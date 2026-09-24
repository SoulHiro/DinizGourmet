import { rota } from "@/lib/api";
import { exigirSessao } from "@/lib/auth/atual";
import { separarMesa } from "@/lib/dominio/mesas";

type Contexto = { params: Promise<{ mesaId: string }> };

export const POST = rota<Contexto>(async (_request, { params }) => {
  const sessao = await exigirSessao();
  const { mesaId } = await params;
  return Response.json(await separarMesa(sessao, mesaId));
});
