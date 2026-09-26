import { and, desc, eq, inArray } from "drizzle-orm";

import { db, schema } from "@/db";
import { acordarImpressao, notificar, runtime } from "@/lib/runtime";

export const resumoImpressao = async (restauranteId: string) => {
  const trabalhos = await db()
    .select({
      id: schema.trabalhosImpressao.id,
      tipo: schema.trabalhosImpressao.tipo,
      status: schema.trabalhosImpressao.status,
      tentativas: schema.trabalhosImpressao.tentativas,
      ultimoErro: schema.trabalhosImpressao.ultimoErro,
      criadoEm: schema.trabalhosImpressao.criadoEm,
      payload: schema.trabalhosImpressao.payload,
      impressora: schema.impressoras.nome,
    })
    .from(schema.trabalhosImpressao)
    .innerJoin(
      schema.impressoras,
      eq(schema.impressoras.id, schema.trabalhosImpressao.impressoraId),
    )
    .where(
      and(
        eq(schema.trabalhosImpressao.restauranteId, restauranteId),
        inArray(schema.trabalhosImpressao.status, [
          "pendente",
          "imprimindo",
          "falhou",
        ]),
      ),
    )
    .orderBy(desc(schema.trabalhosImpressao.criadoEm))
    .limit(50);

  const impressoras = (await runtime().statusImpressoras?.()) ?? [];

  return {
    aguardando: trabalhos.length,
    falhas: trabalhos.filter((t) => t.status === "falhou").length,
    trabalhos: trabalhos.map((t) => ({
      id: t.id,
      tipo: t.tipo,
      status: t.status,
      tentativas: t.tentativas,
      ultimoErro: t.ultimoErro,
      criadoEm: t.criadoEm.toISOString(),
      impressora: t.impressora,
      mesa: t.payload.mesas[0],
      rodada: t.payload.rodada,
    })),
    impressoras,
  };
};

// Botão "Reenviar pendentes": recoloca na fila o que falhou e acorda o worker.
export const reenviarPendentes = async (restauranteId: string) => {
  const reabertos = await db()
    .update(schema.trabalhosImpressao)
    .set({ status: "pendente", tentativas: 0, proximaTentativaEm: new Date() })
    .where(
      and(
        eq(schema.trabalhosImpressao.restauranteId, restauranteId),
        inArray(schema.trabalhosImpressao.status, ["falhou", "pendente"]),
      ),
    )
    .returning({ id: schema.trabalhosImpressao.id });
  notificar(restauranteId, ["impressao"]);
  acordarImpressao();
  return { reenviados: reabertos.length };
};
