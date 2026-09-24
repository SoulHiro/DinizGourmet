"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { KeyRound, Plus, Printer } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { api } from "@/lib/cliente";
import { cn } from "@/lib/utils";

const campo = "h-12 rounded-lg border border-borda bg-surface px-3";

const useMutacao = <T,>(
  fn: (dados: T) => Promise<unknown>,
  chave: string[],
  sucesso?: string,
) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: chave });
      queryClient.invalidateQueries({ queryKey: ["mesas"] });
      if (sucesso) toast.success(sucesso);
    },
    onError: (e) => toast.error(e.message),
  });
};

// Mesas
type Mesa = { id: string; numero: number; ativa: boolean };

export const GerenciaMesas = () => {
  const { data: mesas } = useQuery({
    queryKey: ["gerente", "mesas"],
    queryFn: () => api<Mesa[]>("/api/gerente/mesas"),
  });
  const [numero, setNumero] = useState("");
  const chave = ["gerente", "mesas"];

  const criar = useMutacao(
    (n: number) =>
      api("/api/gerente/mesas", { method: "POST", json: { numero: n } }),
    chave,
    "Mesa criada",
  );
  const alternar = useMutacao(
    (m: Mesa) =>
      api(`/api/gerente/mesas/${m.id}`, {
        method: "PATCH",
        json: { ativa: !m.ativa },
      }),
    chave,
  );

  return (
    <div className="flex flex-col gap-4">
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const n = Number.parseInt(numero, 10);
          if (n > 0) criar.mutate(n, { onSuccess: () => setNumero("") });
        }}
      >
        <input
          inputMode="numeric"
          placeholder="Número da mesa"
          value={numero}
          onChange={(e) => setNumero(e.target.value)}
          className={cn(campo, "flex-1")}
        />
        <Button variant="acao" type="submit" disabled={criar.isPending}>
          <Plus /> Mesa
        </Button>
      </form>
      <p className="text-sm text-texto-secundario">
        Toque numa mesa para ativar/desativar.
      </p>
      <div className="grid grid-cols-5 gap-2 sm:grid-cols-8">
        {mesas?.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => alternar.mutate(m)}
            className={cn(
              "aspect-square rounded-lg border-2 font-bold text-xl",
              m.ativa
                ? "border-status-livre text-status-livre"
                : "border-borda text-texto-secundario line-through",
            )}
          >
            {m.numero}
          </button>
        ))}
      </div>
    </div>
  );
};

// Equipe
type Funcionario = {
  id: string;
  nome: string;
  papel: "garcom" | "gerente" | "caixa";
  ativo: boolean;
  bloqueadoAte: string | null;
};

const PAPEIS = {
  garcom: "Garçom",
  gerente: "Gerente",
  caixa: "Caixa",
} as const;

const pedirPin = (mensagem: string) => {
  const pin = window.prompt(mensagem);
  if (pin === null) return null;
  if (!/^\d{4}$/.test(pin)) {
    toast.error("O PIN precisa ter exatamente 4 números.");
    return null;
  }
  return pin;
};

