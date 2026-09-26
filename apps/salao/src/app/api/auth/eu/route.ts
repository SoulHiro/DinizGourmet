import { rota } from "@/lib/api";
import { exigirSessao } from "@/lib/auth/atual";

export const GET = rota(async () => {
  const { funcionario } = await exigirSessao();
  return Response.json({ funcionario });
});
