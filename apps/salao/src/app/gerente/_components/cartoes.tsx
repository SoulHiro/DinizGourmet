"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, Printer } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { api } from "@/lib/cliente";
import type { CartaoGerencia } from "@/lib/dominio/cartoes";
import { cn } from "@/lib/utils";
import { Estatistica } from "./cadastros";
import { BarraBusca } from "./campos";

type Filtro = "todos" | "uso" | "livres" | "desativados";

const situacao = (c: CartaoGerencia): Exclude<Filtro, "todos"> =>
  c.emUsoNaMesa !== null ? "uso" : c.ativo ? "livres" : "desativados";

// Cartões físicos de comanda: quantos existem, quais estão em uso agora e
// desativar um cartão perdido (o número deixa de abrir comanda).
export const GerenciaCartoes = () => {
  const queryClient = useQueryClient();
  const chave = ["gerente", "cartoes"];
  const { data: cartoes, isLoading } = useQuery({
    queryKey: chave,
    queryFn: () => api<CartaoGerencia[]>("/api/gerente/cartoes"),
    refetchInterval: 30_000,
  });
  const [ate, setAte] = useState("");
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const atualizar = () => queryClient.invalidateQueries({ queryKey: chave });

  const criar = useMutation({
    mutationFn: () =>
      api<{ criados: number }>("/api/gerente/cartoes", {
        method: "POST",
        json: { ate: Number(ate) },
      }),
    onSuccess: ({ criados }) => {
      toast.success(
        criados ? `${criados} cartões criados` : "Esses cartões já existiam",
      );
      setAte("");
      atualizar();
    },
    onError: (e) => toast.error(e.message),
  });
  const alternar = useMutation({
    mutationFn: (c: CartaoGerencia) =>
      api(`/api/gerente/cartoes/${c.id}`, {
        method: "PATCH",
        json: { ativo: !c.ativo },
      }),
    onMutate: async (c) => {
      await queryClient.cancelQueries({ queryKey: chave });
      const anterior = queryClient.getQueryData<CartaoGerencia[]>(chave);
      queryClient.setQueryData<CartaoGerencia[]>(chave, (atual) =>
        atual?.map((x) => (x.id === c.id ? { ...x, ativo: !c.ativo } : x)),
      );
      return { anterior };
    },
    onSuccess: (_r, c) =>
      toast(`Cartão ${c.numero} ${c.ativo ? "desativado" : "reativado"}`, {
        action: {
          label: "Desfazer",
          onClick: () => alternar.mutate({ ...c, ativo: !c.ativo }),
        },
      }),
    onError: (e, _c, contexto) => {
      queryClient.setQueryData(chave, contexto?.anterior);
      toast.error(e.message);
    },
    onSettled: atualizar,
  });

  if (isLoading || !cartoes) {
    return (
      <Loader2 className="mx-auto mt-6 size-8 animate-spin text-texto-secundario" />
    );
  }

  const conta = (f: Filtro) =>
    f === "todos"
      ? cartoes.length
      : cartoes.filter((c) => situacao(c) === f).length;
  const visiveis = cartoes
    .filter((c) => filtro === "todos" || situacao(c) === filtro)
    .filter((c) => !busca || String(c.numero).startsWith(busca.trim()));

  const FILTROS: { valor: Filtro; rotulo: string; cor?: string }[] = [
    { valor: "todos", rotulo: "Todos" },
    { valor: "uso", rotulo: "Em uso", cor: "bg-status-ocupada" },
    { valor: "livres", rotulo: "Livres", cor: "bg-status-livre" },
    { valor: "desativados", rotulo: "Desativados", cor: "bg-borda" },
  ];

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-3 gap-2">
        <Estatistica
          valor={conta("uso")}
          rotulo="Em uso agora"
          cor="bg-status-ocupada"
        />
        <Estatistica
          valor={conta("livres")}
          rotulo="Livres"
          cor="bg-status-livre"
        />
        <Estatistica
          valor={conta("desativados")}
          rotulo="Desativados"
          cor="bg-borda"
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <form
          className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-borda bg-surface p-1.5 pl-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (ate) criar.mutate();
          }}
        >
          <Plus className="size-5 shrink-0 text-texto-secundario" />
          <input
            aria-label="Criar cartões até o número"
            inputMode="numeric"
            placeholder={`Criar cartões até o nº (hoje: ${cartoes.length})`}
            value={ate}
            onChange={(e) => setAte(e.target.value.replace(/\D/g, ""))}
            className="h-11 min-w-0 flex-1 bg-transparent outline-none"
          />
          <Button
            variant="acao"
            type="submit"
            disabled={!ate || criar.isPending}
          >
            {criar.isPending ? <Loader2 className="animate-spin" /> : "Criar"}
          </Button>
        </form>
        <Button asChild variant="outline" className="h-[3.75rem]">
          <Link href="/gerente/cartoes">
            <Printer /> Imprimir
          </Link>
        </Button>
      </div>

      <BarraBusca
        valor={busca}
        onMudar={(v) => setBusca(v.replace(/\D/g, ""))}
        placeholder="Buscar cartão pelo número"
      />

      <div className="-mx-3 flex gap-2 overflow-x-auto px-3 [scrollbar-width:none]">
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
            <span className="tabular-nums opacity-70">{conta(f.valor)}</span>
          </button>
        ))}
      </div>

      {visiveis.length === 0 ? (
        <p className="py-8 text-center text-texto-secundario">
          Nenhum cartão aqui.
        </p>
      ) : (
        <ul className="grid grid-cols-4 gap-2 sm:grid-cols-6 lg:grid-cols-10">
          {visiveis.map((c) => {
            const estado = situacao(c);
            return (
              <li key={c.id}>
                <button
                  type="button"
                  title={
                    estado === "uso"
                      ? `Em uso na mesa ${c.emUsoNaMesa}`
                      : estado === "livres"
                        ? "Toque para desativar (cartão perdido)"
                        : "Toque para reativar"
                  }
                  disabled={estado === "uso"}
                  onClick={() => alternar.mutate(c)}
                  className={cn(
                    "relative flex aspect-[4/5] w-full flex-col items-center justify-center gap-0.5 rounded-xl border-2 font-bold text-2xl tabular-nums transition-colors",
                    estado === "uso"
                      ? "border-status-ocupada bg-status-ocupada/10"
                      : estado === "livres"
                        ? "border-borda bg-surface hover:border-status-livre"
                        : "border-borda border-dashed text-texto-secundario/60",
                  )}
                >
                  {c.numero}
                  <span className="font-semibold text-[10px] text-texto-secundario uppercase tracking-wide">
                    {estado === "uso"
                      ? `mesa ${c.emUsoNaMesa}`
                      : estado === "livres"
                        ? "livre"
                        : "desativado"}
                  </span>
                  {estado === "uso" && (
                    <span className="absolute top-1.5 right-1.5 size-2.5 rounded-full bg-status-ocupada" />
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <p className="text-center text-texto-secundario text-xs">
        Cartão perdido? Toque nele para desativar
      </p>
    </div>
  );
};
