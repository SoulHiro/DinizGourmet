"use client";

import { useQuery } from "@tanstack/react-query";
import {
  ArrowDown,
  CircleDollarSign,
  Download,
  Info,
  Loader2,
  Package,
  PackageX,
  Percent,
  Receipt,
  Search,
  TrendingUp,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { api } from "@/lib/cliente";
import type { RelatorioProdutos } from "@/lib/dominio/relatorio-produtos";
import { normalizarBusca } from "@/lib/texto";
import { cn, formatBRL } from "@/lib/utils";
import { BarrasHorizontais } from "./graficos";

const PERIODOS = [
  { dias: 1, rotulo: "Hoje" },
  { dias: 7, rotulo: "7 dias" },
  { dias: 30, rotulo: "30 dias" },
  { dias: 90, rotulo: "90 dias" },
] as const;

type Ordem = "quantidade" | "receita" | "lucro" | "margem";

const Indicador = ({
  rotulo,
  valor,
  icone: Icone,
  cor,
  detalhe,
}: {
  rotulo: string;
  valor: string;
  icone: typeof Package;
  cor: string;
  detalhe?: React.ReactNode;
}) => (
  <div className="flex flex-col gap-2 rounded-2xl border border-borda bg-surface p-4">
    <div className="flex items-center justify-between gap-2">
      <span className="text-sm text-texto-secundario">{rotulo}</span>
      <span
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-xl",
          cor,
        )}
      >
        <Icone className="size-5" />
      </span>
    </div>
    <p className="font-bold text-2xl tabular-nums leading-none sm:text-3xl">
      {valor}
    </p>
    {detalhe && <div className="text-sm text-texto-secundario">{detalhe}</div>}
  </div>
);

const reais = (c: number | null) =>
  c === null ? "" : (c / 100).toFixed(2).replace(".", ",");

