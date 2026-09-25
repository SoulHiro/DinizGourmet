import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";

import { db, schema } from "@/db";
import type { Sessao } from "@/lib/auth/sessao";
import { cancelarItem } from "@/lib/dominio/cancelamento";
import { listarCardapio } from "@/lib/dominio/cardapio";
import { editarItem } from "@/lib/dominio/edicao";
import { resumoNoite } from "@/lib/dominio/gerencia";
import {
  criarDesconto,
  criarInsumo,
  editarInsumo,
  listarInsumos,
  valorDoDesconto,
} from "@/lib/dominio/insumos";
import { fecharComanda, fecharMesaSchema } from "@/lib/dominio/mesas";
import { lancarRodada } from "@/lib/dominio/rodadas";
import { chave, mesa, modificador, produto, sessaoDe } from "./helpers";

let garcomA: Sessao;
let garcomB: Sessao;
let gerente: Sessao;
let restauranteId: string;

beforeAll(async () => {
  garcomA = await sessaoDe("Garçom A");
  garcomB = await sessaoDe("Garçom B");
  gerente = await sessaoDe("Gerente");
  restauranteId = garcomA.funcionario.restauranteId;
});

const insumo = async (nome: string) => {
  const [i] = await db()
    .select()
    .from(schema.insumos)
    .where(eq(schema.insumos.nome, nome));
  return i;
};
const contagem = (nome: string, estoque: number | null) =>
  db()
    .update(schema.insumos)
    .set({ estoque })
    .where(eq(schema.insumos.nome, nome));

const lancar = async (
  sessao: Sessao,
  numeroMesa: number,
  nome: string,
  quantidade = 1,
  modificadorIds: string[] = [],
) => {
  const m = await mesa(numeroMesa);
  const p = await produto(nome);
  return lancarRodada(sessao, m.id, {
    idempotencyKey: chave(),
    itens: [{ produtoId: p.id, quantidade, modificadorIds }],
  });
};

const itemDaRodada = async (rodadaId: string) => {
  const [item] = await db()
    .select()
    .from(schema.itensPedido)
    .where(eq(schema.itensPedido.rodadaId, rodadaId));
  return item;
};

const noCardapio = async (nome: string) =>
  (await listarCardapio(restauranteId))
    .flatMap((c) => c.produtos)
    .find((p) => p.nome === nome);

describe("estoque por insumo", () => {
  it("insumo sem contagem não bloqueia nada", async () => {
    await lancar(garcomA, 1, "Xis Bah Tchê! - Bacon", 3);
    expect((await insumo("Bacon")).estoque).toBeNull();
  });

  it("insumo base acabou: o lanche fica esgotado e o lançamento é recusado", async () => {
    await contagem("Calabresa", 2);
    await lancar(garcomA, 2, "Xis Gaudério - Calabresa", 2);
    expect((await insumo("Calabresa")).estoque).toBe(0);
    expect((await noCardapio("Xis Gaudério - Calabresa"))?.esgotado).toBe(true);
    // O Bagual também leva calabresa.
    expect((await noCardapio("Xis Bagual - O Bruto da Casa"))?.esgotado).toBe(
      true,
    );
    await expect(
      lancar(garcomA, 2, "Xis Gaudério - Calabresa"),
    ).rejects.toMatchObject({ codigo: "esgotado" });
    await contagem("Calabresa", null);
  });

  it("cancelar antes do preparo devolve o insumo; com preparo iniciado, não", async () => {
    await contagem("Frango desfiado", 5);
    const r = await lancar(garcomA, 3, "Xis Tri Bom - Frango", 2);
    const item = await itemDaRodada(r.rodadaId);
    expect((await insumo("Frango desfiado")).estoque).toBe(3);
    await cancelarItem(garcomA, item.id, {
      motivo: "Cliente desistiu",
      preparoIniciado: false,
    });
    expect((await insumo("Frango desfiado")).estoque).toBe(5);

    const r2 = await lancar(garcomA, 3, "Xis Tri Bom - Frango");
    await cancelarItem(garcomA, (await itemDaRodada(r2.rodadaId)).id, {
      motivo: "Caiu no chão",
      preparoIniciado: true,
    });
    expect((await insumo("Frango desfiado")).estoque).toBe(4);
    await contagem("Frango desfiado", null);
  });

  it("adicional sem insumo fica cinza, mas o lanche continua disponível", async () => {
    await contagem("Ovo", 1);
    const ovoExtra = await modificador("Ovo extra");
    // 1 xis gasta o último ovo da receita.
    await lancar(garcomA, 4, "Xis Buenas - Clássico");
    await contagem("Ovo", 1);
    const xis = await noCardapio("Xis Buenas - Clássico");
    expect(xis?.esgotado).toBe(false);
    expect(
      xis?.modificadores.find((m) => m.nome === "Ovo extra")?.esgotado,
    ).toBe(false);
    // Xis (1 ovo) + ovo extra (1 ovo) = 2 > 1: recusado inteiro.
    await expect(
      lancar(garcomA, 4, "Xis Buenas - Clássico", 1, [ovoExtra.id]),
    ).rejects.toMatchObject({ codigo: "esgotado" });
    expect((await insumo("Ovo")).estoque).toBe(1);

    await contagem("Ovo", null);
    await contagem("Bacon", 0);
    const bah = await noCardapio("Xis Buenas - Clássico");
    expect(
      bah?.modificadores.find((m) => m.nome === "Bacon extra")?.esgotado,
    ).toBe(true);
    expect(bah?.esgotado).toBe(false);
    await contagem("Bacon", null);
  });

  it("vinte lançamentos simultâneos no último bacon: estoque nunca negativo", async () => {
    await contagem("Bacon", 5);
    const resultados = await Promise.allSettled(
      Array.from({ length: 20 }, (_, i) =>
        lancar(i % 2 ? garcomA : garcomB, 5 + (i % 3), "Xis Bah Tchê! - Bacon"),
      ),
    );
    expect(resultados.filter((r) => r.status === "fulfilled")).toHaveLength(5);
    expect((await insumo("Bacon")).estoque).toBe(0);
    await contagem("Bacon", null);
  });

  it("editar o item ajusta só a diferença (quantidade e adicionais)", async () => {
    await contagem("Bacon", 10);
    const baconExtra = await modificador("Bacon extra");
    const r = await lancar(garcomA, 8, "Xis Bah Tchê! - Bacon", 2);
    expect((await insumo("Bacon")).estoque).toBe(8);
    await editarItem(garcomA, (await itemDaRodada(r.rodadaId)).id, {
      quantidade: 3,
      modificadorIds: [baconExtra.id],
    });
    // 3 xis (3) + bacon extra em cada (3) = 6.
    expect((await insumo("Bacon")).estoque).toBe(4);
    await contagem("Bacon", null);
  });

  it("gerente monta a receita pelo insumo e só aceita produtos do restaurante", async () => {
    const novo = await criarInsumo(restauranteId, {
      nome: "Pão de xis",
      unidade: "un",
      estoque: 30,
    });
    const buenas = await produto("Xis Buenas - Clássico");
    await editarInsumo(restauranteId, novo.id, {
      produtos: [{ produtoId: buenas.id, quantidade: 1 }],
    });
    const { insumos } = await listarInsumos(restauranteId);
    expect(insumos.find((i) => i.nome === "Pão de xis")?.produtos).toEqual([
      { produtoId: buenas.id, quantidade: 1 },
    ]);
    await expect(
      criarInsumo(restauranteId, {
        nome: "Pão de xis",
        unidade: "un",
        estoque: null,
      }),
    ).rejects.toMatchObject({ codigo: "nome_em_uso" });
  });
});

