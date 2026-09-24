"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, Clock, Loader2 } from "lucide-react";
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
import { MOTIVOS_CANCELAMENTO } from "@/lib/dominio/constantes";
import type { DetalheMesa } from "@/lib/dominio/mesas";
import { formatarHora } from "@/lib/tempo";
import { cn, formatBRL } from "@/lib/utils";

type Comanda = NonNullable<DetalheMesa["comanda"]>;
type Item = Comanda["rodadas"][number]["itens"][number];

const IconeImpressao = ({
  status,
}: {
  status: "impresso" | "pendente" | "falhou";
}) => {
  if (status === "impresso")
    return (
      <CheckCircle2
        className="size-4 text-status-livre"
        aria-label="Impresso"
      />
    );
  if (status === "falhou")
    return (
      <AlertTriangle
        className="size-4 text-destructive"
        aria-label="Falha na impressão"
      />
    );
  return (
    <Clock
      className="size-4 text-texto-secundario"
      aria-label="Aguardando impressão"
    />
  );
};

const DrawerCancelar = ({
  item,
  onFechar,
}: {
  item: Item | null;
  onFechar: () => void;
}) => {
  const queryClient = useQueryClient();
  const [motivo, setMotivo] = useState<string | null>(null);
  const [outro, setOutro] = useState("");
  const [preparoIniciado, setPreparoIniciado] = useState<boolean | null>(null);

  const cancelar = useMutation({
    mutationFn: () =>
      api(`/api/itens/${item?.id}/cancelar`, {
        method: "POST",
        json: {
          motivo: motivo === "Outro" ? outro.trim() : motivo,
          preparoIniciado,
        },
      }),
    onSuccess: () => {
      toast.success(
        preparoIniciado
          ? "Cancelado. Aviso enviado para a cozinha."
          : "Cancelado e estoque devolvido.",
      );
      queryClient.invalidateQueries({ queryKey: ["mesas"] });
      queryClient.invalidateQueries({ queryKey: ["cardapio"] });
      fechar();
    },
    onError: (error) => toast.error(error.message),
  });

  const fechar = () => {
    setMotivo(null);
    setOutro("");
    setPreparoIniciado(null);
    onFechar();
  };

  if (!item) return null;
  const motivoValido =
    motivo === "Outro" ? outro.trim().length >= 3 : Boolean(motivo);

  return (
    <Drawer open onOpenChange={(aberto) => !aberto && fechar()}>
      <DrawerContent>
        <DrawerHeader className="text-left">
          <DrawerTitle className="text-xl">
            Cancelar {item.quantidade}x {item.nome}?
          </DrawerTitle>
        </DrawerHeader>
        <div className="flex flex-col gap-5 overflow-y-auto px-4">
          <div>
            <p className="mb-2 font-semibold">Motivo</p>
            <div className="flex flex-wrap gap-2">
              {[...MOTIVOS_CANCELAMENTO, "Outro"].map((m) => (
                <button
                  key={m}
                  type="button"
                  aria-pressed={motivo === m}
                  onClick={() => setMotivo(m)}
                  className={cn(
                    "min-h-12 rounded-full border-2 px-4 font-semibold",
                    motivo === m
                      ? "border-marca bg-marca text-marca-foreground"
                      : "border-borda",
                  )}
                >
                  {m}
                </button>
              ))}
            </div>
            {motivo === "Outro" && (
              <input
                // biome-ignore lint/a11y/noAutofocus: o campo só aparece depois de um toque do usuário nele
                autoFocus
                value={outro}
                maxLength={140}
                onChange={(e) => setOutro(e.target.value)}
                placeholder="Descreva rapidamente"
                className="mt-2 h-12 w-full rounded-lg border border-borda bg-surface px-3"
              />
            )}
          </div>
          <div>
            <p className="mb-2 font-semibold">O preparo já foi iniciado?</p>
            <div className="grid grid-cols-2 gap-2">
              <Button
                size="lg"
                variant={preparoIniciado === false ? "marca" : "outline"}
                onClick={() => setPreparoIniciado(false)}
              >
                Não
              </Button>
              <Button
                size="lg"
                variant={preparoIniciado === true ? "marca" : "outline"}
                onClick={() => setPreparoIniciado(true)}
              >
                Sim
              </Button>
            </div>
            <p className="mt-2 text-sm text-texto-secundario">
              {preparoIniciado === true &&
                "O estoque não volta. A cozinha recebe o aviso para parar."}
              {preparoIniciado === false && "O item volta para o estoque."}
            </p>
          </div>
        </div>
        <DrawerFooter>
          <Button
            variant="destrutivo"
            size="lg"
            disabled={
              !motivoValido || preparoIniciado === null || cancelar.isPending
            }
            onClick={() => cancelar.mutate()}
          >
            {cancelar.isPending ? (
              <Loader2 className="animate-spin" />
            ) : (
              "Confirmar cancelamento"
            )}
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
};

// Histórico da comanda: rodadas imutáveis, só dá para cancelar item a item.
export const Conta = ({ comanda }: { comanda: Comanda }) => {
  const [cancelando, setCancelando] = useState<Item | null>(null);
  const agrupada = comanda.mesas.length > 1;

  return (
    <div className="flex flex-col gap-3 p-3 pb-10">
      <section className="rounded-xl border border-borda bg-surface p-4">
        <div className="flex items-baseline justify-between">
          <span className="text-texto-secundario">Total</span>
          <span className="font-bold text-2xl">
            {formatBRL(comanda.totalCentavos)}
          </span>
        </div>
        {agrupada && (
          <ul className="mt-2 flex flex-col gap-1 border-borda border-t pt-2 text-sm">
            {comanda.totaisPorMesa.map((t) => (
              <li key={t.numero} className="flex justify-between">
                <span>Mesa {t.numero}</span>
                <span>{formatBRL(t.totalCentavos)}</span>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-2 text-sm text-texto-secundario">
          Aberta às {formatarHora(comanda.abertaEm)} · {comanda.titular}
        </p>
      </section>

      {comanda.rodadas.length === 0 && (
        <p className="p-6 text-center text-texto-secundario">
          Nenhum pedido lançado ainda.
        </p>
      )}

      {comanda.rodadas.map((rodada) => (
        <section
          key={rodada.id}
          className="rounded-xl border border-borda bg-surface"
        >
          <header className="flex items-center gap-2 border-borda border-b px-3 py-2 text-sm">
            <span className="font-semibold">Rodada {rodada.numero}</span>
            <span className="text-texto-secundario">
              {formatarHora(rodada.lancadaEm)} · {rodada.garcom}
            </span>
            <span className="ml-auto">
              <IconeImpressao status={rodada.impressao} />
            </span>
          </header>
          <ul>
            {rodada.itens.map((item) => {
              const cancelado = item.status === "cancelado";
              return (
                <li key={item.id} className="flex items-center gap-2 px-3 py-2">
                  <div
                    className={cn(
                      "flex-1",
                      cancelado && "text-texto-secundario line-through",
                    )}
                  >
                    <p className="font-semibold">
                      {item.quantidade}x {item.nome}
                    </p>
                    {(item.modificadores.length > 0 ||
                      item.observacao ||
                      agrupada) && (
                      <p className="text-sm text-texto-secundario">
                        {[
                          item.modificadores.join(", "),
                          item.observacao && `Obs: ${item.observacao}`,
                          agrupada && `Mesa ${item.mesaOrigem}`,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    )}
                    {cancelado && item.motivoCancelamento && (
                      <p className="text-sm no-underline">
                        Cancelado: {item.motivoCancelamento}
                      </p>
                    )}
                  </div>
                  <span
                    className={cn(
                      "text-sm",
                      cancelado && "line-through opacity-60",
                    )}
                  >
                    {formatBRL(item.totalCentavos)}
                  </span>
                  {!cancelado && (
                    <Button
                      size="md"
                      variant="ghost"
                      className="text-destructive"
                      onClick={() => setCancelando(item)}
                    >
                      Cancelar
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ))}

      <DrawerCancelar item={cancelando} onFechar={() => setCancelando(null)} />
    </div>
  );
};
