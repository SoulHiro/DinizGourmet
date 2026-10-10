import {
  and,
  asc,
  eq,
  inArray,
  isNotNull,
  isNull,
  lt,
  or,
  sql,
} from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import { db, schema } from "@/db";
import type { Sessao } from "@/lib/auth/sessao";
import {
  conflito,
  naoEncontrado,
  semPermissao,
  violouConstraint,
} from "@/lib/erros";
import { notificar } from "@/lib/runtime";
import {
  comandaDoCliente,
  type Identificacao,
  mesaAtivaPorToken,
} from "./cliente";
import { comandasAbertasDaMesa, configTaxa, subtotalDaComanda } from "./comum";
import { calcularTaxa } from "./taxa";

export type TipoChamado = "garcom" | "conta";

export type ResumoConta = {
  subtotalCentavos: number;
  taxaServico: boolean;
  taxaPct: number;
  taxaCentavos: number;
  gorjetaCentavos: number;
  totalCentavos: number;
};

export type Chamado = {
  id: string;
  tipo: TipoChamado;
  mesaId: string;
  mesaNumero: number;
  // Pedido de conta é de uma comanda (cartão); chamar garçom é da mesa.
  comandaId: string | null;
  comandaNumero: number | null;
  criadoEm: string;
  aceitoPor: string | null;
  aceitoPorId: string | null;
  escalado: boolean;
  // Garçons que atendem (titular + auxiliares): da comanda, no pedido de
  // conta; de todas as comandas da mesa, no chamar garçom. O pedido de conta
  // vai só para eles; sem resposta, escala para o gerente.
  garconsDaMesa: string[];
  // Só no pedido de conta: o que o cliente escolheu e quanto vai dar.
  conta: ResumoConta | null;
};

// Página pública do QR: chamados da mesa e o pedido de conta da comanda do
// cliente (se ele já se identificou, ou se a mesa tem uma comanda só).
export const statusPublico = async (
  token: string,
  ident: Identificacao = {},
) => {
  const mesa = await mesaAtivaPorToken(token);
  const { comanda, precisaCartao } = await comandaDoCliente(mesa, ident);
  const abertos = await db()
    .select({
      tipo: schema.chamados.tipo,
      comandaId: schema.chamados.comandaId,
      aceito: isNotNull(schema.chamados.aceitoPor),
      taxaServico: schema.chamados.taxaServico,
      gorjetaCentavos: schema.chamados.gorjetaCentavos,
    })
    .from(schema.chamados)
    .where(
      and(
        eq(schema.chamados.mesaId, mesa.id),
        isNull(schema.chamados.encerradoEm),
      ),
    );
  return {
    mesa: mesa.numero,
    comanda: comanda?.numero ?? null,
    precisaCartao,
    chamados: abertos
      // Pedido de conta de outra comanda da mesa não é da conta deste cliente.
      .filter((c) => c.tipo === "garcom" || c.comandaId === comanda?.id)
      .map((c) => ({
        tipo: c.tipo,
        aceito: Boolean(c.aceito),
        taxaServico: c.taxaServico ?? true,
        gorjetaCentavos: c.gorjetaCentavos ?? 0,
      })),
  };
};

export type OpcoesConta = { taxaServico: boolean; gorjetaCentavos: number };

