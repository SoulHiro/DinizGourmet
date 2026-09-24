import { z } from "zod";

export const eventFormSchema = z.object({
  name: z.string().trim().min(1, "Nome é obrigatório"),
  attraction: z.string().trim().optional(),
  description: z.string().trim().optional(),
  eventDate: z.string().min(1, "Data é obrigatória"),
  startTime: z.string().min(1, "Horário de início é obrigatório"),
  endTime: z.string().optional(),
  location: z.string().trim().min(1, "Local é obrigatório"),
});

export type EventFormValues = z.infer<typeof eventFormSchema>;
