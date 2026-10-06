import type { PainelNoite } from "@/lib/dominio/painel";
import { ROTULO_MOTIVO_SEM_TAXA } from "@/lib/dominio/taxa";

// Planilha do fechamento (CSV no padrão do Excel em português: ponto e
// vírgula, vírgula decimal e BOM para os acentos abrirem certo).

const METODO: Record<string, string> = {
  pix: "Pix",
  credito: "Crédito",
  debito: "Débito",
  dinheiro: "Dinheiro",
  vale_refeicao: "Vale-refeição",
};

const reais = (centavos: number) =>
  (centavos / 100).toFixed(2).replace(".", ",");

const celula = (valor: string | number) => {
  const texto = String(valor);
  return /[;"\n]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
};

const dataBr = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    dateStyle: "short",
    timeStyle: "short",
  });

export const exportarPainel = (dados: PainelNoite, nomeArquivo: string) => {
  const linhas: (string | number)[][] = [];
  const secao = (titulo: string, cabecalho: string[]) => {
    if (linhas.length) linhas.push([]);
    linhas.push([titulo]);
    linhas.push(cabecalho);
  };

  secao("Resumo", ["Indicador", "Valor"]);
  linhas.push(
    ["De", dataBr(dados.desde)],
    ["Até", dataBr(dados.ate)],
    ["Vendas lançadas (R$)", reais(dados.vendas.centavos)],
    ["Período anterior (R$)", reais(dados.vendas.anteriorCentavos)],
    ["Recebido no caixa (R$)", reais(dados.recebidoCentavos)],
    ["Comandas fechadas", dados.comandas.fechadas],
    ["Ticket médio (R$)", reais(dados.comandas.ticketMedioCentavos)],
    ["Itens vendidos", dados.vendas.itens],
    ["Gorjeta (R$)", reais(dados.gorjetaCentavos)],
    ["Taxa de serviço (R$)", reais(dados.taxaCentavos)],
    ["Descontos (R$)", reais(dados.descontoCentavos)],
    ["Itens cancelados", dados.cancelamentos.quantidade],
    ["Valor cancelado (R$)", reais(dados.cancelamentos.centavos)],
    ["Chamados", dados.chamados.total],
  );

  if (dados.dias > 1) {
    secao("Vendas por noite", ["Noite", "Vendas (R$)"]);
    for (const n of dados.vendasPorNoite)
      linhas.push([n.noite.split("-").reverse().join("/"), reais(n.centavos)]);
  } else {
    secao("Vendas por hora", ["Hora", "Vendas (R$)"]);
    for (const h of dados.vendasPorHora)
      linhas.push([`${h.hora}h`, reais(h.centavos)]);
  }

  secao("Por categoria", ["Categoria", "Itens", "Vendas (R$)"]);
  for (const c of dados.porCategoria)
    linhas.push([c.categoria, c.itens, reais(c.centavos)]);

  secao("Mais vendidos", ["Item", "Quantidade", "Vendas (R$)"]);
  for (const p of dados.topProdutos)
    linhas.push([p.nome, p.quantidade, reais(p.centavos)]);

  secao("Formas de pagamento", ["Forma", "Pagamentos", "Valor (R$)"]);
  for (const p of dados.pagamentos)
    linhas.push([
      METODO[p.metodo] ?? p.metodo,
      p.quantidade,
      reais(p.centavos),
    ]);

  secao("Equipe", [
    "Nome",
    "Vendas (R$)",
    "Gorjeta (R$)",
    "Taxa (R$)",
    "Descontos dados (R$)",
    "Contas sem taxa",
    "Chamados atendidos",
    "Cancelamentos",
  ]);
  for (const g of dados.garcons)
    linhas.push([
      g.nome,
      reais(g.vendasCentavos),
      reais(g.gorjetaCentavos),
      reais(g.taxaCentavos),
      reais(g.descontoCentavos),
      g.semTaxa,
      g.chamadosAtendidos,
      g.cancelamentos,
    ]);

  if (dados.cancelados.length) {
    secao("Cancelamentos", [
      "Quando",
      "Mesa",
      "Cartão",
      "Item",
      "Qtd",
      "Valor (R$)",
      "Quem",
      "Motivo",
      "Em preparo",
    ]);
    for (const c of dados.cancelados)
      linhas.push([
        dataBr(c.quando),
        c.mesa,
        c.comanda ?? "",
        c.nome,
        c.quantidade,
        reais(c.centavos),
        c.quem ?? "",
        c.motivo ?? "",
        c.preparoIniciado ? "sim" : "não",
      ]);
  }

  if (dados.semTaxa.length) {
    secao("Taxa não cobrada", ["Motivo", "Contas"]);
    for (const m of dados.semTaxa)
      linhas.push([ROTULO_MOTIVO_SEM_TAXA[m.motivo], m.quantidade]);
  }

  const csv = `﻿${linhas.map((l) => l.map(celula).join(";")).join("\r\n")}`;
  const url = URL.createObjectURL(
    new Blob([csv], { type: "text/csv;charset=utf-8" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = nomeArquivo;
  link.click();
  URL.revokeObjectURL(url);
};
