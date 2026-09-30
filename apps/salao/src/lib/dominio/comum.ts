import { and, asc, eq, isNull } from "drizzle-orm";

import { type Db, schema, type Tx } from "@/db";
import { conflito, naoEncontrado } from "@/lib/erros";

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

// Comandas abertas numa mesa (a mesa é só o lugar: pode ter várias).
export const comandasAbertasDaMesa = async (
  conexao: Conexao,
  mesaId: string,
) => {
  const linhas = await conexao
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
    .orderBy(asc(schema.comandas.numero), asc(schema.comandas.abertaEm));
  return linhas.map((l) => l.comanda);
};

// Comanda aberta do restaurante (qualquer operação sobre ela passa por aqui).
export const buscarComandaAberta = async (
  conexao: Conexao,
  restauranteId: string,
  comandaId: string,
) => {
  const [comanda] = await conexao
    .select()
    .from(schema.comandas)
    .where(
      and(
        eq(schema.comandas.id, comandaId),
        eq(schema.comandas.restauranteId, restauranteId),
      ),
    )
    .limit(1);
  if (!comanda) throw naoEncontrado("Comanda");
  if (comanda.status !== "aberta") {
    throw conflito("comanda_fechada", "Esta comanda já foi fechada.");
  }
  return comanda;
};

// Mesa em que a comanda está agora (uma por vez; na lista, para quem já
// trabalhava com a lista de mesas da comanda).
export const mesasDaComanda = async (conexao: Conexao, comandaId: string) => {
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
    .limit(1);
  return linhas.map((mesa) => ({ ...mesa, principal: true }));
};

// Registra o garçom na comanda (titular ou auxiliar). Idempotente.
export const registrarGarcom = async (
  conexao: Conexao,
  comandaId: string,
  funcionarioId: string,
  papel: "titular" | "auxiliar",
) => {
  await conexao
    .insert(schema.comandaGarcons)
    .values({ comandaId, funcionarioId, papel })
    .onConflictDoNothing();
};

export const configTaxa = async (conexao: Conexao, restauranteId: string) => {
  const [r] = await conexao
    .select({
      pct: schema.restaurantes.taxaServicoPct,
      pctReduzida: schema.restaurantes.taxaServicoPctReduzida,
      limiteCentavos: schema.restaurantes.taxaServicoLimiteCentavos,
    })
    .from(schema.restaurantes)
    .where(eq(schema.restaurantes.id, restauranteId));
  return r ?? { pct: 10, pctReduzida: 5, limiteCentavos: 30000 };
};

// Soma dos itens ativos da comanda (base da taxa de serviço).
export const subtotalDaComanda = async (
  conexao: Conexao,
  comandaId: string,
) => {
  const itens = await conexao
    .select({ total: schema.itensPedido.totalCentavos })
    .from(schema.itensPedido)
    .where(
      and(
        eq(schema.itensPedido.comandaId, comandaId),
        eq(schema.itensPedido.status, "ativo"),
      ),
    );
  return itens.reduce((s, i) => s + i.total, 0);
};
