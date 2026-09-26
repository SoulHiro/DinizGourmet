import { ImageResponse } from "next/og";

// Ícone provisório gerado em código (monograma "XD" nas cores da marca).
// Trocar por um PNG da logo oficial em public/ quando estiver pronta.
export const GET = async (
  _request: Request,
  { params }: { params: Promise<{ tamanho: string }> },
) => {
  const tamanho = (await params).tamanho === "192" ? 192 : 512;
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#5a3a22",
        color: "#fbf6ef",
        fontSize: tamanho * 0.42,
        fontWeight: 800,
        letterSpacing: -tamanho * 0.02,
      }}
    >
      XD
    </div>,
    { width: tamanho, height: tamanho },
  );
};
