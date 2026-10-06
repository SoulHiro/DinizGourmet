import { z } from "zod";

import { rota } from "@/lib/api";
import { exigirSessao } from "@/lib/auth/atual";
import { painelNoite, painelPeriodo } from "@/lib/dominio/painel";

// ?noite=0 é a noite atual, 1 a de ontem... (até uma semana atrás).
// ?periodo=7 ou 30: as últimas noites somadas.
export const GET = rota(async (request) => {
  const { funcionario } = await exigirSessao(["gerente"]);
  const periodo = new URL(request.url).searchParams.get("periodo");
  if (periodo === "7" || periodo === "30") {
    return Response.json(
      await painelPeriodo(funcionario.restauranteId, Number(periodo)),
    );
  }
  const deslocamento = z.coerce
    .number()
    .int()
    .min(0)
    .max(6)
    .catch(0)
    .parse(new URL(request.url).searchParams.get("noite") ?? 0);
  return Response.json(
    await painelNoite(funcionario.restauranteId, deslocamento),
  );
});
