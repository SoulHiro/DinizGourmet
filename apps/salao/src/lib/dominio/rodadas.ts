import { and, eq, gte, inArray, sql } from "drizzle-orm";
import { z } from "zod";

import { db, schema, type Tx } from "@/db";
import type { TicketItem, TicketPayload } from "@/db/schema";
import type { Sessao } from "@/lib/auth/sessao";
import { conflito, invalido, violouConstraint } from "@/lib/erros";
import { acordarImpressao, type Escopo, notificar } from "@/lib/runtime";
import { buscarMesa, comandaAbertaDaMesa, mesasDaComanda } from "./comum";

export const lancarRodadaSchema = z.object({
  // Gerada pelo celular quando a tela de lançamento abre. Se o garçom apertar
  // "Lançar" duas vezes (ou a rede reenviar), a segunda vez não duplica nada.
  idempotencyKey: z.uuid(),
  itens: z
    .array(
      z.object({
        produtoId: z.uuid(),
        quantidade: z.number().int().min(1).max(50),
        modificadorIds: z.array(z.uuid()).max(20).default([]),
        observacao: z.string().trim().max(140).optional(),
        mesaOrigemId: z.uuid().optional(),
      }),
    )
    .min(1, "Adicione pelo menos um item.")
    .max(60),
});

export type LancarRodadaInput = z.infer<typeof lancarRodadaSchema>;

export type ResultadoRodada = {
  rodadaId: string;
  comandaId: string;
  numero: number;
  repetida: boolean;
};

class RodadaRepetida extends Error {}

const buscarPorChave = async (idempotencyKey: string) => {
  const [rodada] = await db()
    .select()
    .from(schema.rodadas)
    .where(eq(schema.rodadas.idempotencyKey, idempotencyKey))
    .limit(1);
  return rodada;
};

// Abre a comanda da mesa ou devolve a que já está aberta. Se outro garçom
// abrir a mesma mesa no mesmo instante, o índice único parcial de
// comanda_mesa barra um dos dois, e esse passa a usar a comanda do outro.
const obterOuAbrirComanda = async (tx: Tx, sessao: Sessao, mesaId: string) => {
  const existente = await comandaAbertaDaMesa(tx, mesaId);
  if (existente) return { comanda: existente, abriu: false };

  try {
    const comanda = await tx.transaction(async (sp) => {
      const [nova] = await sp
        .insert(schema.comandas)
        .values({
          restauranteId: sessao.funcionario.restauranteId,
          mesaPrincipalId: mesaId,
          garcomTitularId: sessao.funcionario.id,
        })
        .returning();
      await sp
        .insert(schema.comandaMesas)
        .values({ comandaId: nova.id, mesaId });
      return nova;
    });
    return { comanda, abriu: true };
  } catch (error) {
    if (!violouConstraint(error, "comanda_mesa_ativa_idx")) throw error;
    const aberta = await comandaAbertaDaMesa(tx, mesaId);
    if (!aberta) throw error;
    return { comanda: aberta, abriu: false };
  }
};

