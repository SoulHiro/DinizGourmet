"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { removeWhatsappPunctuation } from "@/app/eventos/helpers/format-event-date";
import { reservationFormSchema } from "@/app/eventos/schemas";
import { db } from "@/db";
import { eventReservations } from "@/db/schema";

interface ReservaInput {
  customerName: string;
  whatsapp: string;
  partySize: number;
}

export const createReservaAdmin = async (
  eventId: string,
  input: ReservaInput,
) => {
  const parsed = reservationFormSchema.parse(input);

  await db.insert(eventReservations).values({
    eventId,
    customerName: parsed.customerName,
    whatsapp: removeWhatsappPunctuation(parsed.whatsapp),
    partySize: parsed.partySize,
  });

  revalidatePath(`/admin/eventos/${eventId}`);
};

export const updateReserva = async (
  reservaId: string,
  eventId: string,
  input: ReservaInput,
) => {
  const parsed = reservationFormSchema.parse(input);

  await db
    .update(eventReservations)
    .set({
      customerName: parsed.customerName,
      whatsapp: removeWhatsappPunctuation(parsed.whatsapp),
      partySize: parsed.partySize,
    })
    .where(eq(eventReservations.id, reservaId));

  revalidatePath(`/admin/eventos/${eventId}`);
};

export const deleteReserva = async (reservaId: string, eventId: string) => {
  await db.delete(eventReservations).where(eq(eventReservations.id, reservaId));

  revalidatePath(`/admin/eventos/${eventId}`);
};
