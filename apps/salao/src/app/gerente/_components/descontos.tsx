"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BadgePercent,
  Cake,
  Gift,
  Handshake,
  Heart,
  Loader2,
  Lock,
  LockOpen,
  Plus,
  Trash2,
  UserRound,
  UsersRound,
  X,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { api } from "@/lib/cliente";
import type { Desconto } from "@/lib/dominio/insumos";
import { cn, formatBRL } from "@/lib/utils";
import { CampoInline, Interruptor, reaisParaCentavos } from "./campos";
import { TaxaServico } from "./taxa-servico";

const CHAVE = ["gerente", "descontos"];

// Ícone e cor pelo nome, para achar o desconto de olho.
const visual = (nome: string) => {
  const n = nome.toLowerCase();
  if (/anivers/.test(n))
    return { Icone: Cake, cor: "bg-pink-500/15 text-pink-500" };
  if (/funcion|equipe|staff/.test(n))
    return { Icone: UserRound, cor: "bg-sky-500/15 text-sky-500" };
  if (/fiel|fidel|vip/.test(n))
    return { Icone: Heart, cor: "bg-rose-500/15 text-rose-500" };
  if (/parceir|influenc/.test(n))
    return { Icone: Handshake, cor: "bg-violet-500/15 text-violet-500" };
  if (/grupo|galera|mesa grande/.test(n))
    return { Icone: UsersRound, cor: "bg-emerald-500/15 text-emerald-500" };
  if (/cortesia|brinde|casa/.test(n))
    return { Icone: Gift, cor: "bg-amber-500/15 text-amber-500" };
  return { Icone: BadgePercent, cor: "bg-acao/15 text-acao" };
};

const rotuloValor = (tipo: Desconto["tipo"], valor: number) =>
  tipo === "percentual" ? `${valor}%` : formatBRL(valor);

// "Conta de R$ 100 fica R$ 90": deixa claro o tamanho do desconto.
const exemplo = (tipo: Desconto["tipo"], valor: number) => {
  const base = 10_000;
  const desconto =
    tipo === "percentual" ? (base * valor) / 100 : Math.min(valor, base);
  return `Conta de ${formatBRL(base)} fica ${formatBRL(base - desconto)}`;
};

const SUGESTOES = ["Happy hour", "Pagamento no Pix", "Primeira visita"];

