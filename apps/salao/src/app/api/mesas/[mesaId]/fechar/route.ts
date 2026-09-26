import { rota } from "@/lib/api";
import { exigirSessao } from "@/lib/auth/atual";
import { fecharComanda, fecharMesaSchema } from "@/lib/dominio/mesas";

type Contexto = { params: Promise<{ mesaId: string }> };

export const POST = rota<Contexto>(async (request, { params }) => {
  const sessao = await exigirSessao();
  const { mesaId } = await params;
  const corpo = await request.text();
  const input = fecharMesaSchema.parse(corpo ? JSON.parse(corpo) : {});
  return Response.json(await fecharComanda(sessao, mesaId, input));
});
