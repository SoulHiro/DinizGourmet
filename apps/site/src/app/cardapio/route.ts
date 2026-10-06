import { NextResponse } from "next/server";

import { CHAVE_CARDAPIO, lerConfiguracao } from "@/lib/links-publicos";

export const dynamic = "force-dynamic";

// Endereço fixo do cardápio (/cardapio) que aponta sempre para o PDF mais
// recente enviado pelo admin. Assim o link da bio nunca precisa mudar.
export const GET = async (request: Request) => {
  const config = await lerConfiguracao(CHAVE_CARDAPIO);

  if (!config?.value) {
    return new NextResponse(
      `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Cardápio — Xis Diniz</title></head>
<body style="margin:0;min-height:100svh;display:flex;align-items:center;justify-content:center;background:#0f0b08;color:#f6eee2;font-family:system-ui,sans-serif;text-align:center;padding:24px">
<div><p style="font-size:18px;font-weight:700;margin:0 0 8px">Cardápio em atualização</p>
<p style="opacity:.7;margin:0 0 24px">Logo ele aparece por aqui. Enquanto isso, fale com a gente no WhatsApp.</p>
<a href="/" style="color:#f2a72e">Voltar</a></div></body></html>`,
      { status: 404, headers: { "content-type": "text/html; charset=utf-8" } },
    );
  }

  return NextResponse.redirect(new URL(config.value, request.url), 307);
};
