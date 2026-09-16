"use client";

import { CalendarIcon, ClockIcon, MapPinIcon, Mic2Icon } from "lucide-react";

import { Reveal, RevealItem } from "@/app/eventos/_components/reveal";
import type { events } from "@/db/schema";

import {
  formatEventDate,
  formatEventTime,
} from "../../helpers/format-event-date";
import { useReservationDrawer } from "./reservation-drawer";

interface EventInfoProps {
  event: typeof events.$inferSelect;
}

export const EventInfo = ({ event }: EventInfoProps) => {
  const { open } = useReservationDrawer();

  const facts = [
    { label: "Quem", value: event.attraction || event.name, icon: Mic2Icon },
    {
      label: "Quando",
      value: formatEventDate(event.eventDate),
      icon: CalendarIcon,
    },
    {
      label: "Horário",
      value: event.endTime
        ? `${formatEventTime(event.startTime)} às ${formatEventTime(event.endTime)}`
        : `A partir das ${formatEventTime(event.startTime)}`,
      icon: ClockIcon,
    },
    { label: "Onde", value: event.location, icon: MapPinIcon },
  ];

  const mapsQuery = encodeURIComponent(event.location);

  return (
    <section id="evento" className="scroll-mt-6 px-5 py-20 sm:px-10 sm:py-28">
      <Reveal className="mx-auto max-w-3xl">
        <RevealItem>
          <h2 className="evento-sans text-3xl font-extrabold text-[var(--evento-cream)] uppercase sm:text-4xl">
            O evento
          </h2>
        </RevealItem>

        <RevealItem className="evento-rule my-8" />

        <dl className="flex flex-col">
          {facts.map((fact, index) => (
            <RevealItem key={fact.label}>
              <div
                className={`flex items-baseline gap-4 py-4 ${
                  index !== facts.length - 1
                    ? "border-b border-[var(--evento-hairline)]"
                    : ""
                }`}
              >
                <dt className="evento-sans flex w-24 shrink-0 items-center gap-2 text-xs tracking-[0.2em] text-[var(--evento-gold)] uppercase sm:w-32">
                  <fact.icon className="size-4 shrink-0" strokeWidth={1.75} />
                  {fact.label}
                </dt>
                <dd className="evento-sans text-lg font-bold text-[var(--evento-cream)] sm:text-xl">
                  {fact.label === "Onde" ? (
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${mapsQuery}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline-offset-4 hover:underline"
                    >
                      {fact.value}
                    </a>
                  ) : (
                    fact.value
                  )}
                </dd>
              </div>
            </RevealItem>
          ))}
        </dl>

        <RevealItem>
          <div className="mt-6 overflow-hidden rounded-sm border border-[var(--evento-hairline)]">
            <iframe
              title="Mapa do local do evento"
              src={`https://www.google.com/maps?q=${mapsQuery}&output=embed`}
              className="h-56 w-full grayscale invert-[0.92] contrast-[1.1] sm:h-72"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          </div>
        </RevealItem>

        <RevealItem>
          <button
            type="button"
            onClick={open}
            className="evento-sans mt-6 w-full rounded-sm bg-[var(--evento-amber)] px-8 py-3.5 text-sm font-semibold tracking-wide text-[var(--evento-bg-deep)] uppercase transition-transform duration-200 hover:scale-[1.02] active:scale-[0.98] sm:w-auto"
          >
            Reservar minha mesa
          </button>
        </RevealItem>
      </Reveal>
    </section>
  );
};
