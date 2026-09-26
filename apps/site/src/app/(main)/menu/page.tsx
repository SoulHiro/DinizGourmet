import { notFound } from "next/navigation";
import { db } from "@/db";
import { type ConsumptionMethod, consumptionMethodEnum } from "@/db/schema";
import RestaurantCategories from "./_components/categories";
import RestaurantHeader from "./_components/header";

export const dynamic = "force-dynamic";

interface MenuPageProps {
  searchParams: {
    consumptionMethod: ConsumptionMethod;
  };
}

const consumptionMethodValid = (consumptionMethod: ConsumptionMethod) => {
  return consumptionMethodEnum.enumValues.includes(consumptionMethod);
};

const MenuPage = async ({ searchParams }: MenuPageProps) => {
  const restaurant = await db.query.menuCategories.findMany({
    with: {
      products: true,
    },
  });

  const { consumptionMethod } = await searchParams;
  if (!consumptionMethodValid(consumptionMethod)) {
    return notFound();
  }

  return (
    <>
      <RestaurantHeader />
      <RestaurantCategories categories={restaurant} />
    </>
  );
};

export default MenuPage;
