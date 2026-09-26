"use client";

import { LayoutGrid, Wallet } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { useFuncionario } from "@/components/providers/sessao";
import { Cabecalho } from "@/components/salao/cabecalho";
import { cn } from "@/lib/utils";
import {
  GerenciaEquipe,
  GerenciaImpressoras,
  GerenciaMesas,
} from "./_components/cadastros";
import { GerenciaCardapio } from "./_components/cardapio";
import { GerenciaDescontos, GerenciaEstoque } from "./_components/estoque";
import { ResumoNoite } from "./_components/noite";
import { PersonalizarPapel } from "./_components/papel";

const ABAS = [
  { valor: "noite", rotulo: "Noite" },
  { valor: "estoque", rotulo: "Estoque" },
  { valor: "cardapio", rotulo: "Cardápio" },
  { valor: "descontos", rotulo: "Descontos" },
  { valor: "mesas", rotulo: "Mesas" },
  { valor: "equipe", rotulo: "Equipe" },
  { valor: "impressoras", rotulo: "Impressoras" },
  { valor: "papel", rotulo: "Papel" },
] as const;

type Aba = (typeof ABAS)[number]["valor"];

export default function GerentePage() {
  const funcionario = useFuncionario();
  const [aba, setAba] = useState<Aba>("noite");

  return (
    <div className="min-h-dvh pb-10">
      <Cabecalho
        titulo="Gerência"
        subtitulo={funcionario.nome}
        acoes={
          <>
            <Link
              href="/caixa"
              aria-label="Abrir o caixa"
              className="flex size-12 items-center justify-center"
            >
              <Wallet />
            </Link>
            <Link
              href="/garcom"
              aria-label="Ir para o mapa de mesas"
              className="flex size-12 items-center justify-center"
            >
              <LayoutGrid />
            </Link>
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
              "h-12 shrink-0 border-b-4 px-4 font-semibold",
              aba === valor
                ? "border-acao"
                : "border-transparent text-texto-secundario",
            )}
          >
            {rotulo}
          </button>
        ))}
      </nav>
      <main className="mx-auto max-w-3xl p-3">
        {aba === "noite" && <ResumoNoite />}
        {aba === "estoque" && <GerenciaEstoque />}
        {aba === "cardapio" && <GerenciaCardapio />}
        {aba === "descontos" && <GerenciaDescontos />}
        {aba === "mesas" && <GerenciaMesas />}
        {aba === "equipe" && <GerenciaEquipe />}
        {aba === "impressoras" && <GerenciaImpressoras />}
        {aba === "papel" && <PersonalizarPapel />}
      </main>
    </div>
  );
}
