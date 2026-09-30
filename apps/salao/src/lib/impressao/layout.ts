// Montagem do ticket a partir do layout configurado pelo gerente. Arquivo
// puro (sem addon de impressora): roda no servidor, para imprimir, e no
// navegador, para a pré-visualização da tela /gerente > Impressão. Assim o
// que aparece na tela é exatamente o que sai no papel.
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

// Impressora térmica: uma fonte só, 1x/2x/3x, negrito, alinhamento e
// impressão invertida (fundo escuro, letra da cor do papel).
export type Tamanho = "normal" | "grande" | "gigante";

export type Estilo = {
  tamanho: Tamanho;
  negrito: boolean;
  // Fundo escuro com a letra da cor do papel (como o número do pedido no iFood).
  destaque: boolean;
  centro: boolean;
};

export type Linha =
  | ({ tipo: "texto"; texto: string } & Partial<Estilo>)
  // Descrição à esquerda e valor à direita (conta do cliente).
  | { tipo: "colunas"; esquerda: string; direita: string; negrito?: boolean }
  | { tipo: "separador" }
  | { tipo: "espaco" };

export type ModeloImpressao = "pedido" | "conta";

export type BlocoLayout = {
  id: string;
  ativo: boolean;
  estilo: Estilo;
  opcoes: Record<string, boolean | string>;
};

export type LayoutImpressao = { blocos: BlocoLayout[] };

type OpcaoCatalogo = {
  chave: string;
  rotulo: string;
  tipo: "bool" | "texto";
  padrao: boolean | string;
  multilinha?: boolean;
};

export type BlocoCatalogo = {
  id: string;
  rotulo: string;
  // Mesa e itens nunca somem do ticket.
  obrigatorio?: boolean;
  // Quais controles de estilo fazem sentido (linhas com valor à direita não
  // mudam de tamanho, senão o valor não cabe na linha).
  estilos: (keyof Estilo)[];
  padrao: { ativo: boolean; estilo: Estilo };
  opcoes: OpcaoCatalogo[];
};

const ESTILO_NORMAL: Estilo = {
  tamanho: "normal",
  negrito: false,
  destaque: false,
  centro: false,
};
const TODOS: (keyof Estilo)[] = ["tamanho", "negrito", "destaque", "centro"];
const estilo = (parcial: Partial<Estilo> = {}): Estilo => ({
  ...ESTILO_NORMAL,
  ...parcial,
});

