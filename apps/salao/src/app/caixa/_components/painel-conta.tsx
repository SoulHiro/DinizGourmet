"use client";

import { useMutation } from "@tanstack/react-query";
import {
  CheckCircle2,
  ExternalLink,
  Loader2,
  Printer,
  Wallet,
  X,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";

import {
  Recebimento,
  type ResultadoRecebimento,
} from "@/components/salao/recebimento";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/cliente";
import { useDetalheMesa } from "@/lib/consultas";
import { formatarDuracao, minutosDesde, useAgora } from "@/lib/tempo";
import { formatBRL } from "@/lib/utils";

// Conta da mesa no caixa: o que foi consumido, imprimir para o cliente
// conferir, receber o pagamento e imprimir o comprovante.
export const PainelConta = ({
  mesaId,
  onFechar,
}: {
  mesaId: string;
  onFechar: () => void;
}) => {
  const { data, isLoading } = useDetalheMesa(mesaId);
  const agora = useAgora(30_000);
  const [recebendo, setRecebendo] = useState(false);
  const [pago, setPago] = useState<ResultadoRecebimento | null>(null);

  const imprimirConta = useMutation({
    mutationFn: () =>
      api(`/api/mesas/${mesaId}/imprimir-conta`, { method: "POST" }),
    onSuccess: () => toast.success("Conta enviada para a impressora"),
    onError: (e) => toast.error(e.message),
  });
  const imprimirComprovante = useMutation({
    mutationFn: (comandaId: string) =>
      api(`/api/caixa/contas/${comandaId}/imprimir`, { method: "POST" }),
    onSuccess: () => toast.success("Comprovante enviado para a impressora"),
    onError: (e) => toast.error(e.message),
  });

  const moldura = (conteudo: React.ReactNode, titulo: string) => (
    <div className="flex max-h-[calc(100dvh-6rem)] flex-col overflow-hidden rounded-xl border border-borda bg-surface">
      <div className="flex items-center justify-between border-borda border-b px-4 py-3">
        <h2 className="font-bold text-xl">{titulo}</h2>
        <button
          type="button"
          aria-label="Fechar painel"
          onClick={onFechar}
          className="flex size-10 items-center justify-center rounded-lg text-texto-secundario"
        >
          <X />
        </button>
      </div>
      <div className="overflow-y-auto p-4">{conteudo}</div>
    </div>
  );

  if (pago) {
    return moldura(
      <div className="flex flex-col items-center gap-4 py-4 text-center">
        <CheckCircle2 className="size-14 text-status-livre" />
        <p className="font-bold text-2xl">Conta paga</p>
        <p className="text-texto-secundario">
          Total recebido {formatBRL(pago.totalCentavos)}
        </p>
        {pago.trocoCentavos > 0 && (
          <p className="w-full rounded-xl bg-status-livre/15 p-4">
            <span className="block font-semibold">Devolver de troco</span>
            <span className="font-bold text-4xl">
              {formatBRL(pago.trocoCentavos)}
            </span>
          </p>
        )}
        <div className="flex w-full flex-col gap-2">
          <Button
            size="lg"
            disabled={imprimirComprovante.isPending}
            onClick={() => imprimirComprovante.mutate(pago.comandaId)}
          >
            <Printer /> Imprimir comprovante
          </Button>
          <Button size="lg" variant="acao" onClick={onFechar}>
            Próxima mesa
          </Button>
        </div>
      </div>,
      "Pagamento registrado",
    );
  }

  if (isLoading || !data) {
    return moldura(
      <Loader2 className="mx-auto size-8 animate-spin text-texto-secundario" />,
      "Carregando...",
    );
  }

  const { mesa, comanda } = data;
  if (!comanda) {
    return moldura(
      <p className="py-6 text-center text-texto-secundario">
        Mesa livre, sem conta aberta.
      </p>,
      `Mesa ${mesa.numero}`,
    );
  }

  const titulo = `Mesa ${comanda.mesas.map((m) => m.numero).join(" + ")}`;

  if (recebendo) {
    return moldura(
      <>
        <button
          type="button"
          onClick={() => setRecebendo(false)}
          className="mb-3 font-semibold text-sm text-texto-secundario underline"
        >
          Voltar para a conta
        </button>
        <Recebimento
          mesaId={mesa.id}
          comanda={comanda}
          onPago={(r) => {
            setRecebendo(false);
            setPago(r);
          }}
        />
      </>,
      `Receber · ${titulo}`,
    );
  }

  // Itens ativos, agrupados por nome + observações (a conta do cliente).
  const agrupados = new Map<
    string,
    { nome: string; detalhe: string; quantidade: number; total: number }
  >();
  for (const rodada of comanda.rodadas) {
    for (const item of rodada.itens) {
      if (item.status !== "ativo") continue;
      const detalhe = [item.modificadores.join(", "), item.observacao]
        .filter(Boolean)
        .join(" · ");
      const chave = `${item.nome}|${detalhe}`;
      const atual = agrupados.get(chave);
      agrupados.set(chave, {
        nome: item.nome,
        detalhe,
        quantidade: (atual?.quantidade ?? 0) + item.quantidade,
        total: (atual?.total ?? 0) + item.totalCentavos,
      });
    }
  }

  return moldura(
    <div className="flex flex-col gap-4">
      <p className="text-sm text-texto-secundario">
        Aberta há {formatarDuracao(minutosDesde(comanda.abertaEm, agora))} ·{" "}
        {comanda.equipe.map((e) => e.nome).join(", ") || comanda.titular} ·{" "}
        {comanda.rodadas.length}{" "}
        {comanda.rodadas.length === 1 ? "pedido" : "pedidos"}
      </p>

      {agrupados.size === 0 ? (
        <p className="py-4 text-center text-texto-secundario">
          Nenhum item lançado ainda.
        </p>
      ) : (
        <ul className="divide-y divide-borda">
          {[...agrupados.values()].map((item) => (
            <li
              key={`${item.nome}|${item.detalhe}`}
              className="flex justify-between gap-3 py-2"
            >
              <span className="min-w-0">
                <span className="font-semibold">
                  {item.quantidade}× {item.nome}
                </span>
                {item.detalhe && (
                  <span className="block text-sm text-texto-secundario">
                    {item.detalhe}
                  </span>
                )}
              </span>
              <span className="shrink-0 font-semibold">
                {formatBRL(item.total)}
              </span>
            </li>
          ))}
        </ul>
      )}

      {comanda.totaisPorMesa.length > 1 && (
        <div className="rounded-lg bg-fundo p-3 text-sm">
          <p className="mb-1 font-semibold">Consumo por mesa</p>
          {comanda.totaisPorMesa.map((t) => (
            <p key={t.numero} className="flex justify-between">
              <span>Mesa {t.numero}</span>
              <span>{formatBRL(t.totalCentavos)}</span>
            </p>
          ))}
        </div>
      )}

      <dl className="grid grid-cols-2 gap-y-1 border-borda border-t pt-3">
        <dt className="text-texto-secundario">Consumo</dt>
        <dd className="text-right font-semibold">
          {formatBRL(comanda.totalCentavos)}
        </dd>
        <dt className="text-texto-secundario">
          Taxa de serviço ({comanda.taxa.pct}%, opcional)
        </dt>
        <dd className="text-right">{formatBRL(comanda.taxa.valorCentavos)}</dd>
        <dt className="font-semibold">Total com taxa</dt>
        <dd className="text-right font-bold text-2xl">
          {formatBRL(comanda.totalCentavos + comanda.taxa.valorCentavos)}
        </dd>
      </dl>

      <div className="flex flex-col gap-2">
        <Button
          size="lg"
          variant="acao"
          disabled={agrupados.size === 0}
          onClick={() => setRecebendo(true)}
        >
          <Wallet /> Receber pagamento
        </Button>
        <div className="grid grid-cols-2 gap-2">
          <Button
            disabled={imprimirConta.isPending || agrupados.size === 0}
            onClick={() => imprimirConta.mutate()}
          >
            <Printer /> Imprimir conta
          </Button>
          <Link
            href={`/garcom/mesa/${mesa.id}`}
            className="flex h-12 items-center justify-center gap-2 rounded-lg border border-borda bg-surface font-semibold"
          >
            <ExternalLink className="size-4" /> Abrir mesa
          </Link>
        </div>
      </div>
    </div>,
    titulo,
  );
};
