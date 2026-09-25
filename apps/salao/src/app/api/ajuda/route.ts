import { z } from "zod";

import { lerJson, rota } from "@/lib/api";
import { exigirSessao } from "@/lib/auth/atual";
import { listarAjudas, pedirAjuda } from "@/lib/dominio/ajuda";

export const GET = rota(async () => {
  const { funcionario } = await exigirSessao();
  return Response.json(await listarAjudas(funcionario.restauranteId));
});

export const POST = rota(async (request) => {
  const sessao = await exigirSessao();
  const { mesaId } = await lerJson(request, z.object({ mesaId: z.uuid() }));
  return Response.json(await pedirAjuda(sessao, mesaId), { status: 201 });
});
