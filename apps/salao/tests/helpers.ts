import { randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";

import { db, schema } from "@/db";
import type { Sessao } from "@/lib/auth/sessao";
import { comandasAbertasDaMesa } from "@/lib/dominio/comum";
import {
  abrirComanda,
  detalharComanda,
  type FecharMesaInput,
  fecharComanda,
} from "@/lib/dominio/mesas";
import { type LancarRodadaInput, lancarRodada } from "@/lib/dominio/rodadas";

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

// Comandas por cartão: nos testes, a mesa N usa o cartão N (fácil de ler).
// Devolve a comanda aberta na mesa ou abre uma nova com esse cartão.
export const comandaDaMesa = async (sessao: Sessao, mesaId: string) => {
  const [mesaAtual] = await db()
    .select()
    .from(schema.mesas)
    .where(eq(schema.mesas.id, mesaId));
  const [aberta] = await comandasAbertasDaMesa(db(), mesaId);
  if (aberta) return aberta.id;
  const { comandaId } = await abrirComanda(sessao, {
    mesaId,
    numero: mesaAtual.numero,
  });
  return comandaId;
};

// Comanda aberta na mesa (sem abrir): para fechar/detalhar nos testes.
export const comandaAbertaNa = async (mesaId: string) => {
  const [aberta] = await comandasAbertasDaMesa(db(), mesaId);
  if (!aberta) throw new Error("Mesa sem comanda aberta no teste");
  return aberta.id;
};

export const lancarNaMesa = async (
  sessao: Sessao,
  mesaId: string,
  input: LancarRodadaInput,
) => lancarRodada(sessao, await comandaDaMesa(sessao, mesaId), input);

export const fecharNaMesa = async (
  sessao: Sessao,
  mesaId: string,
  input?: FecharMesaInput,
) => fecharComanda(sessao, await comandaAbertaNa(mesaId), input);

export const detalheDaMesa = async (restauranteId: string, mesaId: string) =>
  detalharComanda(restauranteId, await comandaAbertaNa(mesaId));
