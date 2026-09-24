import { rota } from "@/lib/api";
import { exigirSessao } from "@/lib/auth/atual";
import { reenviarPendentes } from "@/lib/dominio/impressao";

export const POST = rota(async () => {
  const { funcionario } = await exigirSessao();
  return Response.json(await reenviarPendentes(funcionario.restauranteId));
});
