"use client";

import { BellRing, Check } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Drawer, DrawerContent, DrawerTitle } from "@/components/ui/drawer";
import type { ProdutoPublico } from "@/lib/dominio/cardapio-publico";
import { formatBRL } from "@/lib/utils";
import { FotoProduto } from "./foto-produto";

// Tela do produto: foto grande (ou vídeo em loop), o que vem no lanche,
// adicionais e o atalho para chamar o garçom e pedir.
export const DetalheProduto = ({
  produto,
  onFechar,
  onChamarGarcom,
  garcomChamado,
}: {
  produto: ProdutoPublico | null;
  onFechar: () => void;
  onChamarGarcom: () => void;
  garcomChamado: boolean;
}) => {
  if (!produto) return null;

  return (
    <Drawer open onOpenChange={(aberto) => !aberto && onFechar()}>
      <DrawerContent className="h-[94dvh] overflow-hidden">
        <div className="flex-1 overflow-y-auto">
          <div className="relative px-3 pt-3">
            {produto.videoUrl ? (
              <video
                src={produto.videoUrl}
                poster={produto.fotoUrl ?? undefined}
                autoPlay
                muted
                loop
                playsInline
                className="aspect-[4/3] w-full rounded-3xl bg-black object-cover"
              />
            ) : (
              <FotoProduto
                src={produto.fotoUrl}
                nome={produto.nome}
                prioridade
                tamanhoIcone="size-20"
                className="aspect-[4/3] w-full rounded-3xl"
              />
            )}
            {produto.esgotado && (
              <span className="absolute top-6 left-6 rounded-full bg-black/80 px-3 py-1.5 font-semibold text-sm text-white">
                Esgotado no momento
              </span>
            )}
          </div>

          <div className="flex flex-col gap-5 px-5 pt-4 pb-6">
            <div className="flex items-start justify-between gap-3">
              <DrawerTitle className="font-bold text-2xl leading-tight">
                {produto.nome}
              </DrawerTitle>
              <p className="shrink-0 font-bold text-2xl text-acao">
                {formatBRL(produto.precoCentavos)}
              </p>
            </div>

            {produto.descricao && (
              <p className="text-texto-secundario leading-relaxed">
                {produto.descricao}
              </p>
            )}

            {produto.ingredientes.length > 0 && (
              <section>
                <h3 className="mb-2 font-bold">O que vem</h3>
                <ul className="divide-y divide-borda rounded-2xl bg-fundo ring-1 ring-borda">
                  {produto.ingredientes.map((ingrediente) => (
                    <li
                      key={ingrediente}
                      className="flex items-center gap-3 px-4 py-2.5"
                    >
                      <Check className="size-4 shrink-0 text-status-livre" />
                      {ingrediente}
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        </div>

        <div className="border-borda border-t bg-surface p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <Button
            variant="acao"
            size="lg"
            className="w-full"
            disabled={garcomChamado}
            onClick={onChamarGarcom}
          >
            <BellRing />
            {garcomChamado
              ? "Garçom já foi chamado"
              : "Chamar garçom para pedir"}
          </Button>
        </div>
      </DrawerContent>
    </Drawer>
  );
};
