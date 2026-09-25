import { eq, sql } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";

import { db, schema } from "@/db";
import type { Sessao } from "@/lib/auth/sessao";
import {
  aceitarAjuda,
  listarAjudas,
  oferecerAjuda,
  pedirAjuda,
} from "@/lib/dominio/ajuda";
import {
  atenderChamado,
  chamarPeloQr,
  concluirChamado,
  listarChamados,
  manutencaoChamados,
  statusPublico,
} from "@/lib/dominio/chamados";
import { resumoNoite } from "@/lib/dominio/gerencia";
import { dividirGorjeta } from "@/lib/dominio/gorjeta";
import { detalharMesa, fecharComanda, listarMapa } from "@/lib/dominio/mesas";
import { lancarRodada } from "@/lib/dominio/rodadas";
import { calcularTaxa } from "@/lib/dominio/taxa";
import { chave, mesa, produto, sessaoDe } from "./helpers";

let garcomA: Sessao;
let garcomB: Sessao;
let gerente: Sessao;

beforeAll(async () => {
  garcomA = await sessaoDe("Garçom A");
  garcomB = await sessaoDe("Garçom B");
  gerente = await sessaoDe("Gerente");
});

const lancar = async (
  sessao: Sessao,
  numeroMesa: number,
  nome: string,
  quantidade = 1,
) => {
  const m = await mesa(numeroMesa);
  const p = await produto(nome);
  return lancarRodada(sessao, m.id, {
    idempotencyKey: chave(),
    itens: [{ produtoId: p.id, quantidade, modificadorIds: [] }],
  });
};

describe("divisão da gorjeta", () => {
  it("é proporcional ao valor lançado e fecha exatamente no centavo", () => {
    const partes = dividirGorjeta(
      1000,
      [
        { funcionarioId: "a", baseCentavos: 2000 },
        { funcionarioId: "b", baseCentavos: 1000 },
      ],
      "a",
    );
    expect(partes.find((p) => p.funcionarioId === "a")?.valorCentavos).toBe(
      667,
    );
    expect(partes.find((p) => p.funcionarioId === "b")?.valorCentavos).toBe(
      333,
    );
    expect(partes.reduce((s, p) => s + p.valorCentavos, 0)).toBe(1000);
  });

  it("três garçons com divisão que não bate redondo continuam somando o total", () => {
    const partes = dividirGorjeta(
      1001,
      [
        { funcionarioId: "a", baseCentavos: 1 },
        { funcionarioId: "b", baseCentavos: 1 },
        { funcionarioId: "c", baseCentavos: 1 },
      ],
      "a",
    );
    expect(partes.reduce((s, p) => s + p.valorCentavos, 0)).toBe(1001);
    expect(partes.map((p) => p.valorCentavos).sort()).toEqual([333, 334, 334]);
  });

  it("se ninguém lançou nada, tudo vai para o titular", () => {
    const partes = dividirGorjeta(
      500,
      [{ funcionarioId: "b", baseCentavos: 0 }],
      "a",
    );
    expect(partes.find((p) => p.funcionarioId === "a")?.valorCentavos).toBe(
      500,
    );
  });
});

describe("auxílio entre garçons", () => {
  it("quem aceita o pedido de ajuda vira auxiliar e entra na divisão da gorjeta", async () => {
    await lancar(garcomA, 1, "Xis Bah Tchê! - Bacon", 2); // 99,80 do A
    const m1 = await mesa(1);
    const { id } = await pedirAjuda(garcomA, m1.id);
    await aceitarAjuda(garcomB, id);
    await lancar(garcomB, 1, "Xis Buenas - Clássico"); // 39,90 do B

    const detalhe = await detalharMesa(
      garcomA.funcionario.restauranteId,
      m1.id,
    );
    expect(
      detalhe.comanda?.equipe.map((e) => [e.nome, e.papel, e.baseCentavos]),
    ).toEqual([
      ["Garçom A", "titular", 9980],
      ["Garçom B", "auxiliar", 3990],
    ]);

    const { divisao } = await fecharComanda(garcomA, m1.id, {
      gorjetaCentavos: 1397,
    });
    // 1397 * 99,80/139,70 = 998 ; 1397 * 39,90/139,70 = 399
    expect(
      divisao.find((d) => d.funcionarioId === garcomA.funcionario.id)
        ?.valorCentavos,
    ).toBe(998);
    expect(
      divisao.find((d) => d.funcionarioId === garcomB.funcionario.id)
        ?.valorCentavos,
    ).toBe(399);

    const noite = await resumoNoite(garcomA.funcionario.restauranteId);
    expect(noite.totalGorjetaCentavos).toBe(1397);
    expect(
      noite.garcons.find((g) => g.nome === "Garçom B")?.gorjetaCentavos,
    ).toBe(399);
  });

  it("garçom pode se oferecer: entra como auxiliar e o titular é avisado", async () => {
    await lancar(garcomA, 2, "Água sem Gás");
    const m2 = await mesa(2);
    await oferecerAjuda(garcomB, m2.id);
    await expect(oferecerAjuda(garcomB, m2.id)).rejects.toMatchObject({
      codigo: "ja_auxiliar",
    });
    await expect(oferecerAjuda(garcomA, m2.id)).rejects.toMatchObject({
      codigo: "ja_titular",
    });

    const avisos = await listarAjudas(garcomA.funcionario.restauranteId);
    const aviso = avisos.find((a) => a.mesaId === m2.id);
    expect(aviso).toMatchObject({
      espontaneo: true,
      aceitoPor: "Garçom B",
      solicitanteId: garcomA.funcionario.id,
    });
  });
});

