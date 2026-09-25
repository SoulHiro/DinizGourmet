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
  serverExternalPackages: ["pg", "bcryptjs"],
};

export default nextConfig;
