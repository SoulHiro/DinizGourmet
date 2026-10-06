import { type NextRequest, NextResponse } from "next/server";

import { ADMIN_SESSION_COOKIE, adminSessionToken } from "@/lib/admin-auth";

// Só o admin precisa de guarda. A home (link-in-bio) e os eventos são
// públicos e decidem sozinhos o que mostrar (próximo evento, calendário,
// página do evento), sem nenhum slug fixo aqui.
export const middleware = async (request: NextRequest) => {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/admin") && pathname !== "/admin/login") {
    const session = request.cookies.get(ADMIN_SESSION_COOKIE)?.value;

    if (session !== (await adminSessionToken())) {
      return NextResponse.redirect(new URL("/admin/login", request.url));
    }
  }

  return NextResponse.next();
};

export const config = {
  matcher: ["/((?!_next|favicon.ico).*)"],
};
