import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { db, schema } from "@/db";
import type { Sessao } from "@/lib/auth/sessao";
import { salvarLayout } from "@/lib/dominio/layout-impressao";
import { lancarRodada } from "@/lib/dominio/rodadas";
import {
  criarDriverArquivo,
  type DriverImpressao,
} from "@/lib/impressao/driver";
import {
  processarProximo,
  recuperarInterrompidos,
} from "@/lib/impressao/worker";
import { chave, mesa, produto, sessaoDe } from "./helpers";

let garcom: Sessao;
let pasta: string;

const impressoraDoSetor = async (setor: "chapa" | "fritura" | "bar") => {
  const [i] = await db()
    .select()
    .from(schema.impressoras)
    .where(eq(schema.impressoras.setor, setor));
  return i;
};

const statusDaRodada = async (rodadaId: string) => {
  const [t] = await db()
    .select()
    .from(schema.trabalhosImpressao)
    .where(eq(schema.trabalhosImpressao.rodadaId, rodadaId));
  return t;
};

const lancarXis = async (numeroMesa: number) => {
  const m = await mesa(numeroMesa);
  const xis = await produto("Xis Buenas - Clássico");
  return lancarRodada(garcom, m.id, {
    idempotencyKey: chave(),
    itens: [
      {
        produtoId: xis.id,
        quantidade: 1,
        modificadorIds: [],
        observacao: "sem cebola",
      },
    ],
  });
};

// Processa a fila da chapa até esvaziar (ou até a impressora recusar).
const drenar = async (driver: DriverImpressao) => {
  const chapa = await impressoraDoSetor("chapa");
  for (let i = 0; i < 20; i++) {
    const { processou } = await processarProximo(chapa, {
      driver,
      backoffMs: [0, 0, 0],
      largura: 48,
      codepage: "PC850_MULTILINGUAL",
    });
    if (!processou) return;
  }
};

beforeAll(async () => {
  garcom = await sessaoDe("Garçom B");
  pasta = await mkdtemp(path.join(tmpdir(), "tickets-"));
});

afterAll(async () => {
  await rm(pasta, { recursive: true, force: true });
});

