import { EventoShell } from "@/components/evento-shell";

// Casca comum do /eventos (calendário) e de cada /eventos/[slug].
const EventosLayout = ({ children }: { children: React.ReactNode }) => (
  <EventoShell>{children}</EventoShell>
);

export default EventosLayout;
