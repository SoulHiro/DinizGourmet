import { db } from "@/db";
import { notFound } from "next/navigation";
import ProductHeader from "./_components/product-header";

interface ProductPageProps {
  params: Promise<{ productId: string }>;
}

const ProductPage = async ({ params }: ProductPageProps) => {
  const { productId } = await params;
  const product = await db.query.products.findFirst({
    where: (products, { eq }) => eq(products.id, productId),
  });
  if (!product) {
    return notFound();
  }
  return (
    <>
      <ProductHeader product={product} />
    </>
  );
};

export default ProductPage;
