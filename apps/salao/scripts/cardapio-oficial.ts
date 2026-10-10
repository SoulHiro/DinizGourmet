// Deixa o cardápio do banco igual ao oficial (src/db/cardapio-oficial.ts).
//
//   pnpm cardapio:atualizar --simular   mostra o que vai mudar, sem gravar
//   pnpm cardapio:atualizar             aplica
//
// Item que já existe (mesmo nome ou nome antigo conhecido) é atualizado e
// mantém foto, chips e histórico. Item que não está no oficial sai: apagado
// se nunca foi vendido, arquivado se já foi (comandas antigas seguem
// mostrando). Estoque: só bebidas (uma contagem por bebida, o balde gasta 5);
// os insumos de cozinha saem. Tudo numa transação só; rodar de novo não
// duplica nada.
import { and, eq, inArray, isNull, notInArray } from "drizzle-orm";

import { db, pool, schema } from "@/db";
import {
  CARDAPIO_OFICIAL,
  DESCONTOS_PADRAO,
  estoqueDoItem,
  faixaDeCodigos,
  type ItemOficial,
} from "@/db/cardapio-oficial";
import { normalizarBusca } from "@/lib/texto";

const simular = process.argv.includes("--simular");

class Simulacao extends Error {}

// "Xis Bah Tchê!" -> "xis bah tche"; "c/bacon" -> "c bacon".
const chave = (texto: string) =>
  normalizarBusca(texto)
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const casaComAntigo = (nome: string, antigos: string[] = []) => {
  const k = chave(nome);
  return antigos.map(chave).some((a) => k === a || k.startsWith(`${a} `));
};

const real = (centavos: number) =>
  `R$ ${(centavos / 100).toFixed(2).replace(".", ",")}`;

