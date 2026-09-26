import { rota } from "@/lib/api";
import { exigirSessao } from "@/lib/auth/atual";
import { qrDasMesas } from "@/lib/dominio/gerencia";
import { env } from "@/lib/env";

export const GET = rota(async () => {
  const { funcionario } = await exigirSessao(["gerente"]);
  return Response.json({
    publicUrl: env().PUBLIC_URL ?? null,
    mesas: await qrDasMesas(funcionario.restauranteId),
  });
});
