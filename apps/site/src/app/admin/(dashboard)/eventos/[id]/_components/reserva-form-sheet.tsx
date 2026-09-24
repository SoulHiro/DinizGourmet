"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2Icon } from "lucide-react";
import { type ReactNode, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { PatternFormat } from "react-number-format";
import { toast } from "sonner";
import type { z } from "zod";

import { reservationFormSchema } from "@/app/eventos/schemas";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

import { createReservaAdmin, updateReserva } from "../../reservas-actions";

type ReservaFormInput = z.input<typeof reservationFormSchema>;
type ReservaFormOutput = z.output<typeof reservationFormSchema>;

interface ReservaFormSheetProps {
  eventId: string;
  trigger: ReactNode;
  reserva?: {
    id: string;
    customerName: string;
    whatsapp: string;
    partySize: number;
  };
}

export const ReservaFormSheet = ({
  eventId,
  trigger,
  reserva,
}: ReservaFormSheetProps) => {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const isEdit = Boolean(reserva);

  const form = useForm<ReservaFormInput, unknown, ReservaFormOutput>({
    resolver: zodResolver(reservationFormSchema),
    defaultValues: {
      customerName: reserva?.customerName ?? "",
      whatsapp: reserva?.whatsapp ?? "",
      partySize: reserva?.partySize ?? 1,
    },
  });

  const onSubmit = (data: ReservaFormOutput) => {
    startTransition(async () => {
      try {
        if (reserva) {
          await updateReserva(reserva.id, eventId, data);
          toast.success("Reserva atualizada.");
        } else {
          await createReservaAdmin(eventId, data);
          toast.success("Reserva criada.");
          form.reset();
        }
        setOpen(false);
      } catch {
        toast.error("Não foi possível salvar a reserva.");
      }
    });
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>{trigger}</SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>{isEdit ? "Editar reserva" : "Nova reserva"}</SheetTitle>
        </SheetHeader>
        <div className="flex flex-col gap-5 px-4">
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(onSubmit)}
              className="flex flex-col gap-5"
            >
              <FormField
                control={form.control}
                name="customerName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome</FormLabel>
                    <FormControl>
                      <Input placeholder="Nome do cliente" {...field} />
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
                    <FormLabel>WhatsApp</FormLabel>
                    <FormControl>
                      <PatternFormat
                        placeholder="(00) 00000-0000"
                        format="(##) #####-####"
                        mask="_"
                        customInput={Input}
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
                    <FormLabel>Quantidade de pessoas</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={1}
                        max={20}
                        {...field}
                        value={field.value as number}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" disabled={isPending}>
                {isPending && <Loader2Icon className="animate-spin" />}
                {isEdit ? "Salvar alterações" : "Criar reserva"}
              </Button>
            </form>
          </Form>
        </div>
      </SheetContent>
    </Sheet>
  );
};
