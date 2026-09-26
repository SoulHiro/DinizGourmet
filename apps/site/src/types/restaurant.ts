import type { menuCategories, products } from "@/db/schema";
import type { InferSelectModel } from "drizzle-orm";

export type MenuCategory = InferSelectModel<typeof menuCategories> & {
  products: InferSelectModel<typeof products>[];
};

export type Product = InferSelectModel<typeof products>;
