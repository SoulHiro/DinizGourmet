// Completa descrição/ingredientes/destaque dos produtos de exemplo num banco
// que já existe. Só preenche o que está vazio: nunca sobrescreve.
import { and, eq, isNull } from "drizzle-orm";

import { db, pool, schema } from "@/db";
import { CARDAPIO_EXEMPLO } from "@/db/cardapio-exemplo";

const main = async () => {
  let atualizados = 0;
  for (const [nome, dados] of Object.entries(CARDAPIO_EXEMPLO)) {
    const linhas = await db()
      .update(schema.produtos)
      .set({
        descricao: dados.descricao,
        ingredientes: dados.ingredientes,
        destaque: dados.destaque ?? false,
      })
      .where(
        and(eq(schema.produtos.nome, nome), isNull(schema.produtos.descricao)),
      )
      .returning({ id: schema.produtos.id });
    atualizados += linhas.length;
  }
  console.log(
    `${atualizados} produto(s) completado(s) com o texto de exemplo.`,
  );
  await pool().end();
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
