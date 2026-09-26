"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Combine, Hand, Loader2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { useFuncionario } from "@/components/providers/sessao";
import { Cabecalho } from "@/components/salao/cabecalho";
import { STATUS_MESA } from "@/components/salao/status-mesa";
import { BotaoTutorial } from "@/components/salao/tutorial";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/cliente";
import { useMapa } from "@/lib/consultas";
import type { MesaMapa, StatusMesa } from "@/lib/dominio/mesas";
import { formatarDuracao, minutosDesde, useAgora } from "@/lib/tempo";
import { cn, formatBRL } from "@/lib/utils";

// Um bloco é uma mesa sozinha ou um grupo de mesas juntas na mesma comanda.
type Bloco = {
  chave: string;
  principal: MesaMapa;
  mesas: MesaMapa[];
  status: StatusMesa;
};

// Bloco de mesas juntas mostra o status mais urgente entre elas (o cliente
// pode ter chamado pelo QR de qualquer uma).
const PRIORIDADE: StatusMesa[] = [
  "conta",
  "chamado",
  "ocupada",
  "aguardando",
  "livre",
];
const statusDoBloco = (mesas: MesaMapa[]) =>
  PRIORIDADE.find((status) => mesas.some((m) => m.status === status)) ??
  "livre";

const COLUNAS_MAX = 3;

const montarBlocos = (mesas: MesaMapa[]): Bloco[] => {
  const porComanda = new Map<string, MesaMapa[]>();
  for (const mesa of mesas) {
    if (mesa.comandaId) {
      const lista = porComanda.get(mesa.comandaId) ?? [];
      lista.push(mesa);
      porComanda.set(mesa.comandaId, lista);
    }
  }
  const blocos: Bloco[] = [];
  const jaUsadas = new Set<string>();
  for (const mesa of mesas) {
    if (jaUsadas.has(mesa.id)) continue;
    const grupo = mesa.comandaId
      ? (porComanda.get(mesa.comandaId) ?? [mesa])
      : [mesa];
    for (const m of grupo) jaUsadas.add(m.id);
    const principal =
      grupo.find((m) => m.mesaPrincipalNumero === m.numero) ?? grupo[0];
    blocos.push({
      chave: mesa.comandaId ?? mesa.id,
      principal,
      mesas: grupo,
      status: statusDoBloco(grupo),
    });
  }
  return blocos;
};

const SEGURAR_MS = 450;

// Toque abre a mesa; segurar entra no modo de seleção (para juntar mesas).
const useToqueLongo = (aoSegurar: () => void, aoTocar: () => void) => {
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const segurou = useRef(false);
  const inicio = useRef({ x: 0, y: 0 });

  const cancelar = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = undefined;
  };

  return {
    onPointerDown: (e: React.PointerEvent) => {
      segurou.current = false;
      inicio.current = { x: e.clientX, y: e.clientY };
      timer.current = setTimeout(() => {
        segurou.current = true;
        navigator.vibrate?.(40);
        aoSegurar();
      }, SEGURAR_MS);
    },
    onPointerMove: (e: React.PointerEvent) => {
      // Rolar a tela não pode virar seleção.
      if (
        Math.abs(e.clientX - inicio.current.x) +
          Math.abs(e.clientY - inicio.current.y) >
        12
      )
        cancelar();
    },
    onPointerUp: cancelar,
    onPointerLeave: cancelar,
    onPointerCancel: cancelar,
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
    onClick: () => {
      if (segurou.current) {
        segurou.current = false;
        return;
      }
      aoTocar();
    },
  };
};

