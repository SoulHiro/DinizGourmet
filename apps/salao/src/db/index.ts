import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import pg from "pg";

import { env } from "@/lib/env";
import * as schema from "./schema";

export type Db = NodePgDatabase<typeof schema>;
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

// O server.ts (esbuild) e os Route Handlers (bundle do Next) carregam cópias
// diferentes deste módulo. Guardar o pool em globalThis garante um único pool
// por processo, com o limite de conexões respeitado de verdade.
const globalDb = globalThis as unknown as {
  __salaoPool?: pg.Pool;
  __salaoDb?: Db;
};

export const pool = (): pg.Pool => {
  globalDb.__salaoPool ??= new pg.Pool({
    connectionString: env().DATABASE_URL,
    max: 20,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
  });
  return globalDb.__salaoPool;
};

export const db = (): Db => {
  globalDb.__salaoDb ??= drizzle(pool(), { schema });
  return globalDb.__salaoDb;
};

export { schema };
