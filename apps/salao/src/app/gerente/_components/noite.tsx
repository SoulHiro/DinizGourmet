"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { api } from "@/lib/cliente";
import type { ResumoGarcom } from "@/lib/dominio/gerencia";
import { formatBRL } from "@/lib/utils";

type Resumo = {
  desde: string;
  garcons: ResumoGarcom[];
  totalVendasCentavos: number;
  totalGorjetaCentavos: number;
  totalTaxaCentavos: number;
};

type ConfigTaxa = { pct: number; pctReduzida: number; limiteCentavos: number };

const campo = "h-12 w-full rounded-lg border border-borda bg-surface px-3";

// Taxa de serviço: cheia até o limite, reduzida acima dele. O cliente só
// escolhe se paga ou não.
const TaxaServico = () => {
  const queryClient = useQueryClient();
  const { data } = useQuery({
    queryKey: ["gerente", "taxa"],
    queryFn: () => api<ConfigTaxa>("/api/gerente/taxa"),
  });
  const [form, setForm] = useState({ pct: "", pctReduzida: "", limite: "" });
  useEffect(() => {
    if (data)
      setForm({
        pct: String(data.pct),
        pctReduzida: String(data.pctReduzida),
        limite: (data.limiteCentavos / 100).toFixed(2).replace(".", ","),
      });
  }, [data]);

  const salvar = useMutation({
    mutationFn: () =>
      api("/api/gerente/taxa", {
        method: "PUT",
        json: {
          pct: Number(form.pct),
          pctReduzida: Number(form.pctReduzida),
          limiteCentavos: Math.round(
            Number(form.limite.replace(/\./g, "").replace(",", ".")) * 100,
          ),
        },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["gerente", "taxa"] });
      toast.success("Taxa de serviço salva");
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <form
      className="flex flex-col gap-3 rounded-xl border border-borda bg-surface p-3"
      onSubmit={(e) => {
        e.preventDefault();
        salvar.mutate();
      }}
    >
      <p className="font-bold">Taxa de serviço</p>
      <div className="grid grid-cols-3 gap-2 text-sm">
        <label className="flex flex-col gap-1">
          <span className="text-texto-secundario">Taxa (%)</span>
          <input
            inputMode="numeric"
            className={campo}
            value={form.pct}
            onChange={(e) => setForm({ ...form, pct: e.target.value })}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-texto-secundario">Acima de (R$)</span>
          <input
            inputMode="decimal"
            className={campo}
            value={form.limite}
            onChange={(e) => setForm({ ...form, limite: e.target.value })}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-texto-secundario">Cai para (%)</span>
          <input
            inputMode="numeric"
            className={campo}
            value={form.pctReduzida}
            onChange={(e) => setForm({ ...form, pctReduzida: e.target.value })}
          />
        </label>
      </div>
      <Button type="submit" variant="outline" disabled={salvar.isPending}>
        Salvar taxa
      </Button>
    </form>
  );
};

// Fechamento da noite por garçom: vendas lançadas, gorjeta dividida,
// chamados atendidos e cancelamentos (desde o meio-dia).
export const ResumoNoite = () => {
  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["gerente", "noite"],
    queryFn: () => api<Resumo>("/api/gerente/noite"),
    refetchInterval: 60_000,
  });

  if (isLoading || !data) {
    return (
      <Loader2 className="mx-auto mt-6 size-8 animate-spin text-texto-secundario" />
    );
  }

  const desde = new Date(data.desde).toLocaleString("pt-BR", {
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-xl border border-borda bg-surface p-3">
          <p className="text-sm text-texto-secundario">Vendas lançadas</p>
          <p className="font-bold text-2xl">
            {formatBRL(data.totalVendasCentavos)}
          </p>
        </div>
        <div className="rounded-xl border border-borda bg-surface p-3">
          <p className="text-sm text-texto-secundario">Gorjetas</p>
          <p className="font-bold text-2xl">
            {formatBRL(data.totalGorjetaCentavos)}
          </p>
        </div>
        <div className="rounded-xl border border-borda bg-surface p-3">
          <p className="text-sm text-texto-secundario">Taxa de serviço</p>
          <p className="font-bold text-2xl">
            {formatBRL(data.totalTaxaCentavos)}
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm text-texto-secundario">Desde {desde}</p>
        <Button variant="ghost" disabled={isFetching} onClick={() => refetch()}>
          <RefreshCw className={isFetching ? "animate-spin" : ""} /> Atualizar
        </Button>
      </div>

      {data.garcons.length === 0 ? (
        <p className="p-6 text-center text-texto-secundario">
          Nenhum movimento ainda nesta noite.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {data.garcons.map((g) => (
            <li
              key={g.funcionarioId}
              className="rounded-xl border border-borda bg-surface p-3"
            >
              <p className="font-bold text-lg">{g.nome}</p>
              <dl className="mt-1 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                <dt className="text-texto-secundario">Vendas</dt>
                <dd className="text-right font-semibold">
                  {formatBRL(g.vendasCentavos)}
                </dd>
                <dt className="text-texto-secundario">Gorjeta</dt>
                <dd className="text-right font-semibold">
                  {formatBRL(g.gorjetaCentavos)}
                </dd>
                <dt className="text-texto-secundario">Taxa de serviço</dt>
                <dd className="text-right font-semibold">
                  {formatBRL(g.taxaCentavos)}
                </dd>
                <dt className="text-texto-secundario">Chamados atendidos</dt>
                <dd className="text-right">{g.chamadosAtendidos}</dd>
                <dt className="text-texto-secundario">Itens cancelados</dt>
                <dd className="text-right">{g.cancelamentos}</dd>
              </dl>
            </li>
          ))}
        </ul>
      )}

      <TaxaServico />
    </div>
  );
};
