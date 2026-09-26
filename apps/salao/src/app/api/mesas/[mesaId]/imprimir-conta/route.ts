import { rota } from "@/lib/api";
import { exigirSessao } from "@/lib/auth/atual";
import { imprimirConta } from "@/lib/dominio/caixa";

type Contexto = { params: Promise<{ mesaId: string }> };

// Conferência da conta (pré-conta) na impressora do caixa.
export const POST = rota<Contexto>(async (_request, { params }) => {
  const sessao = await exigirSessao();
  const { mesaId } = await params;
  return Response.json(await imprimirConta(sessao, { mesaId }));
});
