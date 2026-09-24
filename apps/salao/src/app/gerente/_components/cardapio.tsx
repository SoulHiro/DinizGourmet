"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { api } from "@/lib/cliente";
import { cn, formatBRL } from "@/lib/utils";

type Produto = {
  id: string;
  nome: string;
  precoCentavos: number;
  disponivel: boolean;
  controlaEstoque: boolean;
  estoque: number | null;
};
type Categoria = {
  id: string;
  nome: string;
  impressoraId: string | null;
  produtos: Produto[];
};
type Impressora = { id: string; nome: string };

const reaisParaCentavos = (valor: string) =>
  Math.round(Number.parseFloat(valor.replace(",", ".")) * 100);

export const GerenciaCardapio = () => {
  const queryClient = useQueryClient();
  const { data: categorias } = useQuery({
    queryKey: ["gerente", "produtos"],
    queryFn: () => api<Categoria[]>("/api/gerente/produtos"),
  });
  const { data: impressoras } = useQuery({
    queryKey: ["gerente", "impressoras"],
    queryFn: () => api<Impressora[]>("/api/gerente/impressoras"),
  });
  const [novo, setNovo] = useState<{
    categoriaId: string;
    nome: string;
    preco: string;
  } | null>(null);

  const atualizar = () => {
    queryClient.invalidateQueries({ queryKey: ["gerente", "produtos"] });
    queryClient.invalidateQueries({ queryKey: ["cardapio"] });
  };

  const editar = useMutation({
    mutationFn: ({ id, ...dados }: Partial<Produto> & { id: string }) =>
      api(`/api/gerente/produtos/${id}`, { method: "PATCH", json: dados }),
    onSuccess: atualizar,
    onError: (e) => toast.error(e.message),
  });

  const rotear = useMutation({
    mutationFn: ({
      id,
      impressoraId,
    }: {
      id: string;
      impressoraId: string | null;
    }) =>
      api(`/api/gerente/categorias/${id}`, {
        method: "PATCH",
        json: { impressoraId },
      }),
    onSuccess: atualizar,
    onError: (e) => toast.error(e.message),
  });

  const criar = useMutation({
    mutationFn: () => {
      if (!novo) throw new Error("Nada para criar");
      const precoCentavos = reaisParaCentavos(novo.preco);
      if (!Number.isFinite(precoCentavos)) throw new Error("Preço inválido");
      return api("/api/gerente/produtos", {
        method: "POST",
        json: { categoriaId: novo.categoriaId, nome: novo.nome, precoCentavos },
      });
    },
    onSuccess: () => {
      setNovo(null);
      atualizar();
      toast.success("Produto criado");
    },
    onError: (e) => toast.error(e.message),
  });

  const salvarEstoque = (p: Produto, valor: string) => {
    const limpo = valor.trim();
    if (limpo === "") {
      if (p.controlaEstoque)
        editar.mutate({ id: p.id, controlaEstoque: false });
      return;
    }
    const estoque = Number.parseInt(limpo, 10);
    if (Number.isNaN(estoque) || estoque < 0) return;
    if (estoque !== p.estoque || !p.controlaEstoque) {
      editar.mutate({ id: p.id, controlaEstoque: true, estoque });
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-texto-secundario">
        Estoque em branco = sem controle. Defina a contagem no início da noite;
        ela baixa sozinha a cada pedido lançado.
      </p>
      {categorias?.map((categoria) => (
        <section
          key={categoria.id}
          className="rounded-xl border border-borda bg-surface"
        >
          <header className="flex flex-wrap items-center gap-2 border-borda border-b p-3">
            <h2 className="flex-1 font-bold text-lg">{categoria.nome}</h2>
            <label className="flex items-center gap-2 text-sm">
              Imprime em
              <select
                value={categoria.impressoraId ?? ""}
                onChange={(e) =>
                  rotear.mutate({
                    id: categoria.id,
                    impressoraId: e.target.value || null,
                  })
                }
                className="h-11 rounded-lg border border-borda bg-surface px-2"
              >
                <option value="">Não imprime</option>
                {impressoras?.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.nome}
                  </option>
                ))}
              </select>
            </label>
          </header>
          <ul>
            {categoria.produtos.map((p) => (
              <li
                key={p.id}
                className="flex flex-wrap items-center gap-2 border-borda border-b px-3 py-2 last:border-0"
              >
                <div className="min-w-32 flex-1">
                  <p
                    className={cn(
                      "font-semibold",
                      !p.disponivel && "text-texto-secundario line-through",
                    )}
                  >
                    {p.nome}
                  </p>
                  <button
                    type="button"
                    className="text-sm text-texto-secundario underline"
                    onClick={() => {
                      const valor = window.prompt(
                        `Novo preço de ${p.nome} (R$)`,
                        (p.precoCentavos / 100).toFixed(2),
                      );
                      if (!valor) return;
                      const precoCentavos = reaisParaCentavos(valor);
                      if (Number.isFinite(precoCentavos))
                        editar.mutate({ id: p.id, precoCentavos });
                    }}
                  >
                    {formatBRL(p.precoCentavos)}
                  </button>
                </div>
                <label className="flex items-center gap-1 text-sm">
                  Estoque
                  <input
                    key={`${p.id}-${p.estoque}-${p.controlaEstoque}`}
                    type="number"
                    inputMode="numeric"
                    min={0}
                    placeholder="—"
                    defaultValue={p.controlaEstoque ? (p.estoque ?? 0) : ""}
                    onBlur={(e) => salvarEstoque(p, e.target.value)}
                    className="h-11 w-20 rounded-lg border border-borda bg-surface px-2 text-center"
                  />
                </label>
                <Button
                  variant={p.disponivel ? "outline" : "destrutivo"}
                  onClick={() =>
                    editar.mutate({ id: p.id, disponivel: !p.disponivel })
                  }
                >
                  {p.disponivel ? "Disponível" : "Indisponível"}
                </Button>
              </li>
            ))}
          </ul>
          {novo?.categoriaId === categoria.id ? (
            <div className="flex flex-wrap gap-2 p-3">
              <input
                // biome-ignore lint/a11y/noAutofocus: o campo só aparece depois de um toque do usuário nele
                autoFocus
                placeholder="Nome"
                value={novo.nome}
                onChange={(e) => setNovo({ ...novo, nome: e.target.value })}
                className="h-12 min-w-40 flex-1 rounded-lg border border-borda bg-surface px-3"
              />
              <input
                placeholder="Preço"
                inputMode="decimal"
                value={novo.preco}
                onChange={(e) => setNovo({ ...novo, preco: e.target.value })}
                className="h-12 w-28 rounded-lg border border-borda bg-surface px-3"
              />
              <Button
                variant="acao"
                disabled={criar.isPending}
                onClick={() => criar.mutate()}
              >
                Salvar
              </Button>
              <Button variant="ghost" onClick={() => setNovo(null)}>
                Cancelar
              </Button>
            </div>
          ) : (
            <Button
              variant="ghost"
              className="m-2"
              onClick={() =>
                setNovo({ categoriaId: categoria.id, nome: "", preco: "" })
              }
            >
              <Plus /> Produto
            </Button>
          )}
        </section>
      ))}
    </div>
  );
};
