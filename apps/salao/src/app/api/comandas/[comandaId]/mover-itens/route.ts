import { lerJson, rota } from "@/lib/api";
import { exigirSessao } from "@/lib/auth/atual";
import { moverItens, moverItensSchema } from "@/lib/dominio/mover-itens";

type Contexto = { params: Promise<{ comandaId: string }> };

export const POST = rota<Contexto>(async (request, { params }) => {
  const sessao = await exigirSessao();
  const { comandaId } = await params;
  const input = await lerJson(request, moverItensSchema);
  return Response.json(await moverItens(sessao, comandaId, input));
});
