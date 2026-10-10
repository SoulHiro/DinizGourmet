import { and, asc, eq, inArray, isNull, sql } from "drizzle-orm";
import { z } from "zod";

import { db, schema } from "@/db";
import { conflito, naoEncontrado, violouConstraint } from "@/lib/erros";
import { notificar } from "@/lib/runtime";
import { inicioDaNoite } from "./comum";

// Gestão do estoque por insumo e dos descontos pré-cadastrados (/gerente).

export type InsumoGerencia = {
  id: string;
  nome: string;
  unidade: string;
  estoque: number | null;
  ativo: boolean;
  // Lanches em que é base (quanto cada unidade gasta).
  produtos: { produtoId: string; quantidade: number }[];
  // Adicionais que gastam 1 deste insumo.
  adicionalIds: string[];
};

export const listarInsumos = async (restauranteId: string) => {
  const [insumos, receitas, adicionais, produtos] = await Promise.all([
    db()
      .select()
      .from(schema.insumos)
      .where(eq(schema.insumos.restauranteId, restauranteId))
      .orderBy(asc(schema.insumos.nome)),
    db()
      .select({
        insumoId: schema.produtoInsumos.insumoId,
        produtoId: schema.produtoInsumos.produtoId,
        quantidade: schema.produtoInsumos.quantidade,
      })
      .from(schema.produtoInsumos)
      .innerJoin(
        schema.insumos,
        eq(schema.insumos.id, schema.produtoInsumos.insumoId),
      )
      .where(eq(schema.insumos.restauranteId, restauranteId)),
    db()
      .select({
        id: schema.modificadores.id,
        nome: schema.modificadores.nome,
        insumoId: schema.modificadores.insumoId,
      })
      .from(schema.modificadores)
      .where(
        and(
          eq(schema.modificadores.restauranteId, restauranteId),
          eq(schema.modificadores.tipo, "adicional"),
          eq(schema.modificadores.ativo, true),
        ),
      )
      .orderBy(asc(schema.modificadores.nome)),
    db()
      .select({
        id: schema.produtos.id,
        nome: schema.produtos.nome,
        codigo: schema.produtos.codigo,
        categoria: schema.categorias.nome,
      })
      .from(schema.produtos)
      .innerJoin(
        schema.categorias,
        eq(schema.categorias.id, schema.produtos.categoriaId),
      )
      .where(
        and(
          eq(schema.produtos.restauranteId, restauranteId),
          isNull(schema.produtos.arquivadoEm),
          eq(schema.categorias.ativa, true),
        ),
      )
      .orderBy(asc(schema.produtos.codigo), asc(schema.produtos.nome)),
  ]);

  return {
    insumos: insumos.map(
      (i): InsumoGerencia => ({
        id: i.id,
        nome: i.nome,
        unidade: i.unidade,
        estoque: i.estoque,
        ativo: i.ativo,
        produtos: receitas
          .filter((r) => r.insumoId === i.id)
          .map((r) => ({ produtoId: r.produtoId, quantidade: r.quantidade })),
        adicionalIds: adicionais
          .filter((a) => a.insumoId === i.id)
          .map((a) => a.id),
      }),
    ),
    // Opções para os seletores.
    produtos,
    adicionais: adicionais.map((a) => ({ id: a.id, nome: a.nome })),
  };
};

const nomeSchema = z.string().trim().min(1).max(60);
const estoqueSchema = z.number().int().min(0).max(100_000).nullable();

export const criarInsumoSchema = z.object({
  nome: nomeSchema,
  unidade: z.string().trim().min(1).max(20).default("un"),
  estoque: estoqueSchema.default(null),
});

export const editarInsumoSchema = z.object({
  nome: nomeSchema.optional(),
  unidade: z.string().trim().min(1).max(20).optional(),
  // Contagem da noite (null = não controlar).
  estoque: estoqueSchema.optional(),
  ativo: z.boolean().optional(),
  produtos: z
    .array(
      z.object({
        produtoId: z.uuid(),
        quantidade: z.number().int().min(1).max(20),
      }),
    )
    .max(200)
    .optional(),
  adicionalIds: z.array(z.uuid()).max(100).optional(),
});

