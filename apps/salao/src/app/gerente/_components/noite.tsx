"use client";

import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  Ban,
  Banknote,
  BellRing,
  CalendarRange,
  ChevronRight,
  Clock,
  CreditCard,
  Download,
  HandCoins,
  Loader2,
  Package,
  Printer,
  QrCode,
  Receipt,
  RefreshCw,
  Sofa,
  Ticket,
  TrendingDown,
  TrendingUp,
  UtensilsCrossed,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { api } from "@/lib/cliente";
import { useImpressao } from "@/lib/consultas";
import type { MetodoPagamento, PainelNoite } from "@/lib/dominio/painel";
import { ROTULO_MOTIVO_SEM_TAXA } from "@/lib/dominio/taxa";
import { cn, formatBRL } from "@/lib/utils";
import { exportarPainel } from "./exportar-painel";
import {
  BarrasHorizontais,
  BarrasVerticais,
  COR_SERIE,
  Rosca,
} from "./graficos";

const METODOS: Record<
  MetodoPagamento,
  { rotulo: string; Icone: typeof Banknote }
> = {
  pix: { rotulo: "Pix", Icone: QrCode },
  credito: { rotulo: "Crédito", Icone: CreditCard },
  debito: { rotulo: "Débito", Icone: CreditCard },
  dinheiro: { rotulo: "Dinheiro", Icone: Banknote },
  vale_refeicao: { rotulo: "Vale-refeição", Icone: Ticket },
};

const duracao = (segundos: number | null) => {
  if (segundos === null) return "—";
  if (segundos < 60) return `${segundos}s`;
  const min = Math.floor(segundos / 60);
  if (min < 60) return `${min}min`;
  return `${Math.floor(min / 60)}h${String(min % 60).padStart(2, "0")}`;
};

const plural = (n: number, um: string, varios: string) =>
  `${n} ${n === 1 ? um : varios}`;

const resumoEstoque = (itens: { estoque: number }[]) => {
  const esgotadas = itens.filter((e) => e.estoque === 0).length;
  const acabando = itens.length - esgotadas;
  return [
    esgotadas && plural(esgotadas, "bebida esgotada", "bebidas esgotadas"),
    acabando && plural(acabando, "acabando", "acabando"),
  ]
    .filter(Boolean)
    .join(", ");
};

// Rótulo do botão de cada noite: Hoje, Ontem, depois o dia da semana.
const rotuloNoite = (deslocamento: number) => {
  if (deslocamento === 0) return "Hoje";
  if (deslocamento === 1) return "Ontem";
  const dia = new Date(Date.now() - deslocamento * 86_400_000);
  return dia
    .toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit" })
    .replace(".", "");
};

const iniciais = (nome: string) =>
  nome
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");

