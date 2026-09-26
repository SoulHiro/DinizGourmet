"use client";

import { useQuery } from "@tanstack/react-query";
import { Banknote, Loader2 } from "lucide-react";
import { useState } from "react";

import { api } from "@/lib/cliente";
import type { ResumoCaixa } from "@/lib/dominio/caixa";
import { type MetodoPagamento, ROTULO_METODO } from "@/lib/dominio/pagamento";
import { cn, formatBRL } from "@/lib/utils";

const Cartao = ({
  titulo,
  valor,
  detalhe,
  destaque,
}: {
  titulo: string;
  valor: string;
  detalhe?: string;
  destaque?: boolean;
}) => (
  <div
    className={cn(
      "rounded-xl border bg-surface p-3",
      destaque ? "border-acao" : "border-borda",
    )}
  >
    <p className="text-sm text-texto-secundario">{titulo}</p>
    <p className="font-bold text-2xl">{valor}</p>
    {detalhe && <p className="text-sm text-texto-secundario">{detalhe}</p>}
  </div>
);

const dataCurta = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  });

// Fechamento do caixa de um turno (12h às 12h do dia seguinte): quanto
// entrou por forma de pagamento e quanto deve ter em dinheiro na gaveta.
export const ResumoDoCaixa = () => {
  const [data, setData] = useState("");
  const { data: resumo, isLoading } = useQuery({
    queryKey: ["mesas", "caixa", "resumo", data],
    queryFn: () =>
      api<ResumoCaixa>(`/api/caixa/resumo${data ? `?data=${data}` : ""}`),
    refetchInterval: 60_000,
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-texto-secundario">Turno que começou em</span>
          <input
            type="date"
            className="h-12 rounded-lg border border-borda bg-surface px-3"
            value={data}
            onChange={(e) => setData(e.target.value)}
          />
        </label>
        {resumo && (
          <p className="mb-3 text-texto-secundario">
            {data ? "" : "Turno atual: "}
            {dataCurta(resumo.desde)} até {dataCurta(resumo.ate)}
          </p>
        )}
      </div>

      {isLoading || !resumo ? (
        <Loader2 className="mx-auto mt-6 size-8 animate-spin text-texto-secundario" />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            <Cartao
              titulo="Total recebido"
              valor={formatBRL(resumo.totalCentavos)}
              detalhe={`${resumo.contas} contas pagas`}
              destaque
            />
            <Cartao
              titulo="Dinheiro na gaveta"
              valor={formatBRL(resumo.dinheiroNaGavetaCentavos)}
              detalhe="sem contar o fundo de troco"
            />
            <Cartao
              titulo="Ticket médio"
              valor={formatBRL(resumo.ticketMedioCentavos)}
            />
            <Cartao
              titulo="Mesas abertas agora"
              valor={String(resumo.contasAbertasAgora)}
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <section className="rounded-xl border border-borda bg-surface p-4">
              <h3 className="mb-3 font-bold">Por forma de pagamento</h3>
              {resumo.porMetodo.length === 0 ? (
                <p className="text-texto-secundario">
                  Nenhum pagamento neste turno.
                </p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {resumo.porMetodo.map((m) => (
                    <li key={m.metodo} className="flex justify-between gap-2">
                      <span>
                        {ROTULO_METODO[m.metodo as MetodoPagamento]}
                        <span className="text-sm text-texto-secundario">
                          {" "}
                          · {m.quantidade}{" "}
                          {m.quantidade === 1 ? "pagamento" : "pagamentos"}
                          {m.trocoCentavos > 0 &&
                            ` · troco dado ${formatBRL(m.trocoCentavos)}`}
                        </span>
                      </span>
                      <strong>{formatBRL(m.valorCentavos)}</strong>
                    </li>
                  ))}
                </ul>
              )}
              {resumo.semMetodoCentavos > 0 && (
                <p className="mt-3 flex items-center gap-2 text-sm text-texto-secundario">
                  <Banknote className="size-4" />
                  {formatBRL(resumo.semMetodoCentavos)} em contas fechadas sem
                  forma de pagamento registrada.
                </p>
              )}
            </section>

            <section className="rounded-xl border border-borda bg-surface p-4">
              <h3 className="mb-3 font-bold">Composição</h3>
              <dl className="grid grid-cols-2 gap-y-2">
                <dt className="text-texto-secundario">Consumo</dt>
                <dd className="text-right">
                  {formatBRL(resumo.consumoCentavos)}
                </dd>
                <dt className="text-texto-secundario">Descontos</dt>
                <dd className="text-right">
                  − {formatBRL(resumo.descontoCentavos)}
                </dd>
                <dt className="text-texto-secundario">Taxa de serviço</dt>
                <dd className="text-right">{formatBRL(resumo.taxaCentavos)}</dd>
                <dt className="text-texto-secundario">Gorjetas</dt>
                <dd className="text-right">
                  {formatBRL(resumo.gorjetaCentavos)}
                </dd>
                <dt className="font-semibold">Total</dt>
                <dd className="text-right font-bold">
                  {formatBRL(resumo.totalCentavos)}
                </dd>
                <dt className="text-texto-secundario">Contas sem taxa</dt>
                <dd className="text-right">{resumo.contasSemTaxa}</dd>
              </dl>
            </section>
          </div>
        </>
      )}
    </div>
  );
};
