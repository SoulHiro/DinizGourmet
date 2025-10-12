import { drizzle } from "drizzle-orm/node-postgres";
import "dotenv/config";
import * as schema from "./schema";
import { products, branches, menuCategories } from "./schema";

import pg from "pg";
const { Pool } = pg;

if (!process.env.DATABASE_URL)
  throw new Error("DATABASE_URL não está definida");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL!, // Neon connection string
});

const db = drizzle(pool, { schema });

async function main() {
  console.log("🌱 Iniciando seed...");

  // 1️⃣ Criar branch
  const [branch] = await db
    .insert(branches)
    .values({
      id: crypto.randomUUID(),
      name: "Unidade Central",
      address: "Rua Principal, 123 - Centro",
      phone: "(11) 99999-9999",
      email: "contato@pizzaria.com",
    })
    .returning();

  // 2️⃣ Criar categorias
  const categories = await db
    .insert(menuCategories)
    .values([
      { name: "Pizzas", branchId: branch.id },
      { name: "Hambúrgueres", branchId: branch.id },
      { name: "Xis", branchId: branch.id },
    ])
    .returning();

  const pizzasCategory = categories.find((c) => c.name === "Pizzas")!;
  const burgersCategory = categories.find((c) => c.name === "Hambúrgueres")!;
  const xisCategory = categories.find((c) => c.name === "Xis")!;

  // 3️⃣ Inserir produtos
  await db.insert(products).values([
    // 🧀 PIZZAS
    {
      name: "Brócolis",
      description: "Brócolis, bacon e requeijão",
      price: 6500,
      imageUrl: "/images/pizza-default.png",
      ingredients: ["Brócolis", "Bacon", "Requeijão"],
      menuCategoryId: pizzasCategory.id,
      branchId: branch.id,
    },
    {
      name: "Rúcula",
      description: "Rúcula e tomate seco",
      price: 6000,
      imageUrl: "/images/pizza-default.png",
      ingredients: ["Rúcula", "Tomate seco"],
      menuCategoryId: pizzasCategory.id,
      branchId: branch.id,
    },
    {
      name: "Atum",
      description: "Mussarela, atum e cebola",
      price: 6500,
      imageUrl: "/images/pizza-default.png",
      ingredients: ["Mussarela", "Atum", "Cebola"],
      menuCategoryId: pizzasCategory.id,
      branchId: branch.id,
    },
    {
      name: "Baiana",
      description: "Calabresa, ovos, cebola, pimenta e pimentão",
      price: 6500,
      imageUrl: "/images/pizza-default.png",
      ingredients: ["Calabresa", "Ovos", "Cebola", "Pimenta", "Pimentão"],
      menuCategoryId: pizzasCategory.id,
      branchId: branch.id,
    },
    {
      name: "Barcelona",
      description: "Lombinho, catupiry, provolone e bacon",
      price: 7000,
      imageUrl: "/images/pizza-default.png",
      ingredients: ["Lombinho", "Catupiry", "Provolone", "Bacon"],
      menuCategoryId: pizzasCategory.id,
      branchId: branch.id,
    },
    {
      name: "Gaúcha",
      description: "Bacon, calabresa, bife, milho, azeitona e cebola",
      price: 7000,
      imageUrl: "/images/pizza-default.png",
      ingredients: [
        "Bacon",
        "Calabresa",
        "Bife",
        "Milho",
        "Azeitona",
        "Cebola",
      ],
      menuCategoryId: pizzasCategory.id,
      branchId: branch.id,
    },
    {
      name: "Pizza Guirlanda",
      description: "Sabor à escolha + anéis de cebola + batata frita",
      price: 8500,
      imageUrl: "/images/pizza-default.png",
      ingredients: [
        "Mussarela",
        "Molho de tomate",
        "Anéis de cebola",
        "Batata frita",
      ],
      menuCategoryId: pizzasCategory.id,
      branchId: branch.id,
    },

    // 🍔 HAMBÚRGUERES
    {
      name: "Aloha Smash",
      description: "Maionese da casa, mussarela e hambúrguer artesanal",
      price: 2000,
      imageUrl: "/images/burger-default.png",
      ingredients: ["Maionese", "Mussarela", "Hambúrguer artesanal"],
      menuCategoryId: burgersCategory.id,
      branchId: branch.id,
    },
    {
      name: "Rocky Burguer",
      description:
        "Maionese da casa, cheddar, hambúrguer artesanal, alface e tomate",
      price: 2500,
      imageUrl: "/images/burger-default.png",
      ingredients: ["Maionese", "Cheddar", "Hambúrguer", "Alface", "Tomate"],
      menuCategoryId: burgersCategory.id,
      branchId: branch.id,
    },
    {
      name: "West Coast",
      description: "Barbecue, cheddar, hambúrguer artesanal, bacon e ovo",
      price: 3500,
      imageUrl: "/images/burger-default.png",
      ingredients: ["Barbecue", "Cheddar", "Hambúrguer", "Bacon", "Ovo"],
      menuCategoryId: burgersCategory.id,
      branchId: branch.id,
    },
    {
      name: "Vulcano Spice",
      description: "Maionese da casa, cheddar, calabresa, hambúrguer e picles",
      price: 3500,
      imageUrl: "/images/burger-default.png",
      ingredients: ["Maionese", "Cheddar", "Hambúrguer", "Calabresa", "Picles"],
      menuCategoryId: burgersCategory.id,
      branchId: branch.id,
    },
    {
      name: "Mentawaii",
      description:
        "Barbecue, cheddar, hambúrguer artesanal, tomate, alface e cebola caramelizada",
      price: 4000,
      imageUrl: "/images/burger-default.png",
      ingredients: [
        "Barbecue",
        "Cheddar",
        "Hambúrguer",
        "Tomate",
        "Alface",
        "Cebola caramelizada",
      ],
      menuCategoryId: burgersCategory.id,
      branchId: branch.id,
    },
    {
      name: "Crunch Waves",
      description:
        "Barbecue, cheddar, hambúrguer artesanal, onion rings e cebola roxa",
      price: 4000,
      imageUrl: "/images/burger-default.png",
      ingredients: [
        "Barbecue",
        "Cheddar",
        "Hambúrguer",
        "Onion rings",
        "Cebola roxa",
      ],
      menuCategoryId: burgersCategory.id,
      branchId: branch.id,
    },
    {
      name: "Doppio Cheddar",
      description:
        "3 cheddars, 2 hambúrgueres artesanais, cebola roxa e alface",
      price: 4500,
      imageUrl: "/images/burger-default.png",
      ingredients: ["Cheddar", "Hambúrguer duplo", "Cebola roxa", "Alface"],
      menuCategoryId: burgersCategory.id,
      branchId: branch.id,
    },
    {
      name: "Fabuloso",
      description:
        "Mostarda, mussarela empanada, bacon, hambúrguer artesanal e picles",
      price: 4500,
      imageUrl: "/images/burger-default.png",
      ingredients: [
        "Mostarda",
        "Mussarela empanada",
        "Bacon",
        "Hambúrguer",
        "Picles",
      ],
      menuCategoryId: burgersCategory.id,
      branchId: branch.id,
    },

    // 🌭 XIS
    {
      name: "Xis Kids",
      description: "Maionese, hambúrguer e ovo (opcional)",
      price: 2000,
      imageUrl: "/images/xis-default.png",
      ingredients: ["Maionese", "Hambúrguer", "Ovo"],
      menuCategoryId: xisCategory.id,
      branchId: branch.id,
    },
    {
      name: "Xis Clássico",
      description:
        "Maionese, alface, tomate, ervilha, milho, hambúrguer, ovo e queijo",
      price: 3000,
      imageUrl: "/images/xis-default.png",
      ingredients: [
        "Maionese",
        "Alface",
        "Tomate",
        "Ervilha",
        "Milho",
        "Hambúrguer",
        "Ovo",
        "Queijo",
      ],
      menuCategoryId: xisCategory.id,
      branchId: branch.id,
    },
    {
      name: "Xis Frango",
      description:
        "Maionese, alface, tomate, ervilha, milho, frango, ovo e queijo",
      price: 3500,
      imageUrl: "/images/xis-default.png",
      ingredients: [
        "Maionese",
        "Alface",
        "Tomate",
        "Ervilha",
        "Milho",
        "Frango",
        "Ovo",
        "Queijo",
      ],
      menuCategoryId: xisCategory.id,
      branchId: branch.id,
    },
    {
      name: "Xis Bacon",
      description:
        "Maionese, alface, tomate, ervilha, milho, hambúrguer, bacon, ovo e queijo",
      price: 3500,
      imageUrl: "/images/xis-default.png",
      ingredients: [
        "Maionese",
        "Alface",
        "Tomate",
        "Ervilha",
        "Milho",
        "Hambúrguer",
        "Bacon",
        "Ovo",
        "Queijo",
      ],
      menuCategoryId: xisCategory.id,
      branchId: branch.id,
    },
    {
      name: "Xis Calabresa",
      description:
        "Maionese, alface, tomate, ervilha, milho, hambúrguer, calabresa, ovo e queijo",
      price: 3500,
      imageUrl: "/images/xis-default.png",
      ingredients: [
        "Maionese",
        "Alface",
        "Tomate",
        "Ervilha",
        "Milho",
        "Hambúrguer",
        "Calabresa",
        "Ovo",
        "Queijo",
      ],
      menuCategoryId: xisCategory.id,
      branchId: branch.id,
    },
    {
      name: "Xis da Casa",
      description:
        "Maionese, alface, tomate, ervilha, milho, hambúrguer, bacon, calabresa, frango, ovo e queijo",
      price: 4500,
      imageUrl: "/images/xis-default.png",
      ingredients: [
        "Maionese",
        "Alface",
        "Tomate",
        "Ervilha",
        "Milho",
        "Hambúrguer",
        "Bacon",
        "Calabresa",
        "Frango",
        "Ovo",
        "Queijo",
      ],
      menuCategoryId: xisCategory.id,
      branchId: branch.id,
    },
  ]);

  console.log("✅ Seed concluído com sucesso!");
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  pool.end();
});