describe("chamados do cliente pelo QR", () => {
  it("apertar várias vezes cria um chamado só; a mesa fica âmbar no mapa", async () => {
    const m5 = await mesa(5);
    expect(await chamarPeloQr(m5.tokenQr, "garcom")).toEqual({
      jaExistia: false,
    });
    expect(await chamarPeloQr(m5.tokenQr, "garcom")).toEqual({
      jaExistia: true,
    });
    const mapa = await listarMapa(garcomA.funcionario.restauranteId);
    expect(mapa.find((x) => x.numero === 5)?.status).toBe("chamado");
    expect(await statusPublico(m5.tokenQr)).toMatchObject({
      mesa: 5,
      chamados: [{ tipo: "garcom", aceito: false }],
    });
  });

  it("pedido de conta tem prioridade de cor (vermelho) sobre chamar garçom", async () => {
    const m5 = await mesa(5);
    await lancar(garcomA, 5, "Pudim");
    await chamarPeloQr(m5.tokenQr, "conta");
    const mapa = await listarMapa(garcomA.funcionario.restauranteId);
    expect(mapa.find((x) => x.numero === 5)?.status).toBe("conta");
  });

  it("token inválido não abre chamado de mesa nenhuma", async () => {
    await expect(chamarPeloQr("0".repeat(32), "garcom")).rejects.toMatchObject({
      status: 404,
    });
  });

  it("dois garçons atendendo ao mesmo tempo: só um leva", async () => {
    const m6 = await mesa(6);
    await chamarPeloQr(m6.tokenQr, "garcom");
    const [chamado] = (
      await listarChamados(garcomA.funcionario.restauranteId)
    ).filter((c) => c.mesaNumero === 6);
    const r = await Promise.allSettled([
      atenderChamado(garcomA, chamado.id),
      atenderChamado(garcomB, chamado.id),
    ]);
    expect(r.filter((x) => x.status === "fulfilled")).toHaveLength(1);
    const status = await statusPublico(m6.tokenQr);
    expect(status.chamados[0].aceito).toBe(true);
  });

  it("só quem atendeu (ou o gerente) conclui", async () => {
    const m7 = await mesa(7);
    await chamarPeloQr(m7.tokenQr, "garcom");
    const [chamado] = (
      await listarChamados(garcomA.funcionario.restauranteId)
    ).filter((c) => c.mesaNumero === 7);
    await atenderChamado(garcomA, chamado.id);
    await expect(concluirChamado(garcomB, chamado.id)).rejects.toMatchObject({
      status: 403,
    });
    await concluirChamado(garcomA, chamado.id);
    const mapa = await listarMapa(garcomA.funcionario.restauranteId);
    expect(mapa.find((x) => x.numero === 7)?.status).toBe("livre");
  });

  it("sem atendimento no prazo, é escalado para o gerente", async () => {
    const m8 = await mesa(8);
    await chamarPeloQr(m8.tokenQr, "garcom");
    await db().execute(
      sql`update chamado set criado_em = now() - interval '10 minutes' where mesa_id = ${m8.id}`,
    );
    await manutencaoChamados(180);
    const [chamado] = (
      await listarChamados(gerente.funcionario.restauranteId)
    ).filter((c) => c.mesaNumero === 8);
    expect(chamado.escalado).toBe(true);
  });

  it("fechar a mesa encerra o pedido de conta e libera a cor", async () => {
    await lancar(garcomA, 9, "Pudim");
    const m9 = await mesa(9);
    await chamarPeloQr(m9.tokenQr, "conta");
    await fecharComanda(garcomA, m9.id);
    const [aberto] = await db()
      .select()
      .from(schema.chamados)
      .where(eq(schema.chamados.mesaId, m9.id));
    expect(aberto.encerradoEm).not.toBeNull();
    const mapa = await listarMapa(garcomA.funcionario.restauranteId);
    expect(mapa.find((x) => x.numero === 9)?.status).toBe("livre");
  });
});

