import { rota } from "@/lib/api";
import { exigirSessao } from "@/lib/auth/atual";
import { filtroHistoricoSchema, listarHistorico } from "@/lib/dominio/caixa";

export const GET = rota(async (request) => {
  const { funcionario } = await exigirSessao(["caixa", "gerente"]);
  const params = Object.fromEntries(
    [...new URL(request.url).searchParams].filter(([, v]) => v !== ""),
  );
  const filtro = filtroHistoricoSchema.parse(params);
  return Response.json(
    await listarHistorico(funcionario.restauranteId, filtro),
  );
});
