// Regras do pagamento da conta. Funções puras: a tela do caixa mostra
// "falta" e "troco" com a mesma conta que o servidor usa para aceitar.

export const METODOS_PAGAMENTO = [
  "dinheiro",
  "credito",
  "debito",
  "pix",
  "vale_refeicao",
] as const;
export type MetodoPagamento = (typeof METODOS_PAGAMENTO)[number];

export const ROTULO_METODO: Record<MetodoPagamento, string> = {
  dinheiro: "Dinheiro",
  credito: "Crédito",
  debito: "Débito",
  pix: "Pix",
  vale_refeicao: "Vale-refeição",
};

export type PagamentoInput = {
  metodo: MetodoPagamento;
  // Quanto abate da conta.
  valorCentavos: number;
  // Só dinheiro: quanto o cliente entregou (vazio = valor exato).
  recebidoCentavos?: number;
};

export const trocoDe = (p: PagamentoInput) =>
  p.metodo === "dinheiro"
    ? Math.max(0, (p.recebidoCentavos ?? p.valorCentavos) - p.valorCentavos)
    : 0;

// Situação dos pagamentos frente ao total: quanto falta (negativo = passou)
// e o troco total a devolver.
export const conferirPagamentos = (
  pagamentos: PagamentoInput[],
  totalCentavos: number,
) => {
  const pagoCentavos = pagamentos.reduce((s, p) => s + p.valorCentavos, 0);
  const dinheiroCurto = pagamentos.some(
    (p) =>
      p.metodo === "dinheiro" &&
      p.recebidoCentavos !== undefined &&
      p.recebidoCentavos < p.valorCentavos,
  );
  return {
    pagoCentavos,
    faltaCentavos: totalCentavos - pagoCentavos,
    trocoCentavos: pagamentos.reduce((s, p) => s + trocoDe(p), 0),
    dinheiroCurto,
    fecha: pagoCentavos === totalCentavos && !dinheiroCurto,
  };
};