describe("worker de impressão", () => {
  it("imprime o ticket com mesa, item, modificadores e observação", async () => {
    const r = await lancarXis(1);
    const driver = criarDriverArquivo(pasta);
    await drenar(driver);

    expect((await statusDaRodada(r.rodadaId)).status).toBe("impresso");
    const chapa = await impressoraDoSetor("chapa");
    const pastaImpressora = path.join(
      pasta,
      chapa.nomeDriver.replace(/[^\w.-]+/g, "_"),
    );
    const arquivos = (await readdir(pastaImpressora)).filter((a) =>
      a.endsWith(".txt"),
    );
    const ticket = await readFile(
      path.join(pastaImpressora, arquivos[0]),
      "utf8",
    );
    expect(ticket).toContain("CHAPA");
    expect(ticket).toContain("MESA 1");
    // O número do cardápio não sai mais no papel (confundia a cozinha).
    expect(ticket).toContain("1x XIS BUENAS - CLÁSSICO");
    expect(ticket).not.toContain("1x 1 -");
    expect(ticket).toContain("OBS: sem cebola");
  });

  it("usa o layout salvo pelo gerente", async () => {
    await salvarLayout(garcom.funcionario.restauranteId, {
      modelo: "pedido",
      layout: {
        blocos: [
          {
            id: "mesa",
            ativo: true,
            estilo: { tamanho: "gigante", destaque: true },
            opcoes: { prefixo: "Mesa nº" },
          },
          {
            id: "detalhes",
            ativo: true,
            estilo: {},
            opcoes: { garcom: false },
          },
          { id: "itens", ativo: true, estilo: {}, opcoes: { codigo: true } },
          {
            id: "texto_rodape",
            ativo: true,
            estilo: {},
            opcoes: { texto: "Bom trabalho!" },
          },
        ],
      },
    });
    await lancarXis(8);
    await drenar(criarDriverArquivo(pasta));

    const chapa = await impressoraDoSetor("chapa");
    const pastaImpressora = path.join(
      pasta,
      chapa.nomeDriver.replace(/[^\w.-]+/g, "_"),
    );
    const tickets = await Promise.all(
      (await readdir(pastaImpressora))
        .filter((a) => a.endsWith(".txt"))
        .map((a) => readFile(path.join(pastaImpressora, a), "utf8")),
    );
    const ticket = tickets.find((t) => t.includes("Mesa nº 8")) ?? "";
    // Destaque: espaço de cada lado para o fundo escuro ter respiro.
    expect(ticket).toContain(" Mesa nº 8 ");
    expect(ticket).toContain("1x 1 - XIS BUENAS - CLÁSSICO");
    expect(ticket).not.toContain("Garçom B");
    expect(ticket).toContain("Bom trabalho!");
    // A mesa (obrigatória) continua; a ordem salva é respeitada.
    expect(ticket.indexOf("Mesa nº 8")).toBeLessThan(
      ticket.indexOf("XIS BUENAS"),
    );
    await salvarLayout(garcom.funcionario.restauranteId, {
      modelo: "pedido",
      layout: { blocos: [] },
    });
  });

  it("com a impressora offline não entrega ao spooler; imprime quando volta", async () => {
    const r = await lancarXis(2);
    const chapa = await impressoraDoSetor("chapa");
    const marcador = path.join(
      pasta,
      `${chapa.nomeDriver.replace(/[^\w.-]+/g, "_")}.offline`,
    );
    await writeFile(marcador, "");

    const driver = criarDriverArquivo(pasta);
    await drenar(driver);
    const enquantoOffline = await statusDaRodada(r.rodadaId);
    expect(enquantoOffline.status).toBe("pendente");
    expect(enquantoOffline.tentativas).toBe(0);

    await rm(marcador);
    await drenar(driver);
    expect((await statusDaRodada(r.rodadaId)).status).toBe("impresso");
  });

  it("falha 3 vezes e marca como falhou, sem perder o trabalho", async () => {
    const r = await lancarXis(3);
    const quebrado: DriverImpressao = {
      estado: async () => "pronta",
      enviar: async () => {
        throw new Error("sem papel");
      },
      estadoJob: async () => "concluido",
      cancelarJob: async () => {},
      listar: async () => [],
    };
    await drenar(quebrado);
    const trabalho = await statusDaRodada(r.rodadaId);
    expect(trabalho.status).toBe("falhou");
    expect(trabalho.tentativas).toBe(3);
    expect(trabalho.ultimoErro).toBe("sem papel");
  });

  it("job preso na fila do Windows é cancelado e tentado de novo", async () => {
    const r = await lancarXis(4);
    const cancelados: number[] = [];
    let envios = 0;
    const preso: DriverImpressao = {
      estado: async () => "pronta",
      enviar: async () => ({ job: ++envios }),
      // Primeiro envio nunca sai da fila; o segundo imprime.
      estadoJob: async (_nome, job) => (job === 1 ? "na_fila" : "concluido"),
      cancelarJob: async (_nome, job) => {
        cancelados.push(job);
      },
      listar: async () => [],
    };
    const chapa = await impressoraDoSetor("chapa");
    const opcoes = {
      driver: preso,
      backoffMs: [0, 0, 0],
      timeoutJobMs: 300,
      largura: 48,
    };
    // Esvazia o que sobrou dos testes anteriores sem olhar.
    await db()
      .update(schema.trabalhosImpressao)
      .set({ status: "descartado" })
      .where(eq(schema.trabalhosImpressao.status, "falhou"));

    await processarProximo(chapa, opcoes);
    expect(cancelados).toEqual([1]);
    expect((await statusDaRodada(r.rodadaId)).status).toBe("pendente");

    await processarProximo(chapa, opcoes);
    expect((await statusDaRodada(r.rodadaId)).status).toBe("impresso");
  });

  it("após reinício, trabalho interrompido volta para a fila como reimpressão", async () => {
    const r = await lancarXis(5);
    await db()
      .update(schema.trabalhosImpressao)
      .set({ status: "imprimindo", tentativas: 1 })
      .where(eq(schema.trabalhosImpressao.rodadaId, r.rodadaId));

    await recuperarInterrompidos(criarDriverArquivo(pasta));
    const trabalho = await statusDaRodada(r.rodadaId);
    expect(trabalho.status).toBe("pendente");
    expect(trabalho.tipo).toBe("reimpressao");
  });
});