const CardBloco = ({
  bloco,
  agora,
  selecionando,
  selecionado,
  onAbrir,
  onSelecionar,
}: {
  bloco: Bloco;
  agora: number;
  selecionando: boolean;
  selecionado: boolean;
  onAbrir: () => void;
  onSelecionar: () => void;
}) => {
  const { principal, mesas } = bloco;
  const status = STATUS_MESA[bloco.status];
  const juntas = mesas.length > 1;
  const minutos = minutosDesde(
    principal.ultimaRodadaEm ?? principal.abertaEm,
    agora,
  );
  const ajuda = mesas.some((m) => m.ajudaPendente);
  const colunas = Math.min(mesas.length, COLUNAS_MAX);
  const numeros = [principal, ...mesas.filter((m) => m.id !== principal.id)]
    .map((m) => m.numero)
    .join(" + ");

  const toque = useToqueLongo(
    onSelecionar,
    selecionando ? onSelecionar : onAbrir,
  );

  return (
    <button
      type="button"
      {...toque}
      aria-pressed={selecionando ? selecionado : undefined}
      aria-label={`${juntas ? "Mesas" : "Mesa"} ${numeros}, ${status.rotulo}${ajuda ? ", pediu ajuda" : ""}`}
      style={{ gridColumn: `span ${colunas} / span ${colunas}` }}
      className={cn(
        "relative flex min-h-28 select-none flex-col justify-between rounded-xl p-2.5 text-left shadow-sm [-webkit-touch-callout:none] active:scale-[0.97]",
        !juntas && "aspect-square",
        status.classe,
        selecionado && "ring-4 ring-texto ring-offset-2 ring-offset-fundo",
        selecionando && !selecionado && "opacity-60",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="font-bold text-3xl leading-none">{numeros}</span>
        {minutos !== null && (
          <span className="shrink-0 font-semibold text-sm opacity-90">
            {formatarDuracao(minutos)}
          </span>
        )}
      </div>
      <div className="text-sm leading-tight">
        <p className="font-semibold">{status.rotulo}</p>
        {principal.totalCentavos > 0 && (
          <p>{formatBRL(principal.totalCentavos)}</p>
        )}
        {juntas && principal.garcom && (
          <p className="truncate opacity-90">{principal.garcom}</p>
        )}
      </div>
      {ajuda && (
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
  const queryClient = useQueryClient();
  const { data: mesas, isLoading, isError, refetch } = useMapa();
  const agora = useAgora();
  const [selecionados, setSelecionados] = useState<string[]>([]);
  const selecionando = selecionados.length > 0;

  const blocos = useMemo(() => montarBlocos(mesas ?? []), [mesas]);
  const livres = mesas?.filter((m) => m.status === "livre").length ?? 0;

  const alternar = (chave: string) =>
    setSelecionados((atual) =>
      atual.includes(chave)
        ? atual.filter((c) => c !== chave)
        : [...atual, chave],
    );

  const juntar = useMutation({
    mutationFn: () => {
      const escolhidos = selecionados
        .map((chave) => blocos.find((b) => b.chave === chave))
        .filter((b): b is Bloco => Boolean(b));
      // A principal é a que já tem pedido; se nenhuma tem, a primeira marcada.
      const principal =
        escolhidos.find((b) => b.mesas.some((m) => m.totalCentavos > 0)) ??
        escolhidos[0];
      const outras = escolhidos
        .filter((b) => b !== principal)
        .flatMap((b) => b.mesas.map((m) => m.id));
      return api(`/api/mesas/${principal.principal.id}/juntar`, {
        method: "POST",
        json: { mesaIds: outras },
      });
    },
    onSuccess: () => {
      toast.success("Mesas juntadas");
      setSelecionados([]);
      queryClient.invalidateQueries({ queryKey: ["mesas"] });
    },
    onError: (error) => toast.error(error.message),
  });

  return (
    <div className="min-h-dvh pb-[env(safe-area-inset-bottom)]">
      {selecionando ? (
        <header className="sticky top-0 z-30 flex h-[calc(4rem+env(safe-area-inset-top))] items-center gap-2 bg-texto px-2 pt-[env(safe-area-inset-top)] text-fundo">
          <button
            type="button"
            aria-label="Cancelar seleção"
            onClick={() => setSelecionados([])}
            className="flex size-12 items-center justify-center"
          >
            <X />
          </button>
          <p className="flex-1 font-bold text-lg">
            {selecionados.length}{" "}
            {selecionados.length === 1 ? "selecionada" : "selecionadas"}
          </p>
          <Button
            variant="acao"
            disabled={selecionados.length < 2 || juntar.isPending}
            onClick={() => juntar.mutate()}
          >
            {juntar.isPending ? (
              <Loader2 className="animate-spin" />
            ) : (
              <Combine />
            )}{" "}
            Juntar
          </Button>
        </header>
      ) : (
        <Cabecalho
          titulo="Mesas"
          subtitulo={`${funcionario.nome}${mesas ? ` · ${livres} livre(s)` : ""}`}
          acoes={<BotaoTutorial />}
        />
      )}

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
        {selecionando && (
          <p className="mb-3 text-center text-sm text-texto-secundario">
            Toque nas mesas para juntar. Toque de novo para desmarcar.
          </p>
        )}
        {/* dense: blocos de mesas juntas ocupam várias colunas sem deixar buracos */}
        <div className="grid grid-flow-row-dense grid-cols-3 gap-2.5 sm:grid-cols-5 lg:grid-cols-8">
          {blocos.map((bloco) => (
            <CardBloco
              key={bloco.chave}
              bloco={bloco}
              agora={agora}
              selecionando={selecionando}
              selecionado={selecionados.includes(bloco.chave)}
              onAbrir={() => router.push(`/garcom/mesa/${bloco.principal.id}`)}
              onSelecionar={() => alternar(bloco.chave)}
            />
          ))}
        </div>
      </main>
    </div>
  );
}
