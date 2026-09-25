"use client";

import { Check, Heart, Receipt } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { cn, formatBRL } from "@/lib/utils";

export type ContaPublica = {
  mesa: number;
  aberta: boolean;
  mesas: number[];
  itens: {
    id: string;
    nome: string;
    quantidade: number;
    totalCentavos: number;
    modificadores: string[];
    observacao: string | null;
  }[];
  totalCentavos: number;
  taxa: { pct: number; valorCentavos: number; limiteCentavos: number };
};

export type EscolhaConta = { taxaServico: boolean; gorjetaCentavos: number };

const GORJETAS_RAPIDAS = [0, 500, 1000, 2000];

// "12,50" -> 1250. Aceita vírgula ou ponto; vazio vale 0.
const paraCentavos = (texto: string) => {
  const valor = Number(texto.replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(valor) && valor > 0 ? Math.round(valor * 100) : 0;
};

// Acompanhamento da conta pelo cliente e o pedido de conta: ele escolhe se
// paga a taxa de serviço e se quer deixar gorjeta; o garçom recebe o total.
export const MinhaConta = ({
  aberta,
  onFechar,
  conta,
  onPedirConta,
  pedidoConta,
  enviando,
  erro,
}: {
  aberta: boolean;
  onFechar: () => void;
  conta: ContaPublica | undefined;
  onPedirConta: (escolha: EscolhaConta) => void;
  // Escolha já enviada (conta pedida), para mostrar e permitir ajustar.
  pedidoConta: (EscolhaConta & { aceito: boolean }) | undefined;
  enviando: boolean;
  erro?: string;
}) => {
  const [taxaServico, setTaxaServico] = useState(true);
  const [gorjeta, setGorjeta] = useState("");

  // Ao abrir, parte do que o cliente já pediu (se já pediu).
  useEffect(() => {
    if (!aberta) return;
    setTaxaServico(pedidoConta?.taxaServico ?? true);
    setGorjeta(
      pedidoConta?.gorjetaCentavos
        ? (pedidoConta.gorjetaCentavos / 100).toFixed(2).replace(".", ",")
        : "",
    );
  }, [aberta, pedidoConta?.taxaServico, pedidoConta?.gorjetaCentavos]);

  const temItens = Boolean(conta?.aberta && conta.itens.length > 0);
  const subtotal = conta?.totalCentavos ?? 0;
  const taxa = taxaServico ? (conta?.taxa.valorCentavos ?? 0) : 0;
  const gorjetaCentavos = paraCentavos(gorjeta);
  const total = subtotal + taxa + gorjetaCentavos;
  const mudou =
    pedidoConta &&
    (pedidoConta.taxaServico !== taxaServico ||
      pedidoConta.gorjetaCentavos !== gorjetaCentavos);

  return (
    <Drawer open={aberta} onOpenChange={(v) => !v && onFechar()}>
      <DrawerContent className="max-h-[92dvh]">
        <DrawerHeader className="text-left">
          <DrawerTitle className="text-xl">Minha conta</DrawerTitle>
          {conta?.aberta && conta.mesas.length > 1 && (
            <p className="text-sm text-texto-secundario">
              Mesas {conta.mesas.join(" + ")}
            </p>
          )}
        </DrawerHeader>

        <div className="flex-1 overflow-y-auto px-4">
          {!temItens ? (
            <div className="flex flex-col items-center gap-2 py-10 text-center text-texto-secundario">
              <Receipt className="size-10 opacity-60" />
              <p>Nenhum pedido lançado nesta mesa ainda.</p>
            </div>
          ) : (
            <>
              <ul className="divide-y divide-borda">
                {conta?.itens.map((item) => (
                  <li key={item.id} className="flex justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <p className="font-semibold">
                        {item.quantidade}× {item.nome}
                      </p>
                      {(item.modificadores.length > 0 || item.observacao) && (
                        <p className="text-sm text-texto-secundario">
                          {[item.modificadores.join(", "), item.observacao]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      )}
                    </div>
                    <span className="shrink-0 font-semibold">
                      {formatBRL(item.totalCentavos)}
                    </span>
                  </li>
                ))}
              </ul>

              <div className="mt-2 flex flex-col gap-3 pb-4">
                <button
                  type="button"
                  role="switch"
                  aria-checked={taxaServico}
                  onClick={() => setTaxaServico((v) => !v)}
                  className="flex items-center gap-3 rounded-2xl bg-fundo p-3 text-left ring-1 ring-borda"
                >
                  <span
                    className={cn(
                      "flex size-6 shrink-0 items-center justify-center rounded-md border-2",
                      taxaServico
                        ? "border-acao bg-acao text-acao-foreground"
                        : "border-borda",
                    )}
                  >
                    {taxaServico && <Check className="size-4" />}
                  </span>
                  <span className="flex-1">
                    <span className="block font-semibold">
                      Taxa de serviço ({conta?.taxa.pct}%)
                    </span>
                    <span className="block text-sm text-texto-secundario">
                      Opcional. Vai para os garçons que atenderam a mesa.
                    </span>
                  </span>
                  <span className="font-semibold">
                    {formatBRL(conta?.taxa.valorCentavos ?? 0)}
                  </span>
                </button>

                <div className="rounded-2xl bg-fundo p-3 ring-1 ring-borda">
                  <p className="flex items-center gap-2 font-semibold">
                    <Heart className="size-4 text-acao" /> Gorjeta
                    <span className="font-normal text-sm text-texto-secundario">
                      (opcional)
                    </span>
                  </p>
                  <div className="mt-2 grid grid-cols-4 gap-1.5">
                    {GORJETAS_RAPIDAS.map((valor) => (
                      <button
                        key={valor}
                        type="button"
                        onClick={() =>
                          setGorjeta(
                            valor
                              ? (valor / 100).toFixed(2).replace(".", ",")
                              : "",
                          )
                        }
                        className={cn(
                          "h-10 rounded-xl font-semibold text-sm ring-1 ring-borda",
                          gorjetaCentavos === valor
                            ? "bg-texto text-fundo ring-texto"
                            : "bg-surface",
                        )}
                      >
                        {valor ? formatBRL(valor).replace(",00", "") : "Sem"}
                      </button>
                    ))}
                  </div>
                  <label className="mt-2 flex h-12 items-center gap-2 rounded-xl bg-surface px-3 ring-1 ring-borda focus-within:ring-2 focus-within:ring-acao">
                    <span className="text-texto-secundario">R$</span>
                    <input
                      inputMode="decimal"
                      placeholder="Outro valor"
                      value={gorjeta}
                      onChange={(e) =>
                        setGorjeta(e.target.value.replace(/[^\d,.]/g, ""))
                      }
                      className="h-full flex-1 bg-transparent outline-none"
                    />
                  </label>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="flex flex-col gap-2 border-borda border-t p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          {temItens && (taxa > 0 || gorjetaCentavos > 0) && (
            <dl className="grid grid-cols-2 gap-y-0.5 text-sm text-texto-secundario">
              <dt>Consumo</dt>
              <dd className="text-right">{formatBRL(subtotal)}</dd>
              {taxa > 0 && (
                <>
                  <dt>Taxa de serviço</dt>
                  <dd className="text-right">{formatBRL(taxa)}</dd>
                </>
              )}
              {gorjetaCentavos > 0 && (
                <>
                  <dt>Gorjeta</dt>
                  <dd className="text-right">{formatBRL(gorjetaCentavos)}</dd>
                </>
              )}
            </dl>
          )}
          <div className="flex items-baseline justify-between">
            <span className="text-texto-secundario">Total</span>
            <span className="font-bold text-3xl">{formatBRL(total)}</span>
          </div>
          {erro && (
            <p role="alert" className="text-center text-destructive text-sm">
              {erro}
            </p>
          )}
          {temItens && (
            <Button
              variant="marca"
              size="lg"
              disabled={enviando || (Boolean(pedidoConta) && !mudou)}
              onClick={() => onPedirConta({ taxaServico, gorjetaCentavos })}
            >
              <Receipt />
              {!pedidoConta
                ? "Pedir a conta"
                : mudou
                  ? "Atualizar pedido de conta"
                  : pedidoConta.aceito
                    ? "Garçom trazendo a maquininha"
                    : "Conta pedida, o garçom já vem"}
            </Button>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
};
