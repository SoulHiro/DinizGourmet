import { rota } from "@/lib/api";
import { exigirSessao } from "@/lib/auth/atual";
import { resumoNoite } from "@/lib/dominio/gerencia";

export const GET = rota(async () => {
  const { funcionario } = await exigirSessao(["gerente"]);
  return Response.json(await resumoNoite(funcionario.restauranteId));
});
