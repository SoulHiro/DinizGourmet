"use client";

import { Loader2 } from "lucide-react";
import { use, useState } from "react";

import { Cabecalho } from "@/components/salao/cabecalho";
import { useDetalheMesa } from "@/lib/consultas";
import { cn } from "@/lib/utils";
import { AcoesMesa } from "./_components/acoes-mesa";
import { Conta } from "./_components/conta";
import { NovoPedido } from "./_components/novo-pedido";

type Aba = "pedido" | "conta";

export default function MesaPage({
  params,
}: {
  params: Promise<{ mesaId: string }>;
}) {
  const { mesaId } = use(params);
  const { data: detalhe, isLoading, isError, refetch } = useDetalheMesa(mesaId);
  const [aba, setAba] = useState<Aba>("pedido");

  if (isLoading || !detalhe) {
    return (
      <div className="min-h-dvh">
        <Cabecalho titulo="Mesa" voltarPara="/garcom" />
        {isError ? (
          <button
            type="button"
            onClick={() => refetch()}
            className="w-full p-6 text-destructive"
          >
            Não foi possível carregar a mesa. Toque para tentar de novo.
          </button>
        ) : (
          <Loader2 className="mx-auto mt-10 size-8 animate-spin text-texto-secundario" />
        )}
      </div>
    );
  }

  const { mesa, comanda } = detalhe;
  const outras =
    comanda?.mesas.filter((m) => m.id !== mesa.id).map((m) => m.numero) ?? [];
  const rodadas = comanda?.rodadas.length ?? 0;

  return (
    <div className="min-h-dvh">
      <Cabecalho
        titulo={`Mesa ${mesa.numero}${outras.length ? ` + ${outras.join(", ")}` : ""}`}
        subtitulo={
          comanda
            ? `Comanda de ${comanda.titular}`
            : "Mesa livre — o primeiro pedido abre a comanda"
        }
        voltarPara="/garcom"
        acoes={<AcoesMesa detalhe={detalhe} />}
      />

      {comanda && (
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
      )}

      {aba === "conta" && comanda ? (
        <Conta comanda={comanda} />
      ) : (
        <NovoPedido
          mesaId={mesa.id}
          mesaNumero={mesa.numero}
          mesas={comanda?.mesas ?? [{ id: mesa.id, numero: mesa.numero }]}
        />
      )}
    </div>
  );
}
