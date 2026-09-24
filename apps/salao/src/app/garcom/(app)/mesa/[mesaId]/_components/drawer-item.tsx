"use client";

import { Minus, Plus } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import type { ProdutoCardapio } from "@/lib/dominio/cardapio";
import { cn, formatBRL } from "@/lib/utils";
import type { LinhaCarrinho } from "./carrinho";

type MesaDaComanda = { id: string; numero: number };

// Toque no item: chips de modificador rápido, observação só se precisar,
// quantidade e (com mesas juntas) de qual mesa é o item.
export const DrawerItem = ({
  produto,
  mesas,
  mesaAtualId,
  onFechar,
  onAdicionar,
}: {
  produto: ProdutoCardapio | null;
  mesas: MesaDaComanda[];
  mesaAtualId: string;
  onFechar: () => void;
  onAdicionar: (linha: Omit<LinhaCarrinho, "chave">) => void;
}) => {
  const [quantidade, setQuantidade] = useState(1);
  const [selecionados, setSelecionados] = useState<string[]>([]);
  const [observacao, setObservacao] = useState("");
  const [mostrarObservacao, setMostrarObservacao] = useState(false);
  const [mesaOrigemId, setMesaOrigemId] = useState(mesaAtualId);

  useEffect(() => {
    if (produto) {
      setQuantidade(1);
      setSelecionados([]);
      setObservacao("");
      setMostrarObservacao(false);
      setMesaOrigemId(mesaAtualId);
    }
  }, [produto, mesaAtualId]);

  if (!produto) return null;

  const alternar = (id: string) =>
    setSelecionados((atual) =>
      atual.includes(id) ? atual.filter((x) => x !== id) : [...atual, id],
    );

  const adicionais = produto.modificadores
    .filter((m) => selecionados.includes(m.id))
    .reduce((soma, m) => soma + m.precoCentavos, 0);
  const total = (produto.precoCentavos + adicionais) * quantidade;

  return (
    <Drawer open onOpenChange={(aberto) => !aberto && onFechar()}>
      <DrawerContent>
        <DrawerHeader className="text-left">
          <DrawerTitle className="text-2xl">{produto.nome}</DrawerTitle>
          <p className="text-texto-secundario">
            {formatBRL(produto.precoCentavos)}
          </p>
        </DrawerHeader>

        <div className="flex flex-col gap-5 overflow-y-auto px-4">
          {produto.modificadores.length > 0 && (
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
                      "min-h-12 rounded-full border-2 px-4 font-semibold active:scale-[0.96]",
                      ativo
                        ? "border-marca bg-marca text-marca-foreground"
                        : "border-borda bg-surface text-texto",
                    )}
                  >
                    {m.nome}
                    {m.precoCentavos > 0 && ` +${formatBRL(m.precoCentavos)}`}
                  </button>
                );
              })}
            </div>
          )}

          {mostrarObservacao ? (
            <input
              // biome-ignore lint/a11y/noAutofocus: o campo só aparece depois de um toque do usuário nele
              autoFocus
              value={observacao}
              maxLength={140}
              onChange={(e) => setObservacao(e.target.value)}
              placeholder="Ex.: bem passado, molho à parte"
              className="h-12 rounded-lg border border-borda bg-surface px-3 text-base"
            />
          ) : (
            <Button
              variant="ghost"
              className="self-start"
              onClick={() => setMostrarObservacao(true)}
            >
              + Observação
            </Button>
          )}

          {mesas.length > 1 && (
            <div>
              <p className="mb-2 font-semibold text-sm text-texto-secundario">
                Da mesa
              </p>
              <div className="flex flex-wrap gap-2">
                {mesas.map((mesa) => (
                  <button
                    key={mesa.id}
                    type="button"
                    aria-pressed={mesaOrigemId === mesa.id}
                    onClick={() => setMesaOrigemId(mesa.id)}
                    className={cn(
                      "size-12 rounded-lg border-2 font-bold text-lg",
                      mesaOrigemId === mesa.id
                        ? "border-status-ocupada bg-status-ocupada text-white"
                        : "border-borda",
                    )}
                  >
                    {mesa.numero}
                  </button>
                ))}
              </div>
            </div>
          )}

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
        </div>

        <DrawerFooter>
          <Button
            variant="acao"
            size="lg"
            onClick={() => {
              onAdicionar({
                produtoId: produto.id,
                quantidade,
                modificadorIds: selecionados,
                observacao: observacao.trim() || undefined,
                mesaOrigemId:
                  mesas.length > 1 && mesaOrigemId !== mesaAtualId
                    ? mesaOrigemId
                    : undefined,
              });
              onFechar();
            }}
          >
            Adicionar · {formatBRL(total)}
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
};
