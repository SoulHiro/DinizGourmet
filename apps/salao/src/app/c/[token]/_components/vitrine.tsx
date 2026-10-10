"use client";

import { Search, X } from "lucide-react";
import { useMemo, useState } from "react";

import type { ProdutoPublico } from "@/lib/dominio/cardapio-publico";
import { normalizarBusca } from "@/lib/texto";
import { formatBRL } from "@/lib/utils";
import { CardProduto } from "./card-produto";
import { FotoProduto } from "./foto-produto";

export type CategoriaVitrine = {
  id: string;
  nome: string;
  produtos: ProdutoPublico[];
};

// O cardápio em si (busca, destaques, categorias). Usado no QR da mesa e na
// prévia do gerente, para a prévia ser exatamente o que o cliente vê.
export const Vitrine = ({
  categorias,
  selo,
  onAbrir,
}: {
  categorias: CategoriaVitrine[];
  selo: string;
  onAbrir: (produto: ProdutoPublico) => void;
}) => {
  const [busca, setBusca] = useState("");

  const todos = useMemo(
    () => categorias.flatMap((c) => c.produtos),
    [categorias],
  );
  const destaques = todos.filter((p) => p.destaque && !p.esgotado);
  const termo = normalizarBusca(busca);
  const resultados = termo
    ? todos.filter(
        (p) =>
          normalizarBusca(p.nome).includes(termo) ||
          normalizarBusca(p.descricao ?? "").includes(termo) ||
          p.ingredientes.some((i) => normalizarBusca(i).includes(termo)),
      )
    : [];

  const irPara = (categoriaId: string) => {
    setBusca("");
    document
      .getElementById(`cat-${categoriaId}`)
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <>
      <header className="sticky top-0 z-20 bg-fundo/95 px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3 backdrop-blur">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-bold text-2xl text-marca leading-none">
              Xis Diniz
            </p>
            <p className="text-texto-secundario text-xs">
              O verdadeiro xis do sul, direto na chapa
            </p>
          </div>
          <span className="rounded-full bg-marca px-3 py-1.5 font-bold text-marca-foreground text-sm">
            {selo}
          </span>
        </div>
        <label className="relative mt-3 block">
          <Search className="-translate-y-1/2 absolute top-1/2 left-4 size-5 text-texto-secundario" />
          <input
            type="search"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar lanche, porção, bebida..."
            className="h-12 w-full rounded-full bg-surface pr-12 pl-12 shadow-sm ring-1 ring-borda"
          />
          {busca && (
            <button
              type="button"
              aria-label="Limpar busca"
              onClick={() => setBusca("")}
              className="-translate-y-1/2 absolute top-1/2 right-1 flex size-10 items-center justify-center"
            >
              <X className="size-5" />
            </button>
          )}
        </label>
      </header>

      {termo ? (
        <main className="px-4">
          <p className="mb-3 text-sm text-texto-secundario">
            {resultados.length}{" "}
            {resultados.length === 1 ? "resultado" : "resultados"} para "{busca}
            "
          </p>
          <div className="grid grid-cols-2 gap-3">
            {resultados.map((p) => (
              <CardProduto key={p.id} produto={p} onAbrir={() => onAbrir(p)} />
            ))}
          </div>
        </main>
      ) : (
        <main className="flex flex-col gap-6">
          {destaques.length > 0 && (
            <section aria-label="Destaques da casa">
              <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
                {destaques.map((p, indice) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => onAbrir(p)}
                    className="relative aspect-[16/10] w-[86%] shrink-0 snap-center overflow-hidden rounded-3xl text-left shadow-md active:scale-[0.99]"
                  >
                    <FotoProduto
                      src={p.fotoUrl}
                      nome={p.nome}
                      prioridade={indice === 0}
                      tamanhoIcone="size-20"
                      className="absolute inset-0 size-full"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent" />
                    <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-4 text-white">
                      <div className="min-w-0">
                        <span className="rounded-full bg-acao px-2.5 py-1 font-bold text-[11px] uppercase tracking-wide">
                          Destaque da casa
                        </span>
                        <p className="mt-2 truncate font-bold text-2xl leading-tight">
                          {p.nome}
                        </p>
                        {p.descricao && (
                          <p className="line-clamp-1 text-sm text-white/80">
                            {p.descricao}
                          </p>
                        )}
                      </div>
                      <span className="shrink-0 rounded-full bg-white px-3 py-1.5 font-bold text-black">
                        {formatBRL(p.precoCentavos)}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </section>
          )}

          <nav
            aria-label="Categorias"
            className="flex gap-4 overflow-x-auto px-4 [scrollbar-width:none]"
          >
            {categorias.map((c) => {
              const capa =
                c.produtos.find((p) => p.miniaturaUrl) ?? c.produtos[0];
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => irPara(c.id)}
                  className="flex w-[4.5rem] shrink-0 flex-col items-center gap-1.5"
                >
                  <FotoProduto
                    src={capa?.miniaturaUrl ?? null}
                    nome={capa?.nome ?? c.nome}
                    tamanhoIcone="size-7"
                    className="size-16 rounded-full ring-2 ring-acao/40"
                  />
                  <span className="font-semibold text-xs">{c.nome}</span>
                </button>
              );
            })}
          </nav>

          {categorias.map((c) => (
            <section
              key={c.id}
              id={`cat-${c.id}`}
              className="scroll-mt-36 px-4"
            >
              <h2 className="mb-3 font-bold text-xl">{c.nome}</h2>
              <div className="grid grid-cols-2 gap-3">
                {c.produtos.map((p) => (
                  <CardProduto
                    key={p.id}
                    produto={p}
                    onAbrir={() => onAbrir(p)}
                  />
                ))}
              </div>
            </section>
          ))}
        </main>
      )}
    </>
  );
};
