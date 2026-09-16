import { type NextRequest, NextResponse } from "next/server";

import { ADMIN_SESSION_COOKIE, adminSessionToken } from "@/lib/admin-auth";

export const middleware = async (request: NextRequest) => {
  const { pathname } = request.nextUrl;

  if (pathname === "/admin/login") {
    return NextResponse.next();
  }

  const session = request.cookies.get(ADMIN_SESSION_COOKIE)?.value;

  if (session !== (await adminSessionToken())) {
    const loginUrl = new URL("/admin/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
};

export const config = {
  matcher: ["/admin/:path*"],
};
