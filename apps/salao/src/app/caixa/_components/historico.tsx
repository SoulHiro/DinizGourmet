"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { Loader2, Printer, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { api } from "@/lib/cliente";
import type { ContaHistorico, DetalheConta } from "@/lib/dominio/caixa";
import { type MetodoPagamento, ROTULO_METODO } from "@/lib/dominio/pagamento";
import { ROTULO_MOTIVO_SEM_TAXA } from "@/lib/dominio/taxa";
import { cn, formatBRL } from "@/lib/utils";

const campo = "h-12 rounded-lg border border-borda bg-surface px-3";

const hoje = () =>
  new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });

const hora = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "America/Sao_Paulo",
      })
    : "—";

const dataHora = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  });

const ROTULO_STATUS = {
  aberta: { texto: "Aberta", classe: "bg-status-ocupada text-white" },
  fechada: { texto: "Paga", classe: "bg-status-livre text-white" },
  cancelada: { texto: "Sem consumo", classe: "bg-borda text-texto" },
} as const;

// Histórico de contas: qualquer dia, faixa de horário e mesa. Cada conta abre
// com tudo o que aconteceu nela (para conferir no fim do mês).
export const HistoricoContas = () => {
  const [filtro, setFiltro] = useState({
    data: hoje(),
    de: "",
    ate: "",
    mesa: "",
  });
  const [aberta, setAberta] = useState<string | null>(null);

  const parametros = new URLSearchParams(
    Object.entries(filtro).filter(([, v]) => v !== ""),
  ).toString();
  const { data = [], isFetching } = useQuery({
    queryKey: ["mesas", "caixa", "historico", parametros],
    queryFn: () => api<ContaHistorico[]>(`/api/caixa/historico?${parametros}`),
    enabled: Boolean(filtro.data),
  });

  const pagas = data.filter((c) => c.status === "fechada");

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-texto-secundario">Dia</span>
          <input
            type="date"
            className={campo}
            value={filtro.data}
            max={hoje()}
            onChange={(e) => setFiltro({ ...filtro, data: e.target.value })}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-texto-secundario">Das</span>
          <input
            type="time"
            className={campo}
            value={filtro.de}
            onChange={(e) => setFiltro({ ...filtro, de: e.target.value })}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-texto-secundario">Até</span>
          <input
            type="time"
            className={campo}
            value={filtro.ate}
            onChange={(e) => setFiltro({ ...filtro, ate: e.target.value })}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-texto-secundario">Mesa</span>
          <input
            inputMode="numeric"
            className={cn(campo, "w-24")}
            placeholder="Todas"
            value={filtro.mesa}
            onChange={(e) =>
              setFiltro({ ...filtro, mesa: e.target.value.replace(/\D/g, "") })
            }
          />
        </label>
        {(filtro.de || filtro.ate || filtro.mesa) && (
          <Button
            variant="ghost"
            onClick={() => setFiltro({ ...filtro, de: "", ate: "", mesa: "" })}
          >
            Limpar filtros
          </Button>
        )}
        {isFetching && (
          <Loader2 className="mb-3 size-5 animate-spin text-texto-secundario" />
        )}
      </div>

      <p className="text-texto-secundario">
        {data.length} {data.length === 1 ? "conta" : "contas"} abertas no
        período · {pagas.length} pagas ·{" "}
        <strong className="text-texto">
          {formatBRL(pagas.reduce((s, c) => s + c.totalCentavos, 0))}
        </strong>
      </p>

      <div className="overflow-x-auto rounded-xl border border-borda bg-surface">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-borda border-b text-texto-secundario">
            <tr>
              <th className="p-3 font-semibold">Horário</th>
              <th className="p-3 font-semibold">Mesa</th>
              <th className="p-3 font-semibold">Garçom</th>
              <th className="p-3 font-semibold">Recebido por</th>
              <th className="p-3 font-semibold">Pagamento</th>
              <th className="p-3 text-right font-semibold">Total</th>
              <th className="p-3 font-semibold">Situação</th>
            </tr>
          </thead>
          <tbody>
            {data.map((c) => (
              <tr
                key={c.comandaId}
                onClick={() => setAberta(c.comandaId)}
                className="cursor-pointer border-borda border-b last:border-0 hover:bg-fundo"
              >
                <td className="p-3">
                  {hora(c.abertaEm)} – {hora(c.fechadaEm)}
                </td>
                <td className="p-3 font-semibold">{c.mesas.join(" + ")}</td>
                <td className="p-3">{c.titular}</td>
                <td className="p-3">{c.recebidoPor ?? "—"}</td>
                <td className="p-3">
                  {c.metodos.map((m) => ROTULO_METODO[m]).join(" + ") || "—"}
                </td>
                <td className="p-3 text-right font-semibold">
                  {formatBRL(c.totalCentavos)}
                </td>
                <td className="p-3">
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 font-semibold text-xs",
                      ROTULO_STATUS[c.status].classe,
                    )}
                  >
                    {ROTULO_STATUS[c.status].texto}
                  </span>
                </td>
              </tr>
            ))}
            {data.length === 0 && (
              <tr>
                <td
                  colSpan={7}
                  className="p-8 text-center text-texto-secundario"
                >
                  Nenhuma conta neste período.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {aberta && (
        <DetalheDaConta comandaId={aberta} onFechar={() => setAberta(null)} />
      )}
    </div>
  );
};

