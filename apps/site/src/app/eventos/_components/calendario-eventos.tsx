"use client";

import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { nomeDoMes, partesData } from "@/lib/datas-evento";
import { cn } from "@/lib/utils";

export interface EventoCalendario {
  slug: string;
  titulo: string;
  eventDate: string;
  horario: string;
}

const SEMANA = ["D", "S", "T", "Q", "Q", "S", "S"];

const chaveMes = (ano: number, mes: number) =>
  `${ano}-${String(mes).padStart(2, "0")}`;

// Calendário do mês com os dias de show marcados. Começa no mês do próximo
// evento (ou no mês atual) e navega para trás e para frente.
export const CalendarioEventos = ({
  eventos,
  hoje,
  mesInicial,
}: {
  eventos: EventoCalendario[];
  hoje: string;
  mesInicial: string;
}) => {
  const [ano0, mes0] = mesInicial.split("-").map(Number);
  const [{ ano, mes }, setMes] = useState({ ano: ano0, mes: mes0 });

  const porDia = useMemo(() => {
    const mapa = new Map<string, EventoCalendario[]>();
    for (const e of eventos) {
      mapa.set(e.eventDate, [...(mapa.get(e.eventDate) ?? []), e]);
    }
    return mapa;
  }, [eventos]);

  const prefixo = chaveMes(ano, mes);
  const doMes = eventos.filter((e) => e.eventDate.startsWith(prefixo));
  const primeiroDiaSemana = new Date(Date.UTC(ano, mes - 1, 1)).getUTCDay();
  const diasNoMes = new Date(Date.UTC(ano, mes, 0)).getUTCDate();

  const andar = (delta: number) =>
    setMes(({ ano: a, mes: m }) => {
      const total = a * 12 + (m - 1) + delta;
      return { ano: Math.floor(total / 12), mes: (total % 12) + 1 };
    });

  return (
    <div className="evento-sans grid gap-6 rounded-xl border border-[var(--evento-hairline)] bg-[var(--evento-bg-lift)]/50 p-4 sm:p-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:gap-10">
      <div>
        <div className="mb-4 flex items-center justify-between">
          <button
            type="button"
            onClick={() => andar(-1)}
            aria-label="Mês anterior"
            className="flex size-9 items-center justify-center rounded-full text-[var(--evento-cream-dim)] transition-colors hover:bg-[var(--evento-bg-lift)] hover:text-[var(--evento-cream)]"
          >
            <ChevronLeftIcon className="size-5" />
          </button>
          <p className="text-sm font-bold tracking-[0.2em] text-[var(--evento-cream)] uppercase">
            {nomeDoMes(mes)}{" "}
            <span className="text-[var(--evento-gold)]">{ano}</span>
          </p>
          <button
            type="button"
            onClick={() => andar(1)}
            aria-label="Próximo mês"
            className="flex size-9 items-center justify-center rounded-full text-[var(--evento-cream-dim)] transition-colors hover:bg-[var(--evento-bg-lift)] hover:text-[var(--evento-cream)]"
          >
            <ChevronRightIcon className="size-5" />
          </button>
        </div>

        <div className="grid grid-cols-7 gap-1 text-center">
          {SEMANA.map((d, i) => (
            <span
              // biome-ignore lint/suspicious/noArrayIndexKey: letras repetem (S, Q)
              key={i}
              className="pb-2 text-[11px] font-semibold text-[var(--evento-cream-dim)]/60"
            >
              {d}
            </span>
          ))}
          {Array.from({ length: primeiroDiaSemana }, (_, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: células vazias
            <span key={`v${i}`} />
          ))}
          {Array.from({ length: diasNoMes }, (_, i) => {
            const dia = i + 1;
            const iso = `${prefixo}-${String(dia).padStart(2, "0")}`;
            const doDia = porDia.get(iso);
            const passado = iso < hoje;
            const classe = cn(
              "mx-auto flex size-9 items-center justify-center rounded-full text-sm tabular-nums",
              iso === hoje && "ring-1 ring-[var(--evento-gold)]",
              doDia
                ? passado
                  ? "bg-[var(--evento-cream)]/15 font-bold text-[var(--evento-cream)]"
                  : "bg-[var(--evento-ember)] font-bold text-[var(--evento-cream)] transition-transform hover:scale-110"
                : passado
                  ? "text-[var(--evento-cream-dim)]/35"
                  : "text-[var(--evento-cream-dim)]",
            );
            return doDia ? (
              <Link
                key={iso}
                href={`/eventos/${doDia[0].slug}`}
                title={doDia.map((e) => e.titulo).join(", ")}
                className={classe}
              >
                {dia}
              </Link>
            ) : (
              <span key={iso} className={classe}>
                {dia}
              </span>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col gap-3 md:border-l md:border-[var(--evento-hairline)] md:pl-10">
        <p className="text-xs font-semibold tracking-[0.2em] text-[var(--evento-gold)] uppercase">
          Shows em {nomeDoMes(mes)}
        </p>
        {doMes.length === 0 ? (
          <p className="text-sm text-[var(--evento-cream-dim)]">
            Nenhum show marcado neste mês ainda.
          </p>
        ) : (
          doMes.map((e) => {
            const p = partesData(e.eventDate);
            const passado = e.eventDate < hoje;
            return (
              <Link
                key={e.slug}
                href={`/eventos/${e.slug}`}
                className={cn(
                  "group flex items-center gap-3 rounded-lg p-2 -mx-2 transition-colors hover:bg-[var(--evento-bg-lift)]",
                  passado && "opacity-55",
                )}
              >
                <span className="evento-display w-9 shrink-0 text-center text-2xl text-[var(--evento-cream)]">
                  {String(p.dia).padStart(2, "0")}
                </span>
                <span className="flex min-w-0 flex-col">
                  <span className="truncate font-semibold text-[var(--evento-cream)] group-hover:text-[var(--evento-gold)]">
                    {e.titulo}
                  </span>
                  <span className="text-xs text-[var(--evento-cream-dim)]">
                    {p.diaSemana} · {e.horario}
                  </span>
                </span>
              </Link>
            );
          })
        )}
      </div>
    </div>
  );
};
