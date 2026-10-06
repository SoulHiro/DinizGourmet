"use client";

import {
  ArrowDownIcon,
  ArrowUpIcon,
  EyeIcon,
  EyeOffIcon,
  Loader2Icon,
  PlusIcon,
  RotateCcwIcon,
  Trash2Icon,
} from "lucide-react";
import { useEffect, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import { EventoShell } from "@/components/evento-shell";
import { IconeBio } from "@/components/icone-bio";
import { PaginaBio, type ProximoEventoBio } from "@/components/pagina-bio";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  type BioLink,
  bioLinkSchema,
  ICONES,
  ICONES_LINK,
  type IconeLink,
} from "@/lib/bio-links";
import { cn } from "@/lib/utils";

import { salvarLinks } from "../actions";

type LinhaEditor = BioLink & { chave: string };

const ATALHOS = [
  { label: "Agenda", url: "/eventos" },
  { label: "Cardápio", url: "/cardapio" },
];

const novaChave = () => Math.random().toString(36).slice(2, 10);

const comChave = (links: BioLink[]): LinhaEditor[] =>
  links.map((l) => ({ ...l, chave: l.id ?? novaChave() }));

const semChave = (linhas: LinhaEditor[]): BioLink[] =>
  linhas.map(({ chave: _chave, ...l }) => l);

const erroDaLinha = (linha: LinhaEditor) => {
  const r = bioLinkSchema.safeParse(linha);
  if (r.success) return null;
  const erros: Partial<Record<"label" | "url", string>> = {};
  for (const issue of r.error.issues) {
    const campo = issue.path[0];
    if ((campo === "label" || campo === "url") && !erros[campo]) {
      erros[campo] = issue.message;
    }
  }
  return erros;
};

