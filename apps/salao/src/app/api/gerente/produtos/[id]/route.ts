import { lerJson, rota } from "@/lib/api";
import { exigirSessao } from "@/lib/auth/atual";
import { editarProduto, editarProdutoSchema } from "@/lib/dominio/gerencia";

type Contexto = { params: Promise<{ id: string }> };

export const PATCH = rota<Contexto>(async (request, { params }) => {
  const { funcionario } = await exigirSessao(["gerente"]);
  const { id } = await params;
  const input = await lerJson(request, editarProdutoSchema);
  return Response.json(
    await editarProduto(funcionario.restauranteId, id, input),
  );
});
