import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt, isNull } from "drizzle-orm";

import { db, schema } from "@/db";
import type { PapelFuncionario } from "@/db/schema";

export const COOKIE_SESSAO = "salao_sessao";
// Um turno longo de sexta/sábado cabe folgado; depois disso, novo login.
export const DURACAO_SESSAO_MS = 14 * 60 * 60 * 1000;

export type FuncionarioSessao = {
  id: string;
  nome: string;
  papel: PapelFuncionario;
  restauranteId: string;
};

export type Sessao = {
  sessaoId: string;
  funcionario: FuncionarioSessao;
};

const hashToken = (token: string) =>
  createHash("sha256").update(token).digest("hex");

export const criarSessao = async (
  funcionarioId: string,
  dispositivo: string | null,
) => {
  const token = randomBytes(32).toString("base64url");
  const expiraEm = new Date(Date.now() + DURACAO_SESSAO_MS);
  await db()
    .insert(schema.sessoes)
    .values({
      tokenHash: hashToken(token),
      funcionarioId,
      dispositivo,
      expiraEm,
    });
  return { token, expiraEm };
};

export const validarToken = async (
  token: string | undefined | null,
): Promise<Sessao | null> => {
  if (!token) return null;
  const [linha] = await db()
    .select({
      sessaoId: schema.sessoes.id,
      id: schema.funcionarios.id,
      nome: schema.funcionarios.nome,
      papel: schema.funcionarios.papel,
      restauranteId: schema.funcionarios.restauranteId,
    })
    .from(schema.sessoes)
    .innerJoin(
      schema.funcionarios,
      eq(schema.funcionarios.id, schema.sessoes.funcionarioId),
    )
    .where(
      and(
        eq(schema.sessoes.tokenHash, hashToken(token)),
        isNull(schema.sessoes.revogadaEm),
        gt(schema.sessoes.expiraEm, new Date()),
        eq(schema.funcionarios.ativo, true),
      ),
    )
    .limit(1);

  if (!linha) return null;
  const { sessaoId, ...funcionario } = linha;
  return { sessaoId, funcionario };
};

export const revogarToken = async (token: string) => {
  await db()
    .update(schema.sessoes)
    .set({ revogadaEm: new Date() })
    .where(eq(schema.sessoes.tokenHash, hashToken(token)));
};
