import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";

import { db } from "@/db";
import { events } from "@/db/schema";

import { EventForm } from "../../_components/event-form";

const EditarEventoPage = async ({
  params,
}: {
  params: Promise<{ id: string }>;
}) => {
  const { id } = await params;
  const evento = await db.query.events.findFirst({ where: eq(events.id, id) });

  if (!evento) {
    notFound();
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Editar evento</h1>
      <EventForm evento={evento} />
    </div>
  );
};

export default EditarEventoPage;
