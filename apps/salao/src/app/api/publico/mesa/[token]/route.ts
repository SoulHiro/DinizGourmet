import { z } from "zod";

import { lerJson, rota } from "@/lib/api";
import { chamarPeloQr, statusPublico } from "@/lib/dominio/chamados";
import { identificacaoSchema } from "@/lib/dominio/cliente";

// Rota pública do QR da mesa: só funciona com o token secreto da mesa. O
// cliente se identifica pelo cartão (?cartao=token do QR do cartão ou
// ?numero= digitado) quando a mesa tem mais de uma comanda.
type Contexto = { params: Promise<{ token: string }> };

const tokenValido = z.string().regex(/^[a-f0-9]{32}$/);

const identificacaoDaUrl = (request: Request) =>
  identificacaoSchema.parse(
    Object.fromEntries(
      [...new URL(request.url).searchParams].filter(([, v]) => v !== ""),
    ),
  );

export const GET = rota<Contexto>(async (request, { params }) => {
  const token = tokenValido.parse((await params).token);
  return Response.json(await statusPublico(token, identificacaoDaUrl(request)));
});

export const POST = rota<Contexto>(async (request, { params }) => {
  const token = tokenValido.parse((await params).token);
  const corpo = await lerJson(
    request,
    identificacaoSchema.extend({
      tipo: z.enum(["garcom", "conta"]),
      taxaServico: z.boolean().optional(),
      gorjetaCentavos: z.number().int().min(0).max(100_000).optional(),
    }),
  );
  return Response.json(
    await chamarPeloQr(
      token,
      corpo.tipo,
      {
        taxaServico: corpo.taxaServico ?? true,
        gorjetaCentavos: corpo.gorjetaCentavos ?? 0,
      },
      { cartao: corpo.cartao, numero: corpo.numero },
    ),
    { status: 201 },
  );
});
