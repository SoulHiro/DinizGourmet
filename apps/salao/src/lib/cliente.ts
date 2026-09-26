// Chamadas HTTP do navegador para as rotas da API.
export class ErroApi extends Error {
  constructor(
    readonly status: number,
    readonly codigo: string,
    mensagem: string,
    readonly detalhes?: unknown,
  ) {
    super(mensagem);
  }
}

export const api = async <T>(
  caminho: string,
  init?: RequestInit & { json?: unknown },
): Promise<T> => {
  const { json, headers, ...resto } = init ?? {};
  const resposta = await fetch(caminho, {
    ...resto,
    headers: {
      ...(json !== undefined ? { "content-type": "application/json" } : {}),
      ...headers,
    },
    body: json !== undefined ? JSON.stringify(json) : resto.body,
    credentials: "same-origin",
  });

  const corpo = await resposta.json().catch(() => null);
  if (!resposta.ok) {
    if (
      resposta.status === 401 &&
      typeof window !== "undefined" &&
      !caminho.startsWith("/api/auth/login")
    ) {
      window.location.href = "/garcom/login";
    }
    throw new ErroApi(
      resposta.status,
      corpo?.codigo ?? "erro",
      corpo?.mensagem ?? "Não foi possível completar a ação.",
      corpo?.detalhes,
    );
  }
  return corpo as T;
};
