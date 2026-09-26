// Empacota server.ts (e o código de src/ que ele usa) em dist/server.mjs.
// O server.ts não passa pelo compilador do Next; as dependências de
// node_modules ficam de fora do bundle e são carregadas normalmente.
import { writeFile } from "node:fs/promises";
import { build } from "esbuild";

await build({
  entryPoints: ["server.ts"],
  outfile: "dist/server.mjs",
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node24",
  packages: "external",
  sourcemap: true,
  tsconfig: "tsconfig.json",
  logLevel: "info",
});

// Ponto de entrada do serviço do Windows. Define NODE_ENV antes de carregar
// qualquer coisa (React/Next escolhem o build de produção na importação),
// sem depender de variável de ambiente configurada no shell.
await writeFile(
  "dist/iniciar.mjs",
  `process.env.NODE_ENV = "production";\nawait import("./server.mjs");\n`,
);
