"use client";

import { useQuery } from "@tanstack/react-query";
import { Delete, Loader2, UserRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { api, ErroApi } from "@/lib/cliente";
import { cn } from "@/lib/utils";

type Funcionario = { id: string; nome: string; papel: string };

const TECLAS = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];

export default function LoginPage() {
  const router = useRouter();
  const [selecionado, setSelecionado] = useState<Funcionario | null>(null);
  const [pin, setPin] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const { data: funcionarios, isLoading } = useQuery({
    queryKey: ["login", "funcionarios"],
    queryFn: () => api<Funcionario[]>("/api/auth/funcionarios"),
  });

  const entrar = async (pinCompleto: string) => {
    if (!selecionado) return;
    setEnviando(true);
    setErro(null);
    try {
      const { funcionario } = await api<{ funcionario: Funcionario }>(
        "/api/auth/login",
        {
          method: "POST",
          json: { funcionarioId: selecionado.id, pin: pinCompleto },
        },
      );
      router.replace(funcionario.papel === "gerente" ? "/gerente" : "/garcom");
    } catch (error) {
      setPin("");
      if (error instanceof ErroApi && error.codigo === "pin_incorreto") {
        const restantes = (error.detalhes as { restantes?: number })?.restantes;
        setErro(
          restantes
            ? `PIN incorreto. ${restantes} tentativa(s) antes do bloqueio.`
            : error.message,
        );
      } else {
        setErro(
          error instanceof Error ? error.message : "Não foi possível entrar.",
        );
      }
    } finally {
      setEnviando(false);
    }
  };

  const digitar = (digito: string) => {
    if (enviando || pin.length >= 4) return;
    const novo = pin + digito;
    setPin(novo);
    setErro(null);
    if (novo.length === 4) void entrar(novo);
  };

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))]">
      <header className="py-6 text-center">
        <p className="font-bold text-2xl text-marca">Xis Diniz</p>
        <p className="text-texto-secundario">Painel do garçom</p>
      </header>

      {!selecionado ? (
        <section className="flex flex-1 flex-col gap-3">
          <h1 className="font-semibold text-lg">Quem é você?</h1>
          {isLoading && (
            <Loader2 className="mx-auto size-8 animate-spin text-texto-secundario" />
          )}
          <div className="grid grid-cols-2 gap-3">
            {funcionarios?.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setSelecionado(f)}
                className="flex min-h-20 flex-col items-center justify-center gap-1 rounded-xl border border-borda bg-surface p-3 font-semibold text-lg active:scale-[0.97]"
              >
                <UserRound className="size-6 text-marca" />
                {f.nome}
              </button>
            ))}
          </div>
        </section>
      ) : (
        <section className="flex flex-1 flex-col items-center gap-6">
          <div className="text-center">
            <p className="text-texto-secundario">Olá,</p>
            <p className="font-bold text-2xl">{selecionado.nome}</p>
          </div>

          <div
            className="flex gap-4"
            role="status"
            aria-label={`${pin.length} de 4 dígitos do PIN`}
          >
            {[0, 1, 2, 3].map((i) => (
              <span
                key={i}
                className={cn(
                  "size-5 rounded-full border-2 border-marca",
                  i < pin.length && "bg-marca",
                )}
              />
            ))}
          </div>

          <p
            className="min-h-6 text-center font-medium text-destructive"
            role="alert"
          >
            {erro}
          </p>

          <div className="grid w-full max-w-xs grid-cols-3 gap-3">
            {TECLAS.map((tecla) => (
              <Button
                key={tecla}
                size="lg"
                className="h-16 text-2xl"
                onClick={() => digitar(tecla)}
              >
                {tecla}
              </Button>
            ))}
            <Button
              variant="ghost"
              size="lg"
              className="h-16"
              onClick={() => {
                setSelecionado(null);
                setPin("");
                setErro(null);
              }}
            >
              Voltar
            </Button>
            <Button
              size="lg"
              className="h-16 text-2xl"
              onClick={() => digitar("0")}
            >
              0
            </Button>
            <Button
              variant="ghost"
              size="lg"
              className="h-16"
              aria-label="Apagar"
              onClick={() => setPin((p) => p.slice(0, -1))}
            >
              {enviando ? <Loader2 className="animate-spin" /> : <Delete />}
            </Button>
          </div>
        </section>
      )}
    </main>
  );
}
