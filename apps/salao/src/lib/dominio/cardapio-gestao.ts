import { and, asc, eq, inArray, isNull, sql } from "drizzle-orm";
import { z } from "zod";

import { db, schema } from "@/db";
import { conflito, naoEncontrado } from "@/lib/erros";
import { notificar } from "@/lib/runtime";

// Estrutura do cardápio que o gerente monta pela tela: categorias (criar,
// reordenar, excluir), a ordem dos itens e as opções (chips) que o garçom
// marca no pedido: "Sem ervilha", "Ao ponto", "Bacon extra"...

const VAGAS = 50;

// Categorias
export const criarCategoriaSchema = z.object({
  nome: z.string().trim().min(2).max(40),
  impressoraId: z.uuid().nullable().optional(),
});

// Nova categoria vai para o fim, com as próximas 50 vagas de código.
export const criarCategoria = async (
  restauranteId: string,
  input: z.infer<typeof criarCategoriaSchema>,
) => {
  const [maior] = await db()
    .select({
      ordem: sql<number>`coalesce(max(${schema.categorias.ordem}), 0)`,
      fim: sql<number>`coalesce(max(${schema.categorias.codigoFim}), 0)`,
    })
    .from(schema.categorias)
    .where(eq(schema.categorias.restauranteId, restauranteId));
  const fim = Number(maior?.fim ?? 0);
  // Arredonda para começar num número redondo (301, 351...).
  const inicio = Math.ceil(fim / VAGAS) * VAGAS + 1;
  const [categoria] = await db()
    .insert(schema.categorias)
    .values({
      restauranteId,
      nome: input.nome,
      impressoraId: input.impressoraId ?? null,
      ordem: Number(maior?.ordem ?? 0) + 1,
      codigoInicio: inicio,
      codigoFim: inicio + VAGAS - 1,
    })
    .returning();
  notificar(restauranteId, ["cardapio"]);
  return categoria;
};

export const reordenarSchema = z.object({
  ids: z.array(z.uuid()).min(1).max(500),
});

export const reordenarCategorias = async (
  restauranteId: string,
  ids: string[],
) => {
  await db().transaction(async (tx) => {
    for (const [ordem, id] of ids.entries()) {
      await tx
        .update(schema.categorias)
        .set({ ordem: ordem + 1 })
        .where(
          and(
            eq(schema.categorias.id, id),
            eq(schema.categorias.restauranteId, restauranteId),
          ),
        );
    }
  });
  notificar(restauranteId, ["cardapio"]);
  return { ok: true };
};

// Só sai categoria vazia. Com itens só no histórico (arquivados), ela fica
// inativa e some das telas; com item ativo, o gerente move ou exclui antes.
export const excluirCategoria = async (
  restauranteId: string,
  categoriaId: string,
) => {
  const [ativo] = await db()
    .select({ id: schema.produtos.id })
    .from(schema.produtos)
    .where(
      and(
        eq(schema.produtos.categoriaId, categoriaId),
        isNull(schema.produtos.arquivadoEm),
      ),
    )
    .limit(1);
  if (ativo) {
    throw conflito(
      "categoria_com_itens",
      "Essa categoria ainda tem itens. Mova ou exclua os itens antes.",
    );
  }
  const [historico] = await db()
    .select({ id: schema.produtos.id })
    .from(schema.produtos)
    .where(eq(schema.produtos.categoriaId, categoriaId))
    .limit(1);
  const filtro = and(
    eq(schema.categorias.id, categoriaId),
    eq(schema.categorias.restauranteId, restauranteId),
  );
  const [feito] = historico
    ? await db()
        .update(schema.categorias)
        .set({ ativa: false })
        .where(filtro)
        .returning({ id: schema.categorias.id })
    : await db()
        .delete(schema.categorias)
        .where(filtro)
        .returning({ id: schema.categorias.id });
  if (!feito) throw naoEncontrado("Categoria");
  notificar(restauranteId, ["cardapio"]);
  return { arquivada: Boolean(historico) };
};

