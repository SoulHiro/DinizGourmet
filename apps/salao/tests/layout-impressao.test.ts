import { describe, expect, it } from "vitest";

import {
  exemploConta,
  exemploPedido,
  layoutPadrao,
  montarLinhas,
  normalizarLayout,
} from "@/lib/impressao/layout";
import { renderizarEscPos, renderizarTexto } from "@/lib/impressao/ticket";

const texto = (linhas: ReturnType<typeof montarLinhas>) =>
  renderizarTexto(linhas, 48);

describe("layout do ticket", () => {
  it("padrão: mesa em destaque e sem o número do cardápio", () => {
    const linhas = montarLinhas("pedido", "chapa", exemploPedido());
    const mesa = linhas.find(
      (l) => l.tipo === "texto" && l.texto.includes("MESA 5"),
    );
    expect(mesa).toMatchObject({
      destaque: true,
      tamanho: "grande",
      negrito: true,
      texto: " MESA 5 ",
    });
    expect(texto(linhas)).toContain("2x XIS BAH TCHÊ! - BACON");
    expect(texto(linhas)).not.toContain("2 - XIS");
  });

  it("mesa e itens são obrigatórios; bloco desconhecido e lixo são ignorados", () => {
    const layout = normalizarLayout("pedido", {
      blocos: [
        { id: "mesa", ativo: false },
        { id: "itens", ativo: false },
        { id: "inventado", ativo: true },
        { id: "setor", ativo: "sim", estilo: { tamanho: "enorme" } },
      ],
    });
    const porId = Object.fromEntries(layout.blocos.map((b) => [b.id, b]));
    expect(porId.mesa.ativo).toBe(true);
    expect(porId.itens.ativo).toBe(true);
    expect(porId.inventado).toBeUndefined();
    // Valores inválidos voltam ao padrão.
    expect(porId.setor.ativo).toBe(true);
    expect(porId.setor.estilo.tamanho).toBe("normal");
    // Todos os blocos do catálogo continuam presentes.
    expect(layout.blocos).toHaveLength(layoutPadrao("pedido").blocos.length);
  });

  it("respeita a ordem, os textos livres e as opções", () => {
    const layout = normalizarLayout("pedido", {
      blocos: [
        {
          id: "texto_topo",
          ativo: true,
          opcoes: { texto: "XIS DINIZ\nCozinha" },
        },
        {
          id: "itens",
          ativo: true,
          opcoes: { codigo: true, maiusculas: false },
        },
        { id: "mesa", ativo: true, opcoes: { prefixo: "" } },
        { id: "detalhes", ativo: false },
        { id: "setor", ativo: false },
      ],
    });
    const saida = texto(montarLinhas("pedido", "bar", exemploPedido(), layout));
    const linhas = saida.split("\n").map((l) => l.trim());
    expect(linhas[0]).toBe("XIS DINIZ");
    expect(linhas[1]).toBe("Cozinha");
    expect(saida).toContain("2x 2 - Xis Bah Tchê! - Bacon");
    expect(saida).not.toContain("BAR");
    expect(saida).not.toContain("Rodada");
    // Itens antes da mesa, como foi pedido; mesa sem prefixo (linha "5").
    const linhaDaMesa = linhas.lastIndexOf("5");
    expect(linhaDaMesa).toBeGreaterThan(
      linhas.findIndex((l) => l.includes("Xis Bah")),
    );
  });

  it("cancelamento mantém o aviso fixo no topo, qualquer que seja o layout", () => {
    const layout = normalizarLayout("pedido", {
      blocos: [{ id: "texto_topo", ativo: true, opcoes: { texto: "Topo" } }],
    });
    const saida = texto(
      montarLinhas("cancelamento", "chapa", exemploPedido(), layout),
    );
    expect(saida.trim().startsWith("*** CANCELAMENTO ***")).toBe(true);
    expect(saida).toContain("NAO PREPARAR");
  });

  it("conta: rodapé personalizado e o aviso fiscal fixo", () => {
    const layout = normalizarLayout("conta", {
      blocos: [
        { id: "texto_topo", ativo: true, opcoes: { texto: "Rua X, 123" } },
        { id: "texto_rodape", ativo: true, opcoes: { texto: "Volte sempre" } },
        { id: "pagamentos", ativo: false },
      ],
    });
    const saida = texto(
      montarLinhas(
        "conta",
        "caixa",
        { ...exemploPedido(), conta: exemploConta("Xis Diniz", true) },
        layout,
      ),
    );
    expect(saida).toContain("Rua X, 123");
    expect(saida).toContain("Volte sempre");
    expect(saida).not.toContain("Troco");
    expect(saida).toContain("Nao e documento fiscal");
  });

  it("destaque vira impressão invertida e tamanho vira escala no ESC/POS", () => {
    const buffer = renderizarEscPos(
      montarLinhas("pedido", "chapa", exemploPedido()),
      48,
      "PC850_MULTILINGUAL",
    );
    const hex = buffer.toString("hex");
    expect(hex).toContain("1d4201"); // GS B 1: inverte (fundo escuro)
    expect(hex).toContain("1d4200"); // GS B 0: volta ao normal
    expect(hex).toContain("1d2111"); // GS ! 0x11: 2x (mesa grande)
  });
});
