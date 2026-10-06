import { sql } from "drizzle-orm";

import { db } from "@/db";
import { inicioDaNoite, resumoNoite } from "./gerencia";

// Painel da noite do gerente: números, gráficos e alertas de uma noite
// (meio-dia até o meio-dia seguinte, horário de Brasília). Noites anteriores
// pelo deslocamento (1 = ontem). Tudo vem de consultas agregadas no banco.

const HORA = 3_600_000;
const FUSO = "America/Sao_Paulo";

export type MetodoPagamento =
  | "dinheiro"
  | "credito"
  | "debito"
  | "pix"
  | "vale_refeicao";

const vendasNoPeriodo = async (
  restauranteId: string,
  desde: Date,
  ate: Date,
) => {
  const [linha] = (
    await db().execute<{ centavos: number; itens: number }>(sql`
      select coalesce(sum(i.total_centavos), 0)::int as centavos,
             coalesce(sum(i.quantidade), 0)::int as itens
        from item_pedido i
        join rodada r on r.id = i.rodada_id
       where r.restaurante_id = ${restauranteId} and i.status = 'ativo'
         and r.lancada_em >= ${desde} and r.lancada_em < ${ate}
    `)
  ).rows;
  return linha ?? { centavos: 0, itens: 0 };
};

type Periodo = {
  desde: Date;
  ate: Date;
  // Período anterior do mesmo tamanho, para a comparação de vendas.
  desdeAnterior: Date;
  ateAnterior: Date;
  aoVivo: boolean;
  dias: number;
};

// Uma noite: 0 = hoje (até agora), 1 = ontem...
export const painelNoite = (restauranteId: string, deslocamento = 0) => {
  const agora = new Date();
  const desde = new Date(
    inicioDaNoite(agora).getTime() - deslocamento * 24 * HORA,
  );
  const ate =
    deslocamento === 0 ? agora : new Date(desde.getTime() + 24 * HORA);
  // Comparação justa: a noite anterior até o mesmo ponto desta.
  return montarPainel(restauranteId, {
    desde,
    ate,
    desdeAnterior: new Date(desde.getTime() - 24 * HORA),
    ateAnterior: new Date(ate.getTime() - 24 * HORA),
    aoVivo: deslocamento === 0,
    dias: 1,
  });
};

// Últimas N noites (incluindo hoje), comparadas com as N anteriores.
export const painelPeriodo = (restauranteId: string, dias: number) => {
  const agora = new Date();
  const desde = new Date(
    inicioDaNoite(agora).getTime() - (dias - 1) * 24 * HORA,
  );
  const recuo = dias * 24 * HORA;
  return montarPainel(restauranteId, {
    desde,
    ate: agora,
    desdeAnterior: new Date(desde.getTime() - recuo),
    ateAnterior: new Date(agora.getTime() - recuo),
    aoVivo: false,
    dias,
  });
};

