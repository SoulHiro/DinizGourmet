import { lerJson, rota } from "@/lib/api";
import { exigirSessao } from "@/lib/auth/atual";
import {
  impressoraSchema,
  listarImpressorasGerencia,
  salvarImpressora,
} from "@/lib/dominio/gerencia";

export const GET = rota(async () => {
  const { funcionario } = await exigirSessao(["gerente"]);
  return Response.json(
    await listarImpressorasGerencia(funcionario.restauranteId),
  );
});

export const POST = rota(async (request) => {
  const { funcionario } = await exigirSessao(["gerente"]);
  const input = await lerJson(request, impressoraSchema);
  return Response.json(
    await salvarImpressora(funcionario.restauranteId, null, input),
    { status: 201 },
  );
});
