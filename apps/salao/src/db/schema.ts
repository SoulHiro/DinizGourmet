import { relations, sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

// Todas as tabelas principais carregam restaurante_id desde já (hoje há um
// único restaurante). Isso evita uma migração dolorosa quando abrir a filial 2.

const criadoEm = () =>
  timestamp("criado_em", { withTimezone: true }).notNull().defaultNow();
const atualizadoEm = () =>
  timestamp("atualizado_em", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date());

// Enums
export const papelFuncionarioEnum = pgEnum("papel_funcionario", [
  "garcom",
  "gerente",
  "caixa",
]);

export const setorImpressoraEnum = pgEnum("setor_impressora", [
  "chapa",
  "fritura",
  "bar",
  "caixa",
]);

// "preparo" = ponto da carne (mal passado, ao ponto...): só um por unidade.
export const tipoModificadorEnum = pgEnum("tipo_modificador", [
  "remocao",
  "adicional",
  "preparo",
]);

export const statusComandaEnum = pgEnum("status_comanda", [
  "aberta",
  "fechada",
  "cancelada",
]);

export const origemRodadaEnum = pgEnum("origem_rodada", ["garcom", "totem"]);

export const statusItemEnum = pgEnum("status_item", ["ativo", "cancelado"]);

export const tipoChamadoEnum = pgEnum("tipo_chamado", ["garcom", "conta"]);

export const tipoRepasseEnum = pgEnum("tipo_repasse", ["gorjeta", "taxa"]);

// Por que a taxa de serviço não foi cobrada (relatório por motivo e garçom).
export const motivoSemTaxaEnum = pgEnum("motivo_sem_taxa", [
  "cliente_recusou",
  "erro_atendimento",
  "demora_preparo",
  "cortesia",
  "outro",
]);

export const metodoPagamentoEnum = pgEnum("metodo_pagamento", [
  "dinheiro",
  "credito",
  "debito",
  "pix",
  "vale_refeicao",
]);

// Layout do papel: tickets de pedido (cozinha/bar) e conta do cliente.
export const modeloImpressaoEnum = pgEnum("modelo_impressao", [
  "pedido",
  "conta",
]);

export const tipoDescontoEnum = pgEnum("tipo_desconto", [
  "percentual",
  "valor",
]);

export const papelNaComandaEnum = pgEnum("papel_na_comanda", [
  "titular",
  "auxiliar",
]);

export const tipoTrabalhoImpressaoEnum = pgEnum("tipo_trabalho_impressao", [
  "pedido",
  "cancelamento",
  "reimpressao",
  "alteracao",
  // Conta do cliente (pré-conta ou comprovante), na impressora do caixa.
  "conta",
]);

export const statusTrabalhoImpressaoEnum = pgEnum("status_trabalho_impressao", [
  "pendente",
  "imprimindo",
  "impresso",
  "falhou",
  "descartado",
]);

export type PapelFuncionario = (typeof papelFuncionarioEnum.enumValues)[number];
export type SetorImpressora = (typeof setorImpressoraEnum.enumValues)[number];

// Tables
export const restaurantes = pgTable("restaurante", {
  id: uuid("id").primaryKey().defaultRandom(),
  nome: text("nome").notNull(),
  // Taxa de serviço: taxaServicoPct até o limite; acima dele, a reduzida.
  taxaServicoPct: integer("taxa_servico_pct").notNull().default(10),
  taxaServicoPctReduzida: integer("taxa_servico_pct_reduzida")
    .notNull()
    .default(5),
  taxaServicoLimiteCentavos: integer("taxa_servico_limite_centavos")
    .notNull()
    .default(30000),
  criadoEm: criadoEm(),
  atualizadoEm: atualizadoEm(),
});

export const funcionarios = pgTable(
  "funcionario",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    restauranteId: uuid("restaurante_id")
      .notNull()
      .references(() => restaurantes.id),
    nome: text("nome").notNull(),
    papel: papelFuncionarioEnum("papel").notNull().default("garcom"),
    pinHash: text("pin_hash").notNull(),
    tentativasFalhas: integer("tentativas_falhas").notNull().default(0),
    bloqueadoAte: timestamp("bloqueado_ate", { withTimezone: true }),
    ativo: boolean("ativo").notNull().default(true),
    criadoEm: criadoEm(),
    atualizadoEm: atualizadoEm(),
  },
  (t) => [index("funcionario_restaurante_idx").on(t.restauranteId)],
);

