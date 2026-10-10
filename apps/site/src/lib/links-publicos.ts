import { asc, eq } from "drizzle-orm";

import { db } from "@/db";
import { bioLinks, siteSettings } from "@/db/schema";

import type { IconeLink } from "./bio-links";

export const CHAVE_CARDAPIO = "cardapio_pdf_url";

export const listarBioLinks = async () => {
  const linhas = await db
    .select()
    .from(bioLinks)
    .orderBy(asc(bioLinks.position));
  return linhas.map((l) => ({ ...l, icon: l.icon as IconeLink }));
};

export const lerConfiguracao = async (chave: string) => {
  const [linha] = await db
    .select()
    .from(siteSettings)
    .where(eq(siteSettings.key, chave));
  return linha ?? null;
};
