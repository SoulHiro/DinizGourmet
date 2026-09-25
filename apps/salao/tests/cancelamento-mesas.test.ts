import { and, eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";

import { db, schema } from "@/db";
import type { Sessao } from "@/lib/auth/sessao";
import { cancelarItem } from "@/lib/dominio/cancelamento";
import {
  detalharMesa,
  fecharComanda,
  juntarMesas,
  listarMapa,
  separarMesa,
  transferirComanda,
} from "@/lib/dominio/mesas";
import { lancarRodada } from "@/lib/dominio/rodadas";
import type { ErroDominio } from "@/lib/erros";
import { chave, definirEstoque, mesa, produto, sessaoDe } from "./helpers";

let garcom: Sessao;
beforeAll(async () => {
  garcom = await sessaoDe("Garçom A");
});

const estoqueDe = async (produtoId: string) => {
  const [p] = await db()
    .select({ estoque: schema.produtos.estoque })
    .from(schema.produtos)
    .where(eq(schema.produtos.id, produtoId));
  return p.estoque;
};

const trabalhosDaRodada = (rodadaId: string) =>
  db()
    .select()
    .from(schema.trabalhosImpressao)
    .where(eq(schema.trabalhosImpressao.rodadaId, rodadaId));

const itemDaRodada = async (rodadaId: string, produtoId: string) => {
  const [item] = await db()
    .select()
    .from(schema.itensPedido)
    .where(
      and(
        eq(schema.itensPedido.rodadaId, rodadaId),
        eq(schema.itensPedido.produtoId, produtoId),
      ),
    );
  return item;
};

describe("cancelamento de item", () => {
  it("antes de imprimir: tira do ticket e devolve o estoque", async () => {
    const m = await mesa(1);
    const cerveja = await produto("Cerveja Long Neck");
    const agua = await produto("Água sem Gás");
    await definirEstoque(cerveja.id, 10);

    const r = await lancarRodada(garcom, m.id, {
      idempotencyKey: chave(),
      itens: [
        { produtoId: cerveja.id, quantidade: 2, modificadorIds: [] },
        { produtoId: agua.id, quantidade: 1, modificadorIds: [] },
      ],
    });
    expect(await estoqueDe(cerveja.id)).toBe(8);

    const item = await itemDaRodada(r.rodadaId, cerveja.id);
    const resultado = await cancelarItem(garcom, item.id, {
      motivo: "Lançado errado",
      preparoIniciado: false,
    });
    expect(resultado.devolveuEstoque).toBe(true);
    expect(await estoqueDe(cerveja.id)).toBe(10);

    const [cancelado] = await db()
      .select()
      .from(schema.itensPedido)
      .where(eq(schema.itensPedido.id, item.id));
    expect(cancelado.status).toBe("cancelado");
    expect(cancelado.canceladoPor).toBe(garcom.funcionario.id);
    expect(cancelado.motivoCancelamento).toBe("Lançado errado");

    // Cerveja e água vão para o bar: o ticket ficou só com a água.
    const trabalhos = await trabalhosDaRodada(r.rodadaId);
    expect(trabalhos).toHaveLength(1);
    expect(trabalhos[0].payload.itens.map((i) => i.nome)).toEqual([
      "Água sem Gás",
    ]);
  });

  it("cancelar o único item de um ticket pendente descarta o trabalho", async () => {
    const m = await mesa(2);
    const batata = await produto("Batata Frita");
    const r = await lancarRodada(garcom, m.id, {
      idempotencyKey: chave(),
      itens: [{ produtoId: batata.id, quantidade: 1, modificadorIds: [] }],
    });
    const item = await itemDaRodada(r.rodadaId, batata.id);
    await cancelarItem(garcom, item.id, {
      motivo: "Cliente desistiu",
      preparoIniciado: false,
    });
    const [trabalho] = await trabalhosDaRodada(r.rodadaId);
    expect(trabalho.status).toBe("descartado");
  });

  it("depois de impresso com preparo iniciado: aviso na cozinha e sem devolver estoque", async () => {
    const m = await mesa(3);
    const coracao = await produto("Xis Tri Bom - Frango");
    await definirEstoque(coracao.id, 5);
    const r = await lancarRodada(garcom, m.id, {
      idempotencyKey: chave(),
      itens: [{ produtoId: coracao.id, quantidade: 1, modificadorIds: [] }],
    });
    await db()
      .update(schema.trabalhosImpressao)
      .set({ status: "impresso", impressoEm: new Date() })
      .where(eq(schema.trabalhosImpressao.rodadaId, r.rodadaId));

    const item = await itemDaRodada(r.rodadaId, coracao.id);
    const resultado = await cancelarItem(garcom, item.id, {
      motivo: "Demora no preparo",
      preparoIniciado: true,
    });
    expect(resultado.devolveuEstoque).toBe(false);
    expect(await estoqueDe(coracao.id)).toBe(4);

    const trabalhos = await trabalhosDaRodada(r.rodadaId);
    const aviso = trabalhos.find((t) => t.tipo === "cancelamento");
    expect(aviso?.status).toBe("pendente");
    expect(aviso?.payload.itens[0].nome).toBe("Xis Tri Bom - Frango");
    expect(aviso?.payload.preparoIniciado).toBe(true);
  });

  it("não cancela duas vezes", async () => {
    const m = await mesa(4);
    const agua = await produto("Água sem Gás");
    const r = await lancarRodada(garcom, m.id, {
      idempotencyKey: chave(),
      itens: [{ produtoId: agua.id, quantidade: 1, modificadorIds: [] }],
    });
    const item = await itemDaRodada(r.rodadaId, agua.id);
    await cancelarItem(garcom, item.id, {
      motivo: "Outro motivo",
      preparoIniciado: false,
    });
    await expect(
      cancelarItem(garcom, item.id, {
        motivo: "Outro motivo",
        preparoIniciado: false,
      }),
    ).rejects.toMatchObject({ codigo: "ja_cancelado" });
  });
});

describe("mesas: status, juntar, separar, transferir, fechar", () => {
  it("status derivado: livre, aguardando (sem pedido) e ocupada", async () => {
    const m10 = await mesa(10);
    const m11 = await mesa(11);
    await juntarMesas(garcom, m10.id, [m11.id]);

    let mapa = await listarMapa(garcom.funcionario.restauranteId);
    const s10 = mapa.find((x) => x.numero === 10);
    expect(s10?.status).toBe("aguardando");
    expect(s10?.agrupadaCom).toEqual([11]);
    expect(mapa.find((x) => x.numero === 12)?.status).toBe("livre");

    const agua = await produto("Água sem Gás");
    await lancarRodada(garcom, m11.id, {
      idempotencyKey: chave(),
      itens: [{ produtoId: agua.id, quantidade: 2, modificadorIds: [] }],
    });
    mapa = await listarMapa(garcom.funcionario.restauranteId);
    expect(mapa.find((x) => x.numero === 10)?.status).toBe("ocupada");
    expect(mapa.find((x) => x.numero === 11)?.totalCentavos).toBe(1000);
  });

  it("junta mesas preservando a mesa de origem de cada item", async () => {
    const m12 = await mesa(12);
    const m13 = await mesa(13);
    const agua = await produto("Água sem Gás");
    const refri = await produto("Refrigerante Lata");
    await definirEstoque(refri.id, 50);

    await lancarRodada(garcom, m12.id, {
      idempotencyKey: chave(),
      itens: [{ produtoId: agua.id, quantidade: 1, modificadorIds: [] }],
    });
    await juntarMesas(garcom, m12.id, [m13.id]);
    await lancarRodada(garcom, m12.id, {
      idempotencyKey: chave(),
      itens: [
        {
          produtoId: refri.id,
          quantidade: 1,
          modificadorIds: [],
          mesaOrigemId: m13.id,
        },
      ],
    });

    const detalhe = await detalharMesa(
      garcom.funcionario.restauranteId,
      m13.id,
    );
    expect(detalhe.comanda?.mesas.map((x) => x.numero)).toEqual([12, 13]);
    expect(detalhe.comanda?.totaisPorMesa).toEqual(
      expect.arrayContaining([
        { numero: 12, totalCentavos: 500 },
        { numero: 13, totalCentavos: 700 },
      ]),
    );
  });

  it("não junta mesa que já tem pedidos em outra comanda", async () => {
    const m14 = await mesa(14);
    const m15 = await mesa(15);
    const agua = await produto("Água sem Gás");
    await lancarRodada(garcom, m15.id, {
      idempotencyKey: chave(),
      itens: [{ produtoId: agua.id, quantidade: 1, modificadorIds: [] }],
    });
    await expect(juntarMesas(garcom, m14.id, [m15.id])).rejects.toMatchObject({
      codigo: "mesa_com_pedidos",
    } satisfies Partial<ErroDominio>);
  });

  it("separa a mesa agrupada, mas não a principal", async () => {
    const m12 = await mesa(12);
    const m13 = await mesa(13);
    await expect(separarMesa(garcom, m12.id)).rejects.toMatchObject({
      codigo: "mesa_principal",
    });
    await separarMesa(garcom, m13.id);
    const mapa = await listarMapa(garcom.funcionario.restauranteId);
    expect(mapa.find((x) => x.numero === 13)?.status).toBe("livre");
    // O item da mesa 13 continua na conta da comanda.
    const detalhe = await detalharMesa(
      garcom.funcionario.restauranteId,
      m12.id,
    );
    expect(detalhe.comanda?.totalCentavos).toBe(1200);
  });

  it("transfere a comanda inteira para uma mesa livre", async () => {
    const m12 = await mesa(12);
    const m16 = await mesa(16);
    await transferirComanda(garcom, m12.id, m16.id);
    const mapa = await listarMapa(garcom.funcionario.restauranteId);
    expect(mapa.find((x) => x.numero === 12)?.status).toBe("livre");
    expect(mapa.find((x) => x.numero === 16)?.status).toBe("ocupada");
    expect(mapa.find((x) => x.numero === 16)?.totalCentavos).toBe(1200);
  });

  it("transferir com mesas juntas libera todas e leva a comanda para o destino", async () => {
    const m17 = await mesa(17);
    const m18 = await mesa(18);
    const m19 = await mesa(19);
    const agua = await produto("Água sem Gás");
    await lancarRodada(garcom, m17.id, {
      idempotencyKey: chave(),
      itens: [{ produtoId: agua.id, quantidade: 1, modificadorIds: [] }],
    });
    await juntarMesas(garcom, m17.id, [m18.id]);
    await transferirComanda(garcom, m17.id, m19.id);
    const mapa = await listarMapa(garcom.funcionario.restauranteId);
    expect(mapa.find((x) => x.numero === 17)?.status).toBe("livre");
    expect(mapa.find((x) => x.numero === 18)?.status).toBe("livre");
    expect(mapa.find((x) => x.numero === 19)?.status).toBe("ocupada");
    expect(mapa.find((x) => x.numero === 19)?.agrupadaCom).toEqual([]);
  });

  it("fecha a comanda e libera todas as mesas dela", async () => {
    const m10 = await mesa(10);
    await fecharComanda(garcom, m10.id);
    const mapa = await listarMapa(garcom.funcionario.restauranteId);
    expect(mapa.find((x) => x.numero === 10)?.status).toBe("livre");
    expect(mapa.find((x) => x.numero === 11)?.status).toBe("livre");
  });
});
