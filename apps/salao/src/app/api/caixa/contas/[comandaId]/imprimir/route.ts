import { rota } from "@/lib/api";
import { exigirSessao } from "@/lib/auth/atual";
import { imprimirConta } from "@/lib/dominio/caixa";

type Contexto = { params: Promise<{ comandaId: string }> };

// Reimpressão da conta ou do comprovante a partir do histórico.
export const POST = rota<Contexto>(async (_request, { params }) => {
  const sessao = await exigirSessao(["caixa", "gerente"]);
  const { comandaId } = await params;
  return Response.json(await imprimirConta(sessao, { comandaId }));
});