export const EditorLinks = ({
  iniciais,
  proximoEvento,
}: {
  iniciais: BioLink[];
  proximoEvento: ProximoEventoBio | null;
}) => {
  const [salvos, setSalvos] = useState(iniciais);
  const [linhas, setLinhas] = useState(() => comChave(iniciais));
  const [aba, setAba] = useState<"editar" | "preview">("editar");
  const [tentouSalvar, setTentouSalvar] = useState(false);
  const [salvando, startTransition] = useTransition();

  const alterado = useMemo(
    () => JSON.stringify(semChave(linhas)) !== JSON.stringify(salvos),
    [linhas, salvos],
  );
  const erros = linhas.map(erroDaLinha);
  const temErro = erros.some(Boolean);

  // Avisa antes de sair da página com alteração não salva.
  useEffect(() => {
    if (!alterado) return;
    const aviso = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", aviso);
    return () => window.removeEventListener("beforeunload", aviso);
  }, [alterado]);

  const alterar = (chave: string, campos: Partial<BioLink>) =>
    setLinhas((atual) =>
      atual.map((l) => (l.chave === chave ? { ...l, ...campos } : l)),
    );

  const mover = (indice: number, delta: number) =>
    setLinhas((atual) => {
      const destino = indice + delta;
      if (destino < 0 || destino >= atual.length) return atual;
      const copia = [...atual];
      [copia[indice], copia[destino]] = [copia[destino], copia[indice]];
      return copia;
    });

  const remover = (chave: string) =>
    setLinhas((atual) => atual.filter((l) => l.chave !== chave));

  const adicionar = () =>
    setLinhas((atual) => [
      ...atual,
      {
        chave: novaChave(),
        label: "",
        url: "https://",
        icon: "link",
        isVisible: true,
      },
    ]);

  const salvar = () => {
    setTentouSalvar(true);
    if (temErro) {
      toast.error("Confira os botões marcados em vermelho.");
      setAba("editar");
      return;
    }
    startTransition(async () => {
      try {
        const lista = semChave(linhas);
        await salvarLinks(lista);
        setSalvos(lista);
        setTentouSalvar(false);
        toast.success("Links salvos. A página inicial já está atualizada.");
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Não foi possível salvar.",
        );
      }
    });
  };

  // O preview mostra só o que está pronto para ir ao ar.
  const visiveis = linhas.filter(
    (l, i) => l.isVisible && !erros[i] && l.label.trim(),
  );

  return (
    <div className="flex flex-col gap-4 pb-24">
      <div className="grid grid-cols-2 rounded-lg bg-muted p-1 lg:hidden">
        {(["editar", "preview"] as const).map((a) => (
          <button
            key={a}
            type="button"
            onClick={() => setAba(a)}
            className={cn(
              "rounded-md py-1.5 text-sm font-medium",
              aba === a ? "bg-background shadow-sm" : "text-muted-foreground",
            )}
          >
            {a === "editar" ? "Editar" : "Preview"}
          </button>
        ))}
      </div>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
        <div
          className={cn(
            "flex flex-col gap-3",
            aba === "preview" && "hidden lg:flex",
          )}
        >
          {linhas.length === 0 && (
            <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              Nenhum botão. Adicione o primeiro abaixo.
            </p>
          )}

          {linhas.map((linha, indice) => {
            const erro = tentouSalvar || linha.label ? erros[indice] : null;
            return (
              <div
                key={linha.chave}
                className={cn(
                  "flex flex-col gap-3 rounded-lg border bg-card p-3 sm:p-4",
                  !linha.isVisible && "opacity-60",
                  erro && tentouSalvar && "border-destructive",
                )}
              >
                <div className="flex items-center gap-2">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted">
                    <IconeBio icone={linha.icon} className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">
                    {indice + 1}. {linha.label || "Novo botão"}
                    {!linha.isVisible && (
                      <span className="text-muted-foreground"> (oculto)</span>
                    )}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => mover(indice, -1)}
                    disabled={indice === 0}
                    aria-label="Subir"
                  >
                    <ArrowUpIcon />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => mover(indice, 1)}
                    disabled={indice === linhas.length - 1}
                    aria-label="Descer"
                  >
                    <ArrowDownIcon />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() =>
                      alterar(linha.chave, { isVisible: !linha.isVisible })
                    }
                    aria-label={linha.isVisible ? "Ocultar" : "Mostrar"}
                    title={linha.isVisible ? "Ocultar" : "Mostrar"}
                  >
                    {linha.isVisible ? <EyeIcon /> : <EyeOffIcon />}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => remover(linha.chave)}
                    aria-label="Remover"
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2Icon />
                  </Button>
                </div>

                <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_10rem]">
                  <div className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
                    Texto do botão
                    <Input
                      aria-label="Texto do botão"
                      value={linha.label}
                      maxLength={40}
                      placeholder="Ex.: Reservar mesa"
                      onChange={(e) =>
                        alterar(linha.chave, { label: e.target.value })
                      }
                      aria-invalid={Boolean(erro?.label)}
                    />
                    {erro?.label && (
                      <span className="text-destructive">{erro.label}</span>
                    )}
                  </div>
                  <div className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
                    Link
                    <Input
                      aria-label="Link"
                      value={linha.url}
                      placeholder="https://..."
                      inputMode="url"
                      onChange={(e) =>
                        alterar(linha.chave, { url: e.target.value })
                      }
                      aria-invalid={Boolean(erro?.url)}
                    />
                    {erro?.url ? (
                      <span className="text-destructive">{erro.url}</span>
                    ) : (
                      <span className="flex flex-wrap gap-1.5 font-normal">
                        Páginas do site:
                        {ATALHOS.map((a) => (
                          <button
                            key={a.url}
                            type="button"
                            onClick={() => alterar(linha.chave, { url: a.url })}
                            className="underline underline-offset-2 hover:text-foreground"
                          >
                            {a.label}
                          </button>
                        ))}
                      </span>
                    )}
                  </div>
                  <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
                    Ícone
                    <select
                      value={linha.icon}
                      onChange={(e) =>
                        alterar(linha.chave, {
                          icon: e.target.value as IconeLink,
                        })
                      }
                      className="h-9 rounded-md border border-input bg-transparent px-2 text-sm text-foreground shadow-xs"
                    >
                      {ICONES.map((icone) => (
                        <option key={icone} value={icone}>
                          {ICONES_LINK[icone]}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </div>
            );
          })}

          <Button
            type="button"
            variant="outline"
            onClick={adicionar}
            disabled={linhas.length >= 20}
            className="self-start"
          >
            <PlusIcon />
            Adicionar botão
          </Button>
        </div>

        <div
          className={cn(
            "flex flex-col items-center gap-3 lg:sticky lg:top-5",
            aba === "editar" && "hidden lg:flex",
          )}
        >
          {/* "Celular" do preview. O transform faz o fundo fixo (grão e luz)
              da página pública ficar preso dentro da moldura. */}
          <div className="h-[640px] w-[340px] max-w-full overflow-hidden rounded-[2.25rem] border-[10px] border-neutral-900 bg-black shadow-xl [transform:translateZ(0)]">
            <div className="h-full overflow-y-auto [scrollbar-width:none]">
              <EventoShell className="min-h-full">
                <PaginaBio
                  links={visiveis}
                  proximoEvento={proximoEvento}
                  preview
                />
              </EventoShell>
            </div>
          </div>
          <p className="text-center text-xs text-muted-foreground">
            Preview ao vivo. O próximo evento entra sozinho, pela agenda.
          </p>
        </div>
      </div>

      {/* Barra de salvar: fixa no celular, normal no computador. */}
      <div className="fixed inset-x-0 bottom-0 z-10 flex items-center justify-between gap-3 border-t bg-background/95 p-3 backdrop-blur sm:px-5">
        <span className="text-sm text-muted-foreground">
          {alterado ? "Alterações não salvas" : "Tudo salvo"}
        </span>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setLinhas(comChave(salvos));
              setTentouSalvar(false);
            }}
            disabled={!alterado || salvando}
          >
            <RotateCcwIcon />
            Descartar
          </Button>
          <Button
            type="button"
            onClick={salvar}
            disabled={!alterado || salvando}
          >
            {salvando && <Loader2Icon className="animate-spin" />}
            Salvar alterações
          </Button>
        </div>
      </div>
    </div>
  );
};
