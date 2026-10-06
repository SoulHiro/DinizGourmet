import { eq } from "drizzle-orm";
import {
  ArrowLeftIcon,
  CalendarDaysIcon,
  ClockIcon,
  MapPinIcon,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { db } from "@/db";
import { events } from "@/db/schema";
import {
  dataPorExtenso,
  hojeISO,
  horarioEvento,
  partesData,
  tituloEvento,
} from "@/lib/eventos";
import { mapsLink, SITE_CONFIG } from "@/lib/site-config";

import { Cartaz, Selo, SeloData } from "../_components/pecas-evento";
import { BotaoReservar } from "./_components/botao-reservar";
import { ReservationDrawerProvider } from "./_components/reservation-drawer";
import { SiteFooter } from "./_components/site-footer";

export const dynamic = "force-dynamic";

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
    return { title: "Evento não encontrado — Xis Diniz" };
  }

  const title = `${tituloEvento(event)} ao vivo — Xis Diniz`;
  const description = `${dataPorExtenso(event.eventDate)}, ${horarioEvento(event).toLowerCase()}. Música ao vivo, Xis Gaúcho e entrada gratuita. Reserve sua mesa.`;
  const images = event.posterUrl ? [event.posterUrl] : undefined;

  return {
    title,
    description,
    openGraph: { title, description, type: "website", images },
    twitter: { card: "summary_large_image", title, description, images },
  };
};

const LinhaInfo = ({
  icone: Icone,
  titulo,
  detalhe,
  href,
}: {
  icone: typeof ClockIcon;
  titulo: string;
  detalhe: string;
  href?: string;
}) => {
  const conteudo = (
    <>
      <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-[var(--evento-bg-lift)] text-[var(--evento-gold)]">
        <Icone className="size-5" strokeWidth={1.75} />
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="font-semibold text-[var(--evento-cream)]">
          {titulo}
        </span>
        <span className="text-sm text-[var(--evento-cream-dim)]">
          {detalhe}
        </span>
      </span>
    </>
  );

  return href ? (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-4 rounded-lg transition-colors hover:text-[var(--evento-gold)]"
    >
      {conteudo}
    </a>
  ) : (
    <div className="flex items-center gap-4">{conteudo}</div>
  );
};

