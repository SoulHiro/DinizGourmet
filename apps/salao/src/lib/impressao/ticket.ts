import {
  CharacterSet,
  PrinterTypes,
  ThermalPrinter,
} from "node-thermal-printer";

import type { SetorImpressora, TicketPayload } from "@/db/schema";

export type TipoTicket = "pedido" | "cancelamento" | "reimpressao";

type Linha =
  | {
      tipo: "texto";
      texto: string;
      negrito?: boolean;
      grande?: boolean;
      centro?: boolean;
    }
  | { tipo: "separador" }
  | { tipo: "espaco" };

const TITULO_SETOR: Record<SetorImpressora, string> = {
  chapa: "CHAPA",
  fritura: "FRITURA",
  bar: "BAR",
  caixa: "CAIXA",
};

const hora = (iso: string) =>
  new Date(iso).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  });

// Layout único do ticket; os renderizadores abaixo transformam em
// ESC/POS (impressora) ou texto puro (driver de arquivo em dev/testes).
export const montarLinhas = (
  tipo: TipoTicket,
  setor: SetorImpressora,
  payload: TicketPayload,
): Linha[] => {
  const [mesaPrincipal, ...agrupadas] = payload.mesas;
  const linhas: Linha[] = [];

  if (tipo === "cancelamento") {
    linhas.push({
      tipo: "texto",
      texto: "*** CANCELAMENTO ***",
      negrito: true,
      grande: true,
      centro: true,
    });
  } else if (tipo === "reimpressao") {
    linhas.push({
      tipo: "texto",
      texto: "REIMPRESSAO",
      negrito: true,
      centro: true,
    });
  }

  linhas.push(
    { tipo: "texto", texto: TITULO_SETOR[setor], negrito: true, centro: true },
    {
      tipo: "texto",
      texto: `MESA ${mesaPrincipal}${agrupadas.length ? ` (+${agrupadas.join(", ")})` : ""}`,
      negrito: true,
      grande: true,
    },
    {
      tipo: "texto",
      texto: `Rodada ${payload.rodada} - ${payload.garcom} - ${hora(payload.lancadaEm)}`,
    },
    { tipo: "separador" },
  );

  for (const item of payload.itens) {
    linhas.push({
      tipo: "texto",
      texto: `${item.quantidade}x ${item.nome.toUpperCase()}`,
      negrito: true,
      grande: true,
    });
    for (const modificador of item.modificadores) {
      linhas.push({
        tipo: "texto",
        texto: `   - ${modificador}`,
        negrito: true,
      });
    }
    if (item.observacao) {
      linhas.push({
        tipo: "texto",
        texto: `   OBS: ${item.observacao}`,
        negrito: true,
      });
    }
    if (agrupadas.length && item.mesaOrigem !== mesaPrincipal) {
      linhas.push({ tipo: "texto", texto: `   (mesa ${item.mesaOrigem})` });
    }
    linhas.push({ tipo: "espaco" });
  }

  if (tipo === "cancelamento") {
    linhas.push({ tipo: "separador" });
    if (payload.motivo) {
      linhas.push({ tipo: "texto", texto: `Motivo: ${payload.motivo}` });
    }
    linhas.push({
      tipo: "texto",
      texto: payload.preparoIniciado
        ? "Preparo ja tinha iniciado"
        : "NAO PREPARAR",
      negrito: true,
    });
  }

  linhas.push({ tipo: "separador" });
  return linhas;
};

export const renderizarTexto = (linhas: Linha[], largura: number) =>
  linhas
    .map((linha) => {
      if (linha.tipo === "separador") return "-".repeat(largura);
      if (linha.tipo === "espaco") return "";
      if (!linha.centro) return linha.texto;
      const margem = Math.max(
        0,
        Math.floor((largura - linha.texto.length) / 2),
      );
      return " ".repeat(margem) + linha.texto;
    })
    .join("\n");

export const renderizarEscPos = (
  linhas: Linha[],
  largura: number,
  codepage: "PC850_MULTILINGUAL" | "PC860_PORTUGUESE" | "WPC1252",
): Buffer => {
  // A interface nunca é usada: só montamos o buffer e quem envia é o Winspool.
  const printer = new ThermalPrinter({
    type: PrinterTypes.EPSON,
    interface: "tcp://127.0.0.1:9100",
    width: largura,
    characterSet: CharacterSet[codepage],
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
    if (linha.centro) printer.alignCenter();
    printer.bold(Boolean(linha.negrito));
    if (linha.grande) printer.setTextSize(1, 1);
    printer.println(linha.texto);
    if (linha.grande) printer.setTextNormal();
    printer.bold(false);
    if (linha.centro) printer.alignLeft();
  }

  printer.newLine();
  printer.cut();
  return printer.getBuffer();
};
