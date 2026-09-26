import { lerJson, rota } from "@/lib/api";
import { exigirSessao } from "@/lib/auth/atual";
import {
  imprimirTesteLayout,
  testeLayoutSchema,
} from "@/lib/dominio/layout-impressao";

export const POST = rota(async (request) => {
  const { funcionario } = await exigirSessao(["gerente"]);
  const dados = await lerJson(request, testeLayoutSchema);
  await imprimirTesteLayout(funcionario.restauranteId, dados);
  return Response.json({ ok: true });
});
