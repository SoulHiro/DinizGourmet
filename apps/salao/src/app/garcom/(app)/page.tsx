"use client";

import { Loader2 } from "lucide-react";
import Link from "next/link";

import { useFuncionario } from "@/components/providers/sessao";
import { Cabecalho } from "@/components/salao/cabecalho";
import { STATUS_MESA } from "@/components/salao/status-mesa";
import { useMapa } from "@/lib/consultas";
import type { MesaMapa, StatusMesa } from "@/lib/dominio/mesas";
import { formatarDuracao, minutosDesde, useAgora } from "@/lib/tempo";
import { cn, formatBRL } from "@/lib/utils";

const CardMesa = ({ mesa, agora }: { mesa: MesaMapa; agora: number }) => {
  const status = STATUS_MESA[mesa.status];
  const agrupadaEmOutra =
    mesa.mesaPrincipalNumero !== null &&
    mesa.mesaPrincipalNumero !== mesa.numero;
  const minutos = minutosDesde(mesa.ultimaRodadaEm ?? mesa.abertaEm, agora);

  return (
    <Link
      href={`/garcom/mesa/${mesa.id}`}
      className={cn(
        "flex aspect-square flex-col justify-between rounded-xl p-2.5 shadow-sm active:scale-[0.96]",
        status.classe,
      )}
    >
      <div className="flex items-start justify-between">
        <span className="font-bold text-3xl leading-none">{mesa.numero}</span>
        {minutos !== null && (
          <span className="font-semibold text-sm opacity-90">
            {formatarDuracao(minutos)}
          </span>
        )}
      </div>
      <div className="text-sm leading-tight">
        {agrupadaEmOutra ? (
          <p className="font-semibold">Junto da {mesa.mesaPrincipalNumero}</p>
        ) : (
          <>
            <p className="font-semibold">{status.rotulo}</p>
            {mesa.totalCentavos > 0 && <p>{formatBRL(mesa.totalCentavos)}</p>}
            {mesa.agrupadaCom.length > 0 && (
              <p>+ {mesa.agrupadaCom.join(", ")}</p>
            )}
          </>
        )}
      </div>
    </Link>
  );
};

const LEGENDA: StatusMesa[] = [
  "livre",
  "aguardando",
  "ocupada",
  "chamado",
  "conta",
];

export default function MapaMesasPage() {
  const funcionario = useFuncionario();
  const { data: mesas, isLoading, isError, refetch } = useMapa();
  const agora = useAgora();

  const livres = mesas?.filter((m) => m.status === "livre").length ?? 0;

  return (
    <div className="min-h-dvh pb-[env(safe-area-inset-bottom)]">
      <Cabecalho
        titulo="Mesas"
        subtitulo={`${funcionario.nome}${mesas ? ` · ${livres} livre(s)` : ""}`}
      />

      <main className="p-3">
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
          {mesas?.map((mesa) => (
            <CardMesa key={mesa.id} mesa={mesa} agora={agora} />
          ))}
        </div>

        <ul className="mt-5 flex flex-wrap gap-x-4 gap-y-2 text-sm text-texto-secundario">
          {LEGENDA.map((status) => (
            <li key={status} className="flex items-center gap-1.5">
              <span
                className={cn(
                  "size-3 rounded-full",
                  STATUS_MESA[status].classe,
                )}
              />
              {STATUS_MESA[status].rotulo}
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}