describe("taxa de serviço e pagamento", () => {
  it("10% até o limite e 5% acima dele", () => {
    const config = { pct: 10, pctReduzida: 5, limiteCentavos: 30000 };
    expect(calcularTaxa(30000, config)).toEqual({
      pct: 10,
      valorCentavos: 3000,
    });
    expect(calcularTaxa(30001, config)).toEqual({
      pct: 5,
      valorCentavos: 1500,
    });
  });

  it("pedir a conta sem nada lançado é recusado", async () => {
    const m12 = await mesa(12);
    await expect(chamarPeloQr(m12.tokenQr, "conta")).rejects.toMatchObject({
      status: 409,
    });
  });

  it("conta vai para a equipe da mesa com a escolha do cliente; taxa e gorjeta são divididas separadamente", async () => {
    await lancar(garcomA, 10, "Xis Bah Tchê! - Bacon", 2); // 99,80 do A
    const m10 = await mesa(10);
    await oferecerAjuda(garcomB, m10.id);
    await lancar(garcomB, 10, "Xis Buenas - Clássico"); // 39,90 do B

    await chamarPeloQr(m10.tokenQr, "conta", {
      taxaServico: true,
      gorjetaCentavos: 1000,
    });
    const doMapa = async () =>
      (await listarChamados(garcomA.funcionario.restauranteId)).find(
        (c) => c.mesaNumero === 10 && c.tipo === "conta",
      );
    const chamado = await doMapa();
    expect(chamado?.garconsDaMesa.sort()).toEqual(
      [garcomA.funcionario.id, garcomB.funcionario.id].sort(),
    );
    expect(chamado?.conta).toEqual({
      subtotalCentavos: 13970,
      taxaServico: true,
      taxaPct: 10,
      taxaCentavos: 1397,
      gorjetaCentavos: 1000,
      totalCentavos: 16367,
    });

    // Cliente muda de ideia antes de pagar: o pedido aberto é atualizado.
    await chamarPeloQr(m10.tokenQr, "conta", {
      taxaServico: false,
      gorjetaCentavos: 1000,
    });
    expect((await doMapa())?.conta?.taxaCentavos).toBe(0);
    const detalhe = await detalharMesa(
      garcomA.funcionario.restauranteId,
      m10.id,
    );
    expect(detalhe.comanda?.pedidoConta).toEqual({
      taxaServico: false,
      gorjetaCentavos: 1000,
    });
    expect(detalhe.comanda?.taxa).toEqual({ pct: 10, valorCentavos: 1397 });

    // No fim pagou a taxa: o garçom corrige ao receber.
    const taxaDoB = async () => {
      const r = await resumoNoite(garcomA.funcionario.restauranteId);
      return {
        total: r.totalTaxaCentavos,
        b: r.garcons.find((g) => g.nome === "Garçom B")?.taxaCentavos ?? 0,
      };
    };
    const antes = await taxaDoB();
    const pago = await fecharComanda(garcomA, m10.id, {
      taxaServico: true,
      gorjetaCentavos: 1000,
    });
    expect(pago.taxaCentavos).toBe(1397);
    expect(pago.totalCentavos).toBe(16367);
    const valor = (
      lista: { funcionarioId: string; valorCentavos: number }[],
      s: Sessao,
    ) => lista.find((d) => d.funcionarioId === s.funcionario.id)?.valorCentavos;
    expect(valor(pago.divisaoTaxa, garcomA)).toBe(998);
    expect(valor(pago.divisaoTaxa, garcomB)).toBe(399);
    expect(valor(pago.divisao, garcomA)).toBe(714);
    expect(valor(pago.divisao, garcomB)).toBe(286);

    // Outras mesas deste arquivo também cobraram taxa: compara a diferença.
    const depois = await taxaDoB();
    expect(depois.total - antes.total).toBe(1397);
    expect(depois.b - antes.b).toBe(399);
  });

  it("acima do limite a taxa cai para 5%; sem taxa, nada é repassado", async () => {
    await lancar(garcomA, 11, "Xis Bah Tchê! - Bacon", 10); // 499,00
    const m11 = await mesa(11);
    const detalhe = await detalharMesa(
      garcomA.funcionario.restauranteId,
      m11.id,
    );
    expect(detalhe.comanda?.taxa).toEqual({ pct: 5, valorCentavos: 2495 });
    const pago = await fecharComanda(garcomA, m11.id, { taxaServico: false });
    expect(pago.taxaCentavos).toBe(0);
    expect(pago.divisaoTaxa).toEqual([]);
  });
});