export const sessoes = pgTable(
  "sessao",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // Guardamos só o hash do token; o token puro vive apenas no cookie.
    tokenHash: text("token_hash").notNull(),
    funcionarioId: uuid("funcionario_id")
      .notNull()
      .references(() => funcionarios.id),
    dispositivo: text("dispositivo"),
    criadoEm: criadoEm(),
    expiraEm: timestamp("expira_em", { withTimezone: true }).notNull(),
    revogadaEm: timestamp("revogada_em", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("sessao_token_hash_idx").on(t.tokenHash),
    index("sessao_funcionario_idx").on(t.funcionarioId),
  ],
);

export const impressoras = pgTable(
  "impressora",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    restauranteId: uuid("restaurante_id")
      .notNull()
      .references(() => restaurantes.id),
    nome: text("nome").notNull(),
    // Nome exato da impressora no Windows (printers.list()).
    nomeDriver: text("nome_driver").notNull(),
    setor: setorImpressoraEnum("setor").notNull(),
    ativa: boolean("ativa").notNull().default(true),
    criadoEm: criadoEm(),
    atualizadoEm: atualizadoEm(),
  },
  (t) => [index("impressora_restaurante_idx").on(t.restauranteId)],
);

export const categorias = pgTable(
  "categoria",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    restauranteId: uuid("restaurante_id")
      .notNull()
      .references(() => restaurantes.id),
    nome: text("nome").notNull(),
    ordem: integer("ordem").notNull().default(0),
    // Roteamento de impressão por categoria (Lanches -> chapa, etc).
    impressoraId: uuid("impressora_id").references(() => impressoras.id, {
      onDelete: "set null",
    }),
    // Faixa de códigos dos produtos (ex.: Lanches 1–19, Porções 20–29).
    codigoInicio: integer("codigo_inicio"),
    codigoFim: integer("codigo_fim"),
    ativa: boolean("ativa").notNull().default(true),
    criadoEm: criadoEm(),
    atualizadoEm: atualizadoEm(),
  },
  (t) => [index("categoria_restaurante_idx").on(t.restauranteId)],
);

export const produtos = pgTable(
  "produto",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    restauranteId: uuid("restaurante_id")
      .notNull()
      .references(() => restaurantes.id),
    categoriaId: uuid("categoria_id")
      .notNull()
      .references(() => categorias.id),
    // Número curto do cardápio: o garçom digita "5" e acha o item.
    codigo: integer("codigo"),
    nome: text("nome").notNull(),
    descricao: text("descricao"),
    // Cardápio digital do cliente (QR da mesa).
    fotoUrl: text("foto_url"),
    videoUrl: text("video_url"),
    ingredientes: text("ingredientes")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    destaque: boolean("destaque").notNull().default(false),
    // Nome sem acento e minúsculo, para a busca rápida do garçom.
    buscaNormalizada: text("busca_normalizada").notNull(),
    precoCentavos: integer("preco_centavos").notNull(),
    disponivel: boolean("disponivel").notNull().default(true),
    controlaEstoque: boolean("controla_estoque").notNull().default(false),
    estoque: integer("estoque"),
    ordem: integer("ordem").notNull().default(0),
    criadoEm: criadoEm(),
    atualizadoEm: atualizadoEm(),
  },
  (t) => [
    index("produto_restaurante_idx").on(t.restauranteId),
    index("produto_categoria_idx").on(t.categoriaId),
    uniqueIndex("produto_codigo_idx").on(t.restauranteId, t.codigo),
    check("produto_estoque_nao_negativo", sql`${t.estoque} >= 0`),
  ],
);

