// Textos do cardápio (os xis são os reais; o resto é provisório e o cardápio
// definitivo é mantido em /gerente).
const recheio = (...proteina: string[]) => [
  "Pão prensado na chapa",
  ...proteina,
  "Queijo derretido",
  "Ovo",
  "Milho",
  "Ervilha",
  "Alface",
  "Tomate",
  "Maionese da casa",
];

export const CARDAPIO_EXEMPLO: Record<
  string,
  { descricao: string; ingredientes: string[]; destaque?: boolean }
> = {
  "Xis Buenas - Clássico": {
    descricao:
      "Pão prensado na chapa, blend de carne 150g, queijo derretido, ovo, milho, ervilha, alface, tomate e maionese da casa. O xis clássico, do jeito que sempre foi.",
    ingredientes: recheio("Blend de carne 150g"),
  },
  "Xis Tri Bom - Frango": {
    descricao:
      "Pão prensado na chapa, frango desfiado temperado, queijo derretido, ovo, milho, ervilha, alface, tomate e maionese da casa. Leve, saboroso e satisfaz sem pesar.",
    ingredientes: recheio("Frango desfiado temperado"),
  },
  "Xis Gaudério - Calabresa": {
    descricao:
      "Pão prensado na chapa, blend de carne 150g, calabresa fatiada, queijo derretido, ovo, milho, ervilha, alface, tomate e maionese da casa. Tradição raiz em cada mordida.",
    ingredientes: recheio("Blend de carne 150g", "Calabresa fatiada"),
  },
  "Xis Bah Tchê! - Bacon": {
    descricao:
      "Pão prensado na chapa, blend de carne 150g, bacon crocante, queijo derretido, ovo, milho, ervilha, alface, tomate e maionese da casa. Pra quem gosta de sabor com força.",
    ingredientes: recheio("Blend de carne 150g", "Bacon crocante"),
    destaque: true,
  },
  "Xis Bagual - O Bruto da Casa": {
    descricao:
      "Pão prensado na chapa, blend de carne 200g, bacon, calabresa fatiada e frango desfiado, queijo derretido, ovo, milho, ervilha, alface, tomate e maionese da casa. O mais completo da casa, recheio de dar inveja.",
    ingredientes: recheio(
      "Blend de carne 200g",
      "Bacon",
      "Calabresa fatiada",
      "Frango desfiado",
    ),
    destaque: true,
  },
  "Batata Frita": {
    descricao: "Porção de batata crocante, sequinha e bem temperada.",
    ingredientes: ["Batata", "Sal"],
  },
  "Polenta Frita": {
    descricao: "Polenta cortada em palitos e frita até ficar dourada por fora.",
    ingredientes: ["Polenta", "Sal"],
  },
  "Anéis de Cebola": {
    descricao: "Anéis de cebola empanados e crocantes.",
    ingredientes: ["Cebola", "Empanado"],
  },
  "Refrigerante Lata": {
    descricao: "Lata 350 ml bem gelada.",
    ingredientes: [],
  },
  "Água sem Gás": { descricao: "Garrafa 500 ml.", ingredientes: [] },
  "Cerveja Long Neck": {
    descricao: "Long neck 355 ml, trincando.",
    ingredientes: [],
  },
  "Suco Natural": {
    descricao: "Suco da fruta feito na hora (pergunte os sabores).",
    ingredientes: [],
  },
  Pudim: {
    descricao: "Pudim de leite com calda de caramelo, receita da família.",
    ingredientes: ["Leite", "Ovos", "Açúcar"],
  },
};
