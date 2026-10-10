import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { z } from "zod";

import { db, schema } from "@/db";
import type { Sessao } from "@/lib/auth/sessao";
import { conflito, naoEncontrado } from "@/lib/erros";
import { notificar } from "@/lib/runtime";
import { METODOS_PAGAMENTO } from "./pagamento";

// Correções do gerente depois de a conta fechar: reabrir uma conta fechada
// por engano e corrigir a forma de pagamento. Tudo fica registrado.

export const reabrirSchema = z.object({
  motivo: z.string().trim().min(3).max(120),
});

// A conta volta a ficar aberta na mesa em que estava, sem pagamento, taxa,
// gorjeta e desconto (o fechamento é refeito do zero).
export const reabrirConta = async (
  sessao: Sessao,
  comandaId: string,
  { motivo }: z.infer<typeof reabrirSchema>,
) => {
  const { restauranteId } = sessao.funcionario;
  await db().transaction(async (tx) => {
    const [comanda] = await tx
      .select()
      .from(schema.comandas)
      .where(
        and(
          eq(schema.comandas.id, comandaId),
          eq(schema.comandas.restauranteId, restauranteId),
        ),
      )
      .for("update");
    if (!comanda) throw naoEncontrado("Conta");
    if (comanda.status === "aberta") {
      throw conflito("conta_aberta", "Esta conta já está aberta.");
    }
    // O cartão pode ter sido entregue para outra pessoa depois.
    if (comanda.cartaoId) {
      const [emUso] = await tx
        .select({ id: schema.comandas.id })
        .from(schema.comandas)
        .where(
          and(
            eq(schema.comandas.cartaoId, comanda.cartaoId),
            eq(schema.comandas.status, "aberta"),
          ),
        );
      if (emUso) {
        throw conflito(
          "cartao_em_uso",
          `O cartão ${comanda.numero} já está em outra conta aberta. Feche aquela antes.`,
        );
      }
    }
    // Volta para a última mesa em que a conta estava.
    const [ultimaMesa] = await tx
      .select({ mesaId: schema.comandaMesas.mesaId })
      .from(schema.comandaMesas)
      .where(eq(schema.comandaMesas.comandaId, comanda.id))
      .orderBy(desc(sql`coalesce(${schema.comandaMesas.saiuEm}, now())`))
      .limit(1);
    if (!ultimaMesa) throw naoEncontrado("Mesa da conta");

    await tx
      .delete(schema.pagamentos)
      .where(eq(schema.pagamentos.comandaId, comanda.id));
    await tx
      .delete(schema.gorjetaDivisoes)
      .where(eq(schema.gorjetaDivisoes.comandaId, comanda.id));
    await tx
      .insert(schema.comandaMesas)
      .values({ comandaId: comanda.id, mesaId: ultimaMesa.mesaId });
    await tx
      .update(schema.comandas)
      .set({
        status: "aberta",
        fechadaEm: null,
        fechadaPor: null,
        gorjetaCentavos: null,
        taxaServicoCentavos: null,
        semTaxaMotivo: null,
        semTaxaObservacao: null,
        descontoCentavos: null,
        descontoNome: null,
        descontoId: null,
        reabertaEm: new Date(),
        reabertaPor: sessao.funcionario.id,
        reabertaMotivo: motivo,
      })
      .where(eq(schema.comandas.id, comanda.id));
  });
  notificar(restauranteId, ["mesas"]);
  return { comandaId };
};

export const corrigirPagamentoSchema = z.object({
  metodo: z.enum(METODOS_PAGAMENTO),
});

// Troca a forma de um pagamento já feito (o valor não muda). Guarda a forma
// original e quem corrigiu.
export const corrigirPagamento = async (
  sessao: Sessao,
  pagamentoId: string,
  { metodo }: z.infer<typeof corrigirPagamentoSchema>,
) => {
  const { restauranteId } = sessao.funcionario;
  const [atual] = await db()
    .select()
    .from(schema.pagamentos)
    .where(
      and(
        eq(schema.pagamentos.id, pagamentoId),
        eq(schema.pagamentos.restauranteId, restauranteId),
      ),
    );
  if (!atual) throw naoEncontrado("Pagamento");
  if (atual.metodo === metodo) return { id: atual.id };
  if (atual.trocoCentavos > 0 && metodo !== "dinheiro") {
    throw conflito(
      "pagamento_com_troco",
      "Este pagamento teve troco em dinheiro; não dá para trocar a forma.",
    );
  }
  const [corrigido] = await db()
    .update(schema.pagamentos)
    .set({
      metodo,
      // Fora do dinheiro não existe "recebido" nem troco.
      recebidoCentavos: metodo === "dinheiro" ? atual.valorCentavos : null,
      trocoCentavos: 0,
      metodoOriginal: atual.metodoOriginal ?? atual.metodo,
      corrigidoPor: sessao.funcionario.id,
      corrigidoEm: new Date(),
    })
    .where(
      and(
        eq(schema.pagamentos.id, pagamentoId),
        isNull(schema.pagamentos.corrigidoEm),
      ),
    )
    .returning({ id: schema.pagamentos.id });
  // Já corrigido antes: permite corrigir de novo mantendo a original.
  if (!corrigido) {
    await db()
      .update(schema.pagamentos)
      .set({
        metodo,
        recebidoCentavos: metodo === "dinheiro" ? atual.valorCentavos : null,
        trocoCentavos: 0,
        corrigidoPor: sessao.funcionario.id,
        corrigidoEm: new Date(),
      })
      .where(eq(schema.pagamentos.id, pagamentoId));
  }
  notificar(restauranteId, ["mesas"]);
  return { id: pagamentoId };
};