const EventPage = async ({ params }: EventPageProps) => {
  const { slug } = await params;
  const event = await getEvent(slug);

  if (!event) {
    notFound();
  }

  const titulo = tituloEvento(event);
  const passado = event.eventDate < hojeISO();
  const reservaAberta = !passado && event.isActive;
  const { ano } = partesData(event.eventDate);
  const enderecoCompleto = event.location;

  return (
    <ReservationDrawerProvider eventId={event.id}>
      <header className="mx-auto flex max-w-5xl items-center justify-between px-5 pt-5 sm:px-8">
        <Link
          href="/eventos"
          className="evento-sans flex items-center gap-2 text-xs font-semibold tracking-[0.2em] text-[var(--evento-cream-dim)] uppercase transition-colors hover:text-[var(--evento-gold)]"
        >
          <ArrowLeftIcon className="size-4" />
          Agenda
        </Link>
        <Link
          href="/"
          className="evento-serif text-lg font-bold tracking-wide text-[var(--evento-cream)] uppercase"
        >
          <span className="evento-sans mr-1.5 text-[0.6rem] font-semibold tracking-[0.4em] text-[var(--evento-gold)]">
            Xis
          </span>
          Diniz
        </Link>
      </header>

      <main className="mx-auto grid max-w-5xl gap-10 px-5 pt-6 pb-20 sm:px-8 lg:grid-cols-[minmax(0,400px)_1fr] lg:gap-14 lg:pt-10">
        <div className="relative mx-auto w-full max-w-sm lg:sticky lg:top-8 lg:max-w-none lg:self-start">
          {/* Luz do cartaz espalhando atrás dele. */}
          {event.posterUrl && (
            // biome-ignore lint/performance/noImgElement: mesmo cartaz, só desfocado
            <img
              src={event.posterUrl}
              alt=""
              aria-hidden="true"
              className="absolute inset-0 -z-10 size-full scale-105 object-cover opacity-50 blur-3xl"
            />
          )}
          <Cartaz
            src={event.posterUrl}
            alt={`Cartaz: ${titulo} ao vivo`}
            className={`aspect-[2/3] w-full rounded-xl border border-[var(--evento-hairline)] shadow-2xl ${passado ? "grayscale-[0.4]" : ""}`}
          />
        </div>

        <div className="evento-sans flex flex-col gap-9">
          <div className="flex items-start gap-4">
            <SeloData iso={event.eventDate} apagado={passado} />
            <div className="flex min-w-0 flex-col gap-1">
              {event.genres.length > 0 && (
                <p className="text-xs font-semibold tracking-[0.2em] text-[var(--evento-amber)] uppercase">
                  {event.genres.join(" · ")}
                </p>
              )}
              <h1 className="evento-display text-5xl leading-[0.95] text-balance text-[var(--evento-cream)] uppercase sm:text-6xl">
                {titulo}
              </h1>
              <p className="evento-script text-3xl text-[var(--evento-amber)]">
                Ao vivo
              </p>
            </div>
          </div>

          {passado && (
            <p className="rounded-lg border border-[var(--evento-hairline)] px-4 py-3 text-sm text-[var(--evento-cream-dim)]">
              Esse show já rolou. Confira na agenda os próximos eventos.
            </p>
          )}

          <div className="flex flex-col gap-5">
            <LinhaInfo
              icone={CalendarDaysIcon}
              titulo={dataPorExtenso(event.eventDate)}
              detalhe={String(ano)}
            />
            <LinhaInfo
              icone={ClockIcon}
              titulo={horarioEvento(event)}
              detalhe="Entrada gratuita"
            />
            <LinhaInfo
              icone={MapPinIcon}
              titulo={SITE_CONFIG.nome}
              detalhe={enderecoCompleto}
              href={mapsLink(enderecoCompleto)}
            />
          </div>

          {event.description && (
            <section className="flex flex-col gap-3">
              <h2 className="text-sm font-bold tracking-[0.2em] text-[var(--evento-cream)] uppercase">
                Sobre o show
              </h2>
              <p className="leading-relaxed whitespace-pre-line text-[var(--evento-cream-dim)]">
                {event.description}
              </p>
            </section>
          )}

          {event.highlights.length > 0 && (
            <section className="grid grid-cols-4 gap-2 rounded-xl border border-[var(--evento-hairline)] px-2 py-5">
              {event.highlights.slice(0, 4).map((selo) => (
                <Selo key={selo} texto={selo} />
              ))}
            </section>
          )}

          <section className="flex flex-col gap-3">
            <h2 className="text-sm font-bold tracking-[0.2em] text-[var(--evento-cream)] uppercase">
              Como chegar
            </h2>
            <div className="overflow-hidden rounded-xl border border-[var(--evento-hairline)]">
              <iframe
                title="Mapa do local do evento"
                src={`https://www.google.com/maps?q=${encodeURIComponent(enderecoCompleto)}&output=embed`}
                className="h-56 w-full grayscale invert-[0.92] contrast-[1.1] sm:h-64"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            </div>
          </section>
        </div>
      </main>

      <div className="pb-20">
        <SiteFooter />
      </div>

      {/* Barra fixa de reserva, como nos apps de evento. */}
      <div className="evento-sans fixed inset-x-0 bottom-0 z-20 border-t border-[var(--evento-hairline)] bg-[var(--evento-bg-deep)]/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-8">
          <div className="flex min-w-0 flex-col">
            <span className="truncate text-sm font-semibold text-[var(--evento-cream)]">
              {reservaAberta ? "Entrada gratuita" : titulo}
            </span>
            <span className="truncate text-xs text-[var(--evento-cream-dim)]">
              {passado
                ? "Evento encerrado"
                : reservaAberta
                  ? "Garanta sua mesa"
                  : "Reservas encerradas"}
            </span>
          </div>
          {reservaAberta ? (
            <BotaoReservar className="shrink-0" />
          ) : (
            <Link
              href="/eventos"
              className="shrink-0 rounded-lg border border-[var(--evento-gold)]/60 px-5 py-3 text-sm font-bold tracking-wide text-[var(--evento-gold)] uppercase transition-colors hover:bg-[var(--evento-gold)] hover:text-[var(--evento-bg-deep)]"
            >
              Ver agenda
            </Link>
          )}
        </div>
      </div>
    </ReservationDrawerProvider>
  );
};

export default EventPage;
