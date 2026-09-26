import { rota } from "@/lib/api";
import { exigirSessao } from "@/lib/auth/atual";
import { encerrarAjuda } from "@/lib/dominio/ajuda";

type Contexto = { params: Promise<{ id: string }> };

export const POST = rota<Contexto>(async (_request, { params }) => {
  const sessao = await exigirSessao();
  const { id } = await params;
  await encerrarAjuda(sessao, id);
  return Response.json({ ok: true });
});