// Ordem aqui = ordem padrão no papel.
export const CATALOGO: Record<ModeloImpressao, BlocoCatalogo[]> = {
  pedido: [
    {
      id: "texto_topo",
      rotulo: "Texto no topo",
      estilos: TODOS,
      padrao: { ativo: false, estilo: estilo({ centro: true }) },
      opcoes: [
        {
          chave: "texto",
          rotulo: "Texto",
          tipo: "texto",
          padrao: "",
          multilinha: true,
        },
      ],
    },
    {
      id: "setor",
      rotulo: "Setor (CHAPA, BAR...)",
      estilos: TODOS,
      padrao: { ativo: true, estilo: estilo({ negrito: true, centro: true }) },
      opcoes: [],
    },
    {
      id: "mesa",
      rotulo: "Número da mesa",
      obrigatorio: true,
      estilos: TODOS,
      padrao: {
        ativo: true,
        estilo: estilo({
          tamanho: "grande",
          negrito: true,
          destaque: true,
          centro: true,
        }),
      },
      opcoes: [
        {
          chave: "prefixo",
          rotulo: "Texto antes do número",
          tipo: "texto",
          padrao: "MESA",
        },
      ],
    },
    {
      id: "comanda",
      rotulo: "Número da comanda (cartão)",
      estilos: TODOS,
      padrao: {
        ativo: true,
        estilo: estilo({ tamanho: "grande", negrito: true, centro: true }),
      },
      opcoes: [
        {
          chave: "prefixo",
          rotulo: "Texto antes do número",
          tipo: "texto",
          padrao: "COMANDA",
        },
      ],
    },
    {
      id: "detalhes",
      rotulo: "Rodada, garçom e horário",
      estilos: TODOS,
      padrao: { ativo: true, estilo: estilo() },
      opcoes: [
        { chave: "rodada", rotulo: "Rodada", tipo: "bool", padrao: true },
        { chave: "garcom", rotulo: "Garçom", tipo: "bool", padrao: true },
        { chave: "hora", rotulo: "Horário", tipo: "bool", padrao: true },
      ],
    },
    {
      id: "itens",
      rotulo: "Itens do pedido",
      obrigatorio: true,
      estilos: ["tamanho", "negrito", "destaque"],
      padrao: {
        ativo: true,
        estilo: estilo({ tamanho: "grande", negrito: true }),
      },
      opcoes: [
        {
          chave: "codigo",
          rotulo: "Número do cardápio antes do nome",
          tipo: "bool",
          padrao: false,
        },
        {
          chave: "maiusculas",
          rotulo: "Nome em MAIÚSCULAS",
          tipo: "bool",
          padrao: true,
        },
        {
          chave: "espaco",
          rotulo: "Linha em branco entre os itens",
          tipo: "bool",
          padrao: true,
        },
      ],
    },
    {
      id: "texto_rodape",
      rotulo: "Texto no rodapé",
      estilos: TODOS,
      padrao: { ativo: false, estilo: estilo({ centro: true }) },
      opcoes: [
        {
          chave: "texto",
          rotulo: "Texto",
          tipo: "texto",
          padrao: "",
          multilinha: true,
        },
      ],
    },
  ],
  conta: [
    {
      id: "restaurante",
      rotulo: "Nome do restaurante",
      estilos: TODOS,
      padrao: { ativo: true, estilo: estilo({ negrito: true, centro: true }) },
      opcoes: [],
    },
    {
      id: "texto_topo",
      rotulo: "Texto abaixo do nome (endereço, telefone, CNPJ)",
      estilos: TODOS,
      padrao: { ativo: false, estilo: estilo({ centro: true }) },
      opcoes: [
        {
          chave: "texto",
          rotulo: "Texto",
          tipo: "texto",
          padrao: "",
          multilinha: true,
        },
      ],
    },
    {
      id: "titulo",
      rotulo: "Título (Conferência / Comprovante)",
      estilos: TODOS,
      padrao: { ativo: true, estilo: estilo({ centro: true }) },
      opcoes: [],
    },
    {
      id: "mesa",
      rotulo: "Número da mesa",
      obrigatorio: true,
      estilos: TODOS,
      padrao: {
        ativo: true,
        estilo: estilo({
          tamanho: "grande",
          negrito: true,
          destaque: true,
          centro: true,
        }),
      },
      opcoes: [
        {
          chave: "prefixo",
          rotulo: "Texto antes do número",
          tipo: "texto",
          padrao: "MESA",
        },
      ],
    },
    {
      id: "comanda",
      rotulo: "Número da comanda (cartão)",
      estilos: TODOS,
      padrao: {
        ativo: true,
        estilo: estilo({ tamanho: "grande", negrito: true, centro: true }),
      },
      opcoes: [
        {
          chave: "prefixo",
          rotulo: "Texto antes do número",
          tipo: "texto",
          padrao: "COMANDA",
        },
      ],
    },
    {
      id: "detalhes",
      rotulo: "Horários e atendimento",
      estilos: TODOS,
      padrao: { ativo: true, estilo: estilo() },
      opcoes: [
        {
          chave: "aberta",
          rotulo: "Hora em que abriu",
          tipo: "bool",
          padrao: true,
        },
        {
          chave: "paga",
          rotulo: "Hora em que pagou",
          tipo: "bool",
          padrao: true,
        },
        { chave: "atendimento", rotulo: "Garçons", tipo: "bool", padrao: true },
      ],
    },
    {
      id: "itens",
      rotulo: "Itens consumidos",
      obrigatorio: true,
      estilos: ["negrito"],
      padrao: { ativo: true, estilo: estilo() },
      opcoes: [
        {
          chave: "mesaOrigem",
          rotulo: "Mesa de cada item (mesas juntas)",
          tipo: "bool",
          padrao: true,
        },
      ],
    },
    {
      id: "totais",
      rotulo: "Consumo, desconto, taxa e total",
      obrigatorio: true,
      estilos: ["negrito"],
      padrao: { ativo: true, estilo: estilo() },
      opcoes: [],
    },
    {
      id: "por_mesa",
      rotulo: "Consumo por mesa (mesas juntas)",
      estilos: ["negrito"],
      padrao: { ativo: true, estilo: estilo() },
      opcoes: [],
    },
    {
      id: "pagamentos",
      rotulo: "Forma de pagamento e troco (comprovante)",
      estilos: ["negrito"],
      padrao: { ativo: true, estilo: estilo() },
      opcoes: [],
    },
    {
      id: "texto_rodape",
      rotulo: "Texto no rodapé",
      estilos: TODOS,
      padrao: { ativo: true, estilo: estilo({ centro: true }) },
      opcoes: [
        {
          chave: "texto",
          rotulo: "Texto",
          tipo: "texto",
          padrao: "Obrigado pela preferencia!",
          multilinha: true,
        },
      ],
    },
  ],
};