const nomeRepetido = (error: unknown) =>
  violouConstraint(error, "insumo_restaurante_nome_idx")
    ? conflito("nome_em_uso", "Já existe um insumo com esse nome.")
    : error;

export const criarInsumo = async (
  restauranteId: string,
  dados: z.infer<typeof criarInsumoSchema>,
) => {
  try {
    const [insumo] = await db()
      .insert(schema.insumos)
      .values({ restauranteId, ...dados })
      .returning();
    notificar(restauranteId, ["cardapio"]);
    return insumo;
  } catch (error) {
    throw nomeRepetido(error);
  }
};

export const editarInsumo = async (
  restauranteId: string,
  insumoId: string,
  dados: z.infer<typeof editarInsumoSchema>,
) => {
  try {
    await db().transaction(async (tx) => {
      const { produtos, adicionalIds, ...campos } = dados;
      const doRestaurante = and(
        eq(schema.insumos.id, insumoId),
        eq(schema.insumos.restauranteId, restauranteId),
      );
      // Só a receita pode mudar (sem campos do insumo em si).
      const [insumo] = Object.keys(campos).length
        ? await tx
            .update(schema.insumos)
            .set(campos)
            .where(doRestaurante)
            .returning({ id: schema.insumos.id })
        : await tx
            .select({ id: schema.insumos.id })
            .from(schema.insumos)
            .where(doRestaurante)
            .for("update");
      if (!insumo) throw naoEncontrado("Insumo");

      if (produtos) {
        // Só produtos deste restaurante entram na receita.
        const validos = produtos.length
          ? await tx
              .select({ id: schema.produtos.id })
              .from(schema.produtos)
              .where(
                and(
                  inArray(
                    schema.produtos.id,
                    produtos.map((p) => p.produtoId),
                  ),
                  eq(schema.produtos.restauranteId, restauranteId),
                ),
              )
          : [];
        const ids = new Set(validos.map((v) => v.id));
        await tx
          .delete(schema.produtoInsumos)
          .where(eq(schema.produtoInsumos.insumoId, insumoId));
        const linhas = produtos.filter((p) => ids.has(p.produtoId));
        if (linhas.length) {
          await tx
            .insert(schema.produtoInsumos)
            .values(linhas.map((p) => ({ insumoId, ...p })));
        }
      }

      if (adicionalIds) {
        await tx
          .update(schema.modificadores)
          .set({ insumoId: null })
          .where(
            and(
              eq(schema.modificadores.insumoId, insumoId),
              eq(schema.modificadores.restauranteId, restauranteId),
            ),
          );
        if (adicionalIds.length) {
          await tx
            .update(schema.modificadores)
            .set({ insumoId })
            .where(
              and(
                inArray(schema.modificadores.id, adicionalIds),
                eq(schema.modificadores.restauranteId, restauranteId),
                eq(schema.modificadores.tipo, "adicional"),
              ),
            );
        }
      }
    });
  } catch (error) {
    throw nomeRepetido(error);
  }
  notificar(restauranteId, ["cardapio"]);
  return { id: insumoId };
};

// Descontos
export type Desconto = {
  id: string;
  nome: string;
  tipo: "percentual" | "valor";
  valor: number;
  ativo: boolean;
  somenteGerente: boolean;
  limitePorNoite: number | null;
  // Quantas vezes já foi usado nesta noite.
  usosHoje: number;
};

export const listarDescontos = (restauranteId: string, soAtivos = false) =>
  db()
    .select({
      id: schema.descontos.id,
      nome: schema.descontos.nome,
      tipo: schema.descontos.tipo,
      valor: schema.descontos.valor,
      ativo: schema.descontos.ativo,
      somenteGerente: schema.descontos.somenteGerente,
      limitePorNoite: schema.descontos.limitePorNoite,
      usosHoje: sql<number>`(
        select count(*)::int from comanda c
         where c.desconto_id = "desconto"."id"
           and c.fechada_em >= ${inicioDaNoite()})`,
    })
    .from(schema.descontos)
    .where(
      and(
        eq(schema.descontos.restauranteId, restauranteId),
        soAtivos ? eq(schema.descontos.ativo, true) : undefined,
      ),
    )
    .orderBy(asc(schema.descontos.nome));

