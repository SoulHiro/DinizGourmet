import { sql } from "drizzle-orm";

import { db } from "@/db";
import { inicioDaNoite } from "./comum";

// Quanto saiu de cada item num período, quanto rendeu e (com custo
// informado) quanto deu de lucro bruto. Custo da hora da venda; vendas
// antigas, sem custo gravado, usam o custo atual do item.

const DIA = 24 * 3600 * 1000;

export type LinhaProduto = {
  produtoId: string;
  nome: string;
  categoria: string;
  quantidade: number;
  receitaCentavos: number;
  // Só da parte das vendas com custo conhecido.
  custoCentavos: number | null;
  lucroCentavos: number | null;
  margemPct: number | null;
  precoCentavos: number;
  custoAtualCentavos: number | null;
};

export const relatorioProdutos = async (
  restauranteId: string,
  dias: number,
) => {
  const ate = new Date();
  const desde = new Date(inicioDaNoite(ate).getTime() - (dias - 1) * DIA);

  const [vendidos, parados] = await Promise.all([
    db().execute<{
      produto_id: string;
      nome: string;
      categoria: string;
      ordem: number;
      quantidade: number;
      receita: number;
      receita_com_custo: number;
      custo: number | null;
      preco: number;
      custo_atual: number | null;
    }>(sql`
      select p.id as produto_id, p.nome, cat.nome as categoria, cat.ordem,
             sum(i.quantidade)::int as quantidade,
             sum(i.total_centavos)::int as receita,
             coalesce(sum(i.total_centavos) filter (
               where coalesce(i.custo_unitario_centavos, p.custo_centavos) is not null
             ), 0)::int as receita_com_custo,
             sum(i.quantidade * coalesce(i.custo_unitario_centavos, p.custo_centavos))::int as custo,
             p.preco_centavos as preco, p.custo_centavos as custo_atual
        from item_pedido i
        join rodada r on r.id = i.rodada_id
        join produto p on p.id = i.produto_id
        join categoria cat on cat.id = p.categoria_id
       where r.restaurante_id = ${restauranteId} and i.status = 'ativo'
         and r.lancada_em >= ${desde} and r.lancada_em < ${ate}
       group by p.id, cat.nome, cat.ordem
       order by quantidade desc, receita desc
    `),
    // Itens do cardápio que não venderam nada no período.
    db().execute<{ produto_id: string; nome: string; categoria: string }>(sql`
      select p.id as produto_id, p.nome, cat.nome as categoria
        from produto p
        join categoria cat on cat.id = p.categoria_id and cat.ativa
       where p.restaurante_id = ${restauranteId} and p.arquivado_em is null
         and not exists (
           select 1 from item_pedido i join rodada r on r.id = i.rodada_id
            where i.produto_id = p.id and i.status = 'ativo'
              and r.lancada_em >= ${desde} and r.lancada_em < ${ate})
       order by cat.ordem, p.ordem, p.nome
    `),
  ]);

  const linhas: LinhaProduto[] = vendidos.rows.map((v) => {
    const lucro = v.custo !== null ? v.receita_com_custo - v.custo : null;
    return {
      produtoId: v.produto_id,
      nome: v.nome,
      categoria: v.categoria,
      quantidade: v.quantidade,
      receitaCentavos: v.receita,
      custoCentavos: v.custo,
      lucroCentavos: lucro,
      margemPct:
        lucro !== null && v.receita_com_custo > 0
          ? Math.round((lucro / v.receita_com_custo) * 1000) / 10
          : null,
      precoCentavos: v.preco,
      custoAtualCentavos: v.custo_atual,
    };
  });

  const receita = linhas.reduce((s, l) => s + l.receitaCentavos, 0);
  const receitaComCusto = vendidos.rows.reduce(
    (s, v) => s + v.receita_com_custo,
    0,
  );
  const custo = linhas.reduce((s, l) => s + (l.custoCentavos ?? 0), 0);
  const lucro = receitaComCusto - custo;

  // Por categoria, na ordem do cardápio.
  const categorias = new Map<
    string,
    { ordem: number; quantidade: number; receita: number; lucro: number }
  >();
  for (const v of vendidos.rows) {
    const c = categorias.get(v.categoria) ?? {
      ordem: v.ordem,
      quantidade: 0,
      receita: 0,
      lucro: 0,
    };
    c.quantidade += v.quantidade;
    c.receita += v.receita;
    if (v.custo !== null) c.lucro += v.receita_com_custo - v.custo;
    categorias.set(v.categoria, c);
  }

  return {
    desde: desde.toISOString(),
    ate: ate.toISOString(),
    dias,
    itensVendidos: linhas.reduce((s, l) => s + l.quantidade, 0),
    receitaCentavos: receita,
    custoCentavos: custo,
    lucroCentavos: lucro,
    margemPct:
      receitaComCusto > 0
        ? Math.round((lucro / receitaComCusto) * 1000) / 10
        : null,
    // Quanto da receita tem custo informado (o lucro só vale para essa parte).
    coberturaPct:
      receita > 0 ? Math.round((receitaComCusto / receita) * 100) : 0,
    produtos: linhas,
    categorias: [...categorias]
      .sort(([, a], [, b]) => a.ordem - b.ordem)
      .map(([nome, c]) => ({
        nome,
        quantidade: c.quantidade,
        receitaCentavos: c.receita,
        lucroCentavos: c.lucro,
      })),
    semVenda: parados.rows.map((p) => ({
      produtoId: p.produto_id,
      nome: p.nome,
      categoria: p.categoria,
    })),
  };
};

export type RelatorioProdutos = Awaited<ReturnType<typeof relatorioProdutos>>;
