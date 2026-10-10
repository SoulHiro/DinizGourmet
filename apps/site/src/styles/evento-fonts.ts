import {
  Montserrat,
  Oswald,
  Playfair_Display,
  Yellowtail,
} from "next/font/google";

export const eventoSerif = Playfair_Display({
  subsets: ["latin"],
  weight: ["500", "600", "700", "900"],
  style: ["normal", "italic"],
  variable: "--font-evento-serif",
});

export const eventoSans = Montserrat({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-evento-sans",
});

// Condensada e pesada, como os nomes dos artistas nos cartazes.
// Fonte variável: um arquivo só cobre os pesos 200–700. Pedir pesos soltos
// gerava várias URLs que o build da Vercel (Turbopack) não resolvia.
export const eventoDisplay = Oswald({
  subsets: ["latin"],
  variable: "--font-evento-display",
});

export const eventoScript = Yellowtail({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-evento-script",
});
