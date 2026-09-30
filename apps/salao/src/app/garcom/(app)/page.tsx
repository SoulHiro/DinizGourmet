"use client";

import { useMutation } from "@tanstack/react-query";
import { Hand, Loader2, ScanBarcode } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { useFuncionario } from "@/components/providers/sessao";
import { Cabecalho } from "@/components/salao/cabecalho";
import { STATUS_MESA } from "@/components/salao/status-mesa";
import { BotaoTutorial } from "@/components/salao/tutorial";
import { api } from "@/lib/cliente";
import { useMapa } from "@/lib/consultas";
import type { MesaMapa } from "@/lib/dominio/mesas";
import { formatarDuracao, minutosDesde, useAgora } from "@/lib/tempo";
import { cn, formatBRL } from "@/lib/utils";

const CardMesa = ({
  mesa,
  agora,
  onAbrir,
}: {
  mesa: MesaMapa;
  agora: number;
  onAbrir: () => void;
}) => {
  const status = STATUS_MESA[mesa.status];
  const minutos = minutosDesde(mesa.ultimaRodadaEm ?? mesa.abertaEm, agora);
  const qtd = mesa.comandas.length;
  const cartoes = mesa.comandas
    .map((c) => c.numero)
    .filter((n): n is number => n !== null);

  return (
    <button
      type="button"
      onClick={onAbrir}
      aria-label={`Mesa ${mesa.numero}, ${status.rotulo}${qtd ? `, ${qtd} comandas` : ""}${mesa.ajudaPendente ? ", pediu ajuda" : ""}`}
      className={cn(
        "relative flex aspect-square min-h-28 flex-col justify-between rounded-xl p-2.5 text-left shadow-sm active:scale-[0.97]",
        status.classe,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="font-bold text-3xl leading-none">{mesa.numero}</span>
        {minutos !== null && (
          <span className="shrink-0 font-semibold text-sm opacity-90">
            {formatarDuracao(minutos)}
          </span>
        )}
      </div>
      <div className="text-sm leading-tight">
        <p className="font-semibold">{status.rotulo}</p>
        {mesa.totalCentavos > 0 && <p>{formatBRL(mesa.totalCentavos)}</p>}
        {qtd > 1 ? (
          <p className="truncate opacity-90">
            {qtd} comandas{cartoes.length ? ` · ${cartoes.join(", ")}` : ""}
          </p>
        ) : (
          cartoes.length === 1 && (
            <p className="truncate opacity-90">Cartão {cartoes[0]}</p>
          )
        )}
      </div>
      {mesa.ajudaPendente && (
        <span className="-top-2 -right-2 absolute flex size-9 items-center justify-center rounded-full bg-status-chamado text-black shadow-md ring-2 ring-fundo">
          <Hand className="size-5" />
        </span>
      )}
    </button>
  );
};

export default function MapaMesasPage() {
  const funcionario = useFuncionario();
  const router = useRouter();
  const { data: mesas, isLoading, isError, refetch } = useMapa();
  const agora = useAgora();
  const [numero, setNumero] = useState("");
  const livres = mesas?.filter((m) => m.status === "livre").length ?? 0;

  // Número do cartão (digitado ou lido no código de barras) vai direto para
  // a comanda.
  const buscar = useMutation({
    mutationFn: (n: string) =>
      api<{ comandaId: string }>(`/api/comandas/numero/${n}`),
    onSuccess: ({ comandaId }) => router.push(`/garcom/comanda/${comandaId}`),
    onError: (error) => toast.error(error.message),
    onSettled: () => setNumero(""),
  });

  return (
    <div className="min-h-dvh pb-[env(safe-area-inset-bottom)]">
      <Cabecalho
        titulo="Mesas"
        subtitulo={`${funcionario.nome}${mesas ? ` · ${livres} livre(s)` : ""}`}
        acoes={<BotaoTutorial />}
      />

      <main className="flex flex-col gap-3 p-3">
        <form
          className="flex h-12 items-center gap-2 rounded-xl border border-borda bg-surface px-3 focus-within:ring-2 focus-within:ring-acao"
          onSubmit={(e) => {
            e.preventDefault();
            if (numero) buscar.mutate(numero);
          }}
        >
          <ScanBarcode className="size-5 text-texto-secundario" />
          <input
            aria-label="Ir para a comanda pelo número do cartão"
            inputMode="numeric"
            placeholder="Comanda nº (ou passe o leitor)"
            value={numero}
            onChange={(e) => setNumero(e.target.value.replace(/\D/g, ""))}
            className="h-full min-w-0 flex-1 bg-transparent outline-none"
          />
          {buscar.isPending && (
            <Loader2 className="size-5 animate-spin text-texto-secundario" />
          )}
        </form>

        {isLoading && (
          <Loader2 className="mx-auto mt-10 size-8 animate-spin text-texto-secundario" />
        )}
        {isError && (
          <button
            type="button"
            onClick={() => refetch()}
            className="w-full p-6 text-center text-destructive"
          >
            Não foi possível carregar as mesas. Toque para tentar de novo.
          </button>
        )}
        <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-5 lg:grid-cols-8">
          {(mesas ?? []).map((mesa) => (
            <CardMesa
              key={mesa.id}
              mesa={mesa}
              agora={agora}
              onAbrir={() => router.push(`/garcom/mesa/${mesa.id}`)}
            />
          ))}
        </div>
      </main>
    </div>
  );
}