export const layoutPadrao = (modelo: ModeloImpressao): LayoutImpressao => ({
  blocos: CATALOGO[modelo].map((b) => ({
    id: b.id,
    ativo: b.padrao.ativo,
    estilo: { ...b.padrao.estilo },
    opcoes: Object.fromEntries(b.opcoes.map((o) => [o.chave, o.padrao])),
  })),
});

const TAMANHOS: Tamanho[] = ["normal", "grande", "gigante"];
const MAX_TEXTO = 300;

// Aceita qualquer coisa (vinda do banco ou da tela) e devolve um layout
// válido: blocos conhecidos, obrigatórios ligados, tipos certos. O que
// faltar volta ao padrão, então nunca se perde a mesa ou os itens.
export const normalizarLayout = (
  modelo: ModeloImpressao,
  entrada: unknown,
): LayoutImpressao => {
  const catalogo = CATALOGO[modelo];
  const recebidos = Array.isArray((entrada as LayoutImpressao)?.blocos)
    ? (entrada as { blocos: Partial<BlocoLayout>[] }).blocos
    : [];
  const ordem = [
    ...recebidos
      .map((b) => b?.id)
      .filter((id): id is string => catalogo.some((c) => c.id === id)),
    ...catalogo.map((c) => c.id),
  ].filter((id, i, lista) => lista.indexOf(id) === i);

  return {
    blocos: ordem.map((id) => {
      const def = catalogo.find((c) => c.id === id) as BlocoCatalogo;
      const vindo = recebidos.find((b) => b?.id === id);
      const e = (vindo?.estilo ?? {}) as Partial<Estilo>;
      const permitido = (k: keyof Estilo) => def.estilos.includes(k);
      return {
        id,
        ativo: def.obrigatorio
          ? true
          : typeof vindo?.ativo === "boolean"
            ? vindo.ativo
            : def.padrao.ativo,
        estilo: {
          tamanho:
            permitido("tamanho") && e.tamanho && TAMANHOS.includes(e.tamanho)
              ? e.tamanho
              : def.padrao.estilo.tamanho,
          negrito:
            permitido("negrito") && typeof e.negrito === "boolean"
              ? e.negrito
              : def.padrao.estilo.negrito,
          destaque:
            permitido("destaque") && typeof e.destaque === "boolean"
              ? e.destaque
              : def.padrao.estilo.destaque,
          centro:
            permitido("centro") && typeof e.centro === "boolean"
              ? e.centro
              : def.padrao.estilo.centro,
        },
        opcoes: Object.fromEntries(
          def.opcoes.map((o) => {
            const valor = vindo?.opcoes?.[o.chave];
            if (o.tipo === "bool") {
              return [o.chave, typeof valor === "boolean" ? valor : o.padrao];
            }
            return [
              o.chave,
              typeof valor === "string" ? valor.slice(0, MAX_TEXTO) : o.padrao,
            ];
          }),
        ),
      };
    }),
  };
};

// Helpers de montagem
const hora = (iso: string) =>
  new Date(iso).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  });

const dataHora = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  });

// Valor em reais só com ASCII (o Intl usa espaço não separável).
export const reais = (centavos: number) =>
  `R$ ${(centavos / 100)
    .toFixed(2)
    .replace(".", ",")
    .replace(/\B(?=(\d{3})+(?!\d))/g, ".")}`;

