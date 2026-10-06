"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Beer,
  CookingPot,
  Flame,
  ListOrdered,
  Loader2,
  Plus,
  Printer,
  QrCode,
  Receipt,
  RotateCcw,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { STATUS_MESA } from "@/components/salao/status-mesa";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/cliente";
import { useImpressao, useMapa } from "@/lib/consultas";
import { cn } from "@/lib/utils";
import { CampoInline, Interruptor } from "./campos";

const campo = "h-12 rounded-lg border border-borda bg-surface px-3";

// Mesas
type Mesa = { id: string; numero: number; ativa: boolean };

// Números de "1-20" ou "1, 3, 5" (até 200 de uma vez).
const numerosDe = (texto: string) => {
  const numeros = new Set<number>();
  for (const parte of texto.split(",")) {
    const [a, b] = parte.split(/[-–a]/).map((n) => Number.parseInt(n, 10));
    if (!a) continue;
    for (let n = a; n <= (b || a) && numeros.size < 200; n++) numeros.add(n);
  }
  return [...numeros].filter((n) => n > 0 && n <= 999);
};

export const Estatistica = ({
  valor,
  rotulo,
  cor,
}: {
  valor: number | string;
  rotulo: string;
  cor?: string;
}) => (
  <div className="flex flex-col gap-1 rounded-xl border border-borda bg-surface px-3 py-2.5">
    <span className="flex items-center gap-1.5 text-texto-secundario text-xs">
      {cor && <span className={cn("size-2.5 rounded-full", cor)} />}
      {rotulo}
    </span>
    <span className="font-bold text-2xl tabular-nums leading-none">
      {valor}
    </span>
  </div>
);

// Cabe no quadradinho da mesa.
const CURTO: Record<string, string> = {
  ocupada: "ocupada",
  aguardando: "aguardando",
  chamado: "chamou",
  conta: "conta",
};

