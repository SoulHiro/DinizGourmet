"use client";

import { useEffect, useState } from "react";

// Re-renderiza periodicamente para atualizar os "há X min".
export const useAgora = (intervaloMs = 30_000) => {
  const [agora, setAgora] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setAgora(Date.now()), intervaloMs);
    return () => clearInterval(timer);
  }, [intervaloMs]);
  return agora;
};

export const minutosDesde = (iso: string | null, agora: number) =>
  iso
    ? Math.max(0, Math.floor((agora - new Date(iso).getTime()) / 60_000))
    : null;

export const formatarDuracao = (minutos: number | null) => {
  if (minutos === null) return "";
  if (minutos < 1) return "agora";
  if (minutos < 60) return `${minutos} min`;
  return `${Math.floor(minutos / 60)}h${String(minutos % 60).padStart(2, "0")}`;
};

export const formatarHora = (iso: string) =>
  new Date(iso).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
