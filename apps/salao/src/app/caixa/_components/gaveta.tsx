"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Banknote,
  CheckCircle2,
  Coins,
  CreditCard,
  Landmark,
  Loader2,
  Lock,
  QrCode,
  Ticket,
  Unlock,
  X,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { api } from "@/lib/cliente";
import type { TurnoCaixa } from "@/lib/dominio/turno-caixa";
import { cn, formatBRL } from "@/lib/utils";

const CHAVE = ["mesas", "caixa", "turno"];

const ICONE: Record<string, typeof Banknote> = {
  dinheiro: Banknote,
  pix: QrCode,
  credito: CreditCard,
  debito: CreditCard,
  vale_refeicao: Ticket,
};
const ROTULO: Record<string, string> = {
  dinheiro: "Dinheiro",
  pix: "Pix",
  credito: "Crédito",
  debito: "Débito",
  vale_refeicao: "Vale-refeição",
};

const NOTAS = [20_000, 10_000, 5_000, 2_000, 1_000, 500, 200];

// "150" ou "150,50" -> centavos.
const centavos = (texto: string) => {
  const n = Number(texto.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? Math.round(n * 100) : Number.NaN;
};

const hora = (iso: string) =>
  new Date(iso).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
const dataHora = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

const Valor = ({
  rotulo,
  valor,
  icone: Icone,
  cor,
  destaque,
}: {
  rotulo: string;
  valor: number;
  icone: typeof Banknote;
  cor: string;
  destaque?: boolean;
}) => (
  <div
    className={cn(
      "flex flex-col gap-2 rounded-2xl border bg-surface p-4",
      destaque ? "border-acao" : "border-borda",
    )}
  >
    <div className="flex items-center justify-between">
      <span className="text-sm text-texto-secundario">{rotulo}</span>
      <span
        className={cn(
          "flex size-9 items-center justify-center rounded-xl",
          cor,
        )}
      >
        <Icone className="size-5" />
      </span>
    </div>
    <p
      className={cn(
        "font-bold tabular-nums leading-none",
        destaque ? "text-3xl" : "text-2xl",
      )}
    >
      {formatBRL(valor)}
    </p>
  </div>
);

// Selo da diferença no fechamento: bateu, sobrou ou faltou.
export const Diferenca = ({ centavos: dif }: { centavos: number }) => (
  <span
    className={cn(
      "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 font-bold text-sm tabular-nums",
      dif === 0
        ? "bg-status-livre/15 text-status-livre"
        : dif > 0
          ? "bg-status-aguardando/25 text-texto"
          : "bg-destructive/15 text-destructive",
    )}
  >
    {dif === 0
      ? "Bateu"
      : dif > 0
        ? `Sobrou ${formatBRL(dif)}`
        : `Faltou ${formatBRL(-dif)}`}
  </span>
);

// Gaveta do caixa: abertura com fundo de troco, sangrias e suprimentos,
// e o fechamento com a contagem do dinheiro.
export const Gaveta = () => {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: CHAVE,
    queryFn: () => api<{ turno: TurnoCaixa | null }>("/api/caixa/turno"),
    refetchInterval: 30_000,
  });
  const { data: turnos = [] } = useQuery({
    queryKey: ["mesas", "caixa", "turnos"],
    queryFn: () => api<TurnoCaixa[]>("/api/caixa/turnos"),
  });
  const [fundo, setFundo] = useState("");
  const [movimento, setMovimento] = useState<{
    tipo: "sangria" | "suprimento";
    valor: string;
    motivo: string;
  } | null>(null);
  const [fechando, setFechando] = useState(false);

  const atualizar = () =>
    queryClient.invalidateQueries({ queryKey: ["mesas", "caixa"] });

  const abrir = useMutation({
    mutationFn: () =>
      api("/api/caixa/turno", {
        method: "POST",
        json: { fundoCentavos: centavos(fundo || "0") },
      }),
    onSuccess: () => {
      toast.success("Caixa aberto");
      setFundo("");
      atualizar();
    },
    onError: (e) => toast.error(e.message),
  });

  const registrar = useMutation({
    mutationFn: () => {
      if (!movimento) throw new Error("Nada para registrar");
      const valorCentavos = centavos(movimento.valor);
      if (!(valorCentavos > 0)) throw new Error("Informe o valor");
      return api("/api/caixa/turno/movimentos", {
        method: "POST",
        json: { tipo: movimento.tipo, valorCentavos, motivo: movimento.motivo },
      });
    },
    onSuccess: () => {
      toast.success(
        movimento?.tipo === "sangria"
          ? "Sangria registrada"
          : "Suprimento registrado",
      );
      setMovimento(null);
      atualizar();
    },
    onError: (e) => toast.error(e.message),
  });

  if (isLoading || !data) {
    return (
      <Loader2 className="mx-auto mt-6 size-8 animate-spin text-texto-secundario" />
    );
  }

  const { turno } = data;
  const fechados = turnos.filter((t) => t.fechadoEm);

  if (!turno) {
    return (
      <div className="mx-auto flex max-w-3xl flex-col gap-4">
        <form
          className="flex flex-col gap-4 rounded-2xl border-2 border-acao bg-surface p-5"
          onSubmit={(e) => {
            e.preventDefault();
            abrir.mutate();
          }}
        >
          <div className="flex items-center gap-3">
            <span className="flex size-12 items-center justify-center rounded-xl bg-acao/15 text-acao">
              <Lock className="size-6" />
            </span>
            <div>
              <p className="font-bold text-xl">Caixa fechado</p>
              <p className="text-sm text-texto-secundario">
                Conte o dinheiro de troco que está na gaveta e abra o caixa.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex h-14 min-w-0 flex-1 items-center gap-2 rounded-xl border border-borda bg-fundo px-4">
              <span className="text-texto-secundario">Fundo R$</span>
              <input
                // biome-ignore lint/a11y/noAutofocus: a única ação da tela é informar o fundo
                autoFocus
                inputMode="decimal"
                aria-label="Fundo de troco"
                placeholder="0,00"
                value={fundo}
                onChange={(e) => setFundo(e.target.value)}
                className="h-full min-w-0 flex-1 bg-transparent font-bold text-2xl tabular-nums outline-none"
              />
            </label>
            {[100, 150, 200, 300].map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setFundo(String(v))}
                className="h-14 rounded-xl border border-borda px-4 font-semibold"
              >
                R$ {v}
              </button>
            ))}
          </div>
          <Button
            type="submit"
            variant="acao"
            size="lg"
            disabled={abrir.isPending}
          >
            {abrir.isPending ? (
              <Loader2 className="animate-spin" />
            ) : (
              <Unlock />
            )}
            Abrir caixa
          </Button>
        </form>
        <HistoricoTurnos turnos={fechados} />
      </div>
    );
  }

  const SUGESTOES =
    movimento?.tipo === "sangria"
      ? ["Cofre", "Pagamento a fornecedor", "Vale de funcionário"]
      : ["Reforço de troco", "Troco do cofre"];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-status-livre/40 bg-status-livre/10 px-4 py-3">
        <p className="flex items-center gap-2">
          <span className="size-2.5 animate-pulse rounded-full bg-status-livre" />
          <strong>Caixa aberto</strong>
          <span className="text-texto-secundario">
            desde {dataHora(turno.abertoEm)} por {turno.abertoPor}
          </span>
        </p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() =>
              setMovimento({ tipo: "sangria", valor: "", motivo: "Cofre" })
            }
          >
            <ArrowUpFromLine /> Sangria
          </Button>
          <Button
            variant="outline"
            onClick={() =>
              setMovimento({
                tipo: "suprimento",
                valor: "",
                motivo: "Reforço de troco",
              })
            }
          >
            <ArrowDownToLine /> Suprimento
          </Button>
          <Button variant="acao" onClick={() => setFechando(true)}>
            <Lock /> Fechar caixa
          </Button>
        </div>
      </div>

      {movimento && (
        <form
          className="flex flex-col gap-3 rounded-2xl border-2 border-acao bg-surface p-4"
          onSubmit={(e) => {
            e.preventDefault();
            registrar.mutate();
          }}
        >
          <div className="flex items-center justify-between">
            <p className="flex items-center gap-2 font-bold">
              {movimento.tipo === "sangria" ? (
                <>
                  <ArrowUpFromLine className="size-5 text-destructive" />
                  Sangria (dinheiro que sai da gaveta)
                </>
              ) : (
                <>
                  <ArrowDownToLine className="size-5 text-status-livre" />
                  Suprimento (dinheiro que entra na gaveta)
                </>
              )}
            </p>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              aria-label="Cancelar"
              onClick={() => setMovimento(null)}
            >
              <X />
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            <label className="flex h-12 w-44 items-center gap-2 rounded-xl border border-borda bg-fundo px-3">
              <span className="text-texto-secundario">R$</span>
              <input
                // biome-ignore lint/a11y/noAutofocus: aparece depois do toque em Sangria/Suprimento
                autoFocus
                inputMode="decimal"
                aria-label="Valor"
                placeholder="0,00"
                value={movimento.valor}
                onChange={(e) =>
                  setMovimento({ ...movimento, valor: e.target.value })
                }
                className="h-full min-w-0 flex-1 bg-transparent font-bold text-xl tabular-nums outline-none"
              />
            </label>
            <input
              aria-label="Motivo"
              placeholder="Motivo"
              value={movimento.motivo}
              onChange={(e) =>
                setMovimento({ ...movimento, motivo: e.target.value })
              }
              className="h-12 min-w-48 flex-1 rounded-xl border border-borda bg-fundo px-3"
            />
            <Button type="submit" variant="acao" disabled={registrar.isPending}>
              {registrar.isPending ? (
                <Loader2 className="animate-spin" />
              ) : (
                "Registrar"
              )}
            </Button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {SUGESTOES.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setMovimento({ ...movimento, motivo: s })}
                className={cn(
                  "h-9 rounded-full border px-3 text-sm",
                  movimento.motivo === s
                    ? "border-acao bg-acao/15 font-semibold"
                    : "border-borda text-texto-secundario",
                )}
              >
                {s}
              </button>
            ))}
          </div>
        </form>
      )}

      {fechando && (
        <FecharCaixa
          turno={turno}
          onCancelar={() => setFechando(false)}
          onFechado={() => {
            setFechando(false);
            atualizar();
          }}
        />
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Valor
          rotulo="Esperado na gaveta"
          valor={turno.esperadoCentavos}
          icone={Landmark}
          cor="bg-acao/15 text-acao"
          destaque
        />
        <Valor
          rotulo="Recebido em dinheiro"
          valor={turno.dinheiroCentavos}
          icone={Banknote}
          cor="bg-status-livre/15 text-status-livre"
        />
        <Valor
          rotulo="Recebido no total"
          valor={turno.recebidoCentavos}
          icone={CheckCircle2}
          cor="bg-status-ocupada/15 text-status-ocupada"
        />
        <Valor
          rotulo="Troco devolvido"
          valor={turno.trocoCentavos}
          icone={Coins}
          cor="bg-status-aguardando/20 text-status-aguardando"
        />
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        <section className="flex flex-col gap-3 rounded-2xl border border-borda bg-surface p-4">
          <h3 className="font-bold">Conta da gaveta</h3>
          <dl className="flex flex-col gap-2 text-sm">
            {[
              ["Fundo de troco", turno.fundoCentavos, ""],
              ["+ Dinheiro recebido", turno.dinheiroCentavos, ""],
              ["+ Suprimentos", turno.suprimentosCentavos, ""],
              ["− Sangrias", -turno.sangriasCentavos, "text-destructive"],
            ].map(([rotulo, valor, cor]) => (
              <div key={rotulo as string} className="flex justify-between">
                <dt className="text-texto-secundario">{rotulo}</dt>
                <dd className={cn("tabular-nums", cor as string)}>
                  {formatBRL(Math.abs(valor as number))}
                </dd>
              </div>
            ))}
            <div className="flex justify-between border-borda border-t pt-2 font-bold text-base">
              <dt>Esperado</dt>
              <dd className="tabular-nums">
                {formatBRL(turno.esperadoCentavos)}
              </dd>
            </div>
          </dl>
        </section>

        <section className="flex flex-col gap-3 rounded-2xl border border-borda bg-surface p-4">
          <h3 className="font-bold">Recebido por forma</h3>
          {turno.porMetodo.length === 0 ? (
            <p className="text-sm text-texto-secundario">
              Nenhum pagamento neste caixa ainda.
            </p>
          ) : (
            <ul className="flex flex-col gap-2 text-sm">
              {turno.porMetodo.map((m) => {
                const Icone = ICONE[m.metodo] ?? Banknote;
                return (
                  <li key={m.metodo} className="flex items-center gap-2">
                    <Icone className="size-4 text-texto-secundario" />
                    <span className="flex-1">
                      {ROTULO[m.metodo] ?? m.metodo}
                      <span className="ml-1 text-texto-secundario text-xs">
                        {m.quantidade}×
                      </span>
                    </span>
                    <strong className="tabular-nums">
                      {formatBRL(m.centavos)}
                    </strong>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="flex flex-col gap-3 rounded-2xl border border-borda bg-surface p-4">
          <h3 className="font-bold">Sangrias e suprimentos</h3>
          {turno.movimentos.length === 0 ? (
            <p className="text-sm text-texto-secundario">Nenhum movimento.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-borda text-sm">
              {turno.movimentos.map((m) => (
                <li key={m.id} className="flex items-center gap-2 py-2">
                  {m.tipo === "sangria" ? (
                    <ArrowUpFromLine className="size-4 shrink-0 text-destructive" />
                  ) : (
                    <ArrowDownToLine className="size-4 shrink-0 text-status-livre" />
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">{m.motivo}</span>
                    <span className="text-texto-secundario text-xs">
                      {hora(m.criadoEm)} · {m.quem}
                    </span>
                  </span>
                  <strong
                    className={cn(
                      "tabular-nums",
                      m.tipo === "sangria" && "text-destructive",
                    )}
                  >
                    {m.tipo === "sangria" ? "−" : "+"}
                    {formatBRL(m.valorCentavos)}
                  </strong>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <HistoricoTurnos turnos={fechados} />
    </div>
  );
};

// Fechamento: conta as notas (ou digita o total) e confere com o esperado.
const FecharCaixa = ({
  turno,
  onCancelar,
  onFechado,
}: {
  turno: TurnoCaixa;
  onCancelar: () => void;
  onFechado: () => void;
}) => {
  const [notas, setNotas] = useState<Record<number, string>>({});
  const [moedas, setMoedas] = useState("");
  const [direto, setDireto] = useState("");
  const [observacao, setObservacao] = useState("");

  const pelasNotas =
    NOTAS.reduce((s, n) => s + n * (Number(notas[n]) || 0), 0) +
    (centavos(moedas || "0") || 0);
  const contado = direto ? centavos(direto) : pelasNotas;
  const diferenca = contado - turno.esperadoCentavos;

  const fechar = useMutation({
    mutationFn: () =>
      api<TurnoCaixa>("/api/caixa/turno/fechar", {
        method: "POST",
        json: {
          contadoCentavos: contado,
          observacao: observacao.trim() || undefined,
        },
      }),
    onSuccess: () => {
      toast.success("Caixa fechado");
      onFechado();
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <section className="flex flex-col gap-4 rounded-2xl border-2 border-acao bg-surface p-4">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 font-bold text-lg">
          <Lock className="size-5" /> Fechar caixa
        </h3>
        <Button
          size="icon"
          variant="ghost"
          aria-label="Cancelar"
          onClick={onCancelar}
        >
          <X />
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="flex flex-col gap-2">
          <p className="font-semibold text-sm">Conte as notas da gaveta</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {NOTAS.map((n) => (
              <label
                key={n}
                className="flex items-center gap-2 rounded-xl border border-borda bg-fundo px-3 py-2"
              >
                <span className="w-14 font-semibold text-sm tabular-nums">
                  R$ {n / 100}
                </span>
                <span className="text-texto-secundario">×</span>
                <input
                  inputMode="numeric"
                  aria-label={`Notas de R$ ${n / 100}`}
                  placeholder="0"
                  value={notas[n] ?? ""}
                  onChange={(e) =>
                    setNotas({
                      ...notas,
                      [n]: e.target.value.replace(/\D/g, ""),
                    })
                  }
                  className="h-9 w-full min-w-0 bg-transparent text-right font-bold tabular-nums outline-none"
                />
              </label>
            ))}
            <label className="flex items-center gap-2 rounded-xl border border-borda bg-fundo px-3 py-2">
              <span className="w-14 font-semibold text-sm">Moedas</span>
              <input
                inputMode="decimal"
                aria-label="Total em moedas"
                placeholder="0,00"
                value={moedas}
                onChange={(e) => setMoedas(e.target.value)}
                className="h-9 w-full min-w-0 bg-transparent text-right font-bold tabular-nums outline-none"
              />
            </label>
          </div>
          <label className="flex items-center gap-2 text-sm text-texto-secundario">
            Ou digite o total contado:
            <input
              inputMode="decimal"
              aria-label="Total contado"
              placeholder={formatBRL(pelasNotas)}
              value={direto}
              onChange={(e) => setDireto(e.target.value)}
              className="h-10 w-36 rounded-lg border border-borda bg-fundo px-3 text-right font-bold text-texto tabular-nums"
            />
          </label>
        </div>

        <div className="flex flex-col gap-3 rounded-xl bg-fundo p-4">
          <div className="flex justify-between">
            <span className="text-texto-secundario">Esperado</span>
            <strong className="tabular-nums">
              {formatBRL(turno.esperadoCentavos)}
            </strong>
          </div>
          <div className="flex justify-between">
            <span className="text-texto-secundario">Contado</span>
            <strong className="tabular-nums">
              {Number.isFinite(contado) ? formatBRL(contado) : "—"}
            </strong>
          </div>
          <div className="flex items-center justify-between border-borda border-t pt-3">
            <span className="font-semibold">Diferença</span>
            {Number.isFinite(contado) && <Diferenca centavos={diferenca} />}
          </div>
          <input
            aria-label="Observação do fechamento"
            placeholder={
              diferenca !== 0
                ? "Explique a diferença (opcional)"
                : "Observação (opcional)"
            }
            value={observacao}
            onChange={(e) => setObservacao(e.target.value)}
            className="h-11 rounded-lg border border-borda bg-surface px-3"
          />
          <Button
            variant="acao"
            size="lg"
            disabled={!Number.isFinite(contado) || fechar.isPending}
            onClick={() => fechar.mutate()}
          >
            {fechar.isPending ? <Loader2 className="animate-spin" /> : <Lock />}
            Confirmar fechamento
          </Button>
        </div>
      </div>
    </section>
  );
};

const HistoricoTurnos = ({ turnos }: { turnos: TurnoCaixa[] }) => {
  if (turnos.length === 0) return null;
  return (
    <section className="flex flex-col gap-2 rounded-2xl border border-borda bg-surface p-4">
      <h3 className="font-bold">Caixas anteriores</h3>
      <div className="-mx-4 overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-borda border-b text-left text-texto-secundario text-xs uppercase tracking-wide">
              <th className="px-4 pb-2 font-semibold">Abertura</th>
              <th className="px-2 pb-2 font-semibold">Fechamento</th>
              <th className="px-2 pb-2 text-right font-semibold">Recebido</th>
              <th className="px-2 pb-2 text-right font-semibold">Esperado</th>
              <th className="px-2 pb-2 text-right font-semibold">Contado</th>
              <th className="px-4 pb-2 text-right font-semibold">Diferença</th>
            </tr>
          </thead>
          <tbody>
            {turnos.map((t) => (
              <tr key={t.id} className="border-borda border-b last:border-0">
                <td className="px-4 py-2.5">
                  {dataHora(t.abertoEm)}
                  <span className="block text-texto-secundario text-xs">
                    {t.abertoPor}
                  </span>
                </td>
                <td className="px-2 py-2.5">
                  {t.fechadoEm ? dataHora(t.fechadoEm) : "—"}
                  <span className="block text-texto-secundario text-xs">
                    {t.fechadoPor}
                    {t.observacao && ` · ${t.observacao}`}
                  </span>
                </td>
                <td className="px-2 py-2.5 text-right tabular-nums">
                  {formatBRL(t.recebidoCentavos)}
                </td>
                <td className="px-2 py-2.5 text-right tabular-nums">
                  {formatBRL(t.esperadoCentavos)}
                </td>
                <td className="px-2 py-2.5 text-right tabular-nums">
                  {t.contadoCentavos !== null
                    ? formatBRL(t.contadoCentavos)
                    : "—"}
                </td>
                <td className="px-4 py-2.5 text-right">
                  {t.contadoCentavos !== null && (
                    <Diferenca
                      centavos={t.contadoCentavos - t.esperadoCentavos}
                    />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
};
