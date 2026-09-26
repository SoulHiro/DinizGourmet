import { and, asc, eq, sql } from "drizzle-orm";
import { z } from "zod";

import { db, schema } from "@/db";
import type { TicketPayload } from "@/db/schema";
import { hashPin } from "@/lib/auth/pin";
import { configTaxa } from "@/lib/dominio/comum";
import { apagarMidia } from "@/lib/dominio/midia";
import type { MotivoSemTaxa } from "@/lib/dominio/taxa";
import { conflito, naoEncontrado, violouConstraint } from "@/lib/erros";
import { acordarImpressao, notificar, runtime } from "@/lib/runtime";
import { normalizarBusca } from "@/lib/texto";

// Cadastros do dia a dia do gerente: o cardápio e a equipe mudam toda noite,
// então nada disso pode depender do seed.

const pinSchema = z.string().regex(/^\d{4}$/, "O PIN tem 4 números.");

// Cardápio
export const listarProdutosGerencia = async (restauranteId: string) => {
  const [categorias, produtos] = await Promise.all([
    db()
      .select()
      .from(schema.categorias)
      .where(eq(schema.categorias.restauranteId, restauranteId))
      .orderBy(asc(schema.categorias.ordem)),
    db()
      .select()
      .from(schema.produtos)
      .where(eq(schema.produtos.restauranteId, restauranteId))
      .orderBy(asc(schema.produtos.codigo), asc(schema.produtos.nome)),
  ]);
  return categorias.map((categoria) => ({
    id: categoria.id,
    nome: categoria.nome,
    impressoraId: categoria.impressoraId,
    codigoInicio: categoria.codigoInicio,
    codigoFim: categoria.codigoFim,
    produtos: produtos
      .filter((p) => p.categoriaId === categoria.id)
      .map((p) => ({
        id: p.id,
        codigo: p.codigo,
        nome: p.nome,
        descricao: p.descricao,
        fotoUrl: p.fotoUrl,
        videoUrl: p.videoUrl,
        ingredientes: p.ingredientes,
        destaque: p.destaque,
        precoCentavos: p.precoCentavos,
        disponivel: p.disponivel,
        controlaEstoque: p.controlaEstoque,
        estoque: p.estoque,
      })),
  }));
};

const codigoSchema = z.number().int().min(1).max(9999);

// Menor código livre dentro da faixa da categoria.
const proximoCodigoLivre = async (
  restauranteId: string,
  categoriaId: string,
) => {
  const [categoria] = await db()
    .select()
    .from(schema.categorias)
    .where(
      and(
        eq(schema.categorias.id, categoriaId),
        eq(schema.categorias.restauranteId, restauranteId),
      ),
    );
  if (!categoria) throw naoEncontrado("Categoria");
  if (categoria.codigoInicio === null || categoria.codigoFim === null)
    return null;

  const usados = new Set(
    (
      await db()
        .select({ codigo: schema.produtos.codigo })
        .from(schema.produtos)
        .where(eq(schema.produtos.restauranteId, restauranteId))
    ).map((p) => p.codigo),
  );
  for (
    let codigo = categoria.codigoInicio;
    codigo <= categoria.codigoFim;
    codigo++
  ) {
    if (!usados.has(codigo)) return codigo;
  }
  throw conflito(
    "faixa_cheia",
    `A faixa de códigos de ${categoria.nome} (${categoria.codigoInicio}–${categoria.codigoFim}) está cheia. Aumente a faixa.`,
  );
};

const traduzirCodigoRepetido = (error: unknown, codigo?: number | null) => {
  if (violouConstraint(error, "produto_codigo_idx")) {
    return conflito(
      "codigo_em_uso",
      `O código ${codigo} já é de outro produto.`,
    );
  }
  return error;
};

export const criarProdutoSchema = z.object({
  categoriaId: z.uuid(),
  nome: z.string().trim().min(2).max(60),
  precoCentavos: z.number().int().min(0).max(1_000_000),
  codigo: codigoSchema.optional(),
  controlaEstoque: z.boolean().default(false),
  estoque: z.number().int().min(0).max(100_000).nullable().default(null),
});