// Ordem dos itens dentro da categoria (cardápio do cliente e do garçom).
export const reordenarProdutos = async (
  restauranteId: string,
  ids: string[],
) => {
  await db().transaction(async (tx) => {
    for (const [ordem, id] of ids.entries()) {
      await tx
        .update(schema.produtos)
        .set({ ordem })
        .where(
          and(
            eq(schema.produtos.id, id),
            eq(schema.produtos.restauranteId, restauranteId),
          ),
        );
    }
  });
  notificar(restauranteId, ["cardapio"]);
  return { ok: true };
};

// Opções (chips)
export type OpcaoGerencia = {
  id: string;
  nome: string;
  tipo: "remocao" | "adicional" | "preparo";
  precoCentavos: number;
  ativo: boolean;
  produtoIds: string[];
  usos: number;
};

export const listarOpcoes = async (
  restauranteId: string,
): Promise<OpcaoGerencia[]> => {
  const [opcoes, ligacoes, usos] = await Promise.all([
    db()
      .select()
      .from(schema.modificadores)
      .where(eq(schema.modificadores.restauranteId, restauranteId))
      .orderBy(asc(schema.modificadores.nome)),
    db()
      .select({
        modificadorId: schema.produtoModificadores.modificadorId,
        produtoId: schema.produtoModificadores.produtoId,
      })
      .from(schema.produtoModificadores)
      .innerJoin(
        schema.produtos,
        eq(schema.produtos.id, schema.produtoModificadores.produtoId),
      )
      .where(
        and(
          eq(schema.produtos.restauranteId, restauranteId),
          isNull(schema.produtos.arquivadoEm),
        ),
      ),
    db()
      .select({
        modificadorId: schema.itemPedidoModificadores.modificadorId,
        total: sql<number>`count(*)::int`,
      })
      .from(schema.itemPedidoModificadores)
      .innerJoin(
        schema.modificadores,
        eq(
          schema.modificadores.id,
          schema.itemPedidoModificadores.modificadorId,
        ),
      )
      .where(eq(schema.modificadores.restauranteId, restauranteId))
      .groupBy(schema.itemPedidoModificadores.modificadorId),
  ]);
  return opcoes.map((o) => ({
    id: o.id,
    nome: o.nome,
    tipo: o.tipo,
    precoCentavos: o.precoCentavos,
    ativo: o.ativo,
    produtoIds: ligacoes
      .filter((l) => l.modificadorId === o.id)
      .map((l) => l.produtoId),
    usos: usos.find((u) => u.modificadorId === o.id)?.total ?? 0,
  }));
};

const opcaoBase = {
  nome: z.string().trim().min(2).max(40),
  tipo: z.enum(["remocao", "adicional", "preparo"]),
  precoCentavos: z.number().int().min(0).max(100_000),
};

export const criarOpcaoSchema = z.object({
  ...opcaoBase,
  produtoIds: z.array(z.uuid()).max(500).default([]),
});

export const editarOpcaoSchema = z.object({
  nome: opcaoBase.nome.optional(),
  tipo: opcaoBase.tipo.optional(),
  precoCentavos: opcaoBase.precoCentavos.optional(),
  ativo: z.boolean().optional(),
  // Em quais itens o chip aparece (substitui a lista toda).
  produtoIds: z.array(z.uuid()).max(500).optional(),
});

