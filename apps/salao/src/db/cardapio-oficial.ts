// Cardápio oficial da casa (PDF "menu A4", outubro/2026). Aplicado por
// `pnpm cardapio:atualizar` (scripts/cardapio-oficial.ts). Preços em centavos.

export type SetorImpressao = "chapa" | "fritura" | "bar";

export type ItemOficial = {
  nome: string;
  preco: number;
  descricao?: string;
  ingredientes?: string[];
  destaque?: boolean;
  // Nomes antigos (sem acento, minúsculo, prefixo) que viram este item em
  // vez de criar outro: preserva foto e histórico.
  antigos?: string[];
  // Contagem de estoque (aba Estoque) que este item gasta. Em categoria
  // contada, o padrão é o próprio item gastar 1 de si mesmo.
  estoque?: { insumo: string; quantidade: number } | null;
};

export type CategoriaOficial = {
  nome: string;
  antigos?: string[];
  setor: SetorImpressao;
  // Bebida de lata/garrafa: cada item vira uma linha na aba Estoque.
  contada?: boolean;
  itens: ItemOficial[];
};

// Cada categoria tem 50 códigos: a 1ª vai de 1 a 50, a 2ª de 51 a 100...
export const VAGAS_POR_CATEGORIA = 50;

export const faixaDeCodigos = (indiceCategoria: number) => ({
  codigoInicio: indiceCategoria * VAGAS_POR_CATEGORIA + 1,
  codigoFim: (indiceCategoria + 1) * VAGAS_POR_CATEGORIA,
});

const BASE_XIS = [
  "Pão prensado na chapa",
  "Queijo derretido",
  "Ovo",
  "Milho",
  "Ervilha",
  "Alface",
  "Tomate",
  "Maionese da casa",
];

const xis = (recheio: string[]) => [
  BASE_XIS[0],
  ...recheio,
  ...BASE_XIS.slice(1),
];

// Meia porção: 60% da inteira, arredondado para terminar em ,90. O gerente
// ajusta no painel se a casa cobrar diferente.
const precoMeia = (inteira: number) =>
  Math.max(990, Math.round((inteira * 0.6 - 90) / 100) * 100 + 90);

const porcao = (item: ItemOficial): ItemOficial[] => [
  item,
  {
    ...item,
    nome: `${item.nome} (meia)`,
    preco: precoMeia(item.preco),
    antigos: undefined,
    destaque: false,
  },
];

