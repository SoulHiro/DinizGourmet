import { z } from "zod";

// Botões do link-in-bio: o admin escolhe o ícone por esta lista (o visual
// de cada botão é fixo no código, ver components/bio-link-botao.tsx).
export const ICONES_LINK = {
  calendario: "Agenda / reserva",
  delivery: "Delivery",
  cardapio: "Cardápio",
  whatsapp: "WhatsApp",
  instagram: "Instagram",
  localizacao: "Localização",
  telefone: "Telefone",
  musica: "Música",
  estrela: "Avaliação",
  presente: "Promoção",
  link: "Link",
} as const;

export type IconeLink = keyof typeof ICONES_LINK;

export const ICONES = Object.keys(ICONES_LINK) as [IconeLink, ...IconeLink[]];

// Link aceito: endereço completo (https://...) ou página do próprio site
// (/eventos, /cardapio).
const destino = z
  .string()
  .trim()
  .min(1, "Informe o link")
  .refine(
    (v) => v.startsWith("/") || /^https?:\/\/[^\s.]+\.[^\s]+$/.test(v),
    "Use um endereço completo (https://...) ou uma página do site (/eventos)",
  );

export const bioLinkSchema = z.object({
  id: z.string().optional(),
  label: z.string().trim().min(1, "Informe o texto do botão").max(40),
  url: destino,
  icon: z.enum(ICONES),
  isVisible: z.boolean(),
});

export const bioLinksSchema = z.array(bioLinkSchema).max(20);

export type BioLink = z.infer<typeof bioLinkSchema>;
