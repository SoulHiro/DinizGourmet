import { lerJson, rota } from "@/lib/api";
import { exigirSessao } from "@/lib/auth/atual";
import {
  corrigirPagamento,
  corrigirPagamentoSchema,
} from "@/lib/dominio/correcoes-caixa";

type Contexto = { params: Promise<{ id: string }> };

// Só o gerente corrige a forma de pagamento.
export const PATCH = rota<Contexto>(async (request, { params }) => {
  const sessao = await exigirSessao(["gerente"]);
  const { id } = await params;
  const dados = await lerJson(request, corrigirPagamentoSchema);
  return Response.json(await corrigirPagamento(sessao, id, dados));
});
