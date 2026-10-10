"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ChevronRight, Loader2, Plus, Receipt } from "lucide-react";
import { useRouter } from "next/navigation";
import { use, useState } from "react";
import { toast } from "sonner";

import { Cabecalho } from "@/components/salao/cabecalho";
import { Button } from "@/components/ui/button";
import { api, ErroApi } from "@/lib/cliente";
import { useComandasDaMesa } from "@/lib/consultas";
import { formatarDuracao, minutosDesde, useAgora } from "@/lib/tempo";
import { formatBRL } from "@/lib/utils";

// Tela da mesa: os cartões (comandas) que estão nela e a abertura de uma
// comanda nova. Cada pessoa ou casal que paga separado tem o seu cartão.
export default function MesaPage({
  params,
}: {
  params: Promise<{ mesaId: string }>;
}) {
  const { mesaId } = use(params);
  const router = useRouter();
  const queryClient = useQueryClient();
  const agora = useAgora(30_000);
  const { data, isLoading, isError, refetch } = useComandasDaMesa(mesaId);
  const [numero, setNumero] = useState("");

  const abrir = useMutation({
    mutationFn: () =>
      api<{ comandaId: string }>("/api/comandas", {
        method: "POST",
        json: { mesaId, numero: Number(numero) },
      }),
    onSuccess: ({ comandaId }) => {
      queryClient.invalidateQueries({ queryKey: ["mesas"] });
      router.push(`/garcom/comanda/${comandaId}`);
    },
    onError: (error) => {
      // Cartão aberto em outra mesa: oferece ir até ele.
      const aberta =
        error instanceof ErroApi && error.codigo === "cartao_em_uso"
          ? (error.detalhes as { comandaId?: string } | undefined)
          : undefined;
      toast.error(error.message, {
        action: aberta?.comandaId
          ? {
              label: "Abrir",
              onClick: () => router.push(`/garcom/comanda/${aberta.comandaId}`),
            }
          : undefined,
      });
      setNumero("");
    },
  });

  if (isLoading || !data) {
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

  const { mesa, comandas } = data;
  const total = comandas.reduce((s, c) => s + c.totalCentavos, 0);

  return (
    <div className="min-h-dvh pb-10">
      <Cabecalho
        titulo={`Mesa ${mesa.numero}`}
        subtitulo={
          comandas.length
            ? `${comandas.length} ${comandas.length === 1 ? "comanda" : "comandas"} · ${formatBRL(total)}`
            : "Livre"
        }
        voltarPara="/garcom"
      />

      <main className="mx-auto flex max-w-xl flex-col gap-4 p-3">
        <form
          className="flex flex-col gap-2 rounded-xl border-2 border-acao/40 bg-surface p-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (numero) abrir.mutate();
          }}
        >
          <label htmlFor="numero-cartao" className="font-semibold">
            Abrir comanda{" "}
            <span className="font-normal text-sm text-texto-secundario">
              · um cartão por quem paga separado
            </span>
          </label>
          <div className="flex gap-2">
            <input
              id="numero-cartao"
              // biome-ignore lint/a11y/noAutofocus: o fluxo é passar o leitor no cartão assim que a mesa abre
              autoFocus={comandas.length === 0}
              inputMode="numeric"
              placeholder="Nº do cartão"
              value={numero}
              onChange={(e) => setNumero(e.target.value.replace(/\D/g, ""))}
              className="h-14 min-w-0 flex-1 rounded-lg border border-borda bg-fundo px-4 font-bold text-2xl"
            />
            <Button
              type="submit"
              variant="acao"
              size="lg"
              disabled={!numero || abrir.isPending}
            >
              {abrir.isPending ? (
                <Loader2 className="animate-spin" />
              ) : (
                <Plus />
              )}
              Abrir
            </Button>
          </div>
        </form>

        {comandas.length === 0 ? (
          <p className="p-6 text-center text-texto-secundario">
            Nenhuma comanda aberta nesta mesa.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {comandas.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => router.push(`/garcom/comanda/${c.id}`)}
                  className="flex w-full items-center gap-3 rounded-xl border border-borda bg-surface p-3 text-left active:scale-[0.99]"
                >
                  <span className="flex size-16 shrink-0 flex-col items-center justify-center rounded-lg bg-texto text-fundo">
                    <span className="text-[10px] uppercase leading-none">
                      Cartão
                    </span>
                    <span className="font-bold text-2xl leading-tight">
                      {c.numero ?? "—"}
                    </span>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-bold text-xl">
                      {formatBRL(c.totalCentavos)}
                    </span>
                    <span className="block truncate text-sm text-texto-secundario">
                      {c.titular} ·{" "}
                      {c.rodadas
                        ? `${c.rodadas} ${c.rodadas === 1 ? "pedido" : "pedidos"}`
                        : "sem pedido"}{" "}
                      · {formatarDuracao(minutosDesde(c.abertaEm, agora))}
                    </span>
                    {c.resumo && (
                      <span className="mt-0.5 line-clamp-2 block text-sm">
                        {c.resumo}
                      </span>
                    )}
                    {c.pediuConta && (
                      <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-status-conta px-2 py-0.5 font-semibold text-white text-xs">
                        <Receipt className="size-3" /> Pediu a conta
                      </span>
                    )}
                  </span>
                  <ChevronRight className="shrink-0 text-texto-secundario" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
