import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { z } from "zod";

import { db, schema } from "@/db";
import type { Sessao } from "@/lib/auth/sessao";
import { conflito, naoEncontrado, violouConstraint } from "@/lib/erros";
import { notificar } from "@/lib/runtime";

// Turno do caixa: abre com o fundo de troco, registra sangrias (dinheiro que
// sai da gaveta) e suprimentos (troco que entra) e fecha com a contagem.
// Dinheiro esperado = fundo + recebido em dinheiro + suprimentos − sangrias.
// O troco já está descontado: o pagamento em dinheiro guarda só o valor da
// conta, não o que o cliente entregou.

const valorSchema = z.number().int().min(0).max(100_000_000);

export const abrirTurnoSchema = z.object({ fundoCentavos: valorSchema });

export const movimentoSchema = z.object({
  tipo: z.enum(["sangria", "suprimento"]),
  valorCentavos: valorSchema.min(1),
  motivo: z.string().trim().min(2).max(80),
});

export const fecharTurnoSchema = z.object({
  contadoCentavos: valorSchema,
  observacao: z.string().trim().max(200).optional(),
});

const turnoAberto = async (restauranteId: string) => {
  const [turno] = await db()
    .select()
    .from(schema.turnosCaixa)
    .where(
      and(
        eq(schema.turnosCaixa.restauranteId, restauranteId),
        isNull(schema.turnosCaixa.fechadoEm),
      ),
    );
  return turno ?? null;
};

// Números do turno (aberto ou fechado), calculados no banco.
const numerosDoTurno = async (
  turno: typeof schema.turnosCaixa.$inferSelect,
) => {
  const ate = turno.fechadoEm ?? new Date("9999-12-31T00:00:00Z");
  const quem = alias(schema.funcionarios, "quem");
  const [porMetodo, movimentos] = await Promise.all([
    db().execute<{
      metodo: string;
      quantidade: number;
      centavos: number;
      troco: number;
    }>(sql`
      select metodo::text as metodo, count(*)::int as quantidade,
             sum(valor_centavos)::int as centavos,
             sum(troco_centavos)::int as troco
        from pagamento
       where restaurante_id = ${turno.restauranteId}
         and criado_em >= ${turno.abertoEm} and criado_em < ${ate}
       group by metodo
       order by centavos desc
    `),
    db()
      .select({
        id: schema.movimentosCaixa.id,
        tipo: schema.movimentosCaixa.tipo,
        valorCentavos: schema.movimentosCaixa.valorCentavos,
        motivo: schema.movimentosCaixa.motivo,
        quem: quem.nome,
        criadoEm: schema.movimentosCaixa.criadoEm,
      })
      .from(schema.movimentosCaixa)
      .innerJoin(quem, eq(quem.id, schema.movimentosCaixa.funcionarioId))
      .where(eq(schema.movimentosCaixa.turnoId, turno.id))
      .orderBy(desc(schema.movimentosCaixa.criadoEm)),
  ]);
  const soma = (tipo: "sangria" | "suprimento") =>
    movimentos
      .filter((m) => m.tipo === tipo)
      .reduce((s, m) => s + m.valorCentavos, 0);
  const dinheiro =
    porMetodo.rows.find((m) => m.metodo === "dinheiro")?.centavos ?? 0;
  const sangrias = soma("sangria");
  const suprimentos = soma("suprimento");
  return {
    porMetodo: porMetodo.rows,
    recebidoCentavos: porMetodo.rows.reduce((s, m) => s + m.centavos, 0),
    dinheiroCentavos: dinheiro,
    trocoCentavos: porMetodo.rows.reduce((s, m) => s + m.troco, 0),
    sangriasCentavos: sangrias,
    suprimentosCentavos: suprimentos,
    esperadoCentavos: turno.fundoCentavos + dinheiro + suprimentos - sangrias,
    movimentos: movimentos.map((m) => ({
      ...m,
      criadoEm: m.criadoEm.toISOString(),
    })),
  };
};

const nomeDe = async (id: string | null) => {
  if (!id) return null;
  const [f] = await db()
    .select({ nome: schema.funcionarios.nome })
    .from(schema.funcionarios)
    .where(eq(schema.funcionarios.id, id));
  return f?.nome ?? null;
};

