"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, Loader2, Printer, RotateCcw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { api } from "@/lib/cliente";
import {
  type BlocoLayout,
  CATALOGO,
  colunas,
  type Estilo,
  exemploConta,
  exemploPedido,
  type LayoutImpressao,
  type Linha,
  layoutPadrao,
  type ModeloImpressao,
  montarLinhas,
  type Tamanho,
  type TipoTicket,
} from "@/lib/impressao/layout";
import { cn } from "@/lib/utils";

const LARGURA = 48;

type Layouts = {
  pedido: LayoutImpressao;
  conta: LayoutImpressao;
  restaurante: string;
};
type Impressora = { id: string; nome: string; setor: string; ativa: boolean };

const EXEMPLOS: Record<ModeloImpressao, { valor: string; rotulo: string }[]> = {
  pedido: [
    { valor: "pedido", rotulo: "Pedido" },
    { valor: "alteracao", rotulo: "Alteração" },
    { valor: "cancelamento", rotulo: "Cancelamento" },
  ],
  conta: [
    { valor: "conferencia", rotulo: "Conferência" },
    { valor: "comprovante", rotulo: "Comprovante" },
  ],
};

const ESCALA: Record<Tamanho, number> = { normal: 1, grande: 2, gigante: 3 };

// Folha de bobina: 48 colunas de largura, como na Elgin de 80 mm. O
// tamanho 2x/3x ocupa 2/3 colunas por letra, igual ao papel.
const PapelTermico = ({ linhas }: { linhas: Linha[] }) => (
  <div className="overflow-x-auto rounded-xl bg-neutral-200 p-3">
    <figure
      className="mx-auto w-fit bg-white px-3 py-4 font-mono text-[12px] text-black leading-tight shadow-md"
      aria-label="Pré-visualização do papel"
    >
      <div style={{ width: `${LARGURA}ch` }}>
        {linhas.map((linha, i) => {
          const chave = `${i}-${linha.tipo}`;
          if (linha.tipo === "separador") {
            return (
              <div key={chave} className="whitespace-pre">
                {"-".repeat(LARGURA)}
              </div>
            );
          }
          if (linha.tipo === "espaco") {
            return <div key={chave}>&nbsp;</div>;
          }
          if (linha.tipo === "colunas") {
            return (
              <div
                key={chave}
                className={cn("whitespace-pre", linha.negrito && "font-bold")}
              >
                {colunas(linha.esquerda, linha.direita, LARGURA)}
              </div>
            );
          }
          return (
            <div
              key={chave}
              className={cn(
                "whitespace-pre-wrap break-words",
                linha.centro && "text-center",
              )}
            >
              <span
                style={{ fontSize: `${ESCALA[linha.tamanho ?? "normal"]}em` }}
                className={cn(
                  "leading-tight",
                  linha.negrito && "font-bold",
                  linha.destaque && "bg-black text-white",
                )}
              >
                {linha.texto}
              </span>
            </div>
          );
        })}
      </div>
    </figure>
  </div>
);

const Alternar = ({
  ligado,
  onClick,
  children,
  titulo,
}: {
  ligado: boolean;
  onClick: () => void;
  children: React.ReactNode;
  titulo: string;
}) => (
  <button
    type="button"
    aria-pressed={ligado}
    title={titulo}
    onClick={onClick}
    className={cn(
      "h-9 rounded-lg border px-3 font-semibold text-sm",
      ligado
        ? "border-marca bg-marca text-marca-foreground"
        : "border-borda bg-surface",
    )}
  >
    {children}
  </button>
);

