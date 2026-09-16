import { z } from "zod";

export const reservationFormSchema = z.object({
  customerName: z.string().trim().min(1, "Nome é obrigatório"),
  whatsapp: z
    .string()
    .trim()
    .refine((value) => value.replace(/\D/g, "").length >= 10, {
      message: "WhatsApp inválido",
    }),
  partySize: z.coerce
    .number({ error: "Informe quantas pessoas" })
    .int()
    .min(1, "Mínimo de 1 pessoa")
    .max(20, "Para grupos maiores, chame no WhatsApp do restaurante"),
});

export type ReservationFormValues = z.infer<typeof reservationFormSchema>;
