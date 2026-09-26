"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";

import { db } from "@/db";
import { events } from "@/db/schema";

import { slugify } from "./helpers/slug";
import { type EventFormValues, eventFormSchema } from "./schemas";

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

export const createEvent = async (input: EventFormValues) => {
  const parsed = eventFormSchema.parse(input);
  const slug = await uniqueSlugFor(parsed.name);

  await db.insert(events).values({
    name: parsed.name,
    slug,
    attraction: parsed.attraction || null,
    description: parsed.description || null,
    eventDate: parsed.eventDate,
    startTime: parsed.startTime,
    endTime: parsed.endTime || null,
    location: parsed.location,
  });

  redirect("/admin/eventos");
};
