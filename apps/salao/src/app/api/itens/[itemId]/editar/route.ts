import { lerJson, rota } from "@/lib/api";
import { exigirSessao } from "@/lib/auth/atual";
import { editarItem, editarItemSchema } from "@/lib/dominio/edicao";

type Contexto = { params: Promise<{ itemId: string }> };

export const POST = rota<Contexto>(async (request, { params }) => {
  const sessao = await exigirSessao();
  const { itemId } = await params;
  const input = await lerJson(request, editarItemSchema);
  return Response.json(await editarItem(sessao, itemId, input));
});
