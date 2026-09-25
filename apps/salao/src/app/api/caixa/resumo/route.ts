import { z } from "zod";

import { rota } from "@/lib/api";
import { exigirSessao } from "@/lib/auth/atual";
import { resumoCaixa } from "@/lib/dominio/caixa";

export const GET = rota(async (request) => {
  const { funcionario } = await exigirSessao(["caixa", "gerente"]);
  const data = new URL(request.url).searchParams.get("data") || undefined;
  return Response.json(
    await resumoCaixa(
      funcionario.restauranteId,
      data ? z.iso.date().parse(data) : undefined,
    ),
  );
});
