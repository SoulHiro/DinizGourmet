import { and, asc, eq, isNull, lt, ne, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import { db, schema } from "@/db";
import type { Sessao } from "@/lib/auth/sessao";
import {
  conflito,
  naoEncontrado,
  semPermissao,
  violouConstraint,
} from "@/lib/erros";
import { notificar } from "@/lib/runtime";
import { buscarMesa, comandaAbertaDaMesa } from "./comum";

export type PedidoAjuda = {
  id: string;
  mesaId: string;
  mesaNumero: number;
  solicitanteId: string;
  solicitante: string;
  criadoEm: string;
  aceitoPor: string | null;
  aceitoPorId: string | null;
  escalado: boolean;
};

// Garçom sobrecarregado pede ajuda. Apertar de novo na mesma mesa não
// duplica: o índice único devolve o pedido que já está aberto.
export const pedirAjuda = async (sessao: Sessao, mesaId: string) => {
  const { restauranteId } = sessao.funcionario;
  const mesa = await buscarMesa(db(), restauranteId, mesaId);
  const comanda = await comandaAbertaDaMesa(db(), mesaId);

  try {
    const [pedido] = await db()
      .insert(schema.pedidosAjuda)
      .values({
        restauranteId,
        mesaId: mesa.id,
        comandaId: comanda?.id ?? null,
        solicitanteId: sessao.funcionario.id,
      })
      .returning({ id: schema.pedidosAjuda.id });
    notificar(restauranteId, ["ajuda", "mesas"]);
    return { id: pedido.id, jaExistia: false };
  } catch (error) {
    if (!violouConstraint(error, "pedido_ajuda_mesa_aberto_idx")) throw error;
    const [aberto] = await db()
      .select({ id: schema.pedidosAjuda.id })
      .from(schema.pedidosAjuda)
      .where(
        and(
          eq(schema.pedidosAjuda.mesaId, mesa.id),
          isNull(schema.pedidosAjuda.encerradoEm),
          isNull(schema.pedidosAjuda.aceitoPor),
        ),
      );
    return { id: aberto.id, jaExistia: true };
  }
};

// Pedidos em aberto: os ainda sem resposta (para todos) e os já aceitos que
// o solicitante ainda não dispensou (para mostrar "Fulano vai te ajudar").
export const listarAjudas = async (
  restauranteId: string,
): Promise<PedidoAjuda[]> => {
  const solicitante = alias(schema.funcionarios, "solicitante");
  const ajudante = alias(schema.funcionarios, "ajudante");
  const linhas = await db()
    .select({
      id: schema.pedidosAjuda.id,
      mesaId: schema.pedidosAjuda.mesaId,
      mesaNumero: schema.mesas.numero,
      solicitanteId: schema.pedidosAjuda.solicitanteId,
      solicitante: solicitante.nome,
      criadoEm: schema.pedidosAjuda.criadoEm,
      aceitoPor: ajudante.nome,
      aceitoPorId: schema.pedidosAjuda.aceitoPor,
      escaladoEm: schema.pedidosAjuda.escaladoEm,
    })
    .from(schema.pedidosAjuda)
    .innerJoin(schema.mesas, eq(schema.mesas.id, schema.pedidosAjuda.mesaId))
    .innerJoin(
      solicitante,
      eq(solicitante.id, schema.pedidosAjuda.solicitanteId),
    )
    .leftJoin(ajudante, eq(ajudante.id, schema.pedidosAjuda.aceitoPor))
    .where(
      and(
        eq(schema.pedidosAjuda.restauranteId, restauranteId),
        isNull(schema.pedidosAjuda.encerradoEm),
      ),
    )
    .orderBy(asc(schema.pedidosAjuda.criadoEm));

  return linhas.map((l) => ({
    id: l.id,
    mesaId: l.mesaId,
    mesaNumero: l.mesaNumero,
    solicitanteId: l.solicitanteId,
    solicitante: l.solicitante,
    criadoEm: l.criadoEm.toISOString(),
    aceitoPor: l.aceitoPor,
    aceitoPorId: l.aceitoPorId,
    escalado: l.escaladoEm !== null,
  }));
};

// O primeiro que aceitar leva; os outros recebem conflito e o alerta some.
export const aceitarAjuda = async (sessao: Sessao, pedidoId: string) => {
  const { restauranteId, id: funcionarioId } = sessao.funcionario;
  const [aceito] = await db()
    .update(schema.pedidosAjuda)
    .set({ aceitoPor: funcionarioId, aceitoEm: new Date() })
    .where(
      and(
        eq(schema.pedidosAjuda.id, pedidoId),
        eq(schema.pedidosAjuda.restauranteId, restauranteId),
        isNull(schema.pedidosAjuda.aceitoPor),
        isNull(schema.pedidosAjuda.encerradoEm),
        ne(schema.pedidosAjuda.solicitanteId, funcionarioId),
      ),
    )
    .returning({
      id: schema.pedidosAjuda.id,
      mesaId: schema.pedidosAjuda.mesaId,
    });
  if (!aceito) {
    throw conflito(
      "ja_atendido",
      "Outro garçom já aceitou este pedido de ajuda.",
    );
  }
  notificar(restauranteId, ["ajuda", "mesas"]);
  return aceito;
};

// Solicitante dispensa o aviso (ou cancela se ainda ninguém aceitou).
// O gerente pode encerrar qualquer um.
export const encerrarAjuda = async (sessao: Sessao, pedidoId: string) => {
  const { restauranteId, id: funcionarioId, papel } = sessao.funcionario;
  const [pedido] = await db()
    .select()
    .from(schema.pedidosAjuda)
    .where(
      and(
        eq(schema.pedidosAjuda.id, pedidoId),
        eq(schema.pedidosAjuda.restauranteId, restauranteId),
      ),
    );
  if (!pedido) throw naoEncontrado("Pedido de ajuda");
  if (pedido.solicitanteId !== funcionarioId && papel !== "gerente")
    throw semPermissao();

  await db()
    .update(schema.pedidosAjuda)
    .set({ encerradoEm: new Date() })
    .where(eq(schema.pedidosAjuda.id, pedidoId));
  notificar(restauranteId, ["ajuda", "mesas"]);
};

// Roda periodicamente no servidor: pedido sem resposta vira alerta para o
// gerente; aceitos esquecidos na tela são encerrados sozinhos.
export const manutencaoAjudas = async (escalarAposSegundos: number) => {
  const escalados = await db()
    .update(schema.pedidosAjuda)
    .set({ escaladoEm: new Date() })
    .where(
      and(
        isNull(schema.pedidosAjuda.aceitoPor),
        isNull(schema.pedidosAjuda.encerradoEm),
        isNull(schema.pedidosAjuda.escaladoEm),
        lt(
          schema.pedidosAjuda.criadoEm,
          sql`now() - make_interval(secs => ${escalarAposSegundos})`,
        ),
      ),
    )
    .returning({ restauranteId: schema.pedidosAjuda.restauranteId });

  const encerrados = await db()
    .update(schema.pedidosAjuda)
    .set({ encerradoEm: new Date() })
    .where(
      and(
        isNull(schema.pedidosAjuda.encerradoEm),
        or(
          lt(schema.pedidosAjuda.aceitoEm, sql`now() - interval '10 minutes'`),
          lt(schema.pedidosAjuda.criadoEm, sql`now() - interval '2 hours'`),
        ),
      ),
    )
    .returning({ restauranteId: schema.pedidosAjuda.restauranteId });

  const afetados = new Set(
    [...escalados, ...encerrados].map((p) => p.restauranteId),
  );
  for (const restauranteId of afetados)
    notificar(restauranteId, ["ajuda", "mesas"]);
  return { escalados: escalados.length, encerrados: encerrados.length };
};
