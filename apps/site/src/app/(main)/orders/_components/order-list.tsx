"use client";

import { ChevronLeftIcon, ScrollTextIcon } from "lucide-react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { formatBRL } from "@/app/helpers/format-currency";
import Image from "next/image";

type OrderStatus = "PENDING" | "IN_PREPARATION" | "FINISHED";

interface OrderListProps {
  orders: Array<{
    id: number;
    total: number;
    status: OrderStatus;
    customerName: string;
    orderProducts: Array<{
      id: string;
      quantity: number;
      product: {
        name: string;
      };
    }>;
  }>;
}

const getStatusLabel = (status: OrderStatus) => {
  if (status === "FINISHED") return "Finalizado";
  if (status === "IN_PREPARATION") return "Em preparo";
  if (status === "PENDING") return "Pendente";
  return "";
};

const OrderList = ({ orders }: OrderListProps) => {
  const router = useRouter();
  const handleBackClick = () => router.back();

  return (
    <div className="space-y-6 p-6">
      <Button
        size="icon"
        variant="secondary"
        className="rounded-full"
        onClick={handleBackClick}
      >
        <ChevronLeftIcon />
      </Button>
      <div className="flex items-center gap-3">
        <ScrollTextIcon />
        <h2 className="text-lg font-semibold">Meus Pedidos</h2>
      </div>
      {orders.map((order) => (
        <Card key={order.id}>
          <CardContent className="space-y-4 p-5">
            <div
              className={`w-fit rounded-full px-2 py-1 text-xs font-semibold text-white ${
                (["FINISHED"] as OrderStatus[]).includes(order.status)
                  ? "bg-green-500 text-white"
                  : order.status === "IN_PREPARATION"
                    ? "bg-yellow-500 text-white"
                    : "bg-gray-400 text-white"
              }`}
            >
              {getStatusLabel(order.status)}
            </div>
            <div className="flex items-center gap-2">
              <div className="relative flex h-6 w-6 items-center justify-center rounded-sm">
                <Image
                  src="/logo/DinizGourmet(Logo).webp"
                  alt="Diniz Gourmet"
                  width={24}
                  height={24}
                />
              </div>
              <p className="text-sm font-semibold">Diniz Gourmet</p>
            </div>
            <Separator />
            <div className="space-y-2">
              {order.orderProducts.map((orderProduct) => (
                <div key={orderProduct.id} className="flex items-center gap-2">
                  <div className="flex h-5 w-5 items-center justify-center rounded-full bg-gray-400 text-xs font-semibold text-white">
                    {orderProduct.quantity}
                  </div>
                  <p className="text-sm">{orderProduct.product.name}</p>
                </div>
              ))}
            </div>
            <Separator />
            <p className="text-sm font-medium">{formatBRL(order.total)}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export default OrderList;
