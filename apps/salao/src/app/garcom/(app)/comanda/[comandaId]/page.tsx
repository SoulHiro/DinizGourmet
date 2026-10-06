"use client";

import { Loader2, Receipt, Wallet } from "lucide-react";
import Link from "next/link";
import { use, useState } from "react";
import { toast } from "sonner";

import { Cabecalho } from "@/components/salao/cabecalho";
import { Button } from "@/components/ui/button";
import { ErroApi } from "@/lib/cliente";
import { useDetalheComanda } from "@/lib/consultas";
import { cn, formatBRL } from "@/lib/utils";
import { AcoesComanda } from "./_components/acoes-mesa";
import { useCarrinho } from "./_components/carrinho";
import { Conta, type ItemParaRepetir } from "./_components/conta";
import { NovoPedido } from "./_components/novo-pedido";

type Aba = "pedido" | "conta";

// Tela de uma comanda (cartão): lançar pedido, ver a conta e as ações
// (receber, imprimir, trocar de mesa).
export default function ComandaPage({
  params,
}: {
  params: Promise<{ comandaId: string }>;
}) {
  const { comandaId } = use(params);
  const {
    data: detalhe,
    isLoading,
    error,
    refetch,
  } = useDetalheComanda(comandaId);
  const [aba, setAba] = useState<Aba>("pedido");
  // Um carrinho só para as duas abas: "Repetir" na Conta cai no pedido.
  const carrinho = useCarrinho(comandaId);
  // Cada toque em "Receber" abre o pagamento (o menu escuta o contador).
  const [receber, setReceber] = useState(0);

  if (isLoading || !detalhe) {
    // Comanda paga (ou de outro restaurante): volta para o mapa.
    const fechada =
      error instanceof ErroApi &&
      (error.codigo === "comanda_fechada" || error.status === 404);
    return (
      <div className="min-h-dvh">
        <Cabecalho titulo="Comanda" voltarPara="/garcom" />
        {fechada ? (
          <div className="flex flex-col items-center gap-3 p-6 text-center">
            <p className="text-texto-secundario">
              Esta comanda já foi paga ou não existe mais.
            </p>
            <Link href="/garcom" className="font-semibold text-acao underline">
              Voltar para as mesas
            </Link>
          </div>
        ) : error ? (
          <button
            type="button"
            onClick={() => refetch()}
            className="w-full p-6 text-destructive"
          >
            Não foi possível carregar a comanda. Toque para tentar de novo.
          </button>
        ) : (
          <Loader2 className="mx-auto mt-10 size-8 animate-spin text-texto-secundario" />
        )}
      </div>
    );
  }

  const { mesa, comanda } = detalhe;
  const rodadas = comanda.rodadas.length;
  const noCarrinho = carrinho.linhas.reduce((s, l) => s + l.quantidade, 0);
  const comTaxa = comanda.totalCentavos + comanda.taxa.valorCentavos;

  const repetir = (itens: ItemParaRepetir[]) => {
    for (const item of itens) {
      carrinho.adicionar({
        produtoId: item.produtoId,
        quantidade: item.quantidade,
        modificadorIds: item.modificadorIds,
        observacao: item.observacao ?? undefined,
      });
    }
    const qtd = itens.reduce((s, i) => s + i.quantidade, 0);
    toast.success(
      `${qtd} ${qtd === 1 ? "item adicionado" : "itens adicionados"} ao pedido. Confira e lance.`,
    );
    setAba("pedido");
  };

  return (
    <div className="min-h-dvh">
      <Cabecalho
        titulo={
          comanda.numero ? `Comanda ${comanda.numero}` : `Mesa ${mesa.numero}`
        }
        subtitulo={`Mesa ${mesa.numero} · ${comanda.titular}`}
        voltarPara={`/garcom/mesa/${mesa.id}`}
        acoes={<AcoesComanda detalhe={detalhe} abrirReceber={receber} />}
      />

      {comanda.pedidoConta && (
        <div className="flex items-center gap-3 bg-status-conta px-3 py-2 text-white">
          <Receipt className="size-5 shrink-0" />
          <p className="flex-1 font-semibold text-sm">
            O cliente pediu a conta
            {comanda.pedidoConta.taxaServico ? "" : " (sem taxa)"}
          </p>
          <Button
            size="sm"
            className="bg-white text-black hover:bg-white/90"
            onClick={() => setReceber((n) => n + 1)}
          >
            <Wallet /> Receber
          </Button>
        </div>
      )}

      <nav className="grid grid-cols-2 border-borda border-b bg-surface">
        {(
          [
            ["pedido", `Novo pedido${noCarrinho ? ` (${noCarrinho})` : ""}`],
            [
              "conta",
              `Conta${rodadas ? ` · ${formatBRL(comanda.totalCentavos)}` : ""}`,
            ],
          ] as const
        ).map(([valor, rotulo]) => (
          <button
            key={valor}
            type="button"
            onClick={() => setAba(valor)}
            className={cn(
              "h-12 border-b-4 font-semibold",
              aba === valor
                ? "border-acao text-texto"
                : "border-transparent text-texto-secundario",
            )}
          >
            {rotulo}
          </button>
        ))}
      </nav>

      {aba === "conta" ? (
        <>
          <Conta comanda={comanda} onRepetir={repetir} />
          {comanda.totalCentavos > 0 && (
            <footer className="fixed inset-x-0 bottom-0 z-30 border-borda border-t bg-surface px-3 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-4px_16px_rgba(0,0,0,0.08)]">
              <Button
                variant="acao"
                size="lg"
                className="w-full"
                onClick={() => setReceber((n) => n + 1)}
              >
                <Wallet />
                Receber · {formatBRL(comTaxa)}
                <span className="font-normal text-sm opacity-80">
                  com {comanda.taxa.pct}%
                </span>
              </Button>
            </footer>
          )}
        </>
      ) : (
        <NovoPedido
          comandaId={comanda.id}
          mesaId={mesa.id}
          mesaNumero={mesa.numero}
          mesas={comanda.mesas}
          carrinho={carrinho}
        />
      )}
    </div>
  );
}
