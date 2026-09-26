export class ErroDominio extends Error {
  constructor(
    readonly status: number,
    readonly codigo: string,
    mensagem: string,
    readonly detalhes?: unknown,
  ) {
    super(mensagem);
    this.name = "ErroDominio";
  }
}

export const naoAutenticado = () =>
  new ErroDominio(401, "nao_autenticado", "Faça login novamente.");

export const semPermissao = () =>
  new ErroDominio(403, "sem_permissao", "Você não tem permissão para isso.");

export const naoEncontrado = (oque: string) =>
  new ErroDominio(404, "nao_encontrado", `${oque} não encontrado(a).`);

export const conflito = (
  codigo: string,
  mensagem: string,
  detalhes?: unknown,
) => new ErroDominio(409, codigo, mensagem, detalhes);

export const invalido = (mensagem: string, detalhes?: unknown) =>
  new ErroDominio(422, "invalido", mensagem, detalhes);

// Violação de constraint do Postgres, olhando a causa original do driver.
export const violouConstraint = (error: unknown, nome: string) => {
  let atual: unknown = error;
  for (let i = 0; i < 5 && atual; i++) {
    const e = atual as { code?: string; constraint?: string; cause?: unknown };
    if (e.code === "23505" || e.code === "23514") {
      if (e.constraint === nome) return true;
    }
    atual = e.cause;
  }
  return false;
};
