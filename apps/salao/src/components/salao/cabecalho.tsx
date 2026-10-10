"use client";

import { ChevronLeft, LogOut, Moon, Settings, Sun, Wallet } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";

import { useFuncionario } from "@/components/providers/sessao";
import { useConexao } from "@/components/providers/tempo-real";
import { api } from "@/lib/cliente";
import { BadgeImpressao } from "./badge-impressao";

export const sairDoSistema = async () => {
  await api("/api/auth/logout", { method: "POST" }).catch(() => {});
  window.location.href = "/garcom/login";
};

export const Cabecalho = ({
  titulo,
  subtitulo,
  voltarPara,
  acoes,
  menu,
}: {
  titulo: string;
  subtitulo?: string;
  voltarPara?: string;
  acoes?: React.ReactNode;
  // Substitui os botões de tema e sair (a gerência leva os dois para um menu).
  menu?: React.ReactNode;
}) => {
  const conexao = useConexao();
  // Impressão é automática; só o gerente acompanha a fila e reenvia falhas.
  const { papel } = useFuncionario();
  const podeVerImpressao = papel === "gerente";
  // Nas telas do garçom, gerente e caixa têm um atalho de volta ao painel deles.
  const noGarcom = usePathname().startsWith("/garcom");
  const painel =
    noGarcom && papel === "gerente"
      ? { href: "/gerente", rotulo: "Voltar para a gerência", Icone: Settings }
      : noGarcom && papel === "caixa"
        ? { href: "/caixa", rotulo: "Voltar para o caixa", Icone: Wallet }
        : null;
  const { resolvedTheme, setTheme } = useTheme();

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
        {/* Conectado é o normal: só aparece algo quando cai. */}
        {conexao !== "online" && (
          <span
            role="status"
            aria-label="Sem conexão em tempo real"
            className="mx-1 size-3 animate-pulse rounded-full bg-status-conta"
          />
        )}
        {acoes}
        {painel && (
          <Link
            href={painel.href}
            aria-label={painel.rotulo}
            title={painel.rotulo}
            className="flex size-12 items-center justify-center"
          >
            <painel.Icone />
          </Link>
        )}
        {podeVerImpressao && <BadgeImpressao />}
        {menu ?? (
          <>
            <button
              type="button"
              aria-label="Alternar tema claro/escuro"
              onClick={() =>
                setTheme(resolvedTheme === "dark" ? "light" : "dark")
              }
              className="flex size-12 items-center justify-center"
            >
              {/* Pelo CSS, não pelo tema: no servidor o tema ainda não é conhecido
              e escolher o ícone em JS quebrava a hidratação. */}
              <Sun className="hidden dark:block" />
              <Moon className="dark:hidden" />
            </button>
            {!voltarPara && (
              <button
                type="button"
                aria-label="Sair"
                onClick={sairDoSistema}
                className="flex size-12 items-center justify-center"
              >
                <LogOut />
              </button>
            )}
          </>
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
