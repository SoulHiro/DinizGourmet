import { randomUUID } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

import { env } from "@/lib/env";
import { invalido } from "@/lib/erros";

// Fotos e vídeos do cardápio ficam no disco do PC do restaurante (sem
// internet) e são servidos pelo Express em /midia.
export const pastaMidia = () => path.resolve(env().MIDIA_DIR);

const MAX_FOTO_BYTES = 15 * 1024 * 1024;
const MAX_VIDEO_BYTES = 40 * 1024 * 1024;
const TIPOS_VIDEO: Record<string, string> = {
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/quicktime": "mov",
};

// Foto do celular (3–5 MB) vira WebP leve em dois tamanhos: 1200px para a
// tela do produto e 480px para os cards (miniatura = mesmo nome + "-p").
export const salvarFoto = async (arquivo: File) => {
  if (!arquivo.type.startsWith("image/"))
    throw invalido("Envie uma imagem (JPG, PNG ou WebP).");
  if (arquivo.size > MAX_FOTO_BYTES)
    throw invalido("Foto muito grande (máximo 15 MB).");

  const entrada = Buffer.from(await arquivo.arrayBuffer());
  const id = randomUUID();
  await mkdir(pastaMidia(), { recursive: true });
  try {
    const base = sharp(entrada).rotate(); // respeita a orientação da câmera
    await Promise.all([
      base
        .clone()
        .resize({
          width: 1200,
          height: 1200,
          fit: "inside",
          withoutEnlargement: true,
        })
        .webp({ quality: 80 })
        .toFile(path.join(pastaMidia(), `${id}.webp`)),
      base
        .clone()
        .resize({ width: 480, height: 480, fit: "cover" })
        .webp({ quality: 72 })
        .toFile(path.join(pastaMidia(), `${id}-p.webp`)),
    ]);
  } catch {
    throw invalido("Não consegui ler essa imagem. Tente JPG ou PNG.");
  }
  return { url: `/midia/${id}.webp` };
};

export const salvarVideo = async (arquivo: File) => {
  const extensao = TIPOS_VIDEO[arquivo.type];
  if (!extensao) throw invalido("Envie um vídeo MP4 ou WebM.");
  if (arquivo.size > MAX_VIDEO_BYTES)
    throw invalido("Vídeo muito grande (máximo 40 MB, ~15 segundos).");
  const nome = `${randomUUID()}.${extensao}`;
  await mkdir(pastaMidia(), { recursive: true });
  await writeFile(
    path.join(pastaMidia(), nome),
    Buffer.from(await arquivo.arrayBuffer()),
  );
  return { url: `/midia/${nome}` };
};

// Miniatura para os cards (fotos enviadas pelo sistema têm a versão "-p").
export const miniatura = (fotoUrl: string | null) =>
  fotoUrl?.startsWith("/midia/") && fotoUrl.endsWith(".webp")
    ? fotoUrl.replace(/\.webp$/, "-p.webp")
    : fotoUrl;

// Apaga um arquivo de /midia (e a miniatura, se for foto). Só mexe dentro
// da pasta de mídia e ignora arquivo que já não existe.
export const apagarMidia = async (url: string) => {
  if (!url.startsWith("/midia/")) return;
  const nome = path.basename(url);
  const arquivos = nome.endsWith(".webp")
    ? [nome, nome.replace(/\.webp$/, "-p.webp")]
    : [nome];
  await Promise.all(
    arquivos.map((a) => rm(path.join(pastaMidia(), a), { force: true })),
  );
};