export const modificadores = pgTable(
  "modificador",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    restauranteId: uuid("restaurante_id")
      .notNull()
      .references(() => restaurantes.id),
    nome: text("nome").notNull(),
    tipo: tipoModificadorEnum("tipo").notNull().default("remocao"),
    precoCentavos: integer("preco_centavos").notNull().default(0),
    // Adicional que gasta um insumo (ex.: "Bacon extra" gasta Bacon). Sem
    // estoque do insumo, só o chip fica cinza; o lanche continua disponível.
    insumoId: uuid("insumo_id").references(() => insumos.id, {
      onDelete: "set null",
    }),
    ativo: boolean("ativo").notNull().default(true),
    criadoEm: criadoEm(),
    atualizadoEm: atualizadoEm(),
  },
  (t) => [index("modificador_restaurante_idx").on(t.restauranteId)],
);

// Quais chips aparecem para quais produtos.
export const produtoModificadores = pgTable(
  "produto_modificador",
  {
    produtoId: uuid("produto_id")
      .notNull()
      .references(() => produtos.id, { onDelete: "cascade" }),
    modificadorId: uuid("modificador_id")
      .notNull()
      .references(() => modificadores.id, { onDelete: "cascade" }),
    ordem: integer("ordem").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.produtoId, t.modificadorId] })],
);

// Ingredientes com contagem da noite (bacon, calabresa, pão...). Estoque
// nulo = não controlado. Insumo base esgotado deixa o produto indisponível.
export const insumos = pgTable(
  "insumo",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    restauranteId: uuid("restaurante_id")
      .notNull()
      .references(() => restaurantes.id),
    nome: text("nome").notNull(),
    // Unidade só para exibição ("un", "porção", "fatia").
    unidade: text("unidade").notNull().default("un"),
    estoque: integer("estoque"),
    ativo: boolean("ativo").notNull().default(true),
    criadoEm: criadoEm(),
    atualizadoEm: atualizadoEm(),
  },
  (t) => [
    uniqueIndex("insumo_restaurante_nome_idx").on(t.restauranteId, t.nome),
    check("insumo_estoque_nao_negativo", sql`${t.estoque} >= 0`),
  ],
);

// Receita: quanto de cada insumo base uma unidade do produto gasta.
export const produtoInsumos = pgTable(
  "produto_insumo",
  {
    produtoId: uuid("produto_id")
      .notNull()
      .references(() => produtos.id, { onDelete: "cascade" }),
    insumoId: uuid("insumo_id")
      .notNull()
      .references(() => insumos.id, { onDelete: "cascade" }),
    quantidade: integer("quantidade").notNull().default(1),
  },
  (t) => [
    primaryKey({ columns: [t.produtoId, t.insumoId] }),
    index("produto_insumo_insumo_idx").on(t.insumoId),
    check("produto_insumo_quantidade_positiva", sql`${t.quantidade} > 0`),
  ],
);

// Descontos pré-cadastrados (o garçom só aplica estes; valor livre é do
// caixa/gerente).
export const descontos = pgTable(
  "desconto",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    restauranteId: uuid("restaurante_id")
      .notNull()
      .references(() => restaurantes.id),
    nome: text("nome").notNull(),
    tipo: tipoDescontoEnum("tipo").notNull(),
    // Percentual (0-100) ou centavos, conforme o tipo.
    valor: integer("valor").notNull(),
    ativo: boolean("ativo").notNull().default(true),
    criadoEm: criadoEm(),
    atualizadoEm: atualizadoEm(),
  },
  (t) => [index("desconto_restaurante_idx").on(t.restauranteId)],
);

export const mesas = pgTable(
  "mesa",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    restauranteId: uuid("restaurante_id")
      .notNull()
      .references(() => restaurantes.id),
    numero: integer("numero").notNull(),
    // Vai no QR code da mesa: o cliente só consegue chamar a própria mesa.
    tokenQr: text("token_qr")
      .notNull()
      .default(sql`replace(gen_random_uuid()::text, '-', '')`),
    ativa: boolean("ativa").notNull().default(true),
    criadoEm: criadoEm(),
    atualizadoEm: atualizadoEm(),
  },
  (t) => [
    uniqueIndex("mesa_numero_idx").on(t.restauranteId, t.numero),
    uniqueIndex("mesa_token_qr_idx").on(t.tokenQr),
  ],
);