export const GerenciaDescontos = () => {
  const queryClient = useQueryClient();
  const { data = [], isLoading } = useQuery({
    queryKey: CHAVE,
    queryFn: () => api<Desconto[]>("/api/gerente/descontos"),
  });
  const [novo, setNovo] = useState<{
    nome: string;
    tipo: Desconto["tipo"];
    valor: string;
  } | null>(null);

  const depois = () => {
    queryClient.invalidateQueries({ queryKey: CHAVE });
    queryClient.invalidateQueries({ queryKey: ["descontos"] });
  };

  const editar = useMutation({
    mutationFn: ({ id, ...json }: Partial<Desconto> & { id: string }) =>
      api(`/api/gerente/descontos/${id}`, { method: "PATCH", json }),
    onMutate: async ({ id, ...dados }) => {
      await queryClient.cancelQueries({ queryKey: CHAVE });
      const anterior = queryClient.getQueryData<Desconto[]>(CHAVE);
      queryClient.setQueryData<Desconto[]>(CHAVE, (atual) =>
        atual?.map((d) => (d.id === id ? { ...d, ...dados } : d)),
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
      api(`/api/gerente/descontos/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success("Desconto excluído");
      depois();
    },
    onError: (e) => toast.error(e.message),
  });

  const criar = useMutation({
    mutationFn: () => {
      if (!novo?.nome.trim()) throw new Error("Dê um nome ao desconto");
      const valor =
        novo.tipo === "percentual"
          ? Number(novo.valor.replace(/\D/g, ""))
          : reaisParaCentavos(novo.valor);
      if (!Number.isFinite(valor) || valor < 1)
        throw new Error("Informe o valor");
      return api("/api/gerente/descontos", {
        method: "POST",
        json: { nome: novo.nome.trim(), tipo: novo.tipo, valor },
      });
    },
    onSuccess: () => {
      setNovo(null);
      toast.success("Desconto criado");
      depois();
    },
    onError: (e) => toast.error(e.message),
  });

  const salvarValor = (d: Desconto, texto: string) => {
    const valor =
      d.tipo === "percentual"
        ? Number(texto.replace(/[^\d]/g, ""))
        : reaisParaCentavos(texto);
    if (!Number.isFinite(valor) || valor < 1) {
      toast.error("Valor inválido");
      return;
    }
    editar.mutate({ id: d.id, valor });
  };

  if (isLoading) {
    return (
      <Loader2 className="mx-auto mt-6 size-8 animate-spin text-texto-secundario" />
    );
  }

  const ativos = data.filter((d) => d.ativo).length;

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-texto-secundario">
        <strong className="text-texto">{ativos}</strong> de {data.length}{" "}
        disponíveis para o garçom
      </p>

      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {data.map((d) => {
          const { Icone, cor } = visual(d.nome);
          return (
            <CardDesconto
              key={d.id}
              desconto={d}
              Icone={Icone}
              cor={cor}
              onNome={(nome) => editar.mutate({ id: d.id, nome })}
              onValor={(t) => salvarValor(d, t)}
              onTipo={() => {
                const tipo = d.tipo === "percentual" ? "valor" : "percentual";
                // 10% vira R$ 10,00 e vice-versa (percentual vai até 100).
                const valor =
                  tipo === "valor"
                    ? d.valor * 100
                    : Math.min(100, Math.round(d.valor / 100));
                editar.mutate({ id: d.id, tipo, valor: Math.max(1, valor) });
              }}
              onAtivo={() => editar.mutate({ id: d.id, ativo: !d.ativo })}
              onLimites={(dados) => editar.mutate({ id: d.id, ...dados })}
              onExcluir={() => excluir.mutate(d.id)}
            />
          );
        })}

        <li>
          {novo ? (
            <form
              className="flex h-full flex-col gap-3 rounded-xl border-2 border-acao bg-surface p-3"
              onSubmit={(e) => {
                e.preventDefault();
                criar.mutate();
              }}
            >
              <div className="flex items-center justify-between">
                <p className="font-bold">Novo desconto</p>
                <Button
                  size="icon"
                  variant="ghost"
                  type="button"
                  aria-label="Cancelar"
                  onClick={() => setNovo(null)}
                >
                  <X />
                </Button>
              </div>
              <input
                // biome-ignore lint/a11y/noAutofocus: aparece depois do toque em "Novo desconto"
                autoFocus
                aria-label="Nome do desconto"
                placeholder="Nome (ex.: Happy hour)"
                value={novo.nome}
                onChange={(e) => setNovo({ ...novo, nome: e.target.value })}
                className="h-12 rounded-lg border border-borda bg-fundo px-3"
              />
              <div className="flex flex-wrap gap-1.5">
                {SUGESTOES.filter((s) => !data.some((d) => d.nome === s)).map(
                  (s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setNovo({ ...novo, nome: s })}
                      className="h-8 rounded-full border border-borda px-3 text-sm text-texto-secundario hover:text-texto"
                    >
                      {s}
                    </button>
                  ),
                )}
              </div>
              <div className="flex gap-2">
                <fieldset className="flex rounded-lg border border-borda bg-fundo p-1">
                  <legend className="sr-only">Tipo de desconto</legend>
                  {(["percentual", "valor"] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      aria-pressed={novo.tipo === t}
                      onClick={() => setNovo({ ...novo, tipo: t })}
                      className={cn(
                        "h-10 w-12 rounded-md font-bold",
                        novo.tipo === t
                          ? "bg-acao text-acao-foreground"
                          : "text-texto-secundario",
                      )}
                    >
                      {t === "percentual" ? "%" : "R$"}
                    </button>
                  ))}
                </fieldset>
                <input
                  aria-label="Valor do desconto"
                  inputMode="decimal"
                  placeholder={novo.tipo === "percentual" ? "10" : "5,00"}
                  value={novo.valor}
                  onChange={(e) => setNovo({ ...novo, valor: e.target.value })}
                  className="h-12 min-w-0 flex-1 rounded-lg border border-borda bg-fundo px-3 text-right font-bold text-lg tabular-nums"
                />
              </div>
              <Button type="submit" variant="acao" disabled={criar.isPending}>
                {criar.isPending ? (
                  <Loader2 className="animate-spin" />
                ) : (
                  <Plus />
                )}
                Criar desconto
              </Button>
            </form>
          ) : (
            <button
              type="button"
              onClick={() =>
                setNovo({ nome: "", tipo: "percentual", valor: "" })
              }
              className="flex h-full min-h-36 w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-borda border-dashed font-semibold text-texto-secundario hover:border-acao hover:text-texto"
            >
              <Plus className="size-6" />
              Novo desconto
            </button>
          )}
        </li>
      </ul>

      <div className="max-w-xl">
        <TaxaServico />
      </div>
    </div>
  );
};

const CardDesconto = ({
  desconto: d,
  Icone,
  cor,
  onNome,
  onValor,
  onTipo,
  onAtivo,
  onExcluir,
  onLimites,
}: {
  desconto: Desconto;
  Icone: typeof Gift;
  cor: string;
  onNome: (nome: string) => void;
  onValor: (texto: string) => void;
  onTipo: () => void;
  onAtivo: () => void;
  onLimites: (dados: {
    somenteGerente?: boolean;
    limitePorNoite?: number | null;
  }) => void;
  onExcluir: () => void;
}) => {
  const [confirmando, setConfirmando] = useState(false);

  return (
    <li
      className={cn(
        "flex flex-col gap-3 rounded-xl border border-borda bg-surface p-3 transition-opacity",
        !d.ativo && "opacity-60",
      )}
    >
      <div className="flex items-start gap-3">
        <span
          className={cn(
            "flex size-12 shrink-0 items-center justify-center rounded-xl",
            cor,
          )}
        >
          <Icone className="size-6" />
        </span>
        <div className="min-w-0 flex-1 pt-1">
          <CampoInline
            rotulo="Nome do desconto"
            inicial={d.nome}
            exibir={d.nome}
            inputMode="text"
            onSalvar={(t) => t && onNome(t)}
            className="block h-8 max-w-full truncate rounded-md border border-transparent px-1 text-left font-bold"
          />
          <p className="px-1 text-texto-secundario text-xs">
            {d.ativo ? "Ativo" : "Desativado"}
          </p>
        </div>
        <Interruptor
          ligado={d.ativo}
          rotulo={`${d.nome} disponível para o garçom`}
          onAlternar={onAtivo}
        />
      </div>

      <div className="flex items-center gap-2">
        <CampoInline
          rotulo={`Valor de ${d.nome}`}
          inicial={
            d.tipo === "percentual"
              ? String(d.valor)
              : (d.valor / 100).toFixed(2).replace(".", ",")
          }
          exibir={rotuloValor(d.tipo, d.valor)}
          inputMode="decimal"
          onSalvar={onValor}
          className="h-12 min-w-24 rounded-lg border border-borda bg-fundo px-3 font-bold text-2xl tabular-nums"
        />
        <button
          type="button"
          onClick={onTipo}
          aria-label={
            d.tipo === "percentual"
              ? "Trocar para valor em R$"
              : "Trocar para %"
          }
          title="Trocar entre % e R$"
          className="h-12 rounded-lg border border-borda px-3 font-semibold text-sm text-texto-secundario hover:text-texto"
        >
          {d.tipo === "percentual" ? "% → R$" : "R$ → %"}
        </button>
        <Button
          size="icon"
          variant={confirmando ? "destrutivo" : "ghost"}
          aria-label={confirmando ? "Confirmar exclusão" : `Excluir ${d.nome}`}
          onClick={() => (confirmando ? onExcluir() : setConfirmando(true))}
          onBlur={() => setConfirmando(false)}
          className="ml-auto"
        >
          <Trash2 />
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <button
          type="button"
          aria-pressed={d.somenteGerente}
          onClick={() => onLimites({ somenteGerente: !d.somenteGerente })}
          title="Quando ligado, o garçom vê o desconto mas não consegue aplicar"
          className={cn(
            "flex h-9 items-center gap-1.5 rounded-full border px-3 font-semibold",
            d.somenteGerente
              ? "border-acao bg-acao/15"
              : "border-borda text-texto-secundario",
          )}
        >
          {d.somenteGerente ? (
            <Lock className="size-4" />
          ) : (
            <LockOpen className="size-4" />
          )}
          {d.somenteGerente ? "Só gerente/caixa" : "Garçom pode aplicar"}
        </button>
        <span className="flex h-9 items-center gap-1.5 rounded-full border border-borda pr-1 pl-3 text-texto-secundario">
          Limite/noite
          <CampoInline
            rotulo={`Limite por noite de ${d.nome}`}
            inicial={d.limitePorNoite?.toString() ?? ""}
            exibir={d.limitePorNoite ?? "∞"}
            onSalvar={(texto) => {
              const n = texto === "" ? null : Number(texto);
              if (n === null || (Number.isInteger(n) && n > 0))
                onLimites({ limitePorNoite: n });
            }}
            className="h-7 min-w-9 rounded-full border border-transparent bg-fundo px-2 font-bold text-texto tabular-nums"
          />
        </span>
      </div>

      <p className="flex flex-wrap justify-between gap-x-3 text-texto-secundario text-xs">
        <span>{exemplo(d.tipo, d.valor)}</span>
        <span
          className={cn(
            d.limitePorNoite !== null &&
              d.usosHoje >= d.limitePorNoite &&
              "font-bold text-destructive",
          )}
        >
          Usado {d.usosHoje}
          {d.limitePorNoite !== null ? `/${d.limitePorNoite}` : ""}{" "}
          {d.usosHoje === 1 ? "vez" : "vezes"} hoje
        </span>
      </p>
    </li>
  );
};
