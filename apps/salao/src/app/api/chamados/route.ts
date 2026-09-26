import { rota } from "@/lib/api";
import { exigirSessao } from "@/lib/auth/atual";
import { listarChamados } from "@/lib/dominio/chamados";

export const GET = rota(async () => {
  const { funcionario } = await exigirSessao();
  return Response.json(await listarChamados(funcionario.restauranteId));
});
