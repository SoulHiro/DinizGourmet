import { rota } from "@/lib/api";
import { exigirSessao } from "@/lib/auth/atual";
import { detalharComanda } from "@/lib/dominio/mesas";

type Contexto = { params: Promise<{ comandaId: string }> };

export const GET = rota<Contexto>(async (_request, { params }) => {
  const { funcionario } = await exigirSessao();
  const { comandaId } = await params;
  return Response.json(
    await detalharComanda(funcionario.restauranteId, comandaId),
  );
});
