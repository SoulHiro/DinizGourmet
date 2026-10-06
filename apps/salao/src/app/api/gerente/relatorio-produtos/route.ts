import { rota } from "@/lib/api";
import { exigirSessao } from "@/lib/auth/atual";
import { relatorioProdutos } from "@/lib/dominio/relatorio-produtos";

const PERIODOS = [1, 7, 30, 90];

// ?dias=1 (hoje), 7, 30 ou 90.
export const GET = rota(async (request) => {
  const { funcionario } = await exigirSessao(["gerente"]);
  const dias = Number(new URL(request.url).searchParams.get("dias"));
  return Response.json(
    await relatorioProdutos(
      funcionario.restauranteId,
      PERIODOS.includes(dias) ? dias : 7,
    ),
  );
});