export const GerenciaMesas = () => {
  const queryClient = useQueryClient();
  const chave = ["gerente", "mesas"];
  const { data: mesas, isLoading } = useQuery({
    queryKey: chave,
    queryFn: () => api<Mesa[]>("/api/gerente/mesas"),
  });
  const { data: mapa = [] } = useMapa();
  const [texto, setTexto] = useState("");
  const [criando, setCriando] = useState(false);

  const atualizar = () => {
    queryClient.invalidateQueries({ queryKey: chave });
    queryClient.invalidateQueries({ queryKey: ["mesas"] });
  };

  const alternar = useMutation({
    mutationFn: (m: Mesa) =>
      api(`/api/gerente/mesas/${m.id}`, {
        method: "PATCH",
        json: { ativa: !m.ativa },
      }),
    onMutate: async (m) => {
      await queryClient.cancelQueries({ queryKey: chave });
      const anterior = queryClient.getQueryData<Mesa[]>(chave);
      queryClient.setQueryData<Mesa[]>(chave, (atual) =>
        atual?.map((x) => (x.id === m.id ? { ...x, ativa: !m.ativa } : x)),
      );
      return { anterior };
    },
    onSuccess: (_r, m) =>
      toast(`Mesa ${m.numero} ${m.ativa ? "desativada" : "ativada"}`, {
        action: {
          label: "Desfazer",
          onClick: () => alternar.mutate({ ...m, ativa: !m.ativa }),
        },
      }),
    onError: (e, _m, contexto) => {
      queryClient.setQueryData(chave, contexto?.anterior);
      toast.error(e.message);
    },
    onSettled: atualizar,
  });

  const criar = async () => {
    const existentes = new Set(mesas?.map((m) => m.numero));
    const novos = numerosDe(texto).filter((n) => !existentes.has(n));
    if (novos.length === 0) {
      toast.error("Nenhum número novo. Use 21 ou 21-30.");
      return;
    }
    setCriando(true);
    let criadas = 0;
    for (const numero of novos) {
      try {
        await api("/api/gerente/mesas", { method: "POST", json: { numero } });
        criadas++;
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Falha ao criar mesa");
        break;
      }
    }
    setCriando(false);
    if (criadas) {
      toast.success(criadas === 1 ? "Mesa criada" : `${criadas} mesas criadas`);
      setTexto("");
      atualizar();
    }
  };

  if (isLoading || !mesas) {
    return (
      <Loader2 className="mx-auto mt-6 size-8 animate-spin text-texto-secundario" />
    );
  }

  const statusDe = new Map(mapa.map((m) => [m.id, m]));
  const ocupadas = mapa.filter((m) => m.status !== "livre").length;
  const ativas = mesas.filter((m) => m.ativa).length;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-3 gap-2">
        <Estatistica valor={ativas} rotulo="Ativas" cor="bg-status-livre" />
        <Estatistica
          valor={ocupadas}
          rotulo="Ocupadas agora"
          cor="bg-status-ocupada"
        />
        <Estatistica
          valor={mesas.length - ativas}
          rotulo="Desativadas"
          cor="bg-borda"
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <form
          className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-borda bg-surface p-1.5 pl-3"
          onSubmit={(e) => {
            e.preventDefault();
            criar();
          }}
        >
          <Plus className="size-5 shrink-0 text-texto-secundario" />
          <input
            aria-label="Números das novas mesas"
            inputMode="numeric"
            placeholder="Nova mesa: 21 ou 21-30"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            className="h-11 min-w-0 flex-1 bg-transparent outline-none"
          />
          <Button
            variant="acao"
            type="submit"
            disabled={criando || !texto.trim()}
          >
            {criando ? <Loader2 className="animate-spin" /> : "Criar"}
          </Button>
        </form>
        <Button asChild variant="outline" className="h-[3.75rem]">
          <Link href="/gerente/qr">
            <QrCode /> QR codes
          </Link>
        </Button>
      </div>

      <ul className="grid grid-cols-4 gap-2 sm:grid-cols-6 lg:grid-cols-10">
        {mesas.map((m) => {
          const noMapa = statusDe.get(m.id);
          const ocupada = noMapa && noMapa.status !== "livre";
          return (
            <li key={m.id}>
              <button
                type="button"
                disabled={Boolean(ocupada) || alternar.isPending}
                title={
                  ocupada
                    ? "Ocupada: não dá para desativar agora"
                    : m.ativa
                      ? "Toque para desativar"
                      : "Toque para ativar"
                }
                onClick={() => alternar.mutate(m)}
                className={cn(
                  "relative flex aspect-square w-full flex-col items-center justify-center gap-0.5 rounded-xl border-2 font-bold text-2xl tabular-nums transition-colors",
                  !m.ativa
                    ? "border-borda border-dashed text-texto-secundario/60"
                    : ocupada
                      ? "border-status-ocupada bg-status-ocupada/10"
                      : "border-borda bg-surface hover:border-status-livre",
                )}
              >
                {m.numero}
                <span className="font-semibold text-[10px] text-texto-secundario uppercase tracking-wide">
                  {!m.ativa
                    ? "desativada"
                    : ocupada && noMapa
                      ? CURTO[noMapa.status]
                      : "livre"}
                </span>
                {ocupada && noMapa && (
                  <span
                    className={cn(
                      "absolute top-1.5 right-1.5 size-2.5 rounded-full",
                      STATUS_MESA[noMapa.status].classe,
                    )}
                  />
                )}
              </button>
            </li>
          );
        })}
      </ul>
      <p className="text-center text-texto-secundario text-xs">
        Toque numa mesa livre para ativar ou desativar
      </p>
    </div>
  );
};

// Impressoras
type Impressora = {
  id: string;
  nome: string;
  nomeDriver: string;
  setor: "chapa" | "fritura" | "bar" | "caixa";
  ativa: boolean;
};

const SETORES: Record<
  Impressora["setor"],
  { rotulo: string; Icone: typeof Printer; cor: string }
> = {
  chapa: { rotulo: "Chapa", Icone: Flame, cor: "bg-acao/15 text-acao" },
  fritura: {
    rotulo: "Fritura",
    Icone: CookingPot,
    cor: "bg-status-aguardando/20 text-status-aguardando",
  },
  bar: {
    rotulo: "Bar",
    Icone: Beer,
    cor: "bg-status-ocupada/15 text-status-ocupada",
  },
  caixa: {
    rotulo: "Caixa",
    Icone: Receipt,
    cor: "bg-status-livre/15 text-status-livre",
  },
};

const ESTADOS: Record<string, { rotulo: string; cor: string }> = {
  pronta: { rotulo: "Pronta", cor: "bg-status-livre" },
  ocupada: { rotulo: "Imprimindo", cor: "bg-status-ocupada" },
  offline: { rotulo: "Offline", cor: "bg-destructive" },
  erro: { rotulo: "Com erro", cor: "bg-destructive" },
  desconhecido: { rotulo: "Verificando", cor: "bg-borda" },
};