export const CARDAPIO_OFICIAL: CategoriaOficial[] = [
  {
    nome: "Xis Gaúcho",
    antigos: ["lanches", "xis"],
    setor: "chapa",
    itens: [
      {
        nome: "Xis Gaudério",
        preco: 3990,
        descricao:
          "Pão prensado na chapa, blend de carne 150g, queijo derretido, ovo, milho, ervilha, alface, tomate e maionese da casa. O xis clássico, do jeito que sempre foi.",
        ingredientes: xis(["Blend de carne 150g"]),
        antigos: ["xis gauderio"],
      },
      {
        nome: "Xis Tri Bom",
        preco: 4490,
        descricao:
          "Pão prensado na chapa, frango desfiado temperado, queijo derretido, ovo, milho, ervilha, alface, tomate e maionese da casa. Leve, saboroso e satisfaz sem pesar.",
        ingredientes: xis(["Frango desfiado temperado"]),
        antigos: ["xis tri bom"],
      },
      {
        nome: "Xis Buenas",
        preco: 4990,
        descricao:
          "Pão prensado na chapa, blend de carne 150g, calabresa fatiada, queijo derretido, ovo, milho, ervilha, alface, tomate e maionese da casa. Tradição raiz em cada mordida.",
        ingredientes: xis(["Blend de carne 150g", "Calabresa fatiada"]),
        antigos: ["xis buenas"],
      },
      {
        nome: "Xis Bah Tchê!",
        preco: 4990,
        descricao:
          "Pão prensado na chapa, blend de carne 150g, bacon crocante, queijo derretido, ovo, milho, ervilha, alface, tomate e maionese da casa. Pra quem gosta de sabor com força.",
        ingredientes: xis(["Blend de carne 150g", "Bacon crocante"]),
        antigos: ["xis bah tche"],
      },
      {
        nome: "Xis Bagual",
        preco: 5990,
        descricao:
          "Pão prensado na chapa, blend de carne 200g, bacon, calabresa fatiada e frango desfiado, queijo derretido, ovo, milho, ervilha, alface, tomate e maionese da casa. O mais completo da casa, recheio de dar inveja.",
        ingredientes: xis([
          "Blend de carne 200g",
          "Bacon",
          "Calabresa fatiada",
          "Frango desfiado",
        ]),
        destaque: true,
        antigos: ["xis bagual"],
      },
    ],
  },
  {
    nome: "Porções",
    setor: "fritura",
    itens: [
      ...porcao({ nome: "Calabresa", preco: 8990 }),
      ...porcao({ nome: "Contra Filé", preco: 6990 }),
      ...porcao({ nome: "Frango a Passarinho", preco: 3290 }),
      ...porcao({ nome: "Iscas de Frango", preco: 3490 }),
      ...porcao({ nome: "Iscas de Tilápia", preco: 8990 }),
      ...porcao({
        nome: "Batata Frita c/ Bacon",
        preco: 4290,
        antigos: ["batata frita c/bacon", "batata frita com bacon"],
      }),
      ...porcao({ nome: "Batata Frita", preco: 3290 }),
      ...porcao({
        nome: "Porção Mista",
        preco: 8290,
        descricao: "Contra filé, frango e linguiça.",
        ingredientes: ["Contra filé", "Frango", "Linguiça"],
      }),
    ],
  },
  {
    nome: "Refrigerantes",
    antigos: ["bebidas"],
    setor: "bar",
    contada: true,
    itens: [
      { nome: "Coca-Cola 200ml", preco: 350, antigos: ["coca cola 200ml"] },
      { nome: "Coca-Cola Lata 350ml", preco: 850, antigos: ["coca cola lata"] },
      { nome: "Coca-Cola 600ml", preco: 1250, antigos: ["coca cola 600ml"] },
      { nome: "Coca-Cola 2 litros", preco: 2000, antigos: ["coca cola 2"] },
      { nome: "Guaraná Antarctica 200ml", preco: 350 },
      {
        nome: "Guaraná Antarctica Lata 350ml",
        preco: 850,
        antigos: ["guarana antarctica lata"],
      },
      { nome: "Guaraná Antarctica 600ml", preco: 1250 },
      {
        nome: "Guaraná Antarctica 2 litros",
        preco: 1900,
        antigos: ["guarana antarctica 2"],
      },
      {
        nome: "Fanta Laranja Lata 350ml",
        preco: 850,
        antigos: ["fanta laranja"],
      },
      { nome: "Sprite Limão Lata 350ml", preco: 850, antigos: ["sprite"] },
      {
        nome: "Schweppes Citrus Lata 350ml",
        preco: 1250,
        antigos: ["schweppes citrus"],
      },
      {
        nome: "Schweppes Tônica Lata 350ml",
        preco: 1250,
        antigos: ["schweppes tonica"],
      },
      { nome: "Pepsi Black Lata 350ml", preco: 850, antigos: ["pepsi black"] },
    ],
  },
  {
    nome: "Águas e Refrescos",
    setor: "bar",
    contada: true,
    itens: [
      { nome: "Água sem Gás", preco: 550 },
      { nome: "Água com Gás", preco: 650 },
      { nome: "Água Tônica Antarctica", preco: 900 },
      { nome: "Água Tônica Antarctica Zero", preco: 900 },
      { nome: "H2O Limoneto", preco: 1050, antigos: ["h20 limoneto"] },
      { nome: "H2O Limão", preco: 1050, antigos: ["h20 limao"] },
    ],
  },
  {
    nome: "Cervejas",
    setor: "bar",
    contada: true,
    itens: [
      { nome: "Heineken 600ml", preco: 2290 },
      {
        nome: "Balde com 5 Heineken",
        preco: 9990,
        antigos: ["balde heineken"],
        estoque: { insumo: "Heineken 600ml", quantidade: 5 },
      },
      {
        nome: "Heineken Zero Álcool 330ml",
        preco: 1200,
        antigos: ["heineken zero"],
      },
      { nome: "Original 600ml", preco: 1990 },
      {
        nome: "Balde com 5 Original",
        preco: 8990,
        antigos: ["balde original"],
        estoque: { insumo: "Original 600ml", quantidade: 5 },
      },
      // Chopp sai do barril: não tem contagem por unidade.
      { nome: "Chopp 300ml", preco: 990, estoque: null },
      { nome: "Chopp 500ml", preco: 1290, estoque: null },
    ],
  },
  {
    nome: "Drinks",
    setor: "bar",
    itens: [
      {
        nome: "Caipirinha da Casa",
        preco: 3490,
        descricao: "Pinga 51 ou Velho Barreiro, limão e abacaxi.",
        ingredientes: ["Pinga 51 ou Velho Barreiro", "Limão", "Abacaxi"],
      },
      {
        nome: "Caipiroska da Casa",
        preco: 3490,
        descricao: "Vodka, limão e abacaxi.",
        ingredientes: ["Vodka", "Limão", "Abacaxi"],
      },
      { nome: "Gin da Casa", preco: 3290 },
      {
        nome: "Margarita",
        preco: 3290,
        descricao: "Tequila, licor, suco de limão e xarope.",
        ingredientes: ["Tequila", "Licor", "Suco de limão", "Xarope"],
      },
      {
        nome: "Mojito",
        preco: 3290,
        descricao: "Rum, limão, água com gás e hortelã.",
        ingredientes: ["Rum", "Limão", "Água com gás", "Hortelã"],
      },
      {
        nome: "Tom Collins",
        preco: 3290,
        descricao: "Gin, limão-siciliano, xarope e água tônica.",
        ingredientes: ["Gin", "Limão-siciliano", "Xarope", "Água tônica"],
      },
      {
        nome: "Tequila Sunrise",
        preco: 3490,
        descricao: "Tequila, suco de laranja e groselha.",
        ingredientes: ["Tequila", "Suco de laranja", "Groselha"],
      },
      {
        nome: "Negroni",
        preco: 3490,
        descricao: "Vermute, Campari, gin e rodela de laranja.",
        ingredientes: ["Vermute", "Campari", "Gin", "Rodela de laranja"],
      },
    ],
  },
];

