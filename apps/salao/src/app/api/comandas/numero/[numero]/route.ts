import { z } from "zod";

import { rota } from "@/lib/api";
import { exigirSessao } from "@/lib/auth/atual";
import { comandaPorNumero } from "@/lib/dominio/mesas";

type Contexto = { params: Promise<{ numero: string }> };

// Número digitado ou lido no código de barras do cartão.
export const GET = rota<Contexto>(async (_request, { params }) => {
  const { funcionario } = await exigirSessao();
  const numero = z.coerce
    .number()
    .int()
    .min(1)
    .max(9999)
    .parse((await params).numero);
  return Response.json(
    await comandaPorNumero(funcionario.restauranteId, numero),
  );
});
