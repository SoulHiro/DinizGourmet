import { and, count, eq, inArray, sql } from "drizzle-orm";

import { db, schema } from "@/db";
import type { SetorImpressora, TicketPayload } from "@/db/schema";
import { carregarLayout } from "@/lib/dominio/layout-impressao";
import { env } from "@/lib/env";
import { notificar, runtime, type StatusImpressora } from "@/lib/runtime";
import {
  criarDriverPadrao,
  type DriverImpressao,
  type EstadoImpressora,
} from "./driver";
import {
  type Codepage,
  montarLinhas,
  renderizarEscPos,
  renderizarTexto,
  type TipoTicket,
} from "./ticket";

export const MAX_TENTATIVAS = 3;
const BACKOFF_PADRAO_MS = [2_000, 8_000, 30_000];

type ImpressoraAtiva = {
  id: string;
  restauranteId: string;
  nome: string;
  nomeDriver: string;
  setor: SetorImpressora;
};

type TrabalhoReivindicado = {
  id: string;
  restaurante_id: string;
  tipo: TipoTicket;
  payload: TicketPayload;
  tentativas: number;
};

const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Pega o próximo trabalho da impressora sem disputar com outro worker nem
// com um cancelamento que esteja editando o payload (SKIP LOCKED).
const reivindicar = async (impressoraId: string) => {
  const resultado = await db().execute<TrabalhoReivindicado>(sql`
    update trabalho_impressao
       set status = 'imprimindo', tentativas = tentativas + 1
     where id = (
       select id from trabalho_impressao
        where impressora_id = ${impressoraId}
          and status = 'pendente'
          and proxima_tentativa_em <= now()
        order by criado_em
        limit 1
        for update skip locked
     )
    returning id, restaurante_id, tipo, payload, tentativas
  `);
  return resultado.rows[0];
};

const esperarJob = async (
  driver: DriverImpressao,
  nomeDriver: string,
  job: number,
  timeoutMs: number,
) => {
  const limite = Date.now() + timeoutMs;
  while (Date.now() < limite) {
    const estado = await driver.estadoJob(nomeDriver, job);
    if (estado === "concluido") return;
    if (estado === "erro") {
      await driver.cancelarJob(nomeDriver, job);
      throw new Error("o Windows reportou erro no job de impressão");
    }
    await dormir(500);
  }
  // Job preso na fila do Windows (impressora desligada que ainda aparece
  // como pronta). Cancela para não sair duplicado quando religar.
  await driver.cancelarJob(nomeDriver, job);
  throw new Error("job ficou preso na fila do Windows");
};

export type OpcoesProcessamento = {
  driver: DriverImpressao;
  backoffMs?: number[];
  timeoutJobMs?: number;
  largura?: number;
  codepage?: Codepage;
};

// Processa no máximo um trabalho. Retorna o estado da impressora e se
// processou algo. Exportado para os testes controlarem o ritmo.
export const processarProximo = async (
  impressora: ImpressoraAtiva,
  opcoes: OpcoesProcessamento,
): Promise<{ estado: EstadoImpressora; processou: boolean }> => {
  const { driver } = opcoes;
  const backoff = opcoes.backoffMs ?? BACKOFF_PADRAO_MS;

  const estado = await driver.estado(impressora.nomeDriver);
  // Não entrega ticket ao spooler com a impressora offline: ele aceitaria e
  // seguraria o job, e o sistema acharia que imprimiu.
  if (estado === "offline" || estado === "erro") {
    return { estado, processou: false };
  }

  const trabalho = await reivindicar(impressora.id);
  if (!trabalho) return { estado, processou: false };

  // Layout personalizado pelo gerente (conta ou pedido); falhar ao ler não
  // pode impedir a impressão, então cai no padrão.
  const layout = await carregarLayout(
    trabalho.restaurante_id,
    trabalho.tipo === "conta" ? "conta" : "pedido",
  ).catch(() => undefined);
  const linhas = montarLinhas(
    trabalho.tipo,
    impressora.setor,
    trabalho.payload,
    layout,
  );
  const largura = opcoes.largura ?? env().IMPRESSAO_LARGURA;

  try {
    const { job } = await driver.enviar(impressora.nomeDriver, {
      escPos: renderizarEscPos(
        linhas,
        largura,
        opcoes.codepage ?? env().IMPRESSAO_CODEPAGE,
      ),
      texto: renderizarTexto(linhas, largura),
      nomeJob: `mesa-${trabalho.payload.mesas[0]}-r${trabalho.payload.rodada}`,
    });

    if (job !== null) {
      await db()
        .update(schema.trabalhosImpressao)
        .set({ jobSpooler: job })
        .where(eq(schema.trabalhosImpressao.id, trabalho.id));
      await esperarJob(
        driver,
        impressora.nomeDriver,
        job,
        opcoes.timeoutJobMs ?? env().IMPRESSAO_TIMEOUT_JOB_MS,
      );
    }

    await db()
      .update(schema.trabalhosImpressao)
      .set({ status: "impresso", impressoEm: new Date(), ultimoErro: null })
      .where(eq(schema.trabalhosImpressao.id, trabalho.id));
  } catch (error) {
    const esgotou = trabalho.tentativas >= MAX_TENTATIVAS;
    const espera =
      backoff[Math.min(trabalho.tentativas - 1, backoff.length - 1)];
    await db()
      .update(schema.trabalhosImpressao)
      .set({
        status: esgotou ? "falhou" : "pendente",
        proximaTentativaEm: new Date(Date.now() + espera),
        ultimoErro: (error as Error).message,
        jobSpooler: null,
      })
      .where(eq(schema.trabalhosImpressao.id, trabalho.id));
    console.warn(
      `[impressao] ${impressora.nome}: tentativa ${trabalho.tentativas} falhou: ${(error as Error).message}`,
    );
  }

  notificar(trabalho.restaurante_id, ["impressao"]);
  return { estado, processou: true };
};

