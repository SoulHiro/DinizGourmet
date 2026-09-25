"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowRightLeft,
  Combine,
  DoorOpen,
  Hand,
  HandHeart,
  Loader2,
  MoreVertical,
  Printer,
  Split,
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
import type { DetalheMesa } from "@/lib/dominio/mesas";
import { cn, formatBRL } from "@/lib/utils";

type Modo = "menu" | "juntar" | "transferir" | "fechar";

export const AcoesMesa = ({ detalhe }: { detalhe: DetalheMesa }) => {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: mapa } = useMapa();
  const [modo, setModo] = useState<Modo | null>(null);
  const [selecionadas, setSelecionadas] = useState<string[]>([]);
  const eu = useFuncionario();
  const pathname = usePathname();

  const { mesa, comanda } = detalhe;
  const principal =
    !comanda || comanda.mesas.find((m) => m.principal)?.id === mesa.id;
  const livres =
    mapa?.filter((m) => m.status === "livre" && m.id !== mesa.id) ?? [];
  const souDaMesa = comanda?.equipe.some((e) => e.id === eu.id) ?? false;

  const fechar = () => {
    setModo(null);
    setSelecionadas([]);
  };

  // Vindo do alerta "pediu a conta" (?receber), abre direto o pagamento.
  // biome-ignore lint/correctness/useExhaustiveDependencies: só ao montar a tela.
  useEffect(() => {
    if (!comanda) return;
    if (new URLSearchParams(window.location.search).has("receber")) {
      setModo("fechar");
      router.replace(pathname);
    }
  }, []);

  const acao = useMutation({
    mutationFn: async (tipo: "juntar" | "transferir" | "separar") => {
      const caminho = `/api/mesas/${mesa.id}/${tipo}`;
      if (tipo === "juntar")
        return api(caminho, {
          method: "POST",
          json: { mesaIds: selecionadas },
        });
      if (tipo === "transferir") {
        return api(caminho, {
          method: "POST",
          json: { destinoMesaId: selecionadas[0] },
        });
      }
      return api(caminho, { method: "POST" });
    },
    onSuccess: (_resultado, tipo) => {
      queryClient.invalidateQueries({ queryKey: ["mesas"] });
      const mensagens = {
        juntar: "Mesas juntadas",
        transferir: "Comanda transferida",
        separar: `Mesa ${mesa.numero} separada`,
      };
      toast.success(mensagens[tipo]);
      fechar();
      if (tipo === "transferir")
        router.replace(`/garcom/mesa/${selecionadas[0]}`);
      if (tipo === "separar") router.push("/garcom");
    },
    onError: (error) => toast.error(error.message),
  });

  const alternar = (id: string, unica: boolean) =>
    setSelecionadas((atual) =>
      unica
        ? [id]
        : atual.includes(id)
          ? atual.filter((x) => x !== id)
          : [...atual, id],
    );

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
      queryClient.invalidateQueries({ queryKey: ["mesas"] });
      fechar();
    },
    onError: (error) => toast.error(error.message),
  });

  // Conferência da conta, impressa no caixa (o cliente pediu para ver).
  const imprimir = useMutation({
    mutationFn: () =>
      api(`/api/mesas/${mesa.id}/imprimir-conta`, { method: "POST" }),
    onSuccess: () => {
      toast.success("Conta enviada para a impressora do caixa");
      fechar();
    },
    onError: (error) => toast.error(error.message),
  });

  const opcoes = [
    {
      modo: "juntar" as const,
      rotulo: "Juntar mesas",
      icone: Combine,
      visivel: principal,
    },
    {
      modo: "transferir" as const,
      rotulo: "Transferir para outra mesa",
      icone: ArrowRightLeft,
      visivel: Boolean(comanda) && principal,
    },
    {
      modo: "fechar" as const,
      rotulo: "Receber pagamento e fechar",
      icone: DoorOpen,
      visivel: Boolean(comanda),
    },
  ];

  return (
    <>
      <button
        type="button"
        aria-label="Ações da mesa"
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
              {modo === "juntar" && `Juntar com a mesa ${mesa.numero}`}
              {modo === "transferir" && `Mover a mesa ${mesa.numero} para...`}
              {modo === "fechar" && `Pagamento da mesa ${mesa.numero}`}
              {modo === "menu" && `Mesa ${mesa.numero}`}
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
                {comanda && !souDaMesa && (
                  <Button
                    size="lg"
                    className="justify-start"
                    disabled={oferecer.isPending}
                    onClick={() => oferecer.mutate()}
                  >
                    <HandHeart /> Ajudar nesta mesa (entrar como auxiliar)
                  </Button>
                )}
                {comanda && (
                  <Button
                    size="lg"
                    className="justify-start"
                    disabled={imprimir.isPending}
                    onClick={() => imprimir.mutate()}
                  >
                    <Printer /> Imprimir conta (
                    {formatBRL(comanda.totalCentavos)})
                  </Button>
                )}
                {opcoes
                  .filter((o) => o.visivel)
                  .map((o) => (
                    <Button
                      key={o.modo}
                      size="lg"
                      className="justify-start"
                      onClick={() => setModo(o.modo)}
                    >
                      <o.icone /> {o.rotulo}
                    </Button>
                  ))}
                {comanda && !principal && (
                  <Button
                    size="lg"
                    className="justify-start"
                    onClick={() => acao.mutate("separar")}
                  >
                    <Split /> Separar esta mesa
                  </Button>
                )}
              </div>
            )}

            {(modo === "juntar" || modo === "transferir") && (
              <>
                {livres.length === 0 && (
                  <p className="p-4 text-center text-texto-secundario">
                    Nenhuma mesa livre.
                  </p>
                )}
                <div className="grid grid-cols-4 gap-2">
                  {livres.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      aria-pressed={selecionadas.includes(m.id)}
                      onClick={() => alternar(m.id, modo === "transferir")}
                      className={cn(
                        "aspect-square rounded-lg border-2 font-bold text-2xl",
                        selecionadas.includes(m.id)
                          ? "border-status-ocupada bg-status-ocupada text-white"
                          : "border-status-livre text-status-livre",
                      )}
                    >
                      {m.numero}
                    </button>
                  ))}
                </div>
              </>
            )}

            {modo === "fechar" && comanda && (
              <Recebimento
                mesaId={mesa.id}
                comanda={comanda}
                onPago={(r) => {
                  toast.success(
                    r.trocoCentavos > 0
                      ? `Conta paga. Troco: ${formatBRL(r.trocoCentavos)}`
                      : `Conta paga, mesa ${mesa.numero} liberada`,
                  );
                  fechar();
                  router.push("/garcom");
                }}
              />
            )}
          </div>

          {(modo === "juntar" || modo === "transferir") && (
            <DrawerFooter>
              <Button
                variant="acao"
                size="lg"
                disabled={acao.isPending || selecionadas.length === 0}
                onClick={() => acao.mutate(modo)}
              >
                {acao.isPending ? (
                  <Loader2 className="animate-spin" />
                ) : modo === "juntar" ? (
                  "Juntar"
                ) : (
                  "Transferir"
                )}
              </Button>
            </DrawerFooter>
          )}
        </DrawerContent>
      </Drawer>
    </>
  );
};
