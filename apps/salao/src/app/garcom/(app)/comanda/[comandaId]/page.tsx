"use client";

import { Loader2 } from "lucide-react";
import Link from "next/link";
import { use, useState } from "react";

import { Cabecalho } from "@/components/salao/cabecalho";
import { ErroApi } from "@/lib/cliente";
import { useDetalheComanda } from "@/lib/consultas";
import { cn } from "@/lib/utils";
import { AcoesComanda } from "./_components/acoes-mesa";
import { Conta } from "./_components/conta";
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

  return (
    <div className="min-h-dvh">
      <Cabecalho
        titulo={
          comanda.numero ? `Comanda ${comanda.numero}` : `Mesa ${mesa.numero}`
        }
        subtitulo={`Mesa ${mesa.numero} · ${comanda.titular}`}
        voltarPara={`/garcom/mesa/${mesa.id}`}
        acoes={<AcoesComanda detalhe={detalhe} />}
      />

      <nav className="grid grid-cols-2 border-borda border-b bg-surface">
        {(
          [
            ["pedido", "Novo pedido"],
            ["conta", `Conta${rodadas ? ` (${rodadas})` : ""}`],
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
        <Conta comanda={comanda} />
      ) : (
        <NovoPedido
          comandaId={comanda.id}
          mesaId={mesa.id}
          mesaNumero={mesa.numero}
          mesas={comanda.mesas}
        />
      )}
    </div>
  );
}
