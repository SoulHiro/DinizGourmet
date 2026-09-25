import { and, asc, eq } from "drizzle-orm";

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
        orderBy: [
          asc(schema.produtos.codigo),
          asc(schema.produtos.ordem),
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
