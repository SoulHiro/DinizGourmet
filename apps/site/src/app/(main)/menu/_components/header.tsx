"use client";
import { Button } from "@/components/ui/button";
import {
  ChevronLeftIcon,
  ScrollTextIcon,
  ShoppingCartIcon,
} from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";

const RestaurantHeader = () => {
  const router = useRouter();
  return (
    <div className="relative h-[250px] w-full">
      <Button
        variant="secondary"
        onClick={() => router.back()}
        className="absolute top-4 left-4 z-50 rounded-full"
      >
        <ChevronLeftIcon />
      </Button>
      <Image
        src="/images/menu/header.webp"
        alt="Entrega"
        fill
        className="object-cover"
      />
      <Button
        variant="secondary"
        className="absolute top-4 right-4 z-50 rounded-full"
        onClick={() => router.push(`/orders`)}
      >
        <ScrollTextIcon />
      </Button>
    </div>
  );
};

export default RestaurantHeader;
