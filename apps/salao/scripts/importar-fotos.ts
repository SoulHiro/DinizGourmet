// Importa fotos do cardápio de uma pasta: "Xis Bacon.jpeg" vira a foto do
// produto "Xis Bacon" (sem diferenciar maiúsculas e acentos). Substitui a
// foto atual. Uso: pnpm fotos:importar "C:\caminho\da\pasta"
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { eq } from "drizzle-orm";

import { db, pool, schema } from "@/db";
import { salvarFoto } from "@/lib/dominio/midia";
import { normalizarBusca } from "@/lib/texto";

const TIPOS: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

const main = async () => {
  const pasta = process.argv[2];
  if (!pasta)
    throw new Error('Informe a pasta: pnpm fotos:importar "C:\\pasta"');

  const produtos = await db()
    .select({ id: schema.produtos.id, nome: schema.produtos.nome })
    .from(schema.produtos);
  const porNome = new Map(produtos.map((p) => [normalizarBusca(p.nome), p]));

  for (const arquivo of await readdir(pasta)) {
    const extensao = path.extname(arquivo).toLowerCase();
    const tipo = TIPOS[extensao];
    if (!tipo) continue;
    const produto = porNome.get(
      normalizarBusca(path.basename(arquivo, path.extname(arquivo))),
    );
    if (!produto) {
      console.log(`- ${arquivo}: nenhum produto com esse nome, ignorado`);
      continue;
    }
    const conteudo = await readFile(path.join(pasta, arquivo));
    const { url } = await salvarFoto(
      new File([conteudo], arquivo, { type: tipo }),
    );
    await db()
      .update(schema.produtos)
      .set({ fotoUrl: url })
      .where(eq(schema.produtos.id, produto.id));
    console.log(`✓ ${produto.nome} ← ${arquivo}`);
  }
  await pool().end();
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
