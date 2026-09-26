"use client";

import { Loader2Icon, Trash2Icon } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

import { deleteReserva } from "../../reservas-actions";
import { ReservaFormSheet } from "./reserva-form-sheet";

interface Reserva {
  id: string;
  customerName: string;
  whatsapp: string;
  partySize: number;
}

interface ReservasTableProps {
  eventId: string;
  reservas: Reserva[];
}

export const ReservasTable = ({ eventId, reservas }: ReservasTableProps) => {
  const [isPending, startTransition] = useTransition();

  const handleDelete = (reservaId: string) => {
    if (!window.confirm("Cancelar esta reserva?")) return;

    startTransition(async () => {
      try {
        await deleteReserva(reservaId, eventId);
        toast.success("Reserva cancelada.");
      } catch {
        toast.error("Não foi possível cancelar a reserva.");
      }
    });
  };

  if (reservas.length === 0) {
    return <p className="text-muted-foreground">Nenhuma reserva ainda.</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      {reservas.map((reserva) => (
        <Card key={reserva.id}>
          <CardContent className="flex items-center justify-between gap-4">
            <div>
              <p className="font-medium">{reserva.customerName}</p>
              <p className="text-sm text-muted-foreground">
                {reserva.whatsapp}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <p className="text-sm font-medium">
                {reserva.partySize}{" "}
                {reserva.partySize === 1 ? "pessoa" : "pessoas"}
              </p>
              <ReservaFormSheet
                eventId={eventId}
                reserva={reserva}
                trigger={
                  <Button variant="outline" size="sm">
                    Editar
                  </Button>
                }
              />
              <Button
                variant="ghost"
                size="sm"
                disabled={isPending}
                onClick={() => handleDelete(reserva.id)}
              >
                {isPending ? (
                  <Loader2Icon className="size-4 animate-spin" />
                ) : (
                  <Trash2Icon className="size-4" />
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};
