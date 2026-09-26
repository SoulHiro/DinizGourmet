"use client";

import { useQueryClient } from "@tanstack/react-query";
import { createContext, useContext, useEffect, useState } from "react";
import { io } from "socket.io-client";

type EstadoConexao = "conectando" | "online" | "offline";

const ConexaoContext = createContext<EstadoConexao>("conectando");

export const useConexao = () => useContext(ConexaoContext);

// O WebSocket é só um gatilho: "o escopo X mudou". Quem tem o dado é o banco,
// então o cliente invalida as queries e busca de novo. O jitter espalha as
// re-buscas de vários celulares para não bater todas no mesmo milissegundo.
const jitter = () => 100 + Math.random() * 300;

export const TempoRealProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const queryClient = useQueryClient();
  const [estado, setEstado] = useState<EstadoConexao>("conectando");

  useEffect(() => {
    const socket = io({ transports: ["websocket"] });
    const pendentes = new Set<string>();
    let timer: ReturnType<typeof setTimeout> | undefined;

    const agendar = (escopos: string[]) => {
      for (const escopo of escopos) pendentes.add(escopo);
      if (timer) return;
      timer = setTimeout(() => {
        timer = undefined;
        for (const escopo of pendentes) {
          const [raiz, id] = escopo.split(":");
          queryClient.invalidateQueries({ queryKey: id ? [raiz, id] : [raiz] });
        }
        pendentes.clear();
      }, jitter());
    };

    socket.on("connect", () => {
      setEstado("online");
      // Pode ter perdido eventos enquanto estava desconectado: re-sincroniza tudo.
      queryClient.invalidateQueries();
    });
    socket.on("disconnect", () => setEstado("offline"));
    socket.on("connect_error", (error) => {
      setEstado("offline");
      if (error.message === "nao_autenticado") {
        window.location.href = "/garcom/login";
      }
    });
    socket.on("sync", (evento: { escopos: string[] }) =>
      agendar(evento.escopos),
    );

    return () => {
      if (timer) clearTimeout(timer);
      socket.disconnect();
    };
  }, [queryClient]);

  return (
    <ConexaoContext.Provider value={estado}>{children}</ConexaoContext.Provider>
  );
};
