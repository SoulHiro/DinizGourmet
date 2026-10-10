import { rota } from "@/lib/api";
import { exigirSessao } from "@/lib/auth/atual";
import { sugestoesDoPedido } from "@/lib/dominio/cardapio";

export const GET = rota(async () => {
  const { funcionario } = await exigirSessao();
  return Response.json(await sugestoesDoPedido(funcionario.restauranteId));
});
