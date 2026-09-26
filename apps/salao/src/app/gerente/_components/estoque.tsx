"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, Loader2, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { api } from "@/lib/cliente";
import type { Desconto, InsumoGerencia } from "@/lib/dominio/insumos";
import { cn, formatBRL } from "@/lib/utils";

const campo = "h-12 rounded-lg border border-borda bg-surface px-3";

type Dados = {
  insumos: InsumoGerencia[];
  produtos: { id: string; nome: string; codigo: number | null }[];
  adicionais: { id: string; nome: string }[];
};

const useSalvar = <T,>(fn: (v: T) => Promise<unknown>, sucesso?: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["gerente", "insumos"] });
      queryClient.invalidateQueries({ queryKey: ["cardapio"] });
      if (sucesso) toast.success(sucesso);
    },
    onError: (e) => toast.error(e.message),
  });
};

// Estoque por insumo: contagem da noite (vazio = não controla), em quais
// lanches o insumo é base e quais adicionais o gastam.
export const GerenciaEstoque = () => {
  const { data, isLoading } = useQuery({
    queryKey: ["gerente", "insumos"],
    queryFn: () => api<Dados>("/api/gerente/insumos"),
    // A contagem cai conforme os garçons lançam.
    refetchInterval: 15_000,
  });
  const [novo, setNovo] = useState({ nome: "", unidade: "porção" });
  const criar = useSalvar(
    () =>
      api("/api/gerente/insumos", {
        method: "POST",
        json: { nome: novo.nome, unidade: novo.unidade || "un" },
      }),
    "Insumo criado",
  );

  if (isLoading || !data) {
    return (
      <Loader2 className="mx-auto mt-6 size-8 animate-spin text-texto-secundario" />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-texto-secundario">
        Informe a contagem no início da noite. Cada lanche lançado desconta os
        insumos da receita. Insumo <strong>base</strong> acabou: o lanche fica
        esgotado. Insumo de <strong>adicional</strong> acabou: só o adicional
        fica cinza. Deixe vazio para não controlar.
      </p>

      <ul className="flex flex-col gap-2">
        {data.insumos.map((insumo) => (
          <LinhaInsumo key={insumo.id} insumo={insumo} dados={data} />
        ))}
      </ul>

      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (novo.nome.trim()) criar.mutate(undefined);
          setNovo({ nome: "", unidade: "porção" });
        }}
      >
        <input
          className={cn(campo, "min-w-0 flex-1")}
          placeholder="Novo insumo (ex.: Pão de xis)"
          value={novo.nome}
          onChange={(e) => setNovo({ ...novo, nome: e.target.value })}
        />
        <input
          className={cn(campo, "w-24")}
          placeholder="Unidade"
          value={novo.unidade}
          onChange={(e) => setNovo({ ...novo, unidade: e.target.value })}
        />
        <Button type="submit" variant="acao" disabled={criar.isPending}>
          <Plus /> Criar
        </Button>
      </form>
    </div>
  );
};