export const criarDescontoSchema = z
  .object({
    nome: z.string().trim().min(1).max(40),
    tipo: z.enum(["percentual", "valor"]),
    valor: z.number().int().min(1).max(1_000_000),
    somenteGerente: z.boolean().default(false),
    limitePorNoite: z.number().int().min(1).max(1000).nullable().default(null),
  })
  .refine((d) => d.tipo !== "percentual" || d.valor <= 100, {
    message: "Percentual vai até 100.",
  });

export const criarDesconto = async (
  restauranteId: string,
  dados: z.input<typeof criarDescontoSchema>,
) => {
  const [desconto] = await db()
    .insert(schema.descontos)
    .values({ restauranteId, ...dados })
    .returning();
  return desconto;
};

export const editarDescontoSchema = z.object({
  ativo: z.boolean().optional(),
  nome: z.string().trim().min(1).max(40).optional(),
  tipo: z.enum(["percentual", "valor"]).optional(),
  valor: z.number().int().min(1).max(1_000_000).optional(),
  somenteGerente: z.boolean().optional(),
  limitePorNoite: z.number().int().min(1).max(1000).nullable().optional(),
});

// O fechamento guarda nome e valor do desconto na comanda: editar aqui não
// muda conta já recebida.
export const editarDesconto = async (
  restauranteId: string,
  descontoId: string,
  dados: z.infer<typeof editarDescontoSchema>,
) =>
  db().transaction(async (tx) => {
    const [atual] = await tx
      .select()
      .from(schema.descontos)
      .where(
        and(
          eq(schema.descontos.id, descontoId),
          eq(schema.descontos.restauranteId, restauranteId),
        ),
      )
      .for("update");
    if (!atual) throw naoEncontrado("Desconto");
    const tipo = dados.tipo ?? atual.tipo;
    const valor = dados.valor ?? atual.valor;
    if (tipo === "percentual" && valor > 100) {
      throw conflito("percentual_invalido", "Percentual vai até 100.");
    }
    const [desconto] = await tx
      .update(schema.descontos)
      .set({ ...dados, tipo, valor })
      .where(eq(schema.descontos.id, descontoId))
      .returning();
    return desconto;
  });

// Desconto já usado em alguma comanda não sai (a comanda aponta para ele):
// nesse caso o certo é desativar.
export const excluirDesconto = async (
  restauranteId: string,
  descontoId: string,
) => {
  const [usado] = await db()
    .select({ id: schema.comandas.id })
    .from(schema.comandas)
    .where(eq(schema.comandas.descontoId, descontoId))
    .limit(1);
  if (usado) {
    throw conflito(
      "desconto_usado",
      "Este desconto já foi usado em comandas. Desative em vez de excluir.",
    );
  }
  const [apagado] = await db()
    .delete(schema.descontos)
    .where(
      and(
        eq(schema.descontos.id, descontoId),
        eq(schema.descontos.restauranteId, restauranteId),
      ),
    )
    .returning({ id: schema.descontos.id });
  if (!apagado) throw naoEncontrado("Desconto");
  return apagado;
};

export { valorDoDesconto } from "./taxa";

// Contagem que não faz mais sentido (bebida que saiu): a receita vai junto.
export const excluirInsumo = async (
  restauranteId: string,
  insumoId: string,
) => {
  const [apagado] = await db()
    .delete(schema.insumos)
    .where(
      and(
        eq(schema.insumos.id, insumoId),
        eq(schema.insumos.restauranteId, restauranteId),
      ),
    )
    .returning({ id: schema.insumos.id });
  if (!apagado) throw naoEncontrado("Contagem");
  notificar(restauranteId, ["cardapio"]);
  return apagado;
};
