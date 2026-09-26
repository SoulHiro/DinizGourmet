import { lerJson, rota } from "@/lib/api";
import { exigirSessao } from "@/lib/auth/atual";
import { editarMesa, editarMesaSchema } from "@/lib/dominio/gerencia";

type Contexto = { params: Promise<{ id: string }> };

export const PATCH = rota<Contexto>(async (request, { params }) => {
  const { funcionario } = await exigirSessao(["gerente"]);
  const { id } = await params;
  const { ativa } = await lerJson(request, editarMesaSchema);
  return Response.json(await editarMesa(funcionario.restauranteId, id, ativa));
});
