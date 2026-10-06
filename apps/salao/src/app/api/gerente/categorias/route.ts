import { lerJson, rota } from "@/lib/api";
import { exigirSessao } from "@/lib/auth/atual";
import {
  criarCategoria,
  criarCategoriaSchema,
} from "@/lib/dominio/cardapio-gestao";

export const POST = rota(async (request) => {
  const { funcionario } = await exigirSessao(["gerente"]);
  const input = await lerJson(request, criarCategoriaSchema);
  return Response.json(await criarCategoria(funcionario.restauranteId, input), {
    status: 201,
  });
});
