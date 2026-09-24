"use client";

import { ChevronLeft, LogOut, Moon, Sun } from "lucide-react";
import Link from "next/link";
import { useTheme } from "next-themes";

import { useConexao } from "@/components/providers/tempo-real";
import { api } from "@/lib/cliente";
import { cn } from "@/lib/utils";
import { BadgeImpressao } from "./badge-impressao";

export const Cabecalho = ({
  titulo,
  subtitulo,
  voltarPara,
  acoes,
}: {
  titulo: string;
  subtitulo?: string;
  voltarPara?: string;
  acoes?: React.ReactNode;
}) => {
  const conexao = useConexao();
  const { resolvedTheme, setTheme } = useTheme();

  const sair = async () => {
    await api("/api/auth/logout", { method: "POST" }).catch(() => {});
    window.location.href = "/garcom/login";
  };

  return (
    <header className="sticky top-0 z-30 bg-marca pt-[env(safe-area-inset-top)] text-marca-foreground">
      <div className="flex h-16 items-center gap-1 px-2">
        {voltarPara ? (
          <Link
            href={voltarPara}
            aria-label="Voltar"
            className="flex size-12 items-center justify-center"
          >
            <ChevronLeft className="size-7" />
          </Link>
        ) : (
          <span className="w-2" />
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate font-bold text-xl leading-tight">{titulo}</p>
          {subtitulo && (
            <p className="truncate text-sm opacity-80">{subtitulo}</p>
          )}
        </div>
        <span
          role="status"
          aria-label={
            conexao === "online" ? "Conectado" : "Sem conexão em tempo real"
          }
          className={cn(
            "mx-1 size-3 rounded-full",
            conexao === "online"
              ? "bg-status-livre"
              : "animate-pulse bg-status-conta",
          )}
        />
        {acoes}
        <BadgeImpressao />
        <button
          type="button"
          aria-label="Alternar tema claro/escuro"
          onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
          className="flex size-12 items-center justify-center"
        >
          {resolvedTheme === "dark" ? <Sun /> : <Moon />}
        </button>
        {!voltarPara && (
          <button
            type="button"
            aria-label="Sair"
            onClick={sair}
            className="flex size-12 items-center justify-center"
          >
            <LogOut />
          </button>
        )}
      </div>
      {conexao === "offline" && (
        <p className="bg-status-conta px-4 py-1 text-center font-medium text-sm text-white">
          Sem conexão com o servidor. Tentando reconectar...
        </p>
      )}
    </header>
  );
};
