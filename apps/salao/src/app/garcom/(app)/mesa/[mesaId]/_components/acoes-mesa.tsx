"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowRightLeft,
  Combine,
  DoorOpen,
  Loader2,
  MoreVertical,
  Split,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

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

  const { mesa, comanda } = detalhe;
  const principal =
    !comanda || comanda.mesas.find((m) => m.principal)?.id === mesa.id;
  const livres =
    mapa?.filter((m) => m.status === "livre" && m.id !== mesa.id) ?? [];

  const fechar = () => {
    setModo(null);
    setSelecionadas([]);
  };

  const acao = useMutation({
    mutationFn: async (
      tipo: "juntar" | "transferir" | "separar" | "fechar",
    ) => {
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
        fechar: `Mesa ${mesa.numero} liberada`,
      };
      toast.success(mensagens[tipo]);
      fechar();
      if (tipo === "transferir")
        router.replace(`/garcom/mesa/${selecionadas[0]}`);
      if (tipo === "fechar" || tipo === "separar") router.push("/garcom");
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
      rotulo: "Fechar mesa (já pagou)",
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
        <DrawerContent>
          <DrawerHeader className="text-left">
            <DrawerTitle className="text-xl">
              {modo === "juntar" && `Juntar com a mesa ${mesa.numero}`}
              {modo === "transferir" && `Mover a mesa ${mesa.numero} para...`}
              {modo === "fechar" && `Fechar a mesa ${mesa.numero}?`}
              {modo === "menu" && `Mesa ${mesa.numero}`}
            </DrawerTitle>
          </DrawerHeader>

          <div className="overflow-y-auto px-4">
            {modo === "menu" && (
              <div className="flex flex-col gap-2">
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
              <div className="rounded-xl border border-borda p-4">
                <p className="text-texto-secundario">Total da comanda</p>
                <p className="font-bold text-3xl">
                  {formatBRL(comanda.totalCentavos)}
                </p>
                <p className="mt-2 text-sm text-texto-secundario">
                  Confirme que o pagamento foi feito na maquininha. As mesas
                  ficam livres.
                </p>
              </div>
            )}
          </div>

          {modo && modo !== "menu" && (
            <DrawerFooter>
              <Button
                variant={modo === "fechar" ? "destrutivo" : "acao"}
                size="lg"
                disabled={
                  acao.isPending ||
                  (modo !== "fechar" && selecionadas.length === 0)
                }
                onClick={() => acao.mutate(modo)}
              >
                {acao.isPending ? (
                  <Loader2 className="animate-spin" />
                ) : modo === "juntar" ? (
                  "Juntar"
                ) : modo === "transferir" ? (
                  "Transferir"
                ) : (
                  "Fechar mesa"
                )}
              </Button>
            </DrawerFooter>
          )}
        </DrawerContent>
      </Drawer>
    </>
  );
};
