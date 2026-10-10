import { beforeAll, describe, expect, it } from "vitest";

import type { Sessao } from "@/lib/auth/sessao";
import { detalheDaConta } from "@/lib/dominio/caixa";
import { corrigirPagamento, reabrirConta } from "@/lib/dominio/correcoes-caixa";
import { listarMapa } from "@/lib/dominio/mesas";
import {
  chave,
  fecharNaMesa,
  lancarNaMesa,
  mesa,
  produto,
  sessaoDe,
} from "./helpers";

let garcom: Sessao;
let gerente: Sessao;

beforeAll(async () => {
  garcom = await sessaoDe("Garçom A");
  gerente = await sessaoDe("Gerente");
});

describe("correções do caixa", () => {
  it("corrige a forma de pagamento guardando a original", async () => {
    const m = await mesa(12);
    const p = await produto("Batata Frita");
    await lancarNaMesa(garcom, m.id, {
      idempotencyKey: chave(),
      itens: [{ produtoId: p.id, quantidade: 1, modificadorIds: [] }],
    });
    const r = await fecharNaMesa(garcom, m.id, {
      taxaServico: false,
      semTaxaMotivo: "cliente_recusou",
      pagamentos: [{ metodo: "dinheiro", valorCentavos: p.precoCentavos }],
    });
    const antes = await detalheDaConta(
      gerente.funcionario.restauranteId,
      r.comandaId,
    );
    await corrigirPagamento(gerente, antes.pagamentos[0].id, { metodo: "pix" });
    const depois = await detalheDaConta(
      gerente.funcionario.restauranteId,
      r.comandaId,
    );
    expect(depois.pagamentos[0].metodo).toBe("pix");
    expect(depois.pagamentos[0].metodoOriginal).toBe("dinheiro");

    // Reabrir: a conta volta para a mesa, sem pagamento, com o motivo.
    await reabrirConta(gerente, r.comandaId, {
      motivo: "Fechou a mesa errada",
    });
    const reaberta = await detalheDaConta(
      gerente.funcionario.restauranteId,
      r.comandaId,
    );
    expect(reaberta.status).toBe("aberta");
    expect(reaberta.pagamentos).toHaveLength(0);
    expect(reaberta.reabertaMotivo).toBe("Fechou a mesa errada");
    const mapa = await listarMapa(gerente.funcionario.restauranteId);
    expect(
      mapa
        .find((x) => x.id === m.id)
        ?.comandas.some((c) => c.id === r.comandaId),
    ).toBe(true);

    await expect(
      reabrirConta(gerente, r.comandaId, { motivo: "de novo" }),
    ).rejects.toMatchObject({ codigo: "conta_aberta" });
  });
});
