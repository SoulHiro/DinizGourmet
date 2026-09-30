import { lerJson, rota } from "@/lib/api";
import { exigirSessao } from "@/lib/auth/atual";
import {
  criarCartoes,
  criarCartoesSchema,
  listarCartoes,
} from "@/lib/dominio/cartoes";

export const GET = rota(async () => {
  const { funcionario } = await exigirSessao(["gerente"]);
  return Response.json(await listarCartoes(funcionario.restauranteId));
});

export const POST = rota(async (request) => {
  const { funcionario } = await exigirSessao(["gerente"]);
  const { ate } = await lerJson(request, criarCartoesSchema);
  return Response.json(await criarCartoes(funcionario.restauranteId, ate), {
    status: 201,
  });
});
