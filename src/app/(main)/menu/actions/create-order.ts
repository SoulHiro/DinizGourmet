"use server";

import { revalidatePath } from "next/cache";

import { db } from "@/db";

import { removeCpfPunctuation } from "../helpers/cpf";
import {
  orderProducts,
  orders,
  products,
  type ConsumptionMethod,
} from "@/db/schema";
import { inArray } from "drizzle-orm";

interface CreateOrderInput {
  customerName: string;
  customerCpf: string;
  products: Array<{
    id: string;
    quantity: number;
  }>;
  consumptionMethod: ConsumptionMethod;
}

export const createOrder = async (input: CreateOrderInput) => {
  const productsWithPrices = await db
    .select()
    .from(products)
    .where(
      inArray(
        products.id,
        input.products.map((product) => product.id),
      ),
    );
  const productsWithPricesAndQuantities = input.products.map((product) => ({
    productId: product.id,
    quantity: product.quantity,
    price: productsWithPrices.find((p) => p.id === product.id)!.price,
  }));
  const [order] = await db
    .insert(orders)
    .values({
      status: "PENDING",
      customerName: input.customerName,
      customerCpf: removeCpfPunctuation(input.customerCpf),
      total: productsWithPricesAndQuantities.reduce(
        (acc, product) => acc + product.price * product.quantity,
        0,
      ),
      consumptionMethod: input.consumptionMethod,
      deliveryAddress: "",
    })
    .returning();

  // Insert order products separately since Drizzle doesn't support nested createMany
  const orderProductsData = productsWithPricesAndQuantities.map((product) => ({
    orderId: order.id,
    productId: product.productId,
    quantity: product.quantity,
    price: product.price,
  }));

  await db.insert(orderProducts).values(orderProductsData);
  revalidatePath(`/orders`);
  return order;
};