describe("desconto e taxa não cobrada", () => {
  it("desconto percentual nunca passa do consumo", () => {
    expect(valorDoDesconto({ tipo: "percentual", valor: 10 }, 5000)).toBe(500);
    expect(valorDoDesconto({ tipo: "valor", valor: 9000 }, 5000)).toBe(5000);
  });

  it("desconto pré-cadastrado reduz a base da taxa", async () => {
    const aniversario = await criarDesconto(restauranteId, {
      nome: "Aniversariante",
      tipo: "percentual",
      valor: 10,
    });
    await lancar(garcomA, 9, "Xis Bagual - O Bruto da Casa", 2); // 119,80
    const m9 = await mesa(9);
    const r = await fecharComanda(garcomA, m9.id, {
      taxaServico: true,
      descontoId: aniversario.id,
    });
    expect(r.descontoCentavos).toBe(1198);
    // 10% de (11980 - 1198) = 1078,2 -> 1078
    expect(r.taxaCentavos).toBe(1078);
    expect(r.totalCentavos).toBe(11980 - 1198 + 1078);
  });

  it("desconto de valor livre: garçom não pode, gerente pode", async () => {
    await lancar(garcomA, 10, "Xis Buenas - Clássico");
    const m10 = await mesa(10);
    await expect(
      fecharComanda(garcomA, m10.id, { descontoCentavos: 500 }),
    ).rejects.toMatchObject({ status: 403 });
    const r = await fecharComanda(gerente, m10.id, { descontoCentavos: 500 });
    expect(r.descontoCentavos).toBe(500);
  });

  it("sem taxa exige motivo (e texto quando é Outro)", () => {
    expect(fecharMesaSchema.safeParse({ taxaServico: false }).success).toBe(
      false,
    );
    expect(
      fecharMesaSchema.safeParse({
        taxaServico: false,
        semTaxaMotivo: "outro",
      }).success,
    ).toBe(false);
    expect(
      fecharMesaSchema.safeParse({
        taxaServico: false,
        semTaxaMotivo: "demora_preparo",
      }).success,
    ).toBe(true);
  });

  it("relatório mostra taxa não cobrada por motivo e por garçom", async () => {
    await lancar(garcomB, 11, "Xis Buenas - Clássico");
    await fecharComanda(garcomB, (await mesa(11)).id, {
      taxaServico: false,
      semTaxaMotivo: "demora_preparo",
    });
    await lancar(garcomB, 12, "Xis Buenas - Clássico");
    await fecharComanda(garcomB, (await mesa(12)).id, {
      taxaServico: false,
      semTaxaMotivo: "outro",
      semTaxaObservacao: "Mesa de amigos do dono",
    });
    const noite = await resumoNoite(restauranteId);
    expect(noite.semTaxa).toEqual(
      expect.arrayContaining([
        { motivo: "demora_preparo", quantidade: 1, observacoes: [] },
        {
          motivo: "outro",
          quantidade: 1,
          observacoes: ["Mesa de amigos do dono"],
        },
      ]),
    );
    expect(noite.garcons.find((g) => g.nome === "Garçom B")?.semTaxa).toBe(2);
    expect(noite.totalDescontoCentavos).toBe(1198 + 500);
  });
});
