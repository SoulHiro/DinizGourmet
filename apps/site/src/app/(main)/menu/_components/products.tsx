import Image from "next/image";
import Link from "next/link";
import { formatBRL } from "@/app/helpers/format-currency";
import type { Product } from "@/types/restaurant";
import { useSearchParams } from "next/navigation";

interface ProductsProps {
  products: Product[];
}

const Products = ({ products }: ProductsProps) => {
  const searchParams = useSearchParams();
  const consumptionMethod = searchParams.get("consumptionMethod");
  return (
    <div className="space-y-3 px-5">
      {products.map((product) => (
        <Link
          key={product.id}
          href={`/menu/${product.id}?consumptionMethod=${consumptionMethod}`}
          className="flex items-center justify-between gap-10 border-b py-3"
        >
          {/* ESQUERDA */}
          <div>
            <h3 className="text-sm font-medium">{product.name}</h3>
            <p className="text-muted-foreground line-clamp-2 text-sm">
              {product.description}
            </p>
            <p className="pt-3 text-sm font-semibold">
              {formatBRL(product.price)}
            </p>
          </div>

          {/* DIREITA */}
          <div className="relative min-h-[82px] min-w-[120px]">
            <Image
              src={product.imageUrl}
              alt={product.name}
              fill
              className="rounded-lg object-contain"
            />
          </div>
        </Link>
      ))}
    </div>
  );
};

export default Products;
