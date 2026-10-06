import { NextResponse } from "next/server";

import { exigirAdmin } from "@/lib/admin-auth";
import { ErroUpload, salvarArquivo } from "@/lib/armazenamento";

// Upload por rota (e não server action): server actions limitam o corpo a
// 1 MB e cartaz/cardápio passam disso. Campo "arquivo" + "tipo".
export const POST = async (request: Request) => {
  try {
    await exigirAdmin();
  } catch (error) {
    return NextResponse.json(
      { erro: (error as Error).message },
      { status: 401 },
    );
  }

  const form = await request.formData();
  const arquivo = form.get("arquivo");
  const tipo = form.get("tipo");

  if (
    !(arquivo instanceof File) ||
    (tipo !== "cartaz" && tipo !== "cardapio")
  ) {
    return NextResponse.json({ erro: "Envio inválido." }, { status: 400 });
  }

  try {
    const url =
      tipo === "cartaz"
        ? await salvarArquivo(arquivo, "cartazes", "imagem")
        : await salvarArquivo(arquivo, "cardapio", "pdf");
    return NextResponse.json({ url });
  } catch (error) {
    if (error instanceof ErroUpload) {
      return NextResponse.json({ erro: error.message }, { status: 400 });
    }
    console.error("Falha no upload", error);
    return NextResponse.json(
      { erro: "Não foi possível enviar o arquivo. Tente de novo." },
      { status: 500 },
    );
  }
};
