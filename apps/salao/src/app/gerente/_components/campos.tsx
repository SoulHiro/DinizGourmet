"use client";

import { MoreVertical, Search, X } from "lucide-react";
import { type KeyboardEvent, useRef, useState } from "react";

import { cn } from "@/lib/utils";

// Peças repetidas nas abas da gerência (cardápio, estoque, descontos).

// "R$ 39,90", "39.9", "39" -> centavos. Inválido -> NaN.
export const reaisParaCentavos = (valor: string) =>
  Math.round(
    Number.parseFloat(valor.replace(/[^\d,.]/g, "").replace(",", ".")) * 100,
  );

// Valor que vira campo de texto ao tocar: Enter (ou sair do campo) salva,
// Esc desiste. Substitui o window.prompt, que trava a tela.
export const CampoInline = ({
  rotulo,
  exibir,
  inicial,
  onSalvar,
  inputMode = "numeric",
  className,
}: {
  rotulo: string;
  exibir: React.ReactNode;
  inicial: string;
  onSalvar: (texto: string) => void;
  inputMode?: "numeric" | "decimal" | "text";
  className?: string;
}) => {
  const [editando, setEditando] = useState(false);
  const [texto, setTexto] = useState(inicial);
  const cancelado = useRef(false);

  if (!editando) {
    return (
      <button
        type="button"
        aria-label={`${rotulo}: ${inicial || "vazio"}. Tocar para editar`}
        onClick={() => {
          cancelado.current = false;
          setTexto(inicial);
          setEditando(true);
        }}
        className={cn("transition-colors hover:border-acao", className)}
      >
        {exibir}
      </button>
    );
  }

  const aoTeclar = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") e.currentTarget.blur();
    if (e.key === "Escape") {
      cancelado.current = true;
      e.currentTarget.blur();
    }
  };

  return (
    <input
      // biome-ignore lint/a11y/noAutofocus: o campo só aparece depois do toque no valor
      autoFocus
      aria-label={rotulo}
      value={texto}
      inputMode={inputMode}
      onChange={(e) => setTexto(e.target.value)}
      onFocus={(e) => e.target.select()}
      onKeyDown={aoTeclar}
      onBlur={() => {
        setEditando(false);
        if (!cancelado.current && texto.trim() !== inicial) {
          onSalvar(texto.trim());
        }
      }}
      className={cn(
        "min-w-0 text-center outline-none ring-2 ring-acao [field-sizing:content]",
        className,
      )}
    />
  );
};

// Liga/desliga do item (sem texto repetido em toda linha).
export const Interruptor = ({
  ligado,
  rotulo,
  onAlternar,
}: {
  ligado: boolean;
  rotulo: string;
  onAlternar: () => void;
}) => (
  <button
    type="button"
    role="switch"
    aria-checked={ligado}
    aria-label={rotulo}
    title={ligado ? "Disponível" : "Indisponível"}
    onClick={onAlternar}
    className="flex h-12 w-14 items-center justify-center"
  >
    <span
      className={cn(
        "flex h-7 w-12 items-center rounded-full p-0.5 transition-colors",
        ligado ? "bg-status-livre" : "bg-borda",
      )}
    >
      <span
        className={cn(
          "size-6 rounded-full bg-white shadow transition-transform",
          ligado && "translate-x-5",
        )}
      />
    </span>
  </button>
);

// Busca fixa no topo da aba, logo abaixo do cabeçalho.
export const BarraBusca = ({
  valor,
  onMudar,
  placeholder,
  children,
}: {
  valor: string;
  onMudar: (v: string) => void;
  placeholder: string;
  children?: React.ReactNode;
}) => (
  <div className="sticky top-[calc(4rem+env(safe-area-inset-top))] z-20 -mx-3 flex gap-2 bg-fundo/95 px-3 py-2 backdrop-blur">
    <label className="relative min-w-0 flex-1">
      <Search className="-translate-y-1/2 absolute top-1/2 left-3 size-5 text-texto-secundario" />
      <input
        type="search"
        value={valor}
        onChange={(e) => onMudar(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="h-12 w-full rounded-lg border border-borda bg-surface pr-10 pl-10"
      />
      {valor && (
        <button
          type="button"
          aria-label="Limpar busca"
          onClick={() => onMudar("")}
          className="-translate-y-1/2 absolute top-1/2 right-1 flex size-10 items-center justify-center"
        >
          <X className="size-5" />
        </button>
      )}
    </label>
    {children}
  </div>
);

export type AcaoMenu = {
  rotulo: string;
  Icone: React.ComponentType<{ className?: string }>;
  onClick: () => void;
  perigo?: boolean;
  desabilitado?: boolean;
};

// Menu "⋮" com as ações menos usadas (fecha ao escolher, sair ou Esc).
export const MenuAcoes = ({
  rotulo,
  acoes,
}: {
  rotulo: string;
  acoes: AcaoMenu[];
}) => {
  const [aberto, setAberto] = useState(false);
  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: fecha o menu ao sair do grupo (foco) ou com Esc
    <div
      className="relative"
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setAberto(false);
      }}
      onKeyDown={(e) => e.key === "Escape" && setAberto(false)}
    >
      <button
        type="button"
        aria-label={rotulo}
        aria-haspopup="menu"
        aria-expanded={aberto}
        onClick={() => setAberto((v) => !v)}
        className="flex size-12 items-center justify-center rounded-lg hover:bg-borda/40"
      >
        <MoreVertical className="size-5" />
      </button>
      {aberto && (
        <div
          role="menu"
          className="absolute top-full right-0 z-30 mt-1 w-56 overflow-hidden rounded-xl border border-borda bg-surface shadow-xl"
        >
          {acoes.map((a) => (
            <button
              key={a.rotulo}
              type="button"
              role="menuitem"
              disabled={a.desabilitado}
              onClick={() => {
                setAberto(false);
                a.onClick();
              }}
              className={cn(
                "flex h-12 w-full items-center gap-3 px-4 text-left text-sm hover:bg-borda/40 disabled:opacity-40",
                a.perigo && "text-destructive",
              )}
            >
              <a.Icone className="size-4" />
              {a.rotulo}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