// Cartão físico da comanda (1, 2, 3...). Reutilizável: enquanto uma comanda
// está aberta com ele, ninguém mais usa o número; ao pagar, volta para o
// monte. O QR impresso no cartão abre a conta daquela comanda no celular do
// cliente, e o código de barras (o número) acha a comanda no caixa.
export const cartoesComanda = pgTable(
  "cartao_comanda",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    restauranteId: uuid("restaurante_id")
      .notNull()
      .references(() => restaurantes.id),
    numero: integer("numero").notNull(),
    tokenQr: text("token_qr")
      .notNull()
      .default(sql`replace(gen_random_uuid()::text, '-', '')`),
    ativo: boolean("ativo").notNull().default(true),
    criadoEm: criadoEm(),
  },
  (t) => [
    uniqueIndex("cartao_numero_idx").on(t.restauranteId, t.numero),
    uniqueIndex("cartao_token_qr_idx").on(t.tokenQr),
  ],
);

export const comandas = pgTable(
  "comanda",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    restauranteId: uuid("restaurante_id")
      .notNull()
      .references(() => restaurantes.id),
    mesaPrincipalId: uuid("mesa_principal_id")
      .notNull()
      .references(() => mesas.id),
    garcomTitularId: uuid("garcom_titular_id")
      .notNull()
      .references(() => funcionarios.id),
    // Cartão da comanda. Nulo só em comandas anteriores aos cartões.
    cartaoId: uuid("cartao_id").references(() => cartoesComanda.id),
    // Número do cartão guardado na comanda (o cartão é reutilizado depois).
    numero: integer("numero"),
    status: statusComandaEnum("status").notNull().default("aberta"),
    abertaEm: timestamp("aberta_em", { withTimezone: true })
      .notNull()
      .defaultNow(),
    fechadaEm: timestamp("fechada_em", { withTimezone: true }),
    // Informada ao fechar a mesa; dividida entre os garçons (gorjeta_divisao).
    gorjetaCentavos: integer("gorjeta_centavos"),
    // Taxa de serviço cobrada no fechamento (null = cliente não quis pagar).
    taxaServicoCentavos: integer("taxa_servico_centavos"),
    // Taxa não cobrada: motivo obrigatório e quem registrou.
    semTaxaMotivo: motivoSemTaxaEnum("sem_taxa_motivo"),
    semTaxaObservacao: text("sem_taxa_observacao"),
    // Desconto aplicado ao receber (pré-cadastrado ou livre) e quem aplicou.
    descontoCentavos: integer("desconto_centavos"),
    descontoNome: text("desconto_nome"),
    descontoId: uuid("desconto_id").references(() => descontos.id),
    // Quem recebeu o pagamento (e registrou taxa/desconto).
    fechadaPor: uuid("fechada_por").references(() => funcionarios.id),
    atualizadoEm: atualizadoEm(),
  },
  (t) => [
    index("comanda_restaurante_status_idx").on(t.restauranteId, t.status),
    // Um cartão nunca está em duas comandas abertas ao mesmo tempo. É isso
    // que resolve dois garçons abrindo o mesmo cartão no mesmo instante.
    uniqueIndex("comanda_cartao_aberta_idx")
      .on(t.cartaoId)
      .where(sql`${t.status} = 'aberta'`),
    index("comanda_mesa_principal_idx").on(t.mesaPrincipalId),
    // Histórico do caixa: contas por data de fechamento.
    index("comanda_restaurante_fechada_idx").on(t.restauranteId, t.fechadaEm),
  ],
);

