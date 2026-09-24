import { lerJson, rota } from "@/lib/api";
import { exigirSessao } from "@/lib/auth/atual";
import { lancarRodada, lancarRodadaSchema } from "@/lib/dominio/rodadas";

type Contexto = { params: Promise<{ mesaId: string }> };

export const POST = rota<Contexto>(async (request, { params }) => {
  const sessao = await exigirSessao();
  const { mesaId } = await params;
  const input = await lerJson(request, lancarRodadaSchema);
  const resultado = await lancarRodada(sessao, mesaId, input);
  return Response.json(resultado, { status: resultado.repetida ? 200 : 201 });
});
