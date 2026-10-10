"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Banknote,
  CreditCard,
  Landmark,
  Loader2,
  Lock,
  Minus,
  Plus,
  QrCode,
  Ticket,
  Users,
  X,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { useFuncionario } from "@/components/providers/sessao";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/cliente";
import { dividirGorjeta } from "@/lib/dominio/gorjeta";
import type { Desconto } from "@/lib/dominio/insumos";
import type { DetalheMesa } from "@/lib/dominio/mesas";
import {
  conferirPagamentos,
  METODOS_PAGAMENTO,
  type MetodoPagamento,
  type PagamentoInput,
  ROTULO_METODO,
  trocoDe,
} from "@/lib/dominio/pagamento";
import {
  calcularTaxa,
  MOTIVOS_SEM_TAXA,
  type MotivoSemTaxa,
  ROTULO_MOTIVO_SEM_TAXA,
  valorDoDesconto,
} from "@/lib/dominio/taxa";
import { cn, formatBRL } from "@/lib/utils";

type Comanda = NonNullable<DetalheMesa["comanda"]>;

export type ResultadoRecebimento = {
  comandaId: string;
  totalCentavos: number;
  trocoCentavos: number;
};

const ICONE_METODO: Record<MetodoPagamento, typeof Banknote> = {
  dinheiro: Banknote,
  credito: CreditCard,
  debito: Landmark,
  pix: QrCode,
  vale_refeicao: Ticket,
};

// "12,50" -> 1250. Vazio ou inválido vale 0.
export const paraCentavos = (texto: string) =>
  Math.max(
    0,
    Math.round(
      Number.parseFloat(texto.replace(/\./g, "").replace(",", ".") || "0") *
        100,
    ) || 0,
  );
const paraTexto = (centavos: number) =>
  centavos ? (centavos / 100).toFixed(2).replace(".", ",") : "";

// Notas prováveis que o cliente entrega para pagar um valor em dinheiro.
const sugestoesDeNotas = (valor: number) => {
  const opcoes = new Set<number>();
  for (const passo of [500, 1000, 2000, 5000, 10000]) {
    const arredondado = Math.ceil(valor / passo) * passo;
    if (arredondado > valor) opcoes.add(arredondado);
  }
  return [...opcoes].sort((a, b) => a - b).slice(0, 4);
};

// Linha de pagamento: valor vazio = "o que falta" (acompanha o total).
type Linha = {
  id: number;
  metodo: MetodoPagamento;
  valor: string | null;
  recebido: string;
};

