import { lerJson, rota } from "@/lib/api";
import { exigirSessao } from "@/lib/auth/atual";
import { lancarRodada, lancarRodadaSchema } from "@/lib/dominio/rodadas";

type Contexto = { params: Promise<{ comandaId: string }> };

export const POST = rota<Contexto>(async (request, { params }) => {
  const sessao = await exigirSessao();
  const { comandaId } = await params;
  const input = await lerJson(request, lancarRodadaSchema);
  const resultado = await lancarRodada(sessao, comandaId, input);
  return Response.json(resultado, { status: resultado.repetida ? 200 : 201 });
});