export const lancarRodada = async (
  sessao: Sessao,
  mesaId: string,
  input: LancarRodadaInput,
): Promise<ResultadoRodada> => {
  const { restauranteId } = sessao.funcionario;

  const anterior = await buscarPorChave(input.idempotencyKey);
  if (anterior) {
    return {
      rodadaId: anterior.id,
      comandaId: anterior.comandaId,
      numero: anterior.numero,
      repetida: true,
    };
  }

  let mexeuEstoque = false;

  try {
    const resultado = await db().transaction(async (tx) => {
      await buscarMesa(tx, restauranteId, mesaId);
      const { comanda } = await obterOuAbrirComanda(tx, sessao, mesaId);

      // Serializa lançamentos na mesma comanda para numerar as rodadas.
      await tx.execute(
        sql`select id from comanda where id = ${comanda.id} for update`,
      );
      const [{ proximo }] = (
        await tx.execute<{ proximo: number }>(
          sql`select coalesce(max(numero), 0) + 1 as proximo from rodada where comanda_id = ${comanda.id}`,
        )
      ).rows;

      const [rodada] = await tx
        .insert(schema.rodadas)
        .values({
          restauranteId,
          comandaId: comanda.id,
          funcionarioId: sessao.funcionario.id,
          numero: Number(proximo),
          idempotencyKey: input.idempotencyKey,
        })
        .onConflictDoNothing({ target: schema.rodadas.idempotencyKey })
        .returning();
      if (!rodada) throw new RodadaRepetida();

      const mesas = await mesasDaComanda(tx, comanda.id);
      const mesasPorId = new Map(mesas.map((m) => [m.id, m]));

      // Produtos e modificadores válidos para os itens pedidos.
      const produtoIds = [...new Set(input.itens.map((i) => i.produtoId))];
      const produtos = await tx
        .select({
          id: schema.produtos.id,
          nome: schema.produtos.nome,
          precoCentavos: schema.produtos.precoCentavos,
          disponivel: schema.produtos.disponivel,
          controlaEstoque: schema.produtos.controlaEstoque,
          impressoraId: schema.categorias.impressoraId,
        })
        .from(schema.produtos)
        .innerJoin(
          schema.categorias,
          eq(schema.categorias.id, schema.produtos.categoriaId),
        )
        .where(
          and(
            inArray(schema.produtos.id, produtoIds),
            eq(schema.produtos.restauranteId, restauranteId),
          ),
        );
      const produtosPorId = new Map(produtos.map((p) => [p.id, p]));

      const indisponiveis = produtoIds.filter(
        (id) => !produtosPorId.get(id)?.disponivel,
      );
      if (indisponiveis.length) {
        throw conflito(
          "indisponivel",
          "Algum item ficou indisponível. Revise o pedido.",
          { produtoIds: indisponiveis },
        );
      }

      const vinculos = await tx
        .select({
          produtoId: schema.produtoModificadores.produtoId,
          id: schema.modificadores.id,
          nome: schema.modificadores.nome,
          tipo: schema.modificadores.tipo,
          precoCentavos: schema.modificadores.precoCentavos,
        })
        .from(schema.produtoModificadores)
        .innerJoin(
          schema.modificadores,
          eq(
            schema.modificadores.id,
            schema.produtoModificadores.modificadorId,
          ),
        )
        .where(
          and(
            inArray(schema.produtoModificadores.produtoId, produtoIds),
            eq(schema.modificadores.ativo, true),
          ),
        );
      const modificadorDoProduto = (produtoId: string, modificadorId: string) =>
        vinculos.find(
          (v) => v.produtoId === produtoId && v.id === modificadorId,
        );

      // Estoque: UPDATE atômico com a condição no WHERE. Nunca "ler, subtrair,
      // salvar" no código. Em ordem de id para dois lançamentos concorrentes
      // não travarem um esperando o outro (deadlock).
      const baixas = new Map<string, number>();
      for (const item of input.itens) {
        if (produtosPorId.get(item.produtoId)?.controlaEstoque) {
          baixas.set(
            item.produtoId,
            (baixas.get(item.produtoId) ?? 0) + item.quantidade,
          );
        }
      }
      const esgotados: { produtoId: string; nome: string }[] = [];
      for (const [produtoId, quantidade] of [...baixas].sort(([a], [b]) =>
        a.localeCompare(b),
      )) {
        const atualizado = await tx
          .update(schema.produtos)
          .set({ estoque: sql`${schema.produtos.estoque} - ${quantidade}` })
          .where(
            and(
              eq(schema.produtos.id, produtoId),
              gte(schema.produtos.estoque, quantidade),
            ),
          )
          .returning({ id: schema.produtos.id });
        if (!atualizado.length) {
          esgotados.push({
            produtoId,
            nome: produtosPorId.get(produtoId)?.nome ?? "",
          });
        }
      }
      if (esgotados.length) {
        throw conflito(
          "esgotado",
          `Esgotado: ${esgotados.map((e) => e.nome).join(", ")}.`,
          { produtos: esgotados },
        );
      }
      mexeuEstoque = baixas.size > 0;

      const porImpressora = new Map<string, TicketItem[]>();

      for (const item of input.itens) {
        const produto = produtosPorId.get(item.produtoId);
        if (!produto) throw invalido("Produto inválido.");

        const mesaOrigemId = item.mesaOrigemId ?? mesaId;
        const mesaOrigem = mesasPorId.get(mesaOrigemId);
        if (!mesaOrigem) {
          throw invalido(
            "A mesa de origem do item não faz parte desta comanda.",
          );
        }

        const mods = [...new Set(item.modificadorIds)].map((id) => {
          const mod = modificadorDoProduto(item.produtoId, id);
          if (!mod)
            throw invalido(`Modificador inválido para ${produto.nome}.`);
          return mod;
        });
        const adicionais = mods.reduce((soma, m) => soma + m.precoCentavos, 0);

        const [criado] = await tx
          .insert(schema.itensPedido)
          .values({
            rodadaId: rodada.id,
            comandaId: comanda.id,
            produtoId: produto.id,
            mesaOrigemId,
            quantidade: item.quantidade,
            nomeProduto: produto.nome,
            precoUnitarioCentavos: produto.precoCentavos,
            totalCentavos:
              (produto.precoCentavos + adicionais) * item.quantidade,
            impressoraId: produto.impressoraId,
            observacao: item.observacao || null,
          })
          .returning({ id: schema.itensPedido.id });

        if (mods.length) {
          await tx.insert(schema.itemPedidoModificadores).values(
            mods.map((mod) => ({
              itemPedidoId: criado.id,
              modificadorId: mod.id,
              nome: mod.nome,
              tipo: mod.tipo,
              precoCentavos: mod.precoCentavos,
            })),
          );
        }

        // Categoria sem impressora (ex.: sobremesa pronta) não gera ticket.
        if (produto.impressoraId) {
          const lista = porImpressora.get(produto.impressoraId) ?? [];
          lista.push({
            itemId: criado.id,
            quantidade: item.quantidade,
            nome: produto.nome,
            modificadores: mods.map((m) => m.nome),
            observacao: item.observacao || null,
            mesaOrigem: mesaOrigem.numero,
          });
          porImpressora.set(produto.impressoraId, lista);
        }
      }

      // Um trabalho por impressora de destino; o worker imprime em paralelo
      // entre impressoras e em série dentro de cada uma.
      for (const [impressoraId, itens] of porImpressora) {
        const payload: TicketPayload = {
          mesas: mesas.map((m) => m.numero),
          garcom: sessao.funcionario.nome,
          rodada: rodada.numero,
          lancadaEm: rodada.lancadaEm.toISOString(),
          itens,
        };
        await tx.insert(schema.trabalhosImpressao).values({
          restauranteId,
          impressoraId,
          tipo: "pedido",
          rodadaId: rodada.id,
          comandaId: comanda.id,
          payload,
        });
      }

      return {
        rodadaId: rodada.id,
        comandaId: comanda.id,
        numero: rodada.numero,
        repetida: false,
      };
    });

    const escopos: Escopo[] = [
      "mesas",
      `comanda:${resultado.comandaId}`,
      "impressao",
    ];
    if (mexeuEstoque) escopos.push("cardapio");
    notificar(restauranteId, escopos);
    acordarImpressao();
    return resultado;
  } catch (error) {
    // Duplicata concorrente: a outra requisição com a mesma chave venceu.
    const vencedora = await buscarPorChave(input.idempotencyKey);
    if (vencedora) {
      return {
        rodadaId: vencedora.id,
        comandaId: vencedora.comandaId,
        numero: vencedora.numero,
        repetida: true,
      };
    }
    if (error instanceof RodadaRepetida) {
      throw conflito("repetida", "Pedido já processado. Atualize a tela.");
    }
    throw error;
  }
};
