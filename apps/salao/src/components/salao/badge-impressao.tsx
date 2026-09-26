"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Printer, RotateCcw } from "lucide-react";
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
import { useImpressao } from "@/lib/consultas";
import { cn } from "@/lib/utils";

const ROTULO_ESTADO: Record<string, string> = {
  pronta: "Pronta",
  ocupada: "Imprimindo",
  offline: "Offline",
  erro: "Com erro",
  desconhecido: "Verificando",
};

// "N pedidos aguardando impressão" + detalhe e botão de reenvio manual.
export const BadgeImpressao = () => {
  const { data } = useImpressao();
  const [aberto, setAberto] = useState(false);
  const queryClient = useQueryClient();

  const reenviar = useMutation({
    mutationFn: () =>
      api<{ reenviados: number }>("/api/impressao/reenviar", {
        method: "POST",
      }),
    onSuccess: ({ reenviados }) => {
      toast.success(
        reenviados ? `${reenviados} ticket(s) reenviado(s)` : "Nada pendente",
      );
      queryClient.invalidateQueries({ queryKey: ["impressao"] });
    },
    onError: (error) => toast.error(error.message),
  });

  const problema =
    (data?.falhas ?? 0) > 0 ||
    data?.impressoras.some(
      (i) => i.estado === "offline" || i.estado === "erro",
    );
  const aguardando = data?.aguardando ?? 0;

  return (
    <>
      <button
        type="button"
        onClick={() => setAberto(true)}
        aria-label={`${aguardando} ticket(s) aguardando impressão`}
        className={cn(
          "relative flex size-12 items-center justify-center rounded-lg",
          problema
            ? "bg-destructive/15 text-destructive"
            : "text-marca-foreground",
        )}
      >
        <Printer />
        {aguardando > 0 && (
          <span
            className={cn(
              "-top-0.5 -right-0.5 absolute flex min-w-5 items-center justify-center rounded-full px-1 font-bold text-xs",
              problema
                ? "bg-destructive text-white"
                : "bg-status-aguardando text-black",
            )}
          >
            {aguardando}
          </span>
        )}
      </button>

      <Drawer open={aberto} onOpenChange={setAberto}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Impressão</DrawerTitle>
          </DrawerHeader>
          <div className="flex flex-col gap-4 overflow-y-auto px-4">
            <ul className="grid grid-cols-3 gap-2">
              {data?.impressoras.map((impressora) => (
                <li
                  key={impressora.id}
                  className={cn(
                    "rounded-lg border p-2 text-center",
                    impressora.estado === "pronta" ||
                      impressora.estado === "ocupada"
                      ? "border-status-livre"
                      : "border-destructive",
                  )}
                >
                  <p className="font-semibold">{impressora.nome}</p>
                  <p className="text-sm text-texto-secundario">
                    {ROTULO_ESTADO[impressora.estado] ?? impressora.estado}
                  </p>
                  {impressora.motivo && (
                    <p className="mt-1 break-words text-left text-texto-secundario text-xs">
                      {impressora.motivo}
                    </p>
                  )}
                </li>
              ))}
            </ul>
            {aguardando === 0 ? (
              <p className="py-4 text-center text-texto-secundario">
                Tudo impresso.
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {data?.trabalhos.map((t) => (
                  <li key={t.id} className="rounded-lg border border-borda p-3">
                    <p className="font-semibold">
                      Mesa {t.mesa} · Rodada {t.rodada} · {t.impressora}
                      {t.tipo === "cancelamento" && " · cancelamento"}
                    </p>
                    <p className="text-sm text-texto-secundario">
                      {t.status === "falhou" ? "Falhou" : "Na fila"}
                      {t.ultimoErro ? ` — ${t.ultimoErro}` : ""}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <DrawerFooter>
            <Button
              variant="acao"
              size="lg"
              disabled={reenviar.isPending || aguardando === 0}
              onClick={() => reenviar.mutate()}
            >
              <RotateCcw /> Reenviar pendentes
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </>
  );
};
