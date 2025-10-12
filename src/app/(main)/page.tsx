import Image from "next/image";

import ComsumptionMethodOption from "./_components/comsumption-method-option";

const RestaurantPage = async () => {
  return (
    <div className="flex h-screen flex-col items-center justify-center space-y-8 px-6">
      {/* LOGO E TITULO */}
      <div className="flex flex-col items-center gap-2">
        <Image
          src="/logo/DinizGourmet(Logo).webp"
          alt="Diniz Gourmet"
          width={172}
          height={172}
        />
      </div>
      {/* BEM VINDO */}
      <div className="space-y-2 text-center">
        <h3 className="text-2xl font-semibold">Seja bem-vindo!</h3>
        <p className="opacity-55">
          Escolha como prefere receber sua refeição. Estamos aqui para oferecer
          praticidade e sabor em cada detalhe!
        </p>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <ComsumptionMethodOption
          imageUrl="/images/home/delivery.svg"
          imageAlt="Entrega"
          buttonText="Entrega"
          option="DELIVERY"
        />
        <ComsumptionMethodOption
          imageUrl="/images/home/takeaway.svg"
          imageAlt="Para levar"
          buttonText="Retirada"
          option="TAKEAWAY"
        />
      </div>
    </div>
  );
};

export default RestaurantPage;
