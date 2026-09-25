import { and, asc, eq } from "drizzle-orm";

import { db, schema } from "@/db";

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
        (produto.controlaEstoque && (produto.estoque ?? 0) <= 0),
      modificadores: produto.modificadores
        .filter((v) => v.modificador.ativo)
        .map((v) => ({
          id: v.modificador.id,
          nome: v.modificador.nome,
          tipo: v.modificador.tipo,
          precoCentavos: v.modificador.precoCentavos,
        })),
    })),
  }));
};
