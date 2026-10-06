"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
import { reaisParaCentavos } from "./campos";

const formatarReais = (centavos: number) =>
  (centavos / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });

export type DetalhesEditaveis = {
  id: string;
  nome: string;
  descricao: string | null;
  fotoUrl: string | null;
  videoUrl: string | null;
  ingredientes: string[];
  destaque: boolean;
  precoCentavos: number;
  custoCentavos: number | null;
  categoriaId: string;
  modificadorIds: string[];
};

type Opcao = { id: string; nome: string; tipo: string; ativo: boolean };

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
  categorias,
  onFechar,
}: {
  produto: DetalhesEditaveis | null;
  categorias: { id: string; nome: string }[];
  onFechar: () => void;
}) => {
  const queryClient = useQueryClient();
  const { data: opcoes = [] } = useQuery({
    queryKey: ["gerente", "opcoes"],
    queryFn: () => api<Opcao[]>("/api/gerente/opcoes"),
    enabled: Boolean(produto),
  });
  const [nome, setNome] = useState("");
  const [preco, setPreco] = useState("");
  const [custo, setCusto] = useState("");
  const [categoriaId, setCategoriaId] = useState("");
  const [chips, setChips] = useState<string[]>([]);
  const [confirmandoExclusao, setConfirmandoExclusao] = useState(false);
  const [descricao, setDescricao] = useState("");
  const [ingredientes, setIngredientes] = useState("");
  const [fotoUrl, setFotoUrl] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [destaque, setDestaque] = useState(false);
  const [enviando, setEnviando] = useState<"foto" | "video" | null>(null);

  useEffect(() => {
    if (produto) {
      setNome(produto.nome);
      setPreco((produto.precoCentavos / 100).toFixed(2).replace(".", ","));
      setCusto(
        produto.custoCentavos === null
          ? ""
          : (produto.custoCentavos / 100).toFixed(2).replace(".", ","),
      );
      setCategoriaId(produto.categoriaId);
      setChips(produto.modificadorIds);
      setConfirmandoExclusao(false);
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
          nome: nome.trim(),
          precoCentavos: reaisParaCentavos(preco),
          custoCentavos: custo.trim() ? reaisParaCentavos(custo) : null,
          categoriaId,
          modificadorIds: chips,
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
      queryClient.invalidateQueries({ queryKey: ["gerente", "opcoes"] });
      queryClient.invalidateQueries({ queryKey: ["cardapio"] });
      onFechar();
    },
    onError: (e) => toast.error(e.message),
  });

  const excluir = useMutation({
    mutationFn: () =>
      api<{ arquivado: boolean }>(`/api/gerente/produtos/${produto?.id}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      toast.success(`${produto?.nome} saiu do cardápio`);
      queryClient.invalidateQueries({ queryKey: ["gerente", "produtos"] });
      queryClient.invalidateQueries({ queryKey: ["cardapio"] });
      onFechar();
    },
    onError: (e) => toast.error(e.message),
  });

  const precoValido =
    Number.isFinite(reaisParaCentavos(preco)) &&
    (!custo.trim() || Number.isFinite(reaisParaCentavos(custo)));
  const precoNum = reaisParaCentavos(preco);
  const custoNum = custo.trim() ? reaisParaCentavos(custo) : null;
  const margem =
    custoNum !== null && Number.isFinite(custoNum) && precoNum > 0
      ? Math.round(((precoNum - custoNum) / precoNum) * 100)
      : null;
  const nomeValido = nome.trim().length >= 2 && precoValido;

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
          <label className="flex flex-col gap-1">
            <span className="font-semibold">Nome</span>
            <input
              value={nome}
              maxLength={60}
              onChange={(e) => setNome(e.target.value)}
              className="h-12 rounded-lg border border-borda bg-surface px-3"
            />
            {nome.trim().length < 2 && (
              <span className="text-destructive text-sm">
                O nome precisa de pelo menos 2 letras.
              </span>
            )}
          </label>

          <div className="grid grid-cols-[7rem_7rem_minmax(0,1fr)] gap-3">
            <label className="flex flex-col gap-1">
              <span className="font-semibold">Preço (R$)</span>
              <input
                inputMode="decimal"
                value={preco}
                onChange={(e) => setPreco(e.target.value)}
                aria-invalid={!precoValido}
                className="h-12 rounded-lg border border-borda bg-surface px-3 text-right font-bold tabular-nums"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="font-semibold">
                Custo{" "}
                <span className="font-normal text-sm text-texto-secundario">
                  (opcional)
                </span>
              </span>
              <input
                inputMode="decimal"
                placeholder="—"
                value={custo}
                onChange={(e) => setCusto(e.target.value)}
                className="h-12 rounded-lg border border-borda bg-surface px-3 text-right font-bold tabular-nums"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="font-semibold">Categoria</span>
              <select
                value={categoriaId}
                onChange={(e) => setCategoriaId(e.target.value)}
                className="h-12 rounded-lg border border-borda bg-surface px-2"
              >
                {categorias.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {margem !== null && (
            <p
              className={cn(
                "-mt-3 text-sm",
                margem < 0
                  ? "font-semibold text-destructive"
                  : "text-texto-secundario",
              )}
            >
              Lucro de {formatarReais(precoNum - (custoNum ?? 0))} por unidade ·
              margem {margem}%
            </p>
          )}
          {categoriaId !== produto.categoriaId && (
            <p className="-mt-3 text-sm text-texto-secundario">
              Vai para o fim da categoria nova e, se precisar, ganha um código
              da faixa dela.
            </p>
          )}

          {opcoes.length > 0 && (
            <section className="flex flex-col gap-2">
              <p className="font-semibold">
                Opções no pedido{" "}
                <span className="font-normal text-sm text-texto-secundario">
                  (o que o garçom pode marcar)
                </span>
              </p>
              <div className="flex flex-wrap gap-1.5">
                {opcoes
                  .filter((o) => o.ativo || chips.includes(o.id))
                  .map((o) => {
                    const ligado = chips.includes(o.id);
                    return (
                      <button
                        key={o.id}
                        type="button"
                        aria-pressed={ligado}
                        onClick={() =>
                          setChips((atual) =>
                            ligado
                              ? atual.filter((id) => id !== o.id)
                              : [...atual, o.id],
                          )
                        }
                        className={cn(
                          "min-h-10 rounded-full border px-3 text-sm",
                          ligado
                            ? "border-acao bg-acao/15 font-semibold"
                            : "border-borda text-texto-secundario",
                        )}
                      >
                        {o.nome}
                      </button>
                    );
                  })}
              </div>
            </section>
          )}

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

          <section className="mb-4 flex flex-col gap-2 rounded-xl border border-borda p-4">
            <p className="font-semibold">Tirar do cardápio</p>
            <p className="text-sm text-texto-secundario">
              Para sumir só por hoje, use “Indisponível” na lista. Excluir tira
              o item de vez; se ele já foi vendido, continua aparecendo nas
              comandas antigas.
            </p>
            <Button
              variant={confirmandoExclusao ? "destrutivo" : "outline"}
              disabled={excluir.isPending}
              onClick={() =>
                confirmandoExclusao
                  ? excluir.mutate()
                  : setConfirmandoExclusao(true)
              }
            >
              {excluir.isPending ? (
                <Loader2 className="animate-spin" />
              ) : (
                <Trash2 />
              )}
              {confirmandoExclusao
                ? "Toque de novo para excluir"
                : "Excluir do cardápio"}
            </Button>
          </section>
        </div>

        <DrawerFooter>
          <Button
            variant="acao"
            size="lg"
            disabled={salvar.isPending || enviando !== null || !nomeValido}
            onClick={() => salvar.mutate()}
          >
            {salvar.isPending ? <Loader2 className="animate-spin" /> : "Salvar"}
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
};
