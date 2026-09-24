// Casca fina de infraestrutura: sobe HTTP(S), Next.js, Socket.io e os
// workers de impressão no mesmo processo. Nenhuma regra de negócio aqui:
// ela vive nos Route Handlers (src/app/api) e em src/lib/dominio.
import { readFileSync } from "node:fs";
import { createServer as createHttpServer } from "node:http";
import { createServer as createHttpsServer } from "node:https";
import path from "node:path";
import { parse as parseCookie } from "cookie";
import express from "express";
import { rateLimit } from "express-rate-limit";
import next from "next";
import { Server as SocketServer } from "socket.io";

import { pool } from "@/db";
import { COOKIE_SESSAO, validarToken } from "@/lib/auth/sessao";
import { env } from "@/lib/env";
import { iniciarImpressao } from "@/lib/impressao/worker";
import { iniciarMonitoramento } from "@/lib/monitoramento";
import { runtime } from "@/lib/runtime";

const config = env();
const dev = config.NODE_ENV !== "production";
// Em produção este arquivo roda de dist/, e o projeto Next está um nível acima.
const dir = path.resolve(
  import.meta.dirname,
  path.basename(import.meta.dirname) === "dist" ? ".." : ".",
);

const esperarBanco = async () => {
  // No boot do Windows o serviço do Postgres pode subir depois deste.
  for (let tentativa = 1; ; tentativa++) {
    try {
      await pool().query("select 1");
      return;
    } catch (error) {
      const espera = Math.min(tentativa * 1000, 10_000);
      console.warn(
        `[boot] banco indisponível (tentativa ${tentativa}), nova tentativa em ${espera}ms:`,
        (error as Error).message,
      );
      await new Promise((resolve) => setTimeout(resolve, espera));
    }
  }
};

const main = async () => {
  iniciarMonitoramento();
  await esperarBanco();

  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", false);

  const httpServer =
    config.HTTPS_KEY && config.HTTPS_CERT
      ? createHttpsServer(
          {
            key: readFileSync(config.HTTPS_KEY),
            cert: readFileSync(config.HTTPS_CERT),
          },
          app,
        )
      : createHttpServer(app);

  const nextApp = next({
    dev,
    dir,
    hostname: config.HOST,
    port: config.PORT,
    httpServer,
  });
  const handle = nextApp.getRequestHandler();
  await nextApp.prepare();

  const io = new SocketServer(httpServer, {
    serveClient: false,
    // Sem isso o engine.io derruba o websocket de HMR do Next em dev.
    destroyUpgrade: false,
  });

  io.use(async (socket, proximo) => {
    try {
      const cookies = parseCookie(socket.handshake.headers.cookie ?? "");
      const sessao = await validarToken(cookies[COOKIE_SESSAO]);
      if (!sessao) return proximo(new Error("nao_autenticado"));
      socket.data.sessao = sessao;
      await socket.join(`r:${sessao.funcionario.restauranteId}`);
      proximo();
    } catch (error) {
      proximo(error as Error);
    }
  });

  runtime().emitir = (restauranteId, escopos) => {
    io.to(`r:${restauranteId}`).emit("sync", { escopos });
  };

  const impressao = iniciarImpressao();

  // Um bug de cliente em loop não pode derrubar o servidor do salão.
  const limiteLogin = rateLimit({
    windowMs: 60_000,
    limit: 20,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: {
      codigo: "muitas_tentativas",
      mensagem: "Muitas tentativas. Aguarde um minuto.",
    },
  });
  const limiteEscrita = rateLimit({
    windowMs: 60_000,
    limit: config.RATE_LIMIT_ESCRITA_POR_MIN,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    skip: (req) => req.method === "GET" || req.method === "HEAD",
    message: {
      codigo: "muitas_requisicoes",
      mensagem: "Muitas requisições. Aguarde um instante.",
    },
  });
  app.use("/api/auth/login", limiteLogin);
  app.use("/api", limiteEscrita);

  app.get("/health", async (_req, res) => {
    let banco = false;
    try {
      await pool().query("select 1");
      banco = true;
    } catch {}
    const impressoras = await impressao.status().catch(() => []);
    res.status(banco ? 200 : 503).json({
      ok: banco,
      banco,
      impressoras,
      uptime: Math.round(process.uptime()),
    });
  });

  app.all("/{*caminho}", (req, res) => handle(req, res));

  httpServer.listen(config.PORT, config.HOST, () => {
    const protocolo = config.HTTPS_KEY ? "https" : "http";
    console.log(
      `[salao] ${protocolo}://${config.HOST}:${config.PORT} (${dev ? "dev" : "produção"})`,
    );
  });

  const desligar = async (sinal: string) => {
    console.log(`[salao] ${sinal} recebido, desligando...`);
    await impressao.parar();
    io.close();
    httpServer.close();
    await pool().end();
    process.exit(0);
  };
  process.on("SIGINT", () => void desligar("SIGINT"));
  process.on("SIGTERM", () => void desligar("SIGTERM"));
};

main().catch((error) => {
  console.error("[salao] falha fatal no boot:", error);
  process.exit(1);
});
