import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";

import { db, schema } from "@/db";
import type { Sessao } from "@/lib/auth/sessao";
import { abrirComanda, comandaPorNumero } from "@/lib/dominio/mesas";
import { lancarRodada } from "@/lib/dominio/rodadas";
import type { ErroDominio } from "@/lib/erros";
import {
  chave,
  comandaDaMesa,
  contar,
  definirEstoque,
  lancarNaMesa,
  mesa,
  modificador,
  produto,
  sessaoDe,
} from "./helpers";

let garcomA: Sessao;
let garcomB: Sessao;

beforeAll(async () => {
  garcomA = await sessaoDe("Garçom A");
  garcomB = await sessaoDe("Garçom B");
});

const erroDe = async (promessa: Promise<unknown>) => {
  try {
    await promessa;
  } catch (error) {
    return error as ErroDominio;
  }
  throw new Error("esperava erro");
};

describe("lançar rodada", () => {
  it("abre a comanda da mesa livre e cria um trabalho por impressora", async () => {
    const m = await mesa(1);
    const xis = await produto("Xis Bah Tchê! - Bacon");
    const batata = await produto("Batata Frita");
    const agua = await produto("Água sem Gás");
    const semErvilha = await modificador("Sem ervilha");
    const bacon = await modificador("Bacon extra");

    const r = await lancarNaMesa(garcomA, m.id, {
      idempotencyKey: chave(),
      itens: [
        {
          produtoId: xis.id,
          quantidade: 2,
          modificadorIds: [semErvilha.id, bacon.id],
          observacao: "bem passado",
        },
        { produtoId: batata.id, quantidade: 1, modificadorIds: [] },
        { produtoId: agua.id, quantidade: 3, modificadorIds: [] },
      ],
    });

    expect(r.repetida).toBe(false);
    expect(r.numero).toBe(1);

    const itens = await db()
      .select()
      .from(schema.itensPedido)
      .where(eq(schema.itensPedido.rodadaId, r.rodadaId));
    expect(itens).toHaveLength(3);
    const itemXis = itens.find((i) => i.produtoId === xis.id);
    // (32,00 + 5,00 de bacon extra) x 2
    expect(itemXis?.totalCentavos).toBe((4990 + 500) * 2);
    expect(itemXis?.mesaOrigemId).toBe(m.id);

    const trabalhos = await db()
      .select()
      .from(schema.trabalhosImpressao)
      .where(eq(schema.trabalhosImpressao.rodadaId, r.rodadaId));
    // chapa, fritura e bar
    expect(trabalhos).toHaveLength(3);
    expect(trabalhos.every((t) => t.status === "pendente")).toBe(true);
    const chapa = trabalhos.find((t) =>
      t.payload.itens.some((i) => i.nome === "Xis Bah Tchê! - Bacon"),
    );
    expect(chapa?.payload.itens[0].modificadores).toEqual([
      "Sem ervilha",
      "Bacon extra",
    ]);
  });

  it("segunda rodada na mesma mesa usa a mesma comanda e numera 2", async () => {
    const m = await mesa(1);
    const agua = await produto("Água sem Gás");
    const r = await lancarNaMesa(garcomB, m.id, {
      idempotencyKey: chave(),
      itens: [{ produtoId: agua.id, quantidade: 1, modificadorIds: [] }],
    });
    expect(r.numero).toBe(2);
    expect(await contar("comanda", "status = 'aberta'")).toBe(1);
  });

  it("mesma idempotency key não duplica (reenvio sequencial)", async () => {
    const m = await mesa(2);
    const agua = await produto("Água sem Gás");
    const input = {
      idempotencyKey: chave(),
      itens: [{ produtoId: agua.id, quantidade: 1, modificadorIds: [] }],
    };
    const primeira = await lancarNaMesa(garcomA, m.id, input);
    const segunda = await lancarNaMesa(garcomA, m.id, input);
    expect(segunda.rodadaId).toBe(primeira.rodadaId);
    expect(segunda.repetida).toBe(true);
    expect(
      await contar("rodada", `idempotency_key = '${input.idempotencyKey}'`),
    ).toBe(1);
  });

  it("mesma idempotency key disparada 5x em paralelo cria exatamente 1 rodada", async () => {
    const m = await mesa(3);
    const agua = await produto("Água sem Gás");
    const input = {
      idempotencyKey: chave(),
      itens: [{ produtoId: agua.id, quantidade: 1, modificadorIds: [] }],
    };
    const resultados = await Promise.all(
      Array.from({ length: 5 }, () => lancarNaMesa(garcomA, m.id, input)),
    );
    expect(new Set(resultados.map((r) => r.rodadaId)).size).toBe(1);
    expect(resultados.filter((r) => !r.repetida)).toHaveLength(1);
    expect(
      await contar("rodada", `idempotency_key = '${input.idempotencyKey}'`),
    ).toBe(1);
    expect(
      await contar("item_pedido", `rodada_id = '${resultados[0].rodadaId}'`),
    ).toBe(1);
  });

  it("dois garçons abrindo o mesmo cartão ao mesmo tempo geram 1 comanda", async () => {
    const m = await mesa(4);
    const agua = await produto("Água sem Gás");
    const aberturas = await Promise.allSettled([
      abrirComanda(garcomA, { mesaId: m.id, numero: 44 }),
      abrirComanda(garcomB, { mesaId: m.id, numero: 44 }),
    ]);
    expect(aberturas.filter((a) => a.status === "fulfilled")).toHaveLength(1);
    const recusada = aberturas.find((a) => a.status === "rejected");
    expect((recusada as PromiseRejectedResult).reason.codigo).toBe(
      "cartao_em_uso",
    );
    expect(await contar("comanda", "numero = 44 and status = 'aberta'")).toBe(
      1,
    );

    // Os dois lançando juntos na mesma comanda: rodadas 1 e 2, sem duplicar.
    const { comandaId } = await comandaPorNumero(
      garcomA.funcionario.restauranteId,
      44,
    );
    const [a, b] = await Promise.all([
      lancarRodada(garcomA, comandaId, {
        idempotencyKey: chave(),
        itens: [{ produtoId: agua.id, quantidade: 1, modificadorIds: [] }],
      }),
      lancarRodada(garcomB, comandaId, {
        idempotencyKey: chave(),
        itens: [{ produtoId: agua.id, quantidade: 2, modificadorIds: [] }],
      }),
    ]);
    expect([a.numero, b.numero].sort()).toEqual([1, 2]);
  });

  it("estoque nunca fica negativo com 20 lançamentos paralelos disputando 3 unidades", async () => {
    const coracao = await produto("Xis Tri Bom - Frango");
    await definirEstoque(coracao.id, 3);
    const mesas = await Promise.all(
      Array.from({ length: 10 }, (_, i) => mesa(i + 5)),
    );
    // Comandas abertas antes; a disputa é só pelo estoque.
    const comandas: string[] = [];
    for (const m of mesas) comandas.push(await comandaDaMesa(garcomA, m.id));

    const tentativas = await Promise.allSettled(
      Array.from({ length: 20 }, (_, i) =>
        lancarRodada(i % 2 ? garcomA : garcomB, comandas[i % 10], {
          idempotencyKey: chave(),
          itens: [{ produtoId: coracao.id, quantidade: 1, modificadorIds: [] }],
        }),
      ),
    );

    const ok = tentativas.filter((t) => t.status === "fulfilled");
    const falhas = tentativas.filter((t) => t.status === "rejected");
    expect(ok).toHaveLength(3);
    expect(falhas).toHaveLength(17);
    for (const falha of falhas) {
      expect((falha as PromiseRejectedResult).reason.codigo).toBe("esgotado");
    }
    const [depois] = await db()
      .select({ estoque: schema.produtos.estoque })
      .from(schema.produtos)
      .where(eq(schema.produtos.id, coracao.id));
    expect(depois.estoque).toBe(0);
    expect(
      await contar(
        "item_pedido",
        `produto_id = '${coracao.id}' and status = 'ativo'`,
      ),
    ).toBe(3);
  });

  it("lançamento esgotado não deixa nada gravado (rollback completo)", async () => {
    const coracao = await produto("Xis Tri Bom - Frango");
    const agua = await produto("Água sem Gás");
    await definirEstoque(coracao.id, 1);
    const m = await mesa(18);
    const comandaId = await comandaDaMesa(garcomA, m.id);
    const antes = await contar("item_pedido");

    const erro = await erroDe(
      lancarRodada(garcomA, comandaId, {
        idempotencyKey: chave(),
        itens: [
          { produtoId: agua.id, quantidade: 1, modificadorIds: [] },
          { produtoId: coracao.id, quantidade: 2, modificadorIds: [] },
        ],
      }),
    );
    expect(erro.codigo).toBe("esgotado");
    expect(await contar("item_pedido")).toBe(antes);
    // Nenhuma rodada fica gravada na comanda (a comanda continua aberta).
    expect(await contar("rodada", `comanda_id = '${comandaId}'`)).toBe(0);
  });

  it("recusa modificador que não pertence ao produto", async () => {
    const m = await mesa(19);
    const agua = await produto("Água sem Gás");
    const bacon = await modificador("Bacon extra");
    const erro = await erroDe(
      lancarNaMesa(garcomA, m.id, {
        idempotencyKey: chave(),
        itens: [
          { produtoId: agua.id, quantidade: 1, modificadorIds: [bacon.id] },
        ],
      }),
    );
    expect(erro.status).toBe(422);
  });

  it("recusa produto indisponível", async () => {
    const m = await mesa(19);
    const pudim = await produto("Pudim");
    await db()
      .update(schema.produtos)
      .set({ disponivel: false })
      .where(eq(schema.produtos.id, pudim.id));
    const erro = await erroDe(
      lancarNaMesa(garcomA, m.id, {
        idempotencyKey: chave(),
        itens: [{ produtoId: pudim.id, quantidade: 1, modificadorIds: [] }],
      }),
    );
    expect(erro.codigo).toBe("indisponivel");
  });
});
