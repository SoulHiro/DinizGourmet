import {
  BeerIcon,
  MusicIcon,
  PartyPopperIcon,
  SparklesIcon,
  UsersIcon,
  UtensilsCrossedIcon,
} from "lucide-react";

import { partesData } from "@/lib/datas-evento";
import { cn } from "@/lib/utils";

// Selo de data no estilo dos cartazes: bloco vermelho, dia grande.
export const SeloData = ({
  iso,
  className,
  apagado,
}: {
  iso: string;
  className?: string;
  apagado?: boolean;
}) => {
  const p = partesData(iso);
  return (
    <div
      className={cn(
        "evento-display flex w-14 flex-col items-center rounded-md py-1.5 leading-none text-[var(--evento-cream)] uppercase shadow-lg",
        apagado
          ? "bg-[var(--evento-bg-lift)] text-[var(--evento-cream-dim)]"
          : "bg-[var(--evento-ember)]",
        className,
      )}
    >
      <span className="text-[0.65rem] tracking-[0.15em]">
        {p.diaSemana.slice(0, 3)}
      </span>
      <span className="text-2xl">{String(p.dia).padStart(2, "0")}</span>
      <span className="text-[0.65rem] tracking-[0.15em]">{p.mesCurto}</span>
    </div>
  );
};

// Ícone de cada selo do cartaz pelo texto (Música ao vivo, Chopp gelado...).
const iconeDoSelo = (texto: string) => {
  const t = texto.toLowerCase();
  if (/m[uú]sica|show|ao vivo/.test(t)) return MusicIcon;
  if (/bebida|chopp|cerveja|drink|gelad/.test(t)) return BeerIcon;
  if (/comida|xis|lanche|petisco|por[cç][aã]o/.test(t))
    return UtensilsCrossedIcon;
  if (/ambiente|amigos|fam[ií]lia/.test(t)) return UsersIcon;
  if (/divers[aã]o|festa|curtir/.test(t)) return PartyPopperIcon;
  return SparklesIcon;
};

export const Selo = ({ texto }: { texto: string }) => {
  const Icone = iconeDoSelo(texto);
  return (
    <div className="flex flex-col items-center gap-2 text-center">
      <span className="flex size-12 items-center justify-center rounded-full border border-[var(--evento-gold)]/60 text-[var(--evento-gold)]">
        <Icone className="size-5" strokeWidth={1.75} />
      </span>
      <span className="evento-sans text-[10px] leading-tight font-semibold tracking-[0.12em] text-[var(--evento-cream)] uppercase">
        {texto}
      </span>
    </div>
  );
};

// Cartaz ou, sem cartaz, um fundo escuro com nota musical.
export const Cartaz = ({
  src,
  alt,
  className,
}: {
  src: string | null;
  alt: string;
  className?: string;
}) =>
  src ? (
    // biome-ignore lint/performance/noImgElement: cartaz pode vir do Vercel Blob (domínio variável)
    <img src={src} alt={alt} className={cn("object-cover", className)} />
  ) : (
    <div
      role="img"
      aria-label={alt}
      className={cn(
        "flex items-center justify-center bg-[radial-gradient(circle_at_50%_30%,var(--evento-bg-lift),var(--evento-bg-deep))]",
        className,
      )}
    >
      <MusicIcon
        className="size-10 text-[var(--evento-gold)]/60"
        strokeWidth={1.25}
      />
    </div>
  );