// Contagem que o item gasta (null = sem controle de estoque).
export const estoqueDoItem = (
  categoria: CategoriaOficial,
  item: ItemOficial,
) => {
  if (item.estoque !== undefined) return item.estoque;
  return categoria.contada ? { insumo: item.nome, quantidade: 1 } : null;
};

// Descontos que o garçom pode aplicar (aba Descontos). Criados só se ainda
// não existir um com o mesmo nome; o gerente ajusta ou desativa depois.
export const DESCONTOS_PADRAO: {
  nome: string;
  tipo: "percentual" | "valor";
  valor: number;
  ativo?: boolean;
  somenteGerente?: boolean;
}[] = [
  { nome: "Aniversariante", tipo: "percentual", valor: 10 },
  { nome: "Funcionário", tipo: "percentual", valor: 30, somenteGerente: true },
  { nome: "Cliente fiel", tipo: "percentual", valor: 5 },
  { nome: "Parceiro / influenciador", tipo: "percentual", valor: 15 },
  { nome: "Grupo grande (10+ pessoas)", tipo: "percentual", valor: 10 },
  // Começa desativado: o garçom zerar a conta precisa ser decisão do gerente.
  {
    nome: "Cortesia da casa",
    tipo: "percentual",
    valor: 100,
    ativo: false,
    somenteGerente: true,
  },
];