const LinhaInsumo = ({
  insumo,
  dados,
}: {
  insumo: InsumoGerencia;
  dados: Dados;
}) => {
  const [contagem, setContagem] = useState(
    insumo.estoque === null ? "" : String(insumo.estoque),
  );
  const [aberto, setAberto] = useState(false);
  const [receita, setReceita] = useState(insumo.produtos);
  const [adicionais, setAdicionais] = useState(insumo.adicionalIds);
  useEffect(() => {
    setContagem(insumo.estoque === null ? "" : String(insumo.estoque));
  }, [insumo.estoque]);

  const salvar = useSalvar(
    (json: Record<string, unknown>) =>
      api(`/api/gerente/insumos/${insumo.id}`, { method: "PATCH", json }),
    "Salvo",
  );
  const salvarContagem = () => {
    const valor = contagem.trim() === "" ? null : Number(contagem);
    if (valor === insumo.estoque) return;
    if (valor !== null && (!Number.isInteger(valor) || valor < 0)) {
      toast.error("Contagem inválida");
      return;
    }
    salvar.mutate({ estoque: valor });
  };

  const naReceita = (produtoId: string) =>
    receita.find((r) => r.produtoId === produtoId);
  const usadoEm = insumo.produtos
    .map((r) => dados.produtos.find((p) => p.id === r.produtoId)?.nome)
    .filter(Boolean);

  return (
    <li
      className={cn(
        "rounded-xl border bg-surface p-3",
        insumo.estoque === 0 ? "border-status-conta" : "border-borda",
      )}
    >
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => setAberto((v) => !v)}
          className="min-w-0 flex-1 text-left"
        >
          <p className="flex items-center gap-2 font-bold">
            {insumo.nome}
            {insumo.estoque === 0 && (
              <span className="rounded-full bg-status-conta px-2 py-0.5 font-semibold text-white text-xs">
                acabou
              </span>
            )}
            <ChevronDown
              className={cn(
                "size-4 text-texto-secundario transition-transform",
                aberto && "rotate-180",
              )}
            />
          </p>
          <p className="truncate text-sm text-texto-secundario">
            {usadoEm.length ? usadoEm.join(", ") : "Não está em nenhum lanche"}
          </p>
        </button>
        <label className="flex items-center gap-2">
          <input
            inputMode="numeric"
            aria-label={`Contagem de ${insumo.nome}`}
            placeholder="—"
            value={contagem}
            onChange={(e) => setContagem(e.target.value.replace(/\D/g, ""))}
            onBlur={salvarContagem}
            onKeyDown={(e) => e.key === "Enter" && salvarContagem()}
            className={cn(campo, "w-20 text-center font-bold text-lg")}
          />
          <span className="w-12 text-sm text-texto-secundario">
            {insumo.unidade}
          </span>
        </label>
      </div>

      {aberto && (
        <div className="mt-3 flex flex-col gap-3 border-borda border-t pt-3">
          <div>
            <p className="mb-1 font-semibold text-sm">
              É base em (quanto cada lanche gasta)
            </p>
            <ul className="grid gap-1 sm:grid-cols-2">
              {dados.produtos.map((p) => {
                const item = naReceita(p.id);
                return (
                  <li key={p.id} className="flex items-center gap-2">
                    <label className="flex min-h-10 flex-1 items-center gap-2">
                      <input
                        type="checkbox"
                        className="size-5"
                        checked={Boolean(item)}
                        onChange={(e) =>
                          setReceita((atual) =>
                            e.target.checked
                              ? [...atual, { produtoId: p.id, quantidade: 1 }]
                              : atual.filter((r) => r.produtoId !== p.id),
                          )
                        }
                      />
                      <span className="text-sm">
                        {p.codigo ? `${p.codigo} · ` : ""}
                        {p.nome}
                      </span>
                    </label>
                    {item && (
                      <input
                        inputMode="numeric"
                        aria-label={`Quantidade em ${p.nome}`}
                        value={item.quantidade}
                        onChange={(e) => {
                          const q = Math.max(
                            1,
                            Math.min(20, Number(e.target.value) || 1),
                          );
                          setReceita((atual) =>
                            atual.map((r) =>
                              r.produtoId === p.id
                                ? { ...r, quantidade: q }
                                : r,
                            ),
                          );
                        }}
                        className="h-10 w-12 rounded-lg border border-borda bg-surface text-center"
                      />
                    )}
                  </li>
                );
              })}
            </ul>
          </div>

          {dados.adicionais.length > 0 && (
            <div>
              <p className="mb-1 font-semibold text-sm">
                Adicionais que gastam 1 {insumo.unidade}
              </p>
              <div className="flex flex-wrap gap-2">
                {dados.adicionais.map((a) => {
                  const ligado = adicionais.includes(a.id);
                  return (
                    <button
                      key={a.id}
                      type="button"
                      aria-pressed={ligado}
                      onClick={() =>
                        setAdicionais((atual) =>
                          ligado
                            ? atual.filter((id) => id !== a.id)
                            : [...atual, a.id],
                        )
                      }
                      className={cn(
                        "min-h-10 rounded-full border-2 px-3 font-semibold text-sm",
                        ligado
                          ? "border-marca bg-marca text-marca-foreground"
                          : "border-borda bg-surface",
                      )}
                    >
                      {a.nome}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <Button
            variant="outline"
            disabled={salvar.isPending}
            onClick={() =>
              salvar.mutate({ produtos: receita, adicionalIds: adicionais })
            }
          >
            Salvar receita
          </Button>
        </div>
      )}
    </li>
  );
};

// Descontos pré-cadastrados: o garçom só escolhe entre estes. Valor livre
// fica com o gerente/caixa, na hora de receber.
export const GerenciaDescontos = () => {
  const queryClient = useQueryClient();
  const { data = [] } = useQuery({
    queryKey: ["gerente", "descontos"],
    queryFn: () => api<Desconto[]>("/api/gerente/descontos"),
  });
  const [form, setForm] = useState({
    nome: "",
    tipo: "percentual" as Desconto["tipo"],
    valor: "",
  });
  const atualizar = () => {
    queryClient.invalidateQueries({ queryKey: ["gerente", "descontos"] });
    queryClient.invalidateQueries({ queryKey: ["descontos"] });
  };
  const criar = useMutation({
    mutationFn: () =>
      api("/api/gerente/descontos", {
        method: "POST",
        json: {
          nome: form.nome,
          tipo: form.tipo,
          valor:
            form.tipo === "percentual"
              ? Number(form.valor)
              : Math.round(Number(form.valor.replace(",", ".")) * 100),
        },
      }),
    onSuccess: () => {
      atualizar();
      setForm({ nome: "", tipo: "percentual", valor: "" });
      toast.success("Desconto criado");
    },
    onError: (e) => toast.error(e.message),
  });
  const alternar = useMutation({
    mutationFn: (d: Desconto) =>
      api(`/api/gerente/descontos/${d.id}`, {
        method: "PATCH",
        json: { ativo: !d.ativo },
      }),
    onSuccess: atualizar,
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-texto-secundario">
        O garçom aplica só os descontos desta lista ao receber o pagamento. O
        desconto entra antes da taxa de serviço.
      </p>
      <ul className="flex flex-col gap-2">
        {data.map((d) => (
          <li
            key={d.id}
            className={cn(
              "flex items-center justify-between rounded-xl border border-borda bg-surface p-3",
              !d.ativo && "opacity-60",
            )}
          >
            <span className="font-semibold">
              {d.nome} ·{" "}
              {d.tipo === "percentual" ? `${d.valor}%` : formatBRL(d.valor)}
            </span>
            <Button variant="ghost" onClick={() => alternar.mutate(d)}>
              {d.ativo ? "Desativar" : "Ativar"}
            </Button>
          </li>
        ))}
        {data.length === 0 && (
          <li className="p-4 text-center text-texto-secundario">
            Nenhum desconto cadastrado.
          </li>
        )}
      </ul>

      <form
        className="flex flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (form.nome.trim() && form.valor) criar.mutate();
        }}
      >
        <input
          className={cn(campo, "min-w-40 flex-1")}
          placeholder="Nome (ex.: Aniversariante)"
          value={form.nome}
          onChange={(e) => setForm({ ...form, nome: e.target.value })}
        />
        <select
          className={campo}
          value={form.tipo}
          onChange={(e) =>
            setForm({ ...form, tipo: e.target.value as Desconto["tipo"] })
          }
        >
          <option value="percentual">%</option>
          <option value="valor">R$</option>
        </select>
        <input
          className={cn(campo, "w-24")}
          inputMode="decimal"
          placeholder={form.tipo === "percentual" ? "10" : "5,00"}
          value={form.valor}
          onChange={(e) => setForm({ ...form, valor: e.target.value })}
        />
        <Button type="submit" variant="acao" disabled={criar.isPending}>
          <Plus /> Criar
        </Button>
      </form>
    </div>
  );
};
