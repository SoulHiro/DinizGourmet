"use client";

import { useQuery } from "@tanstack/react-query";
import JsBarcode from "jsbarcode";
import { ChevronLeft, Loader2, Printer } from "lucide-react";
import Link from "next/link";
import QRCode from "qrcode";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { api } from "@/lib/cliente";
import type { CartaoGerencia } from "@/lib/dominio/cartoes";

type Qr = { publicUrl: string | null };

// O código de barras leva o número com 3 dígitos (007): o leitor "digita"
// isso e aperta Enter; as telas aceitam 7 ou 007.
const codigoDeBarras = (numero: number) => {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  JsBarcode(svg, String(numero).padStart(3, "0"), {
    format: "CODE128",
    height: 40,
    width: 2,
    margin: 0,
    displayValue: false,
  });
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg.outerHTML)}`;
};

// Cartões de comanda para imprimir e plastificar: número grande, QR (o
// cliente vê a conta dele) e código de barras (o caixa acha a comanda).
export default function CartoesPage() {
  const { data: cartoes, isLoading } = useQuery({
    queryKey: ["gerente", "cartoes"],
    queryFn: () => api<CartaoGerencia[]>("/api/gerente/cartoes"),
  });
  const { data: qr } = useQuery({
    queryKey: ["gerente", "qr"],
    queryFn: () => api<Qr>("/api/gerente/qr"),
  });
  const [imagens, setImagens] = useState<
    Record<string, { qr: string; barras: string }>
  >({});

  useEffect(() => {
    if (!cartoes || !qr) return;
    const origem = (qr.publicUrl || window.location.origin).replace(/\/$/, "");
    Promise.all(
      cartoes
        .filter((c) => c.ativo)
        .map(async (c) => [
          c.id,
          {
            qr: await QRCode.toDataURL(`${origem}/c/k/${c.tokenQr}`, {
              margin: 1,
              width: 220,
            }),
            barras: codigoDeBarras(c.numero),
          },
        ]),
    ).then((pares) => setImagens(Object.fromEntries(pares)));
  }, [cartoes, qr]);

  const ativos = cartoes?.filter((c) => c.ativo) ?? [];

  return (
    <div className="min-h-dvh bg-white p-4 text-black print:p-0">
      <div className="mb-4 flex flex-wrap items-center gap-2 print:hidden">
        <Link
          href="/gerente"
          className="flex h-12 items-center gap-1 rounded-lg border px-3 font-semibold"
        >
          <ChevronLeft /> Voltar
        </Link>
        <Button variant="acao" onClick={() => window.print()}>
          <Printer /> Imprimir {ativos.length} cartões
        </Button>
        <p className="text-sm text-neutral-600">
          Imprima em papel firme, recorte e plastifique. O QR leva o cliente à
          conta dele; o código de barras é para o leitor do caixa.
        </p>
      </div>

      {isLoading ? (
        <Loader2 className="mx-auto mt-10 size-8 animate-spin" />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 print:grid-cols-3 print:gap-2">
          {ativos.map((c) => (
            <div
              key={c.id}
              className="flex break-inside-avoid flex-col items-center gap-1 rounded-lg border-2 border-black border-dashed p-3"
            >
              <p className="font-bold text-xs tracking-widest">
                XIS DINIZ · COMANDA
              </p>
              <p className="font-black text-5xl leading-none">{c.numero}</p>
              {imagens[c.id] ? (
                <>
                  {/* biome-ignore lint/performance/noImgElement: imagem gerada no navegador, só para imprimir */}
                  <img
                    src={imagens[c.id].qr}
                    alt={`QR do cartão ${c.numero}`}
                    className="size-28"
                  />
                  {/* biome-ignore lint/performance/noImgElement: imagem gerada no navegador, só para imprimir */}
                  <img
                    src={imagens[c.id].barras}
                    alt={`Código de barras do cartão ${c.numero}`}
                    className="h-10 w-40"
                  />
                </>
              ) : (
                <Loader2 className="size-6 animate-spin" />
              )}
              <p className="text-center text-[10px] leading-tight">
                Aponte a câmera para ver sua conta
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
