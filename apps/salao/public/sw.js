// Service worker do app do salão. Só guarda o "esqueleto" das telas para o
// app abrir mesmo com o Wi-Fi oscilando; dados (/api) sempre vêm do servidor.
const CACHE = "xis-diniz-v1";

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (evento) => {
  evento.waitUntil(
    (async () => {
      for (const nome of await caches.keys()) {
        if (nome !== CACHE) await caches.delete(nome);
      }
      await self.clients.claim();
    })(),
  );
});

const paginaOffline = () =>
  new Response(
    `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Sem conexão</title></head>
<body style="margin:0;min-height:100dvh;display:flex;align-items:center;justify-content:center;background:#17110c;color:#f3eadc;font-family:system-ui,sans-serif;text-align:center;padding:24px">
<div><p style="font-size:20px;font-weight:700;margin:0 0 8px">Sem conexão com o sistema</p>
<p style="opacity:.75;margin:0 0 20px">Confira o Wi-Fi do restaurante. A tela tenta de novo sozinha.</p>
<button onclick="location.reload()" style="font-size:16px;padding:12px 20px;border-radius:12px;border:0;background:#d9591f;color:#fff">Tentar de novo</button></div>
<script>setTimeout(()=>location.reload(),8000)</script></body></html>`,
    { headers: { "content-type": "text/html; charset=utf-8" } },
  );

self.addEventListener("fetch", (evento) => {
  const { request } = evento;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/socket.io"))
    return;

  // Arquivos do build têm nome com hash: nunca mudam, podem vir do cache.
  if (url.pathname.startsWith("/_next/static/")) {
    evento.respondWith(
      caches.match(request).then(
        (salvo) =>
          salvo ||
          fetch(request).then((resposta) => {
            const copia = resposta.clone();
            caches.open(CACHE).then((c) => c.put(request, copia));
            return resposta;
          }),
      ),
    );
    return;
  }

  // Telas: sempre tenta o servidor; sem rede, mostra a última versão salva.
  if (request.mode === "navigate") {
    evento.respondWith(
      fetch(request)
        .then((resposta) => {
          if (resposta.ok) {
            const copia = resposta.clone();
            caches.open(CACHE).then((c) => c.put(request, copia));
          }
          return resposta;
        })
        .catch(
          async () =>
            (await caches.match(request)) ||
            (await caches.match("/garcom")) ||
            paginaOffline(),
        ),
    );
  }
});

// Tocar na notificação de chamado abre (ou traz para a frente) o app.
self.addEventListener("notificationclick", (evento) => {
  evento.notification.close();
  evento.waitUntil(
    (async () => {
      const janelas = await self.clients.matchAll({ type: "window" });
      const aberta = janelas.find((j) => "focus" in j);
      if (aberta) return aberta.focus();
      return self.clients.openWindow("/garcom");
    })(),
  );
});
