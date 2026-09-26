import { lerJson, rota } from "@/lib/api";
import { exigirSessao } from "@/lib/auth/atual";
import {
  criarMesa,
  criarMesaSchema,
  listarMesasGerencia,
} from "@/lib/dominio/gerencia";

export const GET = rota(async () => {
  const { funcionario } = await exigirSessao(["gerente"]);
  return Response.json(await listarMesasGerencia(funcionario.restauranteId));
});

export const POST = rota(async (request) => {
  const { funcionario } = await exigirSessao(["gerente"]);
  const { numero } = await lerJson(request, criarMesaSchema);
  return Response.json(await criarMesa(funcionario.restauranteId, numero), {
    status: 201,
  });
});
