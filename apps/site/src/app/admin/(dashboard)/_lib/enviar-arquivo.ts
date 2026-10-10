// Lado do navegador do upload (ver app/admin/upload/route.ts).
export const enviarArquivo = async (
  arquivo: File,
  tipo: "cartaz" | "cardapio",
) => {
  if (arquivo.size > 4 * 1024 * 1024) {
    throw new Error(
      "Arquivo maior que 4 MB. Reduza o tamanho e tente de novo.",
    );
  }

  const corpo = new FormData();
  corpo.append("arquivo", arquivo);
  corpo.append("tipo", tipo);

  const resposta = await fetch("/admin/upload", {
    method: "POST",
    body: corpo,
  });
  const dados = (await resposta.json().catch(() => ({}))) as {
    url?: string;
    erro?: string;
  };

  if (!resposta.ok || !dados.url) {
    throw new Error(dados.erro ?? "Não foi possível enviar o arquivo.");
  }
  return dados.url;
};
