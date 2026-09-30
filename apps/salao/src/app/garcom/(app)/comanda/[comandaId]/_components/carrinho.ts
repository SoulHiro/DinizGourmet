"use client";

import { useCallback, useEffect, useState } from "react";

import { novoUuid } from "@/lib/uuid";

export type LinhaCarrinho = {
  chave: string;
  produtoId: string;
  quantidade: number;
  modificadorIds: string[];
  observacao?: string;
  mesaOrigemId?: string;
};

type EstadoCarrinho = { idempotencyKey: string; linhas: LinhaCarrinho[] };

export const linhaSimples = (l: LinhaCarrinho) =>
  l.modificadorIds.length === 0 && !l.observacao && !l.mesaOrigemId;

const assinatura = (l: LinhaCarrinho) =>
  [
    l.produtoId,
    [...l.modificadorIds].sort().join(","),
    l.observacao ?? "",
    l.mesaOrigemId ?? "",
  ].join("|");

// Linhas iguais (mesmo produto, mesmas observações, mesma mesa) viram uma só:
// tocar "Sem salada" duas vezes dá "2 sem salada". Mantém a chave da primeira.
const juntarIguais = (linhas: LinhaCarrinho[]) => {
  const resultado: LinhaCarrinho[] = [];
  for (const linha of linhas) {
    if (linha.quantidade <= 0) continue;
    const igual = resultado.find((r) => assinatura(r) === assinatura(linha));
    if (igual) igual.quantidade += linha.quantidade;
    else resultado.push({ ...linha });
  }
  return resultado;
};

export type ChipInfo = {
  id: string;
  tipo: "remocao" | "adicional" | "preparo";
};

// Ponto da carne é exclusivo: escolher "Ao ponto" tira "Mal passado".
const aplicarChip = (ids: string[], chip: ChipInfo, preparoIds: string[]) => {
  if (ids.includes(chip.id)) return ids.filter((id) => id !== chip.id);
  const base =
    chip.tipo === "preparo"
      ? ids.filter((id) => !preparoIds.includes(id))
      : ids;
  return [...base, chip.id];
};

// Carrinho da rodada em montagem. Fica no sessionStorage para sobreviver a
// um recarregamento da página, junto com a idempotency key: se o garçom
// reenviar depois de uma falha de rede, o servidor reconhece a mesma rodada.
export const useCarrinho = (comandaId: string) => {
  const chaveStorage = `carrinho:${comandaId}`;
  const [estado, setEstado] = useState<EstadoCarrinho>(() => ({
    idempotencyKey: novoUuid(),
    linhas: [],
  }));

  useEffect(() => {
    try {
      const salvo = sessionStorage.getItem(chaveStorage);
      if (salvo) setEstado(JSON.parse(salvo));
    } catch {}
  }, [chaveStorage]);

  useEffect(() => {
    try {
      if (estado.linhas.length) {
        sessionStorage.setItem(chaveStorage, JSON.stringify(estado));
      } else {
        sessionStorage.removeItem(chaveStorage);
      }
    } catch {}
  }, [chaveStorage, estado]);

  // +/- direto no card: mexe só na linha "sem nada" do produto.
  const alterarSimples = useCallback((produtoId: string, delta: number) => {
    setEstado((atual) => {
      const linhas = [...atual.linhas];
      const indice = linhas.findIndex(
        (l) => l.produtoId === produtoId && linhaSimples(l),
      );
      if (indice === -1) {
        if (delta <= 0) return atual;
        linhas.push({
          chave: novoUuid(),
          produtoId,
          quantidade: delta,
          modificadorIds: [],
        });
      } else {
        const quantidade = linhas[indice].quantidade + delta;
        if (quantidade <= 0) linhas.splice(indice, 1);
        else linhas[indice] = { ...linhas[indice], quantidade };
      }
      return { ...atual, linhas };
    });
  }, []);

  const adicionar = useCallback((linha: Omit<LinhaCarrinho, "chave">) => {
    setEstado((atual) => ({
      ...atual,
      linhas: juntarIguais([...atual.linhas, { ...linha, chave: novoUuid() }]),
    }));
  }, []);

  const remover = useCallback((chave: string) => {
    setEstado((atual) => ({
      ...atual,
      linhas: atual.linhas.filter((l) => l.chave !== chave),
    }));
  }, []);

  // Chip tocado sem pílula selecionada: separa 1 unidade completa com essa
  // observação (ou cria uma nova, se não houver completa sobrando).
  const separarComChip = useCallback((produtoId: string, chip: ChipInfo) => {
    setEstado((atual) => {
      const linhas = atual.linhas.map((l) => ({ ...l }));
      const simples = linhas.find(
        (l) => l.produtoId === produtoId && linhaSimples(l),
      );
      if (simples) simples.quantidade -= 1;
      linhas.push({
        chave: novoUuid(),
        produtoId,
        quantidade: 1,
        modificadorIds: [chip.id],
      });
      return { ...atual, linhas: juntarIguais(linhas) };
    });
  }, []);

  // Chip tocado com uma pílula selecionada: liga/desliga naquela linha.
  const alternarChip = useCallback(
    (chave: string, chip: ChipInfo, preparoIds: string[]) => {
      setEstado((atual) => ({
        ...atual,
        linhas: juntarIguais(
          atual.linhas.map((l) =>
            l.chave === chave
              ? {
                  ...l,
                  modificadorIds: aplicarChip(
                    l.modificadorIds,
                    chip,
                    preparoIds,
                  ),
                }
              : l,
          ),
        ),
      }));
    },
    [],
  );

  const alterarLinha = useCallback((chave: string, delta: number) => {
    setEstado((atual) => ({
      ...atual,
      linhas: juntarIguais(
        atual.linhas.map((l) =>
          l.chave === chave ? { ...l, quantidade: l.quantidade + delta } : l,
        ),
      ),
    }));
  }, []);

  // Depois de lançar com sucesso: carrinho vazio e chave nova.
  const reiniciar = useCallback(() => {
    setEstado({ idempotencyKey: novoUuid(), linhas: [] });
  }, []);

  const quantidadeSimples = (produtoId: string) =>
    estado.linhas.find((l) => l.produtoId === produtoId && linhaSimples(l))
      ?.quantidade ?? 0;

  const linhasDoProduto = (produtoId: string) =>
    estado.linhas.filter((l) => l.produtoId === produtoId);

  const quantidadeTotal = (produtoId: string) =>
    estado.linhas
      .filter((l) => l.produtoId === produtoId)
      .reduce((s, l) => s + l.quantidade, 0);

  return {
    idempotencyKey: estado.idempotencyKey,
    linhas: estado.linhas,
    alterarSimples,
    separarComChip,
    alternarChip,
    alterarLinha,
    linhasDoProduto,
    adicionar,
    remover,
    reiniciar,
    quantidadeSimples,
    quantidadeTotal,
  };
};
