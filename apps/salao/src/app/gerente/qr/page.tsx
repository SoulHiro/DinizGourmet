"use client";

import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, Loader2, Printer } from "lucide-react";
import Link from "next/link";
import QRCode from "qrcode";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { api } from "@/lib/cliente";

type Dados = {
  publicUrl: string | null;
  mesas: { numero: number; token: string }[];
};

const enderecoLocal = (url: string) =>
  /\/\/(localhost|127\.|\[::1\])/.test(url);

// QR codes das mesas para imprimir e colar. Cada link tem o token secreto
// da mesa: o cliente só consegue chamar a própria mesa.
export default function QrMesasPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["gerente", "qr"],
    queryFn: () => api<Dados>("/api/gerente/qr"),
  });
  const [imagens, setImagens] = useState<Record<number, string>>({});
  const [base, setBase] = useState("");

  useEffect(() => {
    if (!data) return;
    const origem = (data.publicUrl || window.location.origin).replace(
      /\/$/,
      "",
    );
    setBase(origem);
    Promise.all(
      data.mesas.map(async (m) => [
        m.numero,
        await QRCode.toDataURL(`${origem}/c/${m.token}`, {
          margin: 1,
          width: 440,
        }),
      ]),
    ).then((pares) => setImagens(Object.fromEntries(pares)));
  }, [data]);

  return (
    <div className="min-h-dvh bg-white text-black">
      <header className="flex items-center gap-2 border-b p-3 print:hidden">
        <Link
          href="/gerente"
          aria-label="Voltar"
          className="flex size-12 items-center justify-center"
        >
          <ChevronLeft />
        </Link>
        <h1 className="flex-1 font-bold text-xl">QR codes das mesas</h1>
        <Button variant="acao" onClick={() => window.print()}>
          <Printer /> Imprimir
        </Button>
      </header>

      {base && enderecoLocal(base) && (
        <p className="m-3 rounded-lg bg-status-conta p-3 font-semibold text-white print:hidden">
          Atenção: estes QR apontam para {base}, que só funciona neste
          computador. Abra esta página pelo IP da rede (ex.:
          https://192.168.1.50:3000) ou defina PUBLIC_URL no .env antes de
          imprimir.
        </p>
      )}
      {base && !enderecoLocal(base) && (
        <p className="m-3 text-sm text-neutral-600 print:hidden">
          Os QR apontam para <strong>{base}</strong>. O cliente precisa estar no
          Wi-Fi do restaurante.
        </p>
      )}

      {isLoading && <Loader2 className="mx-auto mt-10 size-8 animate-spin" />}

      <div className="grid grid-cols-2 gap-4 p-4 sm:grid-cols-3 print:grid-cols-3">
        {data?.mesas.map((m) => (
          <div
            key={m.numero}
            className="flex break-inside-avoid flex-col items-center gap-1 rounded-xl border-2 border-black p-3 text-center"
          >
            <p className="font-bold text-lg">Xis Diniz</p>
            <p className="font-bold text-3xl">Mesa {m.numero}</p>
            {imagens[m.numero] ? (
              // biome-ignore lint/performance/noImgElement: data URL gerada no navegador, sem otimização possível
              <img
                src={imagens[m.numero]}
                alt={`QR code da mesa ${m.numero}`}
                className="aspect-square w-full max-w-[220px]"
              />
            ) : (
              <Loader2 className="my-10 size-6 animate-spin" />
            )}
            <p className="text-sm">
              Aponte a câmera para chamar o garçom ou pedir a conta
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
