// Ponte entre o server.ts e o código que roda dentro do Next (Route Handlers).
// São bundles diferentes no mesmo processo; só o globalThis é compartilhado.
// O server.ts preenche as funções ao subir; os Route Handlers só chamam.

export type Escopo =
  | "mesas"
  | "cardapio"
  | "impressao"
  | "ajuda"
  | "chamados"
  | `comanda:${string}`;

type Runtime = {
  emitir?: (restauranteId: string, escopos: Escopo[]) => void;
  acordarImpressao?: () => void;
  reportarErro?: (erro: unknown, contexto?: Record<string, unknown>) => void;
  statusImpressoras?: () => Promise<StatusImpressora[]>;
  impressorasDoSistema?: () => Promise<{ nome: string; estado: string }[]>;
};

export type StatusImpressora = {
  id: string;
  nome: string;
  nomeDriver: string;
  estado: "pronta" | "ocupada" | "offline" | "erro" | "desconhecido";
  pendentes: number;
};

const globalRuntime = globalThis as unknown as { __salaoRuntime?: Runtime };

export const runtime = (): Runtime => {
  globalRuntime.__salaoRuntime ??= {};
  return globalRuntime.__salaoRuntime;
};

// O socket só avisa "algo mudou neste escopo"; o cliente busca de novo no banco.
export const notificar = (restauranteId: string, escopos: Escopo[]) => {
  runtime().emitir?.(restauranteId, escopos);
};

export const acordarImpressao = () => {
  runtime().acordarImpressao?.();
};
