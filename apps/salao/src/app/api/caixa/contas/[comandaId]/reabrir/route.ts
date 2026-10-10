import { lerJson, rota } from "@/lib/api";
import { exigirSessao } from "@/lib/auth/atual";
import { reabrirConta, reabrirSchema } from "@/lib/dominio/correcoes-caixa";

type Contexto = { params: Promise<{ comandaId: string }> };

// Só o gerente reabre conta fechada.
export const POST = rota<Contexto>(async (request, { params }) => {
  const sessao = await exigirSessao(["gerente"]);
  const { comandaId } = await params;
  const dados = await lerJson(request, reabrirSchema);
  return Response.json(await reabrirConta(sessao, comandaId, dados));
});
