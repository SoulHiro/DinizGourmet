import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";

import { db, schema } from "@/db";
import type { Sessao } from "@/lib/auth/sessao";
import { listarCardapio } from "@/lib/dominio/cardapio";
import {
  criarCategoria,
  criarOpcao,
  editarOpcao,
  excluirCategoria,
  excluirOpcao,
  listarOpcoes,
  reordenarProdutos,
} from "@/lib/dominio/cardapio-gestao";
import {
  criarProduto,
  editarProduto,
  listarProdutosGerencia,
} from "@/lib/dominio/gerencia";
import {
  chave,
  lancarNaMesa,
  mesa,
  modificador,
  produto,
  sessaoDe,
} from "./helpers";

let gerente: Sessao;
let restauranteId: string;

beforeAll(async () => {
  gerente = await sessaoDe("Gerente");
  restauranteId = gerente.funcionario.restauranteId;
});

describe("gestão do cardápio pelo gerente", () => {
  it("cria categoria no fim, com 50 códigos depois da última faixa", async () => {
    const nova = await criarCategoria(restauranteId, { nome: "Sobremesas 2" });
    const todas = await db()
      .select()
      .from(schema.categorias)
      .where(eq(schema.categorias.restauranteId, restauranteId));
    const maiorFim = Math.max(
      ...todas.filter((c) => c.id !== nova.id).map((c) => c.codigoFim ?? 0),
    );
    expect(nova.codigoInicio).toBeGreaterThan(maiorFim);
    expect((nova.codigoFim ?? 0) - (nova.codigoInicio ?? 0)).toBe(49);
    expect(nova.ordem).toBe(Math.max(...todas.map((c) => c.ordem)));

    // Vazia: sai de vez.
    expect(await excluirCategoria(restauranteId, nova.id)).toEqual({
      arquivada: false,
    });
  });

  it("não exclui categoria com item ativo", async () => {
    const pudim = await produto("Pudim");
    await expect(
      excluirCategoria(restauranteId, pudim.categoriaId),
    ).rejects.toThrow(/ainda tem itens/);
  });

  it("mover item de categoria vai para o fim e ganha código da faixa nova", async () => {
    const nova = await criarCategoria(restauranteId, { nome: "Teste mover" });
    const item = await criarProduto(restauranteId, {
      categoriaId: (await produto("Pudim")).categoriaId,
      nome: "Item para mover",
      precoCentavos: 1000,
      controlaEstoque: false,
      estoque: null,
    });
    const movido = await editarProduto(restauranteId, item.id, {
      categoriaId: nova.id,
    });
    expect(movido.categoriaId).toBe(nova.id);
    expect(movido.codigo).toBe(nova.codigoInicio);
  });

  it("reordena itens e o cardápio segue a ordem nova", async () => {
    const lista = await listarProdutosGerencia(restauranteId);
    const categoria = lista.find((c) => c.produtos.length >= 3);
    if (!categoria) throw new Error("sem categoria com 3 itens");
    const invertidos = [...categoria.produtos].reverse().map((p) => p.id);
    await reordenarProdutos(restauranteId, invertidos);
    const cardapio = await listarCardapio(restauranteId);
    expect(
      cardapio.find((c) => c.id === categoria.id)?.produtos.map((p) => p.id),
    ).toEqual(invertidos);
  });

  it("cria opção ligada a itens; trocar para remoção zera o preço", async () => {
    const xis = await produto("Xis Bagual - O Bruto da Casa");
    const opcao = await criarOpcao(restauranteId, {
      nome: "Cheddar extra",
      tipo: "adicional",
      precoCentavos: 400,
      produtoIds: [xis.id],
    });
    let listada = (await listarOpcoes(restauranteId)).find(
      (o) => o.id === opcao.id,
    );
    expect(listada?.produtoIds).toEqual([xis.id]);

    const cardapio = await listarCardapio(restauranteId);
    const noCardapio = cardapio
      .flatMap((c) => c.produtos)
      .find((p) => p.id === xis.id);
    expect(noCardapio?.modificadores.at(-1)?.nome).toBe("Cheddar extra");

    await editarOpcao(restauranteId, opcao.id, {
      tipo: "remocao",
      produtoIds: [],
    });
    listada = (await listarOpcoes(restauranteId)).find(
      (o) => o.id === opcao.id,
    );
    expect(listada?.precoCentavos).toBe(0);
    expect(listada?.produtoIds).toEqual([]);

    await excluirOpcao(restauranteId, opcao.id);
    expect(
      (await listarOpcoes(restauranteId)).some((o) => o.id === opcao.id),
    ).toBe(false);
  });

  it("opção já usada em pedido não pode ser excluída", async () => {
    const garcom = await sessaoDe("Garçom A");
    const m = await mesa(7);
    const xis = await produto("Xis Bagual - O Bruto da Casa");
    const semErvilha = await modificador("Sem ervilha");
    await lancarNaMesa(garcom, m.id, {
      idempotencyKey: chave(),
      itens: [
        { produtoId: xis.id, quantidade: 1, modificadorIds: [semErvilha.id] },
      ],
    });
    await expect(excluirOpcao(restauranteId, semErvilha.id)).rejects.toThrow(
      /Desative/,
    );
    const listada = (await listarOpcoes(restauranteId)).find(
      (o) => o.id === semErvilha.id,
    );
    expect(listada?.usos).toBeGreaterThan(0);
  });
});
