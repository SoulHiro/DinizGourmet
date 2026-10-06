import { lerJson, rota } from "@/lib/api";
import { exigirSessao } from "@/lib/auth/atual";
import {
  abrirTurno,
  abrirTurnoSchema,
  turnoAtual,
} from "@/lib/dominio/turno-caixa";

export const GET = rota(async () => {
  const { funcionario } = await exigirSessao(["caixa", "gerente"]);
  return Response.json(await turnoAtual(funcionario.restauranteId));
});

export const POST = rota(async (request) => {
  const sessao = await exigirSessao(["caixa", "gerente"]);
  const dados = await lerJson(request, abrirTurnoSchema);
  return Response.json(await abrirTurno(sessao, dados), { status: 201 });
});
