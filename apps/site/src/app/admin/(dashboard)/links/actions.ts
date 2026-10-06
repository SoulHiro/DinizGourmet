"use server";

import { revalidatePath } from "next/cache";

import { db } from "@/db";
import { bioLinks } from "@/db/schema";
import { exigirAdmin } from "@/lib/admin-auth";
import { type BioLink, bioLinksSchema } from "@/lib/bio-links";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Salva a lista inteira de uma vez, na ordem em que está na tela. Trocar
// tudo numa transação é mais simples que comparar linha a linha, e nada
// mais no banco aponta para os links.
export const salvarLinks = async (entrada: BioLink[]) => {
  await exigirAdmin();
  const links = bioLinksSchema.parse(entrada);

  await db.transaction(async (tx) => {
    await tx.delete(bioLinks);
    if (links.length > 0) {
      await tx.insert(bioLinks).values(
        links.map((link, position) => ({
          id: link.id && UUID.test(link.id) ? link.id : undefined,
          label: link.label,
          url: link.url,
          icon: link.icon,
          isVisible: link.isVisible,
          position,
        })),
      );
    }
  });

  revalidatePath("/");
  revalidatePath("/admin/links");
};
