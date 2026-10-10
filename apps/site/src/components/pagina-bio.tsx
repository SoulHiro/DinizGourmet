import { ArrowUpRightIcon, ChevronRightIcon, MapPinIcon } from "lucide-react";
import Link from "next/link";

import type { IconeLink } from "@/lib/bio-links";
import { SITE_CONFIG } from "@/lib/site-config";
import { cn } from "@/lib/utils";

import { IconeBio } from "./icone-bio";

export interface LinkBio {
  id?: string;
  label: string;
  url: string;
  icon: IconeLink;
}

export interface ProximoEventoBio {
  titulo: string;
  quando: string;
  href: string;
  posterUrl: string | null;
}

interface PaginaBioProps {
  links: LinkBio[];
  proximoEvento: ProximoEventoBio | null;
  // No preview do admin os links abrem em outra aba para não sair do editor.
  preview?: boolean;
}

const externo = (url: string) => /^https?:\/\//.test(url);

// Link que funciona igual para página do site (/eventos) e endereço de fora.
const Destino = ({
  url,
  preview,
  className,
  children,
}: {
  url: string;
  preview?: boolean;
  className?: string;
  children: React.ReactNode;
}) =>
  externo(url) || preview ? (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
    >
      {children}
    </a>
  ) : (
    <Link href={url} className={className}>
      {children}
    </Link>
  );

// Marca em texto: o logo em imagem ainda é o antigo (Diniz Gourmet).
export const MarcaXisDiniz = ({ className }: { className?: string }) => (
  <div className={cn("flex flex-col items-center leading-none", className)}>
    <span className="evento-sans text-[0.7rem] font-semibold tracking-[0.6em] text-[var(--evento-gold)] uppercase">
      Xis
    </span>
    <span className="evento-serif mt-1 text-5xl font-bold tracking-wide text-[var(--evento-cream)] uppercase">
      Diniz
    </span>
  </div>
);

// Página de links da bio do Instagram. O visual é fixo aqui de propósito:
// o admin só escolhe texto, link, ícone e ordem. O primeiro botão da lista
// fica em destaque (dourado).
export const PaginaBio = ({
  links,
  proximoEvento,
  preview,
}: PaginaBioProps) => (
  <div className="mx-auto flex min-h-full w-full max-w-md flex-col items-center px-5 pt-14 pb-10">
    <MarcaXisDiniz />
    <p className="evento-script mt-3 text-2xl text-[var(--evento-amber)]">
      {SITE_CONFIG.slogan}
    </p>
    <p className="evento-sans mt-2 flex items-center gap-1.5 text-[11px] tracking-[0.2em] text-[var(--evento-cream-dim)] uppercase">
      <MapPinIcon className="size-3 text-[var(--evento-gold)]" />
      Atibaia/SP
    </p>

    {proximoEvento && (
      <Destino
        url={proximoEvento.href}
        preview={preview}
        className="group mt-9 flex w-full items-center gap-4 overflow-hidden rounded-lg border border-[var(--evento-hairline)] bg-[var(--evento-bg-lift)]/80 p-2.5 pr-4 transition-colors hover:border-[var(--evento-gold)]/60"
      >
        {proximoEvento.posterUrl ? (
          // biome-ignore lint/performance/noImgElement: cartaz pode vir do Blob; o preview do admin também usa
          <img
            src={proximoEvento.posterUrl}
            alt=""
            className="h-24 w-[4.25rem] shrink-0 rounded-md object-cover"
          />
        ) : (
          <div className="flex h-24 w-[4.25rem] shrink-0 items-center justify-center rounded-md bg-[var(--evento-bg-deep)]">
            <IconeBio
              icone="musica"
              className="size-6 text-[var(--evento-gold)]"
            />
          </div>
        )}
        <div className="flex min-w-0 flex-1 flex-col gap-1 text-left">
          <span className="evento-sans text-[10px] font-semibold tracking-[0.25em] text-[var(--evento-ember)] uppercase">
            Próximo evento
          </span>
          <span className="evento-display line-clamp-2 text-2xl leading-tight text-[var(--evento-cream)] uppercase">
            {proximoEvento.titulo}
          </span>
          <span className="evento-sans text-xs text-[var(--evento-cream-dim)]">
            {proximoEvento.quando}
          </span>
        </div>
        <ChevronRightIcon className="size-5 shrink-0 text-[var(--evento-gold)] transition-transform group-hover:translate-x-0.5" />
      </Destino>
    )}

    <nav className="mt-6 flex w-full flex-col gap-3">
      {links.map((link, index) => {
        const destaque = index === 0;
        return (
          <Destino
            key={link.id ?? `${link.label}-${index}`}
            url={link.url}
            preview={preview}
            className={cn(
              "evento-sans group relative flex h-14 w-full items-center gap-3 rounded-lg px-5 text-sm font-bold tracking-wide uppercase transition-transform duration-200 hover:scale-[1.015] active:scale-[0.985]",
              destaque
                ? "evento-cta-glow bg-[var(--evento-amber)] text-[var(--evento-bg-deep)]"
                : "border border-[var(--evento-hairline)] bg-[var(--evento-bg-lift)]/70 text-[var(--evento-cream)] hover:border-[var(--evento-gold)]/60",
            )}
          >
            <IconeBio
              icone={link.icon}
              className={cn(
                "size-5 shrink-0",
                destaque ? "" : "text-[var(--evento-gold)]",
              )}
            />
            <span className="flex-1 truncate text-center">{link.label}</span>
            {externo(link.url) ? (
              <ArrowUpRightIcon className="size-4 shrink-0 opacity-60" />
            ) : (
              <ChevronRightIcon className="size-4 shrink-0 opacity-60" />
            )}
          </Destino>
        );
      })}
    </nav>

    <div className="evento-rule mt-12 w-full max-w-xs" />
    <p className="evento-sans mt-5 text-center text-[11px] leading-relaxed text-[var(--evento-cream-dim)]/70">
      {SITE_CONFIG.endereco}
      <br />({SITE_CONFIG.referencia})
    </p>
  </div>
);
