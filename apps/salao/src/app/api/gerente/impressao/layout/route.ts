import { lerJson, rota } from "@/lib/api";
import { exigirSessao } from "@/lib/auth/atual";
import {
  carregarLayouts,
  salvarLayout,
  salvarLayoutSchema,
} from "@/lib/dominio/layout-impressao";

export const GET = rota(async () => {
  const { funcionario } = await exigirSessao(["gerente"]);
  return Response.json(await carregarLayouts(funcionario.restauranteId));
});

export const PUT = rota(async (request) => {
  const { funcionario } = await exigirSessao(["gerente"]);
  const dados = await lerJson(request, salvarLayoutSchema);
  return Response.json(await salvarLayout(funcionario.restauranteId, dados));
});
