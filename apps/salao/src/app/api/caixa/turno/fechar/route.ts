import { lerJson, rota } from "@/lib/api";
import { exigirSessao } from "@/lib/auth/atual";
import { fecharTurno, fecharTurnoSchema } from "@/lib/dominio/turno-caixa";

export const POST = rota(async (request) => {
  const sessao = await exigirSessao(["caixa", "gerente"]);
  const dados = await lerJson(request, fecharTurnoSchema);
  return Response.json(await fecharTurno(sessao, dados));
});
