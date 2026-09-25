import type { ProdutoPublico } from "@/lib/dominio/cardapio-publico";
import { cn, formatBRL } from "@/lib/utils";
import { FotoProduto } from "./foto-produto";

export const CardProduto = ({
  produto,
  onAbrir,
}: {
  produto: ProdutoPublico;
  onAbrir: () => void;
}) => (
  <button
    type="button"
    onClick={onAbrir}
    className="group flex flex-col overflow-hidden rounded-2xl bg-surface text-left shadow-sm ring-1 ring-borda active:scale-[0.98]"
  >
    <div className="relative">
      <FotoProduto
        src={produto.miniaturaUrl}
        nome={produto.nome}
        className={cn("aspect-square w-full", produto.esgotado && "grayscale")}
      />
      {produto.esgotado && (
        <span className="absolute top-2 left-2 rounded-full bg-black/75 px-2.5 py-1 font-semibold text-white text-xs">
          Esgotado
        </span>
      )}
      {produto.destaque && !produto.esgotado && (
        <span className="absolute top-2 left-2 rounded-full bg-acao px-2.5 py-1 font-semibold text-acao-foreground text-xs">
          Destaque
        </span>
      )}
    </div>
    <div className="flex flex-1 flex-col gap-1 p-3">
      <p className="font-bold leading-tight">{produto.nome}</p>
      {produto.descricao && (
        <p className="line-clamp-2 text-texto-secundario text-xs leading-snug">
          {produto.descricao}
        </p>
      )}
      <p className="mt-auto pt-1 font-bold text-acao">
        {formatBRL(produto.precoCentavos)}
      </p>
    </div>
  </button>
);
