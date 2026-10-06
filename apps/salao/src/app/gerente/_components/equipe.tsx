"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  KeyRound,
  Loader2,
  LockOpen,
  LogOut,
  Plus,
  UserPlus,
  X,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { useFuncionario } from "@/components/providers/sessao";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/cliente";
import { cn } from "@/lib/utils";
import { Estatistica } from "./cadastros";
import { CampoInline, Interruptor, MenuAcoes } from "./campos";

type Papel = "garcom" | "gerente" | "caixa";
type Funcionario = {
  id: string;
  nome: string;
  papel: Papel;
  ativo: boolean;
  bloqueadoAte: string | null;
  conectado: boolean;
  ultimoAcesso: string | null;
};

const PAPEIS: Record<Papel, { rotulo: string; plural: string; cor: string }> = {
  garcom: {
    rotulo: "Garçom",
    plural: "Garçons",
    cor: "bg-status-ocupada text-white",
  },
  caixa: {
    rotulo: "Caixa",
    plural: "Caixa",
    cor: "bg-status-livre text-white",
  },
  gerente: {
    rotulo: "Gerente",
    plural: "Gerentes",
    cor: "bg-marca text-marca-foreground",
  },
};

const CHAVE = ["gerente", "equipe"];

const iniciais = (nome: string) =>
  nome
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");

const haQuanto = (iso: string | null) => {
  if (!iso) return "Nunca entrou";
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (min < 60) return `Entrou há ${Math.max(min, 1)} min`;
  const horas = Math.round(min / 60);
  if (horas < 24) return `Entrou há ${horas}h`;
  const dias = Math.round(horas / 24);
  return `Entrou há ${dias} ${dias === 1 ? "dia" : "dias"}`;
};

// Campo de PIN: 4 números, escondidos, teclado numérico.
const CampoPin = ({
  valor,
  onMudar,
  rotulo,
  autoFoco,
}: {
  valor: string;
  onMudar: (v: string) => void;
  rotulo: string;
  autoFoco?: boolean;
}) => (
  <input
    // biome-ignore lint/a11y/noAutofocus: aparece depois do toque em "Trocar PIN"
    autoFocus={autoFoco}
    type="password"
    inputMode="numeric"
    autoComplete="off"
    maxLength={4}
    aria-label={rotulo}
    placeholder="••••"
    value={valor}
    onChange={(e) => onMudar(e.target.value.replace(/\D/g, "").slice(0, 4))}
    className="h-12 w-24 rounded-lg border border-borda bg-fundo px-3 text-center font-bold text-xl tracking-[0.4em]"
  />
);