const montarPainel = async (
  restauranteId: string,
  { desde, ate, desdeAnterior, ateAnterior, aoVivo, dias }: Periodo,
) => {
  const [
    vendas,
    vendasAnterior,
    porHora,
    porCategoria,
    topProdutos,
    pagamentos,
    comandas,
    mesas,
    chamados,
    cancelamentos,
    estoque,
    resumo,
    canceladosLista,
    porNoite,
  ] = await Promise.all([
    vendasNoPeriodo(restauranteId, desde, ate),
    vendasNoPeriodo(restauranteId, desdeAnterior, ateAnterior),
    db().execute<{ hora: number; centavos: number }>(sql`
      select extract(hour from r.lancada_em at time zone ${FUSO})::int as hora,
             sum(i.total_centavos)::int as centavos
        from item_pedido i
        join rodada r on r.id = i.rodada_id
       where r.restaurante_id = ${restauranteId} and i.status = 'ativo'
         and r.lancada_em >= ${desde} and r.lancada_em < ${ate}
       group by 1
    `),
    db().execute<{ categoria: string; centavos: number; itens: number }>(sql`
      select cat.nome as categoria,
             sum(i.total_centavos)::int as centavos,
             sum(i.quantidade)::int as itens
        from item_pedido i
        join rodada r on r.id = i.rodada_id
        join produto p on p.id = i.produto_id
        join categoria cat on cat.id = p.categoria_id
       where r.restaurante_id = ${restauranteId} and i.status = 'ativo'
         and r.lancada_em >= ${desde} and r.lancada_em < ${ate}
       group by cat.nome, cat.ordem
       order by cat.ordem
    `),
    db().execute<{ nome: string; quantidade: number; centavos: number }>(sql`
      select i.nome_produto as nome,
             sum(i.quantidade)::int as quantidade,
             sum(i.total_centavos)::int as centavos
        from item_pedido i
        join rodada r on r.id = i.rodada_id
       where r.restaurante_id = ${restauranteId} and i.status = 'ativo'
         and r.lancada_em >= ${desde} and r.lancada_em < ${ate}
       group by i.nome_produto
       order by quantidade desc, centavos desc
       limit ${dias > 1 ? 10 : 6}
    `),
    db().execute<{
      metodo: MetodoPagamento;
      centavos: number;
      quantidade: number;
    }>(sql`
      select metodo, sum(valor_centavos)::int as centavos, count(*)::int as quantidade
        from pagamento
       where restaurante_id = ${restauranteId}
         and criado_em >= ${desde} and criado_em < ${ate}
       group by metodo
       order by centavos desc
    `),
    db().execute<{
      fechadas: number;
      abertas: number;
      total_fechadas: number;
      permanencia_min: number | null;
    }>(sql`
      select
        (select count(*) from comanda
          where restaurante_id = ${restauranteId} and status = 'fechada'
            and fechada_em >= ${desde} and fechada_em < ${ate})::int as fechadas,
        (select count(*) from comanda
          where restaurante_id = ${restauranteId} and status = 'aberta')::int as abertas,
        (select coalesce(sum(i.total_centavos), 0) from item_pedido i
           join comanda c on c.id = i.comanda_id
          where c.restaurante_id = ${restauranteId} and c.status = 'fechada'
            and i.status = 'ativo'
            and c.fechada_em >= ${desde} and c.fechada_em < ${ate})::int as total_fechadas,
        (select avg(extract(epoch from fechada_em - aberta_em) / 60) from comanda
          where restaurante_id = ${restauranteId} and status = 'fechada'
            and fechada_em >= ${desde} and fechada_em < ${ate})::int as permanencia_min
    `),
    db().execute<{ ativas: number; ocupadas: number }>(sql`
      select
        (select count(*) from mesa
          where restaurante_id = ${restauranteId} and ativa)::int as ativas,
        (select count(distinct cm.mesa_id) from comanda_mesa cm
           join comanda c on c.id = cm.comanda_id
          where c.restaurante_id = ${restauranteId} and c.status = 'aberta'
            and cm.saiu_em is null)::int as ocupadas
    `),
    db().execute<{
      total: number;
      espera_seg: number | null;
      pendentes: number;
    }>(sql`
      select count(*)::int as total,
             avg(extract(epoch from aceito_em - criado_em))
               filter (where aceito_em is not null)::int as espera_seg,
             (select count(*) from chamado
               where restaurante_id = ${restauranteId} and encerrado_em is null
                 and aceito_em is null)::int as pendentes
        from chamado
       where restaurante_id = ${restauranteId}
         and criado_em >= ${desde} and criado_em < ${ate}
    `),
    db().execute<{ quantidade: number; centavos: number }>(sql`
      select coalesce(sum(i.quantidade), 0)::int as quantidade,
             coalesce(sum(i.total_centavos), 0)::int as centavos
        from item_pedido i
        join comanda c on c.id = i.comanda_id
       where c.restaurante_id = ${restauranteId} and i.status = 'cancelado'
         and i.motivo_cancelamento <> 'Alterado'
         and i.cancelado_em >= ${desde} and i.cancelado_em < ${ate}
    `),
    db().execute<{ nome: string; estoque: number }>(sql`
      select nome, estoque from insumo
       where restaurante_id = ${restauranteId} and ativo
         and estoque is not null and estoque <= 5
       order by estoque, nome
    `),
    resumoNoite(restauranteId, desde, ate),
    // Quais itens, de que mesa, quem cancelou e por quê.
    db().execute<{
      id: string;
      nome: string;
      quantidade: number;
      centavos: number;
      mesa: number;
      comanda: number | null;
      motivo: string | null;
      preparo_iniciado: boolean | null;
      quem: string | null;
      quando: string;
    }>(sql`
      select i.id, i.nome_produto as nome, i.quantidade,
             i.total_centavos as centavos, m.numero as mesa,
             c.numero as comanda, i.motivo_cancelamento as motivo,
             i.preparo_iniciado, f.nome as quem, i.cancelado_em as quando
        from item_pedido i
        join comanda c on c.id = i.comanda_id
        join mesa m on m.id = i.mesa_origem_id
        left join funcionario f on f.id = i.cancelado_por
       where c.restaurante_id = ${restauranteId} and i.status = 'cancelado'
         and i.motivo_cancelamento <> 'Alterado'
         and i.cancelado_em >= ${desde} and i.cancelado_em < ${ate}
       order by i.cancelado_em desc
       limit 100
    `),
    // Faturamento por noite (a noite vai do meio-dia ao meio-dia).
    db().execute<{ noite: string; centavos: number }>(sql`
      select to_char((r.lancada_em at time zone ${FUSO}) - interval '12 hours',
                     'YYYY-MM-DD') as noite,
             sum(i.total_centavos)::int as centavos
        from item_pedido i
        join rodada r on r.id = i.rodada_id
       where r.restaurante_id = ${restauranteId} and i.status = 'ativo'
         and r.lancada_em >= ${desde} and r.lancada_em < ${ate}
       group by 1
    `),
  ]);

  const vendasPorNoite = Array.from({ length: dias }, (_, d) => {
    const noite = new Date(
      desde.getTime() + d * 24 * HORA + HORA,
    ).toLocaleDateString("sv-SE", { timeZone: FUSO });
    return {
      noite,
      centavos: porNoite.rows.find((n) => n.noite === noite)?.centavos ?? 0,
    };
  });

  // Horas com venda, preenchendo os buracos (ex.: 18h a 0h).
  const horas = porHora.rows.map((h) => h.hora);
  const ordemHora = (h: number) => (h < 12 ? h + 24 : h);
  const primeira = horas.length ? Math.min(...horas.map(ordemHora)) : 18;
  const ultima = horas.length ? Math.max(...horas.map(ordemHora)) : 23;
  const vendasPorHora = [];
  for (let h = Math.min(primeira, 18); h <= Math.max(ultima, 23); h++) {
    const hora = h % 24;
    vendasPorHora.push({
      hora,
      centavos: porHora.rows.find((r) => r.hora === hora)?.centavos ?? 0,
    });
  }

  const c = comandas.rows[0];
  const ch = chamados.rows[0];

  return {
    desde: desde.toISOString(),
    ate: ate.toISOString(),
    aoVivo,
    dias,
    vendasPorNoite,
    vendas: {
      centavos: vendas.centavos,
      itens: vendas.itens,
      anteriorCentavos: vendasAnterior.centavos,
    },
    recebidoCentavos: pagamentos.rows.reduce((s, p) => s + p.centavos, 0),
    comandas: {
      fechadas: c?.fechadas ?? 0,
      abertas: c?.abertas ?? 0,
      ticketMedioCentavos: c?.fechadas
        ? Math.round(c.total_fechadas / c.fechadas)
        : 0,
      permanenciaMin: c?.permanencia_min ?? null,
    },
    mesas: mesas.rows[0] ?? { ativas: 0, ocupadas: 0 },
    chamados: {
      total: ch?.total ?? 0,
      esperaMediaSeg: ch?.espera_seg ?? null,
      pendentes: ch?.pendentes ?? 0,
    },
    cancelamentos: cancelamentos.rows[0] ?? { quantidade: 0, centavos: 0 },
    cancelados: canceladosLista.rows.map((c) => ({
      id: c.id,
      nome: c.nome,
      quantidade: c.quantidade,
      centavos: c.centavos,
      mesa: c.mesa,
      comanda: c.comanda,
      motivo: c.motivo,
      preparoIniciado: c.preparo_iniciado,
      quem: c.quem,
      quando: new Date(c.quando).toISOString(),
    })),
    vendasPorHora,
    porCategoria: porCategoria.rows,
    topProdutos: topProdutos.rows,
    pagamentos: pagamentos.rows,
    estoqueBaixo: estoque.rows,
    garcons: resumo.garcons,
    gorjetaCentavos: resumo.totalGorjetaCentavos,
    taxaCentavos: resumo.totalTaxaCentavos,
    descontoCentavos: resumo.totalDescontoCentavos,
    semTaxa: resumo.semTaxa,
  };
};

export type PainelNoite = Awaited<ReturnType<typeof painelNoite>>;
