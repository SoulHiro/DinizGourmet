import { rota } from "@/lib/api";
import { exigirSessao } from "@/lib/auth/atual";
import { salvarFoto, salvarVideo } from "@/lib/dominio/midia";
import { invalido } from "@/lib/erros";

// Upload de foto ou vídeo de produto (form-data: arquivo + tipo).
export const POST = rota(async (request) => {
  await exigirSessao(["gerente"]);
  const dados = await request.formData();
  const arquivo = dados.get("arquivo");
  const tipo = dados.get("tipo");
  if (!(arquivo instanceof File)) throw invalido("Nenhum arquivo enviado.");
  const resultado =
    tipo === "video" ? await salvarVideo(arquivo) : await salvarFoto(arquivo);
  return Response.json(resultado, { status: 201 });
});
