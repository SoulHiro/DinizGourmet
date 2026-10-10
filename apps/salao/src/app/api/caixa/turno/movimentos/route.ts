import { lerJson, rota } from "@/lib/api";
import { exigirSessao } from "@/lib/auth/atual";
import { movimentoSchema, registrarMovimento } from "@/lib/dominio/turno-caixa";

export const POST = rota(async (request) => {
  const sessao = await exigirSessao(["caixa", "gerente"]);
  const dados = await lerJson(request, movimentoSchema);
  return Response.json(await registrarMovimento(sessao, dados), {
    status: 201,
  });
});
