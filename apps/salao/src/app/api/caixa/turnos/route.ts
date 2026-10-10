import { rota } from "@/lib/api";
import { exigirSessao } from "@/lib/auth/atual";
import { listarTurnos } from "@/lib/dominio/turno-caixa";

export const GET = rota(async () => {
  const { funcionario } = await exigirSessao(["caixa", "gerente"]);
  return Response.json(await listarTurnos(funcionario.restauranteId));
});
