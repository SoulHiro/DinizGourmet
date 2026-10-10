"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BellRing, Loader2, Receipt } from "lucide-react";
import { use, useState } from "react";

import { api, ErroApi } from "@/lib/cliente";
import type { ProdutoPublico } from "@/lib/dominio/cardapio-publico";
import { cn, formatBRL } from "@/lib/utils";
import { DetalheProduto } from "./_components/detalhe-produto";
import { useIdentificacao } from "./_components/identificacao";
import {
  type ContaPublica,
  type EscolhaConta,
  MinhaConta,
} from "./_components/minha-conta";
import { Vitrine } from "./_components/vitrine";

type Cardapio = {
  mesa: number;
  categorias: { id: string; nome: string; produtos: ProdutoPublico[] }[];
};

type Status = {
  mesa: number;
  comanda: number | null;
  precisaCartao: boolean;
  chamados: {
    tipo: "garcom" | "conta";
    aceito: boolean;
    taxaServico: boolean;
    gorjetaCentavos: number;
  }[];
};

// Cardápio digital que o cliente abre pelo QR da mesa. Só visualização:
// quem pede é o garçom. Embaixo: chamar garçom, pedir a conta e ver a conta.
export default function CardapioClientePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);
  const queryClient = useQueryClient();
  const [aberto, setAberto] = useState<ProdutoPublico | null>(null);
  const [verConta, setVerConta] = useState(false);
  // Mesa com várias comandas: o cliente diz qual cartão é o dele.
  const { ident, definir, esquecer, query } = useIdentificacao(token);
  const sufixo = query ? `?${query}` : "";

  const cardapio = useQuery({
    queryKey: ["publico", token, "cardapio"],
    queryFn: () => api<Cardapio>(`/api/publico/mesa/${token}/cardapio`),
    // "Esgotado" aparece sem o cliente recarregar.
    refetchInterval: 60_000,
    retry: 1,
  });
  // Sem socket para o cliente: consulta periódica é suficiente aqui.
  const status = useQuery({
    queryKey: ["publico", token, "status", query],
    queryFn: () => api<Status>(`/api/publico/mesa/${token}${sufixo}`),
    refetchInterval: 5_000,
    enabled: cardapio.isSuccess,
  });
  const conta = useQuery({
    queryKey: ["publico", token, "conta", query],
    queryFn: () =>
      api<ContaPublica>(`/api/publico/mesa/${token}/conta${sufixo}`),
    // Número digitado errado (ou comanda já paga): pergunta de novo.
    retry: (falhas, error) =>
      !(error instanceof ErroApi && error.status === 404) && falhas < 2,
    refetchInterval: 10_000,
    enabled: cardapio.isSuccess,
  });

  const chamar = useMutation({
    mutationFn: (tipo: "garcom" | "conta") =>
      api(`/api/publico/mesa/${token}`, {
        method: "POST",
        json: { tipo, ...ident },
      }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["publico", token, "status"] }),
  });
  const pedirConta = useMutation({
    mutationFn: (escolha: EscolhaConta) =>
      api(`/api/publico/mesa/${token}`, {
        method: "POST",
        json: { tipo: "conta", ...escolha, ...ident },
      }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["publico", token, "status"] }),
  });
  const erro = chamar.error ?? pedirConta.error;

  const chamado = (tipo: "garcom" | "conta") =>
    status.data?.chamados.find((c) => c.tipo === tipo);
  const garcom = chamado("garcom");
  const pedidoConta = chamado("conta");
  const totalConta = conta.data?.aberta ? conta.data.totalCentavos : 0;

  if (cardapio.isLoading) {
    return (
      <main className="flex min-h-dvh items-center justify-center">
        <Loader2 className="size-8 animate-spin text-texto-secundario" />
      </main>
    );
  }

  if (cardapio.error || !cardapio.data) {
    const naoExiste =
      cardapio.error instanceof ErroApi && cardapio.error.status === 404;
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-2 p-6 text-center">
        <p className="font-bold text-2xl text-marca">Xis Diniz</p>
        <p className="text-texto-secundario">
          {naoExiste
            ? "Este QR code não é mais válido. Chame um garçom, por favor."
            : "Não foi possível conectar. Verifique se está no Wi-Fi do restaurante."}
        </p>
      </main>
    );
  }

  return (
    <div className="min-h-dvh pb-36">
      <Vitrine
        categorias={cardapio.data.categorias}
        selo={`Mesa ${cardapio.data.mesa}`}
        onAbrir={setAberto}
      />

      <nav
        aria-label="Atendimento"
        className="fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-30 grid grid-cols-3 gap-1.5 rounded-3xl bg-texto p-1.5 text-fundo shadow-xl"
      >
        <button
          type="button"
          onClick={() => setVerConta(true)}
          className="flex flex-col items-center justify-center gap-0.5 rounded-2xl px-2 py-2 active:bg-white/10"
        >
          <Receipt className="size-5" />
          <span className="font-semibold text-xs">Minha conta</span>
          <span className="text-[11px] opacity-80">
            {formatBRL(totalConta)}
          </span>
        </button>
        <button
          type="button"
          disabled={Boolean(garcom) || chamar.isPending}
          onClick={() => chamar.mutate("garcom")}
          className={cn(
            "flex flex-col items-center justify-center gap-0.5 rounded-2xl px-2 py-2 font-semibold",
            garcom
              ? "bg-status-livre text-white"
              : "bg-acao text-acao-foreground",
          )}
        >
          <BellRing className="size-5" />
          <span className="text-xs leading-tight">
            {garcom
              ? garcom.aceito
                ? "Garçom a caminho"
                : "Garçom avisado"
              : "Chamar garçom"}
          </span>
        </button>
        <button
          type="button"
          onClick={() => setVerConta(true)}
          className={cn(
            "flex flex-col items-center justify-center gap-0.5 rounded-2xl px-2 py-2 font-semibold",
            pedidoConta ? "bg-status-livre text-white" : "active:bg-white/10",
          )}
        >
          <Receipt className="size-5" />
          <span className="text-xs leading-tight">
            {pedidoConta
              ? pedidoConta.aceito
                ? "Conta a caminho"
                : "Conta pedida"
              : "Pedir a conta"}
          </span>
        </button>
      </nav>

      {erro && (
        <p
          role="alert"
          className="fixed inset-x-4 bottom-28 z-30 rounded-xl bg-destructive p-3 text-center text-sm text-white"
        >
          {erro.message}
        </p>
      )}

      <DetalheProduto
        produto={aberto}
        onFechar={() => setAberto(null)}
        garcomChamado={Boolean(garcom)}
        onChamarGarcom={() => {
          chamar.mutate("garcom");
          setAberto(null);
        }}
      />
      <MinhaConta
        aberta={verConta}
        onFechar={() => setVerConta(false)}
        conta={conta.data}
        pedidoConta={pedidoConta}
        enviando={pedirConta.isPending}
        erro={pedirConta.error?.message}
        onPedirConta={(escolha) => pedirConta.mutate(escolha)}
        cartaoInvalido={
          conta.error instanceof ErroApi && conta.error.status === 404
        }
        onInformarCartao={(numero) => definir({ numero })}
        onTrocarCartao={esquecer}
      />
    </div>
  );
}
