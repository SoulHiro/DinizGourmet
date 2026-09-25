import { and, eq, inArray, isNotNull, sql } from "drizzle-orm";

import { type Db, schema, type Tx } from "@/db";
import { conflito } from "@/lib/erros";

// Estoque por insumo (Fase 3). Cada unidade de um produto gasta os insumos
// da receita (produto_insumo, "base") e cada adicional escolhido gasta o
// insumo dele (modificador.insumo_id). Insumo com estoque nulo não é
// controlado. A baixa segue a mesma regra do estoque por produto: UPDATE
// atômico com a condição no WHERE, em ordem de id (sem deadlock).

export type ItemConsumo = {
  produtoId: string;
  quantidade: number;
  modificadorIds: string[];
};

// Quanto de cada insumo os itens gastam (só insumos controlados).
export const consumoDosItens = async (tx: Tx, itens: ItemConsumo[]) => {
  const consumo = new Map<string, number>();
  if (!itens.length) return consumo;
  const somar = (insumoId: string, q: number) =>
    consumo.set(insumoId, (consumo.get(insumoId) ?? 0) + q);

  const produtoIds = [...new Set(itens.map((i) => i.produtoId))];
  const receitas = await tx
    .select({
      produtoId: schema.produtoInsumos.produtoId,
      insumoId: schema.produtoInsumos.insumoId,
      quantidade: schema.produtoInsumos.quantidade,
    })
    .from(schema.produtoInsumos)
    .innerJoin(
      schema.insumos,
      eq(schema.insumos.id, schema.produtoInsumos.insumoId),
    )
    .where(
      and(
        inArray(schema.produtoInsumos.produtoId, produtoIds),
        isNotNull(schema.insumos.estoque),
      ),
    );

  const modificadorIds = [...new Set(itens.flatMap((i) => i.modificadorIds))];
  const adicionais = modificadorIds.length
    ? await tx
        .select({
          id: schema.modificadores.id,
          insumoId: schema.modificadores.insumoId,
        })
        .from(schema.modificadores)
        .innerJoin(
          schema.insumos,
          eq(schema.insumos.id, schema.modificadores.insumoId),
        )
        .where(
          and(
            inArray(schema.modificadores.id, modificadorIds),
            eq(schema.modificadores.tipo, "adicional"),
            isNotNull(schema.insumos.estoque),
          ),
        )
    : [];

  for (const item of itens) {
    for (const r of receitas) {
      if (r.produtoId === item.produtoId)
        somar(r.insumoId, r.quantidade * item.quantidade);
    }
    for (const id of item.modificadorIds) {
      const adicional = adicionais.find((a) => a.id === id);
      if (adicional?.insumoId) somar(adicional.insumoId, item.quantidade);
    }
  }
  return consumo;
};

// Diferença entre dois consumos (editar item): positivo baixa, negativo devolve.
export const diferencaDeConsumo = (
  depois: Map<string, number>,
  antes: Map<string, number>,
) => {
  const diferenca = new Map<string, number>();
  for (const id of new Set([...depois.keys(), ...antes.keys()])) {
    const d = (depois.get(id) ?? 0) - (antes.get(id) ?? 0);
    if (d !== 0) diferenca.set(id, d);
  }
  return diferenca;
};

// Aplica o consumo: baixa o que é positivo (falha inteira se faltar algum
// insumo) e devolve o que é negativo. Retorna se mexeu em algo.
export const aplicarConsumo = async (tx: Tx, consumo: Map<string, number>) => {
  const ordenado = [...consumo].sort(([a], [b]) => a.localeCompare(b));
  const faltando: string[] = [];
  for (const [insumoId, quantidade] of ordenado) {
    if (quantidade > 0) {
      const baixou = await tx
        .update(schema.insumos)
        .set({ estoque: sql`${schema.insumos.estoque} - ${quantidade}` })
        .where(
          and(
            eq(schema.insumos.id, insumoId),
            sql`${schema.insumos.estoque} >= ${quantidade}`,
          ),
        )
        .returning({ id: schema.insumos.id });
      if (!baixou.length) faltando.push(insumoId);
    } else {
      await tx
        .update(schema.insumos)
        .set({ estoque: sql`${schema.insumos.estoque} + ${-quantidade}` })
        .where(
          and(
            eq(schema.insumos.id, insumoId),
            isNotNull(schema.insumos.estoque),
          ),
        );
    }
  }
  if (faltando.length) {
    const nomes = await tx
      .select({ nome: schema.insumos.nome })
      .from(schema.insumos)
      .where(inArray(schema.insumos.id, faltando));
    throw conflito(
      "esgotado",
      `Acabou: ${nomes.map((n) => n.nome).join(", ")}.`,
      { insumoIds: faltando },
    );
  }
  return ordenado.length > 0;
};

// Estoque controlado dos insumos, para marcar produto esgotado (insumo base)
// e adicional indisponível (insumo do adicional) nos cardápios.
export const estoqueDosInsumos = async (
  conexao: Db | Tx,
  restauranteId: string,
) => {
  const linhas = await conexao
    .select({ id: schema.insumos.id, estoque: schema.insumos.estoque })
    .from(schema.insumos)
    .where(
      and(
        eq(schema.insumos.restauranteId, restauranteId),
        isNotNull(schema.insumos.estoque),
      ),
    );
  return new Map(linhas.map((l) => [l.id, l.estoque ?? 0]));
};

// Produto esgotado se algum insumo base não dá para uma unidade.
export const faltaInsumoBase = (
  receita: { insumoId: string; quantidade: number }[],
  estoque: Map<string, number>,
) =>
  receita.some(
    (r) =>
      estoque.has(r.insumoId) && (estoque.get(r.insumoId) ?? 0) < r.quantidade,
  );
