import { and, asc, eq } from "drizzle-orm";

import { db, schema } from "@/db";
import { conferirPin, PIN_REGEX } from "@/lib/auth/pin";
import { criarSessao } from "@/lib/auth/sessao";
import { ErroDominio, naoEncontrado } from "@/lib/erros";

export const MAX_TENTATIVAS_PIN = 5;
const BLOQUEIO_MS = 5 * 60 * 1000;

export const listarFuncionariosLogin = () =>
  db()
    .select({
      id: schema.funcionarios.id,
      nome: schema.funcionarios.nome,
      papel: schema.funcionarios.papel,
    })
    .from(schema.funcionarios)
    .where(eq(schema.funcionarios.ativo, true))
    .orderBy(asc(schema.funcionarios.nome));

export const entrarComPin = async (
  funcionarioId: string,
  pin: string,
  dispositivo: string | null,
) => {
  const [funcionario] = await db()
    .select()
    .from(schema.funcionarios)
    .where(
      and(
        eq(schema.funcionarios.id, funcionarioId),
        eq(schema.funcionarios.ativo, true),
      ),
    )
    .limit(1);
  if (!funcionario) throw naoEncontrado("Funcionário");

  if (funcionario.bloqueadoAte && funcionario.bloqueadoAte > new Date()) {
    const minutos = Math.ceil(
      (funcionario.bloqueadoAte.getTime() - Date.now()) / 60_000,
    );
    throw new ErroDominio(
      423,
      "bloqueado",
      `Muitas tentativas erradas. Tente de novo em ${minutos} min ou peça ao gerente.`,
    );
  }

  const correto =
    PIN_REGEX.test(pin) && (await conferirPin(pin, funcionario.pinHash));

  if (!correto) {
    const tentativas = funcionario.tentativasFalhas + 1;
    const bloquear = tentativas >= MAX_TENTATIVAS_PIN;
    await db()
      .update(schema.funcionarios)
      .set({
        tentativasFalhas: bloquear ? 0 : tentativas,
        bloqueadoAte: bloquear ? new Date(Date.now() + BLOQUEIO_MS) : null,
      })
      .where(eq(schema.funcionarios.id, funcionario.id));
    throw new ErroDominio(401, "pin_incorreto", "PIN incorreto.", {
      restantes: bloquear ? 0 : MAX_TENTATIVAS_PIN - tentativas,
    });
  }

  await db()
    .update(schema.funcionarios)
    .set({ tentativasFalhas: 0, bloqueadoAte: null })
    .where(eq(schema.funcionarios.id, funcionario.id));

  const sessao = await criarSessao(funcionario.id, dispositivo);
  return {
    ...sessao,
    funcionario: {
      id: funcionario.id,
      nome: funcionario.nome,
      papel: funcionario.papel,
    },
  };
};
