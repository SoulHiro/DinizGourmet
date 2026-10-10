"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { db } from "@/db";
import { events } from "@/db/schema";
import { exigirAdmin } from "@/lib/admin-auth";

import { slugify } from "./helpers/slug";
import { type EventFormValues, eventFormSchema, listaDeTexto } from "./schemas";

const uniqueSlugFor = async (name: string) => {
  const base = slugify(name);
  let candidate = base;
  let attempt = 1;

  while (
    await db.query.events.findFirst({ where: eq(events.slug, candidate) })
  ) {
    attempt += 1;
    candidate = `${base}-${attempt}`;
  }

  return candidate;
};

const valoresDoForm = (input: EventFormValues) => {
  const parsed = eventFormSchema.parse(input);
  return {
    name: parsed.name,
    attraction: parsed.attraction || null,
    description: parsed.description || null,
    eventDate: parsed.eventDate,
    startTime: parsed.startTime,
    endTime: parsed.endTime || null,
    location: parsed.location,
    posterUrl: parsed.posterUrl || null,
    genres: listaDeTexto(parsed.genres),
    highlights: listaDeTexto(parsed.highlights),
    isActive: parsed.isActive,
  };
};

// Agenda, home (próximo evento) e a própria página do evento.
const revalidarPublico = (slug?: string) => {
  revalidatePath("/");
  revalidatePath("/eventos");
  if (slug) revalidatePath(`/eventos/${slug}`);
};

export const createEvent = async (input: EventFormValues) => {
  await exigirAdmin();
  const valores = valoresDoForm(input);
  const slug = await uniqueSlugFor(valores.attraction || valores.name);

  await db.insert(events).values({ ...valores, slug });

  revalidarPublico(slug);
  redirect("/admin/eventos");
};

// O slug não muda na edição: o link do evento já pode ter sido divulgado.
export const updateEvent = async (id: string, input: EventFormValues) => {
  await exigirAdmin();
  const valores = valoresDoForm(input);

  const [atualizado] = await db
    .update(events)
    .set({ ...valores, updatedAt: new Date() })
    .where(eq(events.id, id))
    .returning({ slug: events.slug });

  if (!atualizado) {
    throw new Error("Evento não encontrado.");
  }

  revalidarPublico(atualizado.slug);
  redirect(`/admin/eventos/${id}`);
};
