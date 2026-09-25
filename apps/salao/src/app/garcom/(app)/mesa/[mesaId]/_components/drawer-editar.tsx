"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Minus, Plus } from "lucide-react";
import { useEffect, useState } from "react";
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
import { useCardapio } from "@/lib/consultas";
import { cn, formatBRL } from "@/lib/utils";

export type ItemEditavel = {
  id: string;
  produtoId: string;
  nome: string;
  quantidade: number;
  observacao: string | null;
  modificadorIds: string[];
};

// Editar item já lançado. Se o ticket ainda não saiu, só é corrigido; se já
// saiu, a cozinha recebe um ticket de ALTERAÇÃO com o antes e o depois.
export const DrawerEditar = ({
  item,
  onFechar,
}: {
  item: ItemEditavel | null;
  onFechar: () => void;
}) => {
  const queryClient = useQueryClient();
  const { data: categorias } = useCardapio();
  const [quantidade, setQuantidade] = useState(1);
  const [selecionados, setSelecionados] = useState<string[]>([]);
  const [observacao, setObservacao] = useState("");

  useEffect(() => {
    if (item) {
      setQuantidade(item.quantidade);
      setSelecionados(item.modificadorIds);
      setObservacao(item.observacao ?? "");
    }
  }, [item]);

  const produto = categorias
    ?.flatMap((c) => c.produtos)
    .find((p) => p.id === item?.produtoId);
  const preparoIds =
    produto?.modificadores
      .filter((m) => m.tipo === "preparo")
      .map((m) => m.id) ?? [];

  const salvar = useMutation({
    mutationFn: () =>
      api<{ alterou: boolean }>(`/api/itens/${item?.id}/editar`, {
        method: "POST",
        json: {
          quantidade,
          modificadorIds: selecionados,
          observacao: observacao.trim() || undefined,
        },
      }),
    onSuccess: ({ alterou }) => {
      toast.success(
        alterou ? "Item alterado. A cozinha foi avisada." : "Nada mudou.",
      );
      queryClient.invalidateQueries({ queryKey: ["mesas"] });
      queryClient.invalidateQueries({ queryKey: ["cardapio"] });
      onFechar();
    },
    onError: (error) => toast.error(error.message),
  });

  if (!item) return null;

  const alternar = (id: string) =>
    setSelecionados((atual) => {
      if (atual.includes(id)) return atual.filter((x) => x !== id);
      const base = preparoIds.includes(id)
        ? atual.filter((x) => !preparoIds.includes(x))
        : atual;
      return [...base, id];
    });

  return (
    <Drawer open onOpenChange={(aberto) => !aberto && onFechar()}>
      <DrawerContent>
        <DrawerHeader className="text-left">
          <DrawerTitle className="text-xl">Editar {item.nome}</DrawerTitle>
        </DrawerHeader>
        <div className="flex flex-col gap-5 overflow-y-auto px-4">
          <div className="flex items-center justify-center gap-6">
            <Button
              size="icon"
              aria-label="Diminuir"
              onClick={() => setQuantidade((q) => Math.max(1, q - 1))}
            >
              <Minus />
            </Button>
            <span className="w-10 text-center font-bold text-3xl">
              {quantidade}
            </span>
            <Button
              size="icon"
              aria-label="Aumentar"
              onClick={() => setQuantidade((q) => Math.min(50, q + 1))}
            >
              <Plus />
            </Button>
          </div>

          {produto && produto.modificadores.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {produto.modificadores.map((m) => {
                const ativo = selecionados.includes(m.id);
                return (
                  <button
                    key={m.id}
                    type="button"
                    aria-pressed={ativo}
                    onClick={() => alternar(m.id)}
                    className={cn(
                      "min-h-12 rounded-full border-2 px-4 font-semibold",
                      ativo
                        ? "border-marca bg-marca text-marca-foreground"
                        : "border-borda bg-surface",
                    )}
                  >
                    {m.nome}
                    {m.precoCentavos > 0 && ` +${formatBRL(m.precoCentavos)}`}
                  </button>
                );
              })}
            </div>
          )}

          <input
            value={observacao}
            maxLength={140}
            onChange={(e) => setObservacao(e.target.value)}
            placeholder="Observação (opcional)"
            className="h-12 rounded-lg border border-borda bg-surface px-3"
          />
          <p className="text-sm text-texto-secundario">
            Para cancelar o item inteiro, use o botão de cancelar na conta.
          </p>
        </div>
        <DrawerFooter>
          <Button
            variant="acao"
            size="lg"
            disabled={salvar.isPending}
            onClick={() => salvar.mutate()}
          >
            {salvar.isPending ? (
              <Loader2 className="animate-spin" />
            ) : (
              "Salvar alteração"
            )}
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
};
