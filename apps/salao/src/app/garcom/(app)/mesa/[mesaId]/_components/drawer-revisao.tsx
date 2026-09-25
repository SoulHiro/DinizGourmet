"use client";

import { ChevronDown, Loader2, Minus, Plus, Trash2 } from "lucide-react";
import { useState } from "react";

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
import type { ChipInfo, LinhaCarrinho } from "./carrinho";
import { linhaSimples } from "./carrinho";
import { FaixaObservacoes } from "./faixa-observacoes";

type Carrinho = {
  linhas: LinhaCarrinho[];
  alterarSimples: (produtoId: string, delta: number) => void;
  alterarLinha: (chave: string, delta: number) => void;
  remover: (chave: string) => void;
  separarComChip: (produtoId: string, chip: ChipInfo) => void;
  alternarChip: (chave: string, chip: ChipInfo, preparoIds: string[]) => void;
};

const subtotal = (produto: ProdutoCardapio, linhas: LinhaCarrinho[]) =>
  linhas.reduce((soma, linha) => {
    const adicionais = produto.modificadores
      .filter((m) => linha.modificadorIds.includes(m.id))
      .reduce((s, m) => s + m.precoCentavos, 0);
    return soma + (produto.precoCentavos + adicionais) * linha.quantidade;
  }, 0);

// Revisão antes de lançar: o garçom confere tudo, ajusta quantidades e, só
// se precisar, abre as observações de cada item. Nada vai para a cozinha
// até tocar em "Lançar pedido".
export const DrawerRevisao = ({
  aberto,
  onFechar,
  carrinho,
  produtosPorId,
  mesas,
  totalCentavos,
  lancando,
  onLancar,
}: {
  aberto: boolean;
  onFechar: () => void;
  carrinho: Carrinho;
  produtosPorId: Map<string, ProdutoCardapio>;
  mesas: { id: string; numero: number }[];
  totalCentavos: number;
  lancando: boolean;
  onLancar: () => void;
}) => {
  const [observacoesAbertas, setObservacoesAbertas] = useState<string | null>(
    null,
  );
  const [pilulaSelecionada, setPilulaSelecionada] = useState<string | null>(
    null,
  );

  // Agrupa as linhas por produto, na ordem em que foram adicionados.
  const grupos: { produto: ProdutoCardapio; linhas: LinhaCarrinho[] }[] = [];
  for (const linha of carrinho.linhas) {
    const produto = produtosPorId.get(linha.produtoId);
    if (!produto) continue;
    const grupo = grupos.find((g) => g.produto.id === produto.id);
    if (grupo) grupo.linhas.push(linha);
    else grupos.push({ produto, linhas: [linha] });
  }

  const totalItens = carrinho.linhas.reduce((s, l) => s + l.quantidade, 0);

  const diminuir = (produtoId: string, linhas: LinhaCarrinho[]) => {
    // Tira primeiro um completo; se não houver, da última variação.
    if (linhas.some(linhaSimples)) carrinho.alterarSimples(produtoId, -1);
    else carrinho.alterarLinha(linhas[linhas.length - 1].chave, -1);
  };

  const origemDe = (linha: LinhaCarrinho) =>
    mesas.find((m) => m.id === linha.mesaOrigemId)?.numero;

  return (
    <Drawer open={aberto} onOpenChange={(v) => !v && onFechar()}>
      <DrawerContent className="h-[92dvh]">
        <DrawerHeader className="text-left">
          <DrawerTitle className="text-xl">Revisar pedido</DrawerTitle>
          <p className="text-sm text-texto-secundario">
            {totalItens} {totalItens === 1 ? "item" : "itens"} · confira antes
            de mandar para a cozinha
          </p>
        </DrawerHeader>

        <ul className="flex flex-1 flex-col gap-2 overflow-y-auto px-3 pb-3">
          {grupos.length === 0 && (
            <p className="p-6 text-center text-texto-secundario">
              Nenhum item no pedido.
            </p>
          )}
          {grupos.map(({ produto, linhas }) => {
            const quantidade = linhas.reduce((s, l) => s + l.quantidade, 0);
            const temVariacao = linhas.some((l) => !linhaSimples(l));
            const abertas = observacoesAbertas === produto.id;
            const extras = linhas.filter((l) => l.observacao || l.mesaOrigemId);
            return (
              <li
                key={produto.id}
                className="rounded-xl border border-borda bg-surface p-2 pl-3"
              >
                <div className="flex items-center gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-lg leading-tight">
                      {produto.codigo !== null && (
                        <span className="mr-1.5 font-bold text-texto-secundario tabular-nums">
                          {produto.codigo}
                        </span>
                      )}
                      {produto.nome}
                    </p>
                    <p className="text-sm text-texto-secundario">
                      {formatBRL(subtotal(produto, linhas))}
                    </p>
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label={`Tirar um ${produto.nome}`}
                    onClick={() => diminuir(produto.id, linhas)}
                  >
                    {quantidade === 1 ? (
                      <Trash2 className="text-destructive" />
                    ) : (
                      <Minus />
                    )}
                  </Button>
                  <span className="w-6 text-center font-bold text-xl">
                    {quantidade}
                  </span>
                  <Button
                    size="icon"
                    variant="marca"
                    aria-label={`Mais um ${produto.nome}`}
                    onClick={() => carrinho.alterarSimples(produto.id, 1)}
                  >
                    <Plus />
                  </Button>
                </div>

                {(temVariacao || abertas) && (
                  <FaixaObservacoes
                    produto={produto}
                    linhas={linhas}
                    selecionada={abertas ? pilulaSelecionada : null}
                    onSelecionar={setPilulaSelecionada}
                    onSepararComChip={(chip) =>
                      carrinho.separarComChip(produto.id, chip)
                    }
                    onAlternarChip={carrinho.alternarChip}
                    onAlterarLinha={carrinho.alterarLinha}
                    mostrarChips={abertas}
                  />
                )}

                {extras.map((linha) => (
                  <p
                    key={linha.chave}
                    className="text-sm text-texto-secundario"
                  >
                    {linha.quantidade}×{" "}
                    {[
                      linha.observacao && `Obs: ${linha.observacao}`,
                      origemDe(linha) && `Mesa ${origemDe(linha)}`,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                ))}

                {produto.modificadores.length > 0 && (
                  <button
                    type="button"
                    aria-expanded={abertas}
                    onClick={() => {
                      setPilulaSelecionada(null);
                      setObservacoesAbertas(abertas ? null : produto.id);
                    }}
                    className="flex min-h-11 items-center gap-1 font-semibold text-acao text-sm"
                  >
                    {abertas ? "Fechar observações" : "Observações"}
                    <ChevronDown
                      className={cn(
                        "size-4 transition-transform",
                        abertas && "rotate-180",
                      )}
                    />
                  </button>
                )}
              </li>
            );
          })}
        </ul>

        <DrawerFooter className="border-borda border-t">
          <Button
            variant="acao"
            size="lg"
            disabled={carrinho.linhas.length === 0 || lancando}
            onClick={onLancar}
          >
            {lancando ? (
              <Loader2 className="animate-spin" />
            ) : (
              <>Lançar pedido · {formatBRL(totalCentavos)}</>
            )}
          </Button>
          <Button size="lg" variant="ghost" onClick={onFechar}>
            Continuar adicionando
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
};