// Cliente aperta o botão (quantas vezes quiser: só existe um "chamar
// garçom" aberto por mesa e um pedido de conta aberto por comanda, garantido
// pelos índices únicos). No pedido de conta, se ele mudar a taxa ou a
// gorjeta antes de pagar, o pedido aberto é atualizado.
export const chamarPeloQr = async (
  token: string,
  tipo: TipoChamado,
  opcoes?: OpcoesConta,
  ident: Identificacao = {},
) => {
  const mesa = await mesaAtivaPorToken(token);
  let comandaId: string | null = null;
  if (tipo === "conta") {
    const { comanda, precisaCartao } = await comandaDoCliente(mesa, ident);
    if (precisaCartao) {
      throw conflito(
        "informe_cartao",
        "Digite o número do seu cartão de comanda.",
      );
    }
    if (!comanda) {
      throw conflito("sem_conta", "Ainda não há pedidos nesta mesa.");
    }
    comandaId = comanda.id;
  }
  const escolha =
    tipo === "conta"
      ? {
          taxaServico: opcoes?.taxaServico ?? true,
          gorjetaCentavos: opcoes?.gorjetaCentavos ?? 0,
        }
      : {};
  try {
    await db()
      .insert(schema.chamados)
      .values({
        restauranteId: mesa.restauranteId,
        mesaId: mesa.id,
        comandaId,
        tipo,
        ...escolha,
      });
    notificar(mesa.restauranteId, ["chamados", "mesas"]);
    return { jaExistia: false };
  } catch (error) {
    if (
      !violouConstraint(error, "chamado_garcom_aberto_idx") &&
      !violouConstraint(error, "chamado_conta_aberto_idx")
    ) {
      throw error;
    }
    if (tipo === "conta" && comandaId) {
      await db()
        .update(schema.chamados)
        .set(escolha)
        .where(
          and(
            eq(schema.chamados.comandaId, comandaId),
            eq(schema.chamados.tipo, "conta"),
            isNull(schema.chamados.encerradoEm),
          ),
        );
      notificar(mesa.restauranteId, ["chamados"]);
    }
    return { jaExistia: true };
  }
};

export const listarChamados = async (
  restauranteId: string,
): Promise<Chamado[]> => {
  const atendente = alias(schema.funcionarios, "atendente");
  const linhas = await db()
    .select({
      id: schema.chamados.id,
      tipo: schema.chamados.tipo,
      mesaId: schema.chamados.mesaId,
      mesaNumero: schema.mesas.numero,
      comandaId: schema.chamados.comandaId,
      comandaNumero: schema.comandas.numero,
      criadoEm: schema.chamados.criadoEm,
      aceitoPor: atendente.nome,
      aceitoPorId: schema.chamados.aceitoPor,
      escaladoEm: schema.chamados.escaladoEm,
      taxaServico: schema.chamados.taxaServico,
      gorjetaCentavos: schema.chamados.gorjetaCentavos,
    })
    .from(schema.chamados)
    .innerJoin(schema.mesas, eq(schema.mesas.id, schema.chamados.mesaId))
    .leftJoin(
      schema.comandas,
      eq(schema.comandas.id, schema.chamados.comandaId),
    )
    .leftJoin(atendente, eq(atendente.id, schema.chamados.aceitoPor))
    .where(
      and(
        eq(schema.chamados.restauranteId, restauranteId),
        isNull(schema.chamados.encerradoEm),
      ),
    )
    // Fila por ordem de chegada.
    .orderBy(asc(schema.chamados.criadoEm));
  if (!linhas.length) return [];

  const config = await configTaxa(db(), restauranteId);
  return Promise.all(
    linhas.map(async (l) => {
      // Conta: a comanda do chamado. Garçom: todas as comandas da mesa.
      const comandaIds =
        l.tipo === "conta"
          ? l.comandaId
            ? [l.comandaId]
            : []
          : (await comandasAbertasDaMesa(db(), l.mesaId)).map((c) => c.id);
      const equipe = comandaIds.length
        ? await db()
            .selectDistinct({ id: schema.comandaGarcons.funcionarioId })
            .from(schema.comandaGarcons)
            .where(inArray(schema.comandaGarcons.comandaId, comandaIds))
        : [];
      let conta: ResumoConta | null = null;
      if (l.tipo === "conta" && l.comandaId) {
        const subtotal = await subtotalDaComanda(db(), l.comandaId);
        const taxa = calcularTaxa(subtotal, config);
        const taxaServico = l.taxaServico ?? true;
        const taxaCentavos = taxaServico ? taxa.valorCentavos : 0;
        const gorjeta = l.gorjetaCentavos ?? 0;
        conta = {
          subtotalCentavos: subtotal,
          taxaServico,
          taxaPct: taxa.pct,
          taxaCentavos,
          gorjetaCentavos: gorjeta,
          totalCentavos: subtotal + taxaCentavos + gorjeta,
        };
      }
      return {
        id: l.id,
        tipo: l.tipo,
        mesaId: l.mesaId,
        mesaNumero: l.mesaNumero,
        comandaId: l.comandaId,
        comandaNumero: l.comandaNumero,
        criadoEm: l.criadoEm.toISOString(),
        aceitoPor: l.aceitoPor,
        aceitoPorId: l.aceitoPorId,
        escalado: l.escaladoEm !== null,
        garconsDaMesa: equipe.map((e) => e.id),
        conta,
      };
    }),
  );
};

