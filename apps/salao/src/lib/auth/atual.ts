import { cookies } from "next/headers";

import type { PapelFuncionario } from "@/db/schema";
import { naoAutenticado, semPermissao } from "@/lib/erros";
import { COOKIE_SESSAO, type Sessao, validarToken } from "./sessao";

// Validação real da sessão (o proxy.ts só faz a checagem otimista do cookie).
export const sessaoAtual = async (): Promise<Sessao | null> => {
  const token = (await cookies()).get(COOKIE_SESSAO)?.value;
  return validarToken(token);
};

export const exigirSessao = async (
  papeis?: PapelFuncionario[],
): Promise<Sessao> => {
  const sessao = await sessaoAtual();
  if (!sessao) throw naoAutenticado();
  if (papeis && !papeis.includes(sessao.funcionario.papel)) {
    throw semPermissao();
  }
  return sessao;
};
