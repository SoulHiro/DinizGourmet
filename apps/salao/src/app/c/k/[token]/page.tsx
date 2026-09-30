import { redirect } from "next/navigation";
import { ZodError } from "zod";

import { destinoDoCartao } from "@/lib/dominio/cliente";
import { ErroDominio } from "@/lib/erros";

export const dynamic = "force-dynamic";

// QR impresso no cartão da comanda. Leva o cliente para o cardápio da mesa
// onde a comanda dele está agora, já identificado (a conta é a dele).
export default async function CartaoPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  let destino: Awaited<ReturnType<typeof destinoDoCartao>> | null = null;
  try {
    destino = await destinoDoCartao(token);
  } catch (error) {
    // Token fora do formato ou cartão inexistente: mostra a mensagem abaixo.
    if (!(error instanceof ErroDominio) && !(error instanceof ZodError)) {
      throw error;
    }
  }

  if (destino?.mesaToken) {
    redirect(`/c/${destino.mesaToken}?cartao=${token}`);
  }

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-3 p-6 text-center">
      <p className="font-bold text-2xl text-marca">Xis Diniz</p>
      <p className="text-lg">
        {destino
          ? `O cartão ${destino.numero} ainda não está com uma comanda aberta.`
          : "Este QR code não é de um cartão válido."}
      </p>
      <p className="text-texto-secundario">
        Chame um garçom para abrir a sua comanda.
      </p>
    </main>
  );
}
