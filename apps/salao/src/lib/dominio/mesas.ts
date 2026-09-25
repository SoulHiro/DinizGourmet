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
  buscarMesa,
  comandaAbertaDaMesa,
  configTaxa,
  mesasDaComanda,
  registrarGarcom,
  subtotalDaComanda,
} from "./comum";
import { dividirGorjeta } from "./gorjeta";
import { conferirPagamentos, METODOS_PAGAMENTO, trocoDe } from "./pagamento";
import { calcularTaxa, MOTIVOS_SEM_TAXA, valorDoDesconto } from "./taxa";

// Status derivado (nunca gravado): vem da comanda aberta e das rodadas.
// "chamado" e "conta" chegam na Fase 2, com a tabela de chamados.
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
  comandaId: string | null;
  mesaPrincipalNumero: number | null;
  agrupadaCom: number[];
  garcom: string | null;
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
    comanda_id: string | null;
    mesa_principal_id: string | null;
    garcom: string | null;
    aberta_em: Date | null;
    rodadas: number;
    ultima_rodada_em: Date | null;
    ajuda: boolean;
    chamado: "garcom" | "conta" | null;
    total: number;
  }>(sql`
    select m.id, m.numero,
           c.id as comanda_id, c.mesa_principal_id, f.nome as garcom, c.aberta_em,
           coalesce(r.qtd, 0)::int as rodadas, r.ultima as ultima_rodada_em,
           coalesce(t.total, 0)::int as total,
           exists (
             select 1 from pedido_ajuda pa
              where pa.mesa_id = m.id and pa.encerrado_em is null and pa.aceito_por is null
           ) as ajuda,
           (
             select c.tipo from chamado c
              where c.mesa_id = m.id and c.encerrado_em is null
              order by (c.tipo = 'conta') desc
              limit 1
           ) as chamado
      from mesa m
      left join comanda_mesa cm on cm.mesa_id = m.id and cm.saiu_em is null
      left join comanda c on c.id = cm.comanda_id and c.status = 'aberta'
      left join funcionario f on f.id = c.garcom_titular_id
      left join lateral (
        select count(*) as qtd, max(lancada_em) as ultima
          from rodada where comanda_id = c.id
      ) r on true
      left join lateral (
        select sum(total_centavos) as total
          from item_pedido where comanda_id = c.id and status = 'ativo'
      ) t on true
     where m.restaurante_id = ${restauranteId} and m.ativa
     order by m.numero
  `);

  const porComanda = new Map<string, number[]>();
  const numeroPorId = new Map<string, number>();
  for (const linha of linhas.rows) {
    numeroPorId.set(linha.id, linha.numero);
    if (linha.comanda_id) {
      const lista = porComanda.get(linha.comanda_id) ?? [];
      lista.push(linha.numero);
      porComanda.set(linha.comanda_id, lista);
    }
  }

  return linhas.rows.map((linha) => {
    const aberta = Boolean(linha.comanda_id);
    return {
      id: linha.id,
      numero: linha.numero,
      // Pedido de conta > chamou garçom > ocupada > aguardando > livre.
      status:
        linha.chamado === "conta"
          ? "conta"
          : linha.chamado === "garcom"
            ? "chamado"
            : !aberta
              ? "livre"
              : linha.rodadas > 0
                ? "ocupada"
                : "aguardando",
      comandaId: linha.comanda_id,
      mesaPrincipalNumero: linha.mesa_principal_id
        ? (numeroPorId.get(linha.mesa_principal_id) ?? null)
        : null,
      agrupadaCom: linha.comanda_id
        ? (porComanda.get(linha.comanda_id) ?? []).filter(
            (n) => n !== linha.numero,
          )
        : [],
      garcom: linha.garcom,
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

export type DetalheMesa = Awaited<ReturnType<typeof detalharMesa>>;

// Tudo que a tela da mesa precisa: comanda, mesas agrupadas e o histórico
// de rodadas (somente leitura, cada rodada é imutável).
export const detalharMesa = async (restauranteId: string, mesaId: string) => {
  const mesa = await buscarMesa(db(), restauranteId, mesaId);
  const comanda = await comandaAbertaDaMesa(db(), mesaId);
  if (!comanda) {
    return { mesa: { id: mesa.id, numero: mesa.numero }, comanda: null };
  }

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
        inArray(
          schema.chamados.mesaId,
          mesas.map((m) => m.id),
        ),
        eq(schema.chamados.tipo, "conta"),
        isNull(schema.chamados.encerradoEm),
      ),
    )
    .limit(1);

  return {
    mesa: { id: mesa.id, numero: mesa.numero },
    comanda: {
      id: comanda.id,
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

export const juntarMesasSchema = z.object({
  mesaIds: z.array(z.uuid()).min(1).max(10),
});

// Junta mesas livres à comanda da mesa principal. Os itens continuam
// guardando a mesa de origem, então a conta pode ser dividida depois.
export const juntarMesas = async (
  sessao: Sessao,
  mesaPrincipalId: string,
  mesaIds: string[],
) => {
  const { restauranteId } = sessao.funcionario;
  const adicionais = [...new Set(mesaIds)].filter(
    (id) => id !== mesaPrincipalId,
  );
  if (!adicionais.length)
    throw invalido("Escolha ao menos uma mesa para juntar.");

  const comandaId = await db().transaction(async (tx) => {
    await buscarMesa(tx, restauranteId, mesaPrincipalId);
    let comanda = await comandaAbertaDaMesa(tx, mesaPrincipalId);

    if (!comanda) {
      const [nova] = await tx
        .insert(schema.comandas)
        .values({
          restauranteId,
          mesaPrincipalId,
          garcomTitularId: sessao.funcionario.id,
        })
        .returning();
      await tx
        .insert(schema.comandaMesas)
        .values({ comandaId: nova.id, mesaId: mesaPrincipalId });
      await registrarGarcom(tx, nova.id, sessao.funcionario.id, "titular");
      comanda = nova;
    }

    for (const mesaId of adicionais) {
      const mesa = await buscarMesa(tx, restauranteId, mesaId);
      const outra = await comandaAbertaDaMesa(tx, mesaId);
      if (outra?.id === comanda.id) continue;
      if (outra) {
        // Mesa aberta mas ainda sem pedido: a comanda vazia é descartada.
        const [{ itens }] = (
          await tx.execute<{ itens: number }>(
            sql`select count(*)::int as itens from rodada where comanda_id = ${outra.id}`,
          )
        ).rows;
        if (itens > 0) {
          throw conflito(
            "mesa_com_pedidos",
            `A mesa ${mesa.numero} já tem pedidos. Feche ou transfira antes de juntar.`,
          );
        }
        await tx
          .update(schema.comandaMesas)
          .set({ saiuEm: new Date() })
          .where(
            and(
              eq(schema.comandaMesas.comandaId, outra.id),
              isNull(schema.comandaMesas.saiuEm),
            ),
          );
        await tx
          .update(schema.comandas)
          .set({ status: "cancelada", fechadaEm: new Date() })
          .where(eq(schema.comandas.id, outra.id));
      }
      try {
        await tx.transaction((sp) =>
          sp
            .insert(schema.comandaMesas)
            .values({ comandaId: comanda.id, mesaId }),
        );
      } catch (error) {
        if (violouConstraint(error, "comanda_mesa_ativa_idx")) {
          throw conflito(
            "mesa_ocupada",
            `A mesa ${mesa.numero} acabou de ser aberta por outro garçom.`,
          );
        }
        throw error;
      }
    }
    return comanda.id;
  });

  notificar(restauranteId, ["mesas", `comanda:${comandaId}`]);
  return { comandaId };
};

// Tira uma mesa agrupada da comanda. Os itens dela continuam na conta
// (marcados com a mesa de origem); a mesa volta a ficar livre.
export const separarMesa = async (sessao: Sessao, mesaId: string) => {
  const { restauranteId } = sessao.funcionario;
  const comandaId = await db().transaction(async (tx) => {
    await buscarMesa(tx, restauranteId, mesaId);
    const comanda = await comandaAbertaDaMesa(tx, mesaId);
    if (!comanda)
      throw conflito("mesa_livre", "Esta mesa não está em nenhuma comanda.");
    if (comanda.mesaPrincipalId === mesaId) {
      throw conflito(
        "mesa_principal",
        "Esta é a mesa principal. Para mudar de lugar use Transferir.",
      );
    }
    await tx
      .update(schema.comandaMesas)
      .set({ saiuEm: new Date() })
      .where(
        and(
          eq(schema.comandaMesas.mesaId, mesaId),
          isNull(schema.comandaMesas.saiuEm),
        ),
      );
    return comanda.id;
  });
  notificar(restauranteId, ["mesas", `comanda:${comandaId}`]);
  return { comandaId };
};

export const transferirSchema = z.object({ destinoMesaId: z.uuid() });

// Move a comanda inteira da mesa principal para outra mesa livre
// (cliente pediu para trocar de lugar). Diferente de juntar.
export const transferirComanda = async (
  sessao: Sessao,
  origemMesaId: string,
  destinoMesaId: string,
) => {
  const { restauranteId } = sessao.funcionario;
  if (origemMesaId === destinoMesaId) throw invalido("Escolha outra mesa.");

  const comandaId = await db().transaction(async (tx) => {
    await buscarMesa(tx, restauranteId, origemMesaId);
    const destino = await buscarMesa(tx, restauranteId, destinoMesaId);
    const comanda = await comandaAbertaDaMesa(tx, origemMesaId);
    if (!comanda)
      throw conflito("mesa_livre", "Não há comanda aberta nesta mesa.");
    if (comanda.mesaPrincipalId !== origemMesaId) {
      throw conflito(
        "nao_principal",
        "Transfira a partir da mesa principal da comanda.",
      );
    }
    if (await comandaAbertaDaMesa(tx, destinoMesaId)) {
      throw conflito(
        "destino_ocupado",
        `A mesa ${destino.numero} não está livre.`,
      );
    }

    // A comanda inteira muda de lugar: todas as mesas dela (inclusive as
    // agrupadas) ficam livres. Os itens mantêm a mesa de origem original.
    await tx
      .update(schema.comandaMesas)
      .set({ saiuEm: new Date() })
      .where(
        and(
          eq(schema.comandaMesas.comandaId, comanda.id),
          isNull(schema.comandaMesas.saiuEm),
        ),
      );
    try {
      await tx.transaction((sp) =>
        sp
          .insert(schema.comandaMesas)
          .values({ comandaId: comanda.id, mesaId: destinoMesaId }),
      );
    } catch (error) {
      if (violouConstraint(error, "comanda_mesa_ativa_idx")) {
        throw conflito(
          "destino_ocupado",
          `A mesa ${destino.numero} acabou de ser aberta.`,
        );
      }
      throw error;
    }
    await tx
      .update(schema.comandas)
      .set({ mesaPrincipalId: destinoMesaId })
      .where(eq(schema.comandas.id, comanda.id));
    return comanda.id;
  });

  notificar(restauranteId, ["mesas", `comanda:${comandaId}`]);
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
  mesaId: string,
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
    await buscarMesa(tx, restauranteId, mesaId);
    const comanda = await comandaAbertaDaMesa(tx, mesaId);
    if (!comanda) throw naoEncontrado("Comanda aberta");
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
    // Mesa liberada: chamados dela (inclusive "pediu a conta") se encerram.
    if (mesasDaComandaIds.length) {
      await tx
        .update(schema.chamados)
        .set({ encerradoEm: new Date() })
        .where(
          and(
            inArray(schema.chamados.mesaId, mesasDaComandaIds),
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
