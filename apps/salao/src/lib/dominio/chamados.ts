import { and, asc, eq, isNotNull, isNull, lt, sql } from "drizzle-orm";
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
import { comandaAbertaDaMesa, configTaxa, subtotalDaComanda } from "./comum";
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
  criadoEm: string;
  aceitoPor: string | null;
  aceitoPorId: string | null;
  escalado: boolean;
  // Garçons da comanda atual da mesa (titular + auxiliares). O pedido de
  // conta vai só para eles; sem resposta, escala para o gerente.
  garconsDaMesa: string[];
  // Só no pedido de conta: o que o cliente escolheu e quanto vai dar.
  conta: ResumoConta | null;
};

const mesaPorToken = async (token: string) => {
  const [mesa] = await db()
    .select()
    .from(schema.mesas)
    .where(and(eq(schema.mesas.tokenQr, token), eq(schema.mesas.ativa, true)))
    .limit(1);
  if (!mesa) throw naoEncontrado("Mesa");
  return mesa;
};

// Página pública do QR: o que o cliente vê da própria mesa.
export const statusPublico = async (token: string) => {
  const mesa = await mesaPorToken(token);
  const abertos = await db()
    .select({
      tipo: schema.chamados.tipo,
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
    chamados: abertos.map((c) => ({
      tipo: c.tipo,
      aceito: Boolean(c.aceito),
      taxaServico: c.taxaServico ?? true,
      gorjetaCentavos: c.gorjetaCentavos ?? 0,
    })),
  };
};

export type OpcoesConta = { taxaServico: boolean; gorjetaCentavos: number };

// Cliente aperta o botão (quantas vezes quiser: só existe 1 chamado aberto
// por tipo e mesa, garantido pelo índice único). No pedido de conta, se ele
// mudar a taxa ou a gorjeta antes de pagar, o pedido aberto é atualizado.
export const chamarPeloQr = async (
  token: string,
  tipo: TipoChamado,
  opcoes?: OpcoesConta,
) => {
  const mesa = await mesaPorToken(token);
  const comanda = await comandaAbertaDaMesa(db(), mesa.id);
  if (tipo === "conta" && !comanda) {
    throw conflito("sem_conta", "Ainda não há pedidos nesta mesa.");
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
        comandaId: comanda?.id ?? null,
        tipo,
        ...escolha,
      });
    notificar(mesa.restauranteId, ["chamados", "mesas"]);
    return { jaExistia: false };
  } catch (error) {
    if (!violouConstraint(error, "chamado_mesa_aberto_idx")) throw error;
    if (tipo === "conta") {
      await db()
        .update(schema.chamados)
        .set(escolha)
        .where(
          and(
            eq(schema.chamados.mesaId, mesa.id),
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
      criadoEm: schema.chamados.criadoEm,
      aceitoPor: atendente.nome,
      aceitoPorId: schema.chamados.aceitoPor,
      escaladoEm: schema.chamados.escaladoEm,
      taxaServico: schema.chamados.taxaServico,
      gorjetaCentavos: schema.chamados.gorjetaCentavos,
    })
    .from(schema.chamados)
    .innerJoin(schema.mesas, eq(schema.mesas.id, schema.chamados.mesaId))
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
      // Comanda atual da mesa (pode ter sido aberta ou juntada depois do chamado).
      const comanda = await comandaAbertaDaMesa(db(), l.mesaId);
      const equipe = comanda
        ? await db()
            .select({ id: schema.comandaGarcons.funcionarioId })
            .from(schema.comandaGarcons)
            .where(eq(schema.comandaGarcons.comandaId, comanda.id))
        : [];
      let conta: ResumoConta | null = null;
      if (l.tipo === "conta" && comanda) {
        const subtotal = await subtotalDaComanda(db(), comanda.id);
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

  const afetados = new Set(
    [...escalados, ...encerrados].map((c) => c.restauranteId),
  );
  for (const restauranteId of afetados)
    notificar(restauranteId, ["chamados", "mesas"]);
  return { escalados: escalados.length, encerrados: encerrados.length };
};