// Personalização do papel: o que aparece, em que ordem e com que estilo, para
// os tickets de pedido (cozinha/bar) e a conta do cliente (caixa).
export const PersonalizarPapel = () => {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["gerente", "papel"],
    queryFn: () => api<Layouts>("/api/gerente/impressao/layout"),
  });
  const { data: impressoras = [] } = useQuery({
    queryKey: ["gerente", "impressoras"],
    queryFn: () => api<Impressora[]>("/api/gerente/impressoras"),
  });

  const [modelo, setModelo] = useState<ModeloImpressao>("pedido");
  const [rascunho, setRascunho] = useState<Record<
    ModeloImpressao,
    LayoutImpressao
  > | null>(null);
  const [exemplo, setExemplo] = useState<Record<ModeloImpressao, string>>({
    pedido: "pedido",
    conta: "conferencia",
  });
  const [impressoraTeste, setImpressoraTeste] = useState("");

  useEffect(() => {
    if (data && !rascunho) {
      setRascunho({ pedido: data.pedido, conta: data.conta });
    }
  }, [data, rascunho]);

  const layout = rascunho?.[modelo];
  const salvo = data?.[modelo];
  const alterado =
    Boolean(layout && salvo) &&
    JSON.stringify(layout) !== JSON.stringify(salvo);

  const linhas = useMemo(() => {
    if (!layout) return [];
    const pedido = exemploPedido();
    if (modelo === "conta") {
      return montarLinhas(
        "conta",
        "caixa",
        {
          ...pedido,
          itens: [],
          conta: exemploConta(
            data?.restaurante || "Xis Diniz",
            exemplo.conta === "comprovante",
          ),
        },
        layout,
      );
    }
    return montarLinhas(exemplo.pedido as TipoTicket, "chapa", pedido, layout);
  }, [layout, modelo, exemplo, data?.restaurante]);

  const mudarLayout = (novo: LayoutImpressao) =>
    setRascunho((atual) => (atual ? { ...atual, [modelo]: novo } : atual));
  const mudarBloco = (id: string, mudanca: Partial<BlocoLayout>) =>
    layout &&
    mudarLayout({
      blocos: layout.blocos.map((b) =>
        b.id === id ? { ...b, ...mudanca } : b,
      ),
    });
  const mudarEstilo = (bloco: BlocoLayout, estilo: Partial<Estilo>) =>
    mudarBloco(bloco.id, { estilo: { ...bloco.estilo, ...estilo } });
  const mudarOpcao = (
    bloco: BlocoLayout,
    chave: string,
    valor: boolean | string,
  ) => mudarBloco(bloco.id, { opcoes: { ...bloco.opcoes, [chave]: valor } });
  const mover = (indice: number, direcao: -1 | 1) => {
    if (!layout) return;
    const blocos = [...layout.blocos];
    const destino = indice + direcao;
    if (destino < 0 || destino >= blocos.length) return;
    [blocos[indice], blocos[destino]] = [blocos[destino], blocos[indice]];
    mudarLayout({ blocos });
  };

  const salvar = useMutation({
    mutationFn: () =>
      api<LayoutImpressao>("/api/gerente/impressao/layout", {
        method: "PUT",
        json: { modelo, layout },
      }),
    onSuccess: (normalizado) => {
      queryClient.setQueryData<Layouts>(["gerente", "papel"], (atual) =>
        atual ? { ...atual, [modelo]: normalizado } : atual,
      );
      setRascunho((atual) =>
        atual ? { ...atual, [modelo]: normalizado } : atual,
      );
      toast.success("Layout salvo. Os próximos tickets já saem assim.");
    },
    onError: (e) => toast.error(e.message),
  });

  const testar = useMutation({
    mutationFn: () =>
      api("/api/gerente/impressao/teste", {
        method: "POST",
        json: { modelo, impressoraId: impressoraTeste },
      }),
    onSuccess: () => toast.success("Teste enviado para a impressora"),
    onError: (e) => toast.error(e.message),
  });

  if (isLoading || !layout) {
    return (
      <Loader2 className="mx-auto mt-6 size-8 animate-spin text-texto-secundario" />
    );
  }

  const ativas = impressoras.filter((i) => i.ativa);
  const catalogo = CATALOGO[modelo];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        {(["pedido", "conta"] as const).map((m) => (
          <Alternar
            key={m}
            ligado={modelo === m}
            titulo={
              m === "pedido"
                ? "Tickets da cozinha e do bar"
                : "Conta impressa no caixa"
            }
            onClick={() => setModelo(m)}
          >
            {m === "pedido" ? "Pedido (cozinha e bar)" : "Conta do cliente"}
          </Alternar>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_auto]">
        <ol className="flex flex-col gap-2">
          {layout.blocos.map((bloco, indice) => {
            const def = catalogo.find((c) => c.id === bloco.id);
            if (!def) return null;
            return (
              <li
                key={bloco.id}
                className={cn(
                  "rounded-xl border border-borda bg-surface p-3",
                  !bloco.ativo && "opacity-60",
                )}
              >
                <div className="flex items-center gap-2">
                  <label className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1 font-semibold">
                    <input
                      type="checkbox"
                      className="size-5"
                      checked={bloco.ativo}
                      disabled={def.obrigatorio}
                      onChange={(e) =>
                        mudarBloco(bloco.id, { ativo: e.target.checked })
                      }
                    />
                    <span className="min-w-0 break-words">{def.rotulo}</span>
                    {def.obrigatorio && (
                      <span className="shrink-0 rounded-full bg-borda px-2 py-0.5 font-normal text-xs">
                        sempre aparece
                      </span>
                    )}
                  </label>
                  <button
                    type="button"
                    aria-label={`Subir ${def.rotulo}`}
                    disabled={indice === 0}
                    onClick={() => mover(indice, -1)}
                    className="flex size-9 items-center justify-center rounded-lg border border-borda disabled:opacity-30"
                  >
                    <ArrowUp className="size-4" />
                  </button>
                  <button
                    type="button"
                    aria-label={`Descer ${def.rotulo}`}
                    disabled={indice === layout.blocos.length - 1}
                    onClick={() => mover(indice, 1)}
                    className="flex size-9 items-center justify-center rounded-lg border border-borda disabled:opacity-30"
                  >
                    <ArrowDown className="size-4" />
                  </button>
                </div>

                {bloco.ativo && (
                  <div className="mt-2 flex flex-col gap-2">
                    <div className="flex flex-wrap gap-1.5">
                      {def.estilos.includes("tamanho") &&
                        (["normal", "grande", "gigante"] as const).map((t) => (
                          <Alternar
                            key={t}
                            ligado={bloco.estilo.tamanho === t}
                            titulo={`Tamanho ${t}`}
                            onClick={() => mudarEstilo(bloco, { tamanho: t })}
                          >
                            {t === "normal"
                              ? "A"
                              : t === "grande"
                                ? "A 2x"
                                : "A 3x"}
                          </Alternar>
                        ))}
                      {def.estilos.includes("negrito") && (
                        <Alternar
                          ligado={bloco.estilo.negrito}
                          titulo="Negrito"
                          onClick={() =>
                            mudarEstilo(bloco, {
                              negrito: !bloco.estilo.negrito,
                            })
                          }
                        >
                          <strong>N</strong>
                        </Alternar>
                      )}
                      {def.estilos.includes("destaque") && (
                        <Alternar
                          ligado={bloco.estilo.destaque}
                          titulo="Fundo escuro com letra clara"
                          onClick={() =>
                            mudarEstilo(bloco, {
                              destaque: !bloco.estilo.destaque,
                            })
                          }
                        >
                          <span className="rounded bg-black px-1 text-white">
                            Destaque
                          </span>
                        </Alternar>
                      )}
                      {def.estilos.includes("centro") && (
                        <Alternar
                          ligado={bloco.estilo.centro}
                          titulo="Centralizar"
                          onClick={() =>
                            mudarEstilo(bloco, { centro: !bloco.estilo.centro })
                          }
                        >
                          Centralizar
                        </Alternar>
                      )}
                    </div>

                    {def.opcoes.map((opcao) =>
                      opcao.tipo === "bool" ? (
                        <label
                          key={opcao.chave}
                          className="flex items-center gap-2 text-sm"
                        >
                          <input
                            type="checkbox"
                            className="size-4"
                            checked={Boolean(bloco.opcoes[opcao.chave])}
                            onChange={(e) =>
                              mudarOpcao(bloco, opcao.chave, e.target.checked)
                            }
                          />
                          {opcao.rotulo}
                        </label>
                      ) : (
                        <div
                          key={opcao.chave}
                          className="flex flex-col gap-1 text-sm"
                        >
                          <span className="text-texto-secundario">
                            {opcao.rotulo}
                          </span>
                          {opcao.multilinha ? (
                            <textarea
                              aria-label={opcao.rotulo}
                              rows={3}
                              maxLength={300}
                              value={String(bloco.opcoes[opcao.chave] ?? "")}
                              onChange={(e) =>
                                mudarOpcao(bloco, opcao.chave, e.target.value)
                              }
                              className="rounded-lg border border-borda bg-surface px-3 py-2 font-mono"
                            />
                          ) : (
                            <input
                              aria-label={opcao.rotulo}
                              maxLength={40}
                              value={String(bloco.opcoes[opcao.chave] ?? "")}
                              onChange={(e) =>
                                mudarOpcao(bloco, opcao.chave, e.target.value)
                              }
                              className="h-10 rounded-lg border border-borda bg-surface px-3"
                            />
                          )}
                        </div>
                      ),
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ol>

        <div className="flex flex-col gap-3 lg:sticky lg:top-20 lg:self-start">
          <div className="flex flex-wrap gap-1.5">
            {EXEMPLOS[modelo].map((e) => (
              <Alternar
                key={e.valor}
                ligado={exemplo[modelo] === e.valor}
                titulo={`Ver como sai: ${e.rotulo}`}
                onClick={() => setExemplo({ ...exemplo, [modelo]: e.valor })}
              >
                {e.rotulo}
              </Alternar>
            ))}
          </div>
          <PapelTermico linhas={linhas} />
          <p className="max-w-[26rem] text-texto-secundario text-xs">
            Exemplo com mesas juntas. O papel sai igual a esta folha; acentos
            dependem da configuração da impressora.
          </p>

          <div className="flex flex-wrap gap-2">
            <Button
              variant="acao"
              disabled={!alterado || salvar.isPending}
              onClick={() => salvar.mutate()}
            >
              Salvar
            </Button>
            <Button
              disabled={!alterado}
              onClick={() => salvo && mudarLayout(salvo)}
            >
              Descartar
            </Button>
            <Button
              variant="ghost"
              onClick={() => mudarLayout(layoutPadrao(modelo))}
            >
              <RotateCcw /> Voltar ao padrão
            </Button>
          </div>

          <div className="flex flex-wrap items-center gap-2 border-borda border-t pt-3">
            <select
              aria-label="Impressora para o teste"
              value={impressoraTeste}
              onChange={(e) => setImpressoraTeste(e.target.value)}
              className="h-12 rounded-lg border border-borda bg-surface px-3"
            >
              <option value="">Imprimir teste em...</option>
              {ativas.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.nome}
                </option>
              ))}
            </select>
            <Button
              disabled={!impressoraTeste || alterado || testar.isPending}
              onClick={() => testar.mutate()}
            >
              <Printer /> Imprimir teste
            </Button>
          </div>
          {alterado && (
            <p className="text-sm text-texto-secundario">
              Salve para imprimir o teste com as mudanças.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
