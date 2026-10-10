import { beforeAll, describe, expect, it } from "vitest";

import type { Sessao } from "@/lib/auth/sessao";
import { abrirComanda, detalharComanda } from "@/lib/dominio/mesas";
import { moverItens } from "@/lib/dominio/mover-itens";
import { lancarRodada } from "@/lib/dominio/rodadas";
import { chave, mesa, produto, sessaoDe } from "./helpers";

let garcom: Sessao;

beforeAll(async () => {
  garcom = await sessaoDe("Garçom A");
});

describe("passar itens para outro cartão", () => {
  it("move o item para um cartão novo na mesma mesa, sem mexer no total", async () => {
    const m = await mesa(17);
    const { comandaId: origemId } = await abrirComanda(garcom, {
      mesaId: m.id,
      numero: 41,
    });
    const batata = await produto("Batata Frita");
    const xis = await produto("Xis Bagual - O Bruto da Casa");
    await lancarRodada(garcom, origemId, {
      idempotencyKey: chave(),
      itens: [
        { produtoId: batata.id, quantidade: 1, modificadorIds: [] },
        { produtoId: xis.id, quantidade: 1, modificadorIds: [] },
      ],
    });
    const antes = await detalharComanda(
      garcom.funcionario.restauranteId,
      origemId,
    );
    const itemXis = antes.comanda.rodadas[0].itens.find(
      (i) => i.produtoId === xis.id,
    );
    if (!itemXis) throw new Error("item não lançado");

    const r = await moverItens(garcom, origemId, {
      itemIds: [itemXis.id],
      numeroCartao: 42,
    });
    expect(r.abriuAgora).toBe(true);
    expect(r.movidos).toBe(1);

    const origem = await detalharComanda(
      garcom.funcionario.restauranteId,
      origemId,
    );
    const destino = await detalharComanda(
      garcom.funcionario.restauranteId,
      r.comandaId,
    );
    expect(origem.comanda.totalCentavos + destino.comanda.totalCentavos).toBe(
      antes.comanda.totalCentavos,
    );
    expect(destino.comanda.totalCentavos).toBe(itemXis.totalCentavos);
    expect(destino.mesa.id).toBe(m.id);
  });
});
