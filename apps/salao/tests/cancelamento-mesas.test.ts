import { and, eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";

import { db, schema } from "@/db";
import type { Sessao } from "@/lib/auth/sessao";
import { cancelarItem } from "@/lib/dominio/cancelamento";
import {
  abrirComanda,
  comandaPorNumero,
  detalharComanda,
  detalharMesa,
  fecharComanda,
  listarMapa,
  transferirComanda,
} from "@/lib/dominio/mesas";
import { lancarRodada } from "@/lib/dominio/rodadas";
import type { ErroDominio } from "@/lib/erros";
import {
  chave,
  definirEstoque,
  lancarNaMesa,
  mesa,
  produto,
  sessaoDe,
} from "./helpers";

let garcom: Sessao;
beforeAll(async () => {
  garcom = await sessaoDe("Garçom A");
});

const estoqueDe = async (produtoId: string) => {
  const [p] = await db()
    .select({ estoque: schema.produtos.estoque })
    .from(schema.produtos)
    .where(eq(schema.produtos.id, produtoId));
  return p.estoque;
};

const trabalhosDaRodada = (rodadaId: string) =>
  db()
    .select()
    .from(schema.trabalhosImpressao)
    .where(eq(schema.trabalhosImpressao.rodadaId, rodadaId));

const itemDaRodada = async (rodadaId: string, produtoId: string) => {
  const [item] = await db()
    .select()
    .from(schema.itensPedido)
    .where(
      and(
        eq(schema.itensPedido.rodadaId, rodadaId),
        eq(schema.itensPedido.produtoId, produtoId),
      ),
    );
  return item;
};

describe("cancelamento de item", () => {
  it("antes de imprimir: tira do ticket e devolve o estoque", async () => {
    const m = await mesa(1);
    const cerveja = await produto("Cerveja Long Neck");
    const agua = await produto("Água sem Gás");
    await definirEstoque(cerveja.id, 10);

    const r = await lancarNaMesa(garcom, m.id, {
      idempotencyKey: chave(),
      itens: [
        { produtoId: cerveja.id, quantidade: 2, modificadorIds: [] },
        { produtoId: agua.id, quantidade: 1, modificadorIds: [] },
      ],
    });
    expect(await estoqueDe(cerveja.id)).toBe(8);

    const item = await itemDaRodada(r.rodadaId, cerveja.id);
    const resultado = await cancelarItem(garcom, item.id, {
      motivo: "Lançado errado",
      preparoIniciado: false,
    });
    expect(resultado.devolveuEstoque).toBe(true);
    expect(await estoqueDe(cerveja.id)).toBe(10);

    const [cancelado] = await db()
      .select()
      .from(schema.itensPedido)
      .where(eq(schema.itensPedido.id, item.id));
    expect(cancelado.status).toBe("cancelado");
    expect(cancelado.canceladoPor).toBe(garcom.funcionario.id);
    expect(cancelado.motivoCancelamento).toBe("Lançado errado");

    // Cerveja e água vão para o bar: o ticket ficou só com a água.
    const trabalhos = await trabalhosDaRodada(r.rodadaId);
    expect(trabalhos).toHaveLength(1);
    expect(trabalhos[0].payload.itens.map((i) => i.nome)).toEqual([
      "Água sem Gás",
    ]);
  });

  it("cancelar o único item de um ticket pendente descarta o trabalho", async () => {
    const m = await mesa(2);
    const batata = await produto("Batata Frita");
    const r = await lancarNaMesa(garcom, m.id, {
      idempotencyKey: chave(),
      itens: [{ produtoId: batata.id, quantidade: 1, modificadorIds: [] }],
    });
    const item = await itemDaRodada(r.rodadaId, batata.id);
    await cancelarItem(garcom, item.id, {
      motivo: "Cliente desistiu",
      preparoIniciado: false,
    });
    const [trabalho] = await trabalhosDaRodada(r.rodadaId);
    expect(trabalho.status).toBe("descartado");
  });

  it("depois de impresso com preparo iniciado: aviso na cozinha e sem devolver estoque", async () => {
    const m = await mesa(3);
    const coracao = await produto("Xis Tri Bom - Frango");
    await definirEstoque(coracao.id, 5);
    const r = await lancarNaMesa(garcom, m.id, {
      idempotencyKey: chave(),
      itens: [{ produtoId: coracao.id, quantidade: 1, modificadorIds: [] }],
    });
    await db()
      .update(schema.trabalhosImpressao)
      .set({ status: "impresso", impressoEm: new Date() })
      .where(eq(schema.trabalhosImpressao.rodadaId, r.rodadaId));

    const item = await itemDaRodada(r.rodadaId, coracao.id);
    const resultado = await cancelarItem(garcom, item.id, {
      motivo: "Demora no preparo",
      preparoIniciado: true,
    });
    expect(resultado.devolveuEstoque).toBe(false);
    expect(await estoqueDe(coracao.id)).toBe(4);

    const trabalhos = await trabalhosDaRodada(r.rodadaId);
    const aviso = trabalhos.find((t) => t.tipo === "cancelamento");
    expect(aviso?.status).toBe("pendente");
    expect(aviso?.payload.itens[0].nome).toBe("Xis Tri Bom - Frango");
    expect(aviso?.payload.preparoIniciado).toBe(true);
  });

  it("não cancela duas vezes", async () => {
    const m = await mesa(4);
    const agua = await produto("Água sem Gás");
    const r = await lancarNaMesa(garcom, m.id, {
      idempotencyKey: chave(),
      itens: [{ produtoId: agua.id, quantidade: 1, modificadorIds: [] }],
    });
    const item = await itemDaRodada(r.rodadaId, agua.id);
    await cancelarItem(garcom, item.id, {
      motivo: "Outro motivo",
      preparoIniciado: false,
    });
    await expect(
      cancelarItem(garcom, item.id, {
        motivo: "Outro motivo",
        preparoIniciado: false,
      }),
    ).rejects.toMatchObject({ codigo: "ja_cancelado" });
  });
});

describe("comandas por cartão: status, várias por mesa, transferir, fechar", () => {
  const agua = () => produto("Água sem Gás");
  const lancarAgua = async (comandaId: string, quantidade = 1) =>
    lancarRodada(garcom, comandaId, {
      idempotencyKey: chave(),
      itens: [{ produtoId: (await agua()).id, quantidade, modificadorIds: [] }],
    });

  it("status derivado: livre, aguardando (comanda sem pedido) e ocupada", async () => {
    const m10 = await mesa(10);
    const { comandaId } = await abrirComanda(garcom, {
      mesaId: m10.id,
      numero: 40,
    });

    let mapa = await listarMapa(garcom.funcionario.restauranteId);
    const s10 = mapa.find((x) => x.numero === 10);
    expect(s10?.status).toBe("aguardando");
    expect(s10?.comandas).toEqual([{ id: comandaId, numero: 40 }]);
    expect(mapa.find((x) => x.numero === 11)?.status).toBe("livre");

    await lancarAgua(comandaId, 2);
    mapa = await listarMapa(garcom.funcionario.restauranteId);
    expect(mapa.find((x) => x.numero === 10)?.status).toBe("ocupada");
    expect(mapa.find((x) => x.numero === 10)?.totalCentavos).toBe(1000);
  });

  it("cinco casais na mesma mesa: cada cartão com a sua conta, pagando separado", async () => {
    const m12 = await mesa(12);
    const cartoes = [21, 22, 23, 24, 25];
    const comandas: string[] = [];
    for (const [i, numero] of cartoes.entries()) {
      const { comandaId } = await abrirComanda(garcom, {
        mesaId: m12.id,
        numero,
      });
      comandas.push(comandaId);
      // Casal i consome i+1 águas (R$ 5 cada).
      await lancarAgua(comandaId, i + 1);
    }

    const mapa = await listarMapa(garcom.funcionario.restauranteId);
    const s12 = mapa.find((x) => x.numero === 12);
    expect(s12?.comandas.map((c) => c.numero)).toEqual(cartoes);
    expect(s12?.totalCentavos).toBe(500 * (1 + 2 + 3 + 4 + 5));

    const tela = await detalharMesa(garcom.funcionario.restauranteId, m12.id);
    expect(tela.comandas.map((c) => [c.numero, c.totalCentavos])).toEqual([
      [21, 500],
      [22, 1000],
      [23, 1500],
      [24, 2000],
      [25, 2500],
    ]);

    // Cada comanda só vê o próprio consumo.
    const casal3 = await detalharComanda(
      garcom.funcionario.restauranteId,
      comandas[2],
    );
    expect(casal3.comanda.numero).toBe(23);
    expect(casal3.comanda.totalCentavos).toBe(1500);

    // O casal 23 paga e vai embora: a mesa continua ocupada pelos outros.
    const pago = await fecharComanda(garcom, comandas[2], {
      taxaServico: false,
      semTaxaMotivo: "cortesia",
    });
    expect(pago.totalCentavos).toBe(1500);
    let depois = await listarMapa(garcom.funcionario.restauranteId);
    expect(
      depois.find((x) => x.numero === 12)?.comandas.map((c) => c.numero),
    ).toEqual([21, 22, 24, 25]);
    expect(depois.find((x) => x.numero === 12)?.status).toBe("ocupada");

    // Os outros pagam: a mesa fica livre só no último.
    for (const id of [comandas[0], comandas[1], comandas[3], comandas[4]]) {
      await fecharComanda(garcom, id, {
        taxaServico: false,
        semTaxaMotivo: "cortesia",
      });
    }
    depois = await listarMapa(garcom.funcionario.restauranteId);
    expect(depois.find((x) => x.numero === 12)?.status).toBe("livre");
  });

  it("um cartão não abre duas comandas; depois de pago, volta a ser usado", async () => {
    const m13 = await mesa(13);
    const m14 = await mesa(14);
    const { comandaId } = await abrirComanda(garcom, {
      mesaId: m13.id,
      numero: 30,
    });
    await expect(
      abrirComanda(garcom, { mesaId: m14.id, numero: 30 }),
    ).rejects.toMatchObject({
      codigo: "cartao_em_uso",
      message: "O cartão 30 já está aberto na mesa 13.",
    } satisfies Partial<ErroDominio>);

    // Garçom e caixa acham a comanda pelo número (código de barras).
    expect(
      await comandaPorNumero(garcom.funcionario.restauranteId, 30),
    ).toMatchObject({ comandaId, mesaNumero: 13 });

    await fecharComanda(garcom, comandaId);
    await expect(
      abrirComanda(garcom, { mesaId: m14.id, numero: 30 }),
    ).resolves.toMatchObject({ numero: 30 });
  });

  it("cartão que não existe ou foi desativado não abre comanda", async () => {
    const m15 = await mesa(15);
    await expect(
      abrirComanda(garcom, { mesaId: m15.id, numero: 999 }),
    ).rejects.toMatchObject({ status: 404 });
  });

  it("transfere a comanda para outra mesa (mesmo ocupada), com os itens", async () => {
    const m16 = await mesa(16);
    const m17 = await mesa(17);
    const a = await abrirComanda(garcom, { mesaId: m16.id, numero: 31 });
    const b = await abrirComanda(garcom, { mesaId: m17.id, numero: 32 });
    await lancarAgua(a.comandaId);
    await lancarAgua(b.comandaId);

    await transferirComanda(garcom, a.comandaId, m17.id);
    const mapa = await listarMapa(garcom.funcionario.restauranteId);
    expect(mapa.find((x) => x.numero === 16)?.status).toBe("livre");
    expect(
      mapa.find((x) => x.numero === 17)?.comandas.map((c) => c.numero),
    ).toEqual([31, 32]);
    const detalhe = await detalharComanda(
      garcom.funcionario.restauranteId,
      a.comandaId,
    );
    expect(detalhe.mesa.numero).toBe(17);
    // O item continua marcado com a mesa em que foi pedido.
    expect(detalhe.comanda.rodadas[0].itens[0].mesaOrigem).toBe(16);
  });

  it("não lança em comanda já paga", async () => {
    const m18 = await mesa(18);
    const { comandaId } = await abrirComanda(garcom, {
      mesaId: m18.id,
      numero: 33,
    });
    await lancarAgua(comandaId);
    await fecharComanda(garcom, comandaId);
    await expect(lancarAgua(comandaId)).rejects.toMatchObject({
      codigo: "comanda_fechada",
    });
  });
});
