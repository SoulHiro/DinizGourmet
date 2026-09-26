import { lerJson, rota } from "@/lib/api";
import { exigirSessao } from "@/lib/auth/atual";
import {
  lerTaxaServico,
  salvarTaxaServico,
  taxaServicoSchema,
} from "@/lib/dominio/gerencia";

export const GET = rota(async () => {
  const { funcionario } = await exigirSessao(["gerente"]);
  return Response.json(await lerTaxaServico(funcionario.restauranteId));
});

export const PUT = rota(async (request) => {
  const { funcionario } = await exigirSessao(["gerente"]);
  const dados = await lerJson(request, taxaServicoSchema);
  return Response.json(
    await salvarTaxaServico(funcionario.restauranteId, dados),
  );
});
