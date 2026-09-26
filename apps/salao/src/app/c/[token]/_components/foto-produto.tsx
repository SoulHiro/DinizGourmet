import {
  Beer,
  CakeSlice,
  CupSoda,
  Sandwich,
  UtensilsCrossed,
} from "lucide-react";

import { cn } from "@/lib/utils";

// Enquanto o gerente não sobe a foto, mostra uma ilustração com a cara da
// marca (ícone escolhido pelo nome do produto) em vez de um buraco cinza.
const iconeDe = (nome: string) => {
  const n = nome.toLowerCase();
  if (/cerveja|chopp/.test(n)) return Beer;
  if (/refri|suco|água|agua|bebida|lata/.test(n)) return CupSoda;
  if (/pudim|sobremesa|doce|sorvete|torta/.test(n)) return CakeSlice;
  if (/xis|lanche|burguer|hamb/.test(n)) return Sandwich;
  return UtensilsCrossed;
};

export const FotoProduto = ({
  src,
  nome,
  className,
  tamanhoIcone = "size-12",
  prioridade = false,
}: {
  src: string | null;
  nome: string;
  className?: string;
  tamanhoIcone?: string;
  prioridade?: boolean;
}) => {
  if (src) {
    return (
      // biome-ignore lint/performance/noImgElement: fotos servidas pelo próprio servidor local, já otimizadas no upload
      <img
        src={src}
        alt={nome}
        loading={prioridade ? "eager" : "lazy"}
        decoding="async"
        className={cn("object-cover", className)}
      />
    );
  }
  const Icone = iconeDe(nome);
  return (
    <div
      role="img"
      aria-label={nome}
      className={cn(
        "flex items-center justify-center bg-gradient-to-br from-marca via-[#7a4a2a] to-acao text-marca-foreground",
        className,
      )}
    >
      <Icone className={cn(tamanhoIcone, "opacity-80")} strokeWidth={1.5} />
    </div>
  );
};
