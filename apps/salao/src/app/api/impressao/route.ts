import { rota } from "@/lib/api";
import { exigirSessao } from "@/lib/auth/atual";
import { resumoImpressao } from "@/lib/dominio/impressao";

export const GET = rota(async () => {
  const { funcionario } = await exigirSessao();
  return Response.json(await resumoImpressao(funcionario.restauranteId));
});
