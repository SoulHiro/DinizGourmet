"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BellRing, Check, Hand, Loader2, Receipt, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { useFuncionario } from "@/components/providers/sessao";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/cliente";
import type { PedidoAjuda } from "@/lib/dominio/ajuda";
import type { Chamado } from "@/lib/dominio/chamados";
import { formatarDuracao, minutosDesde, useAgora } from "@/lib/tempo";
import { cn, formatBRL } from "@/lib/utils";

const quando = (minutos: number | null) =>
  !minutos ? "agora" : `há ${formatarDuracao(minutos)}`;

const MAX_VISIVEIS = 3;

export const useAjudas = () =>
  useQuery({
    queryKey: ["ajuda"],
    queryFn: () => api<PedidoAjuda[]>("/api/ajuda"),
    // Rede de segurança para o escalonamento aparecer mesmo sem evento.
    refetchInterval: 20_000,
  });

export const useChamados = () =>
  useQuery({
    queryKey: ["chamados"],
    queryFn: () => api<Chamado[]>("/api/chamados"),
    refetchInterval: 20_000,
  });

// Vibra quando aparece um alerta novo (não no primeiro carregamento).
const useVibrarComNovos = (ids: string[]) => {
  const vistos = useRef<Set<string> | null>(null);
  const chave = ids.join(",");
  useEffect(() => {
    const atuais = new Set(chave ? chave.split(",") : []);
    if (vistos.current && [...atuais].some((id) => !vistos.current?.has(id))) {
      navigator.vibrate?.([250, 120, 250]);
    }
    vistos.current = atuais;
  }, [chave]);
};

