"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Banknote,
  CheckCircle2,
  CreditCard,
  Loader2,
  Printer,
  QrCode,
  Receipt,
  ReceiptText,
  RotateCcw,
  Ticket,
  Wallet,
  X,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { useFuncionario } from "@/components/providers/sessao";
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

const ICONE_METODO: Record<MetodoPagamento, typeof Banknote> = {
  dinheiro: Banknote,
  pix: QrCode,
  credito: CreditCard,
  debito: CreditCard,
  vale_refeicao: Ticket,
};

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
    comanda: "",
  });
  const [aberta, setAberta] = useState<string | null>(null);
  // Filtros na tela (não precisam ir ao servidor).
  const [status, setStatus] = useState<ContaHistorico["status"] | null>(null);
  const [metodo, setMetodo] = useState<MetodoPagamento | null>(null);

  const parametros = new URLSearchParams(
    Object.entries(filtro).filter(([, v]) => v !== ""),
  ).toString();
  const { data: todas = [], isFetching } = useQuery({
    queryKey: ["mesas", "caixa", "historico", parametros],
    queryFn: () => api<ContaHistorico[]>(`/api/caixa/historico?${parametros}`),
    enabled: Boolean(filtro.data),
  });

  const data = todas
    .filter((c) => !status || c.status === status)
    .filter((c) => !metodo || c.metodos.includes(metodo));
  const pagas = data.filter((c) => c.status === "fechada");
  const totalPago = pagas.reduce((s, c) => s + c.totalCentavos, 0);
  const metodosDoDia = [...new Set(todas.flatMap((c) => c.metodos))];

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
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-texto-secundario">Comanda</span>
          <input
            inputMode="numeric"
            className={cn(campo, "w-24")}
            placeholder="Todas"
            value={filtro.comanda}
            onChange={(e) =>
              setFiltro({
                ...filtro,
                comanda: e.target.value.replace(/\D/g, ""),
              })
            }
          />
        </label>
        {(filtro.de || filtro.ate || filtro.mesa || filtro.comanda) && (
          <Button
            variant="ghost"
            onClick={() =>
              setFiltro({ ...filtro, de: "", ate: "", mesa: "", comanda: "" })
            }
          >
            Limpar filtros
          </Button>
        )}
        {isFetching && (
          <Loader2 className="mb-3 size-5 animate-spin text-texto-secundario" />
        )}
      </div>

      <div className="flex flex-wrap gap-1.5">
        {(
          [
            [null, "Todas"],
            ["fechada", "Pagas"],
            ["aberta", "Abertas"],
            ["cancelada", "Sem consumo"],
          ] as const
        ).map(([valor, rotulo]) => (
          <button
            key={rotulo}
            type="button"
            aria-pressed={status === valor}
            onClick={() => setStatus(valor)}
            className={cn(
              "h-9 rounded-full border px-3 font-semibold text-sm",
              status === valor
                ? "border-texto bg-texto text-fundo"
                : "border-borda bg-surface text-texto-secundario",
            )}
          >
            {rotulo}
            <span className="ml-1.5 opacity-70">
              {valor
                ? todas.filter((c) => c.status === valor).length
                : todas.length}
            </span>
          </button>
        ))}
        {metodosDoDia.length > 0 && (
          <span className="mx-1 w-px self-stretch bg-borda" />
        )}
        {metodosDoDia.map((m) => {
          const Icone = ICONE_METODO[m];
          return (
            <button
              key={m}
              type="button"
              aria-pressed={metodo === m}
              onClick={() => setMetodo((atual) => (atual === m ? null : m))}
              className={cn(
                "flex h-9 items-center gap-1.5 rounded-full border px-3 font-semibold text-sm",
                metodo === m
                  ? "border-acao bg-acao/15"
                  : "border-borda bg-surface text-texto-secundario",
              )}
            >
              <Icone className="size-4" />
              {ROTULO_METODO[m]}
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          {
            rotulo: "Contas no filtro",
            valor: String(data.length),
            Icone: ReceiptText,
          },
          { rotulo: "Pagas", valor: String(pagas.length), Icone: CheckCircle2 },
          { rotulo: "Total pago", valor: formatBRL(totalPago), Icone: Wallet },
          {
            rotulo: "Ticket médio",
            valor: formatBRL(
              pagas.length ? Math.round(totalPago / pagas.length) : 0,
            ),
            Icone: Receipt,
          },
        ].map((k) => (
          <div
            key={k.rotulo}
            className="flex items-center gap-3 rounded-xl border border-borda bg-surface p-3"
          >
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-acao/15 text-acao">
              <k.Icone className="size-5" />
            </span>
            <span>
              <span className="block text-sm text-texto-secundario">
                {k.rotulo}
              </span>
              <strong className="text-lg tabular-nums">{k.valor}</strong>
            </span>
          </div>
        ))}
      </div>

      <div className="overflow-x-auto rounded-xl border border-borda bg-surface">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-borda border-b text-texto-secundario">
            <tr>
              <th className="p-3 font-semibold">Horário</th>
              <th className="p-3 font-semibold">Comanda</th>
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
                <td className="p-3 font-bold">{c.numero ?? "—"}</td>
                <td className="p-3">{c.mesas.join(" + ")}</td>
                <td className="p-3">{c.titular}</td>
                <td className="p-3">{c.recebidoPor ?? "—"}</td>
                <td className="p-3">
                  {c.metodos.length === 0 ? (
                    "—"
                  ) : (
                    <span className="flex flex-wrap gap-1">
                      {c.metodos.map((m) => {
                        const Icone = ICONE_METODO[m];
                        return (
                          <span
                            key={m}
                            className="inline-flex items-center gap-1 rounded-full bg-fundo px-2 py-0.5 text-xs"
                          >
                            <Icone className="size-3.5" />
                            {ROTULO_METODO[m]}
                          </span>
                        );
                      })}
                    </span>
                  )}
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
                  colSpan={8}
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
  // Correções só do gerente: forma de pagamento e reabrir a conta.
  const eu = useFuncionario();
  const gerente = eu.papel === "gerente";
  const queryClient = useQueryClient();
  const [reabrindo, setReabrindo] = useState(false);
  const [motivo, setMotivo] = useState("");
  const atualizar = () =>
    queryClient.invalidateQueries({ queryKey: ["mesas"] });
  const corrigir = useMutation({
    mutationFn: ({ id, metodo }: { id: string; metodo: MetodoPagamento }) =>
      api(`/api/caixa/pagamentos/${id}`, { method: "PATCH", json: { metodo } }),
    onSuccess: () => {
      toast.success("Forma de pagamento corrigida");
      atualizar();
    },
    onError: (e) => toast.error(e.message),
  });
  const reabrir = useMutation({
    mutationFn: () =>
      api(`/api/caixa/contas/${comandaId}/reabrir`, {
        method: "POST",
        json: { motivo: motivo.trim() },
      }),
    onSuccess: () => {
      toast.success("Conta reaberta. Ela voltou para a mesa.");
      setReabrindo(false);
      atualizar();
    },
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
            {data
              ? `${data.numero ? `Comanda ${data.numero} · ` : ""}Mesa ${data.mesas.join(" + ")}`
              : "Carregando..."}
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
                      <span className="flex flex-col">
                        <span className="flex items-center gap-1.5">
                          {gerente ? (
                            <select
                              aria-label="Corrigir forma de pagamento"
                              value={p.metodo}
                              disabled={corrigir.isPending}
                              onChange={(e) =>
                                corrigir.mutate({
                                  id: p.id,
                                  metodo: e.target.value as MetodoPagamento,
                                })
                              }
                              className="h-8 rounded-md border border-borda bg-fundo px-1 font-semibold"
                            >
                              {Object.entries(ROTULO_METODO).map(([v, r]) => (
                                <option key={v} value={v}>
                                  {r}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <strong>
                              {ROTULO_METODO[p.metodo as MetodoPagamento]}
                            </strong>
                          )}
                          <span className="text-texto-secundario">
                            {hora(p.em)} · {p.recebidoPor}
                          </span>
                        </span>
                        {p.recebidoCentavos !== null && p.trocoCentavos > 0 && (
                          <span className="text-texto-secundario text-xs">
                            recebeu {formatBRL(p.recebidoCentavos)}, troco{" "}
                            {formatBRL(p.trocoCentavos)}
                          </span>
                        )}
                        {p.metodoOriginal && (
                          <span className="text-status-aguardando text-xs">
                            corrigido (era{" "}
                            {ROTULO_METODO[p.metodoOriginal as MetodoPagamento]}
                            )
                          </span>
                        )}
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

            {data.reabertaEm && (
              <p className="rounded-lg bg-status-aguardando/15 px-3 py-2 text-sm">
                Reaberta em {dataHora(data.reabertaEm)}
                {data.reabertaMotivo && `: ${data.reabertaMotivo}`}
              </p>
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

            {gerente &&
              data.status !== "aberta" &&
              (reabrindo ? (
                <form
                  className="flex flex-col gap-2 rounded-xl border-2 border-destructive/50 p-3"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (motivo.trim().length >= 3) reabrir.mutate();
                  }}
                >
                  <p className="text-sm">
                    A conta volta para a mesa sem pagamento, taxa, gorjeta e
                    desconto. Depois é só receber de novo.
                  </p>
                  <input
                    // biome-ignore lint/a11y/noAutofocus: aparece depois do toque em "Reabrir conta"
                    autoFocus
                    aria-label="Motivo da reabertura"
                    placeholder="Motivo (ex.: fechou a mesa errada)"
                    value={motivo}
                    onChange={(e) => setMotivo(e.target.value)}
                    className="h-11 rounded-lg border border-borda bg-fundo px-3"
                  />
                  <div className="flex gap-2">
                    <Button
                      type="submit"
                      variant="destrutivo"
                      className="flex-1"
                      disabled={motivo.trim().length < 3 || reabrir.isPending}
                    >
                      {reabrir.isPending ? (
                        <Loader2 className="animate-spin" />
                      ) : (
                        <RotateCcw />
                      )}
                      Confirmar reabertura
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => setReabrindo(false)}
                    >
                      Cancelar
                    </Button>
                  </div>
                </form>
              ) : (
                <Button variant="ghost" onClick={() => setReabrindo(true)}>
                  <RotateCcw /> Reabrir conta
                </Button>
              ))}
          </div>
        )}
      </div>
    </div>
  );
};
