import type { Metadata } from "next";

import { EventoShell } from "@/components/evento-shell";
import { PaginaBio } from "@/components/pagina-bio";
import {
  dataPorExtenso,
  horaCurta,
  listarEventos,
  tituloEvento,
} from "@/lib/eventos";
import { listarBioLinks } from "@/lib/links-publicos";

// Os links mudam pelo admin (que chama revalidatePath("/")) e o "próximo
// evento" muda com a data: sempre renderiza na hora.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Xis Diniz — Xis Gaúcho de verdade",
  description:
    "Reserve sua mesa, peça delivery, veja o cardápio e a agenda de shows do Xis Diniz em Atibaia/SP.",
};

const HomePage = async () => {
  const [links, { futuros }] = await Promise.all([
    listarBioLinks(),
    listarEventos(),
  ]);
  const proximo = futuros[0];

  return (
    <EventoShell>
      <PaginaBio
        links={links.filter((l) => l.isVisible)}
        proximoEvento={
          proximo
            ? {
                titulo: tituloEvento(proximo),
                quando: `${dataPorExtenso(proximo.eventDate)} · ${horaCurta(proximo.startTime)}`,
                href: `/eventos/${proximo.slug}`,
                posterUrl: proximo.posterUrl,
              }
            : null
        }
      />
    </EventoShell>
  );
};

export default HomePage;