// Liga o chip aos itens: quem já tinha mantém a posição; quem entra vai
// para o fim da lista de chips daquele item.
const ligarProdutos = async (
  restauranteId: string,
  modificadorId: string,
  produtoIds: string[],
) => {
  const validos = produtoIds.length
    ? (
        await db()
          .select({ id: schema.produtos.id })
          .from(schema.produtos)
          .where(
            and(
              inArray(schema.produtos.id, produtoIds),
              eq(schema.produtos.restauranteId, restauranteId),
            ),
          )
      ).map((p) => p.id)
    : [];
  await db().transaction(async (tx) => {
    const atuais = await tx
      .select({ produtoId: schema.produtoModificadores.produtoId })
      .from(schema.produtoModificadores)
      .where(eq(schema.produtoModificadores.modificadorId, modificadorId));
    const sair = atuais
      .map((a) => a.produtoId)
      .filter((id) => !validos.includes(id));
    if (sair.length) {
      await tx
        .delete(schema.produtoModificadores)
        .where(
          and(
            eq(schema.produtoModificadores.modificadorId, modificadorId),
            inArray(schema.produtoModificadores.produtoId, sair),
          ),
        );
    }
    const entrar = validos.filter(
      (id) => !atuais.some((a) => a.produtoId === id),
    );
    for (const produtoId of entrar) {
      const [fim] = await tx
        .select({
          ordem: sql<number>`coalesce(max(${schema.produtoModificadores.ordem}), -1)`,
        })
        .from(schema.produtoModificadores)
        .where(eq(schema.produtoModificadores.produtoId, produtoId));
      await tx.insert(schema.produtoModificadores).values({
        produtoId,
        modificadorId,
        ordem: Number(fim?.ordem ?? -1) + 1,
      });
    }
  });
};

export const criarOpcao = async (
  restauranteId: string,
  { produtoIds, ...dados }: z.infer<typeof criarOpcaoSchema>,
) => {
  const [opcao] = await db()
    .insert(schema.modificadores)
    .values({
      restauranteId,
      ...dados,
      precoCentavos: dados.tipo === "adicional" ? dados.precoCentavos : 0,
    })
    .returning();
  await ligarProdutos(restauranteId, opcao.id, produtoIds);
  notificar(restauranteId, ["cardapio"]);
  return opcao;
};

export const editarOpcao = async (
  restauranteId: string,
  opcaoId: string,
  { produtoIds, ...dados }: z.infer<typeof editarOpcaoSchema>,
) => {
  // Só adicional tem preço: trocar para remoção/preparo zera.
  const ajuste =
    dados.tipo && dados.tipo !== "adicional" ? { precoCentavos: 0 } : {};
  const [opcao] = Object.keys(dados).length
    ? await db()
        .update(schema.modificadores)
        .set({ ...dados, ...ajuste })
        .where(
          and(
            eq(schema.modificadores.id, opcaoId),
            eq(schema.modificadores.restauranteId, restauranteId),
          ),
        )
        .returning()
    : await db()
        .select()
        .from(schema.modificadores)
        .where(
          and(
            eq(schema.modificadores.id, opcaoId),
            eq(schema.modificadores.restauranteId, restauranteId),
          ),
        );
  if (!opcao) throw naoEncontrado("Opção");
  if (produtoIds) await ligarProdutos(restauranteId, opcaoId, produtoIds);
  notificar(restauranteId, ["cardapio"]);
  return opcao;
};

// Chip já usado em pedido fica no histórico: o certo é desativar.
export const excluirOpcao = async (restauranteId: string, opcaoId: string) => {
  const [usado] = await db()
    .select({ id: schema.itemPedidoModificadores.id })
    .from(schema.itemPedidoModificadores)
    .where(eq(schema.itemPedidoModificadores.modificadorId, opcaoId))
    .limit(1);
  if (usado) {
    throw conflito(
      "opcao_usada",
      "Essa opção já foi usada em pedidos. Desative em vez de excluir.",
    );
  }
  const [apagada] = await db()
    .delete(schema.modificadores)
    .where(
      and(
        eq(schema.modificadores.id, opcaoId),
        eq(schema.modificadores.restauranteId, restauranteId),
      ),
    )
    .returning({ id: schema.modificadores.id });
  if (!apagada) throw naoEncontrado("Opção");
  notificar(restauranteId, ["cardapio"]);
  return apagada;
};
