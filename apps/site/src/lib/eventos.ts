import { asc } from "drizzle-orm";

import { db } from "@/db";
import { events } from "@/db/schema";

import { hojeISO } from "./datas-evento";

export * from "./datas-evento";

export const listarEventos = async () => {
  const todos = await db.query.events.findMany({
    orderBy: asc(events.eventDate),
  });
  const hoje = hojeISO();
  return {
    todos,
    futuros: todos.filter((e) => e.eventDate >= hoje),
    passados: todos.filter((e) => e.eventDate < hoje).reverse(),
  };
};
