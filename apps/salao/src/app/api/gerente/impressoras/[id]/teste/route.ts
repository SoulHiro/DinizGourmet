import { rota } from "@/lib/api";
import { exigirSessao } from "@/lib/auth/atual";
import { imprimirTeste } from "@/lib/dominio/gerencia";

type Contexto = { params: Promise<{ id: string }> };

export const POST = rota<Contexto>(async (_request, { params }) => {
  const { funcionario } = await exigirSessao(["gerente"]);
  const { id } = await params;
  await imprimirTeste(funcionario.restauranteId, id);
  return Response.json({ ok: true });
});
