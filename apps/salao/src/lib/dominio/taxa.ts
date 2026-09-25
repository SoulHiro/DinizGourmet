// Taxa de serviço: percentual cheio até o limite; acima dele, o reduzido
// (ex.: 10% até R$ 300,00, 5% acima). Função pura: roda igual no servidor e
// no celular do cliente, então o valor mostrado é o mesmo que será cobrado.
export type ConfigTaxa = {
  pct: number;
  pctReduzida: number;
  limiteCentavos: number;
};

export const calcularTaxa = (subtotalCentavos: number, config: ConfigTaxa) => {
  const pct =
    subtotalCentavos > config.limiteCentavos ? config.pctReduzida : config.pct;
  return { pct, valorCentavos: Math.round((subtotalCentavos * pct) / 100) };
};

// Por que a taxa não foi cobrada: lista rápida (1 toque) na hora de receber.
export const MOTIVOS_SEM_TAXA = [
  "cliente_recusou",
  "erro_atendimento",
  "demora_preparo",
  "cortesia",
  "outro",
] as const;
export type MotivoSemTaxa = (typeof MOTIVOS_SEM_TAXA)[number];

export const ROTULO_MOTIVO_SEM_TAXA: Record<MotivoSemTaxa, string> = {
  cliente_recusou: "Cliente recusou a taxa",
  erro_atendimento: "Erro no atendimento/pedido",
  demora_preparo: "Demora excessiva no preparo",
  cortesia: "Cortesia da casa",
  outro: "Outro",
};

// Valor do desconto sobre o consumo (nunca maior que o consumo).
export const valorDoDesconto = (
  desconto: { tipo: "percentual" | "valor"; valor: number },
  subtotalCentavos: number,
) =>
  Math.min(
    subtotalCentavos,
    desconto.tipo === "percentual"
      ? Math.round((subtotalCentavos * desconto.valor) / 100)
      : desconto.valor,
  );
