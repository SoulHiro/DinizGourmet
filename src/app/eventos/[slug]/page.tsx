import { eq } from "drizzle-orm";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { db } from "@/db";
import { events } from "@/db/schema";

import { formatEventDate, formatEventTime } from "../helpers/format-event-date";
import { EventHero } from "./_components/event-hero";
import { EventInfo } from "./_components/event-info";
import { ReservationDrawerProvider } from "./_components/reservation-drawer";
import { SiteFooter } from "./_components/site-footer";

interface EventPageProps {
  params: Promise<{ slug: string }>;
}

const getEvent = async (slug: string) => {
  return db.query.events.findFirst({ where: eq(events.slug, slug) });
};

export const generateMetadata = async ({
  params,
}: EventPageProps): Promise<Metadata> => {
  const { slug } = await params;
  const event = await getEvent(slug);

  if (!event) {
    return { title: "Evento não encontrado — Diniz Gourmet" };
  }

  const title = `${event.attraction || event.name} — Diniz Gourmet`;
  const description = `Xis Gaúcho, música ao vivo com ${event.attraction || "atração especial"} e boa companhia no Diniz Gourmet. ${formatEventDate(event.eventDate)} às ${formatEventTime(event.startTime)}, em ${event.location}. Reserve sua mesa.`;

  return {
    title,
    description,
    openGraph: { title, description, type: "website" },
    twitter: { card: "summary_large_image", title, description },
  };
};

const EventPage = async ({ params }: EventPageProps) => {
  const { slug } = await params;
  const event = await getEvent(slug);

  if (!event) {
    notFound();
  }

  return (
    <ReservationDrawerProvider eventId={event.id}>
      <EventHero event={event} />
      {event.isActive ? (
        <EventInfo event={event} />
      ) : (
        <section className="px-5 py-24 text-center">
          <p className="evento-sans text-[var(--evento-cream-dim)]">
            As reservas para este evento estão encerradas.
          </p>
        </section>
      )}
      <SiteFooter />
    </ReservationDrawerProvider>
  );
};

export default EventPage;
