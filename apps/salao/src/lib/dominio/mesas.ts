import { and, asc, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { z } from "zod";

import { type Db, db, schema, type Tx } from "@/db";
import type { Sessao } from "@/lib/auth/sessao";
import {
  conflito,
  invalido,
  naoEncontrado,
  semPermissao,
  violouConstraint,
} from "@/lib/erros";
import { notificar } from "@/lib/runtime";
import { formatBRL } from "@/lib/utils";
import {
  buscarComandaAberta,
  buscarMesa,
  comandasAbertasDaMesa,
  configTaxa,
  inicioDaNoite,
  mesasDaComanda,
  registrarGarcom,
  subtotalDaComanda,
} from "./comum";
import { dividirGorjeta } from "./gorjeta";
import { conferirPagamentos, METODOS_PAGAMENTO, trocoDe } from "./pagamento";
import { calcularTaxa, MOTIVOS_SEM_TAXA, valorDoDesconto } from "./taxa";

// Status derivado (nunca gravado): vem das comandas abertas na mesa, das
// rodadas e dos chamados.
export type StatusMesa =
  | "livre"
  | "aguardando"
  | "ocupada"
  | "chamado"
  | "conta";

export type MesaMapa = {
  id: string;
  numero: number;
  status: StatusMesa;
  // Comandas (cartões) abertas nesta mesa agora.
  comandas: { id: string; numero: number | null }[];
  // Garçons titulares das comandas da mesa.
  garcons: string[];
  // Titulares e auxiliares (filtro "Minhas mesas").
  garcomIds: string[];
  // Da comanda mais antiga da mesa.
  abertaEm: string | null;
  ultimaRodadaEm: string | null;
  totalCentavos: number;
  ajudaPendente: boolean;
};

export const listarMapa = async (
  restauranteId: string,
): Promise<MesaMapa[]> => {
  const linhas = await db().execute<{
    id: string;
    numero: number;
    comandas: { id: string; numero: number | null }[] | null;
    garcons: string[] | null;
    garcom_ids: string[] | null;
    aberta_em: Date | null;
    rodadas: number;
    ultima_rodada_em: Date | null;
    ajuda: boolean;
    chamado: "garcom" | "conta" | null;
    total: number;
  }>(sql`
    select m.id, m.numero,
           ab.comandas, ab.garcons, ab.garcom_ids, ab.aberta_em,
           coalesce(ab.rodadas, 0)::int as rodadas, ab.ultima_rodada_em,
           coalesce(ab.total, 0)::int as total,
           exists (
             select 1 from pedido_ajuda pa
              where pa.mesa_id = m.id and pa.encerrado_em is null and pa.aceito_por is null
           ) as ajuda,
           (
             select ch.tipo from chamado ch
              where ch.mesa_id = m.id and ch.encerrado_em is null
              order by (ch.tipo = 'conta') desc
              limit 1
           ) as chamado
      from mesa m
      left join lateral (
        select json_agg(json_build_object('id', c.id, 'numero', c.numero)
                        order by c.numero nulls first, c.aberta_em) as comandas,
               array_agg(distinct f.nome) as garcons,
               -- Titular e auxiliares: base do filtro "Minhas mesas".
               array(select distinct x from unnest(
                 array_agg(c.garcom_titular_id) ||
                 coalesce(array_agg(aux.funcionario_id) filter (where aux.funcionario_id is not null), '{}')
               ) as x) as garcom_ids,
               min(c.aberta_em) as aberta_em,
               sum((select count(*) from rodada r where r.comanda_id = c.id)) as rodadas,
               max((select max(r.lancada_em) from rodada r where r.comanda_id = c.id)) as ultima_rodada_em,
               sum((select coalesce(sum(i.total_centavos), 0) from item_pedido i
                     where i.comanda_id = c.id and i.status = 'ativo')) as total
          from comanda_mesa cm
          join comanda c on c.id = cm.comanda_id and c.status = 'aberta'
          join funcionario f on f.id = c.garcom_titular_id
          left join comanda_garcom aux on aux.comanda_id = c.id
         where cm.mesa_id = m.id and cm.saiu_em is null
      ) ab on true
     where m.restaurante_id = ${restauranteId} and m.ativa
     order by m.numero
  `);

  return linhas.rows.map((linha) => {
    const comandas = linha.comandas ?? [];
    return {
      id: linha.id,
      numero: linha.numero,
      // Pedido de conta > chamou garçom > ocupada > aguardando > livre.
      status:
        linha.chamado === "conta"
          ? "conta"
          : linha.chamado === "garcom"
            ? "chamado"
            : !comandas.length
              ? "livre"
              : linha.rodadas > 0
                ? "ocupada"
                : "aguardando",
      comandas,
      garcons: linha.garcons ?? [],
      garcomIds: linha.garcom_ids ?? [],
      abertaEm: linha.aberta_em
        ? new Date(linha.aberta_em).toISOString()
        : null,
      ultimaRodadaEm: linha.ultima_rodada_em
        ? new Date(linha.ultima_rodada_em).toISOString()
        : null,
      totalCentavos: linha.total,
      ajudaPendente: linha.ajuda,
    };
  });
};

export type ComandaDaMesa = {
  id: string;
  numero: number | null;
  titular: string;
  abertaEm: string;
  totalCentavos: number;
  rodadas: number;
  pediuConta: boolean;
  // "2× Xis Bagual, 3× Heineken 600ml" (o que já foi pedido).
  resumo: string | null;
};

export type MesaComComandas = Awaited<ReturnType<typeof detalharMesa>>;

// Tela da mesa: as comandas (cartões) que estão nela agora.
export const detalharMesa = async (restauranteId: string, mesaId: string) => {
  const mesa = await buscarMesa(db(), restauranteId, mesaId);
  const linhas = await db().execute<{
    id: string;
    numero: number | null;
    titular: string;
    aberta_em: Date;
    total: number;
    rodadas: number;
    pediu_conta: boolean;
    resumo: string | null;
  }>(sql`
    select c.id, c.numero, f.nome as titular, c.aberta_em,
           (select string_agg(q || '× ' || nome, ', ' order by q desc, nome)
              from (select i.nome_produto as nome, sum(i.quantidade) as q
                      from item_pedido i
                     where i.comanda_id = c.id and i.status = 'ativo'
                     group by i.nome_produto) itens) as resumo,
           coalesce((select sum(i.total_centavos) from item_pedido i
                      where i.comanda_id = c.id and i.status = 'ativo'), 0)::int as total,
           (select count(*) from rodada r where r.comanda_id = c.id)::int as rodadas,
           exists (select 1 from chamado ch where ch.comanda_id = c.id
                    and ch.tipo = 'conta' and ch.encerrado_em is null) as pediu_conta
      from comanda_mesa cm
      join comanda c on c.id = cm.comanda_id and c.status = 'aberta'
      join funcionario f on f.id = c.garcom_titular_id
     where cm.mesa_id = ${mesaId} and cm.saiu_em is null
     order by c.numero nulls first, c.aberta_em
  `);
  return {
    mesa: { id: mesa.id, numero: mesa.numero },
    comandas: linhas.rows.map(
      (l): ComandaDaMesa => ({
        id: l.id,
        numero: l.numero,
        titular: l.titular,
        abertaEm: new Date(l.aberta_em).toISOString(),
        totalCentavos: l.total,
        rodadas: l.rodadas,
        pediuConta: l.pediu_conta,
        resumo: l.resumo,
      }),
    ),
  };
};

export const abrirComandaSchema = z.object({
  mesaId: z.uuid(),
  numero: z.coerce.number().int().min(1).max(9999),
});

// Abre a comanda de um cartão numa mesa. Dois garçons abrindo o mesmo cartão
// no mesmo instante: o índice único (um cartão, uma comanda aberta) barra o
// segundo, que recebe a mesa onde o cartão já está.
export const abrirComanda = async (
  sessao: Sessao,
  { mesaId, numero }: z.infer<typeof abrirComandaSchema>,
) => {
  const { restauranteId } = sessao.funcionario;
  try {
    const comanda = await db().transaction(async (tx) => {
      await buscarMesa(tx, restauranteId, mesaId);
      const [cartao] = await tx
        .select()
        .from(schema.cartoesComanda)
        .where(
          and(
            eq(schema.cartoesComanda.restauranteId, restauranteId),
            eq(schema.cartoesComanda.numero, numero),
          ),
        );
      if (!cartao?.ativo) {
        throw naoEncontrado(`Cartão ${numero}`);
      }
      const [nova] = await tx
        .insert(schema.comandas)
        .values({
          restauranteId,
          mesaPrincipalId: mesaId,
          garcomTitularId: sessao.funcionario.id,
          cartaoId: cartao.id,
          numero,
        })
        .returning();
      await tx
        .insert(schema.comandaMesas)
        .values({ comandaId: nova.id, mesaId });
      await registrarGarcom(tx, nova.id, sessao.funcionario.id, "titular");
      return nova;
    });
    notificar(restauranteId, ["mesas"]);
    return { comandaId: comanda.id, numero };
  } catch (error) {
    if (!violouConstraint(error, "comanda_cartao_aberta_idx")) throw error;
    const aberta = await comandaPorNumero(restauranteId, numero);
    throw conflito(
      "cartao_em_uso",
      `O cartão ${numero} já está aberto na mesa ${aberta.mesaNumero}.`,
      aberta,
    );
  }
};

// Acha a comanda aberta de um cartão (número digitado ou lido no código de
// barras), para o garçom e o caixa irem direto nela.
export const comandaPorNumero = async (
  restauranteId: string,
  numero: number,
) => {
  const [linha] = await db()
    .select({
      comandaId: schema.comandas.id,
      mesaId: schema.mesas.id,
      mesaNumero: schema.mesas.numero,
    })
    .from(schema.comandas)
    .innerJoin(
      schema.comandaMesas,
      and(
        eq(schema.comandaMesas.comandaId, schema.comandas.id),
        isNull(schema.comandaMesas.saiuEm),
      ),
    )
    .innerJoin(schema.mesas, eq(schema.mesas.id, schema.comandaMesas.mesaId))
    .where(
      and(
        eq(schema.comandas.restauranteId, restauranteId),
        eq(schema.comandas.numero, numero),
        eq(schema.comandas.status, "aberta"),
      ),
    )
    .limit(1);
  if (!linha) throw naoEncontrado(`Comanda aberta com o cartão ${numero}`);
  return linha;
};

export type DetalheComanda = Awaited<ReturnType<typeof detalharComanda>>;
// Nome antigo, ainda usado pelas telas de recebimento.
export type DetalheMesa = DetalheComanda;

// Tudo que a tela da comanda precisa: a mesa em que está, a equipe e o
// histórico de rodadas (somente leitura, cada rodada é imutável).
export const detalharComanda = async (
  restauranteId: string,
  comandaId: string,
) => {
  const comanda = await buscarComandaAberta(db(), restauranteId, comandaId);
  const [mesaAtual] = await mesasDaComanda(db(), comanda.id);
  const mesa = await buscarMesa(db(), restauranteId, mesaAtual.id);

  const [mesas, titular, rodadas] = await Promise.all([
    mesasDaComanda(db(), comanda.id),
    db()
      .select({ nome: schema.funcionarios.nome })
      .from(schema.funcionarios)
      .where(eq(schema.funcionarios.id, comanda.garcomTitularId)),
    db().query.rodadas.findMany({
      where: eq(schema.rodadas.comandaId, comanda.id),
      orderBy: [desc(schema.rodadas.numero)],
      with: {
        funcionario: { columns: { nome: true } },
        itens: {
          orderBy: [asc(schema.itensPedido.criadoEm)],
          with: {
            modificadores: {
              columns: {
                modificadorId: true,
                nome: true,
                tipo: true,
                precoCentavos: true,
              },
            },
            mesaOrigem: { columns: { numero: true } },
          },
        },
      },
    }),
  ]);

  // Titular + auxiliares e quanto cada um lançou (prévia da divisão da gorjeta).
  const bases = await basesGorjeta(db(), comanda.id);
  const papeis = await db()
    .select({
      id: schema.funcionarios.id,
      nome: schema.funcionarios.nome,
      papel: schema.comandaGarcons.papel,
    })
    .from(schema.funcionarios)
    .leftJoin(
      schema.comandaGarcons,
      and(
        eq(schema.comandaGarcons.funcionarioId, schema.funcionarios.id),
        eq(schema.comandaGarcons.comandaId, comanda.id),
      ),
    )
    .where(
      inArray(
        schema.funcionarios.id,
        bases.map((b) => b.funcionarioId),
      ),
    );
  const equipe = bases
    .map((b) => {
      const f = papeis.find((p) => p.id === b.funcionarioId);
      return {
        id: b.funcionarioId,
        nome: f?.nome ?? "",
        papel: f?.papel ?? ("auxiliar" as const),
        baseCentavos: b.baseCentavos,
      };
    })
    .sort(
      (a, b) => Number(b.papel === "titular") - Number(a.papel === "titular"),
    );

  const statusImpressao = await db()
    .select({
      rodadaId: schema.trabalhosImpressao.rodadaId,
      status: schema.trabalhosImpressao.status,
    })
    .from(schema.trabalhosImpressao)
    .where(eq(schema.trabalhosImpressao.comandaId, comanda.id));

  const totaisPorMesa = new Map<number, number>();
  let total = 0;
  for (const rodada of rodadas) {
    for (const item of rodada.itens) {
      if (item.status !== "ativo") continue;
      total += item.totalCentavos;
      const numero = item.mesaOrigem.numero;
      totaisPorMesa.set(
        numero,
        (totaisPorMesa.get(numero) ?? 0) + item.totalCentavos,
      );
    }
  }

  // Taxa de serviço calculada sobre o total e a escolha do cliente, se ele
  // já pediu a conta pelo QR (pré-preenche o "Receber pagamento").
  const taxaConfig = await configTaxa(db(), restauranteId);
  const taxa = calcularTaxa(total, taxaConfig);
  const [pedidoConta] = await db()
    .select({
      taxaServico: schema.chamados.taxaServico,
      gorjetaCentavos: schema.chamados.gorjetaCentavos,
    })
    .from(schema.chamados)
    .where(
      and(
        eq(schema.chamados.comandaId, comanda.id),
        eq(schema.chamados.tipo, "conta"),
        isNull(schema.chamados.encerradoEm),
      ),
    )
    .limit(1);

  return {
    mesa: { id: mesa.id, numero: mesa.numero },
    comanda: {
      id: comanda.id,
      numero: comanda.numero,
      abertaEm: comanda.abertaEm.toISOString(),
      taxa,
      taxaConfig,
      pedidoConta: pedidoConta
        ? {
            taxaServico: pedidoConta.taxaServico ?? true,
            gorjetaCentavos: pedidoConta.gorjetaCentavos ?? 0,
          }
        : null,
      titular: titular[0]?.nome ?? "",
      titularId: comanda.garcomTitularId,
      equipe,
      mesas,
      totalCentavos: total,
      totaisPorMesa: [...totaisPorMesa].map(([numero, totalCentavos]) => ({
        numero,
        totalCentavos,
      })),
      rodadas: rodadas.map((rodada) => {
        const trabalhos = statusImpressao.filter(
          (t) => t.rodadaId === rodada.id,
        );
        return {
          id: rodada.id,
          numero: rodada.numero,
          lancadaEm: rodada.lancadaEm.toISOString(),
          garcom: rodada.funcionario.nome,
          impressao: trabalhos.some((t) => t.status === "falhou")
            ? ("falhou" as const)
            : trabalhos.some(
                  (t) => t.status === "pendente" || t.status === "imprimindo",
                )
              ? ("pendente" as const)
              : ("impresso" as const),
          // Itens substituídos por uma edição somem da tela (ficam no banco
          // para auditoria); o novo aparece marcado como editado.
          itens: rodada.itens
            .filter(
              (item) =>
                !rodada.itens.some(
                  (outro) => outro.substituiItemId === item.id,
                ),
            )
            .map((item) => ({
              id: item.id,
              produtoId: item.produtoId,
              nome: item.nomeProduto,
              editado: item.substituiItemId !== null,
              modificadorIds: item.modificadores.map((m) => m.modificadorId),
              quantidade: item.quantidade,
              totalCentavos: item.totalCentavos,
              observacao: item.observacao,
              mesaOrigem: item.mesaOrigem.numero,
              modificadores: item.modificadores.map((m) => m.nome),
              status: item.status,
              motivoCancelamento: item.motivoCancelamento,
            })),
        };
      }),
    },
  };
};

export const transferirSchema = z.object({ destinoMesaId: z.uuid() });

// Move a comanda para outra mesa (cliente trocou de lugar). A mesa de
// destino pode ter outras comandas; os itens guardam a mesa de origem.
export const transferirComanda = async (
  sessao: Sessao,
  comandaId: string,
  destinoMesaId: string,
) => {
  const { restauranteId } = sessao.funcionario;
  await db().transaction(async (tx) => {
    const comanda = await buscarComandaAberta(tx, restauranteId, comandaId);
    const destino = await buscarMesa(tx, restauranteId, destinoMesaId);
    const [atual] = await mesasDaComanda(tx, comanda.id);
    if (atual?.id === destino.id) throw invalido("Escolha outra mesa.");

    await tx
      .update(schema.comandaMesas)
      .set({ saiuEm: new Date() })
      .where(
        and(
          eq(schema.comandaMesas.comandaId, comanda.id),
          isNull(schema.comandaMesas.saiuEm),
        ),
      );
    await tx
      .insert(schema.comandaMesas)
      .values({ comandaId: comanda.id, mesaId: destino.id });
    await tx
      .update(schema.comandas)
      .set({ mesaPrincipalId: destino.id })
      .where(eq(schema.comandas.id, comanda.id));
    // O pedido de conta vai junto com a comanda.
    await tx
      .update(schema.chamados)
      .set({ mesaId: destino.id })
      .where(
        and(
          eq(schema.chamados.comandaId, comanda.id),
          eq(schema.chamados.tipo, "conta"),
          isNull(schema.chamados.encerradoEm),
        ),
      );
  });

  notificar(restauranteId, ["mesas", "chamados", `comanda:${comandaId}`]);
  return { comandaId };
};

// Libera a mesa depois do pagamento na maquininha. O fechamento completo
// (caixa, divisão de conta, taxa) é fase futura; aqui só encerra a comanda.
// Quanto cada garçom lançou na comanda (base da gorjeta). Quem está na
// comanda como titular/auxiliar mas não lançou nada aparece com base 0.
const basesGorjeta = async (conexao: Db | Tx, comandaId: string) => {
  const lancados = (
    await conexao.execute<{ funcionario_id: string; base: number }>(sql`
      select r.funcionario_id, coalesce(sum(i.total_centavos), 0)::int as base
        from rodada r
        join item_pedido i on i.rodada_id = r.id and i.status = 'ativo'
       where r.comanda_id = ${comandaId}
       group by r.funcionario_id
    `)
  ).rows;
  const equipe = await conexao
    .select({ funcionarioId: schema.comandaGarcons.funcionarioId })
    .from(schema.comandaGarcons)
    .where(eq(schema.comandaGarcons.comandaId, comandaId));
  const bases = new Map(lancados.map((l) => [l.funcionario_id, l.base]));
  for (const { funcionarioId } of equipe) {
    if (!bases.has(funcionarioId)) bases.set(funcionarioId, 0);
  }
  return [...bases].map(([funcionarioId, baseCentavos]) => ({
    funcionarioId,
    baseCentavos,
  }));
};

export const fecharMesaSchema = z
  .object({
    // Cliente pagou a taxa de serviço? O valor é calculado aqui, no servidor.
    taxaServico: z.boolean().default(true),
    // Sem taxa: motivo obrigatório (relatório por motivo e garçom).
    semTaxaMotivo: z.enum(MOTIVOS_SEM_TAXA).optional(),
    semTaxaObservacao: z.string().trim().max(80).optional(),
    // Gorjeta recebida na maquininha (0 = sem gorjeta).
    gorjetaCentavos: z.number().int().min(0).max(1_000_000).default(0),
    // Desconto pré-cadastrado (qualquer um) ou valor livre (gerente/caixa).
    descontoId: z.uuid().optional(),
    descontoCentavos: z.number().int().min(1).max(10_000_000).optional(),
    // Como o cliente pagou (pode dividir entre métodos). A soma tem que
    // fechar com o total; no dinheiro, o recebido a mais vira troco.
    pagamentos: z
      .array(
        z.object({
          metodo: z.enum(METODOS_PAGAMENTO),
          valorCentavos: z.number().int().min(1).max(100_000_000),
          recebidoCentavos: z.number().int().min(1).max(100_000_000).optional(),
        }),
      )
      .max(10)
      .optional(),
  })
  .refine((d) => d.taxaServico || d.semTaxaMotivo, {
    message: "Escolha o motivo de não cobrar a taxa de serviço.",
    path: ["semTaxaMotivo"],
  })
  .refine((d) => d.semTaxaMotivo !== "outro" || d.semTaxaObservacao, {
    message: "Descreva o motivo em poucas palavras.",
    path: ["semTaxaObservacao"],
  })
  .refine((d) => !(d.descontoId && d.descontoCentavos), {
    message: "Use um desconto só.",
  });

export type FecharMesaInput = Partial<z.infer<typeof fecharMesaSchema>>;

// Marca a conta como paga (maquininha) e libera a mesa: calcula a taxa de
// serviço, divide taxa e gorjeta entre os garçons da mesa (proporcional ao que
// cada um lançou, separadamente) e encerra os chamados da mesa.
export const fecharComanda = async (
  sessao: Sessao,
  comandaId: string,
  {
    taxaServico = true,
    semTaxaMotivo,
    semTaxaObservacao,
    gorjetaCentavos = 0,
    descontoId,
    descontoCentavos: descontoLivre,
    pagamentos,
  }: FecharMesaInput = {},
) => {
  if (descontoLivre && !["gerente", "caixa"].includes(sessao.funcionario.papel))
    throw semPermissao();
  const { restauranteId } = sessao.funcionario;
  const resultado = await db().transaction(async (tx) => {
    const comanda = await buscarComandaAberta(tx, restauranteId, comandaId);
    // Trava a comanda: dois garçons fechando ao mesmo tempo não duplicam gorjeta.
    await tx.execute(
      sql`select id from comanda where id = ${comanda.id} for update`,
    );

    const [{ ativos }] = (
      await tx.execute<{ ativos: number }>(
        sql`select count(*)::int as ativos from item_pedido where comanda_id = ${comanda.id} and status = 'ativo'`,
      )
    ).rows;

    const mesasDaComandaIds = (
      await tx
        .select({ mesaId: schema.comandaMesas.mesaId })
        .from(schema.comandaMesas)
        .where(
          and(
            eq(schema.comandaMesas.comandaId, comanda.id),
            isNull(schema.comandaMesas.saiuEm),
          ),
        )
    ).map((m) => m.mesaId);

    const subtotalCentavos = await subtotalDaComanda(tx, comanda.id);

    let desconto: { centavos: number; nome: string; id: string | null } | null =
      null;
    if (descontoId) {
      const [cadastrado] = await tx
        .select()
        .from(schema.descontos)
        .where(
          and(
            eq(schema.descontos.id, descontoId),
            eq(schema.descontos.restauranteId, restauranteId),
            eq(schema.descontos.ativo, true),
          ),
        );
      if (!cadastrado) throw naoEncontrado("Desconto");
      if (
        cadastrado.somenteGerente &&
        !["gerente", "caixa"].includes(sessao.funcionario.papel)
      ) {
        throw conflito(
          "desconto_so_gerente",
          `O desconto "${cadastrado.nome}" só o gerente ou o caixa aplicam.`,
        );
      }
      if (cadastrado.limitePorNoite !== null) {
        const [{ usos }] = (
          await tx.execute<{ usos: number }>(
            sql`select count(*)::int as usos from comanda
                 where desconto_id = ${cadastrado.id}
                   and fechada_em >= ${inicioDaNoite()}`,
          )
        ).rows;
        if (usos >= cadastrado.limitePorNoite) {
          throw conflito(
            "desconto_esgotado",
            `O desconto "${cadastrado.nome}" já foi usado ${usos} vez(es) hoje (limite da noite).`,
          );
        }
      }
      desconto = {
        centavos: valorDoDesconto(cadastrado, subtotalCentavos),
        nome: cadastrado.nome,
        id: cadastrado.id,
      };
    } else if (descontoLivre) {
      desconto = {
        centavos: Math.min(descontoLivre, subtotalCentavos),
        nome: "Desconto livre",
        id: null,
      };
    }
    const descontoCentavos = desconto?.centavos ?? 0;

    // A taxa incide sobre o consumo já com desconto.
    const taxaCentavos = taxaServico
      ? calcularTaxa(
          subtotalCentavos - descontoCentavos,
          await configTaxa(tx, restauranteId),
        ).valorCentavos
      : 0;
    const bases =
      gorjetaCentavos > 0 || taxaCentavos > 0
        ? await basesGorjeta(tx, comanda.id)
        : [];
    const divisao =
      gorjetaCentavos > 0
        ? dividirGorjeta(gorjetaCentavos, bases, comanda.garcomTitularId)
        : [];
    const divisaoTaxa =
      taxaCentavos > 0
        ? dividirGorjeta(taxaCentavos, bases, comanda.garcomTitularId)
        : [];
    const repasses = [
      ...divisao.map((d) => ({
        comandaId: comanda.id,
        tipo: "gorjeta" as const,
        ...d,
      })),
      ...divisaoTaxa.map((d) => ({
        comandaId: comanda.id,
        tipo: "taxa" as const,
        ...d,
      })),
    ];
    if (repasses.length) {
      await tx.insert(schema.gorjetaDivisoes).values(repasses);
    }

    const totalCentavos =
      subtotalCentavos - descontoCentavos + taxaCentavos + gorjetaCentavos;
    if (pagamentos?.length && totalCentavos > 0) {
      const conferencia = conferirPagamentos(pagamentos, totalCentavos);
      if (conferencia.dinheiroCurto) {
        throw invalido("O dinheiro recebido é menor que o valor lançado.");
      }
      if (conferencia.faltaCentavos !== 0) {
        throw conflito(
          "pagamento_nao_fecha",
          conferencia.faltaCentavos > 0
            ? `Faltam ${formatBRL(conferencia.faltaCentavos)} para fechar a conta.`
            : `Os pagamentos passam ${formatBRL(-conferencia.faltaCentavos)} do total.`,
          { totalCentavos, pagoCentavos: conferencia.pagoCentavos },
        );
      }
      await tx.insert(schema.pagamentos).values(
        pagamentos.map((p) => ({
          restauranteId,
          comandaId: comanda.id,
          metodo: p.metodo,
          valorCentavos: p.valorCentavos,
          recebidoCentavos:
            p.metodo === "dinheiro"
              ? (p.recebidoCentavos ?? p.valorCentavos)
              : null,
          trocoCentavos: trocoDe(p),
          funcionarioId: sessao.funcionario.id,
        })),
      );
    }

    await tx
      .update(schema.comandaMesas)
      .set({ saiuEm: new Date() })
      .where(
        and(
          eq(schema.comandaMesas.comandaId, comanda.id),
          isNull(schema.comandaMesas.saiuEm),
        ),
      );
    await tx
      .update(schema.comandas)
      .set({
        status: ativos > 0 ? "fechada" : "cancelada",
        fechadaEm: new Date(),
        gorjetaCentavos: gorjetaCentavos > 0 ? gorjetaCentavos : null,
        taxaServicoCentavos: taxaServico ? taxaCentavos : null,
        semTaxaMotivo: taxaServico ? null : (semTaxaMotivo ?? "outro"),
        semTaxaObservacao: taxaServico ? null : semTaxaObservacao || null,
        descontoCentavos: descontoCentavos > 0 ? descontoCentavos : null,
        descontoNome: descontoCentavos > 0 ? (desconto?.nome ?? null) : null,
        descontoId: descontoCentavos > 0 ? (desconto?.id ?? null) : null,
        fechadaPor: sessao.funcionario.id,
      })
      .where(eq(schema.comandas.id, comanda.id));
    // O pedido de conta desta comanda se encerra. "Chamou garçom" é da
    // mesa: só se encerra quando a última comanda dela for paga.
    await tx
      .update(schema.chamados)
      .set({ encerradoEm: new Date() })
      .where(
        and(
          eq(schema.chamados.comandaId, comanda.id),
          isNull(schema.chamados.encerradoEm),
        ),
      );
    for (const mesaId of mesasDaComandaIds) {
      if ((await comandasAbertasDaMesa(tx, mesaId)).length) continue;
      await tx
        .update(schema.chamados)
        .set({ encerradoEm: new Date() })
        .where(
          and(
            eq(schema.chamados.mesaId, mesaId),
            isNull(schema.chamados.encerradoEm),
          ),
        );
    }
    return {
      comandaId: comanda.id,
      subtotalCentavos,
      descontoCentavos,
      taxaCentavos,
      totalCentavos,
      trocoCentavos: (pagamentos ?? []).reduce((t, p) => t + trocoDe(p), 0),
      divisao,
      divisaoTaxa,
    };
  });

  notificar(restauranteId, [
    "mesas",
    "chamados",
    `comanda:${resultado.comandaId}`,
  ]);
  return resultado;
};