// Depois de um crash no meio da impressão: o que já saiu do spooler conta
// como impresso; o resto volta para a fila (melhor duplicar que perder).
export const recuperarInterrompidos = async (driver: DriverImpressao) => {
  const presos = await db()
    .select({
      id: schema.trabalhosImpressao.id,
      tipo: schema.trabalhosImpressao.tipo,
      jobSpooler: schema.trabalhosImpressao.jobSpooler,
      nomeDriver: schema.impressoras.nomeDriver,
    })
    .from(schema.trabalhosImpressao)
    .innerJoin(
      schema.impressoras,
      eq(schema.impressoras.id, schema.trabalhosImpressao.impressoraId),
    )
    .where(eq(schema.trabalhosImpressao.status, "imprimindo"));

  for (const preso of presos) {
    let concluido = false;
    if (preso.jobSpooler !== null) {
      concluido = await driver
        .estadoJob(preso.nomeDriver, preso.jobSpooler)
        .then((e) => e === "concluido")
        .catch(() => false);
      if (!concluido)
        await driver.cancelarJob(preso.nomeDriver, preso.jobSpooler);
    }
    await db()
      .update(schema.trabalhosImpressao)
      .set(
        concluido
          ? { status: "impresso", impressoEm: new Date() }
          : {
              status: "pendente",
              tipo: preso.tipo === "pedido" ? "reimpressao" : preso.tipo,
              jobSpooler: null,
              proximaTentativaEm: new Date(),
            },
      )
      .where(eq(schema.trabalhosImpressao.id, preso.id));
  }
  return presos.length;
};

const listarImpressorasAtivas = () =>
  db()
    .select({
      id: schema.impressoras.id,
      restauranteId: schema.impressoras.restauranteId,
      nome: schema.impressoras.nome,
      nomeDriver: schema.impressoras.nomeDriver,
      setor: schema.impressoras.setor,
    })
    .from(schema.impressoras)
    .where(eq(schema.impressoras.ativa, true));

export type ControleImpressao = {
  acordar(): void;
  status(): Promise<StatusImpressora[]>;
  parar(): Promise<void>;
};

