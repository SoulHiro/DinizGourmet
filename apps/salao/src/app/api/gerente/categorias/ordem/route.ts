import { lerJson, rota } from "@/lib/api";
import { exigirSessao } from "@/lib/auth/atual";
import {
  reordenarCategorias,
  reordenarSchema,
} from "@/lib/dominio/cardapio-gestao";

export const POST = rota(async (request) => {
  const { funcionario } = await exigirSessao(["gerente"]);
  const { ids } = await lerJson(request, reordenarSchema);
  return Response.json(
    await reordenarCategorias(funcionario.restauranteId, ids),
  );
});