// Primeiro que atender leva; some da tela dos outros garçons.
export const atenderChamado = async (sessao: Sessao, chamadoId: string) => {
  const { restauranteId, id: funcionarioId } = sessao.funcionario;
  const [atendido] = await db()
    .update(schema.chamados)
    .set({ aceitoPor: funcionarioId, aceitoEm: new Date() })
    .where(
      and(
        eq(schema.chamados.id, chamadoId),
        eq(schema.chamados.restauranteId, restauranteId),
        isNull(schema.chamados.aceitoPor),
        isNull(schema.chamados.encerradoEm),
      ),
    )
    .returning({
      id: schema.chamados.id,
      mesaId: schema.chamados.mesaId,
      tipo: schema.chamados.tipo,
    });
  if (!atendido)
    throw conflito(
      "ja_atendido",
      "Outro garçom já está atendendo este chamado.",
    );
  notificar(restauranteId, ["chamados", "mesas"]);
  return atendido;
};

// Quem atendeu marca como resolvido (o gerente pode encerrar qualquer um).
export const concluirChamado = async (sessao: Sessao, chamadoId: string) => {
  const { restauranteId, id: funcionarioId, papel } = sessao.funcionario;
  const [chamado] = await db()
    .select()
    .from(schema.chamados)
    .where(
      and(
        eq(schema.chamados.id, chamadoId),
        eq(schema.chamados.restauranteId, restauranteId),
      ),
    );
  if (!chamado) throw naoEncontrado("Chamado");
  if (chamado.aceitoPor !== funcionarioId && papel !== "gerente")
    throw semPermissao();
  await db()
    .update(schema.chamados)
    .set({ encerradoEm: new Date() })
    .where(eq(schema.chamados.id, chamadoId));
  notificar(restauranteId, ["chamados", "mesas"]);
};

// Periódico: sem resposta no prazo vai para o gerente; "chamou garçom"
// atendido e esquecido se encerra sozinho (pedido de conta só ao fechar).
export const manutencaoChamados = async (escalarAposSegundos: number) => {
  const escalados = await db()
    .update(schema.chamados)
    .set({ escaladoEm: new Date() })
    .where(
      and(
        isNull(schema.chamados.aceitoPor),
        isNull(schema.chamados.encerradoEm),
        isNull(schema.chamados.escaladoEm),
        lt(
          schema.chamados.criadoEm,
          sql`now() - make_interval(secs => ${escalarAposSegundos})`,
        ),
      ),
    )
    .returning({ restauranteId: schema.chamados.restauranteId });

  const encerrados = await db()
    .update(schema.chamados)
    .set({ encerradoEm: new Date() })
    .where(
      and(
        isNull(schema.chamados.encerradoEm),
        eq(schema.chamados.tipo, "garcom"),
        lt(schema.chamados.aceitoEm, sql`now() - interval '15 minutes'`),
      ),
    )
    .returning({ restauranteId: schema.chamados.restauranteId });

  // Sobra de outra noite (ninguém fechou) ou conta de comanda que já foi
  // paga: encerra sozinho para não travar alerta na tela do gerente.
  const esquecidos = await db()
    .update(schema.chamados)
    .set({ encerradoEm: new Date() })
    .where(
      and(
        isNull(schema.chamados.encerradoEm),
        or(
          lt(schema.chamados.criadoEm, sql`now() - interval '12 hours'`),
          sql`exists (select 1 from comanda c
                       where c.id = ${schema.chamados.comandaId}
                         and c.status <> 'aberta')`,
        ),
      ),
    )
    .returning({ restauranteId: schema.chamados.restauranteId });

  const afetados = new Set(
    [...escalados, ...encerrados, ...esquecidos].map((c) => c.restauranteId),
  );
  for (const restauranteId of afetados)
    notificar(restauranteId, ["chamados", "mesas"]);
  return {
    escalados: escalados.length,
    encerrados: encerrados.length + esquecidos.length,
  };
};