export const GerenciaEquipe = () => {
  const eu = useFuncionario();
  const queryClient = useQueryClient();
  const { data: equipe, isLoading } = useQuery({
    queryKey: CHAVE,
    queryFn: () => api<Funcionario[]>("/api/gerente/equipe"),
    refetchInterval: 30_000,
  });
  const [filtro, setFiltro] = useState<Papel | "todos">("todos");
  const [trocandoPin, setTrocandoPin] = useState<string | null>(null);
  const [pin, setPin] = useState("");
  const [novo, setNovo] = useState<{
    nome: string;
    papel: Papel;
    pin: string;
  } | null>(null);

  const editar = useMutation({
    mutationFn: ({
      id,
      ...json
    }: {
      id: string;
      nome?: string;
      papel?: Papel;
      ativo?: boolean;
      pin?: string;
      desbloquear?: true;
      desconectar?: true;
    }) => api(`/api/gerente/equipe/${id}`, { method: "PATCH", json }),
    onMutate: async ({ id, pin: _pin, desbloquear, desconectar, ...dados }) => {
      await queryClient.cancelQueries({ queryKey: CHAVE });
      const anterior = queryClient.getQueryData<Funcionario[]>(CHAVE);
      queryClient.setQueryData<Funcionario[]>(CHAVE, (atual) =>
        atual?.map((f) =>
          f.id === id
            ? {
                ...f,
                ...dados,
                ...(desbloquear ? { bloqueadoAte: null } : {}),
                ...(desconectar ? { conectado: false } : {}),
              }
            : f,
        ),
      );
      return { anterior };
    },
    onSuccess: (_r, v) => {
      if (v.pin) toast.success("PIN trocado");
      if (v.desbloquear) toast.success("Desbloqueado");
      if (v.desconectar) toast.success("Desconectado de todos os aparelhos");
      if (v.papel) toast.success("Papel trocado. Ele precisa entrar de novo.");
    },
    onError: (e, _v, contexto) => {
      queryClient.setQueryData(CHAVE, contexto?.anterior);
      toast.error(e.message);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: CHAVE }),
  });

  const criar = useMutation({
    mutationFn: () => {
      if (!novo || novo.nome.trim().length < 2)
        throw new Error("Informe o nome");
      if (!/^\d{4}$/.test(novo.pin))
        throw new Error("O PIN precisa ter 4 números");
      return api("/api/gerente/equipe", {
        method: "POST",
        json: { ...novo, nome: novo.nome.trim() },
      });
    },
    onSuccess: () => {
      toast.success(`${novo?.nome.trim()} cadastrado`);
      setNovo(null);
      queryClient.invalidateQueries({ queryKey: CHAVE });
    },
    onError: (e) => toast.error(e.message),
  });

  if (isLoading || !equipe) {
    return (
      <Loader2 className="mx-auto mt-6 size-8 animate-spin text-texto-secundario" />
    );
  }

  const bloqueado = (f: Funcionario) =>
    Boolean(f.bloqueadoAte && new Date(f.bloqueadoAte) > new Date());
  const visiveis = equipe.filter(
    (f) => filtro === "todos" || f.papel === filtro,
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-3 gap-2">
        <Estatistica
          valor={equipe.filter((f) => f.conectado).length}
          rotulo="Conectados agora"
          cor="bg-status-livre"
        />
        <Estatistica
          valor={equipe.filter((f) => f.ativo).length}
          rotulo="Ativos"
          cor="bg-status-ocupada"
        />
        <Estatistica
          valor={equipe.filter(bloqueado).length}
          rotulo="Bloqueados"
          cor="bg-destructive"
        />
      </div>

      <div className="-mx-3 flex gap-2 overflow-x-auto px-3 [scrollbar-width:none]">
        {(["todos", "garcom", "caixa", "gerente"] as const).map((p) => (
          <button
            key={p}
            type="button"
            aria-pressed={filtro === p}
            onClick={() => setFiltro(p)}
            className={cn(
              "flex h-10 shrink-0 items-center gap-2 rounded-full border px-3 font-semibold text-sm",
              filtro === p
                ? "border-texto bg-texto text-fundo"
                : "border-borda bg-surface",
            )}
          >
            {p === "todos" ? "Todos" : PAPEIS[p].plural}
            <span className="tabular-nums opacity-70">
              {p === "todos"
                ? equipe.length
                : equipe.filter((f) => f.papel === p).length}
            </span>
          </button>
        ))}
      </div>

      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {visiveis.map((f) => {
          const souEu = f.id === eu.id;
          const travado = bloqueado(f);
          return (
            <li
              key={f.id}
              className={cn(
                "flex flex-col gap-3 rounded-2xl border bg-surface p-4",
                travado ? "border-destructive" : "border-borda",
                !f.ativo && "opacity-60",
              )}
            >
              <div className="flex items-start gap-3">
                <span className="relative shrink-0">
                  <span
                    className={cn(
                      "flex size-12 items-center justify-center rounded-full font-bold",
                      PAPEIS[f.papel].cor,
                    )}
                  >
                    {iniciais(f.nome)}
                  </span>
                  {f.conectado && (
                    <span
                      title="Conectado agora"
                      className="absolute right-0 bottom-0 size-3.5 rounded-full border-2 border-surface bg-status-livre"
                    />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <CampoInline
                    rotulo={`Nome de ${f.nome}`}
                    inicial={f.nome}
                    exibir={
                      <>
                        {f.nome}
                        {souEu && (
                          <span className="ml-1.5 font-normal text-texto-secundario text-xs">
                            (você)
                          </span>
                        )}
                      </>
                    }
                    inputMode="text"
                    onSalvar={(nome) => {
                      if (nome.length >= 2) editar.mutate({ id: f.id, nome });
                    }}
                    className="block h-8 max-w-full truncate rounded-md border border-transparent px-1 text-left font-bold"
                  />
                  <p className="px-1 text-sm text-texto-secundario">
                    {f.conectado ? "Conectado agora" : haQuanto(f.ultimoAcesso)}
                  </p>
                </div>
                <Interruptor
                  ligado={f.ativo}
                  rotulo={`${f.nome} ativo`}
                  onAlternar={() =>
                    souEu
                      ? toast.error("Você não pode se desativar.")
                      : editar.mutate({ id: f.id, ativo: !f.ativo })
                  }
                />
              </div>

              <fieldset className="grid grid-cols-3 rounded-lg border border-borda bg-fundo p-1">
                <legend className="sr-only">Papel de {f.nome}</legend>
                {(Object.keys(PAPEIS) as Papel[]).map((p) => (
                  <button
                    key={p}
                    type="button"
                    aria-pressed={f.papel === p}
                    disabled={souEu && p !== "gerente"}
                    onClick={() =>
                      f.papel !== p && editar.mutate({ id: f.id, papel: p })
                    }
                    className={cn(
                      "h-9 rounded-md font-semibold text-sm disabled:opacity-40",
                      f.papel === p
                        ? "bg-acao text-acao-foreground"
                        : "text-texto-secundario",
                    )}
                  >
                    {PAPEIS[p].rotulo}
                  </button>
                ))}
              </fieldset>

              {travado && (
                <div className="flex items-center justify-between gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-destructive text-sm">
                  Bloqueado por errar o PIN
                  <Button
                    size="sm"
                    variant="destrutivo"
                    onClick={() =>
                      editar.mutate({ id: f.id, desbloquear: true })
                    }
                  >
                    <LockOpen /> Desbloquear
                  </Button>
                </div>
              )}

              {trocandoPin === f.id ? (
                <form
                  className="flex items-center gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!/^\d{4}$/.test(pin)) {
                      toast.error("O PIN precisa ter 4 números");
                      return;
                    }
                    editar.mutate({ id: f.id, pin });
                    setTrocandoPin(null);
                    setPin("");
                  }}
                >
                  <CampoPin
                    autoFoco
                    rotulo={`Novo PIN de ${f.nome}`}
                    valor={pin}
                    onMudar={setPin}
                  />
                  <Button
                    type="submit"
                    variant="acao"
                    className="flex-1"
                    disabled={pin.length !== 4}
                  >
                    Salvar PIN
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    aria-label="Cancelar"
                    onClick={() => {
                      setTrocandoPin(null);
                      setPin("");
                    }}
                  >
                    <X />
                  </Button>
                </form>
              ) : (
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => {
                      setPin("");
                      setTrocandoPin(f.id);
                    }}
                  >
                    <KeyRound /> Trocar PIN
                  </Button>
                  {!souEu && (
                    <MenuAcoes
                      rotulo={`Mais ações de ${f.nome}`}
                      acoes={[
                        {
                          rotulo: "Desconectar dos aparelhos",
                          Icone: LogOut,
                          desabilitado: !f.conectado,
                          onClick: () =>
                            editar.mutate({ id: f.id, desconectar: true }),
                        },
                      ]}
                    />
                  )}
                </div>
              )}
            </li>
          );
        })}

        <li>
          {novo ? (
            <form
              className="flex h-full flex-col gap-3 rounded-2xl border-2 border-acao bg-surface p-4"
              onSubmit={(e) => {
                e.preventDefault();
                criar.mutate();
              }}
            >
              <div className="flex items-center justify-between">
                <p className="font-bold">Novo funcionário</p>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  aria-label="Cancelar"
                  onClick={() => setNovo(null)}
                >
                  <X />
                </Button>
              </div>
              <input
                // biome-ignore lint/a11y/noAutofocus: aparece depois do toque em "Novo funcionário"
                autoFocus
                aria-label="Nome"
                placeholder="Nome"
                value={novo.nome}
                onChange={(e) => setNovo({ ...novo, nome: e.target.value })}
                className="h-12 rounded-lg border border-borda bg-fundo px-3"
              />
              <fieldset className="grid grid-cols-3 rounded-lg border border-borda bg-fundo p-1">
                <legend className="sr-only">Papel</legend>
                {(Object.keys(PAPEIS) as Papel[]).map((p) => (
                  <button
                    key={p}
                    type="button"
                    aria-pressed={novo.papel === p}
                    onClick={() => setNovo({ ...novo, papel: p })}
                    className={cn(
                      "h-9 rounded-md font-semibold text-sm",
                      novo.papel === p
                        ? "bg-acao text-acao-foreground"
                        : "text-texto-secundario",
                    )}
                  >
                    {PAPEIS[p].rotulo}
                  </button>
                ))}
              </fieldset>
              <div className="flex items-center gap-2">
                <CampoPin
                  rotulo="PIN de 4 números"
                  valor={novo.pin}
                  onMudar={(v) => setNovo({ ...novo, pin: v })}
                />
                <Button
                  type="submit"
                  variant="acao"
                  className="flex-1"
                  disabled={criar.isPending}
                >
                  {criar.isPending ? (
                    <Loader2 className="animate-spin" />
                  ) : (
                    <Plus />
                  )}
                  Cadastrar
                </Button>
              </div>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => setNovo({ nome: "", papel: "garcom", pin: "" })}
              className="flex h-full min-h-40 w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-borda border-dashed font-semibold text-texto-secundario hover:border-acao hover:text-texto"
            >
              <UserPlus className="size-6" />
              Novo funcionário
            </button>
          )}
        </li>
      </ul>
    </div>
  );
};