const montar = async (turno: typeof schema.turnosCaixa.$inferSelect) => ({
  id: turno.id,
  abertoEm: turno.abertoEm.toISOString(),
  abertoPor: await nomeDe(turno.abertoPor),
  fechadoEm: turno.fechadoEm?.toISOString() ?? null,
  fechadoPor: await nomeDe(turno.fechadoPor),
  fundoCentavos: turno.fundoCentavos,
  contadoCentavos: turno.contadoCentavos,
  observacao: turno.observacao,
  ...(await numerosDoTurno(turno)),
  // Fechado: o esperado fica congelado como estava na hora do fechamento.
  ...(turno.esperadoCentavos !== null
    ? { esperadoCentavos: turno.esperadoCentavos }
    : {}),
});

export type TurnoCaixa = Awaited<ReturnType<typeof montar>>;

export const turnoAtual = async (restauranteId: string) => {
  const turno = await turnoAberto(restauranteId);
  return { turno: turno ? await montar(turno) : null };
};

export const abrirTurno = async (
  sessao: Sessao,
  { fundoCentavos }: z.infer<typeof abrirTurnoSchema>,
) => {
  const { restauranteId } = sessao.funcionario;
  try {
    const [turno] = await db()
      .insert(schema.turnosCaixa)
      .values({
        restauranteId,
        abertoPor: sessao.funcionario.id,
        fundoCentavos,
      })
      .returning();
    notificar(restauranteId, ["mesas"]);
    return montar(turno);
  } catch (error) {
    if (violouConstraint(error, "turno_caixa_aberto_idx")) {
      throw conflito("caixa_ja_aberto", "O caixa já está aberto.");
    }
    throw error;
  }
};

export const registrarMovimento = async (
  sessao: Sessao,
  dados: z.infer<typeof movimentoSchema>,
) => {
  const { restauranteId } = sessao.funcionario;
  const turno = await turnoAberto(restauranteId);
  if (!turno) {
    throw conflito("caixa_fechado", "Abra o caixa antes de registrar.");
  }
  if (dados.tipo === "sangria") {
    const { esperadoCentavos } = await numerosDoTurno(turno);
    if (dados.valorCentavos > esperadoCentavos) {
      throw conflito(
        "sangria_maior",
        "A retirada é maior que o dinheiro que deveria estar na gaveta.",
      );
    }
  }
  await db()
    .insert(schema.movimentosCaixa)
    .values({
      turnoId: turno.id,
      funcionarioId: sessao.funcionario.id,
      ...dados,
    });
  notificar(restauranteId, ["mesas"]);
  return montar(turno);
};

export const fecharTurno = async (
  sessao: Sessao,
  { contadoCentavos, observacao }: z.infer<typeof fecharTurnoSchema>,
) => {
  const { restauranteId } = sessao.funcionario;
  const turno = await turnoAberto(restauranteId);
  if (!turno) throw naoEncontrado("Caixa aberto");
  const { esperadoCentavos } = await numerosDoTurno(turno);
  const [fechado] = await db()
    .update(schema.turnosCaixa)
    .set({
      fechadoEm: new Date(),
      fechadoPor: sessao.funcionario.id,
      esperadoCentavos,
      contadoCentavos,
      observacao: observacao || null,
    })
    .where(
      and(
        eq(schema.turnosCaixa.id, turno.id),
        isNull(schema.turnosCaixa.fechadoEm),
      ),
    )
    .returning();
  if (!fechado) throw conflito("caixa_ja_fechado", "O caixa já foi fechado.");
  notificar(restauranteId, ["mesas"]);
  return montar(fechado);
};

// Últimos turnos fechados, com a diferença da gaveta.
export const listarTurnos = async (restauranteId: string, limite = 30) => {
  const turnos = await db()
    .select()
    .from(schema.turnosCaixa)
    .where(eq(schema.turnosCaixa.restauranteId, restauranteId))
    .orderBy(desc(schema.turnosCaixa.abertoEm))
    .limit(limite);
  return Promise.all(turnos.map(montar));
};