// Pagamentos da conta: pode ser dividida entre métodos (parte no dinheiro,
// parte no cartão). No dinheiro guarda quanto o cliente entregou e o troco.
export const pagamentos = pgTable(
  "pagamento",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    restauranteId: uuid("restaurante_id")
      .notNull()
      .references(() => restaurantes.id),
    comandaId: uuid("comanda_id")
      .notNull()
      .references(() => comandas.id),
    metodo: metodoPagamentoEnum("metodo").notNull(),
    // Quanto deste pagamento abate da conta.
    valorCentavos: integer("valor_centavos").notNull(),
    // Só dinheiro: quanto o cliente entregou e quanto voltou de troco.
    recebidoCentavos: integer("recebido_centavos"),
    trocoCentavos: integer("troco_centavos").notNull().default(0),
    funcionarioId: uuid("funcionario_id")
      .notNull()
      .references(() => funcionarios.id),
    criadoEm: criadoEm(),
  },
  (t) => [
    index("pagamento_comanda_idx").on(t.comandaId),
    index("pagamento_restaurante_data_idx").on(t.restauranteId, t.criadoEm),
    check("pagamento_valor_positivo", sql`${t.valorCentavos} > 0`),
  ],
);

// Mesas que compõem a comanda (substitui o array mesas_agrupadas[]).
// saiuEm preenchido = a mesa foi separada/transferida/fechada.
export const comandaMesas = pgTable(
  "comanda_mesa",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    comandaId: uuid("comanda_id")
      .notNull()
      .references(() => comandas.id),
    mesaId: uuid("mesa_id")
      .notNull()
      .references(() => mesas.id),
    entrouEm: timestamp("entrou_em", { withTimezone: true })
      .notNull()
      .defaultNow(),
    saiuEm: timestamp("saiu_em", { withTimezone: true }),
  },
  (t) => [
    // A mesa é só o lugar: várias comandas podem estar na mesma mesa, mas
    // cada comanda está em uma mesa por vez (transferir troca a linha).
    uniqueIndex("comanda_mesa_local_idx")
      .on(t.comandaId)
      .where(sql`${t.saiuEm} is null`),
    index("comanda_mesa_mesa_idx").on(t.mesaId),
    index("comanda_mesa_comanda_idx").on(t.comandaId),
  ],
);

// Cada lançamento é imutável: "adicionar itens" cria uma rodada nova.
export const rodadas = pgTable(
  "rodada",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    restauranteId: uuid("restaurante_id")
      .notNull()
      .references(() => restaurantes.id),
    comandaId: uuid("comanda_id")
      .notNull()
      .references(() => comandas.id),
    funcionarioId: uuid("funcionario_id")
      .notNull()
      .references(() => funcionarios.id),
    numero: integer("numero").notNull(),
    idempotencyKey: uuid("idempotency_key").notNull(),
    origem: origemRodadaEnum("origem").notNull().default("garcom"),
    lancadaEm: timestamp("lancada_em", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("rodada_idempotency_idx").on(t.idempotencyKey),
    uniqueIndex("rodada_comanda_numero_idx").on(t.comandaId, t.numero),
  ],
);

export const itensPedido = pgTable(
  "item_pedido",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    rodadaId: uuid("rodada_id")
      .notNull()
      .references(() => rodadas.id),
    comandaId: uuid("comanda_id")
      .notNull()
      .references(() => comandas.id),
    produtoId: uuid("produto_id")
      .notNull()
      .references(() => produtos.id),
    // Permite dividir a conta por mesa de origem depois de juntar mesas.
    mesaOrigemId: uuid("mesa_origem_id")
      .notNull()
      .references(() => mesas.id),
    quantidade: integer("quantidade").notNull(),
    // Snapshots: o ticket e a conta não mudam se o cardápio mudar depois.
    nomeProduto: text("nome_produto").notNull(),
    precoUnitarioCentavos: integer("preco_unitario_centavos").notNull(),
    // (preço unitário + adicionais) x quantidade, gravado no lançamento.
    totalCentavos: integer("total_centavos").notNull(),
    impressoraId: uuid("impressora_id").references(() => impressoras.id),
    observacao: text("observacao"),
    status: statusItemEnum("status").notNull().default("ativo"),
    canceladoPor: uuid("cancelado_por").references(() => funcionarios.id),
    canceladoEm: timestamp("cancelado_em", { withTimezone: true }),
    motivoCancelamento: text("motivo_cancelamento"),
    preparoIniciado: boolean("preparo_iniciado"),
    // Edição de item já lançado: o novo aponta para o que ele substituiu
    // (o antigo fica cancelado com motivo "Alterado"). Auditoria completa.
    substituiItemId: uuid("substitui_item_id"),
    criadoEm: criadoEm(),
  },
  (t) => [
    index("item_pedido_comanda_idx").on(t.comandaId),
    index("item_pedido_rodada_idx").on(t.rodadaId),
    index("item_pedido_produto_idx").on(t.produtoId),
    index("item_pedido_status_idx").on(t.status),
    index("item_pedido_mesa_origem_idx").on(t.mesaOrigemId),
    check("item_pedido_quantidade_positiva", sql`${t.quantidade} > 0`),
  ],
);

