import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Celulares dos garçons acessando o servidor de dev pela rede local.
  allowedDevOrigins: (process.env.ALLOWED_DEV_ORIGINS ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
  serverExternalPackages: ["pg", "bcryptjs"],
};

export default nextConfig;
