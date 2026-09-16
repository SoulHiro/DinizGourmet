"use server";

import { eq } from "drizzle-orm";

import { db } from "@/db";
import { eventReservations, events } from "@/db/schema";

import { removeWhatsappPunctuation } from "../helpers/format-event-date";
import { reservationFormSchema } from "../schemas";

interface CreateReservationInput {
  eventId: string;
  customerName: string;
  whatsapp: string;
  partySize: number;
}

export const createReservation = async (input: CreateReservationInput) => {
  const parsed = reservationFormSchema.parse({
    customerName: input.customerName,
    whatsapp: input.whatsapp,
    partySize: input.partySize,
  });

  const event = await db.query.events.findFirst({
    where: eq(events.id, input.eventId),
    columns: { id: true, isActive: true },
  });

  if (!event || !event.isActive) {
    throw new Error(
      "Este evento não está mais recebendo reservas. Tente falar direto com o restaurante.",
    );
  }

  await db.insert(eventReservations).values({
    eventId: input.eventId,
    customerName: parsed.customerName,
    whatsapp: removeWhatsappPunctuation(parsed.whatsapp),
    partySize: parsed.partySize,
  });
};
