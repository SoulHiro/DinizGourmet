import { desc, eq } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";

import {
  formatEventDate,
  formatEventTime,
} from "@/app/eventos/helpers/format-event-date";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { db } from "@/db";
import { eventReservations, events } from "@/db/schema";

import { ReservaFormSheet } from "./_components/reserva-form-sheet";
import { ReservasTable } from "./_components/reservas-table";

interface EventoDetailPageProps {
  params: Promise<{ id: string }>;
}

const EventoDetailPage = async ({ params }: EventoDetailPageProps) => {
  const { id } = await params;

  const event = await db.query.events.findFirst({
    where: eq(events.id, id),
  });

  if (!event) {
    notFound();
  }

  const reservas = await db.query.eventReservations.findMany({
    where: eq(eventReservations.eventId, id),
    orderBy: desc(eventReservations.createdAt),
  });

  const totalPessoas = reservas.reduce((acc, r) => acc + r.partySize, 0);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{event.name}</h1>
          <p className="text-muted-foreground">
            {formatEventDate(event.eventDate)} •{" "}
            {formatEventTime(event.startTime)}
            {event.attraction && ` • ${event.attraction}`}
          </p>
        </div>

        <div className="flex flex-wrap justify-end gap-2">
          <Button asChild variant="ghost">
            <Link href={`/eventos/${event.slug}`} target="_blank">
              Ver página
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href={`/admin/eventos/${event.id}/editar`}>Editar</Link>
          </Button>
          <ReservaFormSheet
            eventId={event.id}
            trigger={<Button>Nova reserva</Button>}
          />
        </div>
      </div>

      <Card>
        <CardContent className="flex gap-8">
          <div>
            <p className="text-2xl font-semibold">{totalPessoas}</p>
            <p className="text-sm text-muted-foreground">pessoas totais</p>
          </div>
          <div>
            <p className="text-2xl font-semibold">{reservas.length}</p>
            <p className="text-sm text-muted-foreground">mesas reservadas</p>
          </div>
        </CardContent>
      </Card>

      <ReservasTable eventId={event.id} reservas={reservas} />
    </div>
  );
};

export default EventoDetailPage;
