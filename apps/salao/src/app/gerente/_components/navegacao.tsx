"use client";

import {
  BadgePercent,
  BookOpen,
  ChartColumnBig,
  ChevronDown,
  CircleUserRound,
  IdCard,
  LayoutGrid,
  LogOut,
  Menu,
  Moon,
  MoonStar,
  Package,
  Printer,
  Sofa,
  Sun,
  Users,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import { useTheme } from "next-themes";
import { useState } from "react";

import { sairDoSistema } from "@/components/salao/cabecalho";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { cn } from "@/lib/utils";

export const ABAS = [
  { valor: "noite", rotulo: "Noite", Icone: MoonStar, principal: true },
  { valor: "estoque", rotulo: "Estoque", Icone: Package, principal: true },
  { valor: "cardapio", rotulo: "Cardápio", Icone: BookOpen, principal: true },
  { valor: "produtos", rotulo: "Produtos", Icone: ChartColumnBig },
  { valor: "descontos", rotulo: "Descontos", Icone: BadgePercent },
  { valor: "mesas", rotulo: "Mesas", Icone: Sofa },
  { valor: "cartoes", rotulo: "Cartões", Icone: IdCard },
  { valor: "equipe", rotulo: "Equipe", Icone: Users },
  { valor: "impressoras", rotulo: "Impressoras", Icone: Printer },
] as const;

export type Aba = (typeof ABAS)[number]["valor"];

const useAlternarTema = () => {
  const { resolvedTheme, setTheme } = useTheme();
  return () => setTheme(resolvedTheme === "dark" ? "light" : "dark");
};

// Computador: todas as seções numa faixa de abas abaixo do cabeçalho.
export const AbasTopo = ({
  aba,
  onAba,
}: {
  aba: Aba;
  onAba: (aba: Aba) => void;
}) => (
  <nav
    aria-label="Seções da gerência"
    className="hidden border-borda border-b bg-surface md:block"
  >
    <div className="mx-auto flex max-w-6xl gap-1 px-2">
      {ABAS.map(({ valor, rotulo, Icone }) => (
        <button
          key={valor}
          type="button"
          aria-current={aba === valor ? "page" : undefined}
          onClick={() => onAba(valor)}
          className={cn(
            "flex h-12 items-center gap-2 border-b-[3px] px-3 font-semibold text-sm transition-colors",
            aba === valor
              ? "border-acao text-texto"
              : "border-transparent text-texto-secundario hover:text-texto",
          )}
        >
          <Icone className="size-4" />
          {rotulo}
        </button>
      ))}
    </div>
  </nav>
);

// Computador: atalhos para o salão e o caixa + menu da conta (tema, sair).
export const AtalhosTopo = ({ nome }: { nome: string }) => {
  const [aberto, setAberto] = useState(false);
  const alternarTema = useAlternarTema();

  return (
    <div className="hidden items-center gap-1 md:flex">
      <Link
        href="/garcom"
        className="flex h-10 items-center gap-2 rounded-lg px-3 font-semibold text-sm hover:bg-black/10"
      >
        <LayoutGrid className="size-4" /> Salão
      </Link>
      <Link
        href="/caixa"
        className="flex h-10 items-center gap-2 rounded-lg px-3 font-semibold text-sm hover:bg-black/10"
      >
        <Wallet className="size-4" /> Caixa
      </Link>
      {/* biome-ignore lint/a11y/noStaticElementInteractions: fecha o menu ao sair do grupo (foco) ou com Esc */}
      <div
        className="relative"
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget)) setAberto(false);
        }}
        onKeyDown={(e) => e.key === "Escape" && setAberto(false)}
      >
        <button
          type="button"
          aria-haspopup="menu"
          aria-expanded={aberto}
          onClick={() => setAberto((v) => !v)}
          className="flex h-10 items-center gap-1 rounded-lg px-2 hover:bg-black/10"
        >
          <CircleUserRound />
          <ChevronDown className="size-4" />
        </button>
        {aberto && (
          <div
            role="menu"
            className="absolute top-full right-0 z-40 mt-1 w-56 overflow-hidden rounded-xl border border-borda bg-surface text-texto shadow-xl"
          >
            <p className="border-borda border-b px-4 py-3 font-semibold">
              {nome}
            </p>
            <button
              type="button"
              role="menuitem"
              onClick={alternarTema}
              className="flex h-12 w-full items-center gap-3 px-4 text-left hover:bg-borda/40"
            >
              <Sun className="hidden size-5 dark:block" />
              <Moon className="size-5 dark:hidden" />
              <span className="dark:hidden">Tema escuro</span>
              <span className="hidden dark:inline">Tema claro</span>
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={sairDoSistema}
              className="flex h-12 w-full items-center gap-3 px-4 text-left text-destructive hover:bg-borda/40"
            >
              <LogOut className="size-5" /> Sair
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

// Celular: barra embaixo com o que se usa durante o serviço; cadastros,
// caixa, tema e sair ficam em "Mais".
export const NavegacaoInferior = ({
  aba,
  onAba,
  nome,
}: {
  aba: Aba;
  onAba: (aba: Aba) => void;
  nome: string;
}) => {
  const [mais, setMais] = useState(false);
  const alternarTema = useAlternarTema();
  const principais = ABAS.filter((a) => "principal" in a);
  const secundarias = ABAS.filter((a) => !("principal" in a));
  const emMais = secundarias.some((a) => a.valor === aba);

  const item =
    "flex flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-semibold";

  return (
    <>
      <nav
        aria-label="Seções da gerência"
        className="fixed inset-x-0 bottom-0 z-30 flex border-borda border-t bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
      >
        {principais.map(({ valor, rotulo, Icone }) => (
          <button
            key={valor}
            type="button"
            aria-current={aba === valor ? "page" : undefined}
            onClick={() => onAba(valor)}
            className={cn(
              item,
              "h-16",
              aba === valor ? "text-acao" : "text-texto-secundario",
            )}
          >
            <Icone className="size-6" />
            {rotulo}
          </button>
        ))}
        <Link href="/garcom" className={cn(item, "h-16 text-texto-secundario")}>
          <LayoutGrid className="size-6" />
          Salão
        </Link>
        <button
          type="button"
          onClick={() => setMais(true)}
          aria-expanded={mais}
          className={cn(
            item,
            "h-16",
            emMais ? "text-acao" : "text-texto-secundario",
          )}
        >
          <Menu className="size-6" />
          Mais
        </button>
      </nav>

      <Drawer open={mais} onOpenChange={setMais}>
        <DrawerContent>
          <DrawerHeader className="text-left">
            <DrawerTitle>{nome}</DrawerTitle>
          </DrawerHeader>
          <div className="flex flex-col gap-4 px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
            <div className="grid grid-cols-3 gap-2">
              {secundarias.map(({ valor, rotulo, Icone }) => (
                <button
                  key={valor}
                  type="button"
                  onClick={() => {
                    onAba(valor);
                    setMais(false);
                  }}
                  className={cn(
                    "flex h-20 flex-col items-center justify-center gap-1.5 rounded-xl border font-semibold text-sm",
                    aba === valor
                      ? "border-acao bg-acao/10"
                      : "border-borda bg-fundo",
                  )}
                >
                  <Icone className="size-6" />
                  {rotulo}
                </button>
              ))}
              <Link
                href="/caixa"
                className="flex h-20 flex-col items-center justify-center gap-1.5 rounded-xl border border-borda bg-fundo font-semibold text-sm"
              >
                <Wallet className="size-6" />
                Caixa
              </Link>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={alternarTema}
                className="flex h-12 flex-1 items-center justify-center gap-2 rounded-xl border border-borda font-semibold"
              >
                <Sun className="hidden size-5 dark:block" />
                <Moon className="size-5 dark:hidden" />
                <span className="dark:hidden">Tema escuro</span>
                <span className="hidden dark:inline">Tema claro</span>
              </button>
              <button
                type="button"
                onClick={sairDoSistema}
                className="flex h-12 flex-1 items-center justify-center gap-2 rounded-xl border border-borda font-semibold text-destructive"
              >
                <LogOut className="size-5" /> Sair
              </button>
            </div>
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
};
