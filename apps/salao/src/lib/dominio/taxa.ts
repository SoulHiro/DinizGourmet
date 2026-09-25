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
