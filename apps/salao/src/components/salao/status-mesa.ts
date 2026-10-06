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

// Mesa ocupada sem pedido novo há tanto tempo pode estar esperando alguém
// (garçom e caixa usam o mesmo critério).
export const MINUTOS_PARADA = 40;

export const mesaParada = (
  mesa: {
    status: StatusMesa;
    ultimaRodadaEm: string | null;
    abertaEm: string | null;
  },
  agora: number,
) => {
  if (mesa.status !== "ocupada" && mesa.status !== "aguardando") return false;
  const desde = mesa.ultimaRodadaEm ?? mesa.abertaEm;
  if (!desde) return false;
  return (agora - new Date(desde).getTime()) / 60_000 >= MINUTOS_PARADA;
};
