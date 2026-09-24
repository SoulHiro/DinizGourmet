import { rota } from "@/lib/api";
import { exigirSessao } from "@/lib/auth/atual";
import { fecharComanda } from "@/lib/dominio/mesas";

type Contexto = { params: Promise<{ mesaId: string }> };

export const POST = rota<Contexto>(async (_request, { params }) => {
  const sessao = await exigirSessao();
  const { mesaId } = await params;
  return Response.json(await fecharComanda(sessao, mesaId));
});
