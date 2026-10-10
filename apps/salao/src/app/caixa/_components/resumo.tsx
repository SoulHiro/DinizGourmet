"use client";

import { useQuery } from "@tanstack/react-query";
import {
  BadgePercent,
  Banknote,
  CalendarDays,
  Clock,
  CreditCard,
  Download,
  HandCoins,
  Loader2,
  QrCode,
  Receipt,
  ReceiptText,
  Sofa,
  Ticket,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { useState } from "react";

import { BarrasVerticais, Rosca } from "@/app/gerente/_components/graficos";
import { api } from "@/lib/cliente";
import type { ResumoCaixa } from "@/lib/dominio/caixa";
import { type MetodoPagamento, ROTULO_METODO } from "@/lib/dominio/pagamento";
import { ROTULO_MOTIVO_SEM_TAXA } from "@/lib/dominio/taxa";
import { cn, formatBRL } from "@/lib/utils";

// Cor fixa por forma de pagamento (a mesma em qualquer gráfico/turno).
const METODO_VISUAL: Record<
  MetodoPagamento,
  { cor: string; Icone: typeof Banknote }
> = {
  pix: { cor: "var(--serie-1)", Icone: QrCode },
  credito: { cor: "var(--serie-2)", Icone: CreditCard },
  debito: { cor: "var(--serie-3)", Icone: CreditCard },
  vale_refeicao: { cor: "var(--serie-4)", Icone: Ticket },
  dinheiro: { cor: "var(--serie-6)", Icone: Banknote },
};

const dataCurta = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  });

// AAAA-MM-DD do turno N dias atrás (o turno começa ao meio-dia).
const turnoDe = (diasAtras: number) => {
  const agora = new Date();
  const brasilia = new Date(
    agora.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }),
  );
  if (brasilia.getHours() < 12) brasilia.setDate(brasilia.getDate() - 1);
  brasilia.setDate(brasilia.getDate() - diasAtras);
  return brasilia.toLocaleDateString("sv-SE");
};

