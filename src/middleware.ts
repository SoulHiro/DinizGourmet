import { type NextRequest, NextResponse } from "next/server";

import { ADMIN_SESSION_COOKIE, adminSessionToken } from "@/lib/admin-auth";

const ACTIVE_EVENT_SLUG = "inauguracao-vilson-luiz";

export const middleware = async (request: NextRequest) => {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/eventos")) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/admin")) {
    if (pathname === "/admin/login") {
      return NextResponse.next();
    }

    const session = request.cookies.get(ADMIN_SESSION_COOKIE)?.value;

    if (session !== (await adminSessionToken())) {
      return NextResponse.redirect(new URL("/admin/login", request.url));
    }

    return NextResponse.next();
  }

  return NextResponse.redirect(
    new URL(`/eventos/${ACTIVE_EVENT_SLUG}`, request.url),
  );
};

export const config = {
  matcher: ["/((?!_next|favicon.ico).*)"],
};
