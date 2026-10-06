import { beforeAll, describe, expect, it } from "vitest";

import type { Sessao } from "@/lib/auth/sessao";
import {
  abrirTurno,
  fecharTurno,
  registrarMovimento,
  turnoAtual,
} from "@/lib/dominio/turno-caixa";
import {
  chave,
  fecharNaMesa,
  lancarNaMesa,
  mesa,
  produto,
  sessaoDe,
} from "./helpers";

let caixa: Sessao;
let garcom: Sessao;

beforeAll(async () => {
  caixa = await sessaoDe("Caixa");
  garcom = await sessaoDe("Garçom A");
});

describe("turno do caixa", () => {
  it("esperado = fundo + dinheiro recebido + suprimento − sangria", async () => {
    await abrirTurno(caixa, { fundoCentavos: 20_000 });
    await expect(abrirTurno(caixa, { fundoCentavos: 0 })).rejects.toMatchObject(
      { codigo: "caixa_ja_aberto" },
    );

    // Conta de R$ 25,00 paga em dinheiro com nota de 50 (troco 25).
    const m = await mesa(19);
    const p = await produto("Batata Frita");
    await lancarNaMesa(garcom, m.id, {
      idempotencyKey: chave(),
      itens: [{ produtoId: p.id, quantidade: 1, modificadorIds: [] }],
    });
    const conta = await fecharNaMesa(caixa, m.id, {
      taxaServico: false,
      semTaxaMotivo: "cliente_recusou",
      pagamentos: [
        {
          metodo: "dinheiro",
          valorCentavos: p.precoCentavos,
          recebidoCentavos: p.precoCentavos + 1_000,
        },
      ],
    });
    expect(conta.totalCentavos).toBe(p.precoCentavos);

    await registrarMovimento(caixa, {
      tipo: "suprimento",
      valorCentavos: 5_000,
      motivo: "Troco",
    });
    await registrarMovimento(caixa, {
      tipo: "sangria",
      valorCentavos: 10_000,
      motivo: "Cofre",
    });
    await expect(
      registrarMovimento(caixa, {
        tipo: "sangria",
        valorCentavos: 999_999,
        motivo: "Demais",
      }),
    ).rejects.toMatchObject({ codigo: "sangria_maior" });

    const { turno } = await turnoAtual(caixa.funcionario.restauranteId);
    // O troco devolvido não fica na gaveta: entra só o valor da conta.
    expect(turno?.dinheiroCentavos).toBe(p.precoCentavos);
    expect(turno?.trocoCentavos).toBe(1_000);
    expect(turno?.esperadoCentavos).toBe(
      20_000 + p.precoCentavos + 5_000 - 10_000,
    );

    const fechado = await fecharTurno(caixa, {
      contadoCentavos: (turno?.esperadoCentavos ?? 0) - 300,
    });
    expect((fechado.contadoCentavos ?? 0) - fechado.esperadoCentavos).toBe(
      -300,
    );
    expect(
      (await turnoAtual(caixa.funcionario.restauranteId)).turno,
    ).toBeNull();
  });
});
