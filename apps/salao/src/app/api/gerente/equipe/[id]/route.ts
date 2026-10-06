import { lerJson, rota } from "@/lib/api";
import { exigirSessao } from "@/lib/auth/atual";
import {
  editarFuncionario,
  editarFuncionarioSchema,
} from "@/lib/dominio/gerencia";

type Contexto = { params: Promise<{ id: string }> };

export const PATCH = rota<Contexto>(async (request, { params }) => {
  const { funcionario } = await exigirSessao(["gerente"]);
  const { id } = await params;
  const input = await lerJson(request, editarFuncionarioSchema);
  return Response.json(
    await editarFuncionario(
      funcionario.restauranteId,
      id,
      input,
      funcionario.id,
    ),
  );
});
