import { and, asc, eq, isNull } from "drizzle-orm";

import { type Db, schema, type Tx } from "@/db";
import { naoEncontrado } from "@/lib/erros";

type Conexao = Db | Tx;

export const buscarMesa = async (
  conexao: Conexao,
  restauranteId: string,
  mesaId: string,
) => {
  const [mesa] = await conexao
    .select()
    .from(schema.mesas)
    .where(
      and(
        eq(schema.mesas.id, mesaId),
        eq(schema.mesas.restauranteId, restauranteId),
        eq(schema.mesas.ativa, true),
      ),
    )
    .limit(1);
  if (!mesa) throw naoEncontrado("Mesa");
  return mesa;
};

// Comanda aberta em que a mesa está agora (como principal ou agrupada).
export const comandaAbertaDaMesa = async (conexao: Conexao, mesaId: string) => {
  const [linha] = await conexao
    .select({ comanda: schema.comandas })
    .from(schema.comandaMesas)
    .innerJoin(
      schema.comandas,
      eq(schema.comandas.id, schema.comandaMesas.comandaId),
    )
    .where(
      and(
        eq(schema.comandaMesas.mesaId, mesaId),
        isNull(schema.comandaMesas.saiuEm),
        eq(schema.comandas.status, "aberta"),
      ),
    )
    .limit(1);
  return linha?.comanda;
};

// Mesas atuais da comanda, com a principal primeiro.
export const mesasDaComanda = async (conexao: Conexao, comandaId: string) => {
  const [comanda] = await conexao
    .select({ mesaPrincipalId: schema.comandas.mesaPrincipalId })
    .from(schema.comandas)
    .where(eq(schema.comandas.id, comandaId));
  const linhas = await conexao
    .select({ id: schema.mesas.id, numero: schema.mesas.numero })
    .from(schema.comandaMesas)
    .innerJoin(schema.mesas, eq(schema.mesas.id, schema.comandaMesas.mesaId))
    .where(
      and(
        eq(schema.comandaMesas.comandaId, comandaId),
        isNull(schema.comandaMesas.saiuEm),
      ),
    )
    .orderBy(asc(schema.mesas.numero));
  return linhas
    .map((mesa) => ({
      ...mesa,
      principal: mesa.id === comanda?.mesaPrincipalId,
    }))
    .sort((a, b) => Number(b.principal) - Number(a.principal));
};
