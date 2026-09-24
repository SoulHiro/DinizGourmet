import { beforeAll } from "vitest";

import { resetarBanco } from "../scripts/db-reset";

// Cada arquivo de teste começa com o banco recém-semeado.
beforeAll(async () => {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL não definida");
  await resetarBanco(url);
});
