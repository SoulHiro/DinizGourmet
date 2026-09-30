"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BellRing, Loader2, Receipt, Search, X } from "lucide-react";
import { use, useMemo, useState } from "react";

import { api, ErroApi } from "@/lib/cliente";
import type { ProdutoPublico } from "@/lib/dominio/cardapio-publico";
import { normalizarBusca } from "@/lib/texto";
import { cn, formatBRL } from "@/lib/utils";
import { CardProduto } from "./_components/card-produto";
import { DetalheProduto } from "./_components/detalhe-produto";
import { FotoProduto } from "./_components/foto-produto";
import { useIdentificacao } from "./_components/identificacao";
import {
  type ContaPublica,
  type EscolhaConta,
  MinhaConta,
} from "./_components/minha-conta";

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
  const [busca, setBusca] = useState("");
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

  const categorias = cardapio.data?.categorias ?? [];
  const todos = useMemo(
    () => categorias.flatMap((c) => c.produtos),
    [categorias],
  );
  const destaques = todos.filter((p) => p.destaque && !p.esgotado);
  const termo = normalizarBusca(busca);
  const resultados = termo
    ? todos.filter(
        (p) =>
          normalizarBusca(p.nome).includes(termo) ||
          normalizarBusca(p.descricao ?? "").includes(termo) ||
          p.ingredientes.some((i) => normalizarBusca(i).includes(termo)),
      )
    : [];

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

  const irPara = (categoriaId: string) => {
    setBusca("");
    document
      .getElementById(`cat-${categoriaId}`)
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="min-h-dvh pb-36">
      <header className="sticky top-0 z-20 bg-fundo/95 px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3 backdrop-blur">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-bold text-2xl text-marca leading-none">
              Xis Diniz
            </p>
            <p className="text-texto-secundario text-xs">
              O verdadeiro xis do sul, direto na chapa
            </p>
          </div>
          <span className="rounded-full bg-marca px-3 py-1.5 font-bold text-marca-foreground text-sm">
            Mesa {cardapio.data.mesa}
          </span>
        </div>
        <label className="relative mt-3 block">
          <Search className="-translate-y-1/2 absolute top-1/2 left-4 size-5 text-texto-secundario" />
          <input
            type="search"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar lanche, porção, bebida..."
            className="h-12 w-full rounded-full bg-surface pr-12 pl-12 shadow-sm ring-1 ring-borda"
          />
          {busca && (
            <button
              type="button"
              aria-label="Limpar busca"
              onClick={() => setBusca("")}
              className="-translate-y-1/2 absolute top-1/2 right-1 flex size-10 items-center justify-center"
            >
              <X className="size-5" />
            </button>
          )}
        </label>
      </header>

      {termo ? (
        <main className="px-4">
          <p className="mb-3 text-sm text-texto-secundario">
            {resultados.length}{" "}
            {resultados.length === 1 ? "resultado" : "resultados"} para "{busca}
            "
          </p>
          <div className="grid grid-cols-2 gap-3">
            {resultados.map((p) => (
              <CardProduto
                key={p.id}
                produto={p}
                onAbrir={() => setAberto(p)}
              />
            ))}
          </div>
        </main>
      ) : (
        <main className="flex flex-col gap-6">
          {destaques.length > 0 && (
            <section aria-label="Destaques da casa">
              <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
                {destaques.map((p, indice) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setAberto(p)}
                    className="relative aspect-[16/10] w-[86%] shrink-0 snap-center overflow-hidden rounded-3xl text-left shadow-md active:scale-[0.99]"
                  >
                    <FotoProduto
                      src={p.fotoUrl}
                      nome={p.nome}
                      prioridade={indice === 0}
                      tamanhoIcone="size-20"
                      className="absolute inset-0 size-full"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent" />
                    <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-4 text-white">
                      <div className="min-w-0">
                        <span className="rounded-full bg-acao px-2.5 py-1 font-bold text-[11px] uppercase tracking-wide">
                          Destaque da casa
                        </span>
                        <p className="mt-2 truncate font-bold text-2xl leading-tight">
                          {p.nome}
                        </p>
                        {p.descricao && (
                          <p className="line-clamp-1 text-sm text-white/80">
                            {p.descricao}
                          </p>
                        )}
                      </div>
                      <span className="shrink-0 rounded-full bg-white px-3 py-1.5 font-bold text-black">
                        {formatBRL(p.precoCentavos)}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </section>
          )}

          <nav
            aria-label="Categorias"
            className="flex gap-4 overflow-x-auto px-4 [scrollbar-width:none]"
          >
            {categorias.map((c) => {
              const capa =
                c.produtos.find((p) => p.miniaturaUrl) ?? c.produtos[0];
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => irPara(c.id)}
                  className="flex w-[4.5rem] shrink-0 flex-col items-center gap-1.5"
                >
                  <FotoProduto
                    src={capa?.miniaturaUrl ?? null}
                    nome={capa?.nome ?? c.nome}
                    tamanhoIcone="size-7"
                    className="size-16 rounded-full ring-2 ring-acao/40"
                  />
                  <span className="font-semibold text-xs">{c.nome}</span>
                </button>
              );
            })}
          </nav>

          {categorias.map((c) => (
            <section
              key={c.id}
              id={`cat-${c.id}`}
              className="scroll-mt-36 px-4"
            >
              <h2 className="mb-3 font-bold text-xl">{c.nome}</h2>
              <div className="grid grid-cols-2 gap-3">
                {c.produtos.map((p) => (
                  <CardProduto
                    key={p.id}
                    produto={p}
                    onAbrir={() => setAberto(p)}
                  />
                ))}
              </div>
            </section>
          ))}
        </main>
      )}

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
