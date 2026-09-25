import { z } from "zod";

import { rota } from "@/lib/api";
import { contaPublica } from "@/lib/dominio/cardapio-publico";

type Contexto = { params: Promise<{ token: string }> };

export const GET = rota<Contexto>(async (_request, { params }) => {
  const token = z
    .string()
    .regex(/^[a-f0-9]{32}$/)
    .parse((await params).token);
  return Response.json(await contaPublica(token));
});