// Alertas da área logada: chamados de clientes (fila por ordem de chegada) e
// pedidos de ajuda entre garçons. Sem resposta, ficam vermelhos (gerente).
export const AlertasAjuda = () => {
  const eu = useFuncionario();
  const router = useRouter();
  const queryClient = useQueryClient();
  const agora = useAgora(15_000);
  const { data: pedidos = [] } = useAjudas();
  const { data: chamados = [] } = useChamados();
  // Quem não pode atender esconde o alerta só no próprio celular. A chave
  // inclui o escalonamento: se ninguém responder, o alerta volta em vermelho.
  const [escondidos, setEscondidos] = useState<string[]>([]);
  const chaveAlerta = (id: string, escalado: boolean) => `${id}:${escalado}`;

  const ajudasParaMim = pedidos.filter(
    (p) =>
      !p.aceitoPorId &&
      p.solicitanteId !== eu.id &&
      !escondidos.includes(chaveAlerta(p.id, p.escalado)),
  );
  const minhasAjudas = pedidos.filter((p) => p.solicitanteId === eu.id);
  // Pedido de conta vai só para quem atendeu a mesa (titular e auxiliares);
  // sem equipe, ou escalado sem resposta, vai também para o gerente.
  const paraMim = (c: Chamado) =>
    c.tipo !== "conta" ||
    c.garconsDaMesa.length === 0 ||
    c.garconsDaMesa.includes(eu.id) ||
    (eu.papel === "gerente" && c.escalado);
  const chamadosNaFila = chamados.filter(
    (c) =>
      !c.aceitoPorId &&
      paraMim(c) &&
      !escondidos.includes(chaveAlerta(c.id, c.escalado)),
  );
  const chamadosMeus = chamados.filter((c) => c.aceitoPorId === eu.id);

  useVibrarComNovos([
    ...ajudasParaMim.map((p) => p.id),
    ...chamadosNaFila.map((c) => c.id),
  ]);

  const atualizar = () => {
    for (const chave of ["ajuda", "chamados", "mesas"]) {
      queryClient.invalidateQueries({ queryKey: [chave] });
    }
  };
  const esconder = (id: string, escalado: boolean) =>
    setEscondidos((atual) => [...atual, chaveAlerta(id, escalado)]);

  const aceitarAjuda = useMutation({
    mutationFn: (p: PedidoAjuda) =>
      api(`/api/ajuda/${p.id}/aceitar`, { method: "POST" }),
    onSuccess: (_r, p) => {
      toast.success(`Você vai ajudar na mesa ${p.mesaNumero}`);
      atualizar();
      router.push(`/garcom/mesa/${p.mesaId}`);
    },
    onError: (e) => {
      toast.error(e.message);
      atualizar();
    },
  });

  const encerrarAjuda = useMutation({
    mutationFn: (p: PedidoAjuda) =>
      api(`/api/ajuda/${p.id}/encerrar`, { method: "POST" }),
    onSuccess: atualizar,
    onError: (e) => toast.error(e.message),
  });

  const atender = useMutation({
    mutationFn: (c: Chamado) =>
      api(`/api/chamados/${c.id}/atender`, { method: "POST" }),
    onSuccess: (_r, c) => {
      atualizar();
      if (c.tipo === "conta") {
        receber(c);
        return;
      }
      toast.success(`Você está atendendo a mesa ${c.mesaNumero}`);
    },
    onError: (e) => {
      toast.error(e.message);
      atualizar();
    },
  });

  // Abre a mesa já no pagamento, com a escolha do cliente preenchida.
  const receber = (c: Chamado) =>
    router.push(`/garcom/mesa/${c.mesaId}?receber=1`);

  const concluir = useMutation({
    mutationFn: (c: Chamado) =>
      api(`/api/chamados/${c.id}/concluir`, { method: "POST" }),
    onSuccess: atualizar,
    onError: (e) => toast.error(e.message),
  });

  // Fila: chamados por ordem de chegada, depois pedidos de ajuda.
  const fila = [
    ...chamadosNaFila.map((c) => ({ tipo: "chamado" as const, c })),
    ...ajudasParaMim.map((p) => ({ tipo: "ajuda" as const, p })),
  ];
  const visiveis = fila.slice(0, MAX_VISIVEIS);
  const restantes = fila.length - visiveis.length;

  if (
    fila.length === 0 &&
    minhasAjudas.length === 0 &&
    chamadosMeus.length === 0
  ) {
    return null;
  }

  return (
    <div className="pointer-events-none fixed inset-x-2 top-[calc(env(safe-area-inset-top)+4.5rem)] z-40 flex flex-col gap-2 print:hidden">
      {visiveis.map((alerta) => {
        if (alerta.tipo === "chamado") {
          const { c } = alerta;
          const minutos = minutosDesde(c.criadoEm, agora);
          const minhaMesa = c.garconsDaMesa.includes(eu.id);
          const Icone = c.tipo === "conta" ? Receipt : BellRing;
          return (
            <div
              key={c.id}
              role="alert"
              className={cn(
                "pointer-events-auto flex items-center gap-3 rounded-xl p-3 shadow-lg",
                c.escalado
                  ? "animate-pulse bg-status-conta text-white"
                  : c.tipo === "conta"
                    ? "bg-status-conta text-white"
                    : "bg-status-chamado text-black",
              )}
            >
              <Icone className="size-7 shrink-0" />
              <div className="min-w-0 flex-1 leading-tight">
                <p className="font-bold">
                  Mesa {c.mesaNumero}{" "}
                  {c.tipo === "conta" ? "pediu a conta" : "chamou o garçom"}
                </p>
                {c.conta && (
                  <p className="font-semibold text-sm">
                    {formatBRL(c.conta.totalCentavos)}
                    {c.conta.taxaServico
                      ? ` com taxa (${c.conta.taxaPct}%)`
                      : " sem taxa"}
                    {c.conta.gorjetaCentavos > 0 &&
                      ` + gorjeta ${formatBRL(c.conta.gorjetaCentavos)}`}
                  </p>
                )}
                <p className="text-sm">
                  {minhaMesa && "Sua mesa · "}
                  {c.escalado
                    ? `Sem resposta ${quando(minutos)} — gerente avisado`
                    : quando(minutos)}
                </p>
              </div>
              <Button
                variant="marca"
                disabled={atender.isPending}
                onClick={() => atender.mutate(c)}
              >
                {atender.isPending ? (
                  <Loader2 className="animate-spin" />
                ) : (
                  "Atender"
                )}
              </Button>
              <button
                type="button"
                aria-label="Esconder este alerta"
                onClick={() => esconder(c.id, c.escalado)}
                className="-mr-1 flex size-10 shrink-0 items-center justify-center"
              >
                <X className="size-5" />
              </button>
            </div>
          );
        }
        const { p } = alerta;
        const minutos = minutosDesde(p.criadoEm, agora);
        return (
          <div
            key={p.id}
            role="alert"
            className={cn(
              "pointer-events-auto flex items-center gap-3 rounded-xl p-3 shadow-lg",
              p.escalado
                ? "animate-pulse bg-status-conta text-white"
                : "bg-status-chamado text-black",
            )}
          >
            <Hand className="size-7 shrink-0" />
            <div className="min-w-0 flex-1 leading-tight">
              <p className="font-bold">
                Mesa {p.mesaNumero}: {p.solicitante} pediu ajuda
              </p>
              <p className="text-sm">
                {p.escalado
                  ? `Sem resposta ${quando(minutos)} — gerente avisado`
                  : quando(minutos)}
              </p>
            </div>
            <Button
              variant="marca"
              disabled={aceitarAjuda.isPending}
              onClick={() => aceitarAjuda.mutate(p)}
            >
              {aceitarAjuda.isPending ? (
                <Loader2 className="animate-spin" />
              ) : (
                "Vou ajudar"
              )}
            </Button>
            <button
              type="button"
              aria-label="Esconder este alerta"
              onClick={() => esconder(p.id, p.escalado)}
              className="-mr-1 flex size-10 shrink-0 items-center justify-center"
            >
              <X className="size-5" />
            </button>
          </div>
        );
      })}

      {restantes > 0 && (
        <p className="pointer-events-auto self-center rounded-full bg-texto px-3 py-1 font-semibold text-fundo text-sm shadow">
          +{restantes} aguardando
        </p>
      )}

      {chamadosMeus.map((c) => (
        <div
          key={c.id}
          role="status"
          className="pointer-events-auto flex items-center gap-3 rounded-xl border border-borda bg-surface p-3 text-texto shadow-lg"
        >
          {c.tipo === "conta" ? (
            <Receipt className="size-6 shrink-0" />
          ) : (
            <BellRing className="size-6 shrink-0" />
          )}
          <p className="min-w-0 flex-1 font-semibold leading-tight">
            {c.tipo === "conta"
              ? `Conta da mesa ${c.mesaNumero}${c.conta ? `: ${formatBRL(c.conta.totalCentavos)}` : ""}`
              : `Atendendo a mesa ${c.mesaNumero}`}
          </p>
          {c.tipo === "conta" ? (
            <Button variant="marca" onClick={() => receber(c)}>
              Receber
            </Button>
          ) : (
            <Button variant="outline" onClick={() => concluir.mutate(c)}>
              <Check /> Feito
            </Button>
          )}
        </div>
      ))}

      {minhasAjudas.map((p) => (
        <div
          key={p.id}
          role="status"
          className={cn(
            "pointer-events-auto flex items-center gap-3 rounded-xl p-3 shadow-lg",
            p.aceitoPor
              ? "bg-status-livre text-white"
              : "border border-borda bg-surface text-texto",
          )}
        >
          <Hand className="size-6 shrink-0" />
          <p className="min-w-0 flex-1 font-semibold leading-tight">
            {p.aceitoPor
              ? p.espontaneo
                ? `${p.aceitoPor} entrou para te ajudar na mesa ${p.mesaNumero}`
                : `${p.aceitoPor} vai te ajudar na mesa ${p.mesaNumero}`
              : `Ajuda pedida na mesa ${p.mesaNumero}. Aguardando um colega...`}
          </p>
          <Button
            size="icon"
            variant="ghost"
            aria-label={
              p.aceitoPor ? "Dispensar aviso" : "Cancelar pedido de ajuda"
            }
            onClick={() => encerrarAjuda.mutate(p)}
          >
            <X />
          </Button>
        </div>
      ))}
    </div>
  );
};
