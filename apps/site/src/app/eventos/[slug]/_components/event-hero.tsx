"use client";

import { motion, useReducedMotion } from "framer-motion";
import { MapPinIcon } from "lucide-react";
import Image from "next/image";

import type { events } from "@/db/schema";

import {
  formatEventDate,
  formatEventTime,
} from "../../helpers/format-event-date";
import { useReservationDrawer } from "./reservation-drawer";

interface EventHeroProps {
  event: typeof events.$inferSelect;
}

const fadeUp = (delay: number) => ({
  hidden: { opacity: 0, y: 24 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.8, ease: [0.16, 1, 0.3, 1] as const, delay },
  },
});

const splitFacts = (description: string | null) => {
  if (!description) return [] as string[];

  return description
    .split("·")
    .map((fact) => fact.replace(/\.$/, "").trim())
    .filter(Boolean);
};

export const EventHero = ({ event }: EventHeroProps) => {
  const reduceMotion = useReducedMotion();
  const initial = reduceMotion ? "show" : "hidden";
  const { open } = useReservationDrawer();
  const facts = splitFacts(event.description);

  return (
    <section className="relative flex min-h-svh flex-col overflow-hidden px-5 pt-8 pb-10 sm:px-10">
      <Image
        src="/eventos/vilson-luiz-hero.jpg"
        alt={`${event.attraction || event.name} — Diniz Gourmet`}
        fill
        priority
        sizes="100vw"
        className="-z-10 object-cover lg:hidden"
        style={{ objectPosition: "50% 15%" }}
      />
      <Image
        src="/eventos/vilson-luiz-hero-desktop.png"
        alt={`${event.attraction || event.name} — Diniz Gourmet`}
        fill
        priority
        sizes="100vw"
        className="-z-10 hidden object-cover lg:block"
        style={{ objectPosition: "35% 35%" }}
      />
      <div className="absolute inset-0 -z-10 bg-gradient-to-t from-black from-0% via-black/55 via-28% to-transparent to-60%" />

      <motion.p
        initial={initial}
        animate="show"
        variants={fadeUp(0)}
        className="evento-sans text-center text-xs tracking-[0.3em] text-[var(--evento-cream-dim)] uppercase"
      >
        Diniz Gourmet Apresenta
      </motion.p>

      <div className="flex flex-1 flex-col justify-center gap-4 text-center">
        <motion.h1
          initial={initial}
          animate="show"
          variants={fadeUp(0.15)}
          className="evento-sans text-6xl leading-[0.9] font-extrabold text-balance text-[var(--evento-cream)] uppercase sm:text-8xl"
        >
          {event.attraction || event.name}
        </motion.h1>

        <motion.p
          initial={initial}
          animate="show"
          variants={fadeUp(0.25)}
          className="evento-script -mt-2 text-4xl text-[var(--evento-amber)] sm:text-5xl"
        >
          Ao vivo
        </motion.p>

        {facts.length > 0 && (
          <motion.div
            initial={initial}
            animate="show"
            variants={fadeUp(0.4)}
            className="evento-sans mx-auto flex flex-wrap items-center justify-center gap-2"
          >
            {facts.map((fact) => (
              <span
                key={fact}
                className="rounded-full border border-[var(--evento-hairline)] px-3 py-1 text-[10px] font-semibold tracking-[0.15em] text-[var(--evento-cream)] uppercase"
              >
                {fact}
              </span>
            ))}
          </motion.div>
        )}

        <motion.div
          initial={initial}
          animate="show"
          variants={fadeUp(0.45)}
          className="evento-sans mx-auto inline-flex flex-col items-center gap-1 rounded-lg border border-[var(--evento-gold)]/50 bg-black/40 px-6 py-3 backdrop-blur-sm"
        >
          <span className="text-xs tracking-[0.2em] text-[var(--evento-gold)] uppercase">
            {formatEventDate(event.eventDate)}
          </span>
          <span className="text-lg font-bold tracking-wide text-[var(--evento-cream)] uppercase">
            {event.endTime
              ? `${formatEventTime(event.startTime)} às ${formatEventTime(event.endTime)}`
              : `A partir das ${formatEventTime(event.startTime)}`}
          </span>
        </motion.div>

        <motion.div
          initial={initial}
          animate="show"
          variants={fadeUp(0.55)}
          className="mx-auto w-full max-w-sm pt-2"
        >
          <button
            type="button"
            onClick={open}
            className="evento-sans w-full rounded-sm bg-[var(--evento-amber)] px-6 py-4 text-center text-sm font-bold tracking-wide text-[var(--evento-bg-deep)] uppercase shadow-[0_8px_30px_-8px_rgb(239_47_99/0.6)] transition-transform duration-200 hover:scale-[1.02] active:scale-[0.98]"
          >
            Reservar minha mesa
          </button>
        </motion.div>

        <motion.a
          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.location)}`}
          target="_blank"
          rel="noopener noreferrer"
          initial={initial}
          animate="show"
          variants={fadeUp(0.65)}
          className="evento-sans mx-auto flex items-center gap-1.5 text-[11px] tracking-wide text-[var(--evento-cream-dim)]/70 uppercase underline-offset-4 hover:text-[var(--evento-cream)] hover:underline"
        >
          <MapPinIcon className="size-3 text-[var(--evento-gold)]/70" />
          {event.location}
        </motion.a>
      </div>
    </section>
  );
};
