import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import Image from "next/image";
import Link from "next/link";
import { ConsumptionMethod } from "@/db/schema";

interface ComsumptionMethodOption {
  imageUrl: string;
  imageAlt: string;
  buttonText: string;
  option: ConsumptionMethod;
}

const ComsumptionMethodOption = ({
  imageUrl,
  imageAlt,
  buttonText,
  option,
}: ComsumptionMethodOption) => {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-4">
        <div className="relative h-[80px] w-[80px]">
          <Image
            src={imageUrl}
            alt={imageAlt}
            fill
            className="object-contain"
          />
        </div>
        <Button asChild>
          <Link href={`/menu?consumptionMethod=${option}`}>{buttonText}</Link>
        </Button>
      </CardContent>
    </Card>
  );
};

export default ComsumptionMethodOption;
