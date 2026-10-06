// Dados de contato da casa, usados no rodapé dos eventos e na home
// (link-in-bio). Um lugar só para não desencontrar quando mudar.
export const SITE_CONFIG = {
  nome: "Xis Diniz",
  slogan: "Xis Gaúcho de verdade",
  endereco: "Rua Santa Cruz, 70 — Ribeirão dos Porcos, Atibaia/SP",
  referencia: "atrás do Frango Assado",
  whatsappNumber: "5511927417769",
  whatsappDisplay: "(11) 92741-7769",
  instagramHandle: "xisdiniz",
} as const;

export const whatsappLink = (message?: string) =>
  `https://wa.me/${SITE_CONFIG.whatsappNumber}${
    message ? `?text=${encodeURIComponent(message)}` : ""
  }`;

export const instagramLink = () =>
  `https://instagram.com/${SITE_CONFIG.instagramHandle}`;

export const mapsLink = (query: string) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
