// SÓ DESENVOLVIMENTO: apaga tudo e recria (migrations + seed).
// Recusa rodar contra qualquer banco que não seja localhost.
import pg from "pg";

import { migrar } from "@/db/migrate";
import { semear } from "@/db/seed";
import { env } from "@/lib/env";

export const resetarBanco = async (url: string, { seed = true } = {}) => {
  const host = new URL(url).hostname;
  if (
    !["localhost", "127.0.0.1"].includes(host) ||
    env().NODE_ENV === "production"
  ) {
    throw new Error(`db-reset recusado para ${host}`);
  }
  const pool = new pg.Pool({ connectionString: url, max: 1 });
  await pool.query(
    "drop schema if exists public cascade; drop schema if exists drizzle cascade; create schema public;",
  );
  await pool.end();
  await migrar(url);
  if (seed) await semear(url);
};

if (process.argv[1]?.includes("db-reset")) {
  resetarBanco(env().DATABASE_URL)
    .then(() => console.log("Banco de dev recriado."))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
