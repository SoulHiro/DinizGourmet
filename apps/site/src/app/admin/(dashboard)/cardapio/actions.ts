"use server";

import { revalidatePath } from "next/cache";

import { db } from "@/db";
import { siteSettings } from "@/db/schema";
import { exigirAdmin } from "@/lib/admin-auth";
import { CHAVE_CARDAPIO } from "@/lib/links-publicos";

// Guarda o endereço do PDF já enviado (upload em app/admin/upload). O
// /cardapio público sempre redireciona para o último salvo.
export const definirCardapio = async (url: string) => {
  await exigirAdmin();
  if (!url.startsWith("/uploads/") && !/^https:\/\/[^\s]+$/.test(url)) {
    throw new Error("Endereço do cardápio inválido.");
  }

  await db
    .insert(siteSettings)
    .values({ key: CHAVE_CARDAPIO, value: url })
    .onConflictDoUpdate({
      target: siteSettings.key,
      set: { value: url, updatedAt: new Date() },
    });

  revalidatePath("/admin/cardapio");
};