const TITULO_SETOR: Record<SetorImpressora, string> = {
  chapa: "CHAPA",
  fritura: "FRITURA",
  bar: "BAR",
  caixa: "CAIXA",
};

// Texto com o estilo do bloco. No destaque, um espaço de cada lado deixa o
// fundo escuro com respiro em volta das letras.
const texto = (valor: string, e: Estilo): Linha => ({
  tipo: "texto",
  texto: e.destaque ? ` ${valor} ` : valor,
  ...e,
});

const textoLivre = (bloco: BlocoLayout): Linha[] =>
  String(bloco.opcoes.texto ?? "")
    .split("\n")
    .map((l) => l.trimEnd())
    .filter((l, i, lista) => l !== "" || (i > 0 && i < lista.length - 1))
    .map((l) => (l ? texto(l, bloco.estilo) : ({ tipo: "espaco" } as Linha)));

const nomeDaMesa = (mesas: number[], bloco: BlocoLayout) => {
  const [principal, ...agrupadas] = mesas;
  const prefixo = String(bloco.opcoes.prefixo ?? "").trim();
  return `${prefixo ? `${prefixo} ` : ""}${principal}${agrupadas.length ? ` (+${agrupadas.join(", ")})` : ""}`;
};

const nomeDaComanda = (numero: number, bloco: BlocoLayout) => {
  const prefixo = String(bloco.opcoes.prefixo ?? "").trim();
  return `${prefixo ? `${prefixo} ` : ""}${numero}`;
};

