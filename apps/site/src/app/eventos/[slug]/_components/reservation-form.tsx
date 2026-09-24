"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2Icon, Loader2Icon } from "lucide-react";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { PatternFormat } from "react-number-format";
import { toast } from "sonner";
import type { z } from "zod";

import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";

import { createReservation } from "../../actions/create-reservation";
import { reservationFormSchema } from "../../schemas";

type ReservationFormInput = z.input<typeof reservationFormSchema>;
type ReservationFormOutput = z.output<typeof reservationFormSchema>;

interface ReservationFormProps {
  eventId: string;
}

const fieldClass =
  "h-12 rounded-sm border-[var(--evento-gold)]/30 bg-black/20 text-base text-[var(--evento-cream)] placeholder:text-[var(--evento-cream-dim)]/60 focus-visible:border-[var(--evento-amber)] focus-visible:ring-[var(--evento-amber)]/30";

export const ReservationForm = ({ eventId }: ReservationFormProps) => {
  const [isPending, startTransition] = useTransition();
  const [confirmed, setConfirmed] = useState(false);

  const form = useForm<ReservationFormInput, unknown, ReservationFormOutput>({
    resolver: zodResolver(reservationFormSchema),
    defaultValues: {
      customerName: "",
      whatsapp: "",
      partySize: 1,
    },
  });

  const onSubmit = (data: ReservationFormOutput) => {
    startTransition(async () => {
      try {
        await createReservation({ eventId, ...data });
        setConfirmed(true);
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : "Não deu para confirmar a reserva. Tente de novo.",
        );
      }
    });
  };

  if (confirmed) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-sm border border-[var(--evento-gold)]/30 bg-black/20 py-10 text-center">
        <CheckCircle2Icon className="size-10 text-[var(--evento-amber)]" />
        <p className="evento-serif text-2xl text-[var(--evento-cream)]">
          Reserva confirmada!
        </p>
        <p className="evento-sans text-sm text-[var(--evento-cream-dim)]">
          Guardamos sua mesa para o evento. Nos vemos lá!
        </p>
      </div>
    );
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="evento-sans flex flex-col gap-5"
      >
        <FormField
          control={form.control}
          name="customerName"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs tracking-[0.2em] text-[var(--evento-gold)] uppercase">
                Nome
              </FormLabel>
              <FormControl>
                <Input
                  placeholder="Seu nome"
                  className={fieldClass}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="whatsapp"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs tracking-[0.2em] text-[var(--evento-gold)] uppercase">
                WhatsApp
              </FormLabel>
              <FormControl>
                <PatternFormat
                  placeholder="(00) 00000-0000"
                  format="(##) #####-####"
                  mask="_"
                  customInput={Input}
                  className={fieldClass}
                  value={field.value}
                  onValueChange={(values) =>
                    field.onChange(values.formattedValue)
                  }
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="partySize"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs tracking-[0.2em] text-[var(--evento-gold)] uppercase">
                Quantidade de pessoas
              </FormLabel>
              <FormControl>
                <Input
                  type="number"
                  min={1}
                  max={20}
                  className={fieldClass}
                  {...field}
                  value={field.value as number}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <button
          type="submit"
          disabled={isPending}
          className="mt-2 flex items-center justify-center gap-2 rounded-sm bg-[var(--evento-amber)] px-6 py-4 text-sm font-semibold tracking-wide text-[var(--evento-bg-deep)] uppercase shadow-[0_8px_30px_-8px_rgb(237_147_22/0.6)] transition-transform duration-200 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-60"
        >
          {isPending && <Loader2Icon className="size-4 animate-spin" />}
          Confirmar reserva
        </button>
      </form>
    </Form>
  );
};
