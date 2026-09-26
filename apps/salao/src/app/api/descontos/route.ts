import { rota } from "@/lib/api";
import { exigirSessao } from "@/lib/auth/atual";
import { listarDescontos } from "@/lib/dominio/insumos";

// Descontos ativos, para o garçom escolher ao receber o pagamento.
export const GET = rota(async () => {
  const { funcionario } = await exigirSessao();
  return Response.json(await listarDescontos(funcionario.restauranteId, true));
});
