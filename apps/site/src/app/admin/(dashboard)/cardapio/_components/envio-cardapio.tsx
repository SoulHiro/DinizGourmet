"use client";

import {
  ExternalLinkIcon,
  FileTextIcon,
  Loader2Icon,
  UploadIcon,
} from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

import { enviarArquivo } from "../../_lib/enviar-arquivo";
import { definirCardapio } from "../actions";

export const EnvioCardapio = ({
  urlAtual,
  atualizadoEm,
}: {
  urlAtual: string | null;
  atualizadoEm: string | null;
}) => {
  const entrada = useRef<HTMLInputElement>(null);
  const [enviando, setEnviando] = useState(false);

  const enviar = async (arquivo: File) => {
    setEnviando(true);
    try {
      const url = await enviarArquivo(arquivo, "cardapio");
      await definirCardapio(url);
      toast.success("Cardápio atualizado. O /cardapio já abre o novo PDF.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Não foi possível enviar.",
      );
    } finally {
      setEnviando(false);
      if (entrada.current) entrada.current.value = "";
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-4 rounded-lg border p-4">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-md bg-muted">
          <FileTextIcon className="size-6 text-muted-foreground" />
        </span>
        <div className="min-w-0 flex-1">
          {urlAtual ? (
            <>
              <p className="font-medium">Cardápio publicado</p>
              <p className="text-sm text-muted-foreground">
                Atualizado em{" "}
                {atualizadoEm &&
                  new Date(atualizadoEm).toLocaleString("pt-BR", {
                    dateStyle: "short",
                    timeStyle: "short",
                    timeZone: "America/Sao_Paulo",
                  })}
              </p>
            </>
          ) : (
            <>
              <p className="font-medium">Nenhum cardápio enviado</p>
              <p className="text-sm text-muted-foreground">
                Até enviar, o /cardapio mostra um aviso de “em atualização”.
              </p>
            </>
          )}
        </div>
        {urlAtual && (
          <Button asChild variant="outline" size="sm">
            <a href="/cardapio" target="_blank" rel="noopener noreferrer">
              Abrir
              <ExternalLinkIcon />
            </a>
          </Button>
        )}
      </div>

      <input
        ref={entrada}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={(e) => {
          const arquivo = e.target.files?.[0];
          if (arquivo) enviar(arquivo);
        }}
      />
      <Button
        type="button"
        onClick={() => entrada.current?.click()}
        disabled={enviando}
        className="self-start"
      >
        {enviando ? <Loader2Icon className="animate-spin" /> : <UploadIcon />}
        {urlAtual ? "Trocar PDF" : "Enviar PDF"}
      </Button>
      <p className="text-xs text-muted-foreground">
        PDF de até 4 MB. Se ficar maior, exporte com qualidade de imagem menor.
      </p>
    </div>
  );
};
