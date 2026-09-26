import { lerJson, rota } from "@/lib/api";
import { exigirSessao } from "@/lib/auth/atual";
import {
  criarDesconto,
  criarDescontoSchema,
  listarDescontos,
} from "@/lib/dominio/insumos";

export const GET = rota(async () => {
  const { funcionario } = await exigirSessao(["gerente"]);
  return Response.json(await listarDescontos(funcionario.restauranteId));
});

export const POST = rota(async (request) => {
  const { funcionario } = await exigirSessao(["gerente"]);
  const dados = await lerJson(request, criarDescontoSchema);
  return Response.json(await criarDesconto(funcionario.restauranteId, dados), {
    status: 201,
  });
});
