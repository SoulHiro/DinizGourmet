import { and, asc, desc, eq, gte, lt, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { z } from "zod";

import { db, schema } from "@/db";
import type { ContaImpressa } from "@/db/schema";
import type { Sessao } from "@/lib/auth/sessao";
import { conflito, naoEncontrado } from "@/lib/erros";
import { acordarImpressao, notificar } from "@/lib/runtime";
import { configTaxa } from "./comum";
import { inicioDaNoite } from "./gerencia";
import type { MetodoPagamento } from "./pagamento";
import { calcularTaxa, type MotivoSemTaxa } from "./taxa";

// Tudo que o caixa precisa: conta impressa (pré-conta ou comprovante),
// histórico de contas por dia/horário e o resumo do caixa por método.

const FUSO = "-03:00"; // America/Sao_Paulo (sem horário de verão)

// Mesas da comanda na ordem: principal primeiro. Vale para contas fechadas
// (usa o histórico de comanda_mesa, não só as mesas ainda ligadas).
const mesasDaConta = async (comandaId: string) => {
  const linhas = await db()
    .selectDistinct({
      numero: schema.mesas.numero,
      principal: sql<boolean>`${schema.mesas.id} = ${schema.comandas.mesaPrincipalId}`,
    })
    .from(schema.comandaMesas)
    .innerJoin(schema.mesas, eq(schema.mesas.id, schema.comandaMesas.mesaId))
    .innerJoin(
      schema.comandas,
      eq(schema.comandas.id, schema.comandaMesas.comandaId),
    )
    .where(eq(schema.comandaMesas.comandaId, comandaId));
  return linhas
    .sort(
      (a, b) =>
        Number(b.principal) - Number(a.principal) || a.numero - b.numero,
    )
    .map((l) => l.numero);
};

const buscarComanda = async (restauranteId: string, comandaId: string) => {
  const [comanda] = await db()
    .select()
    .from(schema.comandas)
    .where(
      and(
        eq(schema.comandas.id, comandaId),
        eq(schema.comandas.restauranteId, restauranteId),
      ),
    );
  if (!comanda) throw naoEncontrado("Conta");
  return comanda;
};

// Monta a conta impressa: itens agrupados por produto e preço, totais e,
// se já foi paga, os pagamentos (comprovante).
export const montarConta = async (
  restauranteId: string,
  comandaId: string,
): Promise<{
  mesas: number[];
  numero: number | null;
  conta: ContaImpressa;
}> => {
  const comanda = await buscarComanda(restauranteId, comandaId);
  const [restaurante] = await db()
    .select({ nome: schema.restaurantes.nome })
    .from(schema.restaurantes)
    .where(eq(schema.restaurantes.id, restauranteId));

  const [mesas, itens, garcons, pagos] = await Promise.all([
    mesasDaConta(comandaId),
    db()
      .select({
        quantidade: schema.itensPedido.quantidade,
        nome: schema.itensPedido.nomeProduto,
        totalCentavos: schema.itensPedido.totalCentavos,
        mesaOrigem: schema.mesas.numero,
        modificadores: sql<string[]>`coalesce((
          select array_agg(m.nome order by m.nome) from item_pedido_modificador m
           where m.item_pedido_id = item_pedido.id), '{}')`,
      })
      .from(schema.itensPedido)
      .innerJoin(
        schema.mesas,
        eq(schema.mesas.id, schema.itensPedido.mesaOrigemId),
      )
      .where(
        and(
          eq(schema.itensPedido.comandaId, comandaId),
          eq(schema.itensPedido.status, "ativo"),
        ),
      )
      .orderBy(asc(schema.itensPedido.criadoEm)),
    db()
      .select({
        nome: schema.funcionarios.nome,
        papel: schema.comandaGarcons.papel,
      })
      .from(schema.comandaGarcons)
      .innerJoin(
        schema.funcionarios,
        eq(schema.funcionarios.id, schema.comandaGarcons.funcionarioId),
      )
      .where(eq(schema.comandaGarcons.comandaId, comandaId)),
    db()
      .select()
      .from(schema.pagamentos)
      .where(eq(schema.pagamentos.comandaId, comandaId))
      .orderBy(asc(schema.pagamentos.criadoEm)),
  ]);

  // Mesmo produto, mesmos adicionais e mesma mesa viram uma linha só.
  const agrupados = new Map<string, ContaImpressa["itens"][number]>();
  for (const item of itens) {
    const nome = item.modificadores.length
      ? `${item.nome} (${item.modificadores.join(", ")})`
      : item.nome;
    const chave = `${nome}|${item.mesaOrigem}|${item.totalCentavos / item.quantidade}`;
    const atual = agrupados.get(chave);
    agrupados.set(chave, {
      nome,
      mesaOrigem: item.mesaOrigem,
      quantidade: (atual?.quantidade ?? 0) + item.quantidade,
      totalCentavos: (atual?.totalCentavos ?? 0) + item.totalCentavos,
    });
  }
  const porMesa = new Map<number, number>();
  for (const item of itens) {
    porMesa.set(
      item.mesaOrigem,
      (porMesa.get(item.mesaOrigem) ?? 0) + item.totalCentavos,
    );
  }

  const subtotal = itens.reduce((s, i) => s + i.totalCentavos, 0);
  const aberta = comanda.status === "aberta";
  const desconto = comanda.descontoCentavos ?? 0;
  const config = await configTaxa(db(), restauranteId);
  const taxaSugerida = calcularTaxa(subtotal - desconto, config);
  // Aberta: taxa sugerida (o cliente decide). Fechada: o que foi cobrado.
  const taxa = aberta
    ? taxaSugerida.valorCentavos
    : (comanda.taxaServicoCentavos ?? 0);
  const gorjeta = comanda.gorjetaCentavos ?? 0;

  return {
    mesas,
    numero: comanda.numero,
    conta: {
      restaurante: restaurante?.nome ?? "",
      paga: !aberta,
      abertaEm: comanda.abertaEm.toISOString(),
      fechadaEm: comanda.fechadaEm?.toISOString() ?? null,
      garcons: garcons
        .sort(
          (a, b) =>
            Number(b.papel === "titular") - Number(a.papel === "titular"),
        )
        .map((g) => g.nome),
      itens: [...agrupados.values()],
      porMesa:
        mesas.length > 1
          ? [...porMesa].map(([numero, totalCentavos]) => ({
              numero,
              totalCentavos,
            }))
          : [],
      subtotalCentavos: subtotal,
      descontoCentavos: desconto,
      descontoNome: comanda.descontoNome,
      taxaPct: taxaSugerida.pct,
      taxaCentavos: taxa,
      gorjetaCentavos: gorjeta,
      totalCentavos: subtotal - desconto + taxa + gorjeta,
      pagamentos: pagos.map((p) => ({
        metodo: p.metodo,
        valorCentavos: p.valorCentavos,
        recebidoCentavos: p.recebidoCentavos,
        trocoCentavos: p.trocoCentavos,
      })),
    },
  };
};

export const imprimirContaSchema = z.object({ comandaId: z.uuid() });

// Manda a conta para a impressora do caixa (pré-conta com a mesa aberta,
// comprovante depois de paga). Qualquer funcionário pode pedir.
export const imprimirConta = async (
  sessao: Sessao,
  alvo: z.infer<typeof imprimirContaSchema>,
) => {
  const { restauranteId } = sessao.funcionario;
  const { comandaId } = alvo;

  const [impressora] = await db()
    .select({ id: schema.impressoras.id })
    .from(schema.impressoras)
    .where(
      and(
        eq(schema.impressoras.restauranteId, restauranteId),
        eq(schema.impressoras.setor, "caixa"),
        eq(schema.impressoras.ativa, true),
      ),
    )
    .limit(1);
  if (!impressora) {
    throw conflito(
      "sem_impressora_caixa",
      "Cadastre uma impressora do setor Caixa em /gerente > Impressoras.",
    );
  }

  const { mesas, numero, conta } = await montarConta(restauranteId, comandaId);
  const [trabalho] = await db()
    .insert(schema.trabalhosImpressao)
    .values({
      restauranteId,
      impressoraId: impressora.id,
      tipo: "conta",
      comandaId,
      payload: {
        mesas,
        comanda: numero,
        garcom: sessao.funcionario.nome,
        rodada: 0,
        lancadaEm: new Date().toISOString(),
        itens: [],
        conta,
      },
    })
    .returning({ id: schema.trabalhosImpressao.id });
  acordarImpressao();
  notificar(restauranteId, ["impressao"]);
  return { trabalhoId: trabalho.id, totalCentavos: conta.totalCentavos };
};

// Histórico
export const filtroHistoricoSchema = z.object({
  data: z.iso.date(),
  de: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .optional(),
  ate: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .optional(),
  mesa: z.coerce.number().int().min(1).max(9999).optional(),
  // Número do cartão da comanda.
  comanda: z.coerce.number().int().min(1).max(9999).optional(),
});

export type ContaHistorico = {
  comandaId: string;
  numero: number | null;
  mesas: number[];
  status: "aberta" | "fechada" | "cancelada";
  abertaEm: string;
  fechadaEm: string | null;
  titular: string;
  recebidoPor: string | null;
  subtotalCentavos: number;
  totalCentavos: number;
  metodos: MetodoPagamento[];
};

// Contas abertas no dia (00:00 a 23:59 de Brasília), opcionalmente entre dois
// horários e de uma mesa. Mais novas primeiro.
export const listarHistorico = async (
  restauranteId: string,
  filtro: z.infer<typeof filtroHistoricoSchema>,
): Promise<ContaHistorico[]> => {
  const noHorario = (hora: string, seg: string) =>
    new Date(`${filtro.data}T${hora}:${seg}${FUSO}`);
  const inicio = noHorario(filtro.de ?? "00:00", "00");
  const fim = filtro.ate
    ? noHorario(filtro.ate, "59.999")
    : new Date(noHorario("00:00", "00").getTime() + 24 * 3600 * 1000);

  const titular = alias(schema.funcionarios, "titular");
  const recebedor = alias(schema.funcionarios, "recebedor");
  const linhas = await db()
    .select({
      comandaId: schema.comandas.id,
      status: schema.comandas.status,
      abertaEm: schema.comandas.abertaEm,
      fechadaEm: schema.comandas.fechadaEm,
      numero: schema.comandas.numero,
      titular: titular.nome,
      recebidoPor: recebedor.nome,
      desconto: schema.comandas.descontoCentavos,
      taxa: schema.comandas.taxaServicoCentavos,
      gorjeta: schema.comandas.gorjetaCentavos,
      subtotal: sql<number>`coalesce((select sum(i.total_centavos) from item_pedido i
        where i.comanda_id = comanda.id and i.status = 'ativo'), 0)::int`,
      mesas: sql<
        number[]
      >`(select array_agg(distinct m.numero) from comanda_mesa cm
        join mesa m on m.id = cm.mesa_id where cm.comanda_id = comanda.id)`,
      metodos: sql<
        MetodoPagamento[]
      >`coalesce((select array_agg(distinct p.metodo::text)
        from pagamento p where p.comanda_id = comanda.id), '{}')`,
    })
    .from(schema.comandas)
    .innerJoin(titular, eq(titular.id, schema.comandas.garcomTitularId))
    .leftJoin(recebedor, eq(recebedor.id, schema.comandas.fechadaPor))
    .where(
      and(
        eq(schema.comandas.restauranteId, restauranteId),
        gte(schema.comandas.abertaEm, inicio),
        lt(schema.comandas.abertaEm, fim),
        filtro.comanda ? eq(schema.comandas.numero, filtro.comanda) : undefined,
        filtro.mesa
          ? sql`exists (select 1 from comanda_mesa cm join mesa m on m.id = cm.mesa_id
              where cm.comanda_id = comanda.id and m.numero = ${filtro.mesa})`
          : undefined,
      ),
    )
    .orderBy(desc(schema.comandas.abertaEm))
    .limit(500);

  return linhas.map((l) => ({
    comandaId: l.comandaId,
    numero: l.numero,
    mesas: (l.mesas ?? []).sort((a, b) => a - b),
    status: l.status,
    abertaEm: l.abertaEm.toISOString(),
    fechadaEm: l.fechadaEm?.toISOString() ?? null,
    titular: l.titular,
    recebidoPor: l.recebidoPor,
    subtotalCentavos: l.subtotal,
    totalCentavos:
      l.subtotal - (l.desconto ?? 0) + (l.taxa ?? 0) + (l.gorjeta ?? 0),
    metodos: l.metodos,
  }));
};

// Tudo sobre uma conta: rodadas e itens (inclusive cancelados, com quem e
// por quê), equipe, pagamentos, desconto, taxa, gorjeta e a divisão.
export const detalheDaConta = async (
  restauranteId: string,
  comandaId: string,
) => {
  const comanda = await buscarComanda(restauranteId, comandaId);
  const cancelador = alias(schema.funcionarios, "cancelador");
  const recebedor = alias(schema.funcionarios, "recebedor");

  const [
    { mesas, conta },
    rodadas,
    itens,
    equipe,
    pagos,
    repasses,
    fechadaPor,
  ] = await Promise.all([
    montarConta(restauranteId, comandaId),
    db()
      .select({
        id: schema.rodadas.id,
        numero: schema.rodadas.numero,
        lancadaEm: schema.rodadas.lancadaEm,
        garcom: schema.funcionarios.nome,
      })
      .from(schema.rodadas)
      .innerJoin(
        schema.funcionarios,
        eq(schema.funcionarios.id, schema.rodadas.funcionarioId),
      )
      .where(eq(schema.rodadas.comandaId, comandaId))
      .orderBy(asc(schema.rodadas.numero)),
    db()
      .select({
        id: schema.itensPedido.id,
        rodadaId: schema.itensPedido.rodadaId,
        quantidade: schema.itensPedido.quantidade,
        nome: schema.itensPedido.nomeProduto,
        totalCentavos: schema.itensPedido.totalCentavos,
        observacao: schema.itensPedido.observacao,
        status: schema.itensPedido.status,
        mesaOrigem: schema.mesas.numero,
        canceladoPor: cancelador.nome,
        canceladoEm: schema.itensPedido.canceladoEm,
        motivo: schema.itensPedido.motivoCancelamento,
        editado: sql<boolean>`${schema.itensPedido.substituiItemId} is not null`,
        modificadores: sql<string[]>`coalesce((
            select array_agg(m.nome order by m.nome) from item_pedido_modificador m
             where m.item_pedido_id = item_pedido.id), '{}')`,
      })
      .from(schema.itensPedido)
      .innerJoin(
        schema.mesas,
        eq(schema.mesas.id, schema.itensPedido.mesaOrigemId),
      )
      .leftJoin(cancelador, eq(cancelador.id, schema.itensPedido.canceladoPor))
      .where(eq(schema.itensPedido.comandaId, comandaId))
      .orderBy(asc(schema.itensPedido.criadoEm)),
    db()
      .select({
        nome: schema.funcionarios.nome,
        papel: schema.comandaGarcons.papel,
      })
      .from(schema.comandaGarcons)
      .innerJoin(
        schema.funcionarios,
        eq(schema.funcionarios.id, schema.comandaGarcons.funcionarioId),
      )
      .where(eq(schema.comandaGarcons.comandaId, comandaId)),
    db()
      .select({
        id: schema.pagamentos.id,
        metodo: schema.pagamentos.metodo,
        metodoOriginal: schema.pagamentos.metodoOriginal,
        valorCentavos: schema.pagamentos.valorCentavos,
        recebidoCentavos: schema.pagamentos.recebidoCentavos,
        trocoCentavos: schema.pagamentos.trocoCentavos,
        recebidoPor: recebedor.nome,
        em: schema.pagamentos.criadoEm,
      })
      .from(schema.pagamentos)
      .innerJoin(recebedor, eq(recebedor.id, schema.pagamentos.funcionarioId))
      .where(eq(schema.pagamentos.comandaId, comandaId))
      .orderBy(asc(schema.pagamentos.criadoEm)),
    db()
      .select({
        nome: schema.funcionarios.nome,
        tipo: schema.gorjetaDivisoes.tipo,
        valorCentavos: schema.gorjetaDivisoes.valorCentavos,
      })
      .from(schema.gorjetaDivisoes)
      .innerJoin(
        schema.funcionarios,
        eq(schema.funcionarios.id, schema.gorjetaDivisoes.funcionarioId),
      )
      .where(eq(schema.gorjetaDivisoes.comandaId, comandaId)),
    comanda.fechadaPor
      ? db()
          .select({ nome: schema.funcionarios.nome })
          .from(schema.funcionarios)
          .where(eq(schema.funcionarios.id, comanda.fechadaPor))
      : Promise.resolve([]),
  ]);

  return {
    comandaId,
    numero: comanda.numero,
    status: comanda.status,
    mesas,
    abertaEm: comanda.abertaEm.toISOString(),
    fechadaEm: comanda.fechadaEm?.toISOString() ?? null,
    recebidoPor: fechadaPor[0]?.nome ?? null,
    reabertaEm: comanda.reabertaEm?.toISOString() ?? null,
    reabertaMotivo: comanda.reabertaMotivo,
    equipe,
    conta,
    semTaxaMotivo: comanda.semTaxaMotivo as MotivoSemTaxa | null,
    semTaxaObservacao: comanda.semTaxaObservacao,
    rodadas: rodadas.map((r) => ({
      numero: r.numero,
      lancadaEm: r.lancadaEm.toISOString(),
      garcom: r.garcom,
      itens: itens
        .filter((i) => i.rodadaId === r.id)
        .map((i) => ({
          id: i.id,
          quantidade: i.quantidade,
          nome: i.nome,
          modificadores: i.modificadores,
          observacao: i.observacao,
          totalCentavos: i.totalCentavos,
          mesaOrigem: i.mesaOrigem,
          status: i.status,
          editado: i.editado,
          canceladoPor: i.canceladoPor,
          canceladoEm: i.canceladoEm?.toISOString() ?? null,
          motivo: i.motivo,
        })),
    })),
    pagamentos: pagos.map((p) => ({ ...p, em: p.em.toISOString() })),
    repasses,
  };
};

export type DetalheConta = Awaited<ReturnType<typeof detalheDaConta>>;

// Resumo do caixa de um turno (12h do dia até 12h do dia seguinte, como a
// aba Noite): quanto entrou por método, taxa, gorjeta, descontos e troco.
export const resumoCaixa = async (restauranteId: string, data?: string) => {
  const desde = data ? new Date(`${data}T12:00:00${FUSO}`) : inicioDaNoite();
  const ate = new Date(desde.getTime() + 24 * 3600 * 1000);

  const [porMetodo, [totais]] = await Promise.all([
    db()
      .select({
        metodo: schema.pagamentos.metodo,
        quantidade: sql<number>`count(*)::int`,
        valorCentavos: sql<number>`sum(${schema.pagamentos.valorCentavos})::int`,
        trocoCentavos: sql<number>`sum(${schema.pagamentos.trocoCentavos})::int`,
      })
      .from(schema.pagamentos)
      .innerJoin(
        schema.comandas,
        eq(schema.comandas.id, schema.pagamentos.comandaId),
      )
      .where(
        and(
          eq(schema.pagamentos.restauranteId, restauranteId),
          gte(schema.comandas.fechadaEm, desde),
          lt(schema.comandas.fechadaEm, ate),
        ),
      )
      .groupBy(schema.pagamentos.metodo),
    db()
      .select({
        contas: sql<number>`count(*) filter (where ${schema.comandas.status} = 'fechada')::int`,
        consumo: sql<number>`coalesce(sum((select sum(i.total_centavos) from item_pedido i
          where i.comanda_id = comanda.id and i.status = 'ativo')), 0)::int`,
        taxa: sql<number>`coalesce(sum(${schema.comandas.taxaServicoCentavos}), 0)::int`,
        gorjeta: sql<number>`coalesce(sum(${schema.comandas.gorjetaCentavos}), 0)::int`,
        desconto: sql<number>`coalesce(sum(${schema.comandas.descontoCentavos}), 0)::int`,
        semTaxa: sql<number>`count(${schema.comandas.semTaxaMotivo})::int`,
      })
      .from(schema.comandas)
      .where(
        and(
          eq(schema.comandas.restauranteId, restauranteId),
          gte(schema.comandas.fechadaEm, desde),
          lt(schema.comandas.fechadaEm, ate),
        ),
      ),
  ]);

  // Recebido por hora (Brasília) e o total do turno anterior, para comparar.
  const [porHora, anterior, motivosSemTaxa] = await Promise.all([
    db().execute<{ hora: number; centavos: number }>(sql`
      select extract(hour from p.criado_em at time zone 'America/Sao_Paulo')::int as hora,
             sum(p.valor_centavos)::int as centavos
        from pagamento p
        join comanda c on c.id = p.comanda_id
       where p.restaurante_id = ${restauranteId}
         and c.fechada_em >= ${desde} and c.fechada_em < ${ate}
       group by 1
    `),
    db().execute<{ total: number; contas: number }>(sql`
      select coalesce(sum(coalesce((select sum(i.total_centavos) from item_pedido i
               where i.comanda_id = c.id and i.status = 'ativo'), 0)
               - coalesce(c.desconto_centavos, 0) + coalesce(c.taxa_servico_centavos, 0)
               + coalesce(c.gorjeta_centavos, 0)), 0)::int as total,
             count(*)::int as contas
        from comanda c
       where c.restaurante_id = ${restauranteId} and c.status = 'fechada'
         and c.fechada_em >= ${new Date(desde.getTime() - 24 * 3600 * 1000)}
         and c.fechada_em < ${desde}
    `),
    db().execute<{ motivo: MotivoSemTaxa; quantidade: number }>(sql`
      select sem_taxa_motivo as motivo, count(*)::int as quantidade
        from comanda
       where restaurante_id = ${restauranteId} and sem_taxa_motivo is not null
         and fechada_em >= ${desde} and fechada_em < ${ate}
       group by 1 order by 2 desc
    `),
  ]);

  const [{ abertas, emAberto }] = await db()
    .select({
      abertas: sql<number>`count(*)::int`,
      emAberto: sql<number>`coalesce(sum((select sum(i.total_centavos) from item_pedido i
        where i.comanda_id = comanda.id and i.status = 'ativo')), 0)::int`,
    })
    .from(schema.comandas)
    .where(
      and(
        eq(schema.comandas.restauranteId, restauranteId),
        eq(schema.comandas.status, "aberta"),
      ),
    );

  const recebido = porMetodo.reduce((s, m) => s + m.valorCentavos, 0);
  const total = totais.consumo - totais.desconto + totais.taxa + totais.gorjeta;
  return {
    desde: desde.toISOString(),
    ate: ate.toISOString(),
    contas: totais.contas,
    contasAbertasAgora: abertas,
    emAbertoCentavos: emAberto,
    anteriorTotalCentavos: anterior.rows[0]?.total ?? 0,
    anteriorContas: anterior.rows[0]?.contas ?? 0,
    porHora: porHora.rows,
    motivosSemTaxa: motivosSemTaxa.rows,
    consumoCentavos: totais.consumo,
    descontoCentavos: totais.desconto,
    taxaCentavos: totais.taxa,
    gorjetaCentavos: totais.gorjeta,
    totalCentavos: total,
    ticketMedioCentavos: totais.contas ? Math.round(total / totais.contas) : 0,
    contasSemTaxa: totais.semTaxa,
    porMetodo: porMetodo.sort((a, b) => b.valorCentavos - a.valorCentavos),
    recebidoCentavos: recebido,
    // Contas fechadas sem método registrado (ex.: antes desta versão).
    semMetodoCentavos: Math.max(0, total - recebido),
    // Dinheiro que deve estar na gaveta = recebido em dinheiro (o troco já
    // saiu do que o cliente entregou).
    dinheiroNaGavetaCentavos:
      porMetodo.find((m) => m.metodo === "dinheiro")?.valorCentavos ?? 0,
  };
};

export type ResumoCaixa = Awaited<ReturnType<typeof resumoCaixa>>;
