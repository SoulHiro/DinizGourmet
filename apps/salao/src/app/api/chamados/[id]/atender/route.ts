import { rota } from "@/lib/api";
import { exigirSessao } from "@/lib/auth/atual";
import { atenderChamado } from "@/lib/dominio/chamados";

type Contexto = { params: Promise<{ id: string }> };

export const POST = rota<Contexto>(async (_request, { params }) => {
  const sessao = await exigirSessao();
  const { id } = await params;
  return Response.json(await atenderChamado(sessao, id));
});