export const itemPedidoModificadores = pgTable(
  "item_pedido_modificador",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    itemPedidoId: uuid("item_pedido_id")
      .notNull()
      .references(() => itensPedido.id),
    modificadorId: uuid("modificador_id")
      .notNull()
      .references(() => modificadores.id),
    nome: text("nome").notNull(),
    tipo: tipoModificadorEnum("tipo").notNull(),
    precoCentavos: integer("preco_centavos").notNull().default(0),
  },
  (t) => [index("item_pedido_modificador_item_idx").on(t.itemPedidoId)],
);

export type TicketItem = {
  itemId: string;
  codigo?: number | null;
  quantidade: number;
  nome: string;
  modificadores: string[];
  observacao: string | null;
  mesaOrigem: number;
};

// Conta impressa para o cliente (não é documento fiscal).
export type ContaImpressa = {
  restaurante: string;
  // Com pagamento registrado vira comprovante; sem, é a pré-conta.
  paga: boolean;
  abertaEm: string;
  fechadaEm: string | null;
  garcons: string[];
  itens: {
    quantidade: number;
    nome: string;
    totalCentavos: number;
    mesaOrigem: number;
  }[];
  porMesa: { numero: number; totalCentavos: number }[];
  subtotalCentavos: number;
  descontoCentavos: number;
  descontoNome: string | null;
  taxaPct: number;
  taxaCentavos: number;
  gorjetaCentavos: number;
  totalCentavos: number;
  pagamentos: {
    metodo: string;
    valorCentavos: number;
    recebidoCentavos: number | null;
    trocoCentavos: number;
  }[];
};

export type TicketPayload = {
  mesas: number[];
  // Número do cartão da comanda (nulo nas comandas anteriores aos cartões).
  comanda?: number | null;
  garcom: string;
  rodada: number;
  lancadaEm: string;
  itens: TicketItem[];
  motivo?: string;
  preparoIniciado?: boolean;
  // Ticket de ALTERAÇÃO: como o item era antes (itens = como ficou).
  antes?: TicketItem[];
  // Só no tipo "conta".
  conta?: ContaImpressa;
};

// Fila de impressão persistente. O worker consome com FOR UPDATE SKIP LOCKED,
// um loop por impressora, então dois tickets nunca disputam o mesmo papel.
export const trabalhosImpressao = pgTable(
  "trabalho_impressao",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    restauranteId: uuid("restaurante_id")
      .notNull()
      .references(() => restaurantes.id),
    impressoraId: uuid("impressora_id")
      .notNull()
      .references(() => impressoras.id),
    tipo: tipoTrabalhoImpressaoEnum("tipo").notNull(),
    rodadaId: uuid("rodada_id").references(() => rodadas.id),
    comandaId: uuid("comanda_id").references(() => comandas.id),
    payload: jsonb("payload").$type<TicketPayload>().notNull(),
    status: statusTrabalhoImpressaoEnum("status").notNull().default("pendente"),
    tentativas: integer("tentativas").notNull().default(0),
    proximaTentativaEm: timestamp("proxima_tentativa_em", {
      withTimezone: true,
    })
      .notNull()
      .defaultNow(),
    // Id do job no spooler do Windows, para confirmar que saiu da fila.
    jobSpooler: integer("job_spooler"),
    ultimoErro: text("ultimo_erro"),
    criadoEm: criadoEm(),
    impressoEm: timestamp("impresso_em", { withTimezone: true }),
  },
  (t) => [
    index("trabalho_impressao_fila_idx").on(
      t.impressoraId,
      t.status,
      t.proximaTentativaEm,
    ),
    index("trabalho_impressao_rodada_idx").on(t.rodadaId),
    index("trabalho_impressao_status_idx").on(t.restauranteId, t.status),
  ],
);

