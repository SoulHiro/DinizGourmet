"use client";

import { createContext, useContext } from "react";
import { AlertasAjuda } from "@/components/salao/alertas-ajuda";
import type { FuncionarioSessao } from "@/lib/auth/sessao";
import { TempoRealProvider } from "./tempo-real";

const SessaoContext = createContext<FuncionarioSessao | null>(null);

export const useFuncionario = () => {
  const funcionario = useContext(SessaoContext);
  if (!funcionario) throw new Error("useFuncionario fora da área autenticada");
  return funcionario;
};

export const AreaAutenticada = ({
  funcionario,
  children,
}: {
  funcionario: FuncionarioSessao;
  children: React.ReactNode;
}) => (
  <SessaoContext.Provider value={funcionario}>
    <TempoRealProvider>
      {children}
      <AlertasAjuda />
    </TempoRealProvider>
  </SessaoContext.Provider>
);
