import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";

import { db, schema } from "@/db";
import { naoEncontrado } from "@/lib/erros";
import { comandasAbertasDaMesa } from "./comum";

// Quem é o cliente do outro lado do QR. O QR da mesa é do lugar; a conta é
// de cada comanda (cartão). O cliente se identifica pelo QR do próprio
// cartão (token) ou digitando o número dele. Mesa com uma comanda só dispensa
// a identificação, como antes dos cartões.

const token = z.string().regex(/^[a-f0-9]{32}$/);

export const identificacaoSchema = z.object({
  cartao: token.optional(),
  numero: z.coerce.number().int().min(1).max(9999).optional(),
});
export type Identificacao = z.infer<typeof identificacaoSchema>;

export const mesaAtivaPorToken = async (tokenMesa: string) => {
  const [mesa] = await db()
    .select()
    .from(schema.mesas)
    .where(
      and(eq(schema.mesas.tokenQr, tokenMesa), eq(schema.mesas.ativa, true)),
    )
    .limit(1);
  if (!mesa) throw naoEncontrado("Mesa");
  return mesa;
};

type Mesa = Awaited<ReturnType<typeof mesaAtivaPorToken>>;

// A comanda do cliente nesta mesa. "precisaCartao": a mesa tem várias e ele
// ainda não disse qual é a dele. Só vale comanda que está nesta mesa, para
// ninguém ver a conta de outra mesa digitando números.
export const comandaDoCliente = async (mesa: Mesa, ident: Identificacao) => {
  const comandas = await comandasAbertasDaMesa(db(), mesa.id);
  if (ident.cartao) {
    const [cartao] = await db()
      .select({ id: schema.cartoesComanda.id })
      .from(schema.cartoesComanda)
      .where(
        and(
          eq(schema.cartoesComanda.tokenQr, ident.cartao),
          eq(schema.cartoesComanda.restauranteId, mesa.restauranteId),
        ),
      );
    const comanda = comandas.find((c) => cartao && c.cartaoId === cartao.id);
    if (!comanda) throw naoEncontrado("Comanda deste cartão nesta mesa");
    return { comanda, precisaCartao: false };
  }
  if (ident.numero !== undefined) {
    const comanda = comandas.find((c) => c.numero === ident.numero);
    if (!comanda) {
      throw naoEncontrado(`Cartão ${ident.numero} nesta mesa`);
    }
    return { comanda, precisaCartao: false };
  }
  if (comandas.length === 1) {
    return { comanda: comandas[0], precisaCartao: false };
  }
  return { comanda: null, precisaCartao: comandas.length > 1 };
};

// QR impresso no cartão: leva o cliente para a mesa onde a comanda do cartão
// está agora (o cartão acompanha a pessoa se ela trocar de mesa).
export const destinoDoCartao = async (tokenCartao: string) => {
  const [linha] = await db()
    .select({
      numero: schema.cartoesComanda.numero,
      mesaToken: schema.mesas.tokenQr,
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
    .where(eq(schema.cartoesComanda.tokenQr, token.parse(tokenCartao)))
    .limit(1);
  if (!linha) throw naoEncontrado("Cartão");
  return { numero: linha.numero, mesaToken: linha.mesaToken };
};