export const criarProduto = async (
  restauranteId: string,
  input: z.infer<typeof criarProdutoSchema>,
) => {
  const codigo =
    input.codigo ??
    (await proximoCodigoLivre(restauranteId, input.categoriaId));
  try {
    const [produto] = await db()
      .insert(schema.produtos)
      .values({
        restauranteId,
        categoriaId: input.categoriaId,
        codigo,
        nome: input.nome,
        buscaNormalizada: normalizarBusca(input.nome),
        precoCentavos: input.precoCentavos,
        controlaEstoque: input.controlaEstoque,
        estoque: input.controlaEstoque ? (input.estoque ?? 0) : null,
      })
      .returning();
    notificar(restauranteId, ["cardapio"]);
    return produto;
  } catch (error) {
    throw traduzirCodigoRepetido(error, codigo);
  }
};

// Só arquivos enviados pelo próprio sistema (/midia/...) ou links http(s).
const urlMidia = z
  .string()
  .trim()
  .max(500)
  .refine(
    (u) => u.startsWith("/midia/") || /^https?:\/\//.test(u),
    "Endereço de mídia inválido.",
  )
  .nullable();

export const editarProdutoSchema = z.object({
  nome: z.string().trim().min(2).max(60).optional(),
  descricao: z.string().trim().max(400).nullable().optional(),
  fotoUrl: urlMidia.optional(),
  videoUrl: urlMidia.optional(),
  ingredientes: z.array(z.string().trim().min(1).max(40)).max(30).optional(),
  destaque: z.boolean().optional(),
  codigo: codigoSchema.nullable().optional(),
  precoCentavos: z.number().int().min(0).max(1_000_000).optional(),
  disponivel: z.boolean().optional(),
  controlaEstoque: z.boolean().optional(),
  // Contagem definida no início da noite.
  estoque: z.number().int().min(0).max(100_000).nullable().optional(),
  categoriaId: z.uuid().optional(),
});

export const editarProduto = async (
  restauranteId: string,
  produtoId: string,
  input: z.infer<typeof editarProdutoSchema>,
) => {
  try {
    const [anterior] = await db()
      .select({
        fotoUrl: schema.produtos.fotoUrl,
        videoUrl: schema.produtos.videoUrl,
      })
      .from(schema.produtos)
      .where(eq(schema.produtos.id, produtoId));
    const [produto] = await db()
      .update(schema.produtos)
      .set({
        ...input,
        ...(input.nome
          ? { buscaNormalizada: normalizarBusca(input.nome) }
          : {}),
        ...(input.controlaEstoque === false ? { estoque: null } : {}),
      })
      .where(
        and(
          eq(schema.produtos.id, produtoId),
          eq(schema.produtos.restauranteId, restauranteId),
        ),
      )
      .returning();
    if (!produto) throw naoEncontrado("Produto");
    // Foto ou vídeo trocado/removido: apaga o arquivo antigo da pasta.
    for (const campo of ["fotoUrl", "videoUrl"] as const) {
      if (anterior?.[campo] && anterior[campo] !== produto[campo]) {
        await apagarMidia(anterior[campo]);
      }
    }
    notificar(restauranteId, ["cardapio"]);
    return produto;
  } catch (error) {
    throw traduzirCodigoRepetido(error, input.codigo);
  }
};

export const editarCategoriaSchema = z
  .object({
    impressoraId: z.uuid().nullable().optional(),
    codigoInicio: codigoSchema.nullable().optional(),
    codigoFim: codigoSchema.nullable().optional(),
  })
  .refine(
    (c) =>
      c.codigoInicio == null ||
      c.codigoFim == null ||
      c.codigoInicio <= c.codigoFim,
    "O início da faixa precisa ser menor que o fim.",
  );

export const editarCategoria = async (
  restauranteId: string,
  categoriaId: string,
  input: z.infer<typeof editarCategoriaSchema>,
) => {
  const [categoria] = await db()
    .update(schema.categorias)
    .set(input)
    .where(
      and(
        eq(schema.categorias.id, categoriaId),
        eq(schema.categorias.restauranteId, restauranteId),
      ),
    )
    .returning();
  if (!categoria) throw naoEncontrado("Categoria");
  notificar(restauranteId, ["cardapio"]);
  return categoria;
};

