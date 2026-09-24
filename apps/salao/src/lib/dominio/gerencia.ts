import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";

import { db, schema } from "@/db";
import type { TicketPayload } from "@/db/schema";
import { hashPin } from "@/lib/auth/pin";
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
      .orderBy(asc(schema.produtos.ordem), asc(schema.produtos.nome)),
  ]);
  return categorias.map((categoria) => ({
    id: categoria.id,
    nome: categoria.nome,
    impressoraId: categoria.impressoraId,
    produtos: produtos
      .filter((p) => p.categoriaId === categoria.id)
      .map((p) => ({
        id: p.id,
        nome: p.nome,
        precoCentavos: p.precoCentavos,
        disponivel: p.disponivel,
        controlaEstoque: p.controlaEstoque,
        estoque: p.estoque,
      })),
  }));
};

export const criarProdutoSchema = z.object({
  categoriaId: z.uuid(),
  nome: z.string().trim().min(2).max(60),
  precoCentavos: z.number().int().min(0).max(1_000_000),
  controlaEstoque: z.boolean().default(false),
  estoque: z.number().int().min(0).max(100_000).nullable().default(null),
});

export const criarProduto = async (
  restauranteId: string,
  input: z.infer<typeof criarProdutoSchema>,
) => {
  const [produto] = await db()
    .insert(schema.produtos)
    .values({
      restauranteId,
      categoriaId: input.categoriaId,
      nome: input.nome,
      buscaNormalizada: normalizarBusca(input.nome),
      precoCentavos: input.precoCentavos,
      controlaEstoque: input.controlaEstoque,
      estoque: input.controlaEstoque ? (input.estoque ?? 0) : null,
    })
    .returning();
  notificar(restauranteId, ["cardapio"]);
  return produto;
};

export const editarProdutoSchema = z.object({
  nome: z.string().trim().min(2).max(60).optional(),
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
  const [produto] = await db()
    .update(schema.produtos)
    .set({
      ...input,
      ...(input.nome ? { buscaNormalizada: normalizarBusca(input.nome) } : {}),
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
  notificar(restauranteId, ["cardapio"]);
  return produto;
};

export const editarCategoriaSchema = z.object({
  impressoraId: z.uuid().nullable(),
});

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
