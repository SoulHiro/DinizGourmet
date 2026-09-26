import { lerJson, rota } from "@/lib/api";
import { exigirSessao } from "@/lib/auth/atual";
import { transferirComanda, transferirSchema } from "@/lib/dominio/mesas";

type Contexto = { params: Promise<{ mesaId: string }> };

export const POST = rota<Contexto>(async (request, { params }) => {
  const sessao = await exigirSessao();
  const { mesaId } = await params;
  const { destinoMesaId } = await lerJson(request, transferirSchema);
  return Response.json(await transferirComanda(sessao, mesaId, destinoMesaId));
});
