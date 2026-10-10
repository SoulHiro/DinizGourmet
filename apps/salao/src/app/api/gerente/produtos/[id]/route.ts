import { lerJson, rota } from "@/lib/api";
import { exigirSessao } from "@/lib/auth/atual";
import {
  editarProduto,
  editarProdutoSchema,
  excluirProduto,
} from "@/lib/dominio/gerencia";

type Contexto = { params: Promise<{ id: string }> };

export const PATCH = rota<Contexto>(async (request, { params }) => {
  const { funcionario } = await exigirSessao(["gerente"]);
  const { id } = await params;
  const input = await lerJson(request, editarProdutoSchema);
  return Response.json(
    await editarProduto(funcionario.restauranteId, id, input),
  );
});

export const DELETE = rota<Contexto>(async (_request, { params }) => {
  const { funcionario } = await exigirSessao(["gerente"]);
  const { id } = await params;
  return Response.json(await excluirProduto(funcionario.restauranteId, id));
});
