import { rota } from "@/lib/api";
import { exigirSessao } from "@/lib/auth/atual";
import { detalharMesa } from "@/lib/dominio/mesas";

type Contexto = { params: Promise<{ mesaId: string }> };

export const GET = rota<Contexto>(async (_request, { params }) => {
  const { funcionario } = await exigirSessao();
  const { mesaId } = await params;
  return Response.json(await detalharMesa(funcionario.restauranteId, mesaId));
});
