import { eq, sql } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";

import { db, schema } from "@/db";
import type { Sessao } from "@/lib/auth/sessao";
import {
  aceitarAjuda,
  encerrarAjuda,
  listarAjudas,
  manutencaoAjudas,
  pedirAjuda,
} from "@/lib/dominio/ajuda";
import { listarCardapio } from "@/lib/dominio/cardapio";
import { editarItem } from "@/lib/dominio/edicao";
import { criarProduto } from "@/lib/dominio/gerencia";
import { detalharMesa, listarMapa } from "@/lib/dominio/mesas";
import { lancarRodada } from "@/lib/dominio/rodadas";
import {
  chave,
  definirEstoque,
  mesa,
  modificador,
  produto,
  sessaoDe,
} from "./helpers";

let garcomA: Sessao;
let garcomB: Sessao;
let gerente: Sessao;

beforeAll(async () => {
  garcomA = await sessaoDe("Garçom A");
  garcomB = await sessaoDe("Garçom B");
  gerente = await sessaoDe("Gerente");
});

const trabalhosDaRodada = (rodadaId: string) =>
  db()
    .select()
    .from(schema.trabalhosImpressao)
    .where(eq(schema.trabalhosImpressao.rodadaId, rodadaId));

const itemAtivoDaRodada = async (rodadaId: string) => {
  const itens = await db()
    .select()
    .from(schema.itensPedido)
    .where(eq(schema.itensPedido.rodadaId, rodadaId));
  return itens.find((i) => i.status === "ativo");
};

describe("editar item lançado", () => {
  it("com o ticket ainda na fila, corrige o próprio ticket (sem aviso extra)", async () => {
    const m = await mesa(1);
    const xis = await produto("Xis Bacon");
    const semTomate = await modificador("Sem tomate");
    const r = await lancarRodada(garcomA, m.id, {
      idempotencyKey: chave(),
      itens: [{ produtoId: xis.id, quantidade: 2, modificadorIds: [] }],
    });
    const original = await itemAtivoDaRodada(r.rodadaId);
    if (!original) throw new Error("sem item");

    const editado = await editarItem(garcomA, original.id, {
      quantidade: 1,
      modificadorIds: [semTomate.id],
      observacao: "bem passado",
    });
    expect(editado.alterou).toBe(true);

    const [antigo] = await db()
      .select()
      .from(schema.itensPedido)
      .where(eq(schema.itensPedido.id, original.id));
    expect(antigo.status).toBe("cancelado");
    expect(antigo.motivoCancelamento).toBe("Alterado");

    const novo = await itemAtivoDaRodada(r.rodadaId);
    expect(novo?.substituiItemId).toBe(original.id);
    expect(novo?.quantidade).toBe(1);
    expect(novo?.totalCentavos).toBe(3200);

    const trabalhos = await trabalhosDaRodada(r.rodadaId);
    expect(trabalhos).toHaveLength(1);
    expect(trabalhos[0].payload.itens[0]).toMatchObject({
      itemId: novo?.id,
      quantidade: 1,
      modificadores: ["Sem tomate"],
      observacao: "bem passado",
    });

    // Na tela aparece só a versão nova, marcada como editada.
    const detalhe = await detalharMesa(garcomA.funcionario.restauranteId, m.id);
    const itensTela = detalhe.comanda?.rodadas[0].itens ?? [];
    expect(itensTela).toHaveLength(1);
    expect(itensTela[0]).toMatchObject({ quantidade: 1, editado: true });
  });

  it("com o ticket já impresso, gera ticket de ALTERAÇÃO com antes e depois", async () => {
    const m = await mesa(2);
    const xis = await produto("Xis Salada");
    const r = await lancarRodada(garcomA, m.id, {
      idempotencyKey: chave(),
      itens: [{ produtoId: xis.id, quantidade: 1, modificadorIds: [] }],
    });
    await db()
      .update(schema.trabalhosImpressao)
      .set({ status: "impresso", impressoEm: new Date() })
      .where(eq(schema.trabalhosImpressao.rodadaId, r.rodadaId));
    const original = await itemAtivoDaRodada(r.rodadaId);
    if (!original) throw new Error("sem item");

    await editarItem(garcomB, original.id, {
      quantidade: 2,
      modificadorIds: [],
    });

    const trabalhos = await trabalhosDaRodada(r.rodadaId);
    const alteracao = trabalhos.find((t) => t.tipo === "alteracao");
    expect(alteracao?.status).toBe("pendente");
    expect(alteracao?.payload.antes?.[0].quantidade).toBe(1);
    expect(alteracao?.payload.itens[0].quantidade).toBe(2);
  });

  it("ajusta o estoque só pela diferença e recusa aumentar além do estoque", async () => {
    const m = await mesa(3);
    const cerveja = await produto("Cerveja Long Neck");
    await definirEstoque(cerveja.id, 5);
    const r = await lancarRodada(garcomA, m.id, {
      idempotencyKey: chave(),
      itens: [{ produtoId: cerveja.id, quantidade: 2, modificadorIds: [] }],
    });
    const estoque = async () =>
      (
        await db()
          .select()
          .from(schema.produtos)
          .where(eq(schema.produtos.id, cerveja.id))
      )[0].estoque;
    expect(await estoque()).toBe(3);

    let item = await itemAtivoDaRodada(r.rodadaId);
    await editarItem(garcomA, item?.id ?? "", {
      quantidade: 5,
      modificadorIds: [],
    });
    expect(await estoque()).toBe(0);

    item = await itemAtivoDaRodada(r.rodadaId);
    await expect(
      editarItem(garcomA, item?.id ?? "", {
        quantidade: 6,
        modificadorIds: [],
      }),
    ).rejects.toMatchObject({ codigo: "esgotado" });

    await editarItem(garcomA, item?.id ?? "", {
      quantidade: 1,
      modificadorIds: [],
    });
    expect(await estoque()).toBe(4);
  });

  it("não aceita dois pontos da carne no mesmo item", async () => {
    const m = await mesa(4);
    const xis = await produto("Xis Tudo");
    const mal = await modificador("Mal passado");
    const bem = await modificador("Bem passado");
    await expect(
      lancarRodada(garcomA, m.id, {
        idempotencyKey: chave(),
        itens: [
          {
            produtoId: xis.id,
            quantidade: 1,
            modificadorIds: [mal.id, bem.id],
          },
        ],
      }),
    ).rejects.toMatchObject({ status: 422 });
  });
});

