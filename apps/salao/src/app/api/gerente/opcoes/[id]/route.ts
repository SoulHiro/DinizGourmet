import { lerJson, rota } from "@/lib/api";
import { exigirSessao } from "@/lib/auth/atual";
import {
  editarOpcao,
  editarOpcaoSchema,
  excluirOpcao,
} from "@/lib/dominio/cardapio-gestao";

type Contexto = { params: Promise<{ id: string }> };

export const PATCH = rota<Contexto>(async (request, { params }) => {
  const { funcionario } = await exigirSessao(["gerente"]);
  const { id } = await params;
  const input = await lerJson(request, editarOpcaoSchema);
  return Response.json(await editarOpcao(funcionario.restauranteId, id, input));
});

export const DELETE = rota<Contexto>(async (_request, { params }) => {
  const { funcionario } = await exigirSessao(["gerente"]);
  const { id } = await params;
  return Response.json(await excluirOpcao(funcionario.restauranteId, id));
});
