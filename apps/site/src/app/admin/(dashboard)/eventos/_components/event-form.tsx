"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ImageIcon, Loader2Icon, Trash2Icon, UploadIcon } from "lucide-react";
import { useRef, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import type { events } from "@/db/schema";
import { SITE_CONFIG } from "@/lib/site-config";

import { enviarArquivo } from "../../_lib/enviar-arquivo";
import { createEvent, updateEvent } from "../actions";
import { type EventFormValues, eventFormSchema } from "../schemas";

const LOCAL_PADRAO = `${SITE_CONFIG.endereco} (${SITE_CONFIG.referencia})`;

const SELOS_SUGERIDOS =
  "Música ao vivo, Bebidas geladas, Ambiente agradável, Diversão garantida";

// Mesmo formulário para criar e editar evento.
export const EventForm = ({
  evento,
}: {
  evento?: typeof events.$inferSelect;
}) => {
  const [isPending, startTransition] = useTransition();
  const [enviandoCartaz, setEnviandoCartaz] = useState(false);
  const entradaCartaz = useRef<HTMLInputElement>(null);

  const form = useForm<EventFormValues>({
    resolver: zodResolver(eventFormSchema),
    defaultValues: {
      name: evento?.name ?? "",
      attraction: evento?.attraction ?? "",
      description: evento?.description ?? "",
      eventDate: evento?.eventDate ?? "",
      startTime: evento?.startTime.slice(0, 5) ?? "20:00",
      endTime: evento?.endTime?.slice(0, 5) ?? "",
      location: evento?.location ?? LOCAL_PADRAO,
      posterUrl: evento?.posterUrl ?? "",
      genres: evento?.genres.join(", ") ?? "",
      highlights: evento ? evento.highlights.join(", ") : SELOS_SUGERIDOS,
      isActive: evento?.isActive ?? true,
    },
  });

  const cartaz = form.watch("posterUrl");

  const enviarCartaz = async (arquivo: File) => {
    setEnviandoCartaz(true);
    try {
      const url = await enviarArquivo(arquivo, "cartaz");
      form.setValue("posterUrl", url, { shouldDirty: true });
      toast.success("Cartaz enviado. Salve o evento para publicar.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Não foi possível enviar.",
      );
    } finally {
      setEnviandoCartaz(false);
      if (entradaCartaz.current) entradaCartaz.current.value = "";
    }
  };

  const onSubmit = (data: EventFormValues) => {
    startTransition(async () => {
      try {
        if (evento) {
          await updateEvent(evento.id, data);
        } else {
          await createEvent(data);
        }
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : "Não foi possível salvar o evento.",
        );
      }
    });
  };

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="grid max-w-3xl gap-8 md:grid-cols-[180px_minmax(0,1fr)]"
      >
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium">Cartaz</span>
          <div className="relative flex aspect-[2/3] w-full max-w-[180px] items-center justify-center overflow-hidden rounded-lg border bg-muted">
            {cartaz ? (
              // biome-ignore lint/performance/noImgElement: prévia de upload
              <img
                src={cartaz}
                alt="Cartaz"
                className="size-full object-cover"
              />
            ) : (
              <ImageIcon className="size-8 text-muted-foreground" />
            )}
            {enviandoCartaz && (
              <div className="absolute inset-0 flex items-center justify-center bg-background/70">
                <Loader2Icon className="size-6 animate-spin" />
              </div>
            )}
          </div>
          <input
            ref={entradaCartaz}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => {
              const arquivo = e.target.files?.[0];
              if (arquivo) enviarCartaz(arquivo);
            }}
          />
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => entradaCartaz.current?.click()}
              disabled={enviandoCartaz}
            >
              <UploadIcon />
              {cartaz ? "Trocar" : "Enviar"}
            </Button>
            {cartaz && (
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="Remover cartaz"
                onClick={() =>
                  form.setValue("posterUrl", "", { shouldDirty: true })
                }
              >
                <Trash2Icon />
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Cartaz em pé (retrato), JPG ou PNG até 4 MB.
          </p>
        </div>

        <div className="flex flex-col gap-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="attraction"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Atração (título da página)</FormLabel>
                  <FormControl>
                    <Input placeholder="Marcos Valença" {...field} />
                  </FormControl>
                  <FormDescription>
                    É o título grande na página.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome interno do evento</FormLabel>
                  <FormControl>
                    <Input placeholder="Marcos Valença ao vivo" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <FormField
              control={form.control}
              name="eventDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Data</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="startTime"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Início</FormLabel>
                  <FormControl>
                    <Input type="time" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="endTime"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Término</FormLabel>
                  <FormControl>
                    <Input type="time" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="location"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Local</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="genres"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Estilos musicais</FormLabel>
                <FormControl>
                  <Input placeholder="Sertanejo, Forró, Piseiro" {...field} />
                </FormControl>
                <FormDescription>Separados por vírgula.</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="highlights"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Selos (até 4 aparecem)</FormLabel>
                <FormControl>
                  <Input placeholder={SELOS_SUGERIDOS} {...field} />
                </FormControl>
                <FormDescription>
                  Separados por vírgula, como no cartaz.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Sobre o show</FormLabel>
                <FormControl>
                  <textarea
                    rows={4}
                    placeholder="Uma noite com o melhor do sertanejo..."
                    className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-base shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 md:text-sm"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="isActive"
            render={({ field }) => (
              <FormItem className="flex flex-row items-center gap-3">
                <FormControl>
                  <input
                    type="checkbox"
                    checked={field.value}
                    onChange={(e) => field.onChange(e.target.checked)}
                    className="size-4 accent-primary"
                  />
                </FormControl>
                <FormLabel className="font-normal">
                  Reservas abertas pelo site
                </FormLabel>
              </FormItem>
            )}
          />

          <Button
            type="submit"
            disabled={isPending || enviandoCartaz}
            className="self-start"
          >
            {isPending && <Loader2Icon className="animate-spin" />}
            {evento ? "Salvar alterações" : "Criar evento"}
          </Button>
        </div>
      </form>
    </Form>
  );
};
