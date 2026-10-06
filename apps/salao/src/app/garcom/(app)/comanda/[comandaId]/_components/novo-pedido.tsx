"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ClipboardList,
  Flame,
  Loader2,
  Minus,
  Plus,
  Search,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { api, ErroApi } from "@/lib/cliente";
import { useCardapio, useSugestoesPedido } from "@/lib/consultas";
import type { ProdutoCardapio } from "@/lib/dominio/cardapio";
import type { ResultadoRodada } from "@/lib/dominio/rodadas";
import { normalizarBusca } from "@/lib/texto";
import { cn, formatBRL } from "@/lib/utils";
import type { useCarrinho } from "./carrinho";
import { DrawerItem } from "./drawer-item";
import { DrawerRevisao } from "./drawer-revisao";

type MesaDaComanda = { id: string; numero: number };

export type Carrinho = ReturnType<typeof useCarrinho>;

export const NovoPedido = ({
  comandaId,
  mesaId,
  mesaNumero,
  mesas,
  carrinho,
}: {
  comandaId: string;
  mesaId: string;
  mesaNumero: number;
  mesas: MesaDaComanda[];
  // Vem da página: a aba Conta também põe itens nele ("Repetir").
  carrinho: Carrinho;
}) => {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: categorias, isLoading } = useCardapio();
  const { data: sugestoes } = useSugestoesPedido();
  const [busca, setBusca] = useState("");
  const [categoriaId, setCategoriaId] = useState<string | null>(null);
  const [produtoAberto, setProdutoAberto] = useState<ProdutoCardapio | null>(
    null,
  );
  const [revisando, setRevisando] = useState(false);

  const produtosPorId = useMemo(
    () =>
      new Map(
        categorias?.flatMap((c) => c.produtos.map((p) => [p.id, p] as const)),
      ),
    [categorias],
  );

  // "Mais pedidos" (o que mais sai nos últimos 30 dias) abre primeiro.
  const MAIS = "__mais";
  const maisPedidos = (sugestoes?.maisPedidos ?? [])
    .map((id) => produtosPorId.get(id))
    .filter((p): p is ProdutoCardapio => Boolean(p));
  const categoriaAtiva =
    categoriaId ?? (maisPedidos.length ? MAIS : (categorias?.[0]?.id ?? null));
  const termo = normalizarBusca(busca);
  // Número digitado = código do cardápio (ex.: "5" ou "3" → 3, 30–39).
  const buscaPorCodigo = /^\d+$/.test(termo);
  const buscando = buscaPorCodigo || termo.length >= 2;
  const visiveis = useMemo(() => {
    if (!categorias) return [];
    const todos = categorias.flatMap((c) => c.produtos);
    if (buscaPorCodigo) {
      return todos
        .filter((p) => p.codigo !== null && String(p.codigo).startsWith(termo))
        .sort(
          (a, b) =>
            Number(b.codigo === Number(termo)) -
            Number(a.codigo === Number(termo)),
        );
    }
    if (termo.length >= 2) {
      return todos.filter((p) => p.busca.includes(termo));
    }
    if (categoriaAtiva === MAIS) return maisPedidos;
    return categorias.find((c) => c.id === categoriaAtiva)?.produtos ?? [];
  }, [categorias, categoriaAtiva, termo, buscaPorCodigo, maisPedidos]);

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
      api<ResultadoRodada>(`/api/comandas/${comandaId}/rodadas`, {
        method: "POST",
        json: {
          idempotencyKey: carrinho.idempotencyKey,
          itens: carrinho.linhas.map(({ chave: _chave, ...linha }) => linha),
        },
      }),
    onSuccess: (resultado) => {
      setRevisando(false);
      carrinho.reiniciar();
      toast.success(`Mesa ${mesaNumero}: rodada ${resultado.numero} lançada`);
      queryClient.invalidateQueries({ queryKey: ["mesas"] });
      // Volta para a mesa: fica fácil lançar o cartão do próximo cliente.
      router.push(`/garcom/mesa/${mesaId}`);
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

  return (
    <>
      <div className="sticky top-16 z-20 flex flex-col gap-2 border-borda border-b bg-fundo px-3 pt-3 pb-2">
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
        {!buscando && (
          <div className="-mx-3 flex gap-2 overflow-x-auto px-3 pb-1 [scrollbar-width:none]">
            {maisPedidos.length > 0 && (
              <button
                type="button"
                onClick={() => setCategoriaId(MAIS)}
                className={cn(
                  "flex h-11 shrink-0 items-center gap-1.5 rounded-full px-4 font-semibold",
                  categoriaAtiva === MAIS
                    ? "bg-marca text-marca-foreground"
                    : "bg-surface text-texto",
                )}
              >
                <Flame className="size-4" /> Mais pedidos
              </button>
            )}
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

      <ul className="flex flex-col gap-2 p-3 pb-28">
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
                "flex flex-col rounded-xl border bg-surface",
                noCarrinho > 0 ? "border-marca" : "border-borda",
                produto.esgotado && "opacity-50",
              )}
            >
              <div className="flex items-center gap-2 p-2 pl-3">
                <button
                  type="button"
                  disabled={produto.esgotado}
                  onClick={() => setProdutoAberto(produto)}
                  className="min-h-12 flex-1 text-left"
                >
                  <p className="font-semibold text-lg leading-tight">
                    {produto.codigo !== null && (
                      <span className="mr-1.5 font-bold text-texto-secundario tabular-nums">
                        {produto.codigo}
                      </span>
                    )}
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
                      </>
                    )}
                  </p>
                </button>
                {!produto.esgotado && (
                  <div className="flex items-center gap-1">
                    {noCarrinho > 0 && (
                      <>
                        <Button
                          size="icon"
                          variant="ghost"
                          disabled={simples === 0}
                          aria-label={`Tirar um ${produto.nome} completo`}
                          onClick={() =>
                            carrinho.alterarSimples(produto.id, -1)
                          }
                        >
                          <Minus />
                        </Button>
                        <span className="w-6 text-center font-bold text-xl">
                          {noCarrinho}
                        </span>
                      </>
                    )}
                    <Button
                      size="icon"
                      variant={noCarrinho > 0 ? "marca" : "outline"}
                      aria-label={`Adicionar ${produto.nome}`}
                      onClick={() => carrinho.alterarSimples(produto.id, 1)}
                    >
                      <Plus />
                    </Button>
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      <footer className="fixed inset-x-0 bottom-0 z-30 border-borda border-t bg-surface px-3 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-4px_16px_rgba(0,0,0,0.08)]">
        <Button
          variant="acao"
          size="lg"
          className="w-full"
          disabled={carrinho.linhas.length === 0}
          onClick={() => setRevisando(true)}
        >
          <ClipboardList />
          {carrinho.linhas.length === 0
            ? "Adicione itens ao pedido"
            : `Revisar pedido · ${totalItens} ${totalItens === 1 ? "item" : "itens"} · ${formatBRL(totalCentavos)}`}
        </Button>
      </footer>

      <DrawerRevisao
        aberto={revisando}
        onFechar={() => setRevisando(false)}
        carrinho={carrinho}
        produtosPorId={produtosPorId}
        mesas={mesas}
        totalCentavos={totalCentavos}
        lancando={lancar.isPending}
        onLancar={() => lancar.mutate()}
      />

      <DrawerItem
        produto={produtoAberto}
        mesas={mesas}
        mesaAtualId={mesaId}
        onFechar={() => setProdutoAberto(null)}
        onAdicionar={carrinho.adicionar}
        sugestoesObservacao={sugestoes?.observacoes ?? []}
      />
    </>
  );
};
