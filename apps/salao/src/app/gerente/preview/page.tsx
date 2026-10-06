"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Loader2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { DetalheProduto } from "@/app/c/[token]/_components/detalhe-produto";
import {
  type CategoriaVitrine,
  Vitrine,
} from "@/app/c/[token]/_components/vitrine";
import { api } from "@/lib/cliente";
import type { ProdutoPublico } from "@/lib/dominio/cardapio-publico";

// Prévia do cardápio do cliente sem abrir o QR de uma mesa. Mostra o mesmo
// que o cliente vê: itens indisponíveis somem, esgotados aparecem marcados.
export default function PreviewCardapioPage() {
  const [aberto, setAberto] = useState<ProdutoPublico | null>(null);
  const { data, isLoading } = useQuery({
    queryKey: ["gerente", "cardapio-preview"],
    queryFn: () => api<CategoriaVitrine[]>("/api/gerente/cardapio-preview"),
    refetchOnWindowFocus: true,
  });

  if (isLoading || !data) {
    return (
      <main className="flex min-h-dvh items-center justify-center">
        <Loader2 className="size-8 animate-spin text-texto-secundario" />
      </main>
    );
  }

  return (
    <div className="mx-auto min-h-dvh max-w-md pb-24">
      <Vitrine categorias={data} selo="Prévia" onAbrir={setAberto} />

      <Link
        href="/gerente"
        className="fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-30 mx-auto flex h-14 max-w-md items-center justify-center gap-2 rounded-3xl bg-texto font-semibold text-fundo shadow-xl"
      >
        <ArrowLeft className="size-5" /> Voltar para a gerência
      </Link>

      <DetalheProduto
        produto={aberto}
        onFechar={() => setAberto(null)}
        garcomChamado={false}
        onChamarGarcom={() => setAberto(null)}
      />
    </div>
  );
}
