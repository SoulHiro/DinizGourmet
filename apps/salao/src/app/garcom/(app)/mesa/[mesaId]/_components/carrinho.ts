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

const linhaSimples = (l: LinhaCarrinho) =>
  l.modificadorIds.length === 0 && !l.observacao && !l.mesaOrigemId;

// Carrinho da rodada em montagem. Fica no sessionStorage para sobreviver a
// um recarregamento da página, junto com a idempotency key: se o garçom
// reenviar depois de uma falha de rede, o servidor reconhece a mesma rodada.
export const useCarrinho = (mesaId: string) => {
  const chaveStorage = `carrinho:${mesaId}`;
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
      linhas: [...atual.linhas, { ...linha, chave: novoUuid() }],
    }));
  }, []);

  const remover = useCallback((chave: string) => {
    setEstado((atual) => ({
      ...atual,
      linhas: atual.linhas.filter((l) => l.chave !== chave),
    }));
  }, []);

  // Depois de lançar com sucesso: carrinho vazio e chave nova.
  const reiniciar = useCallback(() => {
    setEstado({ idempotencyKey: novoUuid(), linhas: [] });
  }, []);

  const quantidadeSimples = (produtoId: string) =>
    estado.linhas.find((l) => l.produtoId === produtoId && linhaSimples(l))
      ?.quantidade ?? 0;

  const quantidadeTotal = (produtoId: string) =>
    estado.linhas
      .filter((l) => l.produtoId === produtoId)
      .reduce((s, l) => s + l.quantidade, 0);

  return {
    idempotencyKey: estado.idempotencyKey,
    linhas: estado.linhas,
    alterarSimples,
    adicionar,
    remover,
    reiniciar,
    quantidadeSimples,
    quantidadeTotal,
  };
};