// Garçom sobrecarregado pede ajuda numa mesa; todos os garçons recebem o
// alerta e o primeiro que aceitar vira auxiliar. Sem resposta em alguns
// minutos, o pedido é escalado para o gerente.
export const pedidosAjuda = pgTable(
  "pedido_ajuda",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    restauranteId: uuid("restaurante_id")
      .notNull()
      .references(() => restaurantes.id),
    mesaId: uuid("mesa_id")
      .notNull()
      .references(() => mesas.id),
    comandaId: uuid("comanda_id").references(() => comandas.id),
    solicitanteId: uuid("solicitante_id")
      .notNull()
      .references(() => funcionarios.id),
    criadoEm: criadoEm(),
    aceitoPor: uuid("aceito_por").references(() => funcionarios.id),
    aceitoEm: timestamp("aceito_em", { withTimezone: true }),
    escaladoEm: timestamp("escalado_em", { withTimezone: true }),
    encerradoEm: timestamp("encerrado_em", { withTimezone: true }),
    // Garçom que se ofereceu sem ter sido chamado (o titular só é avisado).
    espontaneo: boolean("espontaneo").notNull().default(false),
  },
  (t) => [
    index("pedido_ajuda_restaurante_idx").on(t.restauranteId, t.encerradoEm),
    // Um pedido em aberto por mesa: apertar de novo não duplica o alerta.
    uniqueIndex("pedido_ajuda_mesa_aberto_idx")
      .on(t.mesaId)
      .where(sql`${t.encerradoEm} is null and ${t.aceitoPor} is null`),
  ],
);

// Garçons que trabalharam na comanda (titular + auxiliares), para os
// alertas e para a divisão da gorjeta.
export const comandaGarcons = pgTable(
  "comanda_garcom",
  {
    comandaId: uuid("comanda_id")
      .notNull()
      .references(() => comandas.id),
    funcionarioId: uuid("funcionario_id")
      .notNull()
      .references(() => funcionarios.id),
    papel: papelNaComandaEnum("papel").notNull(),
    entrouEm: timestamp("entrou_em", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.comandaId, t.funcionarioId] })],
);

// Chamado do cliente pelo QR da mesa. Fila por ordem de chegada; o primeiro
// garçom que atender tira da tela dos outros; sem resposta, vai ao gerente.
export const chamados = pgTable(
  "chamado",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    restauranteId: uuid("restaurante_id")
      .notNull()
      .references(() => restaurantes.id),
    mesaId: uuid("mesa_id")
      .notNull()
      .references(() => mesas.id),
    comandaId: uuid("comanda_id").references(() => comandas.id),
    tipo: tipoChamadoEnum("tipo").notNull(),
    // Pedido de conta: o que o cliente escolheu na tela do QR.
    taxaServico: boolean("taxa_servico"),
    gorjetaCentavos: integer("gorjeta_centavos"),
    criadoEm: criadoEm(),
    aceitoPor: uuid("aceito_por").references(() => funcionarios.id),
    aceitoEm: timestamp("aceito_em", { withTimezone: true }),
    escaladoEm: timestamp("escalado_em", { withTimezone: true }),
    encerradoEm: timestamp("encerrado_em", { withTimezone: true }),
  },
  (t) => [
    index("chamado_restaurante_idx").on(t.restauranteId, t.encerradoEm),
    // Cliente apertando várias vezes não cria vários chamados. "Chamar
    // garçom" é da mesa; "pedir a conta" é de cada comanda (cartão).
    uniqueIndex("chamado_garcom_aberto_idx")
      .on(t.mesaId)
      .where(sql`${t.encerradoEm} is null and ${t.tipo} = 'garcom'`),
    uniqueIndex("chamado_conta_aberto_idx")
      .on(t.comandaId)
      .where(sql`${t.encerradoEm} is null and ${t.tipo} = 'conta'`),
  ],
);

