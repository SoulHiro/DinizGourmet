import { and, asc, eq, isNull, sql } from "drizzle-orm";
import { z } from "zod";

import { db, schema } from "@/db";
import { naoEncontrado } from "@/lib/erros";

// Cartões físicos de comanda (/gerente > Cartões): criar a numeração,
// desativar um cartão perdido e imprimir o QR e o código de barras de cada um.

export type CartaoGerencia = {
  id: string;
  numero: number;
  tokenQr: string;
  ativo: boolean;
  // Comanda aberta com este cartão agora (e em que mesa).
  emUsoNaMesa: number | null;
};

export const listarCartoes = async (
  restauranteId: string,
): Promise<CartaoGerencia[]> => {
  const linhas = await db()
    .select({
      id: schema.cartoesComanda.id,
      numero: schema.cartoesComanda.numero,
      tokenQr: schema.cartoesComanda.tokenQr,
      ativo: schema.cartoesComanda.ativo,
      mesa: schema.mesas.numero,
    })
    .from(schema.cartoesComanda)
    .leftJoin(
      schema.comandas,
      and(
        eq(schema.comandas.cartaoId, schema.cartoesComanda.id),
        eq(schema.comandas.status, "aberta"),
      ),
    )
    .leftJoin(
      schema.comandaMesas,
      and(
        eq(schema.comandaMesas.comandaId, schema.comandas.id),
        isNull(schema.comandaMesas.saiuEm),
      ),
    )
    .leftJoin(schema.mesas, eq(schema.mesas.id, schema.comandaMesas.mesaId))
    .where(eq(schema.cartoesComanda.restauranteId, restauranteId))
    .orderBy(asc(schema.cartoesComanda.numero));
  return linhas.map((l) => ({
    id: l.id,
    numero: l.numero,
    tokenQr: l.tokenQr,
    ativo: l.ativo,
    emUsoNaMesa: l.mesa,
  }));
};

export const criarCartoesSchema = z.object({
  ate: z.number().int().min(1).max(999),
});

// Garante os cartões de 1 até N (os que já existem ficam como estão).
export const criarCartoes = async (restauranteId: string, ate: number) => {
  const criados = await db().execute(sql`
    insert into cartao_comanda (restaurante_id, numero)
    select ${restauranteId}::uuid, g from generate_series(1, ${ate}::int) g
    on conflict do nothing
  `);
  return { criados: criados.rowCount ?? 0 };
};

export const editarCartaoSchema = z.object({ ativo: z.boolean() });

// Cartão perdido ou estragado: desativa (o número não abre mais comanda).
export const editarCartao = async (
  restauranteId: string,
  cartaoId: string,
  ativo: boolean,
) => {
  const [cartao] = await db()
    .update(schema.cartoesComanda)
    .set({ ativo })
    .where(
      and(
        eq(schema.cartoesComanda.id, cartaoId),
        eq(schema.cartoesComanda.restauranteId, restauranteId),
      ),
    )
    .returning();
  if (!cartao) throw naoEncontrado("Cartão");
  return cartao;
};
