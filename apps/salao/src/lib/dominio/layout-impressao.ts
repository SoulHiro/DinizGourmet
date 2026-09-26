import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { db, schema } from "@/db";
import { naoEncontrado } from "@/lib/erros";
import {
  exemploConta,
  exemploPedido,
  type LayoutImpressao,
  type ModeloImpressao,
  normalizarLayout,
} from "@/lib/impressao/layout";
import { acordarImpressao, notificar } from "@/lib/runtime";

// Layout do papel personalizado pelo gerente. Sem configuração salva, vale o
// padrão; o que vem do banco passa sempre por normalizarLayout, então um
// layout antigo ou incompleto nunca quebra a impressão.

export const MODELOS: ModeloImpressao[] = ["pedido", "conta"];

export const carregarLayout = async (
  restauranteId: string,
  modelo: ModeloImpressao,
): Promise<LayoutImpressao> => {
  const [linha] = await db()
    .select({ config: schema.layoutsImpressao.config })
    .from(schema.layoutsImpressao)
    .where(
      and(
        eq(schema.layoutsImpressao.restauranteId, restauranteId),
        eq(schema.layoutsImpressao.modelo, modelo),
      ),
    );
  return normalizarLayout(modelo, linha?.config);
};

export const carregarLayouts = async (restauranteId: string) => {
  const [pedido, conta] = await Promise.all(
    MODELOS.map((m) => carregarLayout(restauranteId, m)),
  );
  const [restaurante] = await db()
    .select({ nome: schema.restaurantes.nome })
    .from(schema.restaurantes)
    .where(eq(schema.restaurantes.id, restauranteId));
  return { pedido, conta, restaurante: restaurante?.nome ?? "" };
};

const estiloSchema = z
  .object({
    tamanho: z.enum(["normal", "grande", "gigante"]),
    negrito: z.boolean(),
    destaque: z.boolean(),
    centro: z.boolean(),
  })
  .partial();

export const salvarLayoutSchema = z.object({
  modelo: z.enum(["pedido", "conta"]),
  layout: z.object({
    blocos: z
      .array(
        z.object({
          id: z.string().max(40),
          ativo: z.boolean(),
          estilo: estiloSchema,
          opcoes: z.record(
            z.string().max(40),
            z.union([z.boolean(), z.string().max(300)]),
          ),
        }),
      )
      .max(30),
  }),
});

export const salvarLayout = async (
  restauranteId: string,
  { modelo, layout }: z.infer<typeof salvarLayoutSchema>,
) => {
  const config = normalizarLayout(modelo, layout);
  await db()
    .insert(schema.layoutsImpressao)
    .values({ restauranteId, modelo, config })
    .onConflictDoUpdate({
      target: [
        schema.layoutsImpressao.restauranteId,
        schema.layoutsImpressao.modelo,
      ],
      set: { config, atualizadoEm: new Date() },
    });
  return config;
};

export const testeLayoutSchema = z.object({
  modelo: z.enum(["pedido", "conta"]),
  impressoraId: z.uuid(),
});

// Imprime o exemplo (os mesmos dados da pré-visualização) com o layout salvo.
export const imprimirTesteLayout = async (
  restauranteId: string,
  { modelo, impressoraId }: z.infer<typeof testeLayoutSchema>,
) => {
  const [impressora] = await db()
    .select({ id: schema.impressoras.id })
    .from(schema.impressoras)
    .where(
      and(
        eq(schema.impressoras.id, impressoraId),
        eq(schema.impressoras.restauranteId, restauranteId),
      ),
    );
  if (!impressora) throw naoEncontrado("Impressora");

  const [restaurante] = await db()
    .select({ nome: schema.restaurantes.nome })
    .from(schema.restaurantes)
    .where(eq(schema.restaurantes.id, restauranteId));
  const pedido = exemploPedido();
  await db()
    .insert(schema.trabalhosImpressao)
    .values({
      restauranteId,
      impressoraId,
      tipo: modelo === "conta" ? "conta" : "pedido",
      payload:
        modelo === "conta"
          ? {
              ...pedido,
              itens: [],
              conta: exemploConta(restaurante?.nome ?? "", true),
            }
          : pedido,
    });
  acordarImpressao();
  notificar(restauranteId, ["impressao"]);
};