export const iniciarImpressao = (
  opcoes: Partial<OpcoesProcessamento> & { intervaloMs?: number } = {},
): ControleImpressao => {
  const driver = opcoes.driver ?? criarDriverPadrao();
  const intervaloMs = opcoes.intervaloMs ?? 5_000;
  const estados = new Map<string, EstadoImpressora>();
  const loops = new Map<string, { ativo: boolean; fim: Promise<void> }>();
  let despertadores: (() => void)[] = [];
  let parado = false;

  const acordar = () => {
    const pendentes = despertadores;
    despertadores = [];
    for (const despertar of pendentes) despertar();
  };

  const esperar = (ms: number) =>
    new Promise<void>((resolve) => {
      const timer = setTimeout(resolve, ms);
      despertadores.push(() => {
        clearTimeout(timer);
        resolve();
      });
    });

  // Um loop por impressora: tickets da mesma impressora saem em série.
  const iniciarLoop = (impressora: ImpressoraAtiva) => {
    const controle = { ativo: true, fim: Promise.resolve() };
    controle.fim = (async () => {
      while (controle.ativo && !parado) {
        try {
          const { estado, processou } = await processarProximo(impressora, {
            ...opcoes,
            driver,
          });
          const anterior = estados.get(impressora.id);
          estados.set(impressora.id, estado);
          if (anterior !== estado) {
            notificar(impressora.restauranteId, ["impressao"]);
          }
          if (processou) continue;
        } catch (error) {
          console.error(
            `[impressao] erro no loop de ${impressora.nome}:`,
            error,
          );
        }
        await esperar(intervaloMs);
      }
    })();
    loops.set(impressora.id, controle);
  };

  // Periodicamente: pega impressoras novas/removidas e reenfileira o que
  // falhou quando a impressora volta a ficar pronta (reenvio automático).
  const supervisionar = async () => {
    const ativas = await listarImpressorasAtivas();
    const ids = new Set(ativas.map((i) => i.id));
    for (const impressora of ativas) {
      if (!loops.has(impressora.id)) iniciarLoop(impressora);
    }
    for (const [id, loop] of loops) {
      if (!ids.has(id)) {
        loop.ativo = false;
        loops.delete(id);
      }
    }
    const prontas = ativas
      .filter((i) => estados.get(i.id) === "pronta")
      .map((i) => i.id);
    if (prontas.length) {
      const reabertos = await db()
        .update(schema.trabalhosImpressao)
        .set({
          status: "pendente",
          tentativas: 0,
          proximaTentativaEm: new Date(),
        })
        .where(
          and(
            eq(schema.trabalhosImpressao.status, "falhou"),
            inArray(schema.trabalhosImpressao.impressoraId, prontas),
          ),
        )
        .returning({ id: schema.trabalhosImpressao.id });
      if (reabertos.length) acordar();
    }
  };

  let supervisor: NodeJS.Timeout | undefined;
  const boot = (async () => {
    const recuperados = await recuperarInterrompidos(driver);
    if (recuperados) {
      console.warn(
        `[impressao] ${recuperados} trabalho(s) recuperado(s) após reinício`,
      );
    }
    await supervisionar();
    supervisor = setInterval(() => {
      supervisionar().catch((error) =>
        console.error("[impressao] erro no supervisor:", error),
      );
    }, 30_000);
  })().catch((error) => console.error("[impressao] falha ao iniciar:", error));

  const status = async (): Promise<StatusImpressora[]> => {
    const ativas = await listarImpressorasAtivas();
    const contagem = await db()
      .select({
        impressoraId: schema.trabalhosImpressao.impressoraId,
        total: count(),
      })
      .from(schema.trabalhosImpressao)
      .where(
        inArray(schema.trabalhosImpressao.status, [
          "pendente",
          "imprimindo",
          "falhou",
        ]),
      )
      .groupBy(schema.trabalhosImpressao.impressoraId);
    const porImpressora = new Map(
      contagem.map((c) => [c.impressoraId, c.total]),
    );
    return Promise.all(
      ativas.map(async (impressora) => {
        const estado = estados.get(impressora.id);
        const problema = estado === "offline" || estado === "erro";
        return {
          motivo: problema
            ? await driver
                .diagnosticar?.(impressora.nomeDriver)
                .catch(() => undefined)
            : undefined,
          id: impressora.id,
          nome: impressora.nome,
          nomeDriver: impressora.nomeDriver,
          estado:
            estado === "pronta" ||
            estado === "ocupada" ||
            estado === "offline" ||
            estado === "erro"
              ? estado
              : "desconhecido",
          pendentes: porImpressora.get(impressora.id) ?? 0,
        };
      }),
    );
  };

  const controle: ControleImpressao = {
    acordar,
    status,
    async parar() {
      parado = true;
      if (supervisor) clearInterval(supervisor);
      acordar();
      await boot;
      await Promise.all([...loops.values()].map((l) => l.fim));
    },
  };

  runtime().acordarImpressao = acordar;
  runtime().statusImpressoras = status;
  runtime().impressorasDoSistema = () => driver.listar().catch(() => []);
  return controle;
};
