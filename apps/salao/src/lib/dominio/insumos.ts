import { and, asc, eq, inArray } from "drizzle-orm";
import { z } from "zod";

import { db, schema } from "@/db";
import { conflito, naoEncontrado, violouConstraint } from "@/lib/erros";
import { notificar } from "@/lib/runtime";

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
      })
      .from(schema.produtos)
      .where(eq(schema.produtos.restauranteId, restauranteId))
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
};

export const listarDescontos = (restauranteId: string, soAtivos = false) =>
  db()
    .select({
      id: schema.descontos.id,
      nome: schema.descontos.nome,
      tipo: schema.descontos.tipo,
      valor: schema.descontos.valor,
      ativo: schema.descontos.ativo,
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
  })
  .refine((d) => d.tipo !== "percentual" || d.valor <= 100, {
    message: "Percentual vai até 100.",
  });

export const criarDesconto = async (
  restauranteId: string,
  dados: z.infer<typeof criarDescontoSchema>,
) => {
  const [desconto] = await db()
    .insert(schema.descontos)
    .values({ restauranteId, ...dados })
    .returning();
  return desconto;
};

export const editarDescontoSchema = z.object({ ativo: z.boolean() });

export const editarDesconto = async (
  restauranteId: string,
  descontoId: string,
  ativo: boolean,
) => {
  const [desconto] = await db()
    .update(schema.descontos)
    .set({ ativo })
    .where(
      and(
        eq(schema.descontos.id, descontoId),
        eq(schema.descontos.restauranteId, restauranteId),
      ),
    )
    .returning();
  if (!desconto) throw naoEncontrado("Desconto");
  return desconto;
};

export { valorDoDesconto } from "./taxa";
