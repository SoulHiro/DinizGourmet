import { randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";

import { db, schema } from "@/db";
import type { Sessao } from "@/lib/auth/sessao";

export const sessaoDe = async (nome: string): Promise<Sessao> => {
  const [f] = await db()
    .select()
    .from(schema.funcionarios)
    .where(eq(schema.funcionarios.nome, nome));
  return {
    sessaoId: randomUUID(),
    funcionario: {
      id: f.id,
      nome: f.nome,
      papel: f.papel,
      restauranteId: f.restauranteId,
    },
  };
};

export const mesa = async (numero: number) => {
  const [m] = await db()
    .select()
    .from(schema.mesas)
    .where(eq(schema.mesas.numero, numero));
  return m;
};

export const produto = async (nome: string) => {
  const [p] = await db()
    .select()
    .from(schema.produtos)
    .where(eq(schema.produtos.nome, nome));
  return p;
};

export const modificador = async (nome: string) => {
  const [m] = await db()
    .select()
    .from(schema.modificadores)
    .where(eq(schema.modificadores.nome, nome));
  return m;
};

export const definirEstoque = (produtoId: string, estoque: number) =>
  db()
    .update(schema.produtos)
    .set({ controlaEstoque: true, estoque })
    .where(eq(schema.produtos.id, produtoId));

export const contar = async (tabela: string, where = "true") => {
  const r = await db().execute<{ n: number }>(
    sql.raw(`select count(*)::int as n from ${tabela} where ${where}`),
  );
  return r.rows[0].n;
};

export const chave = () => randomUUID();
