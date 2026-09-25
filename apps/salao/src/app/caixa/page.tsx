"use client";

import { LayoutGrid, Settings } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { useFuncionario } from "@/components/providers/sessao";
import { Cabecalho } from "@/components/salao/cabecalho";
import { cn } from "@/lib/utils";
import { HistoricoContas } from "./_components/historico";
import { ResumoDoCaixa } from "./_components/resumo";
import { SalaoCaixa } from "./_components/salao";

const ABAS = [
  { valor: "salao", rotulo: "Salão" },
  { valor: "historico", rotulo: "Histórico" },
  { valor: "resumo", rotulo: "Resumo do caixa" },
] as const;

type Aba = (typeof ABAS)[number]["valor"];

// Painel do computador do caixa: salão inteiro, contas, recebimento,
// impressão da conta, histórico e fechamento do dia.
export default function CaixaPage() {
  const funcionario = useFuncionario();
  const [aba, setAba] = useState<Aba>("salao");

  return (
    <div className="min-h-dvh pb-6">
      <Cabecalho
        titulo="Caixa"
        subtitulo={funcionario.nome}
        acoes={
          <>
            <Link
              href="/garcom"
              aria-label="Abrir o mapa do garçom"
              className="flex size-12 items-center justify-center"
            >
              <LayoutGrid />
            </Link>
            {funcionario.papel === "gerente" && (
              <Link
                href="/gerente"
                aria-label="Ir para a gerência"
                className="flex size-12 items-center justify-center"
              >
                <Settings />
              </Link>
            )}
          </>
        }
      />
      <nav className="flex overflow-x-auto border-borda border-b bg-surface">
        {ABAS.map(({ valor, rotulo }) => (
          <button
            key={valor}
            type="button"
            onClick={() => setAba(valor)}
            className={cn(
              "h-12 shrink-0 border-b-4 px-5 font-semibold",
              aba === valor
                ? "border-acao"
                : "border-transparent text-texto-secundario",
            )}
          >
            {rotulo}
          </button>
        ))}
      </nav>
      <main className="mx-auto max-w-[1400px] p-3">
        {aba === "salao" && <SalaoCaixa />}
        {aba === "historico" && <HistoricoContas />}
        {aba === "resumo" && <ResumoDoCaixa />}
      </main>
    </div>
  );
}
