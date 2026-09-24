"use client";
import { ClockIcon } from "lucide-react";
import Image from "next/image";
import type { InferSelectModel } from "drizzle-orm";
import { menuCategories, products } from "@/db/schema";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { useContext, useState } from "react";
import Products from "./products";
import { CartContext } from "../contexts/cart";
import { formatBRL } from "@/app/helpers/format-currency";
import CartSheet from "./cart-sheet";

type MenuCategory = InferSelectModel<typeof menuCategories> & {
  products: InferSelectModel<typeof products>[];
};

interface RestaurantCategoriesProps {
  categories: MenuCategory[];
}

const RestaurantCategories = ({
  categories: _categories,
}: RestaurantCategoriesProps) => {
  const [selectedCategory, setSelectedCategory] = useState<MenuCategory>(
    _categories[0],
  );
  const { products, total, totalQuantity, toggleCart } =
    useContext(CartContext);
  const handleCategoryClick = (category: MenuCategory) => {
    setSelectedCategory(category);
  };
  const setCategoryButtonVariant = (category: MenuCategory) => {
    return selectedCategory.id === category.id ? "default" : "secondary";
  };
  return (
    <div className="relative z-50 mt-[-1.5rem] rounded-t-3xl border bg-white">
      <div className="space-y-2 p-4">
        <div className="flex items-center gap-3">
          <Image
            src="/logo/DinizGourmet(Logo).webp"
            alt="Diniz Gourmet Logo"
            width={45}
            height={45}
          />
          <div>
            <h2 className="text-lg font-semibold">Diniz Gourmet</h2>
            <p className="text-xs opacity-55">Restaurante</p>
          </div>
        </div>
        <div className="flex items-center gap-1 text-xs text-green-500">
          <ClockIcon />
          <p>Aberto!</p>
        </div>
      </div>
      <ScrollArea className="w-full">
        <div className="flex w-max space-x-4 p-4 pt-0">
          {_categories.map((category) => (
            <Button
              key={category.id}
              variant={setCategoryButtonVariant(category)}
              size="sm"
              className="rounded-full"
              onClick={() => handleCategoryClick(category)}
            >
              {category.name}
            </Button>
          ))}
        </div>
      </ScrollArea>
      <h3 className="px-5 text-lg font-semibold">{selectedCategory.name}</h3>
      <Products products={selectedCategory.products} />
      {products.length > 0 && (
        <div className="fixed right-0 bottom-0 left-0 flex w-full items-center justify-between border-t bg-white px-5 py-3">
          <div>
            <p className="text-muted-foreground text-xs">Total dos pedidos</p>
            <p className="text-sm font-semibold">
              {formatBRL(total)}
              <span className="text-muted-foreground text-xs font-normal">
                / {totalQuantity} {totalQuantity > 1 ? "itens" : "item"}
              </span>
            </p>
          </div>
          <Button onClick={toggleCart}>Ver sacola</Button>
          <CartSheet />
        </div>
      )}
    </div>
  );
};

export default RestaurantCategories;
