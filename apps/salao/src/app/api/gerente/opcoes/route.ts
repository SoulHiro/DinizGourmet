import { lerJson, rota } from "@/lib/api";
import { exigirSessao } from "@/lib/auth/atual";
import {
  criarOpcao,
  criarOpcaoSchema,
  listarOpcoes,
} from "@/lib/dominio/cardapio-gestao";

export const GET = rota(async () => {
  const { funcionario } = await exigirSessao(["gerente"]);
  return Response.json(await listarOpcoes(funcionario.restauranteId));
});

export const POST = rota(async (request) => {
  const { funcionario } = await exigirSessao(["gerente"]);
  const input = await lerJson(request, criarOpcaoSchema);
  return Response.json(await criarOpcao(funcionario.restauranteId, input), {
    status: 201,
  });
});
