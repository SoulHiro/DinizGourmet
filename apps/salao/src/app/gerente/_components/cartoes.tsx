"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Printer } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { api } from "@/lib/cliente";
import type { CartaoGerencia } from "@/lib/dominio/cartoes";
import { cn } from "@/lib/utils";

// Cartões físicos de comanda: quantos existem, quais estão em uso agora e
// desativar um cartão perdido (o número deixa de abrir comanda).
export const GerenciaCartoes = () => {
  const queryClient = useQueryClient();
  const { data: cartoes, isLoading } = useQuery({
    queryKey: ["gerente", "cartoes"],
    queryFn: () => api<CartaoGerencia[]>("/api/gerente/cartoes"),
    refetchInterval: 30_000,
  });
  const [ate, setAte] = useState("");
  const atualizar = () =>
    queryClient.invalidateQueries({ queryKey: ["gerente", "cartoes"] });

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
    onSuccess: atualizar,
    onError: (e) => toast.error(e.message),
  });

  if (isLoading || !cartoes) {
    return (
      <Loader2 className="mx-auto mt-6 size-8 animate-spin text-texto-secundario" />
    );
  }

  const emUso = cartoes.filter((c) => c.emUsoNaMesa !== null).length;

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-texto-secundario">
        Cada pessoa (ou casal) que paga separado recebe um cartão. O garçom abre
        a comanda com o número do cartão; o QR do cartão mostra a conta para o
        cliente e o código de barras acha a comanda no caixa.
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <Link
          href="/gerente/cartoes"
          className="flex h-12 items-center gap-2 rounded-lg bg-acao px-4 font-semibold text-acao-foreground"
        >
          <Printer className="size-5" /> Imprimir cartões
        </Link>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (ate) criar.mutate();
          }}
        >
          <input
            aria-label="Criar cartões até o número"
            inputMode="numeric"
            placeholder="Criar até nº"
            value={ate}
            onChange={(e) => setAte(e.target.value.replace(/\D/g, ""))}
            className="h-12 w-32 rounded-lg border border-borda bg-surface px-3"
          />
          <Button type="submit" disabled={!ate || criar.isPending}>
            Criar
          </Button>
        </form>
        <p className="text-sm text-texto-secundario">
          {cartoes.length} cartões · {emUso} em uso agora
        </p>
      </div>

      <ul className="grid grid-cols-4 gap-2 sm:grid-cols-6 lg:grid-cols-10">
        {cartoes.map((c) => (
          <li key={c.id}>
            <button
              type="button"
              title={
                c.emUsoNaMesa !== null
                  ? `Em uso na mesa ${c.emUsoNaMesa}`
                  : c.ativo
                    ? "Toque para desativar (cartão perdido)"
                    : "Desativado. Toque para reativar"
              }
              disabled={alternar.isPending || c.emUsoNaMesa !== null}
              onClick={() => alternar.mutate(c)}
              className={cn(
                "flex aspect-square w-full flex-col items-center justify-center rounded-lg border-2 font-bold text-xl",
                c.emUsoNaMesa !== null
                  ? "border-status-ocupada bg-status-ocupada text-white"
                  : c.ativo
                    ? "border-borda bg-surface"
                    : "border-dashed border-borda text-texto-secundario line-through",
              )}
            >
              {c.numero}
              {c.emUsoNaMesa !== null && (
                <span className="font-normal text-xs">
                  mesa {c.emUsoNaMesa}
                </span>
              )}
            </button>
          </li>
        ))}
      </ul>
      <p className="text-sm text-texto-secundario">
        Azul: em uso agora. Riscado: desativado (toque para reativar).
      </p>
    </div>
  );
};