// Recebimento da conta: desconto, taxa (com motivo se não cobrar), gorjeta
// e como o cliente pagou (pode dividir; dinheiro calcula o troco). Usado na
// gaveta do garçom e no painel do caixa.
export const Recebimento = ({
  comanda,
  onPago,
  className,
}: {
  comanda: Comanda;
  onPago: (resultado: ResultadoRecebimento) => void;
  className?: string;
}) => {
  const eu = useFuncionario();
  const queryClient = useQueryClient();
  const pedido = comanda.pedidoConta;

  // Parte do que o cliente escolheu no QR, se pediu a conta por lá.
  const [taxaServico, setTaxaServico] = useState(pedido?.taxaServico ?? true);
  const [semTaxaMotivo, setSemTaxaMotivo] = useState<MotivoSemTaxa | null>(
    pedido && !pedido.taxaServico ? "cliente_recusou" : null,
  );
  const [semTaxaObs, setSemTaxaObs] = useState("");
  const [gorjeta, setGorjeta] = useState(
    paraTexto(pedido?.gorjetaCentavos ?? 0),
  );
  // Id de um desconto cadastrado, "livre" (gerente/caixa) ou nenhum.
  const [descontoEscolhido, setDescontoEscolhido] = useState<string | null>(
    null,
  );
  const [descontoLivre, setDescontoLivre] = useState("");
  const [linhas, setLinhas] = useState<Linha[]>([]);
  // Dividir igualmente: cada forma de pagamento tocada recebe uma parte.
  const [partes, setPartes] = useState(1);

  const { data: descontos = [] } = useQuery({
    queryKey: ["descontos"],
    queryFn: () => api<Desconto[]>("/api/descontos"),
    staleTime: 60_000,
  });
  const podeDescontoLivre = eu.papel === "gerente" || eu.papel === "caixa";

  const subtotal = comanda.totalCentavos;
  const descontoCadastrado = descontos.find((d) => d.id === descontoEscolhido);
  const descontoCentavos = descontoCadastrado
    ? valorDoDesconto(descontoCadastrado, subtotal)
    : descontoEscolhido === "livre"
      ? Math.min(paraCentavos(descontoLivre), subtotal)
      : 0;
  // Mesma conta do servidor: a taxa incide sobre o consumo com desconto.
  const taxaCalculada = calcularTaxa(
    subtotal - descontoCentavos,
    comanda.taxaConfig,
  );
  const taxaCentavos = taxaServico ? taxaCalculada.valorCentavos : 0;
  const gorjetaCentavos = paraCentavos(gorjeta);
  const total = subtotal - descontoCentavos + taxaCentavos + gorjetaCentavos;

  // Linha "automática" fica com o que as outras não cobrem.
  const explicitas = linhas
    .filter((l) => l.valor !== null)
    .reduce((s, l) => s + paraCentavos(l.valor ?? ""), 0);
  const valorDaLinha = (l: Linha) =>
    l.valor === null ? Math.max(0, total - explicitas) : paraCentavos(l.valor);
  const pagamentos: PagamentoInput[] = linhas
    .map((l) => ({
      metodo: l.metodo,
      valorCentavos: valorDaLinha(l),
      recebidoCentavos:
        l.metodo === "dinheiro" && l.recebido
          ? paraCentavos(l.recebido)
          : undefined,
    }))
    .filter((p) => p.valorCentavos > 0);
  const situacao = conferirPagamentos(pagamentos, total);
  const faltaMotivo =
    !taxaServico &&
    (!semTaxaMotivo || (semTaxaMotivo === "outro" && !semTaxaObs.trim()));
  const pronto = total === 0 || (situacao.fecha && linhas.length > 0);

  // Parte de cada um (os centavos que sobram ficam com o último).
  const parte = partes > 1 ? Math.floor(total / partes) : 0;
  const adicionar = (metodo: MetodoPagamento) =>
    setLinhas((atual) => {
      if (partes > 1) {
        // Até a penúltima parte o valor é fixo; a última pega o que falta.
        const ultima = atual.length >= partes - 1;
        return [
          ...atual,
          {
            id: Date.now(),
            metodo,
            valor: ultima ? null : paraTexto(parte),
            recebido: "",
          },
        ];
      }
      return [
        // A que estava automática congela no valor atual.
        ...atual.map((l) =>
          l.valor === null ? { ...l, valor: paraTexto(valorDaLinha(l)) } : l,
        ),
        { id: Date.now(), metodo, valor: null, recebido: "" },
      ];
    });
  const mudar = (id: number, campos: Partial<Linha>) =>
    setLinhas((atual) =>
      atual.map((l) => (l.id === id ? { ...l, ...campos } : l)),
    );

  // Prévia da divisão (o servidor refaz a conta ao fechar).
  const dividir = (valor: number) =>
    valor > 0
      ? dividirGorjeta(
          valor,
          comanda.equipe.map((e) => ({
            funcionarioId: e.id,
            baseCentavos: e.baseCentavos,
          })),
          comanda.titularId,
        )
      : [];
  const previaGorjeta = dividir(gorjetaCentavos);
  const previaTaxa = dividir(taxaCentavos);

  const receber = useMutation({
    mutationFn: () =>
      api<ResultadoRecebimento>(`/api/comandas/${comanda.id}/fechar`, {
        method: "POST",
        json: {
          taxaServico,
          gorjetaCentavos,
          ...(taxaServico
            ? {}
            : {
                semTaxaMotivo,
                semTaxaObservacao: semTaxaObs.trim() || undefined,
              }),
          ...(descontoCadastrado
            ? { descontoId: descontoCadastrado.id }
            : descontoEscolhido === "livre" && descontoCentavos > 0
              ? { descontoCentavos }
              : {}),
          pagamentos,
        },
      }),
    onSuccess: (resultado) => {
      for (const chave of ["mesas", "chamados"]) {
        queryClient.invalidateQueries({ queryKey: [chave] });
      }
      queryClient.invalidateQueries({ queryKey: ["caixa"] });
      onPago(resultado);
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      {pedido && (
        <p className="rounded-xl bg-status-conta/10 p-3 text-sm">
          O cliente pediu a conta pelo QR
          {pedido.taxaServico ? " com taxa de serviço" : " sem taxa de serviço"}
          {pedido.gorjetaCentavos > 0 &&
            ` e ${formatBRL(pedido.gorjetaCentavos)} de gorjeta`}
          .
        </p>
      )}

      <dl className="grid grid-cols-2 gap-y-1 rounded-xl border border-borda p-4">
        <dt className="text-texto-secundario">Consumo</dt>
        <dd className="text-right">{formatBRL(subtotal)}</dd>
        {descontoCentavos > 0 && (
          <>
            <dt className="text-texto-secundario">
              Desconto
              {descontoCadastrado && ` (${descontoCadastrado.nome})`}
            </dt>
            <dd className="text-right">− {formatBRL(descontoCentavos)}</dd>
          </>
        )}
        <dt className="text-texto-secundario">
          Taxa de serviço ({taxaCalculada.pct}%)
        </dt>
        <dd className="text-right">
          {taxaServico ? formatBRL(taxaCentavos) : "Não paga"}
        </dd>
        {gorjetaCentavos > 0 && (
          <>
            <dt className="text-texto-secundario">Gorjeta</dt>
            <dd className="text-right">{formatBRL(gorjetaCentavos)}</dd>
          </>
        )}
        <dt className="mt-2 self-center font-semibold">Total a receber</dt>
        <dd className="mt-2 text-right font-bold text-3xl">
          {formatBRL(total)}
        </dd>
      </dl>

      <button
        type="button"
        role="switch"
        aria-checked={taxaServico}
        onClick={() => setTaxaServico((v) => !v)}
        className="flex h-12 items-center justify-between rounded-lg border border-borda px-3 font-semibold"
      >
        Cliente paga a taxa de serviço
        <span
          className={cn(
            "flex h-7 w-12 items-center rounded-full p-0.5 transition-colors",
            taxaServico ? "bg-acao" : "bg-borda",
          )}
        >
          <span
            className={cn(
              "size-6 rounded-full bg-white shadow transition-transform",
              taxaServico && "translate-x-5",
            )}
          />
        </span>
      </button>

      {!taxaServico && (
        <div>
          <p className="mb-2 font-semibold">
            Por que sem taxa?{" "}
            <span className="font-normal text-sm text-texto-secundario">
              (obrigatório)
            </span>
          </p>
          <div className="flex flex-wrap gap-2">
            {MOTIVOS_SEM_TAXA.map((motivo) => (
              <button
                key={motivo}
                type="button"
                aria-pressed={semTaxaMotivo === motivo}
                onClick={() => setSemTaxaMotivo(motivo)}
                className={cn(
                  "min-h-11 rounded-full border-2 px-3 font-semibold text-sm",
                  semTaxaMotivo === motivo
                    ? "border-marca bg-marca text-marca-foreground"
                    : "border-borda bg-surface",
                )}
              >
                {ROTULO_MOTIVO_SEM_TAXA[motivo]}
              </button>
            ))}
          </div>
          {semTaxaMotivo === "outro" && (
            <input
              value={semTaxaObs}
              maxLength={80}
              onChange={(e) => setSemTaxaObs(e.target.value)}
              placeholder="Qual o motivo?"
              className="mt-2 h-12 w-full rounded-lg border border-borda bg-surface px-3"
            />
          )}
        </div>
      )}

      {(descontos.length > 0 || podeDescontoLivre) && (
        <div>
          <p className="mb-2 font-semibold">Desconto</p>
          <div className="flex flex-wrap gap-2">
            <Button
              variant={descontoEscolhido === null ? "marca" : "outline"}
              onClick={() => setDescontoEscolhido(null)}
            >
              Sem desconto
            </Button>
            {descontos.map((d) => {
              // Travado para o garçom ou já usado o máximo da noite.
              const travado = d.somenteGerente && !podeDescontoLivre;
              const esgotado =
                d.limitePorNoite !== null && d.usosHoje >= d.limitePorNoite;
              return (
                <Button
                  key={d.id}
                  variant={descontoEscolhido === d.id ? "marca" : "outline"}
                  disabled={travado || esgotado}
                  title={
                    travado
                      ? "Só o gerente ou o caixa aplicam este desconto"
                      : esgotado
                        ? "Limite desta noite atingido"
                        : undefined
                  }
                  onClick={() => setDescontoEscolhido(d.id)}
                >
                  {travado && <Lock className="size-4" />}
                  {d.nome} ·{" "}
                  {d.tipo === "percentual" ? `${d.valor}%` : formatBRL(d.valor)}
                  {d.limitePorNoite !== null && (
                    <span className="font-normal text-xs opacity-70">
                      {esgotado
                        ? "esgotado"
                        : `resta ${d.limitePorNoite - d.usosHoje}`}
                    </span>
                  )}
                </Button>
              );
            })}
            {podeDescontoLivre && (
              <Button
                variant={descontoEscolhido === "livre" ? "marca" : "outline"}
                onClick={() => setDescontoEscolhido("livre")}
              >
                Valor livre
              </Button>
            )}
          </div>
          {descontoEscolhido === "livre" && (
            <input
              inputMode="decimal"
              placeholder="Desconto (R$)"
              value={descontoLivre}
              onChange={(e) => setDescontoLivre(e.target.value)}
              className="mt-2 h-12 w-full rounded-lg border border-borda bg-surface px-3"
            />
          )}
        </div>
      )}

      <div>
        <p className="mb-2 font-semibold">Gorjeta</p>
        <div className="flex flex-wrap gap-2">
          <Button
            variant={gorjetaCentavos === 0 ? "marca" : "outline"}
            onClick={() => setGorjeta("")}
          >
            Sem gorjeta
          </Button>
          <input
            inputMode="decimal"
            placeholder="Valor (R$)"
            value={gorjeta}
            onChange={(e) => setGorjeta(e.target.value)}
            className="h-12 min-w-36 flex-1 rounded-lg border border-borda bg-surface px-3"
          />
        </div>
      </div>

      {total > 0 && (
        <div>
          <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-borda bg-surface p-2">
            <span className="flex items-center gap-1.5 pl-1 font-semibold text-sm">
              <Users className="size-4" /> Dividir em
            </span>
            <div className="flex items-center rounded-lg border border-borda bg-fundo">
              <button
                type="button"
                aria-label="Menos pessoas"
                disabled={partes <= 1}
                onClick={() => {
                  setPartes((p) => Math.max(1, p - 1));
                  setLinhas([]);
                }}
                className="flex size-10 items-center justify-center disabled:opacity-30"
              >
                <Minus className="size-4" />
              </button>
              <span className="w-8 text-center font-bold text-lg tabular-nums">
                {partes}
              </span>
              <button
                type="button"
                aria-label="Mais pessoas"
                disabled={partes >= 20}
                onClick={() => {
                  setPartes((p) => Math.min(20, p + 1));
                  setLinhas([]);
                }}
                className="flex size-10 items-center justify-center disabled:opacity-30"
              >
                <Plus className="size-4" />
              </button>
            </div>
            <span className="text-sm text-texto-secundario">
              {partes > 1 ? (
                <>
                  <strong className="text-texto">{formatBRL(parte)}</strong>{" "}
                  cada
                  {total - parte * partes > 0 &&
                    ` (o último paga ${formatBRL(total - parte * (partes - 1))})`}
                </>
              ) : (
                "pessoa"
              )}
            </span>
          </div>
          <p className="mb-2 font-semibold">
            Forma de pagamento{" "}
            <span className="font-normal text-sm text-texto-secundario">
              {partes > 1
                ? `(toque uma vez para cada pessoa: ${Math.min(linhas.length, partes)}/${partes})`
                : "(toque em mais de uma para dividir)"}
            </span>
          </p>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
            {METODOS_PAGAMENTO.map((metodo) => {
              const Icone = ICONE_METODO[metodo];
              return (
                <button
                  key={metodo}
                  type="button"
                  onClick={() => adicionar(metodo)}
                  className="flex min-h-16 flex-col items-center justify-center gap-1 rounded-xl border-2 border-borda bg-surface px-2 font-semibold text-sm active:scale-[0.97]"
                >
                  <Icone className="size-5" />
                  {ROTULO_METODO[metodo]}
                </button>
              );
            })}
          </div>

          {linhas.length > 0 && (
            <ul className="mt-3 flex flex-col gap-2">
              {linhas.map((linha) => {
                const valor = valorDaLinha(linha);
                const troco = trocoDe({
                  metodo: linha.metodo,
                  valorCentavos: valor,
                  recebidoCentavos: linha.recebido
                    ? paraCentavos(linha.recebido)
                    : undefined,
                });
                const curto =
                  linha.metodo === "dinheiro" &&
                  linha.recebido !== "" &&
                  paraCentavos(linha.recebido) < valor;
                return (
                  <li
                    key={linha.id}
                    className="rounded-xl border border-borda bg-fundo p-3"
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-28 shrink-0 font-semibold">
                        {ROTULO_METODO[linha.metodo]}
                      </span>
                      <label className="flex h-11 min-w-0 flex-1 items-center gap-1 rounded-lg border border-borda bg-surface px-2">
                        <span className="text-sm text-texto-secundario">
                          R$
                        </span>
                        <input
                          inputMode="decimal"
                          aria-label={`Valor em ${ROTULO_METODO[linha.metodo]}`}
                          value={linha.valor ?? ""}
                          placeholder={paraTexto(valor) || "0,00"}
                          onChange={(e) =>
                            mudar(linha.id, {
                              valor:
                                e.target.value === "" ? null : e.target.value,
                            })
                          }
                          className="h-full min-w-0 flex-1 bg-transparent font-semibold outline-none"
                        />
                      </label>
                      <button
                        type="button"
                        aria-label="Remover pagamento"
                        onClick={() =>
                          setLinhas((atual) =>
                            atual.filter((l) => l.id !== linha.id),
                          )
                        }
                        className="flex size-11 shrink-0 items-center justify-center rounded-lg text-texto-secundario"
                      >
                        <X />
                      </button>
                    </div>

                    {linha.metodo === "dinheiro" && (
                      <div className="mt-2 flex flex-col gap-2">
                        <div className="flex flex-wrap gap-1.5">
                          <Button
                            size="sm"
                            variant={
                              linha.recebido === "" ? "marca" : "outline"
                            }
                            onClick={() => mudar(linha.id, { recebido: "" })}
                          >
                            Valor exato
                          </Button>
                          {sugestoesDeNotas(valor).map((nota) => (
                            <Button
                              key={nota}
                              size="sm"
                              variant={
                                paraCentavos(linha.recebido) === nota
                                  ? "marca"
                                  : "outline"
                              }
                              onClick={() =>
                                mudar(linha.id, { recebido: paraTexto(nota) })
                              }
                            >
                              {formatBRL(nota)}
                            </Button>
                          ))}
                        </div>
                        <label className="flex h-11 items-center gap-2 rounded-lg border border-borda bg-surface px-2">
                          <span className="text-sm text-texto-secundario">
                            Recebido R$
                          </span>
                          <input
                            inputMode="decimal"
                            value={linha.recebido}
                            placeholder={paraTexto(valor)}
                            onChange={(e) =>
                              mudar(linha.id, { recebido: e.target.value })
                            }
                            className="h-full min-w-0 flex-1 bg-transparent font-semibold outline-none"
                          />
                        </label>
                        {curto ? (
                          <p className="font-semibold text-destructive">
                            Faltam{" "}
                            {formatBRL(valor - paraCentavos(linha.recebido))} em
                            dinheiro
                          </p>
                        ) : (
                          troco > 0 && (
                            <p className="flex items-baseline justify-between rounded-lg bg-status-livre/15 px-3 py-2">
                              <span className="font-semibold">Troco</span>
                              <span className="font-bold text-2xl">
                                {formatBRL(troco)}
                              </span>
                            </p>
                          )
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          {linhas.length > 0 && situacao.faltaCentavos !== 0 && (
            <p className="mt-2 font-semibold text-destructive">
              {situacao.faltaCentavos > 0
                ? `Faltam ${formatBRL(situacao.faltaCentavos)}`
                : `Passou ${formatBRL(-situacao.faltaCentavos)} do total`}
            </p>
          )}
        </div>
      )}

      {(previaGorjeta.length > 0 || previaTaxa.length > 0) && (
        <div className="rounded-xl bg-fundo p-3">
          <p className="mb-1 font-semibold text-sm">
            Divisão entre os garçons (pelo valor que cada um lançou)
          </p>
          <ul className="flex flex-col gap-1 text-sm">
            {comanda.equipe.map((e) => {
              const valor = (lista: typeof previaTaxa) =>
                lista.find((p) => p.funcionarioId === e.id)?.valorCentavos ?? 0;
              return (
                <li key={e.id} className="flex justify-between gap-2">
                  <span>
                    {e.nome}
                    <span className="text-texto-secundario">
                      {" "}
                      · lançou {formatBRL(e.baseCentavos)}
                    </span>
                  </span>
                  <span className="text-right">
                    {previaTaxa.length > 0 && (
                      <span className="block">
                        taxa <strong>{formatBRL(valor(previaTaxa))}</strong>
                      </span>
                    )}
                    {previaGorjeta.length > 0 && (
                      <span className="block">
                        gorjeta{" "}
                        <strong>{formatBRL(valor(previaGorjeta))}</strong>
                      </span>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <div className="sticky bottom-0 -mx-1 bg-surface px-1 pt-1 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        {!pronto && total > 0 && linhas.length === 0 && (
          <p className="mb-2 text-center text-sm text-texto-secundario">
            Escolha a forma de pagamento.
          </p>
        )}
        <Button
          variant="acao"
          size="lg"
          className="w-full"
          disabled={receber.isPending || !pronto || faltaMotivo}
          onClick={() => receber.mutate()}
        >
          {receber.isPending ? (
            <Loader2 className="animate-spin" />
          ) : situacao.trocoCentavos > 0 ? (
            `Conta paga · troco ${formatBRL(situacao.trocoCentavos)}`
          ) : (
            `Conta paga · ${formatBRL(total)}`
          )}
        </Button>
      </div>
    </div>
  );
};
