import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { put } from "@vercel/blob";

// Upload de cartazes e do cardápio em PDF. Em produção vai para o Vercel
// Blob (precisa de BLOB_READ_WRITE_TOKEN, criado ao ativar o Blob no painel
// da Vercel). Sem o token, só em desenvolvimento, grava em public/uploads.

export const TIPOS_PERMITIDOS = {
  imagem: ["image/jpeg", "image/png", "image/webp"],
  pdf: ["application/pdf"],
} as const;

// Limite de corpo das funções da Vercel é 4,5 MB.
export const TAMANHO_MAXIMO = 4 * 1024 * 1024;

export class ErroUpload extends Error {}

const nomeSeguro = (nome: string) =>
  nome
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9.]+/g, "-")
    .replace(/^-+|-+$/g, "");

export const salvarArquivo = async (
  arquivo: File,
  pasta: "cartazes" | "cardapio",
  tipo: keyof typeof TIPOS_PERMITIDOS,
) => {
  if (!(TIPOS_PERMITIDOS[tipo] as readonly string[]).includes(arquivo.type)) {
    throw new ErroUpload(
      tipo === "pdf"
        ? "Envie um arquivo PDF."
        : "Envie uma imagem JPG, PNG ou WebP.",
    );
  }
  if (arquivo.size > TAMANHO_MAXIMO) {
    throw new ErroUpload(
      "Arquivo maior que 4 MB. Reduza o tamanho e tente de novo.",
    );
  }

  const nome = `${randomUUID().slice(0, 8)}-${nomeSeguro(arquivo.name)}`;

  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const blob = await put(`${pasta}/${nome}`, arquivo, {
      access: "public",
      contentType: arquivo.type,
    });
    return blob.url;
  }

  if (process.env.NODE_ENV === "production") {
    throw new ErroUpload(
      "Armazenamento de arquivos não configurado (ative o Blob na Vercel).",
    );
  }

  const destino = path.join(process.cwd(), "public", "uploads", pasta);
  await mkdir(destino, { recursive: true });
  await writeFile(
    path.join(destino, nome),
    Buffer.from(await arquivo.arrayBuffer()),
  );
  return `/uploads/${pasta}/${nome}`;
};
