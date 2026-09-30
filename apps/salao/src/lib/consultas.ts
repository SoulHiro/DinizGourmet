"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/cliente";
import type { CategoriaCardapio } from "@/lib/dominio/cardapio";
import type {
  DetalheComanda,
  MesaComComandas,
  MesaMapa,
} from "@/lib/dominio/mesas";

// As chaves batem com os escopos do socket: "mesas" invalida o mapa e os
// detalhes de mesa; "cardapio" invalida o cardápio; "impressao" o badge.
export const useMapa = () =>
  useQuery({
    queryKey: ["mesas"],
    queryFn: () => api<MesaMapa[]>("/api/mapa"),
  });

// Cartões (comandas) abertos numa mesa.
export const useComandasDaMesa = (mesaId: string) =>
  useQuery({
    queryKey: ["mesas", "comandas", mesaId],
    queryFn: () => api<MesaComComandas>(`/api/mesas/${mesaId}`),
  });

// Tudo de uma comanda (tela da comanda, recebimento). Fica sob "mesas" para
// atualizar junto quando o socket avisar que o salão mudou.
export const useDetalheComanda = (comandaId: string) =>
  useQuery({
    queryKey: ["mesas", "comanda", comandaId],
    queryFn: () => api<DetalheComanda>(`/api/comandas/${comandaId}`),
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
    motivo?: string;
  }[];
};

export const useImpressao = () =>
  useQuery({
    queryKey: ["impressao"],
    queryFn: () => api<ResumoImpressao>("/api/impressao"),
    refetchInterval: 30_000,
  });
