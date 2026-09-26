import { and, eq, gte, sql } from "drizzle-orm";
import { z } from "zod";

import { db, schema } from "@/db";
import type { TicketItem, TicketPayload } from "@/db/schema";
import type { Sessao } from "@/lib/auth/sessao";
import { conflito, invalido, naoEncontrado } from "@/lib/erros";
import { acordarImpressao, type Escopo, notificar } from "@/lib/runtime";
import { mesasDaComanda } from "./comum";
import { aplicarConsumo, consumoDosItens, diferencaDeConsumo } from "./estoque";
import { aindaNaoImpresso, trabalhoDoItem } from "./trabalho-do-item";

export const editarItemSchema = z.object({
  quantidade: z.number().int().min(1).max(50),
  modificadorIds: z.array(z.uuid()).max(20).default([]),
  observacao: z.string().trim().max(140).optional(),
});

export type EditarItemInput = z.infer<typeof editarItemSchema>;

const mesmaLista = (a: string[], b: string[]) =>
  a.length === b.length && [...a].sort().join() === [...b].sort().join();

// A rodada continua imutável na prática: o item antigo não é alterado, e sim
// cancelado ("Alterado") e substituído por um novo que aponta para ele. A
// cozinha recebe um ticket de ALTERAÇÃO se o pedido original já saiu.
export const editarItem = async (
  sessao: Sessao,
  itemId: string,
  input: EditarItemInput,
) => {
  const { restauranteId } = sessao.funcionario;
  let mexeuEstoque = false;

  const resultado = await db().transaction(async (tx) => {
    const [linha] = await tx
      .select({
        item: schema.itensPedido,
        comandaStatus: schema.comandas.status,
        rodadaNumero: schema.rodadas.numero,
        controlaEstoque: schema.produtos.controlaEstoque,
        codigo: schema.produtos.codigo,
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
    if (item.status !== "ativo") {
      throw conflito("ja_cancelado", "Este item foi cancelado ou já alterado.");
    }
    if (linha.comandaStatus !== "aberta") {
      throw conflito("comanda_fechada", "A comanda desta mesa já foi fechada.");
    }

    const modsAtuais = await tx
      .select({
        id: schema.itemPedidoModificadores.modificadorId,
        nome: schema.itemPedidoModificadores.nome,
      })
      .from(schema.itemPedidoModificadores)
      .where(eq(schema.itemPedidoModificadores.itemPedidoId, item.id));

    const observacao = input.observacao || null;
    const novosIds = [...new Set(input.modificadorIds)];
    if (
      input.quantidade === item.quantidade &&
      observacao === item.observacao &&
      mesmaLista(
        novosIds,
        modsAtuais.map((m) => m.id),
      )
    ) {
      return { itemId: item.id, comandaId: item.comandaId, alterou: false };
    }

    // Modificadores válidos para o produto (mesmas regras do lançamento).
    const permitidos = await tx
      .select({
        id: schema.modificadores.id,
        nome: schema.modificadores.nome,
        tipo: schema.modificadores.tipo,
        precoCentavos: schema.modificadores.precoCentavos,
      })
      .from(schema.produtoModificadores)
      .innerJoin(
        schema.modificadores,
        eq(schema.modificadores.id, schema.produtoModificadores.modificadorId),
      )
      .where(eq(schema.produtoModificadores.produtoId, item.produtoId));
    const mods = novosIds.map((id) => {
      const mod = permitidos.find((m) => m.id === id);
      if (!mod)
        throw invalido(`Modificador inválido para ${item.nomeProduto}.`);
      return mod;
    });
    if (mods.filter((m) => m.tipo === "preparo").length > 1) {
      throw invalido("Escolha só um ponto da carne.");
    }

    // Estoque: só a diferença. Aumentar usa o mesmo UPDATE atômico do
    // lançamento; diminuir devolve.
    const diferenca = input.quantidade - item.quantidade;
    if (linha.controlaEstoque && diferenca > 0) {
      const baixou = await tx
        .update(schema.produtos)
        .set({ estoque: sql`${schema.produtos.estoque} - ${diferenca}` })
        .where(
          and(
            eq(schema.produtos.id, item.produtoId),
            gte(schema.produtos.estoque, diferenca),
          ),
        )
        .returning({ id: schema.produtos.id });
      if (!baixou.length) {
        throw conflito(
          "esgotado",
          `Não há estoque para aumentar ${item.nomeProduto}.`,
        );
      }
      mexeuEstoque = true;
    } else if (linha.controlaEstoque && diferenca < 0) {
      await tx
        .update(schema.produtos)
        .set({ estoque: sql`${schema.produtos.estoque} + ${-diferenca}` })
        .where(eq(schema.produtos.id, item.produtoId));
      mexeuEstoque = true;
    }

    // Insumos: só a diferença entre o item antigo e o novo (quantidade e
    // adicionais podem ter mudado).
    const [antes, depois] = await Promise.all([
      consumoDosItens(tx, [
        {
          produtoId: item.produtoId,
          quantidade: item.quantidade,
          modificadorIds: modsAtuais.flatMap((m) => (m.id ? [m.id] : [])),
        },
      ]),
      consumoDosItens(tx, [
        {
          produtoId: item.produtoId,
          quantidade: input.quantidade,
          modificadorIds: novosIds,
        },
      ]),
    ]);
    if (await aplicarConsumo(tx, diferencaDeConsumo(depois, antes)))
      mexeuEstoque = true;

    await tx
      .update(schema.itensPedido)
      .set({
        status: "cancelado",
        canceladoPor: sessao.funcionario.id,
        canceladoEm: new Date(),
        motivoCancelamento: "Alterado",
      })
      .where(eq(schema.itensPedido.id, item.id));

    const adicionais = mods.reduce((soma, m) => soma + m.precoCentavos, 0);
    const [novo] = await tx
      .insert(schema.itensPedido)
      .values({
        rodadaId: item.rodadaId,
        comandaId: item.comandaId,
        produtoId: item.produtoId,
        mesaOrigemId: item.mesaOrigemId,
        quantidade: input.quantidade,
        nomeProduto: item.nomeProduto,
        precoUnitarioCentavos: item.precoUnitarioCentavos,
        totalCentavos:
          (item.precoUnitarioCentavos + adicionais) * input.quantidade,
        impressoraId: item.impressoraId,
        observacao,
        substituiItemId: item.id,
      })
      .returning({ id: schema.itensPedido.id });

    if (mods.length) {
      await tx.insert(schema.itemPedidoModificadores).values(
        mods.map((mod) => ({
          itemPedidoId: novo.id,
          modificadorId: mod.id,
          nome: mod.nome,
          tipo: mod.tipo,
          precoCentavos: mod.precoCentavos,
        })),
      );
    }

    const ticketDepois: TicketItem = {
      itemId: novo.id,
      codigo: linha.codigo,
      quantidade: input.quantidade,
      nome: item.nomeProduto,
      modificadores: mods.map((m) => m.nome),
      observacao,
      mesaOrigem: linha.mesaOrigem,
    };

    const trabalho = await trabalhoDoItem(tx, item);
    if (trabalho && aindaNaoImpresso(trabalho)) {
      // Ainda na fila: corrige o próprio ticket, a cozinha só vê a versão final.
      await tx
        .update(schema.trabalhosImpressao)
        .set({
          payload: {
            ...trabalho.payload,
            itens: trabalho.payload.itens.map((i) =>
              i.itemId === item.id ? ticketDepois : i,
            ),
          },
        })
        .where(eq(schema.trabalhosImpressao.id, trabalho.id));
    } else if (item.impressoraId) {
      const mesas = await mesasDaComanda(tx, item.comandaId);
      const payload: TicketPayload = {
        mesas: mesas.map((m) => m.numero),
        garcom: sessao.funcionario.nome,
        rodada: linha.rodadaNumero,
        lancadaEm: new Date().toISOString(),
        itens: [ticketDepois],
        antes: [
          {
            itemId: item.id,
            codigo: linha.codigo,
            quantidade: item.quantidade,
            nome: item.nomeProduto,
            modificadores: modsAtuais.map((m) => m.nome),
            observacao: item.observacao,
            mesaOrigem: linha.mesaOrigem,
          },
        ],
      };
      await tx.insert(schema.trabalhosImpressao).values({
        restauranteId,
        impressoraId: item.impressoraId,
        tipo: "alteracao",
        rodadaId: item.rodadaId,
        comandaId: item.comandaId,
        payload,
      });
    }

    return { itemId: novo.id, comandaId: item.comandaId, alterou: true };
  });

  if (resultado.alterou) {
    const escopos: Escopo[] = [
      "mesas",
      `comanda:${resultado.comandaId}`,
      "impressao",
    ];
    if (mexeuEstoque) escopos.push("cardapio");
    notificar(restauranteId, escopos);
    acordarImpressao();
  }
  return resultado;
};