// Personalização do papel feita pelo gerente (/gerente > Impressão). Sem
// linha aqui, vale o layout padrão (src/lib/impressao/layout.ts).
export const layoutsImpressao = pgTable(
  "layout_impressao",
  {
    restauranteId: uuid("restaurante_id")
      .notNull()
      .references(() => restaurantes.id),
    modelo: modeloImpressaoEnum("modelo").notNull(),
    config: jsonb("config").notNull(),
    atualizadoEm: atualizadoEm(),
  },
  (t) => [primaryKey({ columns: [t.restauranteId, t.modelo] })],
);

export const gorjetaDivisoes = pgTable(
  "gorjeta_divisao",
  {
    comandaId: uuid("comanda_id")
      .notNull()
      .references(() => comandas.id),
    // Gorjeta e taxa de serviço são divididas separadamente (aparecem separadas no relatório).
    tipo: tipoRepasseEnum("tipo").notNull().default("gorjeta"),
    funcionarioId: uuid("funcionario_id")
      .notNull()
      .references(() => funcionarios.id),
    // Valor lançado pelo garçom na comanda (base da proporção).
    baseCentavos: integer("base_centavos").notNull(),
    valorCentavos: integer("valor_centavos").notNull(),
  },
  (t) => [primaryKey({ columns: [t.comandaId, t.funcionarioId, t.tipo] })],
);

// Relations
export const funcionariosRelations = relations(funcionarios, ({ one }) => ({
  restaurante: one(restaurantes, {
    fields: [funcionarios.restauranteId],
    references: [restaurantes.id],
  }),
}));

export const categoriasRelations = relations(categorias, ({ one, many }) => ({
  impressora: one(impressoras, {
    fields: [categorias.impressoraId],
    references: [impressoras.id],
  }),
  produtos: many(produtos),
}));

export const produtosRelations = relations(produtos, ({ one, many }) => ({
  categoria: one(categorias, {
    fields: [produtos.categoriaId],
    references: [categorias.id],
  }),
  modificadores: many(produtoModificadores),
}));

export const produtoModificadoresRelations = relations(
  produtoModificadores,
  ({ one }) => ({
    produto: one(produtos, {
      fields: [produtoModificadores.produtoId],
      references: [produtos.id],
    }),
    modificador: one(modificadores, {
      fields: [produtoModificadores.modificadorId],
      references: [modificadores.id],
    }),
  }),
);

export const comandasRelations = relations(comandas, ({ one, many }) => ({
  mesaPrincipal: one(mesas, {
    fields: [comandas.mesaPrincipalId],
    references: [mesas.id],
  }),
  garcomTitular: one(funcionarios, {
    fields: [comandas.garcomTitularId],
    references: [funcionarios.id],
  }),
  mesas: many(comandaMesas),
  rodadas: many(rodadas),
  itens: many(itensPedido),
}));

export const comandaMesasRelations = relations(comandaMesas, ({ one }) => ({
  comanda: one(comandas, {
    fields: [comandaMesas.comandaId],
    references: [comandas.id],
  }),
  mesa: one(mesas, {
    fields: [comandaMesas.mesaId],
    references: [mesas.id],
  }),
}));

export const rodadasRelations = relations(rodadas, ({ one, many }) => ({
  comanda: one(comandas, {
    fields: [rodadas.comandaId],
    references: [comandas.id],
  }),
  funcionario: one(funcionarios, {
    fields: [rodadas.funcionarioId],
    references: [funcionarios.id],
  }),
  itens: many(itensPedido),
}));

export const itensPedidoRelations = relations(itensPedido, ({ one, many }) => ({
  rodada: one(rodadas, {
    fields: [itensPedido.rodadaId],
    references: [rodadas.id],
  }),
  comanda: one(comandas, {
    fields: [itensPedido.comandaId],
    references: [comandas.id],
  }),
  mesaOrigem: one(mesas, {
    fields: [itensPedido.mesaOrigemId],
    references: [mesas.id],
  }),
  modificadores: many(itemPedidoModificadores),
}));

export const itemPedidoModificadoresRelations = relations(
  itemPedidoModificadores,
  ({ one }) => ({
    item: one(itensPedido, {
      fields: [itemPedidoModificadores.itemPedidoId],
      references: [itensPedido.id],
    }),
  }),
);
