"use client";

import { useMutation } from "@tanstack/react-query";
import { ChevronRight, Loader2, Receipt, ScanBarcode } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { useChamados } from "@/components/salao/alertas-ajuda";
import { mesaParada, STATUS_MESA } from "@/components/salao/status-mesa";
import { api } from "@/lib/cliente";
import { useComandasDaMesa, useMapa } from "@/lib/consultas";
import { formatarDuracao, minutosDesde, useAgora } from "@/lib/tempo";
import { cn, formatBRL } from "@/lib/utils";
import { PainelConta } from "./painel-conta";

type Selecao =
  | { tipo: "mesa"; mesaId: string }
  | { tipo: "comanda"; comandaId: string };

// Cartões de uma mesa, para o caixa escolher qual conta receber.
const ComandasDaMesa = ({
  mesaId,
  onEscolher,
  onFechar,
}: {
  mesaId: string;
  onEscolher: (comandaId: string) => void;
  onFechar: () => void;
}) => {
  const { data } = useComandasDaMesa(mesaId);
  if (!data) {
    return (
      <Loader2 className="mx-auto mt-6 size-8 animate-spin text-texto-secundario" />
    );
  }
  return (
    <div className="rounded-xl border border-borda bg-surface">
      <div className="flex items-center justify-between border-borda border-b px-4 py-3">
        <h2 className="font-bold text-xl">Mesa {data.mesa.numero}</h2>
        <button
          type="button"
          onClick={onFechar}
          className="text-sm text-texto-secundario underline"
        >
          Fechar
        </button>
      </div>
      {data.comandas.length === 0 ? (
        <p className="p-6 text-center text-texto-secundario">
          Nenhuma comanda aberta nesta mesa.
        </p>
      ) : (
        <ul className="divide-y divide-borda">
          {data.comandas.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => onEscolher(c.id)}
                className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-fundo"
              >
                <span className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-texto font-bold text-fundo text-xl">
                  {c.numero ?? "—"}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-bold">
                    {formatBRL(c.totalCentavos)}
                  </span>
                  <span className="block truncate text-sm text-texto-secundario">
                    {c.titular}
                    {c.pediuConta && " · pediu a conta"}
                  </span>
                </span>
                <ChevronRight className="text-texto-secundario" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

// Visão do salão para o caixa: todas as mesas, quem pediu a conta (na ordem
// de chegada) e, ao lado, os cartões da mesa escolhida e a conta de cada um.
export const SalaoCaixa = () => {
  const { data: mapa = [] } = useMapa();
  const { data: chamados = [] } = useChamados();
  const agora = useAgora(30_000);
  const [selecao, setSelecao] = useState<Selecao | null>(null);
  const [numero, setNumero] = useState("");
  // O caixa só recebe: por padrão mostra só as mesas com gente.
  const [mostrarLivres, setMostrarLivres] = useState(false);
  const campoLeitor = useRef<HTMLInputElement>(null);

  // Leitor sempre pronto: número digitado (ou lido) com o foco fora de um
  // campo vai para a busca do cartão.
  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => {
      const alvo = e.target as HTMLElement | null;
      if (
        alvo &&
        (alvo.tagName === "INPUT" ||
          alvo.tagName === "TEXTAREA" ||
          alvo.tagName === "SELECT" ||
          alvo.isContentEditable)
      )
        return;
      if (/^d$/.test(e.key) && !e.ctrlKey && !e.metaKey && !e.altKey) {
        campoLeitor.current?.focus();
      }
    };
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, []);

  const pedidosConta = chamados.filter(
    (c) => c.tipo === "conta" && c.comandaId,
  );
  const ocupadas = mapa.filter((m) => m.status !== "livre");
  const emAberto = ocupadas.reduce((s, m) => s + m.totalCentavos, 0);
  const comandasAbertas = ocupadas.reduce((s, m) => s + m.comandas.length, 0);

  // Número do cartão digitado ou lido pelo leitor de código de barras.
  const buscar = useMutation({
    mutationFn: (n: string) =>
      api<{ comandaId: string }>(`/api/comandas/numero/${n}`),
    onSuccess: ({ comandaId }) => setSelecao({ tipo: "comanda", comandaId }),
    onError: (error) => toast.error(error.message),
    onSettled: () => setNumero(""),
  });

  const abrirMesa = (mesaId: string) => {
    const mesa = mapa.find((m) => m.id === mesaId);
    // Mesa com um cartão só vai direto para a conta dele.
    if (mesa?.comandas.length === 1) {
      setSelecao({ tipo: "comanda", comandaId: mesa.comandas[0].id });
    } else {
      setSelecao({ tipo: "mesa", mesaId });
    }
  };

  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
      <section className="flex min-w-0 flex-1 flex-col gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <form
            className="flex h-12 w-64 items-center gap-2 rounded-lg border border-borda bg-surface px-3 focus-within:ring-2 focus-within:ring-acao"
            onSubmit={(e) => {
              e.preventDefault();
              if (numero) buscar.mutate(numero);
            }}
          >
            <ScanBarcode className="size-4 text-texto-secundario" />
            <input
              ref={campoLeitor}
              // biome-ignore lint/a11y/noAutofocus: no caixa o fluxo é passar o leitor no cartão
              autoFocus
              aria-label="Comanda pelo número do cartão"
              inputMode="numeric"
              placeholder="Comanda nº (ou passe o leitor)"
              value={numero}
              onChange={(e) => setNumero(e.target.value.replace(/\D/g, ""))}
              className="h-full min-w-0 flex-1 bg-transparent outline-none"
            />
          </form>
          <p className="text-texto-secundario">
            <strong className="text-texto">{comandasAbertas}</strong>{" "}
            {comandasAbertas === 1 ? "comanda aberta" : "comandas abertas"} ·{" "}
            <strong className="text-texto">{formatBRL(emAberto)}</strong> em
            aberto
          </p>
          <button
            type="button"
            aria-pressed={mostrarLivres}
            onClick={() => setMostrarLivres((v) => !v)}
            className={cn(
              "ml-auto flex h-10 items-center gap-2 rounded-full border px-3 font-semibold text-sm",
              mostrarLivres
                ? "border-texto bg-texto text-fundo"
                : "border-borda bg-surface text-texto-secundario",
            )}
          >
            <span className="size-2.5 rounded-full bg-status-livre" />
            {mostrarLivres
              ? "Esconder livres"
              : `Mostrar livres (${mapa.length - ocupadas.length})`}
          </button>
        </div>

        {pedidosConta.length > 0 && (
          <div className="rounded-xl border-2 border-status-conta bg-status-conta/10 p-3">
            <p className="mb-2 flex items-center gap-2 font-bold">
              <Receipt className="size-5" /> Pediram a conta
            </p>
            <div className="flex flex-wrap gap-2">
              {pedidosConta.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() =>
                    c.comandaId &&
                    setSelecao({ tipo: "comanda", comandaId: c.comandaId })
                  }
                  className={cn(
                    "flex flex-col items-start rounded-lg bg-status-conta px-3 py-2 text-left text-white",
                    (minutosDesde(c.criadoEm, agora) ?? 0) >= 5 &&
                      "animate-pulse ring-2 ring-white/70",
                  )}
                >
                  <span className="font-bold">
                    {c.comandaNumero
                      ? `Comanda ${c.comandaNumero} · Mesa ${c.mesaNumero}`
                      : `Mesa ${c.mesaNumero}`}
                  </span>
                  <span className="text-sm">
                    {c.conta ? formatBRL(c.conta.totalCentavos) : ""} ·{" "}
                    esperando há{" "}
                    {formatarDuracao(minutosDesde(c.criadoEm, agora))}
                    {c.aceitoPor ? ` · ${c.aceitoPor} indo` : ""}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 xl:grid-cols-6">
          {(mostrarLivres ? mapa : ocupadas).map((m) => {
            const status = STATUS_MESA[m.status];
            const ativa = selecao?.tipo === "mesa" && selecao.mesaId === m.id;
            const parada = mesaParada(m, agora);
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => abrirMesa(m.id)}
                className={cn(
                  "relative flex min-h-28 flex-col overflow-hidden rounded-xl border-2 bg-surface p-2 pl-3.5 text-left transition-shadow",
                  ativa ? "border-acao shadow-lg" : "border-borda",
                  parada && "ring-2 ring-status-aguardando",
                )}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    "absolute inset-y-0 left-0 w-1.5",
                    status.classe,
                  )}
                />
                <span className="flex items-center justify-between gap-1">
                  <span className="font-bold text-2xl">{m.numero}</span>
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 font-semibold text-xs",
                      status.classe,
                    )}
                  >
                    {status.rotulo}
                  </span>
                </span>
                {m.status !== "livre" && (
                  <>
                    <span className="mt-auto font-bold text-lg">
                      {formatBRL(m.totalCentavos)}
                    </span>
                    <span className="truncate text-texto-secundario text-xs">
                      {m.comandas.length > 1
                        ? `${m.comandas.length} comandas`
                        : m.garcons.join(", ")}{" "}
                      · {parada ? "sem pedido há " : ""}
                      {formatarDuracao(
                        minutosDesde(m.ultimaRodadaEm ?? m.abertaEm, agora),
                      )}
                    </span>
                  </>
                )}
              </button>
            );
          })}
        </div>
      </section>

      <aside className="w-full shrink-0 lg:sticky lg:top-20 lg:w-[460px]">
        {selecao?.tipo === "comanda" ? (
          <PainelConta
            key={selecao.comandaId}
            comandaId={selecao.comandaId}
            onFechar={() => setSelecao(null)}
          />
        ) : selecao?.tipo === "mesa" ? (
          <ComandasDaMesa
            mesaId={selecao.mesaId}
            onEscolher={(comandaId) =>
              setSelecao({ tipo: "comanda", comandaId })
            }
            onFechar={() => setSelecao(null)}
          />
        ) : (
          <div className="rounded-xl border border-borda border-dashed p-8 text-center text-texto-secundario">
            Passe o leitor no cartão (ou digite o número e Enter), ou toque numa
            mesa para ver as comandas dela.
          </div>
        )}
      </aside>
    </div>
  );
};
