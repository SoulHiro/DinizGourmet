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

export const tipoTrabalhoImpressaoEnum = pgEnum("tipo_trabalho_impressao", [
  "pedido",
  "cancelamento",
  "reimpressao",
  "alteracao",
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

export const mesas = pgTable(
  "mesa",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    restauranteId: uuid("restaurante_id")
      .notNull()
      .references(() => restaurantes.id),
    numero: integer("numero").notNull(),
    ativa: boolean("ativa").notNull().default(true),
    criadoEm: criadoEm(),
    atualizadoEm: atualizadoEm(),
  },
  (t) => [uniqueIndex("mesa_numero_idx").on(t.restauranteId, t.numero)],
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
    status: statusComandaEnum("status").notNull().default("aberta"),
    abertaEm: timestamp("aberta_em", { withTimezone: true })
      .notNull()
      .defaultNow(),
    fechadaEm: timestamp("fechada_em", { withTimezone: true }),
    atualizadoEm: atualizadoEm(),
  },
  (t) => [
    index("comanda_restaurante_status_idx").on(t.restauranteId, t.status),
    index("comanda_mesa_principal_idx").on(t.mesaPrincipalId),
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
    // Uma mesa nunca pode estar em duas comandas abertas ao mesmo tempo.
    // É isso que resolve dois garçons abrindo a mesma mesa simultaneamente.
    uniqueIndex("comanda_mesa_ativa_idx")
      .on(t.mesaId)
      .where(sql`${t.saiuEm} is null`),
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

export type TicketPayload = {
  mesas: number[];
  garcom: string;
  rodada: number;
  lancadaEm: string;
  itens: TicketItem[];
  motivo?: string;
  preparoIniciado?: boolean;
  // Ticket de ALTERAÇÃO: como o item era antes (itens = como ficou).
  antes?: TicketItem[];
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
  },
  (t) => [
    index("pedido_ajuda_restaurante_idx").on(t.restauranteId, t.encerradoEm),
    // Um pedido em aberto por mesa: apertar de novo não duplica o alerta.
    uniqueIndex("pedido_ajuda_mesa_aberto_idx")
      .on(t.mesaId)
      .where(sql`${t.encerradoEm} is null and ${t.aceitoPor} is null`),
  ],
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
