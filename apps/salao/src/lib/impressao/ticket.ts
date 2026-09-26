import {
  CharacterSet,
  PrinterTypes,
  ThermalPrinter,
} from "node-thermal-printer";

import type {
  ContaImpressa,
  SetorImpressora,
  TicketItem,
  TicketPayload,
} from "@/db/schema";
import { type MetodoPagamento, ROTULO_METODO } from "@/lib/dominio/pagamento";

export type TipoTicket =
  | "pedido"
  | "cancelamento"
  | "reimpressao"
  | "alteracao"
  | "conta";

type Linha =
  | {
      tipo: "texto";
      texto: string;
      negrito?: boolean;
      grande?: boolean;
      centro?: boolean;
    }
  // Descrição à esquerda e valor à direita (conta do cliente).
  | {
      tipo: "colunas";
      esquerda: string;
      direita: string;
      negrito?: boolean;
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
  if (tipo === "conta" && payload.conta) {
    return linhasDaConta(payload.mesas, payload.conta);
  }
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
  } else if (tipo === "alteracao") {
    linhas.push({
      tipo: "texto",
      texto: "*** ALTERACAO ***",
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

  const linhasDoItem = (item: TicketItem, destaque: boolean) => {
    const codigo = item.codigo ? `${item.codigo} - ` : "";
    linhas.push({
      tipo: "texto",
      texto: `${item.quantidade}x ${codigo}${item.nome.toUpperCase()}`,
      negrito: destaque,
      grande: destaque,
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
  };

  if (tipo === "alteracao" && payload.antes?.length) {
    linhas.push({ tipo: "texto", texto: "ERA:", negrito: true });
    for (const item of payload.antes) linhasDoItem(item, false);
    linhas.push({ tipo: "texto", texto: "AGORA:", negrito: true });
  }
  for (const item of payload.itens) linhasDoItem(item, true);

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

// Valor em reais só com ASCII (o Intl usa espaço não separável).
const reais = (centavos: number) =>
  `R$ ${(centavos / 100)
    .toFixed(2)
    .replace(".", ",")
    .replace(/\B(?=(\d{3})+(?!\d))/g, ".")}`;

const dataHora = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  });

// Conta do cliente: pré-conta (mesa aberta, taxa sugerida e opcional) ou
// comprovante (paga, com os pagamentos e o troco). Não é documento fiscal.
const linhasDaConta = (mesas: number[], conta: ContaImpressa): Linha[] => {
  const [principal, ...agrupadas] = mesas;
  const valor = (
    esquerda: string,
    centavos: number,
    negrito = false,
  ): Linha => ({
    tipo: "colunas",
    esquerda,
    direita: reais(centavos),
    negrito,
  });
  const linhas: Linha[] = [
    {
      tipo: "texto",
      texto: conta.restaurante.toUpperCase(),
      negrito: true,
      centro: true,
    },
    {
      tipo: "texto",
      texto: conta.paga ? "COMPROVANTE DE PAGAMENTO" : "CONFERENCIA DE CONTA",
      centro: true,
    },
    {
      tipo: "texto",
      texto: `MESA ${principal}${agrupadas.length ? ` (+${agrupadas.join(", ")})` : ""}`,
      negrito: true,
      grande: true,
    },
    { tipo: "texto", texto: `Aberta: ${dataHora(conta.abertaEm)}` },
  ];
  if (conta.fechadaEm) {
    linhas.push({
      tipo: "texto",
      texto: `Paga:   ${dataHora(conta.fechadaEm)}`,
    });
  }
  if (conta.garcons.length) {
    linhas.push({
      tipo: "texto",
      texto: `Atendimento: ${conta.garcons.join(", ")}`,
    });
  }
  linhas.push({ tipo: "separador" });

  for (const item of conta.itens) {
    linhas.push(valor(`${item.quantidade}x ${item.nome}`, item.totalCentavos));
    if (agrupadas.length && item.mesaOrigem !== principal) {
      linhas.push({ tipo: "texto", texto: `   (mesa ${item.mesaOrigem})` });
    }
  }
  linhas.push({ tipo: "separador" }, valor("Consumo", conta.subtotalCentavos));
  if (conta.descontoCentavos > 0) {
    linhas.push({
      tipo: "colunas",
      esquerda: `Desconto${conta.descontoNome ? ` (${conta.descontoNome})` : ""}`,
      direita: `-${reais(conta.descontoCentavos)}`,
    });
  }

  const semTaxa = conta.subtotalCentavos - conta.descontoCentavos;
  if (!conta.paga) {
    linhas.push(
      valor(`Taxa de servico ${conta.taxaPct}% (opcional)`, conta.taxaCentavos),
      { tipo: "espaco" },
      valor("TOTAL COM TAXA", semTaxa + conta.taxaCentavos, true),
      valor("Total sem taxa", semTaxa),
    );
  } else {
    if (conta.taxaCentavos > 0) {
      linhas.push(
        valor(`Taxa de servico ${conta.taxaPct}%`, conta.taxaCentavos),
      );
    }
    if (conta.gorjetaCentavos > 0) {
      linhas.push(valor("Gorjeta", conta.gorjetaCentavos));
    }
    linhas.push({ tipo: "espaco" }, valor("TOTAL", conta.totalCentavos, true));
  }

  if (conta.porMesa.length > 1) {
    linhas.push(
      { tipo: "espaco" },
      { tipo: "texto", texto: "Consumo por mesa:" },
    );
    for (const m of conta.porMesa) {
      linhas.push(valor(`  Mesa ${m.numero}`, m.totalCentavos));
    }
  }

  if (conta.paga && conta.pagamentos.length) {
    linhas.push(
      { tipo: "separador" },
      { tipo: "texto", texto: "PAGAMENTO", negrito: true },
    );
    for (const p of conta.pagamentos) {
      linhas.push(
        valor(
          ROTULO_METODO[p.metodo as MetodoPagamento] ?? p.metodo,
          p.valorCentavos,
        ),
      );
      if (p.metodo === "dinheiro" && p.recebidoCentavos) {
        linhas.push(valor("  Recebido", p.recebidoCentavos));
        linhas.push(valor("  Troco", p.trocoCentavos));
      }
    }
  }

  linhas.push(
    { tipo: "separador" },
    { tipo: "texto", texto: "Nao e documento fiscal", centro: true },
    { tipo: "texto", texto: "Obrigado pela preferencia!", centro: true },
  );
  return linhas;
};

// Encaixa descrição + valor na largura, cortando a descrição se precisar.
const colunas = (esquerda: string, direita: string, largura: number) => {
  const espaco = largura - direita.length - 1;
  const texto =
    esquerda.length > espaco ? `${esquerda.slice(0, espaco - 1)}.` : esquerda;
  return (
    texto +
    " ".repeat(Math.max(1, largura - texto.length - direita.length)) +
    direita
  );
};

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
