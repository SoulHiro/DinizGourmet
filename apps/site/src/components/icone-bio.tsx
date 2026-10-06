import {
  BikeIcon,
  BookOpenIcon,
  CalendarDaysIcon,
  GiftIcon,
  LinkIcon,
  MapPinIcon,
  MessageCircleIcon,
  MusicIcon,
  PhoneIcon,
  StarIcon,
} from "lucide-react";

import type { IconeLink } from "@/lib/bio-links";

// O lucide não tem mais ícones de marca: o do Instagram é desenhado aqui.
const InstagramIcon = ({ className }: { className?: string }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.75}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
  >
    <rect x="3" y="3" width="18" height="18" rx="5" />
    <circle cx="12" cy="12" r="4" />
    <circle cx="17.5" cy="6.5" r="0.6" fill="currentColor" />
  </svg>
);

const ICONES = {
  calendario: CalendarDaysIcon,
  delivery: BikeIcon,
  cardapio: BookOpenIcon,
  whatsapp: MessageCircleIcon,
  instagram: InstagramIcon,
  localizacao: MapPinIcon,
  telefone: PhoneIcon,
  musica: MusicIcon,
  estrela: StarIcon,
  presente: GiftIcon,
  link: LinkIcon,
} satisfies Record<IconeLink, React.ComponentType<{ className?: string }>>;

export const IconeBio = ({
  icone,
  className,
}: {
  icone: IconeLink;
  className?: string;
}) => {
  const Icone = ICONES[icone] ?? LinkIcon;
  return <Icone className={className} />;
};
