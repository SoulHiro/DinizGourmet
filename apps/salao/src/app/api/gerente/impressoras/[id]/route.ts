import { lerJson, rota } from "@/lib/api";
import { exigirSessao } from "@/lib/auth/atual";
import { impressoraSchema, salvarImpressora } from "@/lib/dominio/gerencia";

type Contexto = { params: Promise<{ id: string }> };

export const PATCH = rota<Contexto>(async (request, { params }) => {
  const { funcionario } = await exigirSessao(["gerente"]);
  const { id } = await params;
  const input = await lerJson(request, impressoraSchema);
  return Response.json(
    await salvarImpressora(funcionario.restauranteId, id, input),
  );
});
