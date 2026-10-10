"use client";

import { useEffect } from "react";

// Registra o service worker (modo offline e notificações). Só em produção e
// em contexto seguro (https ou o próprio PC): em http na rede o navegador
// não permite, e o app segue funcionando sem ele.
export const RegistrarServiceWorker = () => {
  useEffect(() => {
    if (
      process.env.NODE_ENV !== "production" ||
      !("serviceWorker" in navigator) ||
      !window.isSecureContext
    )
      return;
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);
  return null;
};
