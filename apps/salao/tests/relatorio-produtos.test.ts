import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";

import { db, schema } from "@/db";
import type { Sessao } from "@/lib/auth/sessao";
import { relatorioProdutos } from "@/lib/dominio/relatorio-produtos";
import { chave, lancarNaMesa, mesa, produto, sessaoDe } from "./helpers";

let garcom: Sessao;

beforeAll(async () => {
  garcom = await sessaoDe("Garçom A");
});

describe("relatório de produtos", () => {
  it("lucro usa o custo da hora da venda; mudar o custo depois não altera", async () => {
    const batata = await produto("Batata Frita");
    await db()
      .update(schema.produtos)
      .set({ custoCentavos: 1_000 })
      .where(eq(schema.produtos.id, batata.id));
    const m = await mesa(13);
    await lancarNaMesa(garcom, m.id, {
      idempotencyKey: chave(),
      itens: [{ produtoId: batata.id, quantidade: 3, modificadorIds: [] }],
    });
    // Custo muda depois da venda.
    await db()
      .update(schema.produtos)
      .set({ custoCentavos: 9_000 })
      .where(eq(schema.produtos.id, batata.id));

    const r = await relatorioProdutos(garcom.funcionario.restauranteId, 1);
    const linha = r.produtos.find((p) => p.produtoId === batata.id);
    expect(linha?.quantidade).toBeGreaterThanOrEqual(3);
    // 3 vendidas a R$ 10,00 de custo cada (o custo novo não entra).
    expect(linha?.custoCentavos).toBe(linha ? linha.quantidade * 1_000 : 0);
    expect(linha?.lucroCentavos).toBe(
      (linha?.receitaCentavos ?? 0) - (linha?.custoCentavos ?? 0),
    );
    expect(r.semVenda.some((p) => p.produtoId === batata.id)).toBe(false);
    expect(r.coberturaPct).toBeGreaterThan(0);
  });
});
