"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Check,
  ChevronLeft,
  ClipboardList,
  Link2,
  Loader2,
  Minus,
  PackagePlus,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { type KeyboardEvent, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { api } from "@/lib/cliente";
import type { InsumoGerencia } from "@/lib/dominio/insumos";
import { normalizarBusca } from "@/lib/texto";
import { cn } from "@/lib/utils";
import { BarraBusca } from "./campos";

type ProdutoOpcao = {
  id: string;
  nome: string;
  codigo: number | null;
  categoria: string;
};
type Dados = {
  insumos: InsumoGerencia[];
  produtos: ProdutoOpcao[];
  adicionais: { id: string; nome: string }[];
};
type Filtro = "todas" | "acabando" | "esgotadas" | "sem";

const CHAVE = ["gerente", "insumos"];
// Até isso a bebida aparece como "acabando".
const POUCO = 5;

const situacao = (estoque: number | null) =>
  estoque === null
    ? "sem"
    : estoque === 0
      ? "esgotadas"
      : estoque <= POUCO
        ? "acabando"
        : "ok";

// Estoque das bebidas: uma contagem por bebida (vazio = não controla). Cada
// item lançado desconta da contagem; o balde desconta 5 garrafas.
export const GerenciaEstoque = () => {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: CHAVE,
    queryFn: () => api<Dados>("/api/gerente/insumos"),
    // A contagem cai conforme os garçons lançam.
    refetchInterval: 15_000,
  });
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("todas");
  const [nova, setNova] = useState("");
  const [contando, setContando] = useState(false);

  const depois = () => {
    queryClient.invalidateQueries({ queryKey: CHAVE });
    queryClient.invalidateQueries({ queryKey: ["cardapio"] });
  };

  // Otimista: o número muda na hora; volta se o servidor recusar.
  const editar = useMutation({
    mutationFn: ({ id, ...json }: { id: string } & Record<string, unknown>) =>
      api(`/api/gerente/insumos/${id}`, { method: "PATCH", json }),
    onMutate: async ({ id, ...dados }) => {
      await queryClient.cancelQueries({ queryKey: CHAVE });
      const anterior = queryClient.getQueryData<Dados>(CHAVE);
      queryClient.setQueryData<Dados>(CHAVE, (atual) =>
        atual
          ? {
              ...atual,
              insumos: atual.insumos.map((i) =>
                i.id === id ? { ...i, ...dados } : i,
              ),
            }
          : atual,
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
      api(`/api/gerente/insumos/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success("Contagem excluída");
      depois();
    },
    onError: (e) => toast.error(e.message),
  });

  const criar = useMutation({
    mutationFn: () =>
      api("/api/gerente/insumos", {
        method: "POST",
        json: { nome: nova.trim(), unidade: "un" },
      }),
    onSuccess: () => {
      setNova("");
      toast.success("Contagem criada. Ligue aos itens pelo ícone de link.");
      depois();
    },
    onError: (e) => toast.error(e.message),
  });

  if (isLoading || !data) {
    return (
      <Loader2 className="mx-auto mt-6 size-8 animate-spin text-texto-secundario" />
    );
  }

  const produtoPorId = new Map(data.produtos.map((p) => [p.id, p]));
  const codigoDe = (insumo: InsumoGerencia) =>
    Math.min(
      ...insumo.produtos.map(
        (r) => produtoPorId.get(r.produtoId)?.codigo ?? 9999,
      ),
      9999,
    );

  const contar = (f: Filtro) =>
    f === "todas"
      ? data.insumos.length
      : data.insumos.filter((i) => situacao(i.estoque) === f).length;

  const termo = normalizarBusca(busca);
  const filtrados = data.insumos
    .filter((i) => filtro === "todas" || situacao(i.estoque) === filtro)
    .filter((i) => !termo || normalizarBusca(i.nome).includes(termo))
    .sort((a, b) => codigoDe(a) - codigoDe(b));

  // Agrupa pela categoria do primeiro item que gasta a contagem.
  const ordemCategorias = [...new Set(data.produtos.map((p) => p.categoria))];
  const grupos = new Map<string, InsumoGerencia[]>();
  for (const insumo of filtrados) {
    const grupo =
      produtoPorId.get(insumo.produtos[0]?.produtoId ?? "")?.categoria ??
      "Sem item ligado";
    grupos.set(grupo, [...(grupos.get(grupo) ?? []), insumo]);
  }
  const ordenados = [...grupos].sort(
    ([a], [b]) =>
      (ordemCategorias.indexOf(a) + 1 || 999) -
      (ordemCategorias.indexOf(b) + 1 || 999),
  );

  const FILTROS: { valor: Filtro; rotulo: string; cor?: string }[] = [
    { valor: "todas", rotulo: "Todas" },
    { valor: "acabando", rotulo: "Acabando", cor: "bg-status-aguardando" },
    { valor: "esgotadas", rotulo: "Esgotadas", cor: "bg-destructive" },
    { valor: "sem", rotulo: "Sem contagem", cor: "bg-texto-secundario" },
  ];

  return (
    <div className="flex flex-col gap-3">
      <BarraBusca valor={busca} onMudar={setBusca} placeholder="Buscar bebida">
        <Button
          variant="acao"
          className="h-12 shrink-0"
          onClick={() => setContando(true)}
        >
          <ClipboardList />
          <span className="hidden sm:inline">Contar estoque</span>
          <span className="sm:hidden">Contar</span>
        </Button>
      </BarraBusca>

      {contando && (
        <ContagemGuiada
          fila={[...data.insumos].sort((a, b) => codigoDe(a) - codigoDe(b))}
          categoriaDe={(i) =>
            produtoPorId.get(i.produtos[0]?.produtoId ?? "")?.categoria ?? ""
          }
          onSalvar={(id, estoque) => editar.mutateAsync({ id, estoque })}
          onFechar={() => setContando(false)}
        />
      )}

      <fieldset className="-mx-3 flex gap-2 overflow-x-auto px-3 [scrollbar-width:none]">
        <legend className="sr-only">Filtrar contagens</legend>
        {FILTROS.map((f) => (
          <button
            key={f.valor}
            type="button"
            aria-pressed={filtro === f.valor}
            onClick={() => setFiltro(f.valor)}
            className={cn(
              "flex h-10 shrink-0 items-center gap-2 rounded-full border px-3 font-semibold text-sm",
              filtro === f.valor
                ? "border-texto bg-texto text-fundo"
                : "border-borda bg-surface",
            )}
          >
            {f.cor && <span className={cn("size-2.5 rounded-full", f.cor)} />}
            {f.rotulo}
            <span className="tabular-nums opacity-70">{contar(f.valor)}</span>
          </button>
        ))}
      </fieldset>

      {ordenados.length === 0 && (
        <p className="py-8 text-center text-texto-secundario">
          Nenhuma bebida aqui.
        </p>
      )}

      <div className="gap-4 lg:columns-2 [&>section]:mb-4 [&>section]:break-inside-avoid">
        {ordenados.map(([grupo, insumos]) => (
          <section
            key={grupo}
            className="overflow-hidden rounded-xl border border-borda bg-surface"
          >
            <header className="flex items-baseline gap-1.5 border-borda border-b px-3 py-3">
              <h2 className="font-bold text-lg">{grupo}</h2>
              <span className="text-sm text-texto-secundario">
                {insumos.length}
              </span>
            </header>
            <ul>
              {insumos.map((insumo) => (
                <LinhaContagem
                  key={insumo.id}
                  insumo={insumo}
                  dados={data}
                  codigo={codigoDe(insumo)}
                  onContagem={(estoque) =>
                    editar.mutate({ id: insumo.id, estoque })
                  }
                  onReceita={(produtos) =>
                    editar.mutate({ id: insumo.id, produtos })
                  }
                  onExcluir={() => excluir.mutate(insumo.id)}
                />
              ))}
            </ul>
          </section>
        ))}
      </div>

      <form
        className="flex items-center gap-2 rounded-xl border border-borda border-dashed p-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (nova.trim()) criar.mutate();
        }}
      >
        <PackagePlus className="ml-2 size-5 shrink-0 text-texto-secundario" />
        <input
          aria-label="Nova contagem"
          className="h-12 min-w-0 flex-1 bg-transparent px-1 outline-none"
          placeholder="Nova bebida para contar"
          value={nova}
          onChange={(e) => setNova(e.target.value)}
        />
        <Button
          type="submit"
          variant="acao"
          disabled={criar.isPending || !nova.trim()}
        >
          <Plus /> Criar
        </Button>
      </form>
    </div>
  );
};

const LinhaContagem = ({
  insumo,
  dados,
  codigo,
  onContagem,
  onReceita,
  onExcluir,
}: {
  insumo: InsumoGerencia;
  dados: Dados;
  codigo: number;
  onContagem: (estoque: number | null) => void;
  onReceita: (produtos: { produtoId: string; quantidade: number }[]) => void;
  onExcluir: () => void;
}) => {
  // Texto enquanto digita; fora da edição mostra o valor do servidor.
  const [texto, setTexto] = useState<string | null>(null);
  const [aberto, setAberto] = useState(false);
  const estado = situacao(insumo.estoque);

  const salvar = () => {
    if (texto === null) return;
    const valor = texto.trim() === "" ? null : Number(texto);
    setTexto(null);
    if (valor === insumo.estoque) return;
    if (valor !== null && (!Number.isInteger(valor) || valor < 0)) {
      toast.error("Contagem inválida");
      return;
    }
    onContagem(valor);
  };
  const tecla = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") e.currentTarget.blur();
    if (e.key === "Escape") {
      setTexto(String(insumo.estoque ?? ""));
      e.currentTarget.blur();
    }
  };

  // Itens além da própria bebida (ex.: o balde gasta 5).
  const extras = insumo.produtos
    .map((r) => {
      const p = dados.produtos.find((x) => x.id === r.produtoId);
      if (!p || p.nome === insumo.nome) return null;
      return r.quantidade > 1 ? `${p.nome} (−${r.quantidade})` : p.nome;
    })
    .filter(Boolean);

  return (
    <li
      className={cn(
        "border-borda border-b last:border-0",
        estado === "esgotadas" && "bg-destructive/10",
      )}
    >
      <div className="flex items-center gap-2 py-1.5 pr-1 pl-3">
        <span className="hidden h-12 w-14 shrink-0 items-center justify-center rounded-lg border border-borda bg-fundo font-bold text-lg text-texto-secundario tabular-nums sm:flex">
          {codigo < 9999 ? codigo : "—"}
        </span>
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 font-semibold leading-tight">
            {insumo.nome}
          </p>
          {(estado === "esgotadas" ||
            estado === "acabando" ||
            extras.length > 0) && (
            <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-texto-secundario text-xs">
              {estado === "esgotadas" && (
                <span className="rounded-full bg-destructive px-2 py-0.5 font-bold text-white">
                  Esgotada
                </span>
              )}
              {estado === "acabando" && (
                <span className="rounded-full bg-status-aguardando px-2 py-0.5 font-bold text-black">
                  Acabando
                </span>
              )}
              {extras.length > 0 && <span>Também: {extras.join(", ")}</span>}
            </p>
          )}
        </div>

        <div className="flex shrink-0 items-center rounded-lg border border-borda bg-fundo">
          <button
            type="button"
            aria-label={`Tirar 1 de ${insumo.nome}`}
            disabled={!insumo.estoque}
            onClick={() => onContagem((insumo.estoque ?? 0) - 1)}
            className="flex size-11 items-center justify-center disabled:opacity-30"
          >
            <Minus className="size-4" />
          </button>
          <input
            inputMode="numeric"
            aria-label={`Contagem de ${insumo.nome}`}
            placeholder="—"
            value={texto ?? (insumo.estoque === null ? "" : insumo.estoque)}
            onFocus={(e) => {
              setTexto(e.target.value);
              e.target.select();
            }}
            onChange={(e) => setTexto(e.target.value.replace(/\D/g, ""))}
            onBlur={salvar}
            onKeyDown={tecla}
            className="h-11 w-12 rounded-md bg-transparent text-center font-bold text-lg tabular-nums outline-none focus:ring-2 focus:ring-acao"
          />
          <button
            type="button"
            aria-label={`Somar 1 em ${insumo.nome}`}
            onClick={() => onContagem((insumo.estoque ?? 0) + 1)}
            className="flex size-11 items-center justify-center"
          >
            <Plus className="size-4" />
          </button>
        </div>
        <Button
          size="icon"
          variant="ghost"
          aria-label={`Itens ligados a ${insumo.nome}`}
          aria-expanded={aberto}
          title="Itens que gastam esta contagem"
          onClick={() => setAberto((v) => !v)}
          className={cn(
            aberto && "bg-borda/50",
            insumo.produtos.length === 0 && "text-status-aguardando",
          )}
        >
          <Link2 />
        </Button>
      </div>

      {aberto && (
        <PainelReceita
          insumo={insumo}
          dados={dados}
          onSalvar={(produtos) => {
            onReceita(produtos);
            setAberto(false);
          }}
          onExcluir={onExcluir}
        />
      )}
    </li>
  );
};

// Contagem do início da noite: uma bebida por vez, número grande, Enter
// salva e vai para a próxima. No fim, um resumo do que ficou.
const ContagemGuiada = ({
  fila,
  categoriaDe,
  onSalvar,
  onFechar,
}: {
  fila: InsumoGerencia[];
  categoriaDe: (insumo: InsumoGerencia) => string;
  onSalvar: (id: string, estoque: number | null) => Promise<unknown>;
  onFechar: () => void;
}) => {
  const [indice, setIndice] = useState(0);
  const [texto, setTexto] = useState("");
  const [contadas, setContadas] = useState<Record<string, number | null>>({});
  const [salvando, setSalvando] = useState(false);
  const atual = fila[indice];
  const fim = indice >= fila.length;

  const avancar = async (valor: number | null | "pular") => {
    if (!atual) return;
    if (valor !== "pular") {
      setSalvando(true);
      try {
        await onSalvar(atual.id, valor);
        setContadas((c) => ({ ...c, [atual.id]: valor }));
      } catch {
        setSalvando(false);
        return;
      }
      setSalvando(false);
    }
    setTexto("");
    setIndice((i) => i + 1);
  };

  const confirmar = () => {
    if (texto.trim() === "") {
      toast.error("Digite a quantidade (ou use Pular)");
      return;
    }
    avancar(Number(texto));
  };

  const valores = Object.values(contadas);
  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-fundo">
      <header className="flex items-center gap-3 border-borda border-b px-4 py-3">
        <ClipboardList className="size-6 text-acao" />
        <div className="flex-1">
          <p className="font-bold">Contagem da noite</p>
          <p className="text-sm text-texto-secundario tabular-nums">
            {Math.min(indice + 1, fila.length)} de {fila.length}
          </p>
        </div>
        <Button
          size="icon"
          variant="ghost"
          aria-label="Fechar"
          onClick={onFechar}
        >
          <X />
        </Button>
      </header>
      <div className="h-1.5 bg-borda/60">
        <div
          className="h-full bg-acao transition-[width] duration-300"
          style={{ width: `${(indice / Math.max(fila.length, 1)) * 100}%` }}
        />
      </div>

      {fim ? (
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
          <span className="flex size-16 items-center justify-center rounded-full bg-status-livre/15 text-status-livre">
            <Check className="size-8" />
          </span>
          <p className="font-bold text-2xl">Contagem concluída</p>
          <p className="text-texto-secundario">
            {valores.length}{" "}
            {valores.length === 1 ? "bebida contada" : "bebidas contadas"}
            {" · "}
            {valores.filter((v) => v === 0).length} zeradas
            {" · "}
            {fila.length - valores.length} puladas
          </p>
          <Button
            variant="acao"
            size="lg"
            className="w-full"
            onClick={onFechar}
          >
            Concluir
          </Button>
        </div>
      ) : (
        <form
          className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-5 p-6"
          onSubmit={(e) => {
            e.preventDefault();
            confirmar();
          }}
        >
          <div className="text-center">
            <p className="font-semibold text-sm text-texto-secundario uppercase tracking-wide">
              {categoriaDe(atual)}
            </p>
            <p className="mt-1 font-bold text-3xl leading-tight">
              {atual.nome}
            </p>
            <p className="mt-2 text-texto-secundario">
              Contagem anterior:{" "}
              <strong className="text-texto">
                {atual.estoque === null ? "sem controle" : atual.estoque}
              </strong>
            </p>
          </div>
          <input
            key={atual.id}
            // biome-ignore lint/a11y/noAutofocus: cada bebida entra já pronta para digitar
            autoFocus
            inputMode="numeric"
            aria-label={`Quantidade de ${atual.nome}`}
            placeholder="0"
            value={texto}
            onChange={(e) => setTexto(e.target.value.replace(/\D/g, ""))}
            className="h-24 rounded-2xl border-2 border-acao bg-surface text-center font-bold text-6xl tabular-nums outline-none"
          />
          <Button type="submit" variant="acao" size="lg" disabled={salvando}>
            {salvando ? <Loader2 className="animate-spin" /> : <Check />}
            Salvar e próxima
          </Button>
          <div className="grid grid-cols-3 gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={indice === 0 || salvando}
              onClick={() => {
                setTexto("");
                setIndice((i) => i - 1);
              }}
            >
              <ChevronLeft /> Voltar
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={salvando}
              onClick={() => avancar("pular")}
            >
              Pular
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={salvando}
              onClick={() => avancar(null)}
            >
              Sem controle
            </Button>
          </div>
        </form>
      )}
    </div>
  );
};

// Quais itens do cardápio gastam esta contagem, e quanto cada um gasta.
const PainelReceita = ({
  insumo,
  dados,
  onSalvar,
  onExcluir,
}: {
  insumo: InsumoGerencia;
  dados: Dados;
  onSalvar: (produtos: { produtoId: string; quantidade: number }[]) => void;
  onExcluir: () => void;
}) => {
  const [receita, setReceita] = useState(insumo.produtos);
  const [busca, setBusca] = useState("");
  const [confirmando, setConfirmando] = useState(false);
  const termo = normalizarBusca(busca);
  const ligado = (id: string) => receita.find((r) => r.produtoId === id);
  // Sem busca, só os ligados; os outros aparecem ao buscar.
  const lista = dados.produtos.filter((p) =>
    termo
      ? normalizarBusca(p.nome).includes(termo) || String(p.codigo) === termo
      : ligado(p.id),
  );

  return (
    <div className="flex flex-col gap-2 border-borda border-t bg-fundo/50 p-3">
      <p className="font-semibold text-sm">Itens que gastam esta contagem</p>
      <label className="relative">
        <Search className="-translate-y-1/2 absolute top-1/2 left-3 size-4 text-texto-secundario" />
        <input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Ligar outro item (nome ou código)"
          aria-label="Buscar item do cardápio"
          className="h-11 w-full rounded-lg border border-borda bg-surface pr-3 pl-9 text-sm"
        />
      </label>
      <ul className="flex flex-col">
        {lista.map((p) => {
          const item = ligado(p.id);
          return (
            <li key={p.id} className="flex min-h-11 items-center gap-2">
              <label className="flex flex-1 items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="size-5 accent-[var(--brand-accent)]"
                  checked={Boolean(item)}
                  onChange={(e) =>
                    setReceita((atual) =>
                      e.target.checked
                        ? [...atual, { produtoId: p.id, quantidade: 1 }]
                        : atual.filter((r) => r.produtoId !== p.id),
                    )
                  }
                />
                <span className="w-9 text-texto-secundario tabular-nums">
                  {p.codigo ?? ""}
                </span>
                {p.nome}
              </label>
              {item && (
                <label className="flex items-center gap-1 text-texto-secundario text-xs">
                  gasta
                  <input
                    inputMode="numeric"
                    aria-label={`Quanto ${p.nome} gasta`}
                    value={item.quantidade}
                    onChange={(e) => {
                      const q = Math.max(
                        1,
                        Math.min(20, Number(e.target.value) || 1),
                      );
                      setReceita((atual) =>
                        atual.map((r) =>
                          r.produtoId === p.id ? { ...r, quantidade: q } : r,
                        ),
                      );
                    }}
                    className="h-9 w-11 rounded-lg border border-borda bg-surface text-center font-semibold text-sm text-texto"
                  />
                </label>
              )}
            </li>
          );
        })}
        {lista.length === 0 && (
          <li className="py-2 text-sm text-texto-secundario">
            {termo
              ? "Nenhum item com esse nome."
              : "Nenhum item ligado. Busque acima para ligar."}
          </li>
        )}
      </ul>
      <div className="flex gap-2">
        <Button
          variant="acao"
          className="flex-1"
          onClick={() => onSalvar(receita)}
        >
          Salvar
        </Button>
        <Button
          variant={confirmando ? "destrutivo" : "ghost"}
          aria-label="Excluir contagem"
          onClick={() => (confirmando ? onExcluir() : setConfirmando(true))}
        >
          <Trash2 />
          {confirmando && "Confirmar"}
        </Button>
      </div>
    </div>
  );
};
