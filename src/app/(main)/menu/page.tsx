import { consumptionMethodEnum, type ConsumptionMethod } from "@/db/schema";
import { notFound } from "next/navigation";
import RestaurantHeader from "./_components/header";
import RestaurantCategories from "./_components/categories";
import { db } from "@/db";

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
