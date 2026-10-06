"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowRightLeft,
  DoorOpen,
  Hand,
  HandHeart,
  Loader2,
  MoreVertical,
  Printer,
} from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { useFuncionario } from "@/components/providers/sessao";
import { Recebimento } from "@/components/salao/recebimento";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { api } from "@/lib/cliente";
import { useMapa } from "@/lib/consultas";
import type { DetalheComanda } from "@/lib/dominio/mesas";
import { cn, formatBRL } from "@/lib/utils";

type Modo = "menu" | "transferir" | "fechar";

// Menu da comanda: ajuda (da mesa), imprimir a conta, trocar de mesa e
// receber o pagamento.
export const AcoesComanda = ({
  detalhe,
  abrirReceber = 0,
}: {
  detalhe: DetalheComanda;
  // Muda a cada toque em "Receber" fora do menu (faixa e rodapé da Conta).
  abrirReceber?: number;
}) => {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: mapa } = useMapa();
  const [modo, setModo] = useState<Modo | null>(null);
  const [destino, setDestino] = useState<string | null>(null);
  const eu = useFuncionario();
  const pathname = usePathname();

  const { mesa, comanda } = detalhe;
  const titulo = comanda.numero
    ? `Comanda ${comanda.numero}`
    : `Mesa ${mesa.numero}`;
  const outrasMesas = mapa?.filter((m) => m.id !== mesa.id) ?? [];
  const souDaMesa = comanda.equipe.some((e) => e.id === eu.id);

  const fechar = () => {
    setModo(null);
    setDestino(null);
  };

  // Vindo do alerta "pediu a conta" (?receber), abre direto o pagamento.
  // biome-ignore lint/correctness/useExhaustiveDependencies: só ao montar a tela.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).has("receber")) {
      setModo("fechar");
      router.replace(pathname);
    }
  }, []);

  useEffect(() => {
    if (abrirReceber > 0) setModo("fechar");
  }, [abrirReceber]);

  const atualizar = () =>
    queryClient.invalidateQueries({ queryKey: ["mesas"] });

  const transferir = useMutation({
    mutationFn: () =>
      api(`/api/comandas/${comanda.id}/transferir`, {
        method: "POST",
        json: { destinoMesaId: destino },
      }),
    onSuccess: () => {
      const numero = mapa?.find((m) => m.id === destino)?.numero;
      toast.success(`${titulo} agora está na mesa ${numero}`);
      atualizar();
      fechar();
    },
    onError: (error) => toast.error(error.message),
  });

  const pedirAjuda = useMutation({
    mutationFn: () =>
      api<{ jaExistia: boolean }>("/api/ajuda", {
        method: "POST",
        json: { mesaId: mesa.id },
      }),
    onSuccess: ({ jaExistia }) => {
      toast.success(
        jaExistia
          ? "O pedido de ajuda já estava ativo."
          : "Alerta enviado para os outros garçons.",
      );
      queryClient.invalidateQueries({ queryKey: ["ajuda"] });
      fechar();
    },
    onError: (error) => toast.error(error.message),
  });

  const oferecer = useMutation({
    mutationFn: () => api(`/api/mesas/${mesa.id}/auxiliar`, { method: "POST" }),
    onSuccess: () => {
      toast.success(`Você entrou como auxiliar na mesa ${mesa.numero}`);
      atualizar();
      fechar();
    },
    onError: (error) => toast.error(error.message),
  });

  // Conferência da conta, impressa no caixa (o cliente pediu para ver).
  const imprimir = useMutation({
    mutationFn: () =>
      api(`/api/comandas/${comanda.id}/imprimir-conta`, { method: "POST" }),
    onSuccess: () => {
      toast.success("Conta enviada para a impressora do caixa");
      fechar();
    },
    onError: (error) => toast.error(error.message),
  });

  return (
    <>
      <button
        type="button"
        aria-label="Ações da comanda"
        onClick={() => setModo("menu")}
        className="flex size-12 items-center justify-center"
      >
        <MoreVertical />
      </button>

      <Drawer
        open={modo !== null}
        onOpenChange={(aberto) => !aberto && fechar()}
      >
        <DrawerContent className={cn(modo === "fechar" && "h-[94dvh]")}>
          <DrawerHeader className="text-left">
            <DrawerTitle className="text-xl">
              {modo === "transferir" && `Mover a ${titulo} para...`}
              {modo === "fechar" && `Pagamento · ${titulo}`}
              {modo === "menu" && `${titulo} · Mesa ${mesa.numero}`}
            </DrawerTitle>
          </DrawerHeader>

          <div className="overflow-y-auto px-4">
            {modo === "menu" && (
              <div className="flex flex-col gap-2 pb-4">
                <Button
                  size="lg"
                  variant="acao"
                  className="justify-start"
                  disabled={pedirAjuda.isPending}
                  onClick={() => pedirAjuda.mutate()}
                >
                  <Hand /> Pedir ajuda a outro garçom
                </Button>
                {!souDaMesa && (
                  <Button
                    size="lg"
                    className="justify-start"
                    disabled={oferecer.isPending}
                    onClick={() => oferecer.mutate()}
                  >
                    <HandHeart /> Ajudar nesta mesa (entrar como auxiliar)
                  </Button>
                )}
                <Button
                  size="lg"
                  className="justify-start"
                  disabled={imprimir.isPending}
                  onClick={() => imprimir.mutate()}
                >
                  <Printer /> Imprimir conta ({formatBRL(comanda.totalCentavos)}
                  )
                </Button>
                <Button
                  size="lg"
                  className="justify-start"
                  onClick={() => setModo("transferir")}
                >
                  <ArrowRightLeft /> Trocar de mesa
                </Button>
                <Button
                  size="lg"
                  className="justify-start"
                  onClick={() => setModo("fechar")}
                >
                  <DoorOpen /> Receber pagamento e fechar
                </Button>
              </div>
            )}

            {modo === "transferir" && (
              <>
                <p className="mb-3 text-sm text-texto-secundario">
                  Só esta comanda muda de lugar. A mesa de destino pode ter
                  outras comandas.
                </p>
                <div className="grid grid-cols-4 gap-2">
                  {outrasMesas.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      aria-pressed={destino === m.id}
                      onClick={() => setDestino(m.id)}
                      className={cn(
                        "flex aspect-square flex-col items-center justify-center rounded-lg border-2 font-bold text-2xl",
                        destino === m.id
                          ? "border-status-ocupada bg-status-ocupada text-white"
                          : m.status === "livre"
                            ? "border-status-livre text-status-livre"
                            : "border-borda",
                      )}
                    >
                      {m.numero}
                      {m.comandas.length > 0 && (
                        <span className="font-normal text-xs">
                          {m.comandas.length}{" "}
                          {m.comandas.length === 1 ? "comanda" : "comandas"}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </>
            )}

            {modo === "fechar" && (
              <Recebimento
                comanda={comanda}
                onPago={(r) => {
                  toast.success(
                    r.trocoCentavos > 0
                      ? `Conta paga. Troco: ${formatBRL(r.trocoCentavos)}`
                      : `${titulo} paga`,
                  );
                  fechar();
                  router.push(`/garcom/mesa/${mesa.id}`);
                }}
              />
            )}
          </div>

          {modo === "transferir" && (
            <DrawerFooter>
              <Button
                variant="acao"
                size="lg"
                disabled={transferir.isPending || !destino}
                onClick={() => transferir.mutate()}
              >
                {transferir.isPending ? (
                  <Loader2 className="animate-spin" />
                ) : (
                  "Trocar de mesa"
                )}
              </Button>
            </DrawerFooter>
          )}
        </DrawerContent>
      </Drawer>
    </>
  );
};
