"use client";

import { useQuery } from "@tanstack/react-query";
import {
  ChartPie,
  History,
  Landmark,
  LayoutGrid,
  Lock,
  Settings,
  Store,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { useFuncionario } from "@/components/providers/sessao";
import { Cabecalho } from "@/components/salao/cabecalho";
import { api } from "@/lib/cliente";
import type { TurnoCaixa } from "@/lib/dominio/turno-caixa";
import { cn, formatBRL } from "@/lib/utils";
import { Gaveta } from "./_components/gaveta";
import { HistoricoContas } from "./_components/historico";
import { ResumoDoCaixa } from "./_components/resumo";
import { SalaoCaixa } from "./_components/salao";

const ABAS = [
  { valor: "salao", rotulo: "Salão", Icone: Store },
  { valor: "gaveta", rotulo: "Gaveta", Icone: Landmark },
  { valor: "historico", rotulo: "Histórico", Icone: History },
  { valor: "resumo", rotulo: "Resumo", Icone: ChartPie },
] as const;

type Aba = (typeof ABAS)[number]["valor"];

// Painel do computador do caixa: salão inteiro, contas, recebimento, gaveta
// (abertura, sangrias e fechamento), histórico e resumo do turno.
export default function CaixaPage() {
  const funcionario = useFuncionario();
  const router = useRouter();
  const pathname = usePathname();
  const parametro = useSearchParams().get("aba");
  const aba: Aba = ABAS.some((a) => a.valor === parametro)
    ? (parametro as Aba)
    : "salao";
  const irPara = (nova: Aba) =>
    router.replace(nova === "salao" ? pathname : `${pathname}?aba=${nova}`, {
      scroll: false,
    });

  // Situação da gaveta sempre à vista (no cabeçalho e no aviso do salão).
  const { data: gaveta } = useQuery({
    queryKey: ["mesas", "caixa", "turno"],
    queryFn: () => api<{ turno: TurnoCaixa | null }>("/api/caixa/turno"),
    refetchInterval: 30_000,
  });
  const turno = gaveta?.turno;

  return (
    <div className="min-h-dvh pb-6">
      <Cabecalho
        titulo="Caixa"
        subtitulo={`${funcionario.nome} · ${
          gaveta === undefined
            ? "…"
            : turno
              ? `gaveta ${formatBRL(turno.esperadoCentavos)}`
              : "caixa fechado"
        }`}
        acoes={
          <>
            <Link
              href="/garcom"
              aria-label="Abrir o mapa do garçom"
              title="Mapa do garçom"
              className="flex size-12 items-center justify-center"
            >
              <LayoutGrid />
            </Link>
            {funcionario.papel === "gerente" && (
              <Link
                href="/gerente"
                aria-label="Ir para a gerência"
                title="Gerência"
                className="flex size-12 items-center justify-center"
              >
                <Settings />
              </Link>
            )}
          </>
        }
      />
      <nav className="flex overflow-x-auto border-borda border-b bg-surface">
        <div className="mx-auto flex w-full max-w-[1400px] px-2">
          {ABAS.map(({ valor, rotulo, Icone }) => (
            <button
              key={valor}
              type="button"
              aria-current={aba === valor ? "page" : undefined}
              onClick={() => irPara(valor)}
              className={cn(
                "flex h-12 shrink-0 items-center gap-2 border-b-[3px] px-4 font-semibold",
                aba === valor
                  ? "border-acao text-texto"
                  : "border-transparent text-texto-secundario hover:text-texto",
              )}
            >
              <Icone className="size-4" />
              {rotulo}
              {valor === "gaveta" && gaveta && !turno && (
                <span className="size-2 rounded-full bg-destructive" />
              )}
            </button>
          ))}
        </div>
      </nav>
      <main className="mx-auto max-w-[1400px] p-3">
        {aba === "salao" && gaveta && !turno && (
          <button
            type="button"
            onClick={() => irPara("gaveta")}
            className="mb-3 flex w-full items-center gap-3 rounded-xl border border-status-aguardando bg-status-aguardando/15 px-4 py-3 text-left"
          >
            <Lock className="size-5 shrink-0" />
            <span className="flex-1">
              <strong>Caixa fechado.</strong>{" "}
              <span className="text-texto-secundario">
                Abra a gaveta com o fundo de troco para conferir o dinheiro no
                fim da noite.
              </span>
            </span>
            <span className="font-semibold text-acao">Abrir caixa</span>
          </button>
        )}
        {aba === "salao" && <SalaoCaixa />}
        {aba === "gaveta" && <Gaveta />}
        {aba === "historico" && <HistoricoContas />}
        {aba === "resumo" && <ResumoDoCaixa />}
      </main>
    </div>
  );
}
