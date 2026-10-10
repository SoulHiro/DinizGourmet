"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ChefHat,
  CircleMinus,
  CirclePlus,
  Link2,
  Loader2,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { api } from "@/lib/cliente";
import type { OpcaoGerencia } from "@/lib/dominio/cardapio-gestao";
import { cn, formatBRL } from "@/lib/utils";
import { CampoInline, Interruptor, reaisParaCentavos } from "./campos";

type Tipo = OpcaoGerencia["tipo"];
type CategoriaComItens = {
  id: string;
  nome: string;
  produtos: { id: string; nome: string; codigo: number | null }[];
};

const CHAVE = ["gerente", "opcoes"];

const TIPOS: Record<
  Tipo,
  {
    titulo: string;
    curto: string;
    Icone: typeof Plus;
    cor: string;
    exemplo: string;
  }
> = {
  remocao: {
    titulo: "Tirar do item",
    curto: "Tirar",
    Icone: CircleMinus,
    cor: "bg-destructive/15 text-destructive",
    exemplo: "Sem cebola",
  },
  preparo: {
    titulo: "Ponto e preparo",
    curto: "Preparo",
    Icone: ChefHat,
    cor: "bg-status-ocupada/15 text-status-ocupada",
    exemplo: "Bem passado",
  },
  adicional: {
    titulo: "Adicionais pagos",
    curto: "Adicional",
    Icone: CirclePlus,
    cor: "bg-status-livre/15 text-status-livre",
    exemplo: "Cheddar extra",
  },
};

