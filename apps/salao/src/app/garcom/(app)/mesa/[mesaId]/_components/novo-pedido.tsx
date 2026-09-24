"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Minus, Plus, Search, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { api, ErroApi } from "@/lib/cliente";
import { useCardapio } from "@/lib/consultas";
import type { ProdutoCardapio } from "@/lib/dominio/cardapio";
import type { ResultadoRodada } from "@/lib/dominio/rodadas";
import { normalizarBusca } from "@/lib/texto";
import { cn, formatBRL } from "@/lib/utils";
import { useCarrinho } from "./carrinho";
import { DrawerItem } from "./drawer-item";

type MesaDaComanda = { id: string; numero: number };

export const NovoPedido = ({
  mesaId,
  mesaNumero,
  mesas,
}: {
  mesaId: string;
  mesaNumero: number;
  mesas: MesaDaComanda[];
}) => {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: categorias, isLoading } = useCardapio();
  const carrinho = useCarrinho(mesaId);
  const [busca, setBusca] = useState("");
  const [categoriaId, setCategoriaId] = useState<string | null>(null);
  const [produtoAberto, setProdutoAberto] = useState<ProdutoCardapio | null>(
    null,
  );
  const [verCarrinho, setVerCarrinho] = useState(false);

  const produtosPorId = useMemo(
    () =>
      new Map(
        categorias?.flatMap((c) => c.produtos.map((p) => [p.id, p] as const)),
      ),
    [categorias],
  );

  const categoriaAtiva = categoriaId ?? categorias?.[0]?.id ?? null;
  const termo = normalizarBusca(busca);
  const visiveis = useMemo(() => {
    if (!categorias) return [];
    if (termo.length >= 2) {
      return categorias
        .flatMap((c) => c.produtos)
        .filter((p) => p.busca.includes(termo));
    }
    return categorias.find((c) => c.id === categoriaAtiva)?.produtos ?? [];
  }, [categorias, categoriaAtiva, termo]);

  const totalItens = carrinho.linhas.reduce((s, l) => s + l.quantidade, 0);
  const totalCentavos = carrinho.linhas.reduce((soma, linha) => {
    const produto = produtosPorId.get(linha.produtoId);
    if (!produto) return soma;
    const adicionais = produto.modificadores
      .filter((m) => linha.modificadorIds.includes(m.id))
      .reduce((s, m) => s + m.precoCentavos, 0);
    return soma + (produto.precoCentavos + adicionais) * linha.quantidade;
  }, 0);

  const lancar = useMutation({
    mutationFn: () =>
      api<ResultadoRodada>(`/api/mesas/${mesaId}/rodadas`, {
        method: "POST",
        json: {
          idempotencyKey: carrinho.idempotencyKey,
          itens: carrinho.linhas.map(({ chave: _chave, ...linha }) => linha),
        },
      }),
    onSuccess: (resultado) => {
      carrinho.reiniciar();
      toast.success(`Mesa ${mesaNumero}: rodada ${resultado.numero} lançada`);
      queryClient.invalidateQueries({ queryKey: ["mesas"] });
      router.push("/garcom");
    },
    onError: (error) => {
      if (error instanceof ErroApi) {
        toast.error(error.message);
        if (error.codigo === "esgotado" || error.codigo === "indisponivel") {
          queryClient.invalidateQueries({ queryKey: ["cardapio"] });
        }
        return;
      }
      // Falha de rede: o carrinho e a chave ficam; reenviar não duplica.
      toast.error(
        "Sem conexão. Toque em Lançar de novo — o pedido não será duplicado.",
      );
    },
  });

  const descricaoLinha = (
    modificadorIds: string[],
    produto?: ProdutoCardapio,
  ) =>
    produto?.modificadores
      .filter((m) => modificadorIds.includes(m.id))
      .map((m) => m.nome)
      .join(", ");

  return (
    <>
      <div className="sticky top-16 z-20 flex flex-col gap-2 border-borda border-b bg-base px-3 pt-3 pb-2">
        <label className="relative block">
          <Search className="-translate-y-1/2 absolute top-1/2 left-3 size-5 text-texto-secundario" />
          <input
            type="search"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar item (2–3 letras)"
            autoComplete="off"
            className="h-12 w-full rounded-lg border border-borda bg-surface pr-10 pl-10 text-base"
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
        {termo.length < 2 && (
          <div className="-mx-3 flex gap-2 overflow-x-auto px-3 pb-1">
            {categorias?.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setCategoriaId(c.id)}
                className={cn(
                  "h-11 shrink-0 rounded-full px-4 font-semibold",
                  c.id === categoriaAtiva
                    ? "bg-marca text-marca-foreground"
                    : "bg-surface text-texto",
                )}
              >
                {c.nome}
              </button>
            ))}
          </div>
        )}
      </div>

      <ul className="flex flex-col gap-2 p-3 pb-44">
        {isLoading && (
          <Loader2 className="mx-auto mt-6 size-8 animate-spin text-texto-secundario" />
        )}
        {!isLoading && visiveis.length === 0 && (
          <p className="p-6 text-center text-texto-secundario">
            Nenhum item encontrado.
          </p>
        )}
        {visiveis.map((produto) => {
          const noCarrinho = carrinho.quantidadeTotal(produto.id);
          const simples = carrinho.quantidadeSimples(produto.id);
          return (
            <li
              key={produto.id}
              className={cn(
                "flex items-center gap-2 rounded-xl border bg-surface p-2 pl-3",
                noCarrinho > 0 ? "border-marca" : "border-borda",
                produto.esgotado && "opacity-50",
              )}
            >
              <button
                type="button"
                disabled={produto.esgotado}
                onClick={() => setProdutoAberto(produto)}
                className="min-h-12 flex-1 text-left"
              >
                <p className="font-semibold text-lg leading-tight">
                  {produto.nome}
                </p>
                <p className="text-sm text-texto-secundario">
                  {produto.esgotado ? (
                    <span className="font-semibold text-destructive">
                      Esgotado
                    </span>
                  ) : (
                    <>
                      {formatBRL(produto.precoCentavos)}
                      {produto.estoque !== null &&
                        produto.estoque <= 5 &&
                        ` · restam ${produto.estoque}`}
                      {noCarrinho > simples &&
                        ` · ${noCarrinho - simples} personalizado(s)`}
                    </>
                  )}
                </p>
              </button>
              {!produto.esgotado && (
                <div className="flex items-center gap-1">
                  {simples > 0 && (
                    <>
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label={`Tirar um ${produto.nome}`}
                        onClick={() => carrinho.alterarSimples(produto.id, -1)}
                      >
                        <Minus />
                      </Button>
                      <span className="w-6 text-center font-bold text-xl">
                        {simples}
                      </span>
                    </>
                  )}
                  <Button
                    size="icon"
                    variant={simples > 0 ? "marca" : "outline"}
                    aria-label={`Adicionar ${produto.nome}`}
                    onClick={() => carrinho.alterarSimples(produto.id, 1)}
                  >
                    <Plus />
                  </Button>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      <footer className="fixed inset-x-0 bottom-0 z-30 border-borda border-t bg-surface px-3 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-4px_16px_rgba(0,0,0,0.08)]">
        {verCarrinho && carrinho.linhas.length > 0 && (
          <ul className="mb-2 flex max-h-[40dvh] flex-col gap-1 overflow-y-auto">
            {carrinho.linhas.map((linha) => {
              const produto = produtosPorId.get(linha.produtoId);
              const mods = descricaoLinha(linha.modificadorIds, produto);
              const origem = mesas.find((m) => m.id === linha.mesaOrigemId);
              return (
                <li
                  key={linha.chave}
                  className="flex items-center gap-2 border-borda border-b py-1"
                >
                  <div className="flex-1">
                    <p className="font-semibold">
                      {linha.quantidade}x {produto?.nome ?? "Item"}
                    </p>
                    {(mods || linha.observacao || origem) && (
                      <p className="text-sm text-texto-secundario">
                        {[
                          mods,
                          linha.observacao && `Obs: ${linha.observacao}`,
                          origem && `Mesa ${origem.numero}`,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    )}
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label="Remover do pedido"
                    onClick={() => carrinho.remover(linha.chave)}
                  >
                    <Trash2 className="text-destructive" />
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
        <div className="flex gap-2">
          <Button
            size="lg"
            className="px-3"
            disabled={carrinho.linhas.length === 0}
            onClick={() => setVerCarrinho((v) => !v)}
            aria-expanded={verCarrinho}
          >
            {totalItens} {totalItens === 1 ? "item" : "itens"}
          </Button>
          <Button
            variant="acao"
            size="lg"
            className="flex-1"
            disabled={carrinho.linhas.length === 0 || lancar.isPending}
            onClick={() => lancar.mutate()}
          >
            {lancar.isPending ? (
              <Loader2 className="animate-spin" />
            ) : (
              <>
                Lançar pedido
                {totalCentavos > 0 && ` · ${formatBRL(totalCentavos)}`}
              </>
            )}
          </Button>
        </div>
      </footer>

      <DrawerItem
        produto={produtoAberto}
        mesas={mesas}
        mesaAtualId={mesaId}
        onFechar={() => setProdutoAberto(null)}
        onAdicionar={carrinho.adicionar}
      />
    </>
  );
};
