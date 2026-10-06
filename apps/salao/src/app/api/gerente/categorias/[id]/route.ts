import { lerJson, rota } from "@/lib/api";
import { exigirSessao } from "@/lib/auth/atual";
import { excluirCategoria } from "@/lib/dominio/cardapio-gestao";
import { editarCategoria, editarCategoriaSchema } from "@/lib/dominio/gerencia";

type Contexto = { params: Promise<{ id: string }> };

export const PATCH = rota<Contexto>(async (request, { params }) => {
  const { funcionario } = await exigirSessao(["gerente"]);
  const { id } = await params;
  const input = await lerJson(request, editarCategoriaSchema);
  return Response.json(
    await editarCategoria(funcionario.restauranteId, id, input),
  );
});

export const DELETE = rota<Contexto>(async (_request, { params }) => {
  const { funcionario } = await exigirSessao(["gerente"]);
  const { id } = await params;
  return Response.json(await excluirCategoria(funcionario.restauranteId, id));
});
