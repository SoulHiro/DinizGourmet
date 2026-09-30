import { existsSync } from "node:fs";
import { readFile, rm } from "node:fs/promises";
import path from "node:path";
import { eq } from "drizzle-orm";
import sharp from "sharp";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { db, schema } from "@/db";
import type { Sessao } from "@/lib/auth/sessao";
import { cancelarItem } from "@/lib/dominio/cancelamento";
import { cardapioPublico, contaPublica } from "@/lib/dominio/cardapio-publico";
import { miniatura, pastaMidia, salvarFoto } from "@/lib/dominio/midia";
import {
  chave,
  definirEstoque,
  lancarNaMesa,
  mesa,
  produto,
  sessaoDe,
} from "./helpers";

let garcom: Sessao;
const criados: string[] = [];

beforeAll(async () => {
  garcom = await sessaoDe("Garçom A");
});

afterAll(async () => {
  for (const arquivo of criados) await rm(arquivo, { force: true });
});

describe("cardápio público (QR da mesa)", () => {
  it("traz categorias, destaques, ingredientes e adicionais; esconde o indisponível", async () => {
    const m = await mesa(1);
    const pudim = await produto("Pudim");
    await db()
      .update(schema.produtos)
      .set({ disponivel: false })
      .where(eq(schema.produtos.id, pudim.id));
    const refri = await produto("Refrigerante Lata");
    await definirEstoque(refri.id, 0);

    const cardapio = await cardapioPublico(m.tokenQr);
    expect(cardapio.mesa).toBe(1);
    const todos = cardapio.categorias.flatMap((c) => c.produtos);

    expect(todos.some((p) => p.nome === "Pudim")).toBe(false);
    expect(cardapio.categorias.some((c) => c.nome === "Sobremesas")).toBe(
      false,
    );
    expect(todos.find((p) => p.nome === "Refrigerante Lata")?.esgotado).toBe(
      true,
    );

    const tudo = todos.find((p) => p.nome === "Xis Bagual - O Bruto da Casa");
    expect(tudo?.destaque).toBe(true);
    expect(tudo?.ingredientes).toContain("Bacon");
    expect(tudo?.adicionais).toEqual(
      expect.arrayContaining([{ nome: "Bacon extra", precoCentavos: 500 }]),
    );
    expect(tudo?.opcoes).toContain("Sem ervilha");
    // O cliente não recebe o número do estoque, só se está esgotado.
    expect(Object.keys(tudo ?? {})).not.toContain("estoque");
  });
});

describe("minha conta (cliente)", () => {
  it("mostra só os itens ativos da própria mesa, com total", async () => {
    const m2 = await mesa(2);
    const m3 = await mesa(3);
    const xis = await produto("Xis Buenas - Clássico");
    const agua = await produto("Água sem Gás");

    const vazia = await contaPublica(m2.tokenQr);
    expect(vazia).toMatchObject({ aberta: false, itens: [], totalCentavos: 0 });

    const r = await lancarNaMesa(garcom, m2.id, {
      idempotencyKey: chave(),
      itens: [
        { produtoId: xis.id, quantidade: 2, modificadorIds: [] },
        { produtoId: agua.id, quantidade: 1, modificadorIds: [] },
      ],
    });
    await lancarNaMesa(garcom, m3.id, {
      idempotencyKey: chave(),
      itens: [{ produtoId: xis.id, quantidade: 1, modificadorIds: [] }],
    });
    const [itemAgua] = await db()
      .select()
      .from(schema.itensPedido)
      .where(eq(schema.itensPedido.rodadaId, r.rodadaId));
    const agua2 = (
      await db()
        .select()
        .from(schema.itensPedido)
        .where(eq(schema.itensPedido.rodadaId, r.rodadaId))
    ).find((i) => i.produtoId === agua.id);
    await cancelarItem(garcom, agua2?.id ?? itemAgua.id, {
      motivo: "Lançado errado",
      preparoIniciado: false,
    });

    const conta = await contaPublica(m2.tokenQr);
    expect(conta.aberta).toBe(true);
    expect(conta.itens.map((i) => `${i.quantidade}x ${i.nome}`)).toEqual([
      "2x Xis Buenas - Clássico",
    ]);
    expect(conta.totalCentavos).toBe(7980);
  });
});

describe("fotos do cardápio", () => {
  it("gera a versão grande e a miniatura em WebP", async () => {
    const png = await sharp({
      create: {
        width: 2400,
        height: 1800,
        channels: 3,
        background: { r: 200, g: 90, b: 20 },
      },
    })
      .png()
      .toBuffer();
    const arquivo = new File([png], "xis.png", { type: "image/png" });

    const { url } = await salvarFoto(arquivo);
    expect(url).toMatch(/^\/midia\/[0-9a-f-]+\.webp$/);

    const nome = url.replace("/midia/", "");
    const grande = path.join(pastaMidia(), nome);
    const pequena = path.join(pastaMidia(), nome.replace(".webp", "-p.webp"));
    criados.push(grande, pequena);
    expect(existsSync(grande)).toBe(true);
    expect(existsSync(pequena)).toBe(true);
    expect((await sharp(await readFile(grande)).metadata()).width).toBe(1200);
    expect((await sharp(await readFile(pequena)).metadata()).width).toBe(480);
    expect(miniatura(url)).toBe(url.replace(".webp", "-p.webp"));
  });

  it("recusa arquivo que não é imagem", async () => {
    const texto = new File(["olá"], "x.txt", { type: "text/plain" });
    await expect(salvarFoto(texto)).rejects.toMatchObject({ status: 422 });
  });
});
