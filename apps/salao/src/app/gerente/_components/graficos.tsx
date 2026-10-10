"use client";

import { useState } from "react";

import { cn, formatBRL } from "@/lib/utils";

// Gráficos leves do painel, sem biblioteca: barras em HTML e rosca em SVG.
// Cores das séries em --serie-N (globals.css), validadas para daltonismo.

export const COR_SERIE = [1, 2, 3, 4, 5, 6].map((n) => `var(--serie-${n})`);

// R$ curto para eixo e rótulo: 1.234 -> "1,2 mil".
export const reaisCurto = (centavos: number) => {
  const reais = centavos / 100;
  if (reais >= 1000)
    return `${(reais / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mil`;
  return reais.toLocaleString("pt-BR", { maximumFractionDigits: 0 });
};

// Vendas por hora ou por noite: uma série, barras finas com topo
// arredondado. O pico leva rótulo fixo; as outras mostram o valor ao passar
// o dedo/mouse. "atual" destaca o rótulo (hora de agora, noite de hoje).
export const BarrasVerticais = ({
  dados,
  atual,
}: {
  dados: { chave: string; rotulo: string; centavos: number }[];
  atual?: string | null;
}) => {
  const [foco, setFoco] = useState<string | null>(null);
  const maximo = Math.max(...dados.map((d) => d.centavos), 1);
  const pico = dados.reduce(
    (m, d) => (d.centavos > m.centavos ? d : m),
    dados[0] ?? { chave: "", rotulo: "", centavos: 0 },
  );

  return (
    <div
      className={cn(
        "flex h-56 items-end pt-6 lg:h-80",
        dados.length > 14 ? "gap-0.5" : "gap-1.5",
      )}
    >
      {dados.map((d, i) => {
        // Muitas barras (30 noites): rótulo só a cada 3, para não embolar.
        const rotulo =
          dados.length > 14 && i % 3 !== 0 && d.chave !== atual
            ? " "
            : d.rotulo;
        const altura = (d.centavos / maximo) * 100;
        const mostrar =
          foco === d.chave || (foco === null && d === pico && d.centavos > 0);
        return (
          <button
            key={d.chave}
            type="button"
            aria-label={`${d.rotulo}: ${formatBRL(d.centavos)}`}
            onMouseEnter={() => setFoco(d.chave)}
            onMouseLeave={() => setFoco(null)}
            onFocus={() => setFoco(d.chave)}
            onBlur={() => setFoco(null)}
            onClick={() => setFoco((f) => (f === d.chave ? null : d.chave))}
            className="group relative flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1.5 outline-none"
          >
            <div className="relative flex w-full flex-1 items-end justify-center">
              {mostrar && (
                <span
                  className="-translate-x-1/2 absolute left-1/2 z-10 whitespace-nowrap rounded-md bg-texto px-1.5 py-0.5 font-bold text-[11px] text-fundo tabular-nums shadow"
                  style={{ bottom: `calc(${altura}% + 6px)` }}
                >
                  {formatBRL(d.centavos)}
                </span>
              )}
              <div
                className={cn(
                  "w-full max-w-9 rounded-t-[4px] transition-[height,opacity] duration-500",
                  d.centavos === 0 ? "bg-borda" : "bg-acao",
                  foco !== null && foco !== d.chave && "opacity-40",
                )}
                style={{ height: `${Math.max(altura, d.centavos ? 3 : 1.5)}%` }}
              />
            </div>
            <span
              className={cn(
                "text-[11px] tabular-nums",
                d.chave === atual
                  ? "rounded-full bg-acao/15 px-1 font-bold text-acao"
                  : "text-texto-secundario",
              )}
            >
              {rotulo}
            </span>
          </button>
        );
      })}
    </div>
  );
};

// Rosca com respiro de 2px entre fatias e total no meio.
export const Rosca = ({
  fatias,
  centro,
  subtitulo,
}: {
  fatias: { rotulo: string; valor: number; cor: string }[];
  centro: string;
  subtitulo: string;
}) => {
  const [foco, setFoco] = useState<number | null>(null);
  const total = fatias.reduce((s, f) => s + f.valor, 0);
  const raio = 42;
  const circ = 2 * Math.PI * raio;
  const respiro = fatias.length > 1 ? 1.2 : 0;
  let acumulado = 0;

  return (
    <div className="relative mx-auto aspect-square w-full max-w-52">
      <svg
        viewBox="0 0 100 100"
        className="-rotate-90 size-full"
        aria-hidden="true"
      >
        <circle
          cx="50"
          cy="50"
          r={raio}
          fill="none"
          stroke="var(--border)"
          strokeWidth="12"
        />
        {total > 0 &&
          fatias.map((f, i) => {
            const fracao = f.valor / total;
            const tamanho = Math.max(fracao * circ - respiro, 0.5);
            const deslocamento = -acumulado * circ;
            acumulado += fracao;
            return (
              // biome-ignore lint/a11y/noStaticElementInteractions: destaque visual; os valores estão na legenda ao lado
              <circle
                key={f.rotulo}
                cx="50"
                cy="50"
                r={raio}
                fill="none"
                stroke={f.cor}
                strokeWidth={foco === i ? 15 : 12}
                strokeDasharray={`${tamanho} ${circ - tamanho}`}
                strokeDashoffset={deslocamento}
                className="transition-[stroke-width,opacity] duration-200"
                opacity={foco !== null && foco !== i ? 0.35 : 1}
                onMouseEnter={() => setFoco(i)}
                onMouseLeave={() => setFoco(null)}
              />
            );
          })}
      </svg>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="font-bold text-xl tabular-nums leading-tight">
          {foco !== null ? formatBRL(fatias[foco].valor) : centro}
        </span>
        <span className="max-w-24 truncate text-texto-secundario text-xs">
          {foco !== null ? fatias[foco].rotulo : subtitulo}
        </span>
      </div>
    </div>
  );
};

// Ranking em barras horizontais (uma cor só: o que importa é o tamanho).
export const BarrasHorizontais = ({
  itens,
}: {
  itens: {
    chave: string;
    rotulo: React.ReactNode;
    valor: number;
    texto: string;
    detalhe?: string;
  }[];
}) => {
  const maximo = Math.max(...itens.map((i) => i.valor), 1);
  return (
    <ul className="flex flex-col gap-3">
      {itens.map((i) => (
        <li key={i.chave} className="flex flex-col gap-1">
          <div className="flex items-baseline justify-between gap-2 text-sm">
            <span className="min-w-0 truncate font-semibold">{i.rotulo}</span>
            <span className="shrink-0 tabular-nums">
              <strong>{i.texto}</strong>
              {i.detalhe && (
                <span className="ml-1.5 text-texto-secundario text-xs">
                  {i.detalhe}
                </span>
              )}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-borda/60">
            <div
              className="h-full rounded-full bg-acao transition-[width] duration-500"
              style={{ width: `${(i.valor / maximo) * 100}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
};