// Linhas do ticket, na ordem e com o estilo do layout. Sem layout, usa o
// padrão (testes e o spike de impressão).
export const montarLinhas = (
  tipo: TipoTicket,
  setor: SetorImpressora,
  payload: TicketPayload,
  layout?: LayoutImpressao,
): Linha[] => {
  if (tipo === "conta" && payload.conta) {
    return linhasDaConta(
      payload.mesas,
      payload.comanda ?? null,
      payload.conta,
      normalizarLayout("conta", layout),
    );
  }
  const config = normalizarLayout("pedido", layout);
  const [mesaPrincipal, ...agrupadas] = payload.mesas;
  const linhas: Linha[] = [];

  // Aviso do tipo de ticket: fixo, sempre no topo (a cozinha não pode perder).
  if (tipo === "cancelamento" || tipo === "alteracao") {
    linhas.push({
      tipo: "texto",
      texto:
        tipo === "cancelamento" ? "*** CANCELAMENTO ***" : "*** ALTERACAO ***",
      negrito: true,
      tamanho: "grande",
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

  for (const bloco of config.blocos) {
    if (!bloco.ativo) continue;
    const e = bloco.estilo;
    switch (bloco.id) {
      case "texto_topo":
      case "texto_rodape":
        linhas.push(...textoLivre(bloco));
        break;
      case "setor":
        linhas.push(texto(TITULO_SETOR[setor], e));
        break;
      case "mesa":
        linhas.push(texto(nomeDaMesa(payload.mesas, bloco), e));
        break;
      case "comanda":
        if (payload.comanda)
          linhas.push(texto(nomeDaComanda(payload.comanda, bloco), e));
        break;
      case "detalhes": {
        const partes = [
          bloco.opcoes.rodada && `Rodada ${payload.rodada}`,
          bloco.opcoes.garcom && payload.garcom,
          bloco.opcoes.hora && hora(payload.lancadaEm),
        ].filter(Boolean);
        if (partes.length) linhas.push(texto(partes.join(" - "), e));
        break;
      }
      case "itens": {
        linhas.push({ tipo: "separador" });
        const linhaDoItem = (item: TicketItem, principal: boolean) => {
          const codigo =
            bloco.opcoes.codigo && item.codigo ? `${item.codigo} - ` : "";
          const nome = bloco.opcoes.maiusculas
            ? item.nome.toUpperCase()
            : item.nome;
          linhas.push(
            principal
              ? texto(`${item.quantidade}x ${codigo}${nome}`, e)
              : {
                  tipo: "texto",
                  texto: `${item.quantidade}x ${codigo}${nome}`,
                },
          );
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
            linhas.push({
              tipo: "texto",
              texto: `   (mesa ${item.mesaOrigem})`,
            });
          }
          if (bloco.opcoes.espaco) linhas.push({ tipo: "espaco" });
        };
        if (tipo === "alteracao" && payload.antes?.length) {
          linhas.push({ tipo: "texto", texto: "ERA:", negrito: true });
          for (const item of payload.antes) linhaDoItem(item, false);
          linhas.push({ tipo: "texto", texto: "AGORA:", negrito: true });
        }
        for (const item of payload.itens) linhaDoItem(item, true);

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
        break;
      }
    }
  }
  return linhas;
};

// Conta do cliente: pré-conta (mesa aberta, taxa sugerida e opcional) ou
// comprovante (paga, com os pagamentos e o troco). Não é documento fiscal.
const linhasDaConta = (
  mesas: number[],
  comanda: number | null,
  conta: ContaImpressa,
  config: LayoutImpressao,
): Linha[] => {
  const [principal, ...agrupadas] = mesas;
  const linhas: Linha[] = [];
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

  for (const bloco of config.blocos) {
    if (!bloco.ativo) continue;
    const e = bloco.estilo;
    const n = e.negrito;
    switch (bloco.id) {
      case "restaurante":
        if (conta.restaurante) {
          linhas.push(texto(conta.restaurante.toUpperCase(), e));
        }
        break;
      case "texto_topo":
      case "texto_rodape":
        linhas.push(...textoLivre(bloco));
        break;
      case "titulo":
        linhas.push(
          texto(
            conta.paga ? "COMPROVANTE DE PAGAMENTO" : "CONFERENCIA DE CONTA",
            e,
          ),
        );
        break;
      case "mesa":
        linhas.push(texto(nomeDaMesa(mesas, bloco), e));
        break;
      case "comanda":
        if (comanda) linhas.push(texto(nomeDaComanda(comanda, bloco), e));
        break;
      case "detalhes":
        if (bloco.opcoes.aberta) {
          linhas.push(texto(`Aberta: ${dataHora(conta.abertaEm)}`, e));
        }
        if (bloco.opcoes.paga && conta.fechadaEm) {
          linhas.push(texto(`Paga:   ${dataHora(conta.fechadaEm)}`, e));
        }
        if (bloco.opcoes.atendimento && conta.garcons.length) {
          linhas.push(texto(`Atendimento: ${conta.garcons.join(", ")}`, e));
        }
        break;
      case "itens":
        linhas.push({ tipo: "separador" });
        for (const item of conta.itens) {
          linhas.push(
            valor(`${item.quantidade}x ${item.nome}`, item.totalCentavos, n),
          );
          if (
            bloco.opcoes.mesaOrigem &&
            agrupadas.length &&
            item.mesaOrigem !== principal
          ) {
            linhas.push({
              tipo: "texto",
              texto: `   (mesa ${item.mesaOrigem})`,
            });
          }
        }
        break;
      case "totais": {
        linhas.push(
          { tipo: "separador" },
          valor("Consumo", conta.subtotalCentavos, n),
        );
        if (conta.descontoCentavos > 0) {
          linhas.push({
            tipo: "colunas",
            esquerda: `Desconto${conta.descontoNome ? ` (${conta.descontoNome})` : ""}`,
            direita: `-${reais(conta.descontoCentavos)}`,
            negrito: n,
          });
        }
        const semTaxa = conta.subtotalCentavos - conta.descontoCentavos;
        if (!conta.paga) {
          linhas.push(
            valor(
              `Taxa de servico ${conta.taxaPct}% (opcional)`,
              conta.taxaCentavos,
              n,
            ),
            { tipo: "espaco" },
            valor("TOTAL COM TAXA", semTaxa + conta.taxaCentavos, true),
            valor("Total sem taxa", semTaxa, n),
          );
        } else {
          if (conta.taxaCentavos > 0) {
            linhas.push(
              valor(`Taxa de servico ${conta.taxaPct}%`, conta.taxaCentavos, n),
            );
          }
          if (conta.gorjetaCentavos > 0) {
            linhas.push(valor("Gorjeta", conta.gorjetaCentavos, n));
          }
          linhas.push(
            { tipo: "espaco" },
            valor("TOTAL", conta.totalCentavos, true),
          );
        }
        break;
      }
      case "por_mesa":
        if (conta.porMesa.length > 1) {
          linhas.push(
            { tipo: "espaco" },
            { tipo: "texto", texto: "Consumo por mesa:", negrito: n },
          );
          for (const m of conta.porMesa) {
            linhas.push(valor(`  Mesa ${m.numero}`, m.totalCentavos, n));
          }
        }
        break;
      case "pagamentos":
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
                n,
              ),
            );
            if (p.metodo === "dinheiro" && p.recebidoCentavos) {
              linhas.push(valor("  Recebido", p.recebidoCentavos, n));
              linhas.push(valor("  Troco", p.trocoCentavos, n));
            }
          }
        }
        break;
    }
  }

  // Fixo: a conta não é nota fiscal e isso não pode sair do papel.
  linhas.push(
    { tipo: "separador" },
    { tipo: "texto", texto: "Nao e documento fiscal", centro: true },
  );
  return linhas;
};

