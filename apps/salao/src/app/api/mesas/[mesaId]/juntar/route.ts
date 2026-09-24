import { lerJson, rota } from "@/lib/api";
import { exigirSessao } from "@/lib/auth/atual";
import { juntarMesas, juntarMesasSchema } from "@/lib/dominio/mesas";

type Contexto = { params: Promise<{ mesaId: string }> };

export const POST = rota<Contexto>(async (request, { params }) => {
  const sessao = await exigirSessao();
  const { mesaId } = await params;
  const { mesaIds } = await lerJson(request, juntarMesasSchema);
  return Response.json(await juntarMesas(sessao, mesaId, mesaIds));
});
