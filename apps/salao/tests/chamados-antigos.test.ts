import { eq, sql } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { db, schema } from "@/db";
import { chamarPeloQr, manutencaoChamados } from "@/lib/dominio/chamados";
import { mesa } from "./helpers";

describe("chamados esquecidos", () => {
  it("chamado de outra noite se encerra sozinho na manutenção", async () => {
    const m = await mesa(11);
    await chamarPeloQr(m.tokenQr, "garcom");
    // Simula um chamado de 13 horas atrás que ninguém fechou.
    await db()
      .update(schema.chamados)
      .set({ criadoEm: sql`now() - interval '13 hours'` })
      .where(eq(schema.chamados.mesaId, m.id));

    await manutencaoChamados(180);

    const abertos = await db()
      .select()
      .from(schema.chamados)
      .where(eq(schema.chamados.mesaId, m.id));
    expect(abertos.every((c) => c.encerradoEm !== null)).toBe(true);
  });
});