describe("pedido de ajuda", () => {
  it("pedir de novo na mesma mesa não duplica e aparece no mapa", async () => {
    const m = await mesa(10);
    const primeiro = await pedirAjuda(garcomA, m.id);
    const segundo = await pedirAjuda(garcomA, m.id);
    expect(segundo).toEqual({ id: primeiro.id, jaExistia: true });

    const mapa = await listarMapa(garcomA.funcionario.restauranteId);
    expect(mapa.find((x) => x.numero === 10)?.ajudaPendente).toBe(true);
  });

  it("o próprio solicitante não aceita; entre dois garçons só o primeiro leva", async () => {
    const m = await mesa(11);
    const { id } = await pedirAjuda(garcomA, m.id);
    await expect(aceitarAjuda(garcomA, id)).rejects.toMatchObject({
      codigo: "ja_atendido",
    });

    const resultados = await Promise.allSettled([
      aceitarAjuda(garcomB, id),
      aceitarAjuda(gerente, id),
    ]);
    expect(resultados.filter((r) => r.status === "fulfilled")).toHaveLength(1);

    const [pedido] = (
      await listarAjudas(garcomA.funcionario.restauranteId)
    ).filter((p) => p.id === id);
    expect(pedido.aceitoPor).not.toBeNull();
    const mapa = await listarMapa(garcomA.funcionario.restauranteId);
    expect(mapa.find((x) => x.numero === 11)?.ajudaPendente).toBe(false);

    await encerrarAjuda(garcomA, id);
    expect(
      (await listarAjudas(garcomA.funcionario.restauranteId)).some(
        (p) => p.id === id,
      ),
    ).toBe(false);
  });

  it("sem resposta no prazo, escala para o gerente", async () => {
    const m = await mesa(12);
    const { id } = await pedirAjuda(garcomB, m.id);
    await db().execute(
      sql`update pedido_ajuda set criado_em = now() - interval '5 minutes' where id = ${id}`,
    );
    await manutencaoAjudas(120);
    const [pedido] = (
      await listarAjudas(garcomB.funcionario.restauranteId)
    ).filter((p) => p.id === id);
    expect(pedido.escalado).toBe(true);
  });
});

describe("códigos do cardápio", () => {
  it("o seed numera por faixa e o produto novo pega o próximo código livre", async () => {
    const restauranteId = garcomA.funcionario.restauranteId;
    const cardapio = await listarCardapio(restauranteId);
    const lanches = cardapio.find((c) => c.nome === "Lanches");
    expect(lanches?.produtos.map((p) => p.codigo)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(cardapio.find((c) => c.nome === "Bebidas")?.produtos[0].codigo).toBe(
      30,
    );

    const novo = await criarProduto(restauranteId, {
      categoriaId: lanches?.id ?? "",
      nome: "Xis Vegetariano",
      precoCentavos: 3000,
      controlaEstoque: false,
      estoque: null,
    });
    expect(novo.codigo).toBe(7);

    await expect(
      criarProduto(restauranteId, {
        categoriaId: lanches?.id ?? "",
        nome: "Repetido",
        precoCentavos: 100,
        codigo: 7,
        controlaEstoque: false,
        estoque: null,
      }),
    ).rejects.toMatchObject({ codigo: "codigo_em_uso" });
  });
});
