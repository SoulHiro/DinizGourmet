import { and, asc, eq, isNull, sql } from "drizzle-orm";

import { db, schema } from "@/db";
import { estoqueDosInsumos, faltaInsumoBase } from "./estoque";

export type TipoModificador = "remocao" | "adicional" | "preparo";

export type ProdutoCardapio = {
  id: string;
  codigo: number | null;
  nome: string;
  descricao: string | null;
  busca: string;
  precoCentavos: number;
  disponivel: boolean;
  estoque: number | null;
  esgotado: boolean;
  modificadores: {
    id: string;
    nome: string;
    tipo: TipoModificador;
    precoCentavos: number;
    // Adicional cujo insumo acabou: chip cinza, o lanche continua disponível.
    esgotado: boolean;
  }[];
};

export type CategoriaCardapio = {
  id: string;
  nome: string;
  produtos: ProdutoCardapio[];
};

export const listarCardapio = async (
  restauranteId: string,
): Promise<CategoriaCardapio[]> => {
  const categorias = await db().query.categorias.findMany({
    where: and(
      eq(schema.categorias.restauranteId, restauranteId),
      eq(schema.categorias.ativa, true),
    ),
    orderBy: [asc(schema.categorias.ordem), asc(schema.categorias.nome)],
    with: {
      produtos: {
        where: isNull(schema.produtos.arquivadoEm),
        orderBy: [
          asc(schema.produtos.ordem),
          asc(schema.produtos.codigo),
          asc(schema.produtos.nome),
        ],
        with: {
          modificadores: {
            orderBy: [asc(schema.produtoModificadores.ordem)],
            with: { modificador: true },
          },
        },
      },
    },
  });

  const [estoque, receitas] = await Promise.all([
    estoqueDosInsumos(db(), restauranteId),
    receitasDoRestaurante(restauranteId),
  ]);

  return categorias.map((categoria) => ({
    id: categoria.id,
    nome: categoria.nome,
    produtos: categoria.produtos.map((produto) => ({
      id: produto.id,
      codigo: produto.codigo,
      nome: produto.nome,
      descricao: produto.descricao,
      busca: produto.buscaNormalizada,
      precoCentavos: produto.precoCentavos,
      disponivel: produto.disponivel,
      estoque: produto.controlaEstoque ? produto.estoque : null,
      esgotado:
        !produto.disponivel ||
        (produto.controlaEstoque && (produto.estoque ?? 0) <= 0) ||
        faltaInsumoBase(receitas.get(produto.id) ?? [], estoque),
      modificadores: produto.modificadores
        .filter((v) => v.modificador.ativo)
        .map((v) => ({
          id: v.modificador.id,
          nome: v.modificador.nome,
          tipo: v.modificador.tipo,
          precoCentavos: v.modificador.precoCentavos,
          esgotado: adicionalEsgotado(v.modificador, estoque),
        })),
    })),
  }));
};

// Receita (insumos base) de cada produto do restaurante.
export const receitasDoRestaurante = async (restauranteId: string) => {
  const linhas = await db()
    .select({
      produtoId: schema.produtoInsumos.produtoId,
      insumoId: schema.produtoInsumos.insumoId,
      quantidade: schema.produtoInsumos.quantidade,
    })
    .from(schema.produtoInsumos)
    .innerJoin(
      schema.produtos,
      eq(schema.produtos.id, schema.produtoInsumos.produtoId),
    )
    .where(eq(schema.produtos.restauranteId, restauranteId));
  const porProduto = new Map<
    string,
    { insumoId: string; quantidade: number }[]
  >();
  for (const l of linhas) {
    porProduto.set(l.produtoId, [...(porProduto.get(l.produtoId) ?? []), l]);
  }
  return porProduto;
};

export const adicionalEsgotado = (
  modificador: { tipo: TipoModificador; insumoId: string | null },
  estoque: Map<string, number>,
) =>
  modificador.tipo === "adicional" &&
  modificador.insumoId !== null &&
  estoque.has(modificador.insumoId) &&
  (estoque.get(modificador.insumoId) ?? 0) < 1;

// Atalhos do garçom: o que mais sai nos últimos 30 dias (vira a primeira
// aba do pedido) e as observações mais escritas (viram sugestões rápidas).
export const sugestoesDoPedido = async (restauranteId: string) => {
  const [maisPedidos, observacoes] = await Promise.all([
    db().execute<{ produto_id: string }>(sql`
      select i.produto_id
        from item_pedido i
        join rodada r on r.id = i.rodada_id
        join produto p on p.id = i.produto_id
       where r.restaurante_id = ${restauranteId} and i.status = 'ativo'
         and r.lancada_em > now() - interval '30 days'
         and p.arquivado_em is null and p.disponivel
       group by i.produto_id
       order by sum(i.quantidade) desc
       limit 8
    `),
    db().execute<{ texto: string }>(sql`
      select min(trim(i.observacao)) as texto
        from item_pedido i
        join rodada r on r.id = i.rodada_id
       where r.restaurante_id = ${restauranteId}
         and i.observacao is not null and trim(i.observacao) <> ''
         and r.lancada_em > now() - interval '60 days'
       group by lower(trim(i.observacao))
       order by count(*) desc
       limit 8
    `),
  ]);
  return {
    maisPedidos: maisPedidos.rows.map((r) => r.produto_id),
    observacoes: observacoes.rows.map((r) => r.texto),
  };
};
