"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  BookOpen,
  Camera,
  Check,
  Eye,
  FolderPlus,
  Loader2,
  Pencil,
  Plus,
  Printer,
  SlidersHorizontal,
  Star,
  Trash2,
  X,
} from "lucide-react";
import Link from "next/link";
import { type KeyboardEvent, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { api } from "@/lib/cliente";
import { normalizarBusca } from "@/lib/texto";
import { cn, formatBRL } from "@/lib/utils";
import {
  BarraBusca,
  CampoInline,
  Interruptor,
  MenuAcoes,
  reaisParaCentavos,
} from "./campos";
import { DetalhesProduto } from "./detalhes-produto";
import { GerenciaOpcoes } from "./opcoes";

type Produto = {
  id: string;
  codigo: number | null;
  nome: string;
  precoCentavos: number;
  custoCentavos: number | null;
  disponivel: boolean;
  descricao: string | null;
  fotoUrl: string | null;
  miniaturaUrl: string | null;
  videoUrl: string | null;
  ingredientes: string[];
  destaque: boolean;
  categoriaId: string;
  modificadorIds: string[];
};
type Categoria = {
  id: string;
  nome: string;
  impressoraId: string | null;
  codigoInicio: number | null;
  codigoFim: number | null;
  produtos: Produto[];
};
type Impressora = { id: string; nome: string };

const CHAVE = ["gerente", "produtos"];

export const GerenciaCardapio = () => {
  const queryClient = useQueryClient();
  const { data: categorias, isLoading } = useQuery({
    queryKey: CHAVE,
    queryFn: () => api<Categoria[]>("/api/gerente/produtos"),
  });
  const { data: impressoras = [] } = useQuery({
    queryKey: ["gerente", "impressoras"],
    queryFn: () => api<Impressora[]>("/api/gerente/impressoras"),
  });
  const [busca, setBusca] = useState("");
  const [vista, setVista] = useState<"itens" | "opcoes">("itens");
  // Categoria em modo "reordenar itens" (setas no lugar do liga/desliga).
  const [reordenando, setReordenando] = useState<string | null>(null);
  const [novaCategoria, setNovaCategoria] = useState<string | null>(null);
  const [detalhando, setDetalhando] = useState<Produto | null>(null);
  const [novo, setNovo] = useState<{
    categoriaId: string;
    nome: string;
    preco: string;
  } | null>(null);

  const atualizar = () => {
    queryClient.invalidateQueries({ queryKey: CHAVE });
    queryClient.invalidateQueries({ queryKey: ["cardapio"] });
  };

  // Atualização otimista: a tela muda na hora e volta se o servidor recusar.
  const editar = useMutation({
    mutationFn: ({ id, ...dados }: Partial<Produto> & { id: string }) =>
      api(`/api/gerente/produtos/${id}`, { method: "PATCH", json: dados }),
    onMutate: async ({ id, ...dados }) => {
      await queryClient.cancelQueries({ queryKey: CHAVE });
      const anterior = queryClient.getQueryData<Categoria[]>(CHAVE);
      queryClient.setQueryData<Categoria[]>(CHAVE, (atual) =>
        atual?.map((c) => ({
          ...c,
          produtos: c.produtos.map((p) =>
            p.id === id ? { ...p, ...dados } : p,
          ),
        })),
      );
      return { anterior };
    },
    onError: (e, _v, contexto) => {
      queryClient.setQueryData(CHAVE, contexto?.anterior);
      toast.error(e.message);
    },
    onSettled: atualizar,
  });

  const rotear = useMutation({
    mutationFn: ({
      id,
      ...dados
    }: {
      id: string;
      nome?: string;
      impressoraId?: string | null;
      codigoInicio?: number | null;
      codigoFim?: number | null;
    }) =>
      api(`/api/gerente/categorias/${id}`, { method: "PATCH", json: dados }),
    onSuccess: atualizar,
    onError: (e) => toast.error(e.message),
  });

  // Troca a ordem na tela na hora e manda a lista nova para o servidor.
  const reordenar = useMutation({
    mutationFn: ({
      tipo,
      ids,
    }: {
      tipo: "categorias" | "produtos";
      ids: string[];
    }) => api(`/api/gerente/${tipo}/ordem`, { method: "POST", json: { ids } }),
    onMutate: async ({ tipo, ids }) => {
      await queryClient.cancelQueries({ queryKey: CHAVE });
      const anterior = queryClient.getQueryData<Categoria[]>(CHAVE);
      const posicao = (id: string) => ids.indexOf(id);
      queryClient.setQueryData<Categoria[]>(CHAVE, (atual) =>
        tipo === "categorias"
          ? [...(atual ?? [])].sort((a, b) => posicao(a.id) - posicao(b.id))
          : atual?.map((c) =>
              c.produtos.some((p) => ids.includes(p.id))
                ? {
                    ...c,
                    produtos: [...c.produtos].sort(
                      (a, b) => posicao(a.id) - posicao(b.id),
                    ),
                  }
                : c,
            ),
      );
      return { anterior };
    },
    onError: (e, _v, contexto) => {
      queryClient.setQueryData(CHAVE, contexto?.anterior);
      toast.error(e.message);
    },
    onSettled: atualizar,
  });

  const criarCategoria = useMutation({
    mutationFn: (nome: string) =>
      api("/api/gerente/categorias", { method: "POST", json: { nome } }),
    onSuccess: () => {
      setNovaCategoria(null);
      toast.success("Categoria criada");
      atualizar();
    },
    onError: (e) => toast.error(e.message),
  });

  const excluirCategoria = useMutation({
    mutationFn: (id: string) =>
      api(`/api/gerente/categorias/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success("Categoria excluída");
      atualizar();
    },
    onError: (e) => toast.error(e.message),
  });

  const mover = <T extends { id: string }>(
    lista: T[],
    indice: number,
    delta: number,
  ) => {
    const destino = indice + delta;
    if (destino < 0 || destino >= lista.length) return null;
    const ids = lista.map((x) => x.id);
    [ids[indice], ids[destino]] = [ids[destino], ids[indice]];
    return ids;
  };

  const criar = useMutation({
    mutationFn: () => {
      if (!novo) throw new Error("Nada para criar");
      if (novo.nome.trim().length < 2) throw new Error("Informe o nome");
      const precoCentavos = reaisParaCentavos(novo.preco);
      if (!Number.isFinite(precoCentavos)) throw new Error("Preço inválido");
      return api("/api/gerente/produtos", {
        method: "POST",
        json: {
          categoriaId: novo.categoriaId,
          nome: novo.nome.trim(),
          precoCentavos,
        },
      });
    },
    onSuccess: () => {
      setNovo(null);
      atualizar();
      toast.success("Item criado");
    },
    onError: (e) => toast.error(e.message),
  });

  const salvarCodigo = (p: Produto, texto: string) => {
    const codigo = texto === "" ? null : Number(texto);
    if (codigo !== null && (!Number.isInteger(codigo) || codigo < 1)) {
      toast.error("Código inválido");
      return;
    }
    editar.mutate({ id: p.id, codigo });
  };

  const salvarPreco = (p: Produto, texto: string) => {
    const precoCentavos = reaisParaCentavos(texto);
    if (!Number.isFinite(precoCentavos) || precoCentavos < 0) {
      toast.error("Preço inválido");
      return;
    }
    if (precoCentavos !== p.precoCentavos)
      editar.mutate({ id: p.id, precoCentavos });
  };

  const salvarFaixa = (c: Categoria, texto: string) => {
    const [inicio, fim] = texto
      .split(/[-–a]/)
      .map((n) => Number.parseInt(n.trim(), 10));
    if (!inicio || !fim) {
      toast.error("Use início-fim, ex.: 51-100");
      return;
    }
    rotear.mutate({ id: c.id, codigoInicio: inicio, codigoFim: fim });
  };

  // Busca por nome ou código exato.
  const termo = normalizarBusca(busca);
  const visiveis = (categorias ?? [])
    .map((c) => ({
      ...c,
      produtos: termo
        ? c.produtos.filter(
            (p) =>
              normalizarBusca(p.nome).includes(termo) ||
              String(p.codigo) === termo,
          )
        : c.produtos,
    }))
    .filter((c) => !termo || c.produtos.length > 0);

  const teclaNovo = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") criar.mutate();
    if (e.key === "Escape") setNovo(null);
  };

  const abas = (
    <div className="grid grid-cols-2 rounded-xl border border-borda bg-surface p-1 sm:w-80">
      {(
        [
          ["itens", "Itens", BookOpen],
          ["opcoes", "Opções e adicionais", SlidersHorizontal],
        ] as const
      ).map(([valor, rotulo, Icone]) => (
        <button
          key={valor}
          type="button"
          aria-pressed={vista === valor}
          onClick={() => setVista(valor)}
          className={cn(
            "flex h-10 items-center justify-center gap-2 rounded-lg font-semibold text-sm",
            vista === valor
              ? "bg-acao text-acao-foreground"
              : "text-texto-secundario",
          )}
        >
          <Icone className="size-4" />
          {rotulo}
        </button>
      ))}
    </div>
  );

  if (vista === "opcoes") {
    return (
      <div className="flex flex-col gap-4">
        {abas}
        <GerenciaOpcoes categorias={categorias ?? []} />
      </div>
    );
  }

  const ordemCategorias = categorias ?? [];

  return (
    <div className="flex flex-col gap-4">
      {abas}
      <BarraBusca
        valor={busca}
        onMudar={setBusca}
        placeholder="Buscar por nome ou código"
      >
        <Link
          href="/gerente/preview"
          aria-label="Ver o cardápio como o cliente vê"
          className="flex h-12 shrink-0 items-center gap-2 rounded-lg border border-borda bg-surface px-3 font-semibold hover:bg-borda/40"
        >
          <Eye className="size-5" />
          <span className="hidden sm:inline">Prévia</span>
        </Link>
      </BarraBusca>

      {isLoading && (
        <Loader2 className="mx-auto mt-6 size-8 animate-spin text-texto-secundario" />
      )}
      {termo && visiveis.length === 0 && (
        <p className="py-8 text-center text-texto-secundario">
          Nada encontrado para “{busca}”.
        </p>
      )}

      <div className="gap-4 lg:columns-2 [&>section]:mb-4 [&>section]:break-inside-avoid">
        {visiveis.map((categoria) => {
          const impressora = impressoras.find(
            (i) => i.id === categoria.impressoraId,
          );
          const indiceCategoria = ordemCategorias.findIndex(
            (c) => c.id === categoria.id,
          );
          const emOrdem = reordenando === categoria.id;
          return (
            <section
              key={categoria.id}
              className="overflow-hidden rounded-xl border border-borda bg-surface"
            >
              <header className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 border-borda border-b py-2 pr-1 pl-3">
                <h2 className="flex min-w-0 items-baseline gap-1.5 font-bold text-lg">
                  <CampoInline
                    rotulo={`Nome da categoria ${categoria.nome}`}
                    inicial={categoria.nome}
                    exibir={categoria.nome}
                    inputMode="text"
                    onSalvar={(nome) => {
                      if (nome.length >= 2)
                        rotear.mutate({ id: categoria.id, nome });
                    }}
                    className="block h-9 min-w-0 max-w-full truncate rounded-md border border-transparent px-1 text-left"
                  />
                  <span className="shrink-0 font-normal text-sm text-texto-secundario">
                    {categoria.produtos.length}
                  </span>
                </h2>
                <CampoInline
                  rotulo={`Faixa de códigos de ${categoria.nome}`}
                  inicial={
                    categoria.codigoInicio !== null
                      ? `${categoria.codigoInicio}-${categoria.codigoFim}`
                      : ""
                  }
                  exibir={
                    categoria.codigoInicio !== null
                      ? `${categoria.codigoInicio}–${categoria.codigoFim}`
                      : "faixa"
                  }
                  inputMode="text"
                  onSalvar={(t) => salvarFaixa(categoria, t)}
                  className="h-9 w-24 rounded-full border border-borda bg-fundo px-3 font-semibold text-sm tabular-nums"
                />
                <div className="ml-auto flex items-center">
                  <label
                    className="relative flex min-h-12 w-20 cursor-pointer flex-col items-center justify-center rounded-lg hover:bg-borda/40"
                    title="Impressora desta categoria"
                  >
                    <Printer
                      className={cn(
                        "size-5",
                        !impressora && "text-texto-secundario opacity-50",
                      )}
                    />
                    <span className="max-w-full truncate text-[11px] text-texto-secundario">
                      {impressora?.nome ?? "Não imprime"}
                    </span>
                    <select
                      aria-label={`Impressora de ${categoria.nome}`}
                      value={categoria.impressoraId ?? ""}
                      onChange={(e) =>
                        rotear.mutate({
                          id: categoria.id,
                          impressoraId: e.target.value || null,
                        })
                      }
                      className="absolute inset-0 cursor-pointer opacity-0"
                    >
                      <option value="">Não imprime</option>
                      {impressoras.map((i) => (
                        <option key={i.id} value={i.id}>
                          {i.nome}
                        </option>
                      ))}
                    </select>
                  </label>
                  <MenuAcoes
                    rotulo={`Mais ações de ${categoria.nome}`}
                    acoes={[
                      {
                        rotulo: emOrdem ? "Concluir ordem" : "Reordenar itens",
                        Icone: ArrowUpDown,
                        onClick: () =>
                          setReordenando(emOrdem ? null : categoria.id),
                        desabilitado: Boolean(termo),
                      },
                      {
                        rotulo: "Subir categoria",
                        Icone: ArrowUp,
                        desabilitado: indiceCategoria <= 0,
                        onClick: () => {
                          const ids = mover(
                            ordemCategorias,
                            indiceCategoria,
                            -1,
                          );
                          if (ids)
                            reordenar.mutate({ tipo: "categorias", ids });
                        },
                      },
                      {
                        rotulo: "Descer categoria",
                        Icone: ArrowDown,
                        desabilitado:
                          indiceCategoria >= ordemCategorias.length - 1,
                        onClick: () => {
                          const ids = mover(
                            ordemCategorias,
                            indiceCategoria,
                            1,
                          );
                          if (ids)
                            reordenar.mutate({ tipo: "categorias", ids });
                        },
                      },
                      {
                        rotulo: "Excluir categoria",
                        Icone: Trash2,
                        perigo: true,
                        onClick: () => excluirCategoria.mutate(categoria.id),
                      },
                    ]}
                  />
                </div>
              </header>
              {emOrdem && (
                <div className="flex items-center justify-between gap-2 bg-acao/10 px-3 py-2 text-sm">
                  <span>Use as setas para mudar a ordem no cardápio</span>
                  <Button
                    size="sm"
                    variant="acao"
                    onClick={() => setReordenando(null)}
                  >
                    <Check /> Pronto
                  </Button>
                </div>
              )}

              <ul>
                {categoria.produtos.map((p, indice) => (
                  <li
                    key={p.id}
                    className="flex items-center gap-2 border-borda border-b py-1.5 pr-1 pl-3 last:border-0"
                  >
                    <CampoInline
                      rotulo={`Código de ${p.nome}`}
                      inicial={p.codigo?.toString() ?? ""}
                      exibir={p.codigo ?? "—"}
                      onSalvar={(t) => salvarCodigo(p, t)}
                      className="h-12 w-14 shrink-0 rounded-lg border border-borda bg-fundo font-bold text-lg tabular-nums"
                    />
                    <button
                      type="button"
                      aria-label={`Foto e detalhes de ${p.nome}`}
                      onClick={() => setDetalhando(p)}
                      className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-fundo"
                    >
                      {p.miniaturaUrl ? (
                        // biome-ignore lint/performance/noImgElement: miniatura local já otimizada
                        <img
                          src={p.miniaturaUrl}
                          alt=""
                          loading="lazy"
                          decoding="async"
                          className={cn(
                            "size-full object-cover",
                            !p.disponivel && "grayscale",
                          )}
                        />
                      ) : (
                        <Camera className="size-5 text-texto-secundario opacity-60" />
                      )}
                    </button>
                    <div
                      className={cn(
                        "flex min-w-0 flex-1 flex-col items-start gap-0.5",
                        !p.disponivel && "opacity-60",
                      )}
                    >
                      <p
                        className={cn(
                          "flex w-full min-w-0 items-center gap-1 font-semibold",
                          !p.disponivel && "line-through",
                        )}
                      >
                        <span className="truncate">{p.nome}</span>
                        {p.destaque && (
                          <Star
                            aria-label="Destaque da casa"
                            className="size-4 shrink-0 fill-acao text-acao"
                          />
                        )}
                      </p>
                      <CampoInline
                        rotulo={`Preço de ${p.nome}`}
                        inicial={(p.precoCentavos / 100)
                          .toFixed(2)
                          .replace(".", ",")}
                        exibir={formatBRL(p.precoCentavos)}
                        inputMode="decimal"
                        onSalvar={(t) => salvarPreco(p, t)}
                        className="h-7 min-w-20 rounded-md border border-transparent bg-acao/15 px-2 font-bold text-sm tabular-nums"
                      />
                    </div>
                    {emOrdem ? (
                      <div className="flex shrink-0">
                        <Button
                          size="icon"
                          variant="ghost"
                          aria-label={`Subir ${p.nome}`}
                          disabled={indice === 0}
                          onClick={() => {
                            const ids = mover(categoria.produtos, indice, -1);
                            if (ids)
                              reordenar.mutate({ tipo: "produtos", ids });
                          }}
                        >
                          <ArrowUp />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          aria-label={`Descer ${p.nome}`}
                          disabled={indice === categoria.produtos.length - 1}
                          onClick={() => {
                            const ids = mover(categoria.produtos, indice, 1);
                            if (ids)
                              reordenar.mutate({ tipo: "produtos", ids });
                          }}
                        >
                          <ArrowDown />
                        </Button>
                      </div>
                    ) : (
                      <>
                        <Interruptor
                          ligado={p.disponivel}
                          rotulo={`${p.nome} disponível`}
                          onAlternar={() =>
                            editar.mutate({
                              id: p.id,
                              disponivel: !p.disponivel,
                            })
                          }
                        />
                        <Button
                          size="icon"
                          variant="ghost"
                          aria-label={`Editar ${p.nome}`}
                          onClick={() => setDetalhando(p)}
                        >
                          <Pencil />
                        </Button>
                      </>
                    )}
                  </li>
                ))}
              </ul>

              {!termo &&
                (novo?.categoriaId === categoria.id ? (
                  <div className="flex items-center gap-2 border-borda border-t p-2">
                    <input
                      // biome-ignore lint/a11y/noAutofocus: aparece depois do toque em "Novo item"
                      autoFocus
                      aria-label="Nome do novo item"
                      placeholder="Nome"
                      value={novo.nome}
                      onChange={(e) =>
                        setNovo({ ...novo, nome: e.target.value })
                      }
                      onKeyDown={teclaNovo}
                      className="h-12 min-w-0 flex-1 rounded-lg border border-borda bg-fundo px-3"
                    />
                    <input
                      aria-label="Preço do novo item"
                      placeholder="R$"
                      inputMode="decimal"
                      value={novo.preco}
                      onChange={(e) =>
                        setNovo({ ...novo, preco: e.target.value })
                      }
                      onKeyDown={teclaNovo}
                      className="h-12 w-24 rounded-lg border border-borda bg-fundo px-3 text-right tabular-nums"
                    />
                    <Button
                      size="icon"
                      variant="acao"
                      aria-label="Salvar item"
                      disabled={criar.isPending}
                      onClick={() => criar.mutate()}
                    >
                      {criar.isPending ? (
                        <Loader2 className="animate-spin" />
                      ) : (
                        <Check />
                      )}
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label="Cancelar"
                      onClick={() => setNovo(null)}
                    >
                      <X />
                    </Button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() =>
                      setNovo({
                        categoriaId: categoria.id,
                        nome: "",
                        preco: "",
                      })
                    }
                    className="flex h-12 w-full items-center gap-2 border-borda border-t px-4 font-semibold text-sm text-texto-secundario hover:bg-borda/30 hover:text-texto"
                  >
                    <Plus className="size-5" /> Novo item
                  </button>
                ))}
            </section>
          );
        })}
      </div>

      {!termo &&
        (novaCategoria !== null ? (
          <form
            className="flex items-center gap-2 rounded-xl border-2 border-acao bg-surface p-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (novaCategoria.trim().length >= 2)
                criarCategoria.mutate(novaCategoria.trim());
            }}
          >
            <input
              // biome-ignore lint/a11y/noAutofocus: aparece depois do toque em "Nova categoria"
              autoFocus
              aria-label="Nome da nova categoria"
              placeholder="Nome da categoria (ex.: Sobremesas)"
              value={novaCategoria}
              onChange={(e) => setNovaCategoria(e.target.value)}
              onKeyDown={(e) => e.key === "Escape" && setNovaCategoria(null)}
              className="h-12 min-w-0 flex-1 rounded-lg bg-fundo px-3"
            />
            <Button
              type="submit"
              size="icon"
              variant="acao"
              aria-label="Criar categoria"
              disabled={criarCategoria.isPending}
            >
              {criarCategoria.isPending ? (
                <Loader2 className="animate-spin" />
              ) : (
                <Check />
              )}
            </Button>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              aria-label="Cancelar"
              onClick={() => setNovaCategoria(null)}
            >
              <X />
            </Button>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setNovaCategoria("")}
            className="flex h-14 items-center justify-center gap-2 rounded-xl border-2 border-borda border-dashed font-semibold text-texto-secundario hover:border-acao hover:text-texto"
          >
            <FolderPlus className="size-5" /> Nova categoria
          </button>
        ))}

      <DetalhesProduto
        produto={detalhando}
        categorias={ordemCategorias.map((c) => ({ id: c.id, nome: c.nome }))}
        onFechar={() => setDetalhando(null)}
      />
    </div>
  );
};
