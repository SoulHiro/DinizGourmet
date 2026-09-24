import { z } from "zod";

import { ErroDominio } from "@/lib/erros";
import { runtime } from "@/lib/runtime";

type Handler<C> = (request: Request, contexto: C) => Promise<Response>;

// Padroniza as respostas de erro das rotas: { codigo, mensagem, detalhes }.
export const rota =
  <C>(handler: Handler<C>): Handler<C> =>
  async (request, contexto) => {
    try {
      return await handler(request, contexto);
    } catch (error) {
      if (error instanceof ErroDominio) {
        return Response.json(
          {
            codigo: error.codigo,
            mensagem: error.message,
            detalhes: error.detalhes,
          },
          { status: error.status },
        );
      }
      if (error instanceof z.ZodError) {
        return Response.json(
          {
            codigo: "invalido",
            mensagem: "Dados inválidos.",
            detalhes: z.treeifyError(error),
          },
          { status: 422 },
        );
      }
      const caminho = new URL(request.url).pathname;
      const reportar = runtime().reportarErro;
      if (reportar) reportar(error, { rota: `${request.method} ${caminho}` });
      else console.error("[api] erro inesperado:", error);
      return Response.json(
        { codigo: "erro_interno", mensagem: "Erro inesperado no servidor." },
        { status: 500 },
      );
    }
  };

export const lerJson = async <T extends z.ZodType>(
  request: Request,
  schema: T,
): Promise<z.infer<T>> => {
  let corpo: unknown;
  try {
    corpo = await request.json();
  } catch {
    corpo = undefined;
  }
  return schema.parse(corpo);
};
