"use client";

import { Minus } from "lucide-react";

import type { ProdutoCardapio } from "@/lib/dominio/cardapio";
import { cn, formatBRL } from "@/lib/utils";
import { type ChipInfo, type LinhaCarrinho, linhaSimples } from "./carrinho";

// Fluxo rápido de observações, sem abrir tela nenhuma:
//  - O "+" do card adiciona unidades completas.
//  - Chip tocado sem pílula selecionada separa 1 unidade com aquela observação
//    (5 completos → toque "Sem salada" → 4 completos + 1 sem salada).
//  - Toque numa pílula para selecioná-la; aí os chips ligam/desligam nela
//    (a mesma pessoa quer "sem salada" e "mal passado").
export const FaixaObservacoes = ({
  produto,
  linhas,
  selecionada,
  onSelecionar,
  onSepararComChip,
  onAlternarChip,
  onAlterarLinha,
  mostrarChips = true,
}: {
  produto: ProdutoCardapio;
  linhas: LinhaCarrinho[];
  selecionada: string | null;
  onSelecionar: (chave: string | null) => void;
  onSepararComChip: (chip: ChipInfo) => void;
  onAlternarChip: (chave: string, chip: ChipInfo, preparoIds: string[]) => void;
  onAlterarLinha: (chave: string, delta: number) => void;
  mostrarChips?: boolean;
}) => {
  const nomes = new Map(produto.modificadores.map((m) => [m.id, m.nome]));
  const preparoIds = produto.modificadores
    .filter((m) => m.tipo === "preparo")
    .map((m) => m.id);
  const linhaSelecionada = linhas.find(
    (l) => l.chave === selecionada && !linhaSimples(l),
  );

  const descrever = (linha: LinhaCarrinho) => {
    if (linhaSimples(linha)) return "completo";
    const partes = linha.modificadorIds.map(
      (id) => nomes.get(id)?.toLowerCase() ?? "",
    );
    if (linha.observacao) partes.push(`"${linha.observacao}"`);
    return partes.join(", ") || "personalizado";
  };

  const tocarChip = (chip: ChipInfo) => {
    if (linhaSelecionada)
      onAlternarChip(linhaSelecionada.chave, chip, preparoIds);
    else onSepararComChip(chip);
  };

  // Completos primeiro, depois as variações na ordem em que foram criadas.
  const ordenadas = [
    ...linhas.filter(linhaSimples),
    ...linhas.filter((l) => !linhaSimples(l)),
  ];

  return (
    <div className="flex flex-col gap-2 pt-1 pb-1">
      <div className="flex flex-wrap gap-1.5">
        {ordenadas.map((linha) => {
          const simples = linhaSimples(linha);
          const ativa = linha.chave === linhaSelecionada?.chave;
          return (
            <span
              key={linha.chave}
              className={cn(
                "flex min-h-11 items-center overflow-hidden rounded-full border-2 text-sm",
                ativa
                  ? "border-marca bg-marca text-marca-foreground"
                  : "border-borda bg-fundo",
              )}
            >
              <button
                type="button"
                disabled={simples}
                aria-pressed={simples ? undefined : ativa}
                onClick={() => onSelecionar(ativa ? null : linha.chave)}
                className="flex h-11 items-center gap-1 pr-1 pl-3 font-semibold disabled:cursor-default"
              >
                <span className="font-bold">{linha.quantidade}</span>{" "}
                {descrever(linha)}
              </button>
              {!simples && (
                <button
                  type="button"
                  aria-label={`Tirar uma unidade (${descrever(linha)})`}
                  onClick={() => {
                    if (linha.quantidade === 1 && ativa) onSelecionar(null);
                    onAlterarLinha(linha.chave, -1);
                  }}
                  className="flex size-11 items-center justify-center"
                >
                  <Minus className="size-4" />
                </button>
              )}
            </span>
          );
        })}
      </div>

      {mostrarChips && produto.modificadores.length > 0 && (
        <>
          <p className="px-1 text-texto-secundario text-xs">
            {linhaSelecionada
              ? `Ajustando "${linhaSelecionada.quantidade} ${descrever(linhaSelecionada)}". Toque de novo na pílula para soltar.`
              : "Toque num chip para separar 1 unidade com a observação."}
          </p>
          <div className="-mx-2 flex gap-1.5 overflow-x-auto px-2 pb-1 [scrollbar-width:none]">
            {produto.modificadores.map((chip) => {
              const ligado =
                linhaSelecionada?.modificadorIds.includes(chip.id) ?? false;
              return (
                <button
                  key={chip.id}
                  type="button"
                  aria-pressed={linhaSelecionada ? ligado : undefined}
                  disabled={chip.esgotado && !ligado}
                  onClick={() => tocarChip(chip)}
                  className={cn(
                    "h-11 shrink-0 rounded-full border-2 px-3 font-semibold text-sm active:scale-[0.96] disabled:opacity-40",
                    ligado
                      ? "border-marca bg-marca text-marca-foreground"
                      : chip.tipo === "preparo"
                        ? "border-status-ocupada/60 bg-surface"
                        : "border-borda bg-surface",
                  )}
                >
                  {chip.nome}
                  {chip.esgotado
                    ? " · acabou"
                    : chip.precoCentavos > 0 &&
                      ` +${formatBRL(chip.precoCentavos)}`}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
};