export const GerenciaImpressoras = () => {
  const queryClient = useQueryClient();
  const chave = ["gerente", "impressoras"];
  const { data: impressoras, isLoading } = useQuery({
    queryKey: chave,
    queryFn: () => api<Impressora[]>("/api/gerente/impressoras"),
  });
  const { data: doSistema = [] } = useQuery({
    queryKey: ["gerente", "impressoras", "sistema"],
    queryFn: () =>
      api<{ nome: string; estado: string }[]>(
        "/api/gerente/impressoras/sistema",
      ),
  });
  const { data: fila } = useImpressao();

  // Salva na hora (sem botão Salvar), com a tela já mostrando a mudança.
  const salvar = useMutation({
    mutationFn: ({ id, ...dados }: Impressora) =>
      api(`/api/gerente/impressoras/${id}`, { method: "PATCH", json: dados }),
    onMutate: async (nova) => {
      await queryClient.cancelQueries({ queryKey: chave });
      const anterior = queryClient.getQueryData<Impressora[]>(chave);
      queryClient.setQueryData<Impressora[]>(chave, (atual) =>
        atual?.map((i) => (i.id === nova.id ? nova : i)),
      );
      return { anterior };
    },
    onSuccess: () => toast.success("Impressora salva"),
    onError: (e, _v, contexto) => {
      queryClient.setQueryData(chave, contexto?.anterior);
      toast.error(e.message);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: chave });
      queryClient.invalidateQueries({ queryKey: ["impressao"] });
    },
  });
  const testar = useMutation({
    mutationFn: (id: string) =>
      api(`/api/gerente/impressoras/${id}/teste`, { method: "POST" }),
    onSuccess: () => {
      toast.success("Ticket de teste enviado");
      queryClient.invalidateQueries({ queryKey: ["impressao"] });
    },
    onError: (e) => toast.error(e.message),
  });
  const reenviar = useMutation({
    mutationFn: () =>
      api<{ reenviados: number }>("/api/impressao/reenviar", {
        method: "POST",
      }),
    onSuccess: ({ reenviados }) => {
      toast.success(
        reenviados ? `${reenviados} ticket(s) reenviado(s)` : "Nada pendente",
      );
      queryClient.invalidateQueries({ queryKey: ["impressao"] });
    },
    onError: (e) => toast.error(e.message),
  });

  if (isLoading || !impressoras) {
    return (
      <Loader2 className="mx-auto mt-6 size-8 animate-spin text-texto-secundario" />
    );
  }

  const estadoDe = new Map(fila?.impressoras.map((i) => [i.id, i]));
  const ativas = impressoras.filter((i) => i.ativa);
  const prontas = ativas.filter((i) => {
    const e = estadoDe.get(i.id)?.estado;
    return e === "pronta" || e === "ocupada";
  }).length;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-3 gap-2">
        <Estatistica
          valor={`${prontas}/${ativas.length}`}
          rotulo="Prontas"
          cor="bg-status-livre"
        />
        <Estatistica
          valor={fila?.aguardando ?? 0}
          rotulo="Na fila"
          cor="bg-status-aguardando"
        />
        <Estatistica
          valor={fila?.falhas ?? 0}
          rotulo="Falharam"
          cor="bg-destructive"
        />
      </div>

      <ul className="grid gap-3 lg:grid-cols-2">
        {impressoras.map((impressora) => {
          const setor = SETORES[impressora.setor];
          const status = estadoDe.get(impressora.id);
          const estado = impressora.ativa
            ? (ESTADOS[status?.estado ?? "desconhecido"] ??
              ESTADOS.desconhecido)
            : { rotulo: "Desligada no sistema", cor: "bg-borda" };
          const encontrada = doSistema.some(
            (i) => i.nome === impressora.nomeDriver,
          );
          return (
            <li
              key={impressora.id}
              className={cn(
                "flex flex-col gap-3 rounded-2xl border border-borda bg-surface p-4",
                !impressora.ativa && "opacity-70",
              )}
            >
              <div className="flex items-start gap-3">
                <span
                  className={cn(
                    "flex size-12 shrink-0 items-center justify-center rounded-xl",
                    setor.cor,
                  )}
                >
                  <setor.Icone className="size-6" />
                </span>
                <div className="min-w-0 flex-1">
                  <CampoInline
                    rotulo="Nome da impressora"
                    inicial={impressora.nome}
                    exibir={impressora.nome}
                    inputMode="text"
                    onSalvar={(nome) => {
                      if (nome.length >= 2)
                        salvar.mutate({ ...impressora, nome });
                    }}
                    className="block h-8 max-w-full truncate rounded-md border border-transparent px-1 text-left font-bold text-lg"
                  />
                  <p className="flex flex-wrap items-center gap-1.5 px-1 text-sm">
                    <span className={cn("size-2.5 rounded-full", estado.cor)} />
                    {estado.rotulo}
                    <span className="text-texto-secundario">
                      · {setor.rotulo}
                    </span>
                    {(status?.pendentes ?? 0) > 0 && (
                      <span className="rounded-full bg-status-aguardando px-2 font-bold text-black text-xs">
                        {status?.pendentes} na fila
                      </span>
                    )}
                  </p>
                </div>
                <Interruptor
                  ligado={impressora.ativa}
                  rotulo={`${impressora.nome} ativa`}
                  onAlternar={() =>
                    salvar.mutate({ ...impressora, ativa: !impressora.ativa })
                  }
                />
              </div>

              {status?.motivo && impressora.ativa && (
                <p className="rounded-lg bg-destructive/10 px-3 py-2 text-destructive text-sm">
                  {status.motivo}
                </p>
              )}

              <div className="flex flex-col gap-1 text-sm">
                <span className="text-texto-secundario">
                  Impressora no Windows
                </span>
                {doSistema.length > 0 ? (
                  <select
                    aria-label={`Impressora do Windows para ${impressora.nome}`}
                    value={impressora.nomeDriver}
                    onChange={(e) =>
                      salvar.mutate({
                        ...impressora,
                        nomeDriver: e.target.value,
                      })
                    }
                    className={campo}
                  >
                    {/* A atual sempre aparece, mesmo que o Windows não a liste. */}
                    {!encontrada && (
                      <option value={impressora.nomeDriver}>
                        {impressora.nomeDriver} (não encontrada)
                      </option>
                    )}
                    {doSistema.map((i) => (
                      <option key={i.nome} value={i.nome}>
                        {i.nome}
                      </option>
                    ))}
                  </select>
                ) : (
                  <CampoInline
                    rotulo={`Nome no Windows de ${impressora.nome}`}
                    inicial={impressora.nomeDriver}
                    exibir={impressora.nomeDriver}
                    inputMode="text"
                    onSalvar={(nomeDriver) => {
                      if (nomeDriver)
                        salvar.mutate({ ...impressora, nomeDriver });
                    }}
                    className={cn(campo, "w-full truncate text-left")}
                  />
                )}
              </div>

              <Button
                variant="outline"
                disabled={!impressora.ativa || testar.isPending}
                onClick={() => testar.mutate(impressora.id)}
              >
                <Printer /> Imprimir teste
              </Button>
            </li>
          );
        })}
      </ul>

      {doSistema.length === 0 && (
        <p className="text-center text-texto-secundario text-xs">
          A lista de impressoras do Windows só aparece no PC do restaurante.
        </p>
      )}

      {fila && fila.trabalhos.length > 0 && (
        <section className="flex flex-col gap-3 rounded-2xl border border-borda bg-surface p-4">
          <header className="flex items-center gap-2">
            <ListOrdered className="size-5 text-texto-secundario" />
            <h2 className="flex-1 font-bold">Fila de impressão</h2>
            <Button
              size="sm"
              variant="acao"
              disabled={reenviar.isPending}
              onClick={() => reenviar.mutate()}
            >
              <RotateCcw /> Reenviar
            </Button>
          </header>
          <ul className="flex flex-col divide-y divide-borda">
            {fila.trabalhos.map((t) => (
              <li key={t.id} className="flex items-start gap-3 py-2 text-sm">
                <span
                  className={cn(
                    "mt-1.5 size-2.5 shrink-0 rounded-full",
                    t.status === "falhou"
                      ? "bg-destructive"
                      : "bg-status-aguardando",
                  )}
                />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">
                    Mesa {t.mesa} · rodada {t.rodada} · {t.impressora}
                    {t.tipo === "cancelamento" && " · cancelamento"}
                  </p>
                  <p className="text-texto-secundario">
                    {t.status === "falhou" ? "Falhou" : "Aguardando"}
                    {t.ultimoErro ? ` — ${t.ultimoErro}` : ""}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
};