// Mesas
export const listarMesasGerencia = (restauranteId: string) =>
  db()
    .select({
      id: schema.mesas.id,
      numero: schema.mesas.numero,
      ativa: schema.mesas.ativa,
    })
    .from(schema.mesas)
    .where(eq(schema.mesas.restauranteId, restauranteId))
    .orderBy(asc(schema.mesas.numero));

export const criarMesaSchema = z.object({
  numero: z.number().int().min(1).max(999),
});

export const criarMesa = async (restauranteId: string, numero: number) => {
  try {
    const [mesa] = await db()
      .insert(schema.mesas)
      .values({ restauranteId, numero })
      .returning();
    notificar(restauranteId, ["mesas"]);
    return mesa;
  } catch (error) {
    if (violouConstraint(error, "mesa_numero_idx")) {
      throw conflito("mesa_existe", `A mesa ${numero} já existe.`);
    }
    throw error;
  }
};

export const editarMesaSchema = z.object({ ativa: z.boolean() });

export const editarMesa = async (
  restauranteId: string,
  mesaId: string,
  ativa: boolean,
) => {
  const [mesa] = await db()
    .update(schema.mesas)
    .set({ ativa })
    .where(
      and(
        eq(schema.mesas.id, mesaId),
        eq(schema.mesas.restauranteId, restauranteId),
      ),
    )
    .returning();
  if (!mesa) throw naoEncontrado("Mesa");
  notificar(restauranteId, ["mesas"]);
  return mesa;
};

// Equipe
export const listarEquipe = (restauranteId: string) =>
  db()
    .select({
      id: schema.funcionarios.id,
      nome: schema.funcionarios.nome,
      papel: schema.funcionarios.papel,
      ativo: schema.funcionarios.ativo,
      bloqueadoAte: schema.funcionarios.bloqueadoAte,
    })
    .from(schema.funcionarios)
    .where(eq(schema.funcionarios.restauranteId, restauranteId))
    .orderBy(asc(schema.funcionarios.nome));

export const criarFuncionarioSchema = z.object({
  nome: z.string().trim().min(2).max(40),
  papel: z.enum(["garcom", "gerente", "caixa"]),
  pin: pinSchema,
});

export const criarFuncionario = async (
  restauranteId: string,
  input: z.infer<typeof criarFuncionarioSchema>,
) => {
  const [funcionario] = await db()
    .insert(schema.funcionarios)
    .values({
      restauranteId,
      nome: input.nome,
      papel: input.papel,
      pinHash: await hashPin(input.pin),
    })
    .returning({ id: schema.funcionarios.id, nome: schema.funcionarios.nome });
  return funcionario;
};

export const editarFuncionarioSchema = z.object({
  nome: z.string().trim().min(2).max(40).optional(),
  papel: z.enum(["garcom", "gerente", "caixa"]).optional(),
  ativo: z.boolean().optional(),
  pin: pinSchema.optional(),
});

export const editarFuncionario = async (
  restauranteId: string,
  funcionarioId: string,
  input: z.infer<typeof editarFuncionarioSchema>,
) => {
  const { pin, ...resto } = input;
  const [funcionario] = await db()
    .update(schema.funcionarios)
    .set({
      ...resto,
      // Trocar o PIN também desbloqueia quem errou demais.
      ...(pin
        ? {
            pinHash: await hashPin(pin),
            tentativasFalhas: 0,
            bloqueadoAte: null,
          }
        : {}),
    })
    .where(
      and(
        eq(schema.funcionarios.id, funcionarioId),
        eq(schema.funcionarios.restauranteId, restauranteId),
      ),
    )
    .returning({ id: schema.funcionarios.id });
  if (!funcionario) throw naoEncontrado("Funcionário");
  if (input.ativo === false) {
    await db()
      .update(schema.sessoes)
      .set({ revogadaEm: new Date() })
      .where(eq(schema.sessoes.funcionarioId, funcionarioId));
  }
  return funcionario;
};

// Impressoras
export const listarImpressorasGerencia = (restauranteId: string) =>
  db()
    .select()
    .from(schema.impressoras)
    .where(eq(schema.impressoras.restauranteId, restauranteId))
    .orderBy(asc(schema.impressoras.nome));

export const impressoraSchema = z.object({
  nome: z.string().trim().min(2).max(40),
  nomeDriver: z.string().trim().min(1).max(200),
  setor: z.enum(["chapa", "fritura", "bar", "caixa"]),
  ativa: z.boolean().default(true),
});