const exportar = (r: RelatorioProdutos) => {
  const linhas = [
    [
      "Item",
      "Categoria",
      "Quantidade",
      "Receita (R$)",
      "Custo (R$)",
      "Lucro (R$)",
      "Margem (%)",
    ],
    ...r.produtos.map((p) => [
      p.nome,
      p.categoria,
      p.quantidade,
      reais(p.receitaCentavos),
      reais(p.custoCentavos),
      reais(p.lucroCentavos),
      p.margemPct === null ? "" : String(p.margemPct).replace(".", ","),
    ]),
    [],
    ["Sem vendas no período"],
    ...r.semVenda.map((p) => [p.nome, p.categoria]),
  ];
  const csv = `﻿${linhas.map((l) => l.map((c) => (String(c).includes(";") ? `"${c}"` : c)).join(";")).join("\r\n")}`;
  const url = URL.createObjectURL(
    new Blob([csv], { type: "text/csv;charset=utf-8" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = `produtos-${r.dias}-dias-${r.ate.slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
};

// Quantidade de cada item que saiu, receita, custo e lucro bruto. O lucro
// vale só para itens com custo informado (a cobertura diz quanto é isso).
export const RelatorioDeProdutos = () => {
  const [dias, setDias] = useState<number>(7);
  const [busca, setBusca] = useState("");
  const [categoria, setCategoria] = useState<string | null>(null);
  const [ordem, setOrdem] = useState<Ordem>("quantidade");
  const { data, isLoading } = useQuery({
    queryKey: ["gerente", "relatorio-produtos", dias],
    queryFn: () =>
      api<RelatorioProdutos>(`/api/gerente/relatorio-produtos?dias=${dias}`),
  });

  if (isLoading || !data) {
    return (
      <Loader2 className="mx-auto mt-10 size-8 animate-spin text-texto-secundario" />
    );
  }

  const termo = normalizarBusca(busca);
  const valorDe = (p: RelatorioProdutos["produtos"][number]) =>
    ordem === "quantidade"
      ? p.quantidade
      : ordem === "receita"
        ? p.receitaCentavos
        : ordem === "lucro"
          ? (p.lucroCentavos ?? -Infinity)
          : (p.margemPct ?? -Infinity);
  const lista = data.produtos
    .filter((p) => !categoria || p.categoria === categoria)
    .filter((p) => !termo || normalizarBusca(p.nome).includes(termo))
    .sort((a, b) => valorDe(b) - valorDe(a));
  const maior = Math.max(...lista.map((p) => p.quantidade), 1);
  const temCusto = data.coberturaPct > 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-1 flex-wrap gap-1.5">
          {PERIODOS.map((p) => (
            <button
              key={p.dias}
              type="button"
              aria-pressed={dias === p.dias}
              onClick={() => setDias(p.dias)}
              className={cn(
                "h-10 rounded-full border px-4 font-semibold text-sm",
                dias === p.dias
                  ? "border-texto bg-texto text-fundo"
                  : "border-borda bg-surface text-texto-secundario",
              )}
            >
              {p.rotulo}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => exportar(data)}
          className="flex h-10 items-center gap-2 rounded-full border border-borda bg-surface px-4 font-semibold text-sm"
        >
          <Download className="size-4" /> Exportar
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Indicador
          rotulo="Itens vendidos"
          valor={String(data.itensVendidos)}
          icone={Package}
          cor="bg-status-ocupada/15 text-status-ocupada"
          detalhe={`${data.produtos.length} ${data.produtos.length === 1 ? "item diferente" : "itens diferentes"}`}
        />
        <Indicador
          rotulo="Receita dos itens"
          valor={formatBRL(data.receitaCentavos)}
          icone={Receipt}
          cor="bg-acao/15 text-acao"
          detalhe="Sem taxa e gorjeta"
        />
        <Indicador
          rotulo="Lucro bruto"
          valor={temCusto ? formatBRL(data.lucroCentavos) : "—"}
          icone={CircleDollarSign}
          cor="bg-status-livre/15 text-status-livre"
          detalhe={
            temCusto
              ? `Custo ${formatBRL(data.custoCentavos)}`
              : "Informe o custo dos itens"
          }
        />
        <Indicador
          rotulo="Margem"
          valor={data.margemPct === null ? "—" : `${data.margemPct}%`}
          icone={Percent}
          cor="bg-(--serie-5)/15 text-(--serie-5)"
          detalhe={`Custo informado em ${data.coberturaPct}% das vendas`}
        />
      </div>

      {data.coberturaPct < 100 && (
        <p className="flex items-start gap-2 rounded-xl border border-borda bg-surface px-3 py-2 text-sm text-texto-secundario">
          <Info className="mt-0.5 size-4 shrink-0" />
          <span>
            O lucro considera só os itens com custo informado (
            {data.coberturaPct}% da receita). Preencha o custo em{" "}
            <Link
              href="/gerente?aba=cardapio"
              className="font-semibold text-acao underline"
            >
              Cardápio › Editar item
            </Link>
            .
          </span>
        </p>
      )}

      <div className="grid gap-3 lg:grid-cols-3">
        <section className="flex flex-col gap-3 rounded-2xl border border-borda bg-surface p-4">
          <h3 className="flex items-center gap-2 font-bold">
            <TrendingUp className="size-5 text-texto-secundario" /> Por
            categoria
          </h3>
          {data.categorias.length === 0 ? (
            <p className="py-6 text-center text-sm text-texto-secundario">
              Sem vendas no período.
            </p>
          ) : (
            <BarrasHorizontais
              itens={data.categorias.map((c) => ({
                chave: c.nome,
                rotulo: c.nome,
                valor: c.receitaCentavos,
                texto: formatBRL(c.receitaCentavos),
                detalhe: `${c.quantidade} un`,
              }))}
            />
          )}
        </section>

        <section className="flex flex-col gap-3 rounded-2xl border border-borda bg-surface p-4 lg:col-span-2">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="flex-1 font-bold">Itens vendidos</h3>
            <label className="flex items-center gap-1 text-sm text-texto-secundario">
              <ArrowDown className="size-4" />
              <select
                value={ordem}
                onChange={(e) => setOrdem(e.target.value as Ordem)}
                className="h-9 rounded-lg border border-borda bg-fundo px-2 text-texto"
              >
                <option value="quantidade">Mais vendidos</option>
                <option value="receita">Maior receita</option>
                <option value="lucro">Maior lucro</option>
                <option value="margem">Maior margem</option>
              </select>
            </label>
          </div>
          <label className="relative">
            <Search className="-translate-y-1/2 absolute top-1/2 left-3 size-4 text-texto-secundario" />
            <input
              type="search"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar item"
              aria-label="Buscar item"
              className="h-11 w-full rounded-lg border border-borda bg-fundo pr-3 pl-9"
            />
          </label>
          <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 [scrollbar-width:none]">
            {[null, ...data.categorias.map((c) => c.nome)].map((c) => (
              <button
                key={c ?? "todas"}
                type="button"
                aria-pressed={categoria === c}
                onClick={() => setCategoria(c)}
                className={cn(
                  "h-9 shrink-0 rounded-full border px-3 font-semibold text-sm",
                  categoria === c
                    ? "border-acao bg-acao/15"
                    : "border-borda text-texto-secundario",
                )}
              >
                {c ?? "Todas"}
              </button>
            ))}
          </div>
          <div className="-mx-4 overflow-x-auto">
            <table className="w-full min-w-[620px] text-sm">
              <thead>
                <tr className="border-borda border-b text-left text-texto-secundario text-xs uppercase tracking-wide">
                  <th className="px-4 pb-2 font-semibold">Item</th>
                  <th className="px-2 pb-2 font-semibold">Qtd</th>
                  <th className="px-2 pb-2 text-right font-semibold">
                    Receita
                  </th>
                  <th className="px-2 pb-2 text-right font-semibold">Lucro</th>
                  <th className="px-4 pb-2 text-right font-semibold">Margem</th>
                </tr>
              </thead>
              <tbody>
                {lista.map((p) => (
                  <tr
                    key={p.produtoId}
                    className="border-borda border-b last:border-0"
                  >
                    <td className="px-4 py-2.5">
                      <span className="block font-semibold">{p.nome}</span>
                      <span className="text-texto-secundario text-xs">
                        {p.categoria}
                      </span>
                    </td>
                    <td className="w-1/4 px-2 py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="h-2 flex-1 overflow-hidden rounded-full bg-borda/60">
                          <div
                            className="h-full rounded-full bg-acao"
                            style={{
                              width: `${(p.quantidade / maior) * 100}%`,
                            }}
                          />
                        </div>
                        <strong className="w-10 text-right tabular-nums">
                          {p.quantidade}
                        </strong>
                      </div>
                    </td>
                    <td className="px-2 py-2.5 text-right tabular-nums">
                      {formatBRL(p.receitaCentavos)}
                    </td>
                    <td
                      className={cn(
                        "px-2 py-2.5 text-right tabular-nums",
                        p.lucroCentavos !== null &&
                          p.lucroCentavos < 0 &&
                          "font-semibold text-destructive",
                      )}
                    >
                      {p.lucroCentavos === null ? (
                        <span className="text-texto-secundario text-xs">
                          sem custo
                        </span>
                      ) : (
                        formatBRL(p.lucroCentavos)
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums">
                      {p.margemPct === null ? "—" : `${p.margemPct}%`}
                    </td>
                  </tr>
                ))}
                {lista.length === 0 && (
                  <tr>
                    <td
                      colSpan={5}
                      className="py-6 text-center text-texto-secundario"
                    >
                      Nenhum item vendido aqui.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {data.semVenda.length > 0 && (
        <section className="flex flex-col gap-3 rounded-2xl border border-borda bg-surface p-4">
          <h3 className="flex items-center gap-2 font-bold">
            <PackageX className="size-5 text-texto-secundario" /> Não venderam
            no período
            <span className="font-normal text-sm text-texto-secundario">
              {data.semVenda.length}
            </span>
          </h3>
          <div className="flex flex-wrap gap-1.5">
            {data.semVenda.map((p) => (
              <span
                key={p.produtoId}
                className="rounded-full border border-borda px-3 py-1 text-sm"
              >
                {p.nome}
                <span className="ml-1 text-texto-secundario text-xs">
                  {p.categoria}
                </span>
              </span>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};
