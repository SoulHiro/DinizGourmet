import { lerJson, rota } from "@/lib/api";
import { exigirSessao } from "@/lib/auth/atual";
import { editarCartao, editarCartaoSchema } from "@/lib/dominio/cartoes";

type Contexto = { params: Promise<{ id: string }> };

export const PATCH = rota<Contexto>(async (request, { params }) => {
  const { funcionario } = await exigirSessao(["gerente"]);
  const { id } = await params;
  const { ativo } = await lerJson(request, editarCartaoSchema);
  return Response.json(
    await editarCartao(funcionario.restauranteId, id, ativo),
  );
});