export const salvarImpressora = async (
  restauranteId: string,
  impressoraId: string | null,
  input: z.infer<typeof impressoraSchema>,
) => {
  if (!impressoraId) {
    const [nova] = await db()
      .insert(schema.impressoras)
      .values({ restauranteId, ...input })
      .returning();
    return nova;
  }
  const [editada] = await db()
    .update(schema.impressoras)
    .set(input)
    .where(
      and(
        eq(schema.impressoras.id, impressoraId),
        eq(schema.impressoras.restauranteId, restauranteId),
      ),
    )
    .returning();
  if (!editada) throw naoEncontrado("Impressora");
  notificar(restauranteId, ["impressao"]);
  return editada;
};

// Ticket de teste pela fila normal: valida driver, acentos e corte.
export const imprimirTeste = async (
  restauranteId: string,
  impressoraId: string,
) => {
  const payload: TicketPayload = {
    mesas: [0],
    garcom: "TESTE",
    rodada: 0,
    lancadaEm: new Date().toISOString(),
    itens: [
      {
        itemId: "teste",
        quantidade: 1,
        nome: "Teste de impressão - ÇÃÉÕÜ çãéõü",
        modificadores: ["Sem ervilha", "Coração"],
        observacao: "Se os acentos saíram certos, está tudo ok",
        mesaOrigem: 0,
      },
    ],
  };
  await db().insert(schema.trabalhosImpressao).values({
    restauranteId,
    impressoraId,
    tipo: "pedido",
    payload,
  });
  notificar(restauranteId, ["impressao"]);
  acordarImpressao();
};

// Impressoras instaladas no Windows, para escolher o nome exato do driver.
// Vem do server.ts pelo runtime: o addon nativo nunca entra no bundle do Next.
export const impressorasDoSistema = async () =>
  (await runtime().impressorasDoSistema?.()) ?? [];

// "Noite" = desde o meio-dia (horário de Brasília): o salão abre às 18h e
// fecha de madrugada, então a virada do dia não pode partir o expediente.
export const inicioDaNoite = (agora = new Date()) => {
  const brasilia = new Date(
    agora.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }),
  );
  const diferenca = agora.getTime() - brasilia.getTime();
  const inicio = new Date(brasilia);
  if (brasilia.getHours() < 12) inicio.setDate(inicio.getDate() - 1);
  inicio.setHours(12, 0, 0, 0);
  return new Date(inicio.getTime() + diferenca);
};

export type ResumoGarcom = {
  funcionarioId: string;
  nome: string;
  vendasCentavos: number;
  gorjetaCentavos: number;
  taxaCentavos: number;
  // Contas recebidas por ele sem taxa de serviço e descontos que aplicou.
  semTaxa: number;
  descontoCentavos: number;
  chamadosAtendidos: number;
  cancelamentos: number;
};

