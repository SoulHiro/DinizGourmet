import { rota } from "@/lib/api";
import { exigirSessao } from "@/lib/auth/atual";
import { vitrineDoRestaurante } from "@/lib/dominio/cardapio-publico";

// Cardápio exatamente como o cliente vê pelo QR, sem precisar de mesa.
export const GET = rota(async () => {
  const { funcionario } = await exigirSessao(["gerente"]);
  return Response.json(await vitrineDoRestaurante(funcionario.restauranteId));
});
