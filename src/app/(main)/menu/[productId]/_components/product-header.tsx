"use client";
import { Button } from "@/components/ui/button";
import { ChevronLeftIcon, ShoppingCartIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import Image from "next/image";

interface ProductHeaderProps {
  product: {
    id: string;
    name: string;
    imageUrl: string;
  };
}

const ProductHeader = ({ product }: ProductHeaderProps) => {
  const router = useRouter();
  return (
    <div>
      <div className="relative h-[300px] w-full">
        <Button
          variant="secondary"
          onClick={() => router.back()}
          className="absolute top-4 left-4 z-50 rounded-full"
        >
          <ChevronLeftIcon />
        </Button>
        <Image
          src={product.imageUrl}
          alt={product.name}
          fill
          className="object-cover"
        />
        <Button
          variant="secondary"
          className="absolute top-4 right-4 z-50 rounded-full"
        >
          <ShoppingCartIcon />
        </Button>
      </div>
    </div>
  );
};

export default ProductHeader;