const DetalheDaConta = ({
  comandaId,
  onFechar,
}: {
  comandaId: string;
  onFechar: () => void;
}) => {
  const { data } = useQuery({
    queryKey: ["mesas", "caixa", "conta", comandaId],
    queryFn: () => api<DetalheConta>(`/api/caixa/contas/${comandaId}`),
  });
  const imprimir = useMutation({
    mutationFn: () =>
      api(`/api/caixa/contas/${comandaId}/imprimir`, { method: "POST" }),
    onSuccess: () => toast.success("Enviado para a impressora do caixa"),
    onError: (e) => toast.error(e.message),
  });

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Detalhe da conta"
      className="fixed inset-0 z-50 flex justify-end bg-black/40"
      onClick={onFechar}
      onKeyDown={(e) => e.key === "Escape" && onFechar()}
    >
      {/* biome-ignore lint/a11y/noStaticElementInteractions: só impede o clique de fechar o painel */}
      <div
        className="flex h-full w-full max-w-xl flex-col bg-surface shadow-xl"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={() => {}}
      >
        <div className="flex items-center justify-between border-borda border-b p-4">
          <h2 className="font-bold text-xl">
            {data ? `Mesa ${data.mesas.join(" + ")}` : "Carregando..."}
          </h2>
          <button
            type="button"
            aria-label="Fechar"
            onClick={onFechar}
            className="flex size-10 items-center justify-center rounded-lg"
          >
            <X />
          </button>
        </div>

        {!data ? (
          <Loader2 className="mx-auto mt-8 size-8 animate-spin text-texto-secundario" />
        ) : (
          <div className="flex flex-col gap-5 overflow-y-auto p-4">
            <dl className="grid grid-cols-2 gap-y-1 text-sm">
              <dt className="text-texto-secundario">Aberta</dt>
              <dd>{dataHora(data.abertaEm)}</dd>
              <dt className="text-texto-secundario">Paga</dt>
              <dd>{data.fechadaEm ? dataHora(data.fechadaEm) : "—"}</dd>
              <dt className="text-texto-secundario">Atendimento</dt>
              <dd>
                {data.equipe
                  .map(
                    (e) =>
                      `${e.nome}${e.papel === "auxiliar" ? " (aux.)" : ""}`,
                  )
                  .join(", ")}
              </dd>
              <dt className="text-texto-secundario">Recebido por</dt>
              <dd>{data.recebidoPor ?? "—"}</dd>
            </dl>

            <section>
              <h3 className="mb-2 font-bold">Pedidos</h3>
              <ol className="flex flex-col gap-3">
                {data.rodadas.map((r) => (
                  <li
                    key={r.numero}
                    className="rounded-lg border border-borda p-3"
                  >
                    <p className="mb-1 text-sm text-texto-secundario">
                      Pedido {r.numero} · {hora(r.lancadaEm)} · {r.garcom}
                    </p>
                    <ul className="flex flex-col gap-1">
                      {r.itens.map((i) => (
                        <li key={i.id} className="text-sm">
                          <div
                            className={cn(
                              "flex justify-between gap-2",
                              i.status === "cancelado" &&
                                "text-texto-secundario line-through",
                            )}
                          >
                            <span>
                              {i.quantidade}× {i.nome}
                              {data.mesas.length > 1 &&
                                ` (mesa ${i.mesaOrigem})`}
                              {i.editado && (
                                <span className="ml-1 rounded bg-borda px-1 text-xs no-underline">
                                  editado
                                </span>
                              )}
                            </span>
                            <span>{formatBRL(i.totalCentavos)}</span>
                          </div>
                          {(i.modificadores.length > 0 || i.observacao) && (
                            <p className="text-texto-secundario text-xs">
                              {[i.modificadores.join(", "), i.observacao]
                                .filter(Boolean)
                                .join(" · ")}
                            </p>
                          )}
                          {i.status === "cancelado" && (
                            <p className="text-destructive text-xs">
                              {i.motivo === "Alterado"
                                ? "Substituído por uma edição"
                                : `Cancelado por ${i.canceladoPor} às ${hora(i.canceladoEm)}: ${i.motivo}`}
                            </p>
                          )}
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ol>
            </section>

            <section>
              <h3 className="mb-2 font-bold">Valores</h3>
              <dl className="grid grid-cols-2 gap-y-1">
                <dt className="text-texto-secundario">Consumo</dt>
                <dd className="text-right">
                  {formatBRL(data.conta.subtotalCentavos)}
                </dd>
                {data.conta.descontoCentavos > 0 && (
                  <>
                    <dt className="text-texto-secundario">
                      Desconto ({data.conta.descontoNome})
                    </dt>
                    <dd className="text-right">
                      − {formatBRL(data.conta.descontoCentavos)}
                    </dd>
                  </>
                )}
                <dt className="text-texto-secundario">Taxa de serviço</dt>
                <dd className="text-right">
                  {data.semTaxaMotivo
                    ? "Não cobrada"
                    : formatBRL(data.conta.taxaCentavos)}
                </dd>
                {data.semTaxaMotivo && (
                  <dd className="col-span-2 text-sm text-texto-secundario">
                    Motivo: {ROTULO_MOTIVO_SEM_TAXA[data.semTaxaMotivo]}
                    {data.semTaxaObservacao && ` — ${data.semTaxaObservacao}`}
                  </dd>
                )}
                {data.conta.gorjetaCentavos > 0 && (
                  <>
                    <dt className="text-texto-secundario">Gorjeta</dt>
                    <dd className="text-right">
                      {formatBRL(data.conta.gorjetaCentavos)}
                    </dd>
                  </>
                )}
                <dt className="font-bold">Total</dt>
                <dd className="text-right font-bold text-xl">
                  {formatBRL(data.conta.totalCentavos)}
                </dd>
              </dl>
            </section>

            {data.pagamentos.length > 0 && (
              <section>
                <h3 className="mb-2 font-bold">Pagamento</h3>
                <ul className="flex flex-col gap-1 text-sm">
                  {data.pagamentos.map((p) => (
                    <li
                      key={`${p.metodo}-${p.em}-${p.valorCentavos}`}
                      className="flex justify-between gap-2"
                    >
                      <span>
                        {ROTULO_METODO[p.metodo as MetodoPagamento]} ·{" "}
                        {hora(p.em)} · {p.recebidoPor}
                        {p.recebidoCentavos !== null &&
                          ` · recebeu ${formatBRL(p.recebidoCentavos)}, troco ${formatBRL(p.trocoCentavos)}`}
                      </span>
                      <strong>{formatBRL(p.valorCentavos)}</strong>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {data.repasses.length > 0 && (
              <section>
                <h3 className="mb-2 font-bold">Divisão entre os garçons</h3>
                <ul className="flex flex-col gap-1 text-sm">
                  {data.repasses.map((r) => (
                    <li
                      key={`${r.nome}-${r.tipo}`}
                      className="flex justify-between"
                    >
                      <span>
                        {r.nome} · {r.tipo === "taxa" ? "taxa" : "gorjeta"}
                      </span>
                      <span>{formatBRL(r.valorCentavos)}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <Button
              disabled={imprimir.isPending}
              onClick={() => imprimir.mutate()}
            >
              <Printer />
              {data.status === "aberta"
                ? "Imprimir conta"
                : "Reimprimir comprovante"}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};
