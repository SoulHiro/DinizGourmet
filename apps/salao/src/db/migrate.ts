import path from "node:path";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";

import { env } from "@/lib/env";

const PASTA_MIGRATIONS = path.resolve(import.meta.dirname, "../../drizzle");

export const migrar = async (connectionString: string) => {
  const pool = new pg.Pool({ connectionString, max: 1 });
  try {
    await migrate(drizzle(pool), { migrationsFolder: PASTA_MIGRATIONS });
  } finally {
    await pool.end();
  }
};

if (process.argv[1] && path.resolve(process.argv[1]) === import.meta.filename) {
  migrar(env().DATABASE_URL)
    .then(() => console.log("Migrations aplicadas."))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
