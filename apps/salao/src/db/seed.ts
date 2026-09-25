// Dados iniciais para desenvolvimento e primeira instalação.
// O cardápio aqui é PROVISÓRIO: o real é cadastrado pelo /gerente.
import path from "node:path";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";

import { hashPin } from "@/lib/auth/pin";
import { env } from "@/lib/env";
import { normalizarBusca } from "@/lib/texto";
import { CARDAPIO_EXEMPLO } from "./cardapio-exemplo";
import * as schema from "./schema";

const {
  restaurantes,
  impressoras,
  categorias,
  produtos,
  modificadores,
  produtoModificadores,
  mesas,
  funcionarios,
} = schema;

export const semear = async (connectionString: string) => {
  const pool = new pg.Pool({ connectionString, max: 1 });
  const db = drizzle(pool, { schema });

  try {
    const existente = await db.select().from(restaurantes).limit(1);
    if (existente.length > 0) {
      console.log("Seed já aplicado, nada a fazer.");
      return existente[0];
    }

    return await db.transaction(async (tx) => {
      const [restaurante] = await tx
        .insert(restaurantes)
        .values({ nome: "Xis Diniz" })
        .returning();
      const restauranteId = restaurante.id;

      // Os nomes de driver são placeholders: trocar pelos nomes reais
      // (listados pelo spike de impressão) na tela /gerente.
      const [chapa, fritura, bar] = await tx
        .insert(impressoras)
        .values([
          {
            restauranteId,
            nome: "Chapa",
            nomeDriver: "ELGIN i9 Chapa",
            setor: "chapa",
          },
          {
            restauranteId,
            nome: "Fritura",
            nomeDriver: "ELGIN i9 Fritura",
            setor: "fritura",
          },
          {
            restauranteId,
            nome: "Bar",
            nomeDriver: "ELGIN i9 Bar",
            setor: "bar",
          },
        ])
        .returning();

      const [lanches, porcoes, bebidas, sobremesas] = await tx
        .insert(categorias)
        .values([
          {
            restauranteId,
            nome: "Lanches",
            ordem: 1,
            impressoraId: chapa.id,
            codigoInicio: 1,
            codigoFim: 19,
          },
          {
            restauranteId,
            nome: "Porções",
            ordem: 2,
            impressoraId: fritura.id,
            codigoInicio: 20,
            codigoFim: 29,
          },
          {
            restauranteId,
            nome: "Bebidas",
            ordem: 3,
            impressoraId: bar.id,
            codigoInicio: 30,
            codigoFim: 79,
          },
          {
            restauranteId,
            nome: "Sobremesas",
            ordem: 4,
            impressoraId: chapa.id,
            codigoInicio: 80,
            codigoFim: 99,
          },
        ])
        .returning();

      const cardapio: {
        categoriaId: string;
        nome: string;
        preco: number;
        estoque?: number;
      }[] = [
        {
          categoriaId: lanches.id,
          nome: "Xis Buenas - Clássico",
          preco: 3990,
        },
        {
          categoriaId: lanches.id,
          nome: "Xis Bah Tchê! - Bacon",
          preco: 4990,
        },
        {
          categoriaId: lanches.id,
          nome: "Xis Gaudério - Calabresa",
          preco: 4990,
        },
        {
          categoriaId: lanches.id,
          nome: "Xis Tri Bom - Frango",
          preco: 4490,
          estoque: 20,
        },
        {
          categoriaId: lanches.id,
          nome: "Xis Bagual - O Bruto da Casa",
          preco: 5990,
        },
        { categoriaId: porcoes.id, nome: "Batata Frita", preco: 2500 },
        { categoriaId: porcoes.id, nome: "Polenta Frita", preco: 2200 },
        { categoriaId: porcoes.id, nome: "Anéis de Cebola", preco: 2400 },
        {
          categoriaId: bebidas.id,
          nome: "Refrigerante Lata",
          preco: 700,
          estoque: 48,
        },
        { categoriaId: bebidas.id, nome: "Água sem Gás", preco: 500 },
        {
          categoriaId: bebidas.id,
          nome: "Cerveja Long Neck",
          preco: 1200,
          estoque: 48,
        },
        { categoriaId: bebidas.id, nome: "Suco Natural", preco: 1000 },
        { categoriaId: sobremesas.id, nome: "Pudim", preco: 1200 },
      ];

      // Código sequencial dentro da faixa de cada categoria.
      const inicioPorCategoria = new Map(
        [lanches, porcoes, bebidas, sobremesas].map((c) => [
          c.id,
          c.codigoInicio ?? 1,
        ]),
      );
      const proximoCodigo = (categoriaId: string) => {
        const codigo = inicioPorCategoria.get(categoriaId) ?? 1;
        inicioPorCategoria.set(categoriaId, codigo + 1);
        return codigo;
      };

      const produtosCriados = await tx
        .insert(produtos)
        .values(
          cardapio.map((item, ordem) => ({
            restauranteId,
            categoriaId: item.categoriaId,
            codigo: proximoCodigo(item.categoriaId),
            nome: item.nome,
            buscaNormalizada: normalizarBusca(item.nome),
            descricao: CARDAPIO_EXEMPLO[item.nome]?.descricao ?? null,
            ingredientes: CARDAPIO_EXEMPLO[item.nome]?.ingredientes ?? [],
            destaque: CARDAPIO_EXEMPLO[item.nome]?.destaque ?? false,
            precoCentavos: item.preco,
            controlaEstoque: item.estoque !== undefined,
            estoque: item.estoque ?? null,
            ordem,
          })),
        )
        .returning();

      const chips = await tx
        .insert(modificadores)
        .values([
          { restauranteId, nome: "Sem ervilha", tipo: "remocao" as const },
          { restauranteId, nome: "Sem milho", tipo: "remocao" as const },
          { restauranteId, nome: "Sem salada", tipo: "remocao" as const },
          { restauranteId, nome: "Sem tomate", tipo: "remocao" as const },
          { restauranteId, nome: "Sem ovo", tipo: "remocao" as const },
          { restauranteId, nome: "Mal passado", tipo: "preparo" as const },
          { restauranteId, nome: "Ao ponto", tipo: "preparo" as const },
          { restauranteId, nome: "Bem passado", tipo: "preparo" as const },
          {
            restauranteId,
            nome: "Bacon extra",
            tipo: "adicional" as const,
            precoCentavos: 500,
          },
          {
            restauranteId,
            nome: "Ovo extra",
            tipo: "adicional" as const,
            precoCentavos: 300,
          },
        ])
        .returning();

      const lanchesCriados = produtosCriados.filter(
        (p) => p.categoriaId === lanches.id,
      );
      await tx.insert(produtoModificadores).values(
        lanchesCriados.flatMap((produto) =>
          chips.map((chip, ordem) => ({
            produtoId: produto.id,
            modificadorId: chip.id,
            ordem,
          })),
        ),
      );

      await tx.insert(mesas).values(
        Array.from({ length: 20 }, (_, i) => ({
          restauranteId,
          numero: i + 1,
        })),
      );

      await tx.insert(funcionarios).values([
        {
          restauranteId,
          nome: "Gerente",
          papel: "gerente" as const,
          pinHash: await hashPin("1234"),
        },
        {
          restauranteId,
          nome: "Garçom A",
          papel: "garcom" as const,
          pinHash: await hashPin("1111"),
        },
        {
          restauranteId,
          nome: "Garçom B",
          papel: "garcom" as const,
          pinHash: await hashPin("2222"),
        },
      ]);

      if (env().NODE_ENV !== "test") {
        console.log(
          "Seed aplicado. PINs de teste: Gerente 1234, Garçom A 1111, Garçom B 2222.",
        );
      }
      return restaurante;
    });
  } finally {
    await pool.end();
  }
};

if (process.argv[1] && path.resolve(process.argv[1]) === import.meta.filename) {
  semear(env().DATABASE_URL).catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
