import { rota } from "@/lib/api";
import { exigirSessao } from "@/lib/auth/atual";
import { impressorasDoSistema } from "@/lib/dominio/gerencia";

export const GET = rota(async () => {
  await exigirSessao(["gerente"]);
  return Response.json(await impressorasDoSistema());
});