export const GerenciaEquipe = () => {
  const { data: equipe } = useQuery({
    queryKey: ["gerente", "equipe"],
    queryFn: () => api<Funcionario[]>("/api/gerente/equipe"),
  });
  const [novo, setNovo] = useState({
    nome: "",
    papel: "garcom" as Funcionario["papel"],
  });
  const chave = ["gerente", "equipe"];

  const criar = useMutacao(
    (dados: { nome: string; papel: string; pin: string }) =>
      api("/api/gerente/equipe", { method: "POST", json: dados }),
    chave,
    "Funcionário cadastrado",
  );
  const editar = useMutacao(
    ({ id, ...dados }: { id: string; ativo?: boolean; pin?: string }) =>
      api(`/api/gerente/equipe/${id}`, { method: "PATCH", json: dados }),
    chave,
    "Salvo",
  );

  return (
    <div className="flex flex-col gap-4">
      <form
        className="flex flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (novo.nome.trim().length < 2) return;
          const pin = pedirPin(`PIN de 4 números para ${novo.nome}`);
          if (pin) {
            criar.mutate(
              { ...novo, pin },
              { onSuccess: () => setNovo({ nome: "", papel: "garcom" }) },
            );
          }
        }}
      >
        <input
          placeholder="Nome"
          value={novo.nome}
          onChange={(e) => setNovo({ ...novo, nome: e.target.value })}
          className={cn(campo, "min-w-40 flex-1")}
        />
        <select
          value={novo.papel}
          onChange={(e) =>
            setNovo({ ...novo, papel: e.target.value as Funcionario["papel"] })
          }
          className={campo}
        >
          {Object.entries(PAPEIS).map(([valor, rotulo]) => (
            <option key={valor} value={valor}>
              {rotulo}
            </option>
          ))}
        </select>
        <Button variant="acao" type="submit" disabled={criar.isPending}>
          <Plus /> Cadastrar
        </Button>
      </form>

      <ul className="flex flex-col gap-2">
        {equipe?.map((f) => {
          const bloqueado =
            f.bloqueadoAte && new Date(f.bloqueadoAte) > new Date();
          return (
            <li
              key={f.id}
              className="flex flex-wrap items-center gap-2 rounded-xl border border-borda bg-surface p-3"
            >
              <div className="flex-1">
                <p
                  className={cn(
                    "font-semibold",
                    !f.ativo && "text-texto-secundario line-through",
                  )}
                >
                  {f.nome}
                </p>
                <p className="text-sm text-texto-secundario">
                  {PAPEIS[f.papel]}
                  {bloqueado && " · bloqueado por PIN errado"}
                </p>
              </div>
              <Button
                onClick={() => {
                  const pin = pedirPin(`Novo PIN para ${f.nome}`);
                  if (pin) editar.mutate({ id: f.id, pin });
                }}
              >
                <KeyRound /> PIN
              </Button>
              <Button
                variant={f.ativo ? "outline" : "destrutivo"}
                onClick={() => editar.mutate({ id: f.id, ativo: !f.ativo })}
              >
                {f.ativo ? "Ativo" : "Inativo"}
              </Button>
            </li>
          );
        })}
      </ul>
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

export const GerenciaImpressoras = () => {
  const { data: impressoras } = useQuery({
    queryKey: ["gerente", "impressoras"],
    queryFn: () => api<Impressora[]>("/api/gerente/impressoras"),
  });
  const { data: doSistema } = useQuery({
    queryKey: ["gerente", "impressoras", "sistema"],
    queryFn: () =>
      api<{ nome: string; estado: string }[]>(
        "/api/gerente/impressoras/sistema",
      ),
  });
  const chave = ["gerente", "impressoras"];

  const salvar = useMutacao(
    ({ id, ...dados }: Impressora) =>
      api(`/api/gerente/impressoras/${id}`, { method: "PATCH", json: dados }),
    chave,
    "Impressora salva",
  );
  const testar = useMutacao(
    (id: string) =>
      api(`/api/gerente/impressoras/${id}/teste`, { method: "POST" }),
    ["impressao"],
    "Ticket de teste enviado",
  );

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-texto-secundario">
        O &quot;nome no Windows&quot; precisa ser idêntico ao que aparece em
        Configurações &gt; Impressoras.
        {doSistema && doSistema.length > 0
          ? " Escolha na lista abaixo."
          : " (Lista automática disponível só no PC do restaurante.)"}
      </p>
      <datalist id="impressoras-sistema">
        {doSistema?.map((i) => (
          <option key={i.nome} value={i.nome} />
        ))}
      </datalist>
      {impressoras?.map((impressora) => (
        <form
          key={impressora.id}
          className="flex flex-col gap-2 rounded-xl border border-borda bg-surface p-3"
          onSubmit={(e) => {
            e.preventDefault();
            const dados = new FormData(e.currentTarget);
            salvar.mutate({
              ...impressora,
              nome: String(dados.get("nome")),
              nomeDriver: String(dados.get("nomeDriver")),
              ativa: dados.get("ativa") === "on",
            });
          }}
        >
          <div className="flex items-center gap-2">
            <Printer className="text-marca" />
            <input
              name="nome"
              defaultValue={impressora.nome}
              className={cn(campo, "flex-1 font-semibold")}
            />
            <span className="rounded-full bg-borda px-3 py-1 text-sm capitalize">
              {impressora.setor}
            </span>
          </div>
          <label className="flex flex-col gap-1 text-sm">
            Nome no Windows
            <input
              name="nomeDriver"
              list="impressoras-sistema"
              defaultValue={impressora.nomeDriver}
              className={campo}
            />
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex flex-1 items-center gap-2">
              <input
                type="checkbox"
                name="ativa"
                defaultChecked={impressora.ativa}
                className="size-5"
              />
              Ativa
            </label>
            <Button type="button" onClick={() => testar.mutate(impressora.id)}>
              Imprimir teste
            </Button>
            <Button variant="acao" type="submit" disabled={salvar.isPending}>
              Salvar
            </Button>
          </div>
        </form>
      ))}
    </div>
  );
};
