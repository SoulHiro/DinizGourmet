import { and, eq, inArray } from "drizzle-orm";

import { schema, type Tx } from "@/db";

// Ticket (pedido, reimpressão ou alteração) em que o item está, travado para
// edição. O worker usa SKIP LOCKED, então não imprime enquanto mexemos nele.
// Se houver mais de um (ex.: pedido já impresso + alteração na fila), o que
// ainda não saiu vem primeiro.
export const trabalhoDoItem = async (
  tx: Tx,
  item: { id: string; rodadaId: string; impressoraId: string | null },
) => {
  if (!item.impressoraId) return undefined;
  const trabalhos = await tx
    .select()
    .from(schema.trabalhosImpressao)
    .where(
      and(
        eq(schema.trabalhosImpressao.rodadaId, item.rodadaId),
        eq(schema.trabalhosImpressao.impressoraId, item.impressoraId),
        inArray(schema.trabalhosImpressao.tipo, [
          "pedido",
          "reimpressao",
          "alteracao",
        ]),
      ),
    )
    .for("update");

  const comItem = trabalhos.filter((t) =>
    t.payload.itens.some((i) => i.itemId === item.id),
  );
  return (
    comItem.find((t) => t.status === "pendente" || t.status === "falhou") ??
    comItem[0]
  );
};

export const aindaNaoImpresso = (trabalho?: { status: string }) =>
  trabalho !== undefined &&
  (trabalho.status === "pendente" || trabalho.status === "falhou");
