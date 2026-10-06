import { lerJson, rota } from "@/lib/api";
import { exigirSessao } from "@/lib/auth/atual";
import {
  editarInsumo,
  editarInsumoSchema,
  excluirInsumo,
} from "@/lib/dominio/insumos";

type Contexto = { params: Promise<{ id: string }> };

export const PATCH = rota<Contexto>(async (request, { params }) => {
  const { funcionario } = await exigirSessao(["gerente"]);
  const { id } = await params;
  const dados = await lerJson(request, editarInsumoSchema);
  return Response.json(
    await editarInsumo(funcionario.restauranteId, id, dados),
  );
});

export const DELETE = rota<Contexto>(async (_request, { params }) => {
  const { funcionario } = await exigirSessao(["gerente"]);
  const { id } = await params;
  return Response.json(await excluirInsumo(funcionario.restauranteId, id));
});
