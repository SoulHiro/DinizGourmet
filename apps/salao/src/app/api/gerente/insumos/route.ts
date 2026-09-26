import { lerJson, rota } from "@/lib/api";
import { exigirSessao } from "@/lib/auth/atual";
import {
  criarInsumo,
  criarInsumoSchema,
  listarInsumos,
} from "@/lib/dominio/insumos";

export const GET = rota(async () => {
  const { funcionario } = await exigirSessao(["gerente"]);
  return Response.json(await listarInsumos(funcionario.restauranteId));
});

export const POST = rota(async (request) => {
  const { funcionario } = await exigirSessao(["gerente"]);
  const dados = await lerJson(request, criarInsumoSchema);
  return Response.json(await criarInsumo(funcionario.restauranteId, dados), {
    status: 201,
  });
});
