import { and, eq, isNull } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";

import { db, schema } from "@/db";
import type { Sessao } from "@/lib/auth/sessao";
import { contaPublica } from "@/lib/dominio/cardapio-publico";
import {
  criarCartoes,
  editarCartao,
  listarCartoes,
} from "@/lib/dominio/cartoes";
import {
  chamarPeloQr,
  listarChamados,
  statusPublico,
} from "@/lib/dominio/chamados";
import { destinoDoCartao } from "@/lib/dominio/cliente";
import {
  abrirComanda,
  fecharComanda,
  transferirComanda,
} from "@/lib/dominio/mesas";
import { lancarRodada } from "@/lib/dominio/rodadas";
import { chave, mesa, produto, sessaoDe } from "./helpers";

let garcomA: Sessao;
let garcomB: Sessao;
let restauranteId: string;

beforeAll(async () => {
  garcomA = await sessaoDe("Garçom A");
  garcomB = await sessaoDe("Garçom B");
  restauranteId = garcomA.funcionario.restauranteId;
});

const abrirComAgua = async (
  sessao: Sessao,
  numeroMesa: number,
  cartao: number,
  aguas = 1,
) => {
  const m = await mesa(numeroMesa);
  const { comandaId } = await abrirComanda(sessao, {
    mesaId: m.id,
    numero: cartao,
  });
  const agua = await produto("Água sem Gás");
  await lancarRodada(sessao, comandaId, {
    idempotencyKey: chave(),
    itens: [{ produtoId: agua.id, quantidade: aguas, modificadorIds: [] }],
  });
  return { comandaId, mesa: m };
};

const tokenDoCartao = async (numero: number) => {
  const [c] = await db()
    .select({ token: schema.cartoesComanda.tokenQr })
    .from(schema.cartoesComanda)
    .where(eq(schema.cartoesComanda.numero, numero));
  return c.token;
};

describe("QR do cliente com cartões", () => {
  it("mesa com uma comanda só: o QR da mesa mostra a conta, como antes", async () => {
    const { mesa: m } = await abrirComAgua(garcomA, 1, 1, 2);
    const conta = await contaPublica(m.tokenQr);
    expect(conta).toMatchObject({
      aberta: true,
      comanda: 1,
      precisaCartao: false,
      totalCentavos: 1000,
    });
  });

  it("mesa com várias comandas: pede o cartão e só mostra a conta dele", async () => {
    const a = await abrirComAgua(garcomA, 2, 2, 1);
    await abrirComAgua(garcomB, 2, 3, 3);
    const token = a.mesa.tokenQr;

    expect(await contaPublica(token)).toMatchObject({
      aberta: false,
      precisaCartao: true,
    });
    expect(await contaPublica(token, { numero: 3 })).toMatchObject({
      comanda: 3,
      totalCentavos: 1500,
    });
    // Cartão de outra mesa (ou inexistente) não mostra conta nenhuma.
    await expect(contaPublica(token, { numero: 1 })).rejects.toMatchObject({
      status: 404,
    });

    // Pedir a conta sem dizer o cartão: pede o número.
    await expect(chamarPeloQr(token, "conta")).rejects.toMatchObject({
      codigo: "informe_cartao",
    });
    // Com o cartão: o pedido de conta é daquela comanda, para o garçom dela.
    await chamarPeloQr(
      token,
      "conta",
      { taxaServico: true, gorjetaCentavos: 0 },
      { numero: 3 },
    );
    const [pedido] = (await listarChamados(restauranteId)).filter(
      (c) => c.tipo === "conta" && c.mesaNumero === 2,
    );
    expect(pedido).toMatchObject({
      comandaNumero: 3,
      garconsDaMesa: [garcomB.funcionario.id],
      conta: { subtotalCentavos: 1500 },
    });
    // O status público do cartão 2 não vê o pedido de conta do cartão 3.
    const status2 = await statusPublico(token, { numero: 2 });
    expect(status2.chamados.filter((c) => c.tipo === "conta")).toEqual([]);
    const status3 = await statusPublico(token, { numero: 3 });
    expect(status3.chamados.filter((c) => c.tipo === "conta")).toHaveLength(1);
  });

  it("QR do cartão leva à mesa onde a comanda está e identifica o cliente", async () => {
    const { comandaId, mesa: m } = await abrirComAgua(garcomA, 4, 4);
    const token = await tokenDoCartao(4);
    expect(await destinoDoCartao(token)).toEqual({
      numero: 4,
      mesaToken: m.tokenQr,
    });
    expect(await contaPublica(m.tokenQr, { cartao: token })).toMatchObject({
      comanda: 4,
    });

    // Cliente mudou de mesa: o QR do cartão acompanha.
    const m5 = await mesa(5);
    await transferirComanda(garcomA, comandaId, m5.id);
    expect((await destinoDoCartao(token)).mesaToken).toBe(m5.tokenQr);

    // Depois de pago, o cartão não aponta para mesa nenhuma.
    await fecharComanda(garcomA, comandaId);
    expect(await destinoDoCartao(token)).toEqual({
      numero: 4,
      mesaToken: null,
    });
  });

  it("pedido de conta acompanha a comanda quando ela troca de mesa", async () => {
    const { comandaId, mesa: m } = await abrirComAgua(garcomA, 6, 6);
    await chamarPeloQr(m.tokenQr, "conta");
    const m7 = await mesa(7);
    await transferirComanda(garcomA, comandaId, m7.id);
    const [pedido] = await db()
      .select()
      .from(schema.chamados)
      .where(
        and(
          eq(schema.chamados.comandaId, comandaId),
          isNull(schema.chamados.encerradoEm),
        ),
      );
    expect(pedido.mesaId).toBe(m7.id);
  });

  it("chamar garçom é da mesa: só encerra quando a última comanda é paga", async () => {
    const a = await abrirComAgua(garcomA, 8, 8);
    const b = await abrirComAgua(garcomA, 8, 9);
    await chamarPeloQr(a.mesa.tokenQr, "garcom");
    const abertos = async () =>
      (await listarChamados(restauranteId)).filter(
        (c) => c.tipo === "garcom" && c.mesaNumero === 8,
      );

    await fecharComanda(garcomA, a.comandaId);
    expect(await abertos()).toHaveLength(1);
    await fecharComanda(garcomA, b.comandaId);
    expect(await abertos()).toHaveLength(0);
  });
});

describe("cartões", () => {
  it("cartão desativado (perdido) não abre comanda; reativado volta", async () => {
    const [cartao] = (await listarCartoes(restauranteId)).filter(
      (c) => c.numero === 10,
    );
    await editarCartao(restauranteId, cartao.id, false);
    const m = await mesa(10);
    await expect(
      abrirComanda(garcomA, { mesaId: m.id, numero: 10 }),
    ).rejects.toMatchObject({ status: 404 });
    await editarCartao(restauranteId, cartao.id, true);
    await expect(
      abrirComanda(garcomA, { mesaId: m.id, numero: 10 }),
    ).resolves.toMatchObject({ numero: 10 });
  });

  it("criar até N só cria os que faltam e mostra quais estão em uso", async () => {
    expect(await criarCartoes(restauranteId, 55)).toEqual({ criados: 5 });
    expect(await criarCartoes(restauranteId, 55)).toEqual({ criados: 0 });
    const cartoes = await listarCartoes(restauranteId);
    expect(cartoes).toHaveLength(55);
    expect(cartoes.find((c) => c.numero === 10)?.emUsoNaMesa).toBe(10);
    expect(cartoes.find((c) => c.numero === 11)?.emUsoNaMesa).toBeNull();
  });
});
