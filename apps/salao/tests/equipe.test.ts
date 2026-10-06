import { eq, sql } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";

import { db, schema } from "@/db";
import type { Sessao } from "@/lib/auth/sessao";
import { editarFuncionario, listarEquipe } from "@/lib/dominio/gerencia";
import { sessaoDe } from "./helpers";

let gerente: Sessao;

beforeAll(async () => {
  gerente = await sessaoDe("Gerente");
});

describe("equipe", () => {
  it("o gerente não consegue se desativar nem tirar o próprio papel", async () => {
    const { restauranteId, id } = gerente.funcionario;
    await expect(
      editarFuncionario(restauranteId, id, { ativo: false }, id),
    ).rejects.toThrow(/você mesmo/);
    await expect(
      editarFuncionario(restauranteId, id, { papel: "garcom" }, id),
    ).rejects.toThrow(/você mesmo/);
  });

  it("desbloquear libera quem errou o PIN sem trocar o PIN", async () => {
    const garcom = await sessaoDe("Garçom B");
    const { id } = garcom.funcionario;
    await db()
      .update(schema.funcionarios)
      .set({
        tentativasFalhas: 5,
        bloqueadoAte: sql`now() + interval '10 minutes'`,
      })
      .where(eq(schema.funcionarios.id, id));

    await editarFuncionario(
      gerente.funcionario.restauranteId,
      id,
      { desbloquear: true },
      gerente.funcionario.id,
    );

    const [depois] = await db()
      .select()
      .from(schema.funcionarios)
      .where(eq(schema.funcionarios.id, id));
    expect(depois.bloqueadoAte).toBeNull();
    expect(depois.tentativasFalhas).toBe(0);
  });

  it("lista quem está conectado agora", async () => {
    await db()
      .insert(schema.sessoes)
      .values({
        tokenHash: `teste-${Date.now()}`,
        funcionarioId: gerente.funcionario.id,
        expiraEm: new Date(Date.now() + 3_600_000),
      });
    const equipe = await listarEquipe(gerente.funcionario.restauranteId);
    const eu = equipe.find((f) => f.id === gerente.funcionario.id);
    expect(eu?.conectado).toBe(true);
    expect(eu?.ultimoAcesso).not.toBeNull();
  });
});
