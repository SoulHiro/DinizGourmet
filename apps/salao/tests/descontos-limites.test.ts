import { beforeAll, describe, expect, it } from "vitest";

import type { Sessao } from "@/lib/auth/sessao";
import { criarDesconto, listarDescontos } from "@/lib/dominio/insumos";
import {
  chave,
  fecharNaMesa,
  lancarNaMesa,
  mesa,
  produto,
  sessaoDe,
} from "./helpers";

let garcom: Sessao;
let gerente: Sessao;
let restauranteId: string;

const lancar = async (sessao: Sessao, numeroMesa: number) => {
  const m = await mesa(numeroMesa);
  const p = await produto("Batata Frita");
  await lancarNaMesa(sessao, m.id, {
    idempotencyKey: chave(),
    itens: [{ produtoId: p.id, quantidade: 1, modificadorIds: [] }],
  });
  return m;
};

beforeAll(async () => {
  garcom = await sessaoDe("Garçom A");
  gerente = await sessaoDe("Gerente");
  restauranteId = gerente.funcionario.restauranteId;
});

describe("limites de desconto", () => {
  it("desconto só do gerente: garçom é barrado, gerente aplica", async () => {
    const cortesia = await criarDesconto(restauranteId, {
      nome: "Cortesia teste",
      tipo: "percentual",
      valor: 100,
      somenteGerente: true,
    });
    const m = await lancar(garcom, 14);
    await expect(
      fecharNaMesa(garcom, m.id, { descontoId: cortesia.id }),
    ).rejects.toMatchObject({ codigo: "desconto_so_gerente" });
    const r = await fecharNaMesa(gerente, m.id, { descontoId: cortesia.id });
    expect(r.descontoCentavos).toBeGreaterThan(0);
  });

  it("limite por noite: depois de usado o máximo, não aplica mais", async () => {
    const happy = await criarDesconto(restauranteId, {
      nome: "Happy hour teste",
      tipo: "percentual",
      valor: 10,
      limitePorNoite: 1,
    });
    const m1 = await lancar(garcom, 15);
    await fecharNaMesa(garcom, m1.id, { descontoId: happy.id });

    const m2 = await lancar(garcom, 16);
    await expect(
      fecharNaMesa(garcom, m2.id, { descontoId: happy.id }),
    ).rejects.toMatchObject({ codigo: "desconto_esgotado" });

    const listado = (await listarDescontos(restauranteId)).find(
      (d) => d.id === happy.id,
    );
    expect(listado?.usosHoje).toBe(1);
  });
});
