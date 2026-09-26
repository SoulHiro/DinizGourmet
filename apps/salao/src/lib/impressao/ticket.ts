import {
  CharacterSet,
  PrinterTypes,
  ThermalPrinter,
} from "node-thermal-printer";

import { colunas, type Linha, type Tamanho } from "./layout";

// A montagem do ticket (ordem, estilos, textos) fica em layout.ts, que também
// roda no navegador para a pré-visualização. Aqui só o que depende da
// impressora: transformar as linhas em ESC/POS ou em texto puro.
export {
  type LayoutImpressao,
  type Linha,
  montarLinhas,
  type TipoTicket,
} from "./layout";

export const renderizarTexto = (linhas: Linha[], largura: number) =>
  linhas
    .map((linha) => {
      if (linha.tipo === "separador") return "-".repeat(largura);
      if (linha.tipo === "espaco") return "";
      if (linha.tipo === "colunas")
        return colunas(linha.esquerda, linha.direita, largura);
      if (!linha.centro) return linha.texto;
      const margem = Math.max(
        0,
        Math.floor((largura - linha.texto.length) / 2),
      );
      return " ".repeat(margem) + linha.texto;
    })
    .join("\n");

// "ASCII" imprime sem acentos (Ç vira C): funciona em qualquer impressora,
// inclusive as que ignoram a troca de tabela de caracteres.
export type Codepage =
  | "PC850_MULTILINGUAL"
  | "PC860_PORTUGUESE"
  | "WPC1252"
  | "ASCII";

const semAcentos = (texto: string) =>
  texto.normalize("NFD").replace(/\p{Diacritic}/gu, "");

const linhaSemAcentos = (linha: Linha): Linha => {
  if (linha.tipo === "texto") {
    return { ...linha, texto: semAcentos(linha.texto) };
  }
  if (linha.tipo === "colunas") {
    return {
      ...linha,
      esquerda: semAcentos(linha.esquerda),
      direita: semAcentos(linha.direita),
    };
  }
  return linha;
};

// Multiplicador de altura/largura do ESC/POS (0 = 1x, 1 = 2x, 2 = 3x).
const ESCALA: Record<Tamanho, number> = { normal: 0, grande: 1, gigante: 2 };

export const renderizarEscPos = (
  linhasOriginais: Linha[],
  largura: number,
  codepage: Codepage,
): Buffer => {
  const linhas =
    codepage === "ASCII"
      ? linhasOriginais.map(linhaSemAcentos)
      : linhasOriginais;
  // A interface nunca é usada: só montamos o buffer e quem envia é o Winspool.
  const printer = new ThermalPrinter({
    type: PrinterTypes.EPSON,
    interface: "tcp://127.0.0.1:9100",
    width: largura,
    characterSet:
      codepage === "ASCII" ? CharacterSet.PC437_USA : CharacterSet[codepage],
    removeSpecialCharacters: false,
    lineCharacter: "-",
  });

  for (const linha of linhas) {
    if (linha.tipo === "separador") {
      printer.drawLine();
      continue;
    }
    if (linha.tipo === "espaco") {
      printer.newLine();
      continue;
    }
    if (linha.tipo === "colunas") {
      printer.bold(Boolean(linha.negrito));
      printer.println(colunas(linha.esquerda, linha.direita, largura));
      printer.bold(false);
      continue;
    }
    const escala = ESCALA[linha.tamanho ?? "normal"];
    if (linha.centro) printer.alignCenter();
    printer.bold(Boolean(linha.negrito));
    if (escala) printer.setTextSize(escala, escala);
    // Destaque: impressão invertida (fundo escuro, letra da cor do papel).
    if (linha.destaque) printer.invert(true);
    printer.println(linha.texto);
    if (linha.destaque) printer.invert(false);
    if (escala) printer.setTextNormal();
    printer.bold(false);
    if (linha.centro) printer.alignLeft();
  }

  printer.newLine();
  printer.cut();
  return printer.getBuffer();
};
