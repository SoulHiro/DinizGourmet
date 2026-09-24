import { type NextRequest, NextResponse } from "next/server";

// Checagem OTIMISTA: só confere se o cookie existe, para redirecionar rápido.
// A validação de verdade (token no banco, papel) acontece em exigirSessao(),
// dentro de cada Route Handler e página. O proxy não acessa o banco.
const COOKIE_SESSAO = "salao_sessao";

const ROTAS_API_PUBLICAS = ["/api/auth/login", "/api/auth/funcionarios"];
const ROTAS_PUBLICAS = ["/garcom/login", "/manifest.webmanifest"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const temCookie = request.cookies.has(COOKIE_SESSAO);

  if (pathname === "/") {
    return NextResponse.redirect(new URL("/garcom", request.url));
  }

  if (pathname.startsWith("/api")) {
    if (ROTAS_API_PUBLICAS.includes(pathname) || temCookie) {
      return NextResponse.next();
    }
    return NextResponse.json(
      { codigo: "nao_autenticado", mensagem: "Faça login novamente." },
      { status: 401 },
    );
  }

  if (ROTAS_PUBLICAS.includes(pathname) || pathname.startsWith("/icons/")) {
    return NextResponse.next();
  }

  if (!temCookie) {
    return NextResponse.redirect(new URL("/garcom/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|icons/).*)",
  ],
};
