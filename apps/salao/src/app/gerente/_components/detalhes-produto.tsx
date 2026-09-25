"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Camera, Film, Loader2, Star, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { api, ErroApi } from "@/lib/cliente";
import { cn } from "@/lib/utils";

export type DetalhesEditaveis = {
  id: string;
  nome: string;
  descricao: string | null;
  fotoUrl: string | null;
  videoUrl: string | null;
  ingredientes: string[];
  destaque: boolean;
};

const enviarArquivo = async (arquivo: File, tipo: "foto" | "video") => {
  const dados = new FormData();
  dados.append("arquivo", arquivo);
  dados.append("tipo", tipo);
  const resposta = await fetch("/api/gerente/midia", {
    method: "POST",
    body: dados,
  });
  const corpo = await resposta.json().catch(() => null);
  if (!resposta.ok) {
    throw new ErroApi(
      resposta.status,
      corpo?.codigo ?? "erro",
      corpo?.mensagem ?? "Falha no envio.",
    );
  }
  return corpo as { url: string };
};

// O que aparece para o cliente no cardápio digital (QR da mesa).
export const DetalhesProduto = ({
  produto,
  onFechar,
}: {
  produto: DetalhesEditaveis | null;
  onFechar: () => void;
}) => {
  const queryClient = useQueryClient();
  const [descricao, setDescricao] = useState("");
  const [ingredientes, setIngredientes] = useState("");
  const [fotoUrl, setFotoUrl] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [destaque, setDestaque] = useState(false);
  const [enviando, setEnviando] = useState<"foto" | "video" | null>(null);

  useEffect(() => {
    if (produto) {
      setDescricao(produto.descricao ?? "");
      setIngredientes(produto.ingredientes.join(", "));
      setFotoUrl(produto.fotoUrl);
      setVideoUrl(produto.videoUrl);
      setDestaque(produto.destaque);
    }
  }, [produto]);

  const salvar = useMutation({
    mutationFn: () =>
      api(`/api/gerente/produtos/${produto?.id}`, {
        method: "PATCH",
        json: {
          descricao: descricao.trim() || null,
          ingredientes: ingredientes
            .split(",")
            .map((i) => i.trim())
            .filter(Boolean),
          fotoUrl,
          videoUrl,
          destaque,
        },
      }),
    onSuccess: () => {
      toast.success("Cardápio atualizado");
      queryClient.invalidateQueries({ queryKey: ["gerente", "produtos"] });
      onFechar();
    },
    onError: (e) => toast.error(e.message),
  });

  const aoEscolher = async (
    arquivo: File | undefined,
    tipo: "foto" | "video",
  ) => {
    if (!arquivo) return;
    setEnviando(tipo);
    try {
      const { url } = await enviarArquivo(arquivo, tipo);
      if (tipo === "foto") setFotoUrl(url);
      else setVideoUrl(url);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha no envio.");
    } finally {
      setEnviando(null);
    }
  };

  if (!produto) return null;

  return (
    <Drawer open onOpenChange={(v) => !v && onFechar()}>
      <DrawerContent className="h-[92dvh]">
        <DrawerHeader className="text-left">
          <DrawerTitle className="text-xl">{produto.nome}</DrawerTitle>
          <p className="text-sm text-texto-secundario">
            Como aparece no cardápio do cliente (QR da mesa)
          </p>
        </DrawerHeader>

        <div className="flex flex-1 flex-col gap-5 overflow-y-auto px-4">
          <section className="flex flex-col gap-2">
            <p className="font-semibold">Foto</p>
            {fotoUrl ? (
              <div className="relative">
                {/* biome-ignore lint/performance/noImgElement: prévia da foto enviada ao servidor local */}
                <img
                  src={fotoUrl}
                  alt={produto.nome}
                  className="aspect-[4/3] w-full rounded-2xl object-cover"
                />
                <Button
                  size="icon"
                  variant="destrutivo"
                  aria-label="Remover foto"
                  className="absolute top-2 right-2"
                  onClick={() => setFotoUrl(null)}
                >
                  <Trash2 />
                </Button>
              </div>
            ) : null}
            <label
              className={cn(
                "flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-borda border-dashed font-semibold",
                enviando === "foto" && "pointer-events-none opacity-60",
              )}
            >
              {enviando === "foto" ? (
                <Loader2 className="animate-spin" />
              ) : (
                <Camera />
              )}
              {fotoUrl ? "Trocar foto" : "Tirar ou escolher foto"}
              <input
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={(e) => aoEscolher(e.target.files?.[0], "foto")}
              />
            </label>
          </section>

          <section className="flex flex-col gap-2">
            <p className="font-semibold">
              Vídeo{" "}
              <span className="font-normal text-sm text-texto-secundario">
                (opcional, até ~15 s, MP4)
              </span>
            </p>
            {videoUrl && (
              <div className="relative">
                <video
                  src={videoUrl}
                  muted
                  loop
                  autoPlay
                  playsInline
                  className="aspect-[4/3] w-full rounded-2xl bg-black object-cover"
                />
                <Button
                  size="icon"
                  variant="destrutivo"
                  aria-label="Remover vídeo"
                  className="absolute top-2 right-2"
                  onClick={() => setVideoUrl(null)}
                >
                  <Trash2 />
                </Button>
              </div>
            )}
            <label
              className={cn(
                "flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-borda border-dashed font-semibold",
                enviando === "video" && "pointer-events-none opacity-60",
              )}
            >
              {enviando === "video" ? (
                <Loader2 className="animate-spin" />
              ) : (
                <Film />
              )}
              {videoUrl ? "Trocar vídeo" : "Enviar vídeo"}
              <input
                type="file"
                accept="video/mp4,video/webm,video/quicktime"
                className="sr-only"
                onChange={(e) => aoEscolher(e.target.files?.[0], "video")}
              />
            </label>
          </section>

          <label className="flex flex-col gap-1">
            <span className="font-semibold">Descrição</span>
            <textarea
              value={descricao}
              maxLength={400}
              rows={3}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Ex.: O clássico gaúcho prensado na chapa..."
              className="rounded-lg border border-borda bg-surface p-3"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="font-semibold">O que vem</span>
            <input
              value={ingredientes}
              onChange={(e) => setIngredientes(e.target.value)}
              placeholder="Pão, hambúrguer, queijo, ovo... (separe por vírgula)"
              className="h-12 rounded-lg border border-borda bg-surface px-3"
            />
          </label>

          <button
            type="button"
            aria-pressed={destaque}
            onClick={() => setDestaque((d) => !d)}
            className={cn(
              "flex min-h-14 items-center gap-3 rounded-xl border-2 px-4 text-left",
              destaque ? "border-acao bg-acao/10" : "border-borda",
            )}
          >
            <Star className={cn("size-6", destaque && "fill-acao text-acao")} />
            <span>
              <strong>Destaque da casa</strong>
              <span className="block text-sm text-texto-secundario">
                Aparece no banner do topo do cardápio
              </span>
            </span>
          </button>
        </div>

        <DrawerFooter>
          <Button
            variant="acao"
            size="lg"
            disabled={salvar.isPending || enviando !== null}
            onClick={() => salvar.mutate()}
          >
            {salvar.isPending ? <Loader2 className="animate-spin" /> : "Salvar"}
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
};
