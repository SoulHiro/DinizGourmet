"use client";

import { Receipt, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { useChamados } from "@/components/salao/alertas-ajuda";
import { STATUS_MESA } from "@/components/salao/status-mesa";
import { useMapa } from "@/lib/consultas";
import { formatarDuracao, minutosDesde, useAgora } from "@/lib/tempo";
import { cn, formatBRL } from "@/lib/utils";
import { PainelConta } from "./painel-conta";

// Visão do salão para o caixa: todas as mesas, quem pediu a conta (na ordem
// de chegada) e a conta da mesa escolhida ao lado.
export const SalaoCaixa = () => {
  const { data: mapa = [] } = useMapa();
  const { data: chamados = [] } = useChamados();
  const agora = useAgora(30_000);
  const [selecionada, setSelecionada] = useState<string | null>(null);
  const [busca, setBusca] = useState("");

  // Mesa agrupada abre a conta pela principal.
  const principalDe = (mesaId: string) => {
    const mesa = mapa.find((m) => m.id === mesaId);
    if (!mesa?.mesaPrincipalNumero || mesa.mesaPrincipalNumero === mesa.numero)
      return mesaId;
    return (
      mapa.find((m) => m.numero === mesa.mesaPrincipalNumero)?.id ?? mesaId
    );
  };
  const abrir = (mesaId: string) => setSelecionada(principalDe(mesaId));

  const pedidosConta = chamados.filter((c) => c.tipo === "conta");
  // Agrupadas somem do grid: aparecem no card da principal.
  const visiveis = mapa.filter(
    (m) => !m.mesaPrincipalNumero || m.mesaPrincipalNumero === m.numero,
  );
  const ocupadas = visiveis.filter((m) => m.status !== "livre");
  const emAberto = useMemo(
    () => ocupadas.reduce((s, m) => s + m.totalCentavos, 0),
    [ocupadas],
  );

  const buscarMesa = () => {
    const numero = Number(busca);
    const mesa = mapa.find((m) => m.numero === numero);
    if (!mesa) {
      toast.error(`Mesa ${busca} não existe`);
      return;
    }
    abrir(mesa.id);
    setBusca("");
  };

  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
      <section className="flex min-w-0 flex-1 flex-col gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <form
            className="flex h-12 w-44 items-center gap-2 rounded-lg border border-borda bg-surface px-3 focus-within:ring-2 focus-within:ring-acao"
            onSubmit={(e) => {
              e.preventDefault();
              buscarMesa();
            }}
          >
            <Search className="size-4 text-texto-secundario" />
            <input
              // biome-ignore lint/a11y/noAutofocus: no caixa o fluxo é digitar o número da mesa e Enter
              autoFocus
              inputMode="numeric"
              placeholder="Mesa nº + Enter"
              value={busca}
              onChange={(e) => setBusca(e.target.value.replace(/\D/g, ""))}
              className="h-full min-w-0 flex-1 bg-transparent outline-none"
            />
          </form>
          <p className="text-texto-secundario">
            <strong className="text-texto">{ocupadas.length}</strong> mesas
            ocupadas ·{" "}
            <strong className="text-texto">{formatBRL(emAberto)}</strong> em
            aberto
          </p>
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
                  onClick={() => abrir(c.mesaId)}
                  className="flex flex-col items-start rounded-lg bg-status-conta px-3 py-2 text-left text-white"
                >
                  <span className="font-bold">Mesa {c.mesaNumero}</span>
                  <span className="text-sm">
                    {c.conta ? formatBRL(c.conta.totalCentavos) : ""} ·{" "}
                    {formatarDuracao(minutosDesde(c.criadoEm, agora))}
                    {c.aceitoPor ? ` · ${c.aceitoPor} indo` : ""}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 xl:grid-cols-6">
          {visiveis.map((m) => {
            const status = STATUS_MESA[m.status];
            const ativa = selecionada === m.id;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => abrir(m.id)}
                className={cn(
                  "flex min-h-28 flex-col rounded-xl border-2 bg-surface p-2 text-left transition-shadow",
                  ativa ? "border-acao shadow-lg" : "border-borda",
                )}
              >
                <span className="flex items-center justify-between gap-1">
                  <span className="font-bold text-2xl">
                    {m.numero}
                    {m.agrupadaCom.length > 0 && (
                      <span className="font-semibold text-sm text-texto-secundario">
                        {" "}
                        +{m.agrupadaCom.join(", ")}
                      </span>
                    )}
                  </span>
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
                      {m.garcom} ·{" "}
                      {formatarDuracao(minutosDesde(m.abertaEm, agora))}
                    </span>
                  </>
                )}
              </button>
            );
          })}
        </div>
      </section>

      <aside className="w-full shrink-0 lg:sticky lg:top-20 lg:w-[460px]">
        {selecionada ? (
          <PainelConta
            key={selecionada}
            mesaId={selecionada}
            onFechar={() => setSelecionada(null)}
          />
        ) : (
          <div className="rounded-xl border border-borda border-dashed p-8 text-center text-texto-secundario">
            Toque numa mesa (ou digite o número e Enter) para ver a conta,
            imprimir ou receber.
          </div>
        )}
      </aside>
    </div>
  );
};