const Cartao = ({
  titulo,
  icone: Icone,
  acao,
  className,
  children,
}: {
  titulo: string;
  icone: typeof Banknote;
  acao?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) => (
  <section
    className={cn(
      "flex flex-col gap-4 rounded-2xl border border-borda bg-surface p-4",
      className,
    )}
  >
    <header className="flex items-center gap-2">
      <Icone className="size-5 text-texto-secundario" />
      <h2 className="flex-1 font-bold">{titulo}</h2>
      {acao}
    </header>
    {children}
  </section>
);

const Indicador = ({
  rotulo,
  valor,
  icone: Icone,
  cor,
  detalhe,
  children,
  onAbrir,
}: {
  rotulo: string;
  valor: string;
  icone: typeof Banknote;
  cor: string;
  detalhe?: React.ReactNode;
  children?: React.ReactNode;
  // Toque abre o detalhe (ex.: quais itens foram cancelados).
  onAbrir?: () => void;
}) => {
  const Caixa = onAbrir ? "button" : "div";
  return (
    <Caixa
      {...(onAbrir ? { type: "button" as const, onClick: onAbrir } : {})}
      className={cn(
        "flex flex-col gap-2 rounded-2xl border border-borda bg-surface p-4 text-left",
        onAbrir && "transition-colors hover:border-acao",
      )}
    >
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
      {detalhe && (
        <div className="flex items-center justify-between gap-1 text-sm text-texto-secundario">
          <span>{detalhe}</span>
          {onAbrir && <ChevronRight className="size-4 shrink-0" />}
        </div>
      )}
      {children}
    </Caixa>
  );
};

const Vazio = ({ texto }: { texto: string }) => (
  <p className="py-6 text-center text-sm text-texto-secundario">{texto}</p>
);

// Painel da noite: como está o salão agora, quanto vendeu, o que mais saiu,
// como estão pagando e quem está atendendo.
export const ResumoNoite = () => {
  // Uma noite (0 = hoje, 1 = ontem...) ou um período de 7/30 noites.
  const [periodo, setPeriodo] = useState<{ noite: number } | { dias: 7 | 30 }>({
    noite: 0,
  });
  const deslocamento = "noite" in periodo ? periodo.noite : -1;
  const consulta =
    "noite" in periodo ? `noite=${periodo.noite}` : `periodo=${periodo.dias}`;
  const { data, isLoading, refetch, isFetching, dataUpdatedAt } = useQuery({
    queryKey: ["gerente", "noite", consulta],
    queryFn: () => api<PainelNoite>(`/api/gerente/noite?${consulta}`),
    refetchInterval: deslocamento === 0 ? 60_000 : false,
  });
  const { data: impressao } = useImpressao();
  const [verCancelados, setVerCancelados] = useState(false);

  if (isLoading || !data) {
    return (
      <Loader2 className="mx-auto mt-10 size-8 animate-spin text-texto-secundario" />
    );
  }

  const variacao = data.vendas.anteriorCentavos
    ? Math.round(
        ((data.vendas.centavos - data.vendas.anteriorCentavos) /
          data.vendas.anteriorCentavos) *
          100,
      )
    : null;
  const ocupacao = data.mesas.ativas
    ? Math.round((data.mesas.ocupadas / data.mesas.ativas) * 100)
    : 0;
  const totalCategorias = data.porCategoria.reduce((s, c) => s + c.centavos, 0);
  const totalPagamentos = data.recebidoCentavos;
  const impressorasComProblema =
    impressao?.impressoras.filter(
      (i) => i.estado === "offline" || i.estado === "erro",
    ) ?? [];
  const maiorVenda = Math.max(...data.garcons.map((g) => g.vendasCentavos), 1);
  const horaAtual = data.aoVivo
    ? Number(
        new Date().toLocaleString("en-US", {
          hour: "numeric",
          hour12: false,
          timeZone: "America/Sao_Paulo",
        }),
      ) % 24
    : null;

  const alertas = [
    data.chamados.pendentes > 0 && {
      chave: "chamados",
      Icone: BellRing,
      texto: `${data.chamados.pendentes} ${data.chamados.pendentes === 1 ? "chamado esperando" : "chamados esperando"} garçom`,
      href: "/garcom",
    },
    data.estoqueBaixo.length > 0 && {
      chave: "estoque",
      Icone: Package,
      texto: resumoEstoque(data.estoqueBaixo),
      href: "/gerente?aba=estoque",
    },
    (impressorasComProblema.length > 0 || (impressao?.falhas ?? 0) > 0) && {
      chave: "impressao",
      Icone: Printer,
      texto:
        impressorasComProblema.length > 0
          ? `Impressora com problema: ${impressorasComProblema.map((i) => i.nome).join(", ")}`
          : `${impressao?.falhas} tickets falharam`,
      href: "/gerente?aba=impressoras",
    },
  ].filter(Boolean) as {
    chave: string;
    Icone: typeof Banknote;
    texto: string;
    href: string;
  }[];

  return (
    <div className="flex flex-col gap-4">
      {/* Período */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="-mx-3 flex flex-1 gap-1.5 overflow-x-auto px-3 [scrollbar-width:none]">
          {[0, 1, 2, 3, 4, 5, 6].map((d) => (
            <button
              key={d}
              type="button"
              aria-pressed={deslocamento === d}
              onClick={() => setPeriodo({ noite: d })}
              className={cn(
                "h-10 shrink-0 rounded-full border px-4 font-semibold text-sm",
                deslocamento === d
                  ? "border-texto bg-texto text-fundo"
                  : "border-borda bg-surface text-texto-secundario",
              )}
            >
              {rotuloNoite(d)}
            </button>
          ))}
          <span className="mx-1 w-px shrink-0 self-stretch bg-borda" />
          {([7, 30] as const).map((dias) => {
            const ativo = "dias" in periodo && periodo.dias === dias;
            return (
              <button
                key={dias}
                type="button"
                aria-pressed={ativo}
                onClick={() => setPeriodo({ dias })}
                className={cn(
                  "flex h-10 shrink-0 items-center gap-1.5 rounded-full border px-4 font-semibold text-sm",
                  ativo
                    ? "border-texto bg-texto text-fundo"
                    : "border-borda bg-surface text-texto-secundario",
                )}
              >
                <CalendarRange className="size-4" />
                {dias} dias
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-2 text-sm text-texto-secundario">
          {data.aoVivo && (
            <span className="flex items-center gap-1.5 font-semibold text-status-livre">
              <span className="size-2 animate-pulse rounded-full bg-status-livre" />
              Ao vivo
            </span>
          )}
          <span className="tabular-nums">
            {new Date(dataUpdatedAt).toLocaleTimeString("pt-BR", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
          <Button
            size="icon"
            variant="ghost"
            aria-label="Exportar planilha"
            title="Exportar planilha (Excel)"
            onClick={() =>
              exportarPainel(
                data,
                `xis-diniz-${data.dias > 1 ? `${data.dias}-dias` : "noite"}-${new Date(data.desde).toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" })}.csv`,
              )
            }
          >
            <Download />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            aria-label="Atualizar"
            disabled={isFetching}
            onClick={() => refetch()}
          >
            <RefreshCw className={cn(isFetching && "animate-spin")} />
          </Button>
        </div>
      </div>

      {/* Alertas */}
      {data.aoVivo && alertas.length > 0 && (
        <ul className="flex flex-col gap-2">
          {alertas.map((a) => (
            <li key={a.chave}>
              <Link
                href={a.href}
                className="flex min-h-12 items-center gap-3 rounded-xl border border-status-chamado/50 bg-status-chamado/10 px-3 py-2 font-semibold text-sm"
              >
                <AlertTriangle className="size-5 shrink-0 text-status-chamado" />
                <a.Icone className="size-4 shrink-0 text-texto-secundario" />
                <span className="flex-1">{a.texto}</span>
                <ChevronRight className="size-4 text-texto-secundario" />
              </Link>
            </li>
          ))}
        </ul>
      )}

      {/* Indicadores */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Indicador
          rotulo="Vendas lançadas"
          valor={formatBRL(data.vendas.centavos)}
          icone={Banknote}
          cor="bg-acao/15 text-acao"
          detalhe={
            variacao === null ? (
              "Sem base de comparação"
            ) : (
              <span
                className={cn(
                  "flex items-center gap-1 font-semibold",
                  variacao >= 0 ? "text-status-livre" : "text-destructive",
                )}
              >
                {variacao >= 0 ? (
                  <TrendingUp className="size-4" />
                ) : (
                  <TrendingDown className="size-4" />
                )}
                {variacao > 0 ? "+" : ""}
                {variacao}%
                <span className="font-normal text-texto-secundario">
                  {data.dias > 1
                    ? `vs. ${data.dias} dias anteriores`
                    : "vs. noite anterior"}
                </span>
              </span>
            )
          }
        />
        <Indicador
          rotulo="Recebido no caixa"
          valor={formatBRL(data.recebidoCentavos)}
          icone={Wallet}
          cor="bg-status-livre/15 text-status-livre"
          detalhe={`${data.comandas.fechadas} ${data.comandas.fechadas === 1 ? "comanda fechada" : "comandas fechadas"}`}
        />
        <Indicador
          rotulo="Ticket médio"
          valor={formatBRL(data.comandas.ticketMedioCentavos)}
          icone={Receipt}
          cor="bg-status-ocupada/15 text-status-ocupada"
          detalhe={
            data.comandas.permanenciaMin !== null
              ? `Permanência média ${duracao(data.comandas.permanenciaMin * 60)}`
              : "Por comanda fechada"
          }
        />
        <Indicador
          rotulo="Mesas ocupadas"
          valor={`${data.mesas.ocupadas}/${data.mesas.ativas}`}
          icone={Sofa}
          cor="bg-status-chamado/15 text-status-chamado"
          detalhe={`${data.comandas.abertas} ${data.comandas.abertas === 1 ? "comanda aberta" : "comandas abertas"} agora`}
        >
          <div
            className="h-1.5 overflow-hidden rounded-full bg-borda/60"
            aria-hidden="true"
          >
            <div
              className="h-full rounded-full bg-status-chamado"
              style={{ width: `${ocupacao}%` }}
            />
          </div>
        </Indicador>
        <Indicador
          rotulo="Itens vendidos"
          valor={String(data.vendas.itens)}
          icone={UtensilsCrossed}
          cor="bg-(--serie-3)/15 text-(--serie-3)"
        />
        <Indicador
          rotulo="Chamados"
          valor={String(data.chamados.total)}
          icone={BellRing}
          cor="bg-status-aguardando/20 text-status-aguardando"
          detalhe={
            <span className="flex items-center gap-1">
              <Clock className="size-3.5" /> Espera média{" "}
              {duracao(data.chamados.esperaMediaSeg)}
            </span>
          }
        />
        <Indicador
          rotulo="Gorjeta + taxa"
          valor={formatBRL(data.gorjetaCentavos + data.taxaCentavos)}
          icone={HandCoins}
          cor="bg-(--serie-5)/15 text-(--serie-5)"
          detalhe={`Gorjeta ${formatBRL(data.gorjetaCentavos)} · taxa ${formatBRL(data.taxaCentavos)}`}
        />
        <Indicador
          rotulo="Cancelamentos"
          valor={String(data.cancelamentos.quantidade)}
          icone={Ban}
          cor={
            data.cancelamentos.quantidade > 0
              ? "bg-destructive/15 text-destructive"
              : "bg-borda/60 text-texto-secundario"
          }
          detalhe={`${formatBRL(data.cancelamentos.centavos)} em itens`}
          onAbrir={
            data.cancelados.length > 0
              ? () => setVerCancelados(true)
              : undefined
          }
        />
      </div>

      {/* Vendas por hora + categorias */}
      <div className="grid gap-3 lg:grid-cols-3">
        <Cartao
          titulo={data.dias > 1 ? "Vendas por noite" : "Vendas por hora"}
          icone={Clock}
          className="lg:col-span-2"
        >
          {data.vendas.centavos === 0 ? (
            <Vazio
              texto={
                data.dias > 1
                  ? "Nenhuma venda lançada no período."
                  : "Nenhuma venda lançada nesta noite."
              }
            />
          ) : data.dias > 1 ? (
            <BarrasVerticais
              atual={data.vendasPorNoite.at(-1)?.noite}
              dados={data.vendasPorNoite.map((n) => {
                const [ano, mes, dia] = n.noite.split("-").map(Number);
                const semana = new Date(ano, mes - 1, dia)
                  .toLocaleDateString("pt-BR", { weekday: "short" })
                  .replace(".", "");
                return {
                  chave: n.noite,
                  rotulo: data.dias > 7 ? String(dia) : `${semana} ${dia}`,
                  centavos: n.centavos,
                };
              })}
            />
          ) : (
            <BarrasVerticais
              atual={horaAtual === null ? null : String(horaAtual)}
              dados={data.vendasPorHora.map((h) => ({
                chave: String(h.hora),
                rotulo: `${h.hora}h`,
                centavos: h.centavos,
              }))}
            />
          )}
        </Cartao>
        <Cartao titulo="Por categoria" icone={UtensilsCrossed}>
          {totalCategorias === 0 ? (
            <Vazio texto="Sem vendas ainda." />
          ) : (
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center lg:flex-col">
              <div className="w-40 shrink-0 self-center">
                <Rosca
                  centro={formatBRL(totalCategorias)}
                  subtitulo="no total"
                  fatias={data.porCategoria.map((c, i) => ({
                    rotulo: c.categoria,
                    valor: c.centavos,
                    cor: COR_SERIE[i % COR_SERIE.length],
                  }))}
                />
              </div>
              <ul className="flex w-full flex-col gap-2 text-sm">
                {data.porCategoria.map((c, i) => (
                  <li key={c.categoria} className="flex items-center gap-2">
                    <span
                      className="size-3 shrink-0 rounded-[3px]"
                      style={{ background: COR_SERIE[i % COR_SERIE.length] }}
                    />
                    <span className="min-w-0 flex-1 truncate">
                      {c.categoria}
                    </span>
                    <span className="text-texto-secundario tabular-nums">
                      {Math.round((c.centavos / totalCategorias) * 100)}%
                    </span>
                    <strong className="w-24 text-right tabular-nums">
                      {formatBRL(c.centavos)}
                    </strong>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Cartao>
      </div>

      {/* Mais vendidos + pagamentos */}
      <div className="grid gap-3 lg:grid-cols-2">
        <Cartao titulo="Mais vendidos" icone={TrendingUp}>
          {data.topProdutos.length === 0 ? (
            <Vazio texto="Sem vendas ainda." />
          ) : (
            <BarrasHorizontais
              itens={data.topProdutos.map((p, i) => ({
                chave: p.nome,
                rotulo: (
                  <span className="flex items-center gap-2">
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-fundo font-bold text-xs">
                      {i + 1}
                    </span>
                    <span className="truncate">{p.nome}</span>
                  </span>
                ),
                valor: p.quantidade,
                texto: `${p.quantidade}×`,
                detalhe: formatBRL(p.centavos),
              }))}
            />
          )}
        </Cartao>
        <Cartao
          titulo="Formas de pagamento"
          icone={Wallet}
          acao={
            totalPagamentos > 0 && (
              <span className="font-bold tabular-nums">
                {formatBRL(totalPagamentos)}
              </span>
            )
          }
        >
          {data.pagamentos.length === 0 ? (
            <Vazio texto="Nenhum pagamento recebido." />
          ) : (
            <BarrasHorizontais
              itens={data.pagamentos.map((p) => {
                const m = METODOS[p.metodo];
                return {
                  chave: p.metodo,
                  rotulo: (
                    <span className="flex items-center gap-2">
                      <m.Icone className="size-4 text-texto-secundario" />
                      {m.rotulo}
                      <span className="font-normal text-texto-secundario text-xs">
                        {p.quantidade}×
                      </span>
                    </span>
                  ),
                  valor: p.centavos,
                  texto: formatBRL(p.centavos),
                  detalhe: `${Math.round((p.centavos / totalPagamentos) * 100)}%`,
                };
              })}
            />
          )}
        </Cartao>
      </div>

      {/* Equipe */}
      <Cartao titulo="Equipe na noite" icone={Receipt}>
        {data.garcons.length === 0 ? (
          <Vazio texto="Nenhum movimento ainda." />
        ) : (
          <>
            <ul className="flex flex-col divide-y divide-borda sm:hidden">
              {[...data.garcons]
                .sort((a, b) => b.vendasCentavos - a.vendasCentavos)
                .map((g) => (
                  <li
                    key={g.funcionarioId}
                    className="flex flex-col gap-2 py-3"
                  >
                    <div className="flex items-center gap-2">
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-marca font-bold text-marca-foreground text-xs">
                        {iniciais(g.nome)}
                      </span>
                      <span className="min-w-0 flex-1 truncate font-semibold">
                        {g.nome}
                      </span>
                      <strong className="tabular-nums">
                        {formatBRL(g.vendasCentavos)}
                      </strong>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-borda/60">
                      <div
                        className="h-full rounded-full bg-acao"
                        style={{
                          width: `${(g.vendasCentavos / maiorVenda) * 100}%`,
                        }}
                      />
                    </div>
                    <p className="flex flex-wrap gap-x-3 text-texto-secundario text-xs">
                      <span>Gorjeta {formatBRL(g.gorjetaCentavos)}</span>
                      <span>Taxa {formatBRL(g.taxaCentavos)}</span>
                      <span>
                        {plural(g.chamadosAtendidos, "chamado", "chamados")}
                      </span>
                      {g.cancelamentos > 0 && (
                        <span className="font-semibold text-destructive">
                          {plural(
                            g.cancelamentos,
                            "cancelamento",
                            "cancelamentos",
                          )}
                        </span>
                      )}
                    </p>
                  </li>
                ))}
            </ul>
            <div className="-mx-4 hidden overflow-x-auto sm:block">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="border-borda border-b text-left text-texto-secundario text-xs uppercase tracking-wide">
                    <th className="px-4 pb-2 font-semibold">Garçom</th>
                    <th className="px-2 pb-2 font-semibold">Vendas</th>
                    <th className="px-2 pb-2 text-right font-semibold">
                      Gorjeta
                    </th>
                    <th className="px-2 pb-2 text-right font-semibold">Taxa</th>
                    <th className="px-2 pb-2 text-center font-semibold">
                      Chamados
                    </th>
                    <th className="px-4 pb-2 text-center font-semibold">
                      Cancel.
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {[...data.garcons]
                    .sort((a, b) => b.vendasCentavos - a.vendasCentavos)
                    .map((g) => (
                      <tr
                        key={g.funcionarioId}
                        className="border-borda border-b last:border-0"
                      >
                        <td className="px-4 py-3">
                          <span className="flex items-center gap-2 font-semibold">
                            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-marca font-bold text-marca-foreground text-xs">
                              {iniciais(g.nome)}
                            </span>
                            {g.nome}
                          </span>
                        </td>
                        <td className="w-1/3 px-2 py-3">
                          <div className="flex items-center gap-2">
                            <div className="h-2 flex-1 overflow-hidden rounded-full bg-borda/60">
                              <div
                                className="h-full rounded-full bg-acao"
                                style={{
                                  width: `${(g.vendasCentavos / maiorVenda) * 100}%`,
                                }}
                              />
                            </div>
                            <strong className="w-24 text-right tabular-nums">
                              {formatBRL(g.vendasCentavos)}
                            </strong>
                          </div>
                        </td>
                        <td className="px-2 py-3 text-right tabular-nums">
                          {formatBRL(g.gorjetaCentavos)}
                        </td>
                        <td className="px-2 py-3 text-right tabular-nums">
                          {formatBRL(g.taxaCentavos)}
                        </td>
                        <td className="px-2 py-3 text-center tabular-nums">
                          {g.chamadosAtendidos}
                        </td>
                        <td
                          className={cn(
                            "px-4 py-3 text-center tabular-nums",
                            g.cancelamentos > 0 && "font-bold text-destructive",
                          )}
                        >
                          {g.cancelamentos}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Cartao>

      {/* Estoque baixo + taxa/descontos */}
      <div className="grid gap-3 lg:grid-cols-2">
        <Cartao
          titulo="Estoque baixo"
          icone={Package}
          acao={
            <Link
              href="/gerente?aba=estoque"
              className="flex items-center gap-1 font-semibold text-acao text-sm"
            >
              Ver estoque <ChevronRight className="size-4" />
            </Link>
          }
        >
          {data.estoqueBaixo.length === 0 ? (
            <Vazio texto="Nenhuma bebida acabando." />
          ) : (
            <ul className="flex flex-col divide-y divide-borda">
              {data.estoqueBaixo.map((e) => (
                <li
                  key={e.nome}
                  className="flex items-center justify-between gap-2 py-2 text-sm"
                >
                  <span className="truncate">{e.nome}</span>
                  <span
                    className={cn(
                      "rounded-full px-2.5 py-0.5 font-bold text-xs tabular-nums",
                      e.estoque === 0
                        ? "bg-destructive text-white"
                        : "bg-status-aguardando text-black",
                    )}
                  >
                    {e.estoque === 0 ? "Esgotada" : `${e.estoque} un`}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Cartao>
        <Cartao titulo="Descontos e taxa não cobrada" icone={Ban}>
          {data.descontoCentavos === 0 && data.semTaxa.length === 0 ? (
            <Vazio texto="Nenhum desconto nem conta sem taxa." />
          ) : (
            <div className="flex flex-col gap-3 text-sm">
              {data.descontoCentavos > 0 && (
                <p className="flex justify-between">
                  <span>Descontos dados</span>
                  <strong className="tabular-nums">
                    {formatBRL(data.descontoCentavos)}
                  </strong>
                </p>
              )}
              {data.semTaxa.map((m) => (
                <div key={m.motivo}>
                  <p className="flex justify-between">
                    <span>{ROTULO_MOTIVO_SEM_TAXA[m.motivo]}</span>
                    <strong>
                      {m.quantidade} {m.quantidade === 1 ? "conta" : "contas"}
                    </strong>
                  </p>
                  {m.observacoes.length > 0 && (
                    <p className="text-texto-secundario">
                      {m.observacoes.join(" · ")}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </Cartao>
      </div>

      <Drawer open={verCancelados} onOpenChange={setVerCancelados}>
        <DrawerContent className="max-h-[90dvh]">
          <DrawerHeader className="text-left">
            <DrawerTitle>Cancelamentos da noite</DrawerTitle>
            <p className="text-sm text-texto-secundario">
              {plural(data.cancelamentos.quantidade, "item", "itens")} ·{" "}
              {formatBRL(data.cancelamentos.centavos)}
            </p>
          </DrawerHeader>
          <ul className="flex flex-col divide-y divide-borda overflow-y-auto px-4 pb-6">
            {data.cancelados.map((c) => (
              <li key={c.id} className="flex flex-col gap-1 py-3">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-semibold">
                    {c.quantidade}× {c.nome}
                  </span>
                  <strong className="shrink-0 tabular-nums">
                    {formatBRL(c.centavos)}
                  </strong>
                </div>
                <p className="flex flex-wrap gap-x-3 text-sm text-texto-secundario">
                  <span>
                    Mesa {c.mesa}
                    {c.comanda !== null && ` · cartão ${c.comanda}`}
                  </span>
                  <span>
                    {new Date(c.quando).toLocaleTimeString("pt-BR", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                  {c.quem && <span>por {c.quem}</span>}
                </p>
                {c.motivo && (
                  <p className="text-sm">
                    <span className="text-texto-secundario">Motivo: </span>
                    {c.motivo}
                    {c.preparoIniciado && (
                      <span className="ml-2 rounded-full bg-destructive/15 px-2 py-0.5 font-semibold text-destructive text-xs">
                        já estava em preparo
                      </span>
                    )}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </DrawerContent>
      </Drawer>
    </div>
  );
};
