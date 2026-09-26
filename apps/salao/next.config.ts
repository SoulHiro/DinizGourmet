import { networkInterfaces } from "node:os";
import type { NextConfig } from "next";

// Em desenvolvimento o Next bloqueia recursos de dev (incluindo o WebSocket de
// HMR, sem o qual a página nem hidrata) vindos de outra origem. Liberamos o
// próprio computador e os IPs dele na rede local, para abrir pelo celular
// sem configurar nada. Não tem efeito em produção.
const ipsDaMaquina = Object.values(networkInterfaces())
  .flat()
  .filter((i) => i && i.family === "IPv4")
  .map((i) => i?.address as string);

const nextConfig: NextConfig = {
  allowedDevOrigins: [
    "localhost",
    "127.0.0.1",
    ...ipsDaMaquina,
    ...(process.env.ALLOWED_DEV_ORIGINS ?? "")
      .split(",")
      .map((origem) => origem.trim())
      .filter(Boolean),
  ],
  serverExternalPackages: ["pg", "bcryptjs", "sharp"],
  // Com proxy.ts o Next guarda o corpo da requisição em memória e corta em
  // 10 MB: vídeos do cardápio (até 40 MB) falhavam. O upload só aceita
  // gerente logado e o próprio código limita foto (15 MB) e vídeo (40 MB).
  experimental: { proxyClientMaxBodySize: "50mb" },
};

export default nextConfig;
