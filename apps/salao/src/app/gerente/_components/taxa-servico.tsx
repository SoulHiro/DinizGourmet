"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { HandCoins, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { api } from "@/lib/cliente";
import { formatBRL } from "@/lib/utils";

type ConfigTaxa = { pct: number; pctReduzida: number; limiteCentavos: number };

const campo =
  "h-12 w-full rounded-lg border border-borda bg-fundo px-3 text-right font-bold text-lg tabular-nums";

// Taxa de serviço: cheia até o limite, reduzida acima dele. O cliente só
// escolhe se paga ou não.
export const TaxaServico = () => {
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

  const limiteCentavos = Math.round(
    Number(form.limite.replace(/\./g, "").replace(",", ".")) * 100,
  );
  const alterado =
    data &&
    (Number(form.pct) !== data.pct ||
      Number(form.pctReduzida) !== data.pctReduzida ||
      limiteCentavos !== data.limiteCentavos);

  const salvar = useMutation({
    mutationFn: () =>
      api("/api/gerente/taxa", {
        method: "PUT",
        json: {
          pct: Number(form.pct),
          pctReduzida: Number(form.pctReduzida),
          limiteCentavos,
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
      className="flex flex-col gap-3 rounded-xl border border-borda bg-surface p-4"
      onSubmit={(e) => {
        e.preventDefault();
        salvar.mutate();
      }}
    >
      <div className="flex items-center gap-3">
        <span className="flex size-11 items-center justify-center rounded-xl bg-acao/15 text-acao">
          <HandCoins className="size-6" />
        </span>
        <div>
          <p className="font-bold">Taxa de serviço</p>
          <p className="text-sm text-texto-secundario">
            Sugerida na conta; o cliente escolhe se paga
          </p>
        </div>
      </div>
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
      {Number.isFinite(limiteCentavos) && (
        <p className="text-sm text-texto-secundario">
          Até {formatBRL(limiteCentavos)}: {form.pct || 0}% · acima disso:{" "}
          {form.pctReduzida || 0}%
        </p>
      )}
      <Button
        type="submit"
        variant="acao"
        disabled={!alterado || salvar.isPending}
      >
        {salvar.isPending && <Loader2 className="animate-spin" />}
        Salvar taxa
      </Button>
    </form>
  );
};
