"use client";
import { formatBRL } from "@/app/utils/format-currency-value";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { MenuProduct } from "@/types/restaurant";
import { ChefHatIcon, ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import Image from "next/image";
import { useState } from "react";

interface ProductDetailsProps {
  product: MenuProduct;
}

const ProductDetails = ({ product }: ProductDetailsProps) => {
  const [quantity, setQuantity] = useState(1);

  const handleDecreaseQuantity = () => {
    if (quantity > 1) {
      setQuantity(quantity - 1);
    }
  };

  const handleIncreaseQuantity = () => {
    setQuantity(quantity + 1);
  };

  return (
    <div className="relative z-50 mt-[-1.5rem] flex flex-auto flex-col space-y-4 overflow-hidden rounded-t-3xl p-5">
      <div className="flex-auto space-y-3 overflow-hidden">
        <div className="space-y-1">
          {/* LOGO E TITULO */}
          <div className="flex items-center gap-1.5 pt-4">
            <Image
              src="/logo/DinizGourmet(Logo).webp"
              alt="Diniz Gourmet"
              width={16}
              height={16}
              className="rounded-full"
            />
            <p className="text-muted-foreground text-sm">Diniz Gourmet</p>
          </div>
          {/* NOME DO PRODUTO */}
          <h2 className="text-xl font-semibold">{product.name}</h2>
        </div>

        {/* PREÇO E QUANTIDADE */}
        <div className="itmes-center flex justify-between">
          <h3 className="text-xl font-semibold">{formatBRL(product.price)}</h3>
          <div className="text-tenter flex items-center gap-3">
            <Button
              variant="outline"
              className="h-8 w-8 rounded-xl"
              disabled={quantity <= 1}
              onClick={handleDecreaseQuantity}
            >
              <ChevronLeftIcon />
            </Button>
            <p className="w-4 text-center">{quantity}</p>
            <Button
              variant="destructive"
              className="h-8 w-8 rounded-xl"
              onClick={handleIncreaseQuantity}
            >
              <ChevronRightIcon />
            </Button>
          </div>
        </div>

        <ScrollArea className="h-full">
          <div className="space-y-4">
            {/* SOBRE */}
            <div className="space-y-1">
              <h4 className="font-semibold">Sobre</h4>
              <p className="text-muted-foreground text-sm">
                {product.description}
              </p>
            </div>

            {/* INGREDIENTES*/}
            <div className="space-y-1">
              <div className="flex items-center gap-1">
                <ChefHatIcon size={18} />
                <h4 className="font-semibold">Ingredientes</h4>
              </div>
              <ul className="text-muted-foreground list-disc px-5">
                {product.ingredients.map((ingredient, index) => (
                  <li key={index} className="text-muted-foreground text-sm">
                    {ingredient}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </ScrollArea>
      </div>

      <Button className="w-full rounded-full">Adicionar à sacola</Button>
    </div>
  );
};

export default ProductDetails;
