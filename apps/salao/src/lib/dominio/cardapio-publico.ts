import { and, asc, eq, inArray } from "drizzle-orm";

import { db, schema } from "@/db";
import { listarCardapio } from "./cardapio";
import {
  comandaDoCliente,
  type Identificacao,
  mesaAtivaPorToken,
} from "./cliente";
import { configTaxa, mesasDaComanda } from "./comum";
import { miniatura } from "./midia";
import { calcularTaxa } from "./taxa";

// O que o cliente vê pelo QR. Nada de estoque exato, nomes de garçom ou
// itens cancelados: só o necessário para escolher e acompanhar a conta.

export type ProdutoPublico = {
  id: string;
  codigo: number | null;
  nome: string;
  descricao: string | null;
  precoCentavos: number;
  fotoUrl: string | null;
  miniaturaUrl: string | null;
  videoUrl: string | null;
  ingredientes: string[];
  destaque: boolean;
  esgotado: boolean;
  adicionais: { nome: string; precoCentavos: number }[];
  opcoes: string[];
};

export const cardapioPublico = async (token: string) => {
  const mesa = await mesaAtivaPorToken(token);
  const categorias = await listarCardapio(mesa.restauranteId);

  const ids = categorias.flatMap((c) => c.produtos.map((p) => p.id));
  const extras = ids.length
    ? await db()
        .select({
          id: schema.produtos.id,
          fotoUrl: schema.produtos.fotoUrl,
          videoUrl: schema.produtos.videoUrl,
          ingredientes: schema.produtos.ingredientes,
          destaque: schema.produtos.destaque,
        })
        .from(schema.produtos)
        .where(inArray(schema.produtos.id, ids))
    : [];
  const porId = new Map(extras.map((e) => [e.id, e]));

  return {
    mesa: mesa.numero,
    categorias: categorias
      .map((categoria) => ({
        id: categoria.id,
        nome: categoria.nome,
        produtos: categoria.produtos
          // Indisponível por decisão do gerente some; esgotado por estoque aparece marcado.
          .filter((p) => p.disponivel)
          .map((p): ProdutoPublico => {
            const extra = porId.get(p.id);
            return {
              id: p.id,
              codigo: p.codigo,
              nome: p.nome,
              descricao: p.descricao,
              precoCentavos: p.precoCentavos,
              fotoUrl: extra?.fotoUrl ?? null,
              miniaturaUrl: miniatura(extra?.fotoUrl ?? null),
              videoUrl: extra?.videoUrl ?? null,
              ingredientes: extra?.ingredientes ?? [],
              destaque: extra?.destaque ?? false,
              esgotado: p.esgotado,
              adicionais: p.modificadores
                .filter((m) => m.tipo === "adicional")
                .map((m) => ({ nome: m.nome, precoCentavos: m.precoCentavos })),
              opcoes: p.modificadores
                .filter((m) => m.tipo !== "adicional")
                .map((m) => m.nome),
            };
          }),
      }))
      .filter((c) => c.produtos.length > 0),
  };
};

// "Minha conta": o que já foi lançado na comanda do cliente, sem cancelados.
// Mesa com várias comandas: "precisaCartao" até ele dizer qual é a dele.
export const contaPublica = async (
  token: string,
  ident: Identificacao = {},
) => {
  const mesa = await mesaAtivaPorToken(token);
  const { comanda, precisaCartao } = await comandaDoCliente(mesa, ident);
  const config = await configTaxa(db(), mesa.restauranteId);
  if (!comanda)
    return {
      mesa: mesa.numero,
      comanda: null,
      precisaCartao,
      aberta: false as const,
      itens: [],
      totalCentavos: 0,
      mesas: [mesa.numero],
      taxa: {
        ...calcularTaxa(0, config),
        limiteCentavos: config.limiteCentavos,
      },
    };

  const mesas = await mesasDaComanda(db(), comanda.id);
  const itens = await db().query.itensPedido.findMany({
    where: and(
      eq(schema.itensPedido.comandaId, comanda.id),
      eq(schema.itensPedido.status, "ativo"),
    ),
    orderBy: [asc(schema.itensPedido.criadoEm)],
    with: { modificadores: { columns: { nome: true } } },
  });

  return {
    mesa: mesa.numero,
    comanda: comanda.numero,
    precisaCartao: false,
    aberta: true as const,
    mesas: mesas.map((m) => m.numero),
    itens: itens.map((i) => ({
      id: i.id,
      nome: i.nomeProduto,
      quantidade: i.quantidade,
      totalCentavos: i.totalCentavos,
      modificadores: i.modificadores.map((m) => m.nome),
      observacao: i.observacao,
    })),
    totalCentavos: itens.reduce((s, i) => s + i.totalCentavos, 0),
    // Taxa de serviço sugerida (o cliente escolhe se paga ao pedir a conta).
    taxa: {
      ...calcularTaxa(
        itens.reduce((s, i) => s + i.totalCentavos, 0),
        config,
      ),
      limiteCentavos: config.limiteCentavos,
    },
  };
};
