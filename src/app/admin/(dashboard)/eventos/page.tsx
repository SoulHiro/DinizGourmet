import { desc } from "drizzle-orm";
import Link from "next/link";
import {
  formatEventDate,
  formatEventTime,
} from "@/app/eventos/helpers/format-event-date";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { db } from "@/db";
import { events } from "@/db/schema";

const EventosPage = async () => {
  const eventosData = await db.query.events.findMany({
    orderBy: desc(events.eventDate),
    with: {
      reservations: {
        columns: { partySize: true },
      },
    },
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Eventos</h1>
        <Button asChild>
          <Link href="/admin/eventos/novo">Novo evento</Link>
        </Button>
      </div>

      {eventosData.length === 0 && (
        <p className="text-muted-foreground">Nenhum evento cadastrado ainda.</p>
      )}

      <div className="flex flex-col gap-3">
        {eventosData.map((event) => {
          const totalPessoas = event.reservations.reduce(
            (acc, r) => acc + r.partySize,
            0,
          );
          return (
            <Link key={event.id} href={`/admin/eventos/${event.id}`}>
              <Card className="transition-colors hover:bg-accent">
                <CardContent className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold">{event.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {formatEventDate(event.eventDate)} •{" "}
                      {formatEventTime(event.startTime)}
                      {!event.isActive && " • encerrado"}
                    </p>
                  </div>
                  <div className="text-right text-sm">
                    <p className="font-semibold">{event.reservations.length}</p>
                    <p className="text-muted-foreground">
                      reservas ({totalPessoas} pessoas)
                    </p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
};

export default EventosPage;
