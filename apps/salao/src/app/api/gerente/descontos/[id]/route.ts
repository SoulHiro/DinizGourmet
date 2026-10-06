import { lerJson, rota } from "@/lib/api";
import { exigirSessao } from "@/lib/auth/atual";
import {
  editarDesconto,
  editarDescontoSchema,
  excluirDesconto,
} from "@/lib/dominio/insumos";

type Contexto = { params: Promise<{ id: string }> };

export const PATCH = rota<Contexto>(async (request, { params }) => {
  const { funcionario } = await exigirSessao(["gerente"]);
  const { id } = await params;
  const dados = await lerJson(request, editarDescontoSchema);
  return Response.json(
    await editarDesconto(funcionario.restauranteId, id, dados),
  );
});

export const DELETE = rota<Contexto>(async (_request, { params }) => {
  const { funcionario } = await exigirSessao(["gerente"]);
  const { id } = await params;
  return Response.json(await excluirDesconto(funcionario.restauranteId, id));
});
