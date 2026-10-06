import "@/styles/evento.css";

import { cn } from "@/lib/utils";
import {
  eventoDisplay,
  eventoSans,
  eventoScript,
  eventoSerif,
} from "@/styles/evento-fonts";

// Casca visual da identidade de eventos (fundo escuro, textura, fontes):
// usada na página do evento, no calendário de eventos e na home
// (link-in-bio), para manter a mesma cara em todo o site público.
export const EventoShell = ({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) => (
  <div
    className={cn(
      "evento-page evento-sans min-h-svh",
      eventoSerif.variable,
      eventoSans.variable,
      eventoDisplay.variable,
      eventoScript.variable,
      className,
    )}
  >
    {children}
  </div>
);
