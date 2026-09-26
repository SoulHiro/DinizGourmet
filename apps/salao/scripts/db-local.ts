// Postgres embutido SÓ para desenvolvimento e testes nesta máquina.
// Produção usa o PostgreSQL nativo instalado como serviço do Windows.
import { existsSync } from "node:fs";
import path from "node:path";
import EmbeddedPostgres from "embedded-postgres";

const dataDir = path.resolve(import.meta.dirname, "..", ".pgdata");
const port = 5433;

const main = async () => {
  const pg = new EmbeddedPostgres({
    databaseDir: dataDir,
    user: "salao",
    password: "salao",
    port,
    persistent: true,
    initdbFlags: ["--encoding=UTF8", "--locale=C"],
    onLog: () => {},
  });

  const primeiraVez = !existsSync(path.join(dataDir, "PG_VERSION"));
  if (primeiraVez) {
    console.log("Inicializando cluster em", dataDir);
    await pg.initialise();
  }

  await pg.start();

  if (primeiraVez) {
    await pg.createDatabase("xisdiniz_salao");
    await pg.createDatabase("xisdiniz_salao_test");
  }

  console.log(
    `Postgres de dev rodando em localhost:${port} (Ctrl+C para parar)`,
  );

  const parar = async () => {
    await pg.stop();
    process.exit(0);
  };
  process.on("SIGINT", parar);
  process.on("SIGTERM", parar);
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