const Indicador = ({
  rotulo,
  valor,
  icone: Icone,
  cor,
  detalhe,
  destaque,
}: {
  rotulo: string;
  valor: string;
  icone: typeof Banknote;
  cor: string;
  detalhe?: React.ReactNode;
  destaque?: boolean;
}) => (
  <div
    className={cn(
      "flex flex-col gap-2 rounded-2xl border bg-surface p-4",
      destaque ? "border-acao" : "border-borda",
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
    {detalhe && <div className="text-sm text-texto-secundario">{detalhe}</div>}
  </div>
);

const reais = (c: number) => (c / 100).toFixed(2).replace(".", ",");

const exportar = (r: ResumoCaixa) => {
  const linhas: (string | number)[][] = [
    ["Resumo do caixa"],
    ["De", dataCurta(r.desde)],
    ["Até", dataCurta(r.ate)],
    [],
    ["Indicador", "Valor (R$)"],
    ["Total recebido", reais(r.totalCentavos)],
    ["Consumo", reais(r.consumoCentavos)],
    ["Descontos", reais(r.descontoCentavos)],
    ["Taxa de serviço", reais(r.taxaCentavos)],
    ["Gorjetas", reais(r.gorjetaCentavos)],
    ["Contas pagas", r.contas],
    ["Ticket médio", reais(r.ticketMedioCentavos)],
    ["Dinheiro recebido", reais(r.dinheiroNaGavetaCentavos)],
    [],
    ["Forma de pagamento", "Pagamentos", "Valor (R$)", "Troco (R$)"],
    ...r.porMetodo.map((m) => [
      ROTULO_METODO[m.metodo as MetodoPagamento],
      m.quantidade,
      reais(m.valorCentavos),
      reais(m.trocoCentavos),
    ]),
    [],
    ["Hora", "Recebido (R$)"],
    ...[...r.porHora]
      .sort((a, b) => ((a.hora + 12) % 24) - ((b.hora + 12) % 24))
      .map((h) => [`${h.hora}h`, reais(h.centavos)]),
  ];
  const csv = `﻿${linhas.map((l) => l.join(";")).join("\r\n")}`;
  const url = URL.createObjectURL(
    new Blob([csv], { type: "text/csv;charset=utf-8" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = `caixa-${r.desde.slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
};

// Resumo de um turno (12h às 12h do dia seguinte): quanto entrou, como os
// clientes pagaram, em que horas e o que compõe o total.
export const ResumoDoCaixa = () => {
  const [data, setData] = useState("");
  const { data: resumo, isLoading } = useQuery({
    queryKey: ["mesas", "caixa", "resumo", data],
    queryFn: () =>
      api<ResumoCaixa>(`/api/caixa/resumo${data ? `?data=${data}` : ""}`),
    refetchInterval: data ? false : 60_000,
  });

  const dias = [0, 1, 2, 3, 4, 5, 6].map((d) => ({
    d,
    valor: d === 0 ? "" : turnoDe(d),
    rotulo:
      d === 0
        ? "Hoje"
        : d === 1
          ? "Ontem"
          : new Date(`${turnoDe(d)}T12:00:00`)
              .toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit" })
              .replace(".", ""),
  }));

  if (isLoading || !resumo) {
    return (
      <Loader2 className="mx-auto mt-6 size-8 animate-spin text-texto-secundario" />
    );
  }

  const variacao = resumo.anteriorTotalCentavos
    ? Math.round(
        ((resumo.totalCentavos - resumo.anteriorTotalCentavos) /
          resumo.anteriorTotalCentavos) *
          100,
      )
    : null;

  // Horas do turno com recebimento, em ordem (18h ... 0h, 1h).
  const ordem = (h: number) => (h < 12 ? h + 24 : h);
  const horas = resumo.porHora.map((h) => ordem(h.hora));
  const barras = horas.length
    ? Array.from(
        { length: Math.max(...horas) - Math.min(...horas) + 1 },
        (_, i) => {
          const h = (Math.min(...horas) + i) % 24;
          return {
            chave: String(h),
            rotulo: `${h}h`,
            centavos: resumo.porHora.find((p) => p.hora === h)?.centavos ?? 0,
          };
        },
      )
    : [];

  const composicao = [
    { rotulo: "Consumo", valor: resumo.consumoCentavos, sinal: "" },
    { rotulo: "Descontos", valor: -resumo.descontoCentavos, sinal: "−" },
    { rotulo: "Taxa de serviço", valor: resumo.taxaCentavos, sinal: "+" },
    { rotulo: "Gorjetas", valor: resumo.gorjetaCentavos, sinal: "+" },
  ];
  const maiorComposicao = Math.max(
    ...composicao.map((c) => Math.abs(c.valor)),
    resumo.totalCentavos,
    1,
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="-mx-3 flex flex-1 gap-1.5 overflow-x-auto px-3 [scrollbar-width:none]">
          {dias.map((d) => (
            <button
              key={d.d}
              type="button"
              aria-pressed={data === d.valor}
              onClick={() => setData(d.valor)}
              className={cn(
                "h-10 shrink-0 rounded-full border px-4 font-semibold text-sm",
                data === d.valor
                  ? "border-texto bg-texto text-fundo"
                  : "border-borda bg-surface text-texto-secundario",
              )}
            >
              {d.rotulo}
            </button>
          ))}
          <label className="flex h-10 shrink-0 items-center gap-2 rounded-full border border-borda bg-surface px-3 text-sm">
            <CalendarDays className="size-4 text-texto-secundario" />
            <input
              type="date"
              aria-label="Outro dia"
              className="bg-transparent outline-none"
              value={dias.some((d) => d.valor === data) ? "" : data}
              onChange={(e) => setData(e.target.value)}
            />
          </label>
        </div>
        <span className="text-sm text-texto-secundario">
          {dataCurta(resumo.desde)} – {dataCurta(resumo.ate)}
        </span>
        <button
          type="button"
          onClick={() => exportar(resumo)}
          className="flex h-10 items-center gap-2 rounded-full border border-borda bg-surface px-4 font-semibold text-sm"
        >
          <Download className="size-4" /> Exportar
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Indicador
          rotulo="Total recebido"
          valor={formatBRL(resumo.totalCentavos)}
          icone={Wallet}
          cor="bg-acao/15 text-acao"
          destaque
          detalhe={
            variacao === null ? (
              `${resumo.contas} contas pagas`
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
                  vs. turno anterior
                </span>
              </span>
            )
          }
        />
        <Indicador
          rotulo="Contas pagas"
          valor={String(resumo.contas)}
          icone={ReceiptText}
          cor="bg-status-livre/15 text-status-livre"
          detalhe={`Ticket médio ${formatBRL(resumo.ticketMedioCentavos)}`}
        />
        <Indicador
          rotulo="Em aberto agora"
          valor={formatBRL(resumo.emAbertoCentavos)}
          icone={Sofa}
          cor="bg-status-chamado/15 text-status-chamado"
          detalhe={`${resumo.contasAbertasAgora} ${resumo.contasAbertasAgora === 1 ? "comanda aberta" : "comandas abertas"}`}
        />
        <Indicador
          rotulo="Dinheiro recebido"
          valor={formatBRL(resumo.dinheiroNaGavetaCentavos)}
          icone={Banknote}
          cor="bg-(--serie-6)/15 text-(--serie-6)"
          detalhe="Sem contar o fundo (veja a aba Gaveta)"
        />
        <Indicador
          rotulo="Taxa de serviço"
          valor={formatBRL(resumo.taxaCentavos)}
          icone={HandCoins}
          cor="bg-(--serie-5)/15 text-(--serie-5)"
          detalhe={`${resumo.contasSemTaxa} ${resumo.contasSemTaxa === 1 ? "conta" : "contas"} sem taxa`}
        />
        <Indicador
          rotulo="Gorjetas"
          valor={formatBRL(resumo.gorjetaCentavos)}
          icone={HandCoins}
          cor="bg-status-aguardando/20 text-status-aguardando"
        />
        <Indicador
          rotulo="Descontos dados"
          valor={formatBRL(resumo.descontoCentavos)}
          icone={BadgePercent}
          cor="bg-destructive/15 text-destructive"
        />
        <Indicador
          rotulo="Consumo"
          valor={formatBRL(resumo.consumoCentavos)}
          icone={Receipt}
          cor="bg-status-ocupada/15 text-status-ocupada"
          detalhe="Itens das contas pagas"
        />
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        <section className="flex flex-col gap-4 rounded-2xl border border-borda bg-surface p-4">
          <h3 className="flex items-center gap-2 font-bold">
            <Wallet className="size-5 text-texto-secundario" /> Formas de
            pagamento
          </h3>
          {resumo.porMetodo.length === 0 ? (
            <p className="py-6 text-center text-sm text-texto-secundario">
              Nenhum pagamento neste turno.
            </p>
          ) : (
            <>
              <div className="w-40 self-center">
                <Rosca
                  centro={formatBRL(resumo.recebidoCentavos)}
                  subtitulo="recebido"
                  fatias={resumo.porMetodo.map((m) => ({
                    rotulo: ROTULO_METODO[m.metodo as MetodoPagamento],
                    valor: m.valorCentavos,
                    cor: METODO_VISUAL[m.metodo as MetodoPagamento].cor,
                  }))}
                />
              </div>
              <ul className="flex flex-col gap-2 text-sm">
                {resumo.porMetodo.map((m) => {
                  const v = METODO_VISUAL[m.metodo as MetodoPagamento];
                  return (
                    <li key={m.metodo} className="flex items-center gap-2">
                      <span
                        className="size-3 shrink-0 rounded-[3px]"
                        style={{ background: v.cor }}
                      />
                      <v.Icone className="size-4 text-texto-secundario" />
                      <span className="flex-1">
                        {ROTULO_METODO[m.metodo as MetodoPagamento]}
                        <span className="ml-1 text-texto-secundario text-xs">
                          {m.quantidade}×
                          {m.trocoCentavos > 0 &&
                            ` · troco ${formatBRL(m.trocoCentavos)}`}
                        </span>
                      </span>
                      <span className="text-texto-secundario tabular-nums">
                        {Math.round(
                          (m.valorCentavos / resumo.recebidoCentavos) * 100,
                        )}
                        %
                      </span>
                      <strong className="w-24 text-right tabular-nums">
                        {formatBRL(m.valorCentavos)}
                      </strong>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
          {resumo.semMetodoCentavos > 0 && (
            <p className="text-texto-secundario text-xs">
              {formatBRL(resumo.semMetodoCentavos)} em contas fechadas sem forma
              de pagamento registrada.
            </p>
          )}
        </section>

        <section className="flex flex-col gap-4 rounded-2xl border border-borda bg-surface p-4 lg:col-span-2">
          <h3 className="flex items-center gap-2 font-bold">
            <Clock className="size-5 text-texto-secundario" /> Recebido por hora
          </h3>
          {barras.length === 0 ? (
            <p className="py-6 text-center text-sm text-texto-secundario">
              Nenhum pagamento neste turno.
            </p>
          ) : (
            <BarrasVerticais dados={barras} />
          )}
        </section>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <section className="flex flex-col gap-3 rounded-2xl border border-borda bg-surface p-4">
          <h3 className="flex items-center gap-2 font-bold">
            <ReceiptText className="size-5 text-texto-secundario" /> De onde vem
            o total
          </h3>
          <ul className="flex flex-col gap-3 text-sm">
            {composicao.map((c) => (
              <li key={c.rotulo} className="flex flex-col gap-1">
                <div className="flex justify-between">
                  <span>{c.rotulo}</span>
                  <span
                    className={cn(
                      "font-semibold tabular-nums",
                      c.valor < 0 && "text-destructive",
                    )}
                  >
                    {c.sinal} {formatBRL(Math.abs(c.valor))}
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-borda/60">
                  <div
                    className={cn(
                      "h-full rounded-full",
                      c.valor < 0 ? "bg-destructive" : "bg-acao",
                    )}
                    style={{
                      width: `${(Math.abs(c.valor) / maiorComposicao) * 100}%`,
                    }}
                  />
                </div>
              </li>
            ))}
            <li className="flex justify-between border-borda border-t pt-3 font-bold text-base">
              <span>Total recebido</span>
              <span className="tabular-nums">
                {formatBRL(resumo.totalCentavos)}
              </span>
            </li>
          </ul>
        </section>

        <section className="flex flex-col gap-3 rounded-2xl border border-borda bg-surface p-4">
          <h3 className="flex items-center gap-2 font-bold">
            <HandCoins className="size-5 text-texto-secundario" /> Taxa não
            cobrada
          </h3>
          {resumo.motivosSemTaxa.length === 0 ? (
            <p className="py-6 text-center text-sm text-texto-secundario">
              Todas as contas pagaram a taxa de serviço.
            </p>
          ) : (
            <ul className="flex flex-col divide-y divide-borda text-sm">
              {resumo.motivosSemTaxa.map((m) => (
                <li key={m.motivo} className="flex justify-between py-2">
                  <span>{ROTULO_MOTIVO_SEM_TAXA[m.motivo]}</span>
                  <strong>
                    {m.quantidade} {m.quantidade === 1 ? "conta" : "contas"}
                  </strong>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
};
