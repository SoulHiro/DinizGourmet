"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Hand, Loader2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { useFuncionario } from "@/components/providers/sessao";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/cliente";
import type { PedidoAjuda } from "@/lib/dominio/ajuda";
import { formatarDuracao, minutosDesde, useAgora } from "@/lib/tempo";
import { cn } from "@/lib/utils";

const quando = (minutos: number | null) =>
  !minutos ? "agora" : `há ${formatarDuracao(minutos)}`;

export const useAjudas = () =>
  useQuery({
    queryKey: ["ajuda"],
    queryFn: () => api<PedidoAjuda[]>("/api/ajuda"),
    // Rede de segurança para o escalonamento aparecer mesmo sem evento.
    refetchInterval: 20_000,
  });

// Alertas de pedido de ajuda, visíveis em qualquer tela da área logada.
export const AlertasAjuda = () => {
  const eu = useFuncionario();
  const router = useRouter();
  const queryClient = useQueryClient();
  const agora = useAgora(15_000);
  const { data: pedidos = [] } = useAjudas();
  const vistos = useRef<Set<string> | null>(null);
  // Quem não pode ajudar esconde o alerta só no próprio celular. A chave
  // inclui o escalonamento: se ninguém responder, o alerta volta em vermelho.
  const [escondidos, setEscondidos] = useState<string[]>([]);
  const chaveAlerta = (p: PedidoAjuda) => `${p.id}:${p.escalado}`;

  const paraMim = pedidos.filter(
    (p) =>
      !p.aceitoPorId &&
      p.solicitanteId !== eu.id &&
      !escondidos.includes(chaveAlerta(p)),
  );
  const meus = pedidos.filter((p) => p.solicitanteId === eu.id);

  // Vibra quando chega um pedido novo (não no primeiro carregamento).
  useEffect(() => {
    const ids = new Set(paraMim.map((p) => p.id));
    if (vistos.current) {
      const novo = [...ids].some((id) => !vistos.current?.has(id));
      if (novo) navigator.vibrate?.([250, 120, 250]);
    }
    vistos.current = ids;
  }, [paraMim]);

  const atualizar = () => {
    queryClient.invalidateQueries({ queryKey: ["ajuda"] });
    queryClient.invalidateQueries({ queryKey: ["mesas"] });
  };

  const aceitar = useMutation({
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

  const encerrar = useMutation({
    mutationFn: (p: PedidoAjuda) =>
      api(`/api/ajuda/${p.id}/encerrar`, { method: "POST" }),
    onSuccess: atualizar,
    onError: (e) => toast.error(e.message),
  });

  if (paraMim.length === 0 && meus.length === 0) return null;

  return (
    <div className="pointer-events-none fixed inset-x-2 top-[calc(env(safe-area-inset-top)+4.5rem)] z-40 flex flex-col gap-2">
      {paraMim.map((p) => {
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
              disabled={aceitar.isPending}
              onClick={() => aceitar.mutate(p)}
            >
              {aceitar.isPending ? (
                <Loader2 className="animate-spin" />
              ) : (
                "Vou ajudar"
              )}
            </Button>
            <button
              type="button"
              aria-label="Esconder este alerta"
              onClick={() =>
                setEscondidos((atual) => [...atual, chaveAlerta(p)])
              }
              className="-mr-1 flex size-10 shrink-0 items-center justify-center"
            >
              <X className="size-5" />
            </button>
          </div>
        );
      })}

      {meus.map((p) => (
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
              ? `${p.aceitoPor} vai te ajudar na mesa ${p.mesaNumero}`
              : `Ajuda pedida na mesa ${p.mesaNumero}. Aguardando um colega...`}
          </p>
          <Button
            size="icon"
            variant="ghost"
            aria-label={
              p.aceitoPor ? "Dispensar aviso" : "Cancelar pedido de ajuda"
            }
            onClick={() => encerrar.mutate(p)}
          >
            <X />
          </Button>
        </div>
      ))}
    </div>
  );
};
