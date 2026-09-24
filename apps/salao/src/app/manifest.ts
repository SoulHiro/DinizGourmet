import type { MetadataRoute } from "next";

// Instalável na tela inicial dos celulares (exige HTTPS na rede local).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Xis Diniz — Salão",
    short_name: "Xis Diniz",
    description: "Painel do garçom do Xis Diniz",
    start_url: "/garcom",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#17110c",
    theme_color: "#5a3a22",
    lang: "pt-BR",
    icons: [
      { src: "/icons/192", sizes: "192x192", type: "image/png" },
      { src: "/icons/512", sizes: "512x512", type: "image/png" },
      {
        src: "/icons/512",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
