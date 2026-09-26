import path from "node:path";
import { config } from "dotenv";
import { defineConfig } from "vitest/config";

const { parsed = {} } = config({ quiet: true });
const urlTeste = process.env.DATABASE_URL_TEST ?? parsed.DATABASE_URL_TEST;
if (!urlTeste) throw new Error("Defina DATABASE_URL_TEST (veja .env.example).");

export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname, "src") },
  },
  test: {
    environment: "node",
    setupFiles: ["./tests/setup-arquivo.ts"],
    // Os arquivos compartilham o mesmo banco de teste: um de cada vez.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
    env: {
      NODE_ENV: "test",
      DATABASE_URL: urlTeste,
      IMPRESSAO_DRIVER: "arquivo",
    },
  },
});
