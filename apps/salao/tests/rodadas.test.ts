import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";

import { db, schema } from "@/db";
import type { Sessao } from "@/lib/auth/sessao";
import { lancarRodada } from "@/lib/dominio/rodadas";
import type { ErroDominio } from "@/lib/erros";
import {
  chave,
  contar,
  definirEstoque,
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
    const xis = await produto("Xis Bacon");
    const batata = await produto("Batata Frita");
    const agua = await produto("Água sem Gás");
    const semErvilha = await modificador("Sem ervilha");
    const bacon = await modificador("Bacon extra");

    const r = await lancarRodada(garcomA, m.id, {
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
    expect(itemXis?.totalCentavos).toBe((3200 + 500) * 2);
    expect(itemXis?.mesaOrigemId).toBe(m.id);

    const trabalhos = await db()
      .select()
      .from(schema.trabalhosImpressao)
      .where(eq(schema.trabalhosImpressao.rodadaId, r.rodadaId));
    // chapa, fritura e bar
    expect(trabalhos).toHaveLength(3);
    expect(trabalhos.every((t) => t.status === "pendente")).toBe(true);
    const chapa = trabalhos.find((t) =>
      t.payload.itens.some((i) => i.nome === "Xis Bacon"),
    );
    expect(chapa?.payload.itens[0].modificadores).toEqual([
      "Sem ervilha",
      "Bacon extra",
    ]);
  });

  it("segunda rodada na mesma mesa usa a mesma comanda e numera 2", async () => {
    const m = await mesa(1);
    const agua = await produto("Água sem Gás");
    const r = await lancarRodada(garcomB, m.id, {
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
    const primeira = await lancarRodada(garcomA, m.id, input);
    const segunda = await lancarRodada(garcomA, m.id, input);
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
      Array.from({ length: 5 }, () => lancarRodada(garcomA, m.id, input)),
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

  it("dois garçons abrindo a mesma mesa livre ao mesmo tempo geram 1 comanda", async () => {
    const m = await mesa(4);
    const agua = await produto("Água sem Gás");
    const [a, b] = await Promise.all([
      lancarRodada(garcomA, m.id, {
        idempotencyKey: chave(),
        itens: [{ produtoId: agua.id, quantidade: 1, modificadorIds: [] }],
      }),
      lancarRodada(garcomB, m.id, {
        idempotencyKey: chave(),
        itens: [{ produtoId: agua.id, quantidade: 2, modificadorIds: [] }],
      }),
    ]);
    expect(a.comandaId).toBe(b.comandaId);
    expect([a.numero, b.numero].sort()).toEqual([1, 2]);
    expect(
      await contar("comanda_mesa", `mesa_id = '${m.id}' and saiu_em is null`),
    ).toBe(1);
  });

  it("estoque nunca fica negativo com 20 lançamentos paralelos disputando 3 unidades", async () => {
    const coracao = await produto("Xis Coração");
    await definirEstoque(coracao.id, 3);
    const mesas = await Promise.all(
      Array.from({ length: 10 }, (_, i) => mesa(i + 5)),
    );

    const tentativas = await Promise.allSettled(
      Array.from({ length: 20 }, (_, i) =>
        lancarRodada(i % 2 ? garcomA : garcomB, mesas[i % 10].id, {
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
    const coracao = await produto("Xis Coração");
    const agua = await produto("Água sem Gás");
    await definirEstoque(coracao.id, 1);
    const m = await mesa(18);
    const antes = await contar("item_pedido");

    const erro = await erroDe(
      lancarRodada(garcomA, m.id, {
        idempotencyKey: chave(),
        itens: [
          { produtoId: agua.id, quantidade: 1, modificadorIds: [] },
          { produtoId: coracao.id, quantidade: 2, modificadorIds: [] },
        ],
      }),
    );
    expect(erro.codigo).toBe("esgotado");
    expect(await contar("item_pedido")).toBe(antes);
    expect(
      await contar("comanda_mesa", `mesa_id = '${m.id}' and saiu_em is null`),
    ).toBe(0);
  });

  it("recusa modificador que não pertence ao produto", async () => {
    const m = await mesa(19);
    const agua = await produto("Água sem Gás");
    const bacon = await modificador("Bacon extra");
    const erro = await erroDe(
      lancarRodada(garcomA, m.id, {
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
      lancarRodada(garcomA, m.id, {
        idempotencyKey: chave(),
        itens: [{ produtoId: pudim.id, quantidade: 1, modificadorIds: [] }],
      }),
    );
    expect(erro.codigo).toBe("indisponivel");
  });
});
