import type { StatusMesa } from "@/lib/dominio/mesas";

// Cor + rótulo: o status nunca depende só da cor para ser entendido.
export const STATUS_MESA: Record<
  StatusMesa,
  { rotulo: string; classe: string }
> = {
  livre: { rotulo: "Livre", classe: "bg-status-livre text-white" },
  ocupada: { rotulo: "Ocupada", classe: "bg-status-ocupada text-white" },
  aguardando: {
    rotulo: "Aguardando pedido",
    classe: "bg-status-aguardando text-black",
  },
  chamado: { rotulo: "Chamou garçom", classe: "bg-status-chamado text-black" },
  conta: { rotulo: "Pediu a conta", classe: "bg-status-conta text-white" },
};
