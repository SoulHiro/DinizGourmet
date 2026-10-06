import { ArrowLeftIcon, ClockIcon, MessageCircleIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import {
  type Evento,
  hojeISO,
  horaCurta,
  horarioEvento,
  listarEventos,
  partesData,
  tituloEvento,
} from "@/lib/eventos";
import { instagramLink, SITE_CONFIG, whatsappLink } from "@/lib/site-config";
import { CalendarioEventos } from "./_components/calendario-eventos";
import { Cartaz, SeloData } from "./_components/pecas-evento";
import { Reveal, RevealItem } from "./_components/reveal";
import { SiteFooter } from "./[slug]/_components/site-footer";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Agenda de shows — Xis Diniz",
  description:
    "Música ao vivo toda semana no Xis Diniz, em Atibaia/SP. Veja a agenda de shows e reserve sua mesa. Entrada gratuita.",
};

const CardProximo = ({ evento }: { evento: Evento }) => (
  <Link
    href={`/eventos/${evento.slug}`}
    className="group relative block aspect-[3/4] w-[72vw] max-w-[17rem] shrink-0 snap-start overflow-hidden rounded-xl border border-[var(--evento-hairline)] sm:w-64"
  >
    <Cartaz
      src={evento.posterUrl}
      alt={`Cartaz: ${tituloEvento(evento)}`}
      className="absolute inset-0 size-full object-[50%_20%] transition-transform duration-500 group-hover:scale-105"
    />
    <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 via-45% to-transparent" />
    <SeloData iso={evento.eventDate} className="absolute top-3 left-3" />
    <div className="absolute inset-x-0 bottom-0 flex flex-col gap-1 p-4">
      {evento.genres.length > 0 && (
        <span className="truncate text-[10px] font-semibold tracking-[0.2em] text-[var(--evento-amber)] uppercase">
          {evento.genres.join(" · ")}
        </span>
      )}
      <span className="evento-display text-2xl leading-tight text-[var(--evento-cream)] uppercase">
        {tituloEvento(evento)}
      </span>
      <span className="flex items-center gap-1.5 text-xs text-[var(--evento-cream-dim)]">
        <ClockIcon className="size-3.5" strokeWidth={1.75} />
        {horarioEvento(evento)}
      </span>
    </div>
  </Link>
);

const LinhaPassado = ({ evento }: { evento: Evento }) => {
  const p = partesData(evento.eventDate);
  return (
    <Link
      href={`/eventos/${evento.slug}`}
      className="group flex items-center gap-4 rounded-lg p-2 -mx-2 transition-colors hover:bg-[var(--evento-bg-lift)]"
    >
      <Cartaz
        src={evento.posterUrl}
        alt=""
        className="h-16 w-12 shrink-0 rounded-md grayscale-[0.6] transition group-hover:grayscale-0"
      />
      <span className="flex min-w-0 flex-col">
        <span className="truncate font-semibold text-[var(--evento-cream)]">
          {tituloEvento(evento)}
        </span>
        <span className="text-xs text-[var(--evento-cream-dim)]">
          {p.dia} de {p.nomeMes} de {p.ano}
        </span>
      </span>
    </Link>
  );
};

const EventosPage = async () => {
  const { todos, futuros, passados } = await listarEventos();
  const hoje = hojeISO();
  const mesInicial = (futuros[0]?.eventDate ?? hoje).slice(0, 7);

  return (
    <>
      <header className="evento-sans mx-auto flex max-w-5xl items-center justify-between px-5 pt-5 sm:px-8">
        <Link
          href="/"
          className="flex items-center gap-2 text-xs font-semibold tracking-[0.2em] text-[var(--evento-cream-dim)] uppercase transition-colors hover:text-[var(--evento-gold)]"
        >
          <ArrowLeftIcon className="size-4" />
          Início
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

      <main className="evento-sans mx-auto flex max-w-5xl flex-col gap-14 px-5 pt-10 pb-20 sm:px-8 sm:pt-14">
        <Reveal className="flex flex-col gap-2">
          <RevealItem>
            <p className="evento-script text-3xl text-[var(--evento-amber)]">
              Música ao vivo
            </p>
          </RevealItem>
          <RevealItem>
            <h1 className="evento-display text-6xl leading-none text-[var(--evento-cream)] uppercase sm:text-7xl">
              Agenda
            </h1>
          </RevealItem>
          <RevealItem>
            <p className="max-w-lg pt-2 text-[var(--evento-cream-dim)]">
              Xis Gaúcho, chopp gelado e show toda semana. Escolha a noite,
              reserve sua mesa e chame os amigos. Entrada gratuita.
            </p>
          </RevealItem>
        </Reveal>

        <section className="flex flex-col gap-5">
          <h2 className="text-sm font-bold tracking-[0.2em] text-[var(--evento-cream)] uppercase">
            Próximos shows
          </h2>

          {futuros.length > 0 ? (
            // Carrossel que encosta na borda da tela no celular.
            <div className="-mx-5 flex snap-x snap-mandatory scroll-px-5 gap-4 overflow-x-auto px-5 pb-2 [scrollbar-width:none] sm:-mx-8 sm:scroll-px-8 sm:px-8">
              {futuros.map((evento) => (
                <CardProximo key={evento.id} evento={evento} />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-start gap-4 rounded-xl border border-[var(--evento-hairline)] p-6">
              <p className="text-[var(--evento-cream)]">
                A próxima atração está sendo confirmada.
              </p>
              <p className="text-sm text-[var(--evento-cream-dim)]">
                Acompanhe o @{SITE_CONFIG.instagramHandle} para saber primeiro
                ou chame a gente no WhatsApp para reservar sua mesa. Aberto para
                o Xis de sempre, com ou sem show.
              </p>
              <div className="flex flex-wrap gap-3">
                <a
                  href={whatsappLink("Olá! Quero reservar uma mesa.")}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="evento-cta-glow flex items-center gap-2 rounded-lg bg-[var(--evento-amber)] px-5 py-3 text-sm font-bold text-[var(--evento-bg-deep)] uppercase"
                >
                  <MessageCircleIcon className="size-4" />
                  Reservar pelo WhatsApp
                </a>
                <a
                  href={instagramLink()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-lg border border-[var(--evento-gold)]/60 px-5 py-3 text-sm font-bold text-[var(--evento-gold)] uppercase"
                >
                  Instagram
                </a>
              </div>
            </div>
          )}
        </section>

        <section className="flex flex-col gap-5">
          <h2 className="text-sm font-bold tracking-[0.2em] text-[var(--evento-cream)] uppercase">
            Calendário
          </h2>
          <CalendarioEventos
            hoje={hoje}
            mesInicial={mesInicial}
            eventos={todos.map((e) => ({
              slug: e.slug,
              titulo: tituloEvento(e),
              eventDate: e.eventDate,
              horario: horaCurta(e.startTime),
            }))}
          />
        </section>

        {passados.length > 0 && (
          <section className="flex flex-col gap-4">
            <h2 className="text-sm font-bold tracking-[0.2em] text-[var(--evento-cream-dim)] uppercase">
              Já rolou por aqui
            </h2>
            <div className="grid gap-1 sm:grid-cols-2 sm:gap-x-10">
              {passados.map((evento) => (
                <LinhaPassado key={evento.id} evento={evento} />
              ))}
            </div>
          </section>
        )}
      </main>

      <SiteFooter />
    </>
  );
};

export default EventosPage;
