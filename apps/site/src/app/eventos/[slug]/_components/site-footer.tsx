import { AtSignIcon, MessageCircleIcon } from "lucide-react";
import Link from "next/link";

import { MarcaXisDiniz } from "@/components/pagina-bio";

import { instagramLink, SITE_CONFIG, whatsappLink } from "@/lib/site-config";

export const SiteFooter = () => {
  return (
    <footer className="evento-sans border-t border-[var(--evento-hairline)] px-5 py-10 sm:px-10">
      <div className="mx-auto flex max-w-4xl flex-col items-center gap-5 text-center">
        <Link href="/" aria-label="Xis Diniz — início">
          <MarcaXisDiniz />
        </Link>

        <p className="evento-script text-xl text-[var(--evento-amber)]">
          {SITE_CONFIG.slogan}
        </p>

        <p className="text-xs leading-relaxed text-[var(--evento-cream-dim)]">
          {SITE_CONFIG.endereco}
          <br />({SITE_CONFIG.referencia})
        </p>

        <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-[var(--evento-cream)]">
          <a
            href={instagramLink()}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 hover:text-[var(--evento-gold)]"
          >
            <AtSignIcon className="size-4" strokeWidth={1.75} />
            {SITE_CONFIG.instagramHandle}
          </a>
          <a
            href={whatsappLink()}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 hover:text-[var(--evento-gold)]"
          >
            <MessageCircleIcon className="size-4" strokeWidth={1.75} />
            {SITE_CONFIG.whatsappDisplay}
          </a>
        </div>

        <div className="evento-rule w-full max-w-xs" />

        <div className="flex flex-col items-center gap-1 text-[11px] text-[var(--evento-cream-dim)]/60">
          <p>
            © {new Date().getFullYear()} Xis Diniz. Todos os direitos
            reservados.
          </p>
          <p>
            Desenvolvido por{" "}
            <Link
              href="https://www.victormts.dev/"
              target="_blank"
              rel="noopener noreferrer"
              className="underline-offset-4 hover:underline"
            >
              Victor M. Santos
            </Link>
          </p>
        </div>
      </div>
    </footer>
  );
};
