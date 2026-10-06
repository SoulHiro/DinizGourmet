"use client";

import { Bell, BellOff } from "lucide-react";
import { toast } from "sonner";

import { pedirPermissaoNotificacao, useSomAlertas } from "@/lib/avisos";

// Sino do cabeçalho: liga/desliga o som dos chamados neste celular. Ao
// ligar, toca um exemplo e pede para mostrar notificações.
export const BotaoAvisos = () => {
  const { ligado, alternar } = useSomAlertas();
  return (
    <button
      type="button"
      aria-pressed={ligado}
      aria-label={
        ligado ? "Som dos chamados ligado" : "Som dos chamados desligado"
      }
      title={ligado ? "Som dos chamados ligado" : "Som dos chamados desligado"}
      onClick={async () => {
        await alternar();
        if (!ligado) {
          const permissao = await pedirPermissaoNotificacao();
          toast.success(
            permissao === "granted"
              ? "Som e notificações ligados"
              : permissao === "sem-https"
                ? "Som ligado. Notificação com o celular bloqueado precisa do endereço https."
                : "Som ligado",
          );
        } else {
          toast("Som dos chamados desligado neste celular");
        }
      }}
      className="flex size-12 items-center justify-center"
    >
      {ligado ? <Bell /> : <BellOff className="opacity-60" />}
    </button>
  );
};
