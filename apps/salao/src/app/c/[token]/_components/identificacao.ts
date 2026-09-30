"use client";

import { useEffect, useState } from "react";

// Qual cartão é deste cliente, lembrado no celular dele por mesa. Vem do QR
// do cartão (?cartao=token, via /c/k/<token>) ou do número que ele digitou
// quando a mesa tem mais de uma comanda.
export type Identificacao = { cartao?: string; numero?: number };

const chave = (tokenMesa: string) => `cartao:${tokenMesa}`;

const ler = (tokenMesa: string): Identificacao => {
  try {
    return JSON.parse(localStorage.getItem(chave(tokenMesa)) ?? "{}");
  } catch {
    return {};
  }
};

export const useIdentificacao = (tokenMesa: string) => {
  const [ident, setIdent] = useState<Identificacao>({});

  useEffect(() => {
    const url = new URL(window.location.href);
    const doQr = url.searchParams.get("cartao");
    if (doQr) {
      // Chegou pelo QR do cartão: guarda e limpa a URL.
      const novo = { cartao: doQr };
      try {
        localStorage.setItem(chave(tokenMesa), JSON.stringify(novo));
      } catch {}
      url.searchParams.delete("cartao");
      window.history.replaceState(null, "", url);
      setIdent(novo);
    } else {
      setIdent(ler(tokenMesa));
    }
  }, [tokenMesa]);

  const definir = (novo: Identificacao) => {
    try {
      localStorage.setItem(chave(tokenMesa), JSON.stringify(novo));
    } catch {}
    setIdent(novo);
  };

  // Parâmetros para as rotas públicas (?cartao= / ?numero=).
  const query = new URLSearchParams(
    Object.entries(ident)
      .filter(([, v]) => v !== undefined && v !== "")
      .map(([k, v]) => [k, String(v)]),
  ).toString();

  return { ident, definir, esquecer: () => definir({}), query };
};
