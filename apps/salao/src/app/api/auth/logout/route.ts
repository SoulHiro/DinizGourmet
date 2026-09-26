import { cookies } from "next/headers";

import { rota } from "@/lib/api";
import { COOKIE_SESSAO, revogarToken } from "@/lib/auth/sessao";

export const POST = rota(async () => {
  const store = await cookies();
  const token = store.get(COOKIE_SESSAO)?.value;
  if (token) await revogarToken(token);
  store.delete(COOKIE_SESSAO);
  return Response.json({ ok: true });
});
