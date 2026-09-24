import { and, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";

import { db, schema } from "@/db";
import type { TicketPayload } from "@/db/schema";
import type { Sessao } from "@/lib/auth/sessao";
import { conflito, naoEncontrado } from "@/lib/erros";
import { acordarImpressao, type Escopo, notificar } from "@/lib/runtime";
import { mesasDaComanda } from "./comum";

export const cancelarItemSchema = z.object({
  motivo: z.string().trim().min(3, "Informe o motivo.").max(140),
  // Resposta do garçom para "O preparo já foi iniciado?". Enquanto não
  // existir KDS na cozinha, é essa resposta que decide se o estoque volta.
  preparoIniciado: z.boolean(),
});

export type CancelarItemInput = z.infer<typeof cancelarItemSchema>;

// Qualquer garçom pode cancelar; fica registrado quem, quando e por quê.
export const cancelarItem = async (
  sessao: Sessao,
  itemId: string,
  input: CancelarItemInput,
) => {
  const { restauranteId } = sessao.funcionario;
  let devolveuEstoque = false;

  const comandaId = await db().transaction(async (tx) => {
    const [linha] = await tx
      .select({
        item: schema.itensPedido,
        comandaStatus: schema.comandas.status,
        rodadaNumero: schema.rodadas.numero,
        lancadaEm: schema.rodadas.lancadaEm,
        garcom: schema.funcionarios.nome,
        controlaEstoque: schema.produtos.controlaEstoque,
        mesaOrigem: schema.mesas.numero,
      })
      .from(schema.itensPedido)
      .innerJoin(
        schema.comandas,
        eq(schema.comandas.id, schema.itensPedido.comandaId),
      )
      .innerJoin(
        schema.rodadas,
        eq(schema.rodadas.id, schema.itensPedido.rodadaId),
      )
      .innerJoin(
        schema.funcionarios,
        eq(schema.funcionarios.id, schema.rodadas.funcionarioId),
      )
      .innerJoin(
        schema.produtos,
        eq(schema.produtos.id, schema.itensPedido.produtoId),
      )
      .innerJoin(
        schema.mesas,
        eq(schema.mesas.id, schema.itensPedido.mesaOrigemId),
      )
      .where(
        and(
          eq(schema.itensPedido.id, itemId),
          eq(schema.comandas.restauranteId, restauranteId),
        ),
      )
      .for("update", { of: schema.itensPedido })
      .limit(1);

    if (!linha) throw naoEncontrado("Item");
    const { item } = linha;
    if (item.status === "cancelado") {
      throw conflito("ja_cancelado", "Este item já foi cancelado.");
    }
    if (linha.comandaStatus !== "aberta") {
      throw conflito("comanda_fechada", "A comanda desta mesa já foi fechada.");
    }

    await tx
      .update(schema.itensPedido)
      .set({
        status: "cancelado",
        canceladoPor: sessao.funcionario.id,
        canceladoEm: new Date(),
        motivoCancelamento: input.motivo,
        preparoIniciado: input.preparoIniciado,
      })
      .where(eq(schema.itensPedido.id, item.id));

    if (!input.preparoIniciado && linha.controlaEstoque) {
      await tx
        .update(schema.produtos)
        .set({ estoque: sql`${schema.produtos.estoque} + ${item.quantidade}` })
        .where(eq(schema.produtos.id, item.produtoId));
      devolveuEstoque = true;
    }

    if (item.impressoraId) {
      // Trava o trabalho de impressão desta rodada nesta impressora. O worker
      // usa SKIP LOCKED, então não imprime enquanto mexemos no payload.
      const [trabalho] = await tx
        .select()
        .from(schema.trabalhosImpressao)
        .where(
          and(
            eq(schema.trabalhosImpressao.rodadaId, item.rodadaId),
            eq(schema.trabalhosImpressao.impressoraId, item.impressoraId),
            inArray(schema.trabalhosImpressao.tipo, ["pedido", "reimpressao"]),
          ),
        )
        .for("update")
        .limit(1);

      const aindaNaoSaiu =
        trabalho &&
        (trabalho.status === "pendente" || trabalho.status === "falhou");

      if (aindaNaoSaiu) {
        // Ainda não imprimiu: só tira o item do ticket. Sem aviso na cozinha.
        const itens = trabalho.payload.itens.filter(
          (i) => i.itemId !== item.id,
        );
        await tx
          .update(schema.trabalhosImpressao)
          .set(
            itens.length
              ? { payload: { ...trabalho.payload, itens } }
              : { status: "descartado" },
          )
          .where(eq(schema.trabalhosImpressao.id, trabalho.id));
      } else if (trabalho?.status !== "descartado") {
        // Já saiu (ou está saindo): manda o aviso de cancelamento para a
        // mesma impressora, para a cozinha não continuar preparando.
        const modificadores = await tx
          .select({ nome: schema.itemPedidoModificadores.nome })
          .from(schema.itemPedidoModificadores)
          .where(eq(schema.itemPedidoModificadores.itemPedidoId, item.id));
        const mesas = await mesasDaComanda(tx, item.comandaId);
        const payload: TicketPayload = {
          mesas: mesas.map((m) => m.numero),
          garcom: sessao.funcionario.nome,
          rodada: linha.rodadaNumero,
          lancadaEm: new Date().toISOString(),
          itens: [
            {
              itemId: item.id,
              quantidade: item.quantidade,
              nome: item.nomeProduto,
              modificadores: modificadores.map((m) => m.nome),
              observacao: item.observacao,
              mesaOrigem: linha.mesaOrigem,
            },
          ],
          motivo: input.motivo,
          preparoIniciado: input.preparoIniciado,
        };
        await tx.insert(schema.trabalhosImpressao).values({
          restauranteId,
          impressoraId: item.impressoraId,
          tipo: "cancelamento",
          rodadaId: item.rodadaId,
          comandaId: item.comandaId,
          payload,
        });
      }
    }

    return item.comandaId;
  });

  const escopos: Escopo[] = ["mesas", `comanda:${comandaId}`, "impressao"];
  if (devolveuEstoque) escopos.push("cardapio");
  notificar(restauranteId, escopos);
  acordarImpressao();
  return { comandaId, devolveuEstoque };
};
