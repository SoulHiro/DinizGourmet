import { lerJson, rota } from "@/lib/api";
import { exigirSessao } from "@/lib/auth/atual";
import {
  criarProduto,
  criarProdutoSchema,
  listarProdutosGerencia,
} from "@/lib/dominio/gerencia";

export const GET = rota(async () => {
  const { funcionario } = await exigirSessao(["gerente"]);
  return Response.json(await listarProdutosGerencia(funcionario.restauranteId));
});

export const POST = rota(async (request) => {
  const { funcionario } = await exigirSessao(["gerente"]);
  const input = await lerJson(request, criarProdutoSchema);
  return Response.json(await criarProduto(funcionario.restauranteId, input), {
    status: 201,
  });
});
