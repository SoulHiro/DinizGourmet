import { and, eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";

import { db, schema } from "@/db";
import type { Sessao } from "@/lib/auth/sessao";
import {
  detalheDaConta,
  imprimirConta,
  listarHistorico,
  resumoCaixa,
} from "@/lib/dominio/caixa";
import { cancelarItem } from "@/lib/dominio/cancelamento";
import { conferirPagamentos } from "@/lib/dominio/pagamento";
import { montarLinhas, renderizarTexto } from "@/lib/impressao/ticket";
import {
  chave,
  comandaAbertaNa,
  fecharNaMesa,
  lancarNaMesa,
  mesa,
  produto,
  sessaoDe,
} from "./helpers";

let garcomA: Sessao;
let caixa: Sessao;
let restauranteId: string;

beforeAll(async () => {
  garcomA = await sessaoDe("Garçom A");
  caixa = await sessaoDe("Caixa");
  restauranteId = garcomA.funcionario.restauranteId;
});

const lancar = async (numeroMesa: number, nome: string, quantidade = 1) => {
  const m = await mesa(numeroMesa);
  const p = await produto(nome);
  return lancarNaMesa(garcomA, m.id, {
    idempotencyKey: chave(),
    itens: [{ produtoId: p.id, quantidade, modificadorIds: [] }],
  });
};

const textoDoTrabalho = async (trabalhoId: string) => {
  const [t] = await db()
    .select()
    .from(schema.trabalhosImpressao)
    .where(eq(schema.trabalhosImpressao.id, trabalhoId));
  return renderizarTexto(montarLinhas("conta", "caixa", t.payload), 48);
};

describe("pagamento", () => {
  it("confere falta, troco e dinheiro menor que o valor", () => {
    expect(
      conferirPagamentos(
        [
          { metodo: "dinheiro", valorCentavos: 5000, recebidoCentavos: 10000 },
          { metodo: "credito", valorCentavos: 3000 },
        ],
        8000,
      ),
    ).toMatchObject({ faltaCentavos: 0, trocoCentavos: 5000, fecha: true });
    expect(
      conferirPagamentos([{ metodo: "pix", valorCentavos: 1000 }], 8000),
    ).toMatchObject({ faltaCentavos: 7000, fecha: false });
    expect(
      conferirPagamentos(
        [{ metodo: "dinheiro", valorCentavos: 5000, recebidoCentavos: 2000 }],
        5000,
      ).fecha,
    ).toBe(false);
  });

  it("conta dividida entre dinheiro e cartão, com troco", async () => {
    await lancar(1, "Xis Buenas - Clássico", 2); // 79,80
    const m1 = await mesa(1);
    const r = await fecharNaMesa(caixa, m1.id, {
      taxaServico: true, // 10% = 7,98 -> total 87,78
      pagamentos: [
        { metodo: "dinheiro", valorCentavos: 5000, recebidoCentavos: 10000 },
        { metodo: "debito", valorCentavos: 3778 },
      ],
    });
    expect(r.totalCentavos).toBe(8778);
    expect(r.trocoCentavos).toBe(5000);
    const pagos = await db()
      .select()
      .from(schema.pagamentos)
      .where(eq(schema.pagamentos.comandaId, r.comandaId));
    expect(
      pagos.map((p) => [p.metodo, p.valorCentavos, p.trocoCentavos]),
    ).toEqual(
      expect.arrayContaining([
        ["dinheiro", 5000, 5000],
        ["debito", 3778, 0],
      ]),
    );
  });

  it("pagamento que não fecha com o total é recusado e a mesa continua aberta", async () => {
    await lancar(2, "Xis Buenas - Clássico"); // 39,90 + 3,99
    const m2 = await mesa(2);
    await expect(
      fecharNaMesa(caixa, m2.id, {
        pagamentos: [{ metodo: "pix", valorCentavos: 3990 }],
      }),
    ).rejects.toMatchObject({ codigo: "pagamento_nao_fecha" });
    await expect(
      fecharNaMesa(caixa, m2.id, {
        pagamentos: [
          { metodo: "dinheiro", valorCentavos: 4389, recebidoCentavos: 2000 },
        ],
      }),
    ).rejects.toMatchObject({ codigo: "invalido" });
    const [aberta] = await db()
      .select()
      .from(schema.comandas)
      .where(
        and(
          eq(schema.comandas.mesaPrincipalId, m2.id),
          eq(schema.comandas.status, "aberta"),
        ),
      );
    expect(aberta).toBeDefined();
    await fecharNaMesa(caixa, m2.id, {
      pagamentos: [{ metodo: "pix", valorCentavos: 4389 }],
    });
  });
});

describe("conta impressa", () => {
  const impressoraCaixa = (ativa: boolean) =>
    db()
      .update(schema.impressoras)
      .set({ ativa })
      .where(eq(schema.impressoras.setor, "caixa"));

  it("sem impressora do caixa, avisa o que fazer", async () => {
    await impressoraCaixa(false);
    await lancar(3, "Xis Bagual - O Bruto da Casa");
    await expect(
      imprimirConta(garcomA, {
        comandaId: await comandaAbertaNa((await mesa(3)).id),
      }),
    ).rejects.toMatchObject({ codigo: "sem_impressora_caixa" });
  });

  it("pré-conta mostra a taxa como opcional; o comprovante mostra o troco", async () => {
    await impressoraCaixa(true);
    const m3 = await mesa(3);
    const pre = await imprimirConta(garcomA, {
      comandaId: await comandaAbertaNa(m3.id),
    });
    const textoPre = await textoDoTrabalho(pre.trabalhoId);
    expect(textoPre).toContain("CONFERENCIA DE CONTA");
    expect(textoPre).toContain("MESA 3");
    expect(textoPre).toMatch(/1x Xis Bagual - O Bruto da Casa\s+R\$ 59,90/);
    expect(textoPre).toMatch(/TOTAL COM TAXA\s+R\$ 65,89/);
    expect(textoPre).toMatch(/Total sem taxa\s+R\$ 59,90/);
    expect(textoPre).toContain("Nao e documento fiscal");

    const r = await fecharNaMesa(caixa, m3.id, {
      taxaServico: true,
      pagamentos: [
        { metodo: "dinheiro", valorCentavos: 6589, recebidoCentavos: 7000 },
      ],
    });
    const comprovante = await imprimirConta(caixa, { comandaId: r.comandaId });
    const texto = await textoDoTrabalho(comprovante.trabalhoId);
    expect(texto).toContain("COMPROVANTE DE PAGAMENTO");
    expect(texto).toMatch(/Recebido\s+R\$ 70,00/);
    expect(texto).toMatch(/Troco\s+R\$ 4,11/);
  });
});

describe("histórico e resumo do caixa", () => {
  it("acha a conta pelo dia, horário e mesa, com tudo o que aconteceu", async () => {
    const r = await lancar(4, "Xis Buenas - Clássico", 2);
    const [item] = await db()
      .select()
      .from(schema.itensPedido)
      .where(eq(schema.itensPedido.rodadaId, r.rodadaId));
    await lancar(4, "Xis Tri Bom - Frango");
    await cancelarItem(garcomA, item.id, {
      motivo: "Cliente desistiu",
      preparoIniciado: false,
    });
    const m4 = await mesa(4);
    const fechada = await fecharNaMesa(caixa, m4.id, {
      taxaServico: false,
      semTaxaMotivo: "demora_preparo",
      pagamentos: [{ metodo: "credito", valorCentavos: 4490 }],
    });

    const hoje = new Date().toLocaleDateString("sv-SE", {
      timeZone: "America/Sao_Paulo",
    });
    const daMesa = await listarHistorico(restauranteId, {
      data: hoje,
      mesa: 4,
    });
    expect(daMesa.map((c) => c.comandaId)).toEqual([fechada.comandaId]);
    expect(daMesa[0]).toMatchObject({
      mesas: [4],
      status: "fechada",
      titular: "Garçom A",
      recebidoPor: "Caixa",
      totalCentavos: 4490,
      metodos: ["credito"],
    });
    // Horário que não bate (madrugada) não traz a conta.
    const agora = new Date().toLocaleTimeString("pt-BR", {
      timeZone: "America/Sao_Paulo",
      hour: "2-digit",
      minute: "2-digit",
    });
    if (agora >= "00:02") {
      expect(
        await listarHistorico(restauranteId, {
          data: hoje,
          de: "00:00",
          ate: "00:01",
          mesa: 4,
        }),
      ).toEqual([]);
    }

    const detalhe = await detalheDaConta(restauranteId, fechada.comandaId);
    const itens = detalhe.rodadas.flatMap((rd) => rd.itens);
    expect(itens.find((i) => i.status === "cancelado")).toMatchObject({
      nome: "Xis Buenas - Clássico",
      canceladoPor: "Garçom A",
      motivo: "Cliente desistiu",
    });
    expect(detalhe.semTaxaMotivo).toBe("demora_preparo");
    expect(detalhe.pagamentos).toEqual([
      expect.objectContaining({
        metodo: "credito",
        valorCentavos: 4490,
        recebidoPor: "Caixa",
      }),
    ]);
  });

  it("resumo soma por método e calcula o dinheiro da gaveta", async () => {
    const resumo = await resumoCaixa(restauranteId);
    const metodo = (m: string) =>
      resumo.porMetodo.find((p) => p.metodo === m)?.valorCentavos ?? 0;
    expect(metodo("dinheiro")).toBe(5000 + 6589);
    expect(metodo("debito")).toBe(3778);
    expect(metodo("pix")).toBe(4389);
    expect(metodo("credito")).toBe(4490);
    expect(resumo.dinheiroNaGavetaCentavos).toBe(5000 + 6589);
    expect(resumo.recebidoCentavos).toBe(resumo.totalCentavos);
    expect(resumo.contas).toBe(4);
  });
});