const main = async () => {
  const relatorio: string[] = [];
  const log = (linha: string) => relatorio.push(linha);

  try {
    await db().transaction(async (tx) => {
      const [restaurante] = await tx
        .select()
        .from(schema.restaurantes)
        .limit(1);
      if (!restaurante) throw new Error("Banco sem restaurante (rode o seed).");
      const restauranteId = restaurante.id;

      const impressoras = await tx
        .select()
        .from(schema.impressoras)
        .where(eq(schema.impressoras.restauranteId, restauranteId));
      const impressoraDoSetor = (setor: string) =>
        impressoras.find((i) => i.setor === setor && i.ativa)?.id ??
        impressoras.find((i) => i.setor === setor)?.id ??
        null;

      // 1. Categorias (50 códigos cada, na ordem do cardápio).
      const categorias = await tx
        .select()
        .from(schema.categorias)
        .where(eq(schema.categorias.restauranteId, restauranteId));
      const categoriasUsadas = new Set<string>();
      const categoriaIdPorNome = new Map<string, string>();

      log("CATEGORIAS");
      for (const [indice, oficial] of CARDAPIO_OFICIAL.entries()) {
        const livres = categorias.filter((c) => !categoriasUsadas.has(c.id));
        const existente =
          livres.find((c) => chave(c.nome) === chave(oficial.nome)) ??
          livres.find((c) =>
            (oficial.antigos ?? []).map(chave).includes(chave(c.nome)),
          );
        const faixa = faixaDeCodigos(indice);
        const dados = {
          nome: oficial.nome,
          ordem: indice + 1,
          ...faixa,
          ativa: true,
        };
        const rotulo = `${oficial.nome} (códigos ${faixa.codigoInicio}–${faixa.codigoFim})`;
        if (existente) {
          categoriasUsadas.add(existente.id);
          await tx
            .update(schema.categorias)
            .set({
              ...dados,
              impressoraId:
                existente.impressoraId ?? impressoraDoSetor(oficial.setor),
            })
            .where(eq(schema.categorias.id, existente.id));
          categoriaIdPorNome.set(oficial.nome, existente.id);
          log(
            existente.nome === oficial.nome
              ? `  ${rotulo}`
              : `  ${rotulo}: era "${existente.nome}"`,
          );
        } else {
          const [criada] = await tx
            .insert(schema.categorias)
            .values({
              ...dados,
              restauranteId,
              impressoraId: impressoraDoSetor(oficial.setor),
            })
            .returning();
          categoriasUsadas.add(criada.id);
          categoriaIdPorNome.set(oficial.nome, criada.id);
          log(`  ${rotulo}: criada`);
        }
      }

      // 2. Produtos: casa primeiro por nome igual, depois por nome antigo.
      const produtos = await tx
        .select()
        .from(schema.produtos)
        .where(
          and(
            eq(schema.produtos.restauranteId, restauranteId),
            isNull(schema.produtos.arquivadoEm),
          ),
        );
      const itens = CARDAPIO_OFICIAL.flatMap((c) => c.itens);
      const par = new Map<ItemOficial, (typeof produtos)[number]>();
      const usados = new Set<string>();
      for (const item of itens) {
        const p = produtos.find(
          (x) => !usados.has(x.id) && chave(x.nome) === chave(item.nome),
        );
        if (p) {
          par.set(item, p);
          usados.add(p.id);
        }
      }
      for (const item of itens) {
        if (par.has(item)) continue;
        const p = produtos.find(
          (x) => !usados.has(x.id) && casaComAntigo(x.nome, item.antigos),
        );
        if (p) {
          par.set(item, p);
          usados.add(p.id);
        }
      }

      // Libera todos os códigos antes de renumerar (o código é único).
      if (produtos.length) {
        await tx
          .update(schema.produtos)
          .set({ codigo: null })
          .where(
            inArray(
              schema.produtos.id,
              produtos.map((p) => p.id),
            ),
          );
      }

      const novos: { id: string; categoriaId: string }[] = [];
      const idPorItem = new Map<ItemOficial, string>();
      for (const [indice, oficial] of CARDAPIO_OFICIAL.entries()) {
        log(`\n${oficial.nome.toUpperCase()}`);
        const categoriaId = categoriaIdPorNome.get(oficial.nome) as string;
        const { codigoInicio } = faixaDeCodigos(indice);
        for (const [ordem, item] of oficial.itens.entries()) {
          const codigo = codigoInicio + ordem;
          const dados = {
            categoriaId,
            codigo,
            nome: item.nome,
            buscaNormalizada: normalizarBusca(item.nome),
            precoCentavos: item.preco,
            ordem,
            disponivel: true,
            // O estoque agora é pela aba Estoque (contagem por bebida).
            controlaEstoque: false,
            estoque: null,
            ...(item.descricao !== undefined
              ? { descricao: item.descricao }
              : {}),
            ...(item.ingredientes !== undefined
              ? { ingredientes: item.ingredientes }
              : {}),
            ...(item.destaque ? { destaque: true } : {}),
          };
          const existente = par.get(item);
          if (existente) {
            await tx
              .update(schema.produtos)
              .set(dados)
              .where(eq(schema.produtos.id, existente.id));
            idPorItem.set(item, existente.id);
            const mudancas = [
              existente.nome !== item.nome && `nome era "${existente.nome}"`,
              existente.precoCentavos !== item.preco &&
                `preço ${real(existente.precoCentavos)} -> ${real(item.preco)}`,
              existente.categoriaId !== categoriaId && "mudou de categoria",
              existente.codigo !== codigo &&
                `código era ${existente.codigo ?? "—"}`,
            ].filter(Boolean);
            log(
              `  ${codigo} ${item.nome} ${real(item.preco)}${
                mudancas.length ? ` (${mudancas.join(", ")})` : ""
              }`,
            );
          } else {
            const [criado] = await tx
              .insert(schema.produtos)
              .values({ ...dados, restauranteId })
              .returning({ id: schema.produtos.id });
            novos.push({ id: criado.id, categoriaId });
            idPorItem.set(item, criado.id);
            log(`  ${codigo} ${item.nome} ${real(item.preco)}: novo`);
          }
        }
      }

      // 3. O que não está no oficial sai do cardápio.
      const sobrando = produtos.filter((p) => !usados.has(p.id));
      if (sobrando.length) log("\nSAEM DO CARDÁPIO");
      for (const p of sobrando) {
        const [vendido] = await tx
          .select({ id: schema.itensPedido.id })
          .from(schema.itensPedido)
          .where(eq(schema.itensPedido.produtoId, p.id))
          .limit(1);
        if (vendido) {
          await tx
            .update(schema.produtos)
            .set({
              arquivadoEm: new Date(),
              codigo: null,
              disponivel: false,
              destaque: false,
              controlaEstoque: false,
              estoque: null,
            })
            .where(eq(schema.produtos.id, p.id));
          log(`  ${p.nome} (arquivado: já foi vendido)`);
        } else {
          await tx.delete(schema.produtos).where(eq(schema.produtos.id, p.id));
          log(`  ${p.nome} (excluído)`);
        }
      }

      // 4. Categorias fora do oficial (Sobremesas...): apagadas se nada
      // aponta para elas; senão ficam inativas e somem das telas.
      for (const c of categorias.filter((c) => !categoriasUsadas.has(c.id))) {
        const [algum] = await tx
          .select({ id: schema.produtos.id })
          .from(schema.produtos)
          .where(eq(schema.produtos.categoriaId, c.id))
          .limit(1);
        if (!algum) {
          await tx
            .delete(schema.categorias)
            .where(eq(schema.categorias.id, c.id));
          log(`Categoria ${c.nome}: excluída`);
        } else if (c.ativa) {
          await tx
            .update(schema.categorias)
            .set({ ativa: false })
            .where(eq(schema.categorias.id, c.id));
          log(`Categoria ${c.nome}: retirada (fica só no histórico)`);
        }
      }

      // 5. Item novo ganha os mesmos chips (sem ervilha, bacon extra...) que
      // os outros itens da categoria já usam.
      for (const novo of novos) {
        const irmaos = await tx
          .select({ modificadorId: schema.produtoModificadores.modificadorId })
          .from(schema.produtoModificadores)
          .innerJoin(
            schema.produtos,
            eq(schema.produtos.id, schema.produtoModificadores.produtoId),
          )
          .where(eq(schema.produtos.categoriaId, novo.categoriaId));
        const ids = [...new Set(irmaos.map((m) => m.modificadorId))];
        if (ids.length) {
          await tx
            .insert(schema.produtoModificadores)
            .values(
              ids.map((modificadorId, ordem) => ({
                produtoId: novo.id,
                modificadorId,
                ordem,
              })),
            )
            .onConflictDoNothing();
        }
      }

      // 6. Estoque só de bebidas: uma contagem por bebida. Contagem que já
      // existia é mantida; insumo de cozinha (bacon, ovo...) sai.
      const contagens = new Map<
        string,
        { produtoId: string; quantidade: number }[]
      >();
      for (const oficial of CARDAPIO_OFICIAL) {
        for (const item of oficial.itens) {
          const gasto = estoqueDoItem(oficial, item);
          if (!gasto) continue;
          const lista = contagens.get(gasto.insumo) ?? [];
          lista.push({
            produtoId: idPorItem.get(item) as string,
            quantidade: gasto.quantidade,
          });
          contagens.set(gasto.insumo, lista);
        }
      }
      const insumosAntes = await tx
        .select()
        .from(schema.insumos)
        .where(eq(schema.insumos.restauranteId, restauranteId));
      const nomesEstoque = [...contagens.keys()];
      const retirados = insumosAntes.filter(
        (i) => !nomesEstoque.some((n) => chave(n) === chave(i.nome)),
      );
      if (retirados.length) {
        await tx.delete(schema.insumos).where(
          inArray(
            schema.insumos.id,
            retirados.map((i) => i.id),
          ),
        );
      }
      log(
        `\nESTOQUE: ${nomesEstoque.length} bebidas contadas${
          retirados.length
            ? `; saem ${retirados.map((i) => i.nome).join(", ")}`
            : ""
        }`,
      );
      const idsOficiais = [...idPorItem.values()];
      // Receitas antigas dos itens oficiais são refeitas do zero.
      await tx
        .delete(schema.produtoInsumos)
        .where(inArray(schema.produtoInsumos.produtoId, idsOficiais));
      for (const [nome, receita] of contagens) {
        const existente = insumosAntes.find(
          (i) => chave(i.nome) === chave(nome) && !retirados.includes(i),
        );
        let insumoId: string;
        if (existente) {
          insumoId = existente.id;
          await tx
            .update(schema.insumos)
            .set({ nome, unidade: "un", ativo: true })
            .where(eq(schema.insumos.id, existente.id));
        } else {
          const [criado] = await tx
            .insert(schema.insumos)
            .values({ restauranteId, nome, unidade: "un" })
            .returning({ id: schema.insumos.id });
          insumoId = criado.id;
        }
        await tx
          .insert(schema.produtoInsumos)
          .values(receita.map((r) => ({ ...r, insumoId })));
      }
      // Produto arquivado não deve segurar receita de estoque.
      await tx.delete(schema.produtoInsumos).where(
        and(
          notInArray(schema.produtoInsumos.produtoId, idsOficiais),
          inArray(
            schema.produtoInsumos.produtoId,
            produtos.map((p) => p.id),
          ),
        ),
      );

      // 7. Descontos padrão (só cria o que ainda não existe).
      const descontos = await tx
        .select({ nome: schema.descontos.nome })
        .from(schema.descontos)
        .where(eq(schema.descontos.restauranteId, restauranteId));
      const criados = [];
      for (const d of DESCONTOS_PADRAO) {
        if (descontos.some((x) => chave(x.nome) === chave(d.nome))) continue;
        await tx.insert(schema.descontos).values({
          restauranteId,
          nome: d.nome,
          tipo: d.tipo,
          valor: d.valor,
          ativo: d.ativo ?? true,
          somenteGerente: d.somenteGerente ?? false,
        });
        criados.push(d.nome);
      }
      if (criados.length) log(`DESCONTOS criados: ${criados.join(", ")}`);

      log(
        `\n${itens.length} itens no cardápio: ${
          itens.length - novos.length
        } atualizados, ${novos.length} novos, ${sobrando.length} retirados.`,
      );

      if (simular) throw new Simulacao();
    });
    console.log(relatorio.join("\n"));
    console.log("\nCardápio atualizado.");
  } catch (error) {
    if (!(error instanceof Simulacao)) throw error;
    console.log(relatorio.join("\n"));
    console.log(
      "\nSIMULAÇÃO: nada foi gravado. Rode sem --simular para aplicar.",
    );
  } finally {
    await pool().end();
  }
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