// Encaixa descrição + valor na largura, cortando a descrição se precisar.
export const colunas = (esquerda: string, direita: string, largura: number) => {
  const espaco = largura - direita.length - 1;
  const conteudo =
    esquerda.length > espaco ? `${esquerda.slice(0, espaco - 1)}.` : esquerda;
  return (
    conteudo +
    " ".repeat(Math.max(1, largura - conteudo.length - direita.length)) +
    direita
  );
};

// Dados de exemplo para a pré-visualização e o "Imprimir teste" da tela de
// layout: mostram todos os blocos (mesas juntas, adicionais, observação).
export const exemploPedido = (): TicketPayload => ({
  mesas: [5],
  comanda: 7,
  garcom: "Garçom A",
  rodada: 2,
  lancadaEm: new Date().toISOString(),
  itens: [
    {
      itemId: "exemplo-1",
      codigo: 2,
      quantidade: 2,
      nome: "Xis Bah Tchê! - Bacon",
      modificadores: ["Sem ervilha", "Bacon extra"],
      observacao: "Bem passado",
      mesaOrigem: 5,
    },
    {
      itemId: "exemplo-2",
      codigo: 20,
      quantidade: 1,
      nome: "Batata Frita",
      modificadores: [],
      observacao: null,
      mesaOrigem: 5,
    },
  ],
  motivo: "Cliente desistiu",
  preparoIniciado: false,
  antes: [
    {
      itemId: "exemplo-0",
      codigo: 2,
      quantidade: 1,
      nome: "Xis Bah Tchê! - Bacon",
      modificadores: [],
      observacao: null,
      mesaOrigem: 5,
    },
  ],
});

export const exemploConta = (
  restaurante: string,
  paga: boolean,
): ContaImpressa => ({
  restaurante,
  paga,
  abertaEm: new Date(Date.now() - 90 * 60_000).toISOString(),
  fechadaEm: paga ? new Date().toISOString() : null,
  garcons: ["Garçom A", "Garçom B"],
  itens: [
    {
      quantidade: 2,
      nome: "Xis Bah Tchê! - Bacon",
      totalCentavos: 9980,
      mesaOrigem: 5,
    },
    { quantidade: 1, nome: "Batata Frita", totalCentavos: 2500, mesaOrigem: 5 },
    {
      quantidade: 3,
      nome: "Refrigerante Lata",
      totalCentavos: 2100,
      mesaOrigem: 5,
    },
  ],
  porMesa: [],
  subtotalCentavos: 14580,
  descontoCentavos: 0,
  descontoNome: null,
  taxaPct: 10,
  taxaCentavos: 1458,
  gorjetaCentavos: paga ? 500 : 0,
  totalCentavos: 14580 + 1458 + (paga ? 500 : 0),
  pagamentos: paga
    ? [
        {
          metodo: "dinheiro",
          valorCentavos: 10000,
          recebidoCentavos: 12000,
          trocoCentavos: 2000,
        },
        {
          metodo: "credito",
          valorCentavos: 6538,
          recebidoCentavos: null,
          trocoCentavos: 0,
        },
      ]
    : [],
});
