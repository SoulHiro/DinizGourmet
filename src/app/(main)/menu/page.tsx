import { consumptionMethodEnum, type ConsumptionMethod } from "@/db/schema";
import { notFound } from "next/navigation";
import RestaurantHeader from "./_components/header";

interface MenuPageProps {
  searchParams: {
    consumptionMethod: ConsumptionMethod;
  };
}

const consumptionMethodValid = (consumptionMethod: ConsumptionMethod) => {
  return consumptionMethodEnum.enumValues.includes(consumptionMethod);
};

const MenuPage = async ({ searchParams }: MenuPageProps) => {
  const { consumptionMethod } = await searchParams;
  if (!consumptionMethodValid(consumptionMethod)) {
    return notFound();
  }

  return (
    <>
      <RestaurantHeader />
    </>
  );
};

export default MenuPage;
