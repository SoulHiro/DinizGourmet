import { rota } from "@/lib/api";
import { exigirSessao } from "@/lib/auth/atual";
import { aceitarAjuda } from "@/lib/dominio/ajuda";

type Contexto = { params: Promise<{ id: string }> };

export const POST = rota<Contexto>(async (_request, { params }) => {
  const sessao = await exigirSessao();
  const { id } = await params;
  return Response.json(await aceitarAjuda(sessao, id));
});