// Os chips que o garçom marca no pedido. Cada um aparece só nos itens
// escolhidos aqui; adicional soma o preço no item.
export const GerenciaOpcoes = ({
  categorias,
}: {
  categorias: CategoriaComItens[];
}) => {
  const queryClient = useQueryClient();
  const { data: opcoes, isLoading } = useQuery({
    queryKey: CHAVE,
    queryFn: () => api<OpcaoGerencia[]>("/api/gerente/opcoes"),
  });
  const [aberta, setAberta] = useState<string | null>(null);
  const [nova, setNova] = useState<{
    nome: string;
    tipo: Tipo;
    preco: string;
  } | null>(null);

  const depois = () => {
    queryClient.invalidateQueries({ queryKey: CHAVE });
    queryClient.invalidateQueries({ queryKey: ["gerente", "produtos"] });
    queryClient.invalidateQueries({ queryKey: ["cardapio"] });
  };

  const editar = useMutation({
    mutationFn: ({ id, ...json }: Partial<OpcaoGerencia> & { id: string }) =>
      api(`/api/gerente/opcoes/${id}`, { method: "PATCH", json }),
    onMutate: async ({ id, ...dados }) => {
      await queryClient.cancelQueries({ queryKey: CHAVE });
      const anterior = queryClient.getQueryData<OpcaoGerencia[]>(CHAVE);
      queryClient.setQueryData<OpcaoGerencia[]>(CHAVE, (atual) =>
        atual?.map((o) => (o.id === id ? { ...o, ...dados } : o)),
      );
      return { anterior };
    },
    onError: (e, _v, contexto) => {
      queryClient.setQueryData(CHAVE, contexto?.anterior);
      toast.error(e.message);
    },
    onSettled: depois,
  });

  const excluir = useMutation({
    mutationFn: (id: string) =>
      api(`/api/gerente/opcoes/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      setAberta(null);
      toast.success("Opção excluída");
      depois();
    },
    onError: (e) => toast.error(e.message),
  });

  const criar = useMutation({
    mutationFn: () => {
      if (!nova || nova.nome.trim().length < 2)
        throw new Error("Dê um nome à opção");
      const precoCentavos =
        nova.tipo === "adicional" ? reaisParaCentavos(nova.preco || "0") : 0;
      if (!Number.isFinite(precoCentavos)) throw new Error("Preço inválido");
      return api<{ id: string }>("/api/gerente/opcoes", {
        method: "POST",
        json: { nome: nova.nome.trim(), tipo: nova.tipo, precoCentavos },
      });
    },
    onSuccess: ({ id }) => {
      setNova(null);
      setAberta(id);
      toast.success("Opção criada. Agora escolha em quais itens ela aparece.");
      depois();
    },
    onError: (e) => toast.error(e.message),
  });

  if (isLoading || !opcoes) {
    return (
      <Loader2 className="mx-auto mt-6 size-8 animate-spin text-texto-secundario" />
    );
  }

  const totalItens = categorias.reduce((s, c) => s + c.produtos.length, 0);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid items-start gap-4 lg:grid-cols-3">
        {(Object.keys(TIPOS) as Tipo[]).map((tipo) => {
          const t = TIPOS[tipo];
          const doTipo = opcoes.filter((o) => o.tipo === tipo);
          return (
            <section
              key={tipo}
              className="overflow-hidden rounded-xl border border-borda bg-surface"
            >
              <header className="flex items-center gap-2 border-borda border-b px-3 py-3">
                <span
                  className={cn(
                    "flex size-8 items-center justify-center rounded-lg",
                    t.cor,
                  )}
                >
                  <t.Icone className="size-4" />
                </span>
                <h2 className="flex-1 font-bold">{t.titulo}</h2>
                <span className="text-sm text-texto-secundario">
                  {doTipo.length}
                </span>
              </header>
              <ul>
                {doTipo.map((o) => (
                  <li
                    key={o.id}
                    className="border-borda border-b last:border-0"
                  >
                    <div
                      className={cn(
                        "flex items-center gap-1 py-1.5 pr-1 pl-3",
                        !o.ativo && "opacity-60",
                      )}
                    >
                      <div className="min-w-0 flex-1">
                        <CampoInline
                          rotulo={`Nome de ${o.nome}`}
                          inicial={o.nome}
                          exibir={o.nome}
                          inputMode="text"
                          onSalvar={(nome) => {
                            if (nome.length >= 2)
                              editar.mutate({ id: o.id, nome });
                          }}
                          className="block h-8 max-w-full truncate rounded-md border border-transparent px-1 text-left font-semibold"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setAberta((a) => (a === o.id ? null : o.id))
                          }
                          className={cn(
                            "flex items-center gap-1 px-1 text-xs",
                            o.produtoIds.length
                              ? "text-texto-secundario"
                              : "font-semibold text-status-aguardando",
                          )}
                        >
                          <Link2 className="size-3" />
                          {o.produtoIds.length === 0
                            ? "Não aparece em nenhum item"
                            : o.produtoIds.length === totalItens
                              ? "Em todos os itens"
                              : `Em ${o.produtoIds.length} ${o.produtoIds.length === 1 ? "item" : "itens"}`}
                        </button>
                      </div>
                      {tipo === "adicional" && (
                        <CampoInline
                          rotulo={`Preço de ${o.nome}`}
                          inicial={(o.precoCentavos / 100)
                            .toFixed(2)
                            .replace(".", ",")}
                          exibir={`+ ${formatBRL(o.precoCentavos)}`}
                          inputMode="decimal"
                          onSalvar={(texto) => {
                            const precoCentavos = reaisParaCentavos(texto);
                            if (Number.isFinite(precoCentavos))
                              editar.mutate({ id: o.id, precoCentavos });
                          }}
                          className="h-8 shrink-0 rounded-md border border-transparent bg-status-livre/15 px-2 font-bold text-sm tabular-nums"
                        />
                      )}
                      <Interruptor
                        ligado={o.ativo}
                        rotulo={`${o.nome} ativa`}
                        onAlternar={() =>
                          editar.mutate({ id: o.id, ativo: !o.ativo })
                        }
                      />
                    </div>
                    {aberta === o.id && (
                      <PainelItens
                        opcao={o}
                        categorias={categorias}
                        salvando={editar.isPending}
                        onSalvar={(produtoIds) => {
                          editar.mutate({ id: o.id, produtoIds });
                          setAberta(null);
                        }}
                        onTipo={(novoTipo) =>
                          editar.mutate({ id: o.id, tipo: novoTipo })
                        }
                        onExcluir={() => excluir.mutate(o.id)}
                      />
                    )}
                  </li>
                ))}
                {doTipo.length === 0 && (
                  <li className="px-3 py-4 text-center text-sm text-texto-secundario">
                    Nenhuma ainda (ex.: {t.exemplo})
                  </li>
                )}
              </ul>
              <button
                type="button"
                onClick={() => setNova({ nome: "", tipo, preco: "" })}
                className="flex h-12 w-full items-center gap-2 border-borda border-t px-4 font-semibold text-sm text-texto-secundario hover:bg-borda/30 hover:text-texto"
              >
                <Plus className="size-5" /> Nova opção
              </button>
            </section>
          );
        })}
      </div>

      {nova && (
        <form
          className="flex flex-wrap items-center gap-2 rounded-xl border-2 border-acao bg-surface p-3"
          onSubmit={(e) => {
            e.preventDefault();
            criar.mutate();
          }}
        >
          <span
            className={cn(
              "flex size-10 items-center justify-center rounded-lg",
              TIPOS[nova.tipo].cor,
            )}
          >
            {(() => {
              const Icone = TIPOS[nova.tipo].Icone;
              return <Icone className="size-5" />;
            })()}
          </span>
          <input
            // biome-ignore lint/a11y/noAutofocus: aparece depois do toque em "Nova opção"
            autoFocus
            aria-label="Nome da opção"
            placeholder={`Nome (ex.: ${TIPOS[nova.tipo].exemplo})`}
            value={nova.nome}
            onChange={(e) => setNova({ ...nova, nome: e.target.value })}
            onKeyDown={(e) => e.key === "Escape" && setNova(null)}
            className="h-12 min-w-40 flex-1 rounded-lg bg-fundo px-3"
          />
          <fieldset className="flex rounded-lg border border-borda bg-fundo p-1">
            <legend className="sr-only">Tipo da opção</legend>
            {(Object.keys(TIPOS) as Tipo[]).map((tipo) => (
              <button
                key={tipo}
                type="button"
                aria-pressed={nova.tipo === tipo}
                onClick={() => setNova({ ...nova, tipo })}
                className={cn(
                  "h-10 rounded-md px-3 font-semibold text-sm",
                  nova.tipo === tipo
                    ? "bg-acao text-acao-foreground"
                    : "text-texto-secundario",
                )}
              >
                {TIPOS[tipo].curto}
              </button>
            ))}
          </fieldset>
          {nova.tipo === "adicional" && (
            <input
              aria-label="Preço do adicional"
              inputMode="decimal"
              placeholder="R$ 0,00"
              value={nova.preco}
              onChange={(e) => setNova({ ...nova, preco: e.target.value })}
              className="h-12 w-28 rounded-lg bg-fundo px-3 text-right font-bold tabular-nums"
            />
          )}
          <Button type="submit" variant="acao" disabled={criar.isPending}>
            {criar.isPending ? <Loader2 className="animate-spin" /> : <Plus />}
            Criar
          </Button>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            aria-label="Cancelar"
            onClick={() => setNova(null)}
          >
            <X />
          </Button>
        </form>
      )}
    </div>
  );
};

// Em quais itens a opção aparece, com atalho "categoria inteira".
const PainelItens = ({
  opcao,
  categorias,
  salvando,
  onSalvar,
  onTipo,
  onExcluir,
}: {
  opcao: OpcaoGerencia;
  categorias: CategoriaComItens[];
  salvando: boolean;
  onSalvar: (produtoIds: string[]) => void;
  onTipo: (tipo: Tipo) => void;
  onExcluir: () => void;
}) => {
  const [marcados, setMarcados] = useState(new Set(opcao.produtoIds));
  const [confirmando, setConfirmando] = useState(false);

  const alternar = (ids: string[], ligar: boolean) =>
    setMarcados((atual) => {
      const novo = new Set(atual);
      for (const id of ids) {
        if (ligar) novo.add(id);
        else novo.delete(id);
      }
      return novo;
    });

  return (
    <div className="flex flex-col gap-3 border-borda border-t bg-fundo/50 p-3">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-texto-secundario">Tipo:</span>
        {(Object.keys(TIPOS) as Tipo[]).map((tipo) => (
          <button
            key={tipo}
            type="button"
            aria-pressed={opcao.tipo === tipo}
            onClick={() => opcao.tipo !== tipo && onTipo(tipo)}
            className={cn(
              "h-8 rounded-full border px-3 font-semibold",
              opcao.tipo === tipo
                ? "border-acao bg-acao/15"
                : "border-borda text-texto-secundario",
            )}
          >
            {TIPOS[tipo].curto}
          </button>
        ))}
      </div>

      <p className="font-semibold text-sm">Aparece nestes itens</p>
      <div className="flex max-h-80 flex-col gap-3 overflow-y-auto">
        {categorias.map((c) => {
          const ids = c.produtos.map((p) => p.id);
          const todos = ids.length > 0 && ids.every((id) => marcados.has(id));
          return (
            <div key={c.id} className="flex flex-col gap-1">
              <label className="flex min-h-10 items-center gap-2 font-semibold text-sm">
                <input
                  type="checkbox"
                  className="size-5 accent-[var(--brand-accent)]"
                  checked={todos}
                  onChange={(e) => alternar(ids, e.target.checked)}
                />
                {c.nome} (todos)
              </label>
              <div className="flex flex-wrap gap-1.5 pl-7">
                {c.produtos.map((p) => {
                  const ligado = marcados.has(p.id);
                  return (
                    <button
                      key={p.id}
                      type="button"
                      aria-pressed={ligado}
                      onClick={() => alternar([p.id], !ligado)}
                      className={cn(
                        "h-9 rounded-full border px-3 text-sm",
                        ligado
                          ? "border-acao bg-acao/15 font-semibold"
                          : "border-borda text-texto-secundario",
                      )}
                    >
                      {p.nome}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex gap-2">
        <Button
          variant="acao"
          className="flex-1"
          disabled={salvando}
          onClick={() => onSalvar([...marcados])}
        >
          Salvar ({marcados.size} {marcados.size === 1 ? "item" : "itens"})
        </Button>
        <Button
          variant={confirmando ? "destrutivo" : "ghost"}
          aria-label="Excluir opção"
          onClick={() => (confirmando ? onExcluir() : setConfirmando(true))}
        >
          <Trash2 />
          {confirmando && "Confirmar"}
        </Button>
      </div>
      {opcao.usos > 0 && (
        <p className="text-texto-secundario text-xs">
          Já usada em {opcao.usos} {opcao.usos === 1 ? "pedido" : "pedidos"}:
          para tirar de vez, desative em vez de excluir.
        </p>
      )}
    </div>
  );
};
