export const ADMIN_SESSION_COOKIE = "admin_session";

export const adminSessionToken = async () => {
  const password = process.env.ADMIN_PASSWORD ?? "";
  const data = new TextEncoder().encode(`${password}:diniz-gourmet-admin`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
};

export const isValidAdminPassword = (password: string) => {
  return password.length > 0 && password === process.env.ADMIN_PASSWORD;
};

// Para server actions e rotas do admin: o middleware já barra páginas, mas
// a ação confere de novo (não depende só do caminho da requisição).
export const exigirAdmin = async () => {
  const { cookies } = await import("next/headers");
  const sessao = (await cookies()).get(ADMIN_SESSION_COOKIE)?.value;
  if (!sessao || sessao !== (await adminSessionToken())) {
    throw new Error("Sessão do admin expirada. Entre de novo.");
  }
};
