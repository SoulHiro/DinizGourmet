// Divide a gorjeta proporcionalmente ao valor que cada garçom lançou na
// comanda (Notion: "não por quantidade de itens, nem por tempo").
// Método dos maiores restos: a soma das partes é sempre exatamente o total.
export const dividirGorjeta = (
  totalCentavos: number,
  bases: { funcionarioId: string; baseCentavos: number }[],
  titularId: string,
): { funcionarioId: string; baseCentavos: number; valorCentavos: number }[] => {
  if (totalCentavos <= 0) {
    return bases.map((b) => ({ ...b, valorCentavos: 0 }));
  }
  const somaBases = bases.reduce((s, b) => s + b.baseCentavos, 0);

  // Ninguém lançou nada (ou só itens cancelados): vai tudo para o titular.
  if (somaBases <= 0) {
    const semTitular = bases.filter((b) => b.funcionarioId !== titularId);
    return [
      {
        funcionarioId: titularId,
        baseCentavos: 0,
        valorCentavos: totalCentavos,
      },
      ...semTitular.map((b) => ({ ...b, valorCentavos: 0 })),
    ];
  }

  const partes = bases.map((b) => {
    const exato = (totalCentavos * b.baseCentavos) / somaBases;
    return {
      ...b,
      valorCentavos: Math.floor(exato),
      resto: exato - Math.floor(exato),
    };
  });
  let sobra = totalCentavos - partes.reduce((s, p) => s + p.valorCentavos, 0);
  // Centavos que sobraram do arredondamento vão para os maiores restos.
  for (const parte of [...partes].sort((a, b) => b.resto - a.resto)) {
    if (sobra <= 0) break;
    parte.valorCentavos += 1;
    sobra -= 1;
  }
  return partes.map(({ resto: _resto, ...p }) => p);
};
