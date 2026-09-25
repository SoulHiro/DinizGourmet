import { rota } from "@/lib/api";
import { exigirSessao } from "@/lib/auth/atual";
import { oferecerAjuda } from "@/lib/dominio/ajuda";

type Contexto = { params: Promise<{ mesaId: string }> };

// Garçom se oferece para ajudar nesta mesa (entra como auxiliar).
export const POST = rota<Contexto>(async (_request, { params }) => {
  const sessao = await exigirSessao();
  const { mesaId } = await params;
  return Response.json(await oferecerAjuda(sessao, mesaId));
});
