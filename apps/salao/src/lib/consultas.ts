"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/cliente";
import type { CategoriaCardapio } from "@/lib/dominio/cardapio";
import type { DetalheMesa, MesaMapa } from "@/lib/dominio/mesas";

// As chaves batem com os escopos do socket: "mesas" invalida o mapa e os
// detalhes de mesa; "cardapio" invalida o cardápio; "impressao" o badge.
export const useMapa = () =>
  useQuery({
    queryKey: ["mesas"],
    queryFn: () => api<MesaMapa[]>("/api/mapa"),
  });

export const useDetalheMesa = (mesaId: string) =>
  useQuery({
    queryKey: ["mesas", "detalhe", mesaId],
    queryFn: () => api<DetalheMesa>(`/api/mesas/${mesaId}`),
  });

export const useCardapio = () =>
  useQuery({
    queryKey: ["cardapio"],
    queryFn: () => api<CategoriaCardapio[]>("/api/cardapio"),
    staleTime: 30_000,
  });

export type ResumoImpressao = {
  aguardando: number;
  falhas: number;
  trabalhos: {
    id: string;
    tipo: string;
    status: string;
    tentativas: number;
    ultimoErro: string | null;
    criadoEm: string;
    impressora: string;
    mesa: number;
    rodada: number;
  }[];
  impressoras: {
    id: string;
    nome: string;
    estado: string;
    pendentes: number;
  }[];
};

export const useImpressao = () =>
  useQuery({
    queryKey: ["impressao"],
    queryFn: () => api<ResumoImpressao>("/api/impressao"),
    refetchInterval: 30_000,
  });
