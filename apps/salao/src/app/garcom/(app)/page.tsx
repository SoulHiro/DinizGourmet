"use client";

import { useMutation } from "@tanstack/react-query";
import {
  Clock,
  Hand,
  Loader2,
  ScanBarcode,
  Timer,
  User,
  Users,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { useFuncionario } from "@/components/providers/sessao";
import { BotaoAvisos } from "@/components/salao/botao-avisos";
import { Cabecalho } from "@/components/salao/cabecalho";
import { mesaParada, STATUS_MESA } from "@/components/salao/status-mesa";
import { BotaoTutorial } from "@/components/salao/tutorial";
import { api } from "@/lib/cliente";
import { useMapa } from "@/lib/consultas";
import type { MesaMapa, StatusMesa } from "@/lib/dominio/mesas";
import { formatarDuracao, minutosDesde, useAgora } from "@/lib/tempo";
import { cn, formatBRL } from "@/lib/utils";

type Filtro = StatusMesa | "parada" | null;

const parada = mesaParada;

const CardMesa = ({
  mesa,
  agora,
  minha,
  onAbrir,
}: {
  mesa: MesaMapa;
  agora: number;
  minha: boolean;
  onAbrir: () => void;
}) => {
  const status = STATUS_MESA[mesa.status];
  const desdeUltimo = minutosDesde(mesa.ultimaRodadaEm ?? mesa.abertaEm, agora);
  const estaParada = parada(mesa, agora);
  const qtd = mesa.comandas.length;
  const cartoes = mesa.comandas
    .map((c) => c.numero)
    .filter((n): n is number => n !== null);

  return (
    <button
      type="button"
      onClick={onAbrir}
      aria-label={`Mesa ${mesa.numero}, ${status.rotulo}${qtd ? `, ${qtd} comandas` : ""}${mesa.ajudaPendente ? ", pediu ajuda" : ""}${estaParada ? ", sem pedido há muito tempo" : ""}`}
      className={cn(
        "relative flex aspect-square min-h-28 flex-col justify-between rounded-xl p-2.5 text-left shadow-sm active:scale-[0.97]",
        status.classe,
        estaParada &&
          "ring-4 ring-status-aguardando ring-offset-2 ring-offset-fundo",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="font-bold text-3xl leading-none">{mesa.numero}</span>
        {desdeUltimo !== null && (
          <span
            title={
              mesa.ultimaRodadaEm
                ? "Tempo desde o último pedido"
                : "Tempo desde que a mesa abriu"
            }
            className={cn(
              "flex shrink-0 items-center gap-0.5 font-semibold text-sm",
              estaParada ? "rounded-full bg-black/25 px-1.5" : "opacity-90",
            )}
          >
            {estaParada ? (
              <Timer className="size-3.5" />
            ) : (
              <Clock className="size-3.5" />
            )}
            {formatarDuracao(desdeUltimo)}
          </span>
        )}
      </div>
      <div className="text-sm leading-tight">
        <p className="font-semibold">
          {estaParada ? "Sem pedido" : status.rotulo}
        </p>
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
      {minha && (
        <span
          title="Você atende esta mesa"
          className="absolute bottom-2 right-2 flex size-6 items-center justify-center rounded-full bg-black/25"
        >
          <User className="size-3.5" />
        </span>
      )}
      {mesa.ajudaPendente && (
        <span className="-top-2 -right-2 absolute flex size-9 items-center justify-center rounded-full bg-status-chamado text-black shadow-md ring-2 ring-fundo">
          <Hand className="size-5" />
        </span>
      )}
    </button>
  );
};

const ORDEM_RESUMO: {
  valor: Exclude<Filtro, null>;
  rotulo: string;
  cor: string;
}[] = [
  { valor: "conta", rotulo: "Pediram conta", cor: "bg-status-conta" },
  { valor: "chamado", rotulo: "Chamaram", cor: "bg-status-chamado" },
  { valor: "parada", rotulo: "Sem pedido", cor: "bg-status-aguardando" },
  { valor: "aguardando", rotulo: "Aguardando", cor: "bg-status-aguardando" },
  { valor: "ocupada", rotulo: "Ocupadas", cor: "bg-status-ocupada" },
  { valor: "livre", rotulo: "Livres", cor: "bg-status-livre" },
];

export default function MapaMesasPage() {
  const funcionario = useFuncionario();
  const router = useRouter();
  const { data: mesas, isLoading, isError, refetch } = useMapa();
  const agora = useAgora();
  const [numero, setNumero] = useState("");
  const [filtro, setFiltro] = useState<Filtro>(null);
  // "Minhas" mostra as mesas que eu atendo (titular ou auxiliar) e as livres,
  // para dar para abrir mesa nova. Lembrado neste celular.
  const chaveFiltro = `mapa:so-minhas:${funcionario.id}`;
  const [soMinhas, setSoMinhas] = useState(false);
  useEffect(() => {
    try {
      setSoMinhas(localStorage.getItem(chaveFiltro) === "1");
    } catch {}
  }, [chaveFiltro]);
  const alternarMinhas = () =>
    setSoMinhas((atual) => {
      try {
        localStorage.setItem(chaveFiltro, atual ? "0" : "1");
      } catch {}
      return !atual;
    });

  const buscar = useMutation({
    mutationFn: (n: string) =>
      api<{ comandaId: string }>(`/api/comandas/numero/${n}`),
    onSuccess: ({ comandaId }) => router.push(`/garcom/comanda/${comandaId}`),
    onError: (error) => toast.error(error.message),
    onSettled: () => setNumero(""),
  });

  const todas = mesas ?? [];
  const minha = (m: MesaMapa) => m.garcomIds.includes(funcionario.id);
  const base = soMinhas
    ? todas.filter((m) => minha(m) || m.status === "livre")
    : todas;
  const contar = (f: Exclude<Filtro, null>) =>
    base.filter((m) =>
      f === "parada" ? parada(m, agora) : m.status === f && !parada(m, agora),
    ).length;
  const visiveis = filtro
    ? base.filter((m) =>
        filtro === "parada"
          ? parada(m, agora)
          : m.status === filtro && !parada(m, agora),
      )
    : base;
  const minhasQtd = todas.filter(minha).length;
  const livres = todas.filter((m) => m.status === "livre").length;

  return (
    <div className="min-h-dvh pb-[env(safe-area-inset-bottom)]">
      <Cabecalho
        titulo="Mesas"
        subtitulo={`${funcionario.nome}${mesas ? ` · ${livres} livre(s)` : ""}`}
        acoes={
          <>
            <BotaoAvisos />
            <BotaoTutorial />
          </>
        }
      />

      <main className="flex flex-col gap-3 p-3">
        <div className="flex gap-2">
          <form
            className="flex h-12 min-w-0 flex-1 items-center gap-2 rounded-xl border border-borda bg-surface px-3 focus-within:ring-2 focus-within:ring-acao"
            onSubmit={(e) => {
              e.preventDefault();
              if (numero) buscar.mutate(numero);
            }}
          >
            <ScanBarcode className="size-5 shrink-0 text-texto-secundario" />
            <input
              aria-label="Ir para a comanda pelo número do cartão"
              inputMode="numeric"
              placeholder="Comanda nº ou leitor"
              value={numero}
              onChange={(e) => setNumero(e.target.value.replace(/\D/g, ""))}
              className="h-full min-w-0 flex-1 bg-transparent outline-none"
            />
            {buscar.isPending && (
              <Loader2 className="size-5 animate-spin text-texto-secundario" />
            )}
          </form>
          <button
            type="button"
            aria-pressed={soMinhas}
            onClick={alternarMinhas}
            className={cn(
              "flex h-12 shrink-0 items-center gap-2 rounded-xl border px-3 font-semibold text-sm",
              soMinhas
                ? "border-acao bg-acao text-acao-foreground"
                : "border-borda bg-surface",
            )}
          >
            {soMinhas ? (
              <User className="size-5" />
            ) : (
              <Users className="size-5" />
            )}
            {soMinhas ? `Minhas (${minhasQtd})` : "Todas"}
          </button>
        </div>

        {mesas && (
          <div className="-mx-3 flex gap-2 overflow-x-auto px-3 [scrollbar-width:none]">
            {ORDEM_RESUMO.map((r) => {
              const qtd = contar(r.valor);
              if (qtd === 0 && filtro !== r.valor) return null;
              return (
                <button
                  key={r.valor}
                  type="button"
                  aria-pressed={filtro === r.valor}
                  onClick={() =>
                    setFiltro((f) => (f === r.valor ? null : r.valor))
                  }
                  className={cn(
                    "flex h-10 shrink-0 items-center gap-2 rounded-full border px-3 font-semibold text-sm",
                    filtro === r.valor
                      ? "border-texto bg-texto text-fundo"
                      : "border-borda bg-surface",
                  )}
                >
                  <span className={cn("size-2.5 rounded-full", r.cor)} />
                  {qtd} {r.rotulo.toLowerCase()}
                </button>
              );
            })}
          </div>
        )}

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
        {mesas && visiveis.length === 0 && (
          <p className="p-6 text-center text-texto-secundario">
            Nenhuma mesa aqui.
          </p>
        )}
        <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-5 lg:grid-cols-8">
          {visiveis.map((mesa) => (
            <CardMesa
              key={mesa.id}
              mesa={mesa}
              agora={agora}
              minha={minha(mesa)}
              onAbrir={() => router.push(`/garcom/mesa/${mesa.id}`)}
            />
          ))}
        </div>
      </main>
    </div>
  );
}
