import { lerJson, rota } from "@/lib/api";
import { exigirSessao } from "@/lib/auth/atual";
import { abrirComanda, abrirComandaSchema } from "@/lib/dominio/mesas";

// Abre a comanda de um cartão numa mesa.
export const POST = rota(async (request) => {
  const sessao = await exigirSessao();
  const dados = await lerJson(request, abrirComandaSchema);
  return Response.json(await abrirComanda(sessao, dados), { status: 201 });
});
