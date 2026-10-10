import { beforeAll, describe, expect, it } from "vitest";

import type { Sessao } from "@/lib/auth/sessao";
import { painelNoite, painelPeriodo } from "@/lib/dominio/painel";
import { chave, lancarNaMesa, mesa, produto, sessaoDe } from "./helpers";

let garcom: Sessao;

beforeAll(async () => {
  garcom = await sessaoDe("Garçom A");
  const m = await mesa(18);
  const p = await produto("Batata Frita");
  await lancarNaMesa(garcom, m.id, {
    idempotencyKey: chave(),
    itens: [{ produtoId: p.id, quantidade: 2, modificadorIds: [] }],
  });
});

describe("painel do gerente", () => {
  it("noite de hoje soma o que foi lançado e mostra por hora", async () => {
    const p = await painelNoite(garcom.funcionario.restauranteId, 0);
    expect(p.aoVivo).toBe(true);
    expect(p.vendas.centavos).toBeGreaterThan(0);
    expect(p.vendasPorHora.reduce((s, h) => s + h.centavos, 0)).toBe(
      p.vendas.centavos,
    );
  });

  it("7 dias: uma barra por noite, terminando hoje, somando o total", async () => {
    const p = await painelPeriodo(garcom.funcionario.restauranteId, 7);
    expect(p.dias).toBe(7);
    expect(p.vendasPorNoite).toHaveLength(7);
    expect(p.vendasPorNoite.reduce((s, n) => s + n.centavos, 0)).toBe(
      p.vendas.centavos,
    );
    expect(p.vendasPorNoite.at(-1)?.centavos).toBeGreaterThan(0);
  });
});
