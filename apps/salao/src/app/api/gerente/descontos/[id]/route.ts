import { lerJson, rota } from "@/lib/api";
import { exigirSessao } from "@/lib/auth/atual";
import { editarDesconto, editarDescontoSchema } from "@/lib/dominio/insumos";

type Contexto = { params: Promise<{ id: string }> };

export const PATCH = rota<Contexto>(async (request, { params }) => {
  const { funcionario } = await exigirSessao(["gerente"]);
  const { id } = await params;
  const { ativo } = await lerJson(request, editarDescontoSchema);
  return Response.json(
    await editarDesconto(funcionario.restauranteId, id, ativo),
  );
});
