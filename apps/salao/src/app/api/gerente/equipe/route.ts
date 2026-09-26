import { lerJson, rota } from "@/lib/api";
import { exigirSessao } from "@/lib/auth/atual";
import {
  criarFuncionario,
  criarFuncionarioSchema,
  listarEquipe,
} from "@/lib/dominio/gerencia";

export const GET = rota(async () => {
  const { funcionario } = await exigirSessao(["gerente"]);
  return Response.json(await listarEquipe(funcionario.restauranteId));
});

export const POST = rota(async (request) => {
  const { funcionario } = await exigirSessao(["gerente"]);
  const input = await lerJson(request, criarFuncionarioSchema);
  return Response.json(
    await criarFuncionario(funcionario.restauranteId, input),
    { status: 201 },
  );
});
