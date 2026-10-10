import {
  dataPorExtenso,
  horaCurta,
  listarEventos,
  tituloEvento,
} from "@/lib/eventos";
import { listarBioLinks } from "@/lib/links-publicos";

import { EditorLinks } from "./_components/editor-links";

const LinksPage = async () => {
  const [links, { futuros }] = await Promise.all([
    listarBioLinks(),
    listarEventos(),
  ]);
  const proximo = futuros[0];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Links da bio</h1>
        <p className="text-sm text-muted-foreground">
          Os botões da página inicial (o link que fica na bio do Instagram). O
          visual é fixo: aqui você muda textos, links, ícones e a ordem. O
          primeiro botão visível fica em destaque.
        </p>
      </div>

      <EditorLinks
        iniciais={links.map((l) => ({
          id: l.id,
          label: l.label,
          url: l.url,
          icon: l.icon,
          isVisible: l.isVisible,
        }))}
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
    </div>
  );
};

export default LinksPage;