export const resumoNoite = async (
  restauranteId: string,
  desde = inicioDaNoite(),
) => {
  const linhas = (
    await db().execute<{
      funcionario_id: string;
      nome: string;
      vendas: number;
      gorjeta: number;
      taxa: number;
      sem_taxa: number;
      desconto: number;
      chamados: number;
      cancelamentos: number;
    }>(sql`
      select f.id as funcionario_id, f.nome,
             coalesce((
               select sum(i.total_centavos) from rodada r
                 join item_pedido i on i.rodada_id = r.id and i.status = 'ativo'
                where r.funcionario_id = f.id and r.lancada_em >= ${desde}
             ), 0)::int as vendas,
             coalesce((
               select sum(g.valor_centavos) from gorjeta_divisao g
                 join comanda c on c.id = g.comanda_id
                where g.funcionario_id = f.id and g.tipo = 'gorjeta'
                  and c.fechada_em >= ${desde}
             ), 0)::int as gorjeta,
             coalesce((
               select sum(g.valor_centavos) from gorjeta_divisao g
                 join comanda c on c.id = g.comanda_id
                where g.funcionario_id = f.id and g.tipo = 'taxa'
                  and c.fechada_em >= ${desde}
             ), 0)::int as taxa,
             (select count(*) from comanda c
               where c.fechada_por = f.id and c.fechada_em >= ${desde}
                 and c.sem_taxa_motivo is not null)::int as sem_taxa,
             coalesce((
               select sum(c.desconto_centavos) from comanda c
                where c.fechada_por = f.id and c.fechada_em >= ${desde}
             ), 0)::int as desconto,
             (select count(*) from chamado ch
               where ch.aceito_por = f.id and ch.aceito_em >= ${desde})::int as chamados,
             (select count(*) from item_pedido i
               where i.cancelado_por = f.id and i.cancelado_em >= ${desde}
                 and i.motivo_cancelamento <> 'Alterado')::int as cancelamentos
        from funcionario f
       where f.restaurante_id = ${restauranteId}
       order by f.nome
    `)
  ).rows;

  const garcons: ResumoGarcom[] = linhas
    .map((l) => ({
      funcionarioId: l.funcionario_id,
      nome: l.nome,
      vendasCentavos: l.vendas,
      gorjetaCentavos: l.gorjeta,
      taxaCentavos: l.taxa,
      semTaxa: l.sem_taxa,
      descontoCentavos: l.desconto,
      chamadosAtendidos: l.chamados,
      cancelamentos: l.cancelamentos,
    }))
    .filter(
      (g) =>
        g.vendasCentavos ||
        g.gorjetaCentavos ||
        g.taxaCentavos ||
        g.semTaxa ||
        g.descontoCentavos ||
        g.chamadosAtendidos ||
        g.cancelamentos,
    );

  // Taxa não cobrada por motivo (com as observações de "Outro").
  const semTaxa = (
    await db().execute<{
      motivo: string;
      quantidade: number;
      observacoes: string[] | null;
    }>(sql`
      select sem_taxa_motivo as motivo, count(*)::int as quantidade,
             array_remove(array_agg(sem_taxa_observacao), null) as observacoes
        from comanda
       where restaurante_id = ${restauranteId} and fechada_em >= ${desde}
         and sem_taxa_motivo is not null
       group by sem_taxa_motivo
       order by quantidade desc
    `)
  ).rows.map((r) => ({
    motivo: r.motivo as MotivoSemTaxa,
    quantidade: r.quantidade,
    observacoes: r.observacoes ?? [],
  }));

  return {
    desde: desde.toISOString(),
    garcons,
    semTaxa,
    totalDescontoCentavos: garcons.reduce((s, g) => s + g.descontoCentavos, 0),
    totalVendasCentavos: garcons.reduce((s, g) => s + g.vendasCentavos, 0),
    totalGorjetaCentavos: garcons.reduce((s, g) => s + g.gorjetaCentavos, 0),
    totalTaxaCentavos: garcons.reduce((s, g) => s + g.taxaCentavos, 0),
  };
};

// Taxa de serviço: pct cheio até o limite, pct reduzido acima dele.
export const taxaServicoSchema = z
  .object({
    pct: z.number().int().min(0).max(30),
    pctReduzida: z.number().int().min(0).max(30),
    limiteCentavos: z.number().int().min(0).max(100_000_000),
  })
  .refine((t) => t.pctReduzida <= t.pct, {
    message: "A taxa reduzida não pode ser maior que a cheia",
  });

export const lerTaxaServico = (restauranteId: string) =>
  configTaxa(db(), restauranteId);

export const salvarTaxaServico = async (
  restauranteId: string,
  dados: z.infer<typeof taxaServicoSchema>,
) => {
  await db()
    .update(schema.restaurantes)
    .set({
      taxaServicoPct: dados.pct,
      taxaServicoPctReduzida: dados.pctReduzida,
      taxaServicoLimiteCentavos: dados.limiteCentavos,
    })
    .where(eq(schema.restaurantes.id, restauranteId));
  notificar(restauranteId, ["mesas"]);
  return dados;
};

// Mesas com o link do QR (só o gerente vê os tokens).
export const qrDasMesas = (restauranteId: string) =>
  db()
    .select({ numero: schema.mesas.numero, token: schema.mesas.tokenQr })
    .from(schema.mesas)
    .where(
      and(
        eq(schema.mesas.restauranteId, restauranteId),
        eq(schema.mesas.ativa, true),
      ),
    )
    .orderBy(asc(schema.mesas.numero));
