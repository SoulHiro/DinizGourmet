import { lerJson, rota } from "@/lib/api";
import { exigirSessao } from "@/lib/auth/atual";
import { cancelarItem, cancelarItemSchema } from "@/lib/dominio/cancelamento";

type Contexto = { params: Promise<{ itemId: string }> };

export const POST = rota<Contexto>(async (request, { params }) => {
  const sessao = await exigirSessao();
  const { itemId } = await params;
  const input = await lerJson(request, cancelarItemSchema);
  return Response.json(await cancelarItem(sessao, itemId, input));
});
