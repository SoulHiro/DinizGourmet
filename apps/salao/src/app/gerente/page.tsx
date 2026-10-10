"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { useFuncionario } from "@/components/providers/sessao";
import { Cabecalho } from "@/components/salao/cabecalho";
import { cn } from "@/lib/utils";
import { GerenciaImpressoras, GerenciaMesas } from "./_components/cadastros";
import { GerenciaCardapio } from "./_components/cardapio";
import { GerenciaCartoes } from "./_components/cartoes";
import { GerenciaDescontos } from "./_components/descontos";
import { GerenciaEquipe } from "./_components/equipe";
import { GerenciaEstoque } from "./_components/estoque";
import {
  ABAS,
  type Aba,
  AbasTopo,
  AtalhosTopo,
  NavegacaoInferior,
} from "./_components/navegacao";
import { ResumoNoite } from "./_components/noite";
import { RelatorioDeProdutos } from "./_components/produtos";

// Abas com lista em duas colunas no computador.
const LARGAS: Aba[] = [
  "noite",
  "cardapio",
  "estoque",
  "descontos",
  "cartoes",
  "equipe",
  "produtos",
];

export default function GerentePage() {
  const funcionario = useFuncionario();
  const router = useRouter();
  const pathname = usePathname();
  // A aba fica no endereço (?aba=estoque): recarregar ou voltar do salão
  // cai na mesma seção.
  const parametro = useSearchParams().get("aba");
  const aba: Aba = ABAS.some((a) => a.valor === parametro)
    ? (parametro as Aba)
    : "noite";
  const irPara = (nova: Aba) => {
    router.replace(nova === "noite" ? pathname : `${pathname}?aba=${nova}`, {
      scroll: false,
    });
    window.scrollTo({ top: 0 });
  };
  const atual = ABAS.find((a) => a.valor === aba);

  return (
    <div className="min-h-dvh pb-24 md:pb-10">
      <Cabecalho
        titulo="Gerência"
        subtitulo={atual?.rotulo}
        acoes={<AtalhosTopo nome={funcionario.nome} />}
        menu={<span className="w-1" />}
      />
      <AbasTopo aba={aba} onAba={irPara} />
      <main
        className={cn(
          "mx-auto p-3",
          LARGAS.includes(aba) ? "max-w-6xl" : "max-w-3xl",
        )}
      >
        {aba === "noite" && <ResumoNoite />}
        {aba === "estoque" && <GerenciaEstoque />}
        {aba === "cardapio" && <GerenciaCardapio />}
        {aba === "produtos" && <RelatorioDeProdutos />}
        {aba === "descontos" && <GerenciaDescontos />}
        {aba === "mesas" && <GerenciaMesas />}
        {aba === "cartoes" && <GerenciaCartoes />}
        {aba === "equipe" && <GerenciaEquipe />}
        {aba === "impressoras" && <GerenciaImpressoras />}
      </main>
      <NavegacaoInferior aba={aba} onAba={irPara} nome={funcionario.nome} />
    </div>
  );
}
