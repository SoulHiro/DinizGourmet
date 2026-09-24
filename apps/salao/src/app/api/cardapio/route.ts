import { rota } from "@/lib/api";
import { exigirSessao } from "@/lib/auth/atual";
import { listarCardapio } from "@/lib/dominio/cardapio";

export const GET = rota(async () => {
  const { funcionario } = await exigirSessao();
  return Response.json(await listarCardapio(funcionario.restauranteId));
});
