import { db } from "@/db";
import { orders } from "@/db/schema";
import { eq, desc } from "drizzle-orm";

import { isValidCpf, removeCpfPunctuation } from "../menu/helpers/cpf";
import CpfForm from "./_components/cpf-form";
import OrderList from "./_components/order-list";

interface OrdersPageProps {
  searchParams: Promise<{ cpf: string }>;
}

const OrdersPage = async ({ searchParams }: OrdersPageProps) => {
  const { cpf } = await searchParams;
  if (!cpf) {
    return <CpfForm />;
  }
  if (!isValidCpf(cpf)) {
    return <CpfForm />;
  }
  
  const ordersData = await db.query.orders.findMany({
    orderBy: desc(orders.createdAt),
    where: eq(orders.customerCpf, removeCpfPunctuation(cpf)),
    with: {
      orderProducts: {
        with: {
          product: {
            columns: {
              name: true,
            },
          },
        },
        columns: {
          id: true,
          quantity: true,
        },
      },
    },
  });
  
  return <OrderList orders={ordersData} />;
};

export default OrdersPage;
