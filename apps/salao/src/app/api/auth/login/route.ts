import { cookies } from "next/headers";
import { z } from "zod";

import { lerJson, rota } from "@/lib/api";
import { COOKIE_SESSAO } from "@/lib/auth/sessao";
import { entrarComPin } from "@/lib/dominio/login";
import { env } from "@/lib/env";

const loginSchema = z.object({
  funcionarioId: z.uuid(),
  pin: z.string().max(8),
});

export const POST = rota(async (request) => {
  const { funcionarioId, pin } = await lerJson(request, loginSchema);
  const resultado = await entrarComPin(
    funcionarioId,
    pin,
    request.headers.get("user-agent"),
  );

  (await cookies()).set(COOKIE_SESSAO, resultado.token, {
    httpOnly: true,
    sameSite: "lax",
    secure: env().COOKIE_SECURE,
    path: "/",
    expires: resultado.expiraEm,
  });

  return Response.json({ funcionario: resultado.funcionario });
});
