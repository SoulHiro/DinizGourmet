import { rota } from "@/lib/api";
import { exigirSessao } from "@/lib/auth/atual";
import { detalheDaConta } from "@/lib/dominio/caixa";

type Contexto = { params: Promise<{ comandaId: string }> };

export const GET = rota<Contexto>(async (_request, { params }) => {
  const { funcionario } = await exigirSessao(["caixa", "gerente"]);
  const { comandaId } = await params;
  return Response.json(
    await detalheDaConta(funcionario.restauranteId, comandaId),
  );
});
