import { randomUUID } from "node:crypto";
import { and, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";

import { db, schema } from "@/db";
import type { Sessao } from "@/lib/auth/sessao";
import { conflito, naoEncontrado } from "@/lib/erros";
import { notificar } from "@/lib/runtime";
import { buscarComandaAberta, mesasDaComanda } from "./comum";
import { abrirComanda, comandaPorNumero } from "./mesas";

export const moverItensSchema = z.object({
  itemIds: z.array(z.uuid()).min(1).max(100),
  // Cartão que recebe os itens: se não estiver aberto, abre na mesma mesa.
  numeroCartao: z.number().int().min(1).max(9999),
});

// Dividir a comanda: itens já lançados passam para outro cartão (ex.: o
// casal decidiu pagar separado). Os itens vão numa rodada nova do cartão de
// destino, sem imprimir de novo (a cozinha já recebeu o pedido).
export const moverItens = async (
  sessao: Sessao,
  comandaOrigemId: string,
  { itemIds, numeroCartao }: z.infer<typeof moverItensSchema>,
) => {
  const { restauranteId } = sessao.funcionario;
  const origem = await buscarComandaAberta(
    db(),
    restauranteId,
    comandaOrigemId,
  );
  if (origem.numero === numeroCartao) {
    throw conflito(
      "mesmo_cartao",
      "Escolha outro cartão para receber os itens.",
    );
  }

  // Destino: comanda aberta do cartão, ou abre agora na mesa da origem.
  let destinoId: string;
  let abriuAgora = false;
  try {
    destinoId = (await comandaPorNumero(restauranteId, numeroCartao)).comandaId;
  } catch {
    const [mesa] = await mesasDaComanda(db(), origem.id);
    if (!mesa) throw naoEncontrado("Mesa da comanda");
    destinoId = (
      await abrirComanda(sessao, { mesaId: mesa.id, numero: numeroCartao })
    ).comandaId;
    abriuAgora = true;
  }

  const movidos = await db().transaction(async (tx) => {
    await tx.execute(
      sql`select id from comanda where id in (${origem.id}, ${destinoId}) for update`,
    );
    await buscarComandaAberta(tx, restauranteId, destinoId);

    const itens = await tx
      .select({ id: schema.itensPedido.id })
      .from(schema.itensPedido)
      .where(
        and(
          inArray(schema.itensPedido.id, itemIds),
          eq(schema.itensPedido.comandaId, origem.id),
          eq(schema.itensPedido.status, "ativo"),
        ),
      );
    if (itens.length === 0) {
      throw conflito(
        "nada_para_mover",
        "Nenhum desses itens está nesta comanda.",
      );
    }

    const [{ proximo }] = (
      await tx.execute<{ proximo: number }>(
        sql`select coalesce(max(numero), 0)::int + 1 as proximo from rodada where comanda_id = ${destinoId}`,
      )
    ).rows;
    const [rodada] = await tx
      .insert(schema.rodadas)
      .values({
        restauranteId,
        comandaId: destinoId,
        funcionarioId: sessao.funcionario.id,
        numero: proximo,
        idempotencyKey: randomUUID(),
      })
      .returning({ id: schema.rodadas.id });

    await tx
      .update(schema.itensPedido)
      .set({ comandaId: destinoId, rodadaId: rodada.id })
      .where(
        inArray(
          schema.itensPedido.id,
          itens.map((i) => i.id),
        ),
      );
    return itens.length;
  });

  notificar(restauranteId, ["mesas"]);
  return { comandaId: destinoId, movidos, abriuAgora };
};
