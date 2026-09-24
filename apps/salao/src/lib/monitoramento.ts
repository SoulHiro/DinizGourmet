// Sentry (plano gratuito): só ativa com SENTRY_DSN definido. Sem internet,
// os eventos simplesmente não saem; o sistema continua funcionando.
// Carregado só pelo server.ts; o código do Next reporta via runtime().
import * as Sentry from "@sentry/node";

import { env } from "@/lib/env";
import { runtime } from "@/lib/runtime";

export const iniciarMonitoramento = () => {
  const { SENTRY_DSN, NODE_ENV } = env();

  runtime().reportarErro = (erro, contexto) => {
    console.error("[erro]", contexto ?? "", erro);
    if (SENTRY_DSN) Sentry.captureException(erro, { extra: contexto });
  };

  if (SENTRY_DSN) {
    Sentry.init({
      dsn: SENTRY_DSN,
      environment: NODE_ENV,
      tracesSampleRate: 0,
    });
    console.log("[salao] Sentry ativo");
  }

  process.on("unhandledRejection", (motivo) => {
    runtime().reportarErro?.(motivo, { origem: "unhandledRejection" });
  });
  process.on("uncaughtException", (erro) => {
    runtime().reportarErro?.(erro, { origem: "uncaughtException" });
    // Estado desconhecido: sai e deixa o serviço do Windows reiniciar limpo.
    void Sentry.flush(2000).finally(() => process.exit(1));
  });
};
