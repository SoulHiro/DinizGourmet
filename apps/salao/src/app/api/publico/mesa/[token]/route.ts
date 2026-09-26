import { z } from "zod";

import { lerJson, rota } from "@/lib/api";
import { chamarPeloQr, statusPublico } from "@/lib/dominio/chamados";

// Rota pública do QR da mesa: só funciona com o token secreto da mesa.
type Contexto = { params: Promise<{ token: string }> };

const tokenValido = z.string().regex(/^[a-f0-9]{32}$/);

export const GET = rota<Contexto>(async (_request, { params }) => {
  const token = tokenValido.parse((await params).token);
  return Response.json(await statusPublico(token));
});

export const POST = rota<Contexto>(async (request, { params }) => {
  const token = tokenValido.parse((await params).token);
  const corpo = await lerJson(
    request,
    z.object({
      tipo: z.enum(["garcom", "conta"]),
      taxaServico: z.boolean().optional(),
      gorjetaCentavos: z.number().int().min(0).max(100_000).optional(),
    }),
  );
  return Response.json(
    await chamarPeloQr(token, corpo.tipo, {
      taxaServico: corpo.taxaServico ?? true,
      gorjetaCentavos: corpo.gorjetaCentavos ?? 0,
    }),
    { status: 201 },
  );
});
