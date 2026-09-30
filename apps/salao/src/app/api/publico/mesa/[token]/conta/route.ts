import { z } from "zod";

import { rota } from "@/lib/api";
import { contaPublica } from "@/lib/dominio/cardapio-publico";
import { identificacaoSchema } from "@/lib/dominio/cliente";

type Contexto = { params: Promise<{ token: string }> };

export const GET = rota<Contexto>(async (request, { params }) => {
  const token = z
    .string()
    .regex(/^[a-f0-9]{32}$/)
    .parse((await params).token);
  const ident = identificacaoSchema.parse(
    Object.fromEntries(
      [...new URL(request.url).searchParams].filter(([, v]) => v !== ""),
    ),
  );
  return Response.json(await contaPublica(token, ident));
});
