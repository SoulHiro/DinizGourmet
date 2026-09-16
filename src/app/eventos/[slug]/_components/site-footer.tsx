import { AtSignIcon, MessageCircleIcon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

const WHATSAPP_NUMBER = "5511927417769";
const INSTAGRAM_HANDLE = "dinizgourmet.of";

export const SiteFooter = () => {
  return (
    <footer className="evento-sans border-t border-[var(--evento-hairline)] px-5 py-10 sm:px-10">
      <div className="mx-auto flex max-w-4xl flex-col items-center gap-5 text-center">
        <Image
          src="/eventos/diniz-gourmet-logo.png"
          alt="Diniz Gourmet"
          width={96}
          height={96}
          className="h-20 w-20 rounded-full object-cover"
        />

        <p className="text-xs tracking-[0.2em] text-[var(--evento-cream-dim)] uppercase">
          Xis Gaúcho de verdade
        </p>

        <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-[var(--evento-cream)]">
          <a
            href={`https://instagram.com/${INSTAGRAM_HANDLE}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 hover:text-[var(--evento-gold)]"
          >
            <AtSignIcon className="size-4" strokeWidth={1.75} />
            {INSTAGRAM_HANDLE}
          </a>
          <a
            href={`https://wa.me/${WHATSAPP_NUMBER}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 hover:text-[var(--evento-gold)]"
          >
            <MessageCircleIcon className="size-4" strokeWidth={1.75} />
            (11) 92741-7769
          </a>
        </div>

        <div className="evento-rule w-full max-w-xs" />

        <div className="flex flex-col items-center gap-1 text-[11px] text-[var(--evento-cream-dim)]/60">
          <p>
            © {new Date().getFullYear()} Diniz Gourmet. Todos os direitos
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
