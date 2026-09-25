"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowRightLeft,
  Combine,
  DoorOpen,
  Hand,
  HandHeart,
  Loader2,
  MoreVertical,
  Split,
} from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { useFuncionario } from "@/components/providers/sessao";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { api } from "@/lib/cliente";
import { useMapa } from "@/lib/consultas";
import { dividirGorjeta } from "@/lib/dominio/gorjeta";
import type { DetalheMesa } from "@/lib/dominio/mesas";
import { cn, formatBRL } from "@/lib/utils";

type Modo = "menu" | "juntar" | "transferir" | "fechar";

export const AcoesMesa = ({ detalhe }: { detalhe: DetalheMesa }) => {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: mapa } = useMapa();
  const [modo, setModo] = useState<Modo | null>(null);
  const [selecionadas, setSelecionadas] = useState<string[]>([]);
  const [gorjeta, setGorjeta] = useState("");
  const [taxaServico, setTaxaServico] = useState(true);
  const eu = useFuncionario();
  const pathname = usePathname();

  const { mesa, comanda } = detalhe;
  const principal =
    !comanda || comanda.mesas.find((m) => m.principal)?.id === mesa.id;
  const livres =
    mapa?.filter((m) => m.status === "livre" && m.id !== mesa.id) ?? [];

  const fechar = () => {
    setModo(null);
    setSelecionadas([]);
    setGorjeta("");
  };

  // Receber pagamento: parte do que o cliente escolheu no QR, se pediu.
  const abrirPagamento = () => {
    const pedido = comanda?.pedidoConta;
    setTaxaServico(pedido?.taxaServico ?? true);
    setGorjeta(
      pedido?.gorjetaCentavos
        ? (pedido.gorjetaCentavos / 100).toFixed(2).replace(".", ",")
        : "",
    );
    setModo("fechar");
  };

  // Vindo do alerta "pediu a conta" (?receber), abre direto o pagamento.
  // biome-ignore lint/correctness/useExhaustiveDependencies: só ao montar a tela.
  useEffect(() => {
    if (!comanda) return;
    if (new URLSearchParams(window.location.search).has("receber")) {
      abrirPagamento();
      router.replace(pathname);
    }
  }, []);

  const gorjetaCentavos = Math.max(
    0,
    Math.round(Number.parseFloat(gorjeta.replace(",", ".") || "0") * 100) || 0,
  );
  const taxaCentavos = comanda && taxaServico ? comanda.taxa.valorCentavos : 0;
  const totalCobrar =
    (comanda?.totalCentavos ?? 0) + taxaCentavos + gorjetaCentavos;
  // Prévia da divisão (o servidor refaz a conta ao fechar).
  const dividir = (valor: number) =>
    comanda && valor > 0
      ? dividirGorjeta(
          valor,
          comanda.equipe.map((e) => ({
            funcionarioId: e.id,
            baseCentavos: e.baseCentavos,
          })),
          comanda.titularId,
        )
      : [];
  const previaGorjeta = dividir(gorjetaCentavos);
  const previaTaxa = dividir(taxaCentavos);
  const souDaMesa = comanda?.equipe.some((e) => e.id === eu.id) ?? false;

  const acao = useMutation({
    mutationFn: async (
      tipo: "juntar" | "transferir" | "separar" | "fechar",
    ) => {
      const caminho = `/api/mesas/${mesa.id}/${tipo}`;
      if (tipo === "juntar")
        return api(caminho, {
          method: "POST",
          json: { mesaIds: selecionadas },
        });
      if (tipo === "transferir") {
        return api(caminho, {
          method: "POST",
          json: { destinoMesaId: selecionadas[0] },
        });
      }
      if (tipo === "fechar") {
        return api(caminho, {
          method: "POST",
          json: { taxaServico, gorjetaCentavos },
        });
      }
      return api(caminho, { method: "POST" });
    },
    onSuccess: (_resultado, tipo) => {
      queryClient.invalidateQueries({ queryKey: ["mesas"] });
      const mensagens = {
        juntar: "Mesas juntadas",
        transferir: "Comanda transferida",
        separar: `Mesa ${mesa.numero} separada`,
        fechar: `Conta paga, mesa ${mesa.numero} liberada`,
      };
      toast.success(mensagens[tipo]);
      fechar();
      if (tipo === "transferir")
        router.replace(`/garcom/mesa/${selecionadas[0]}`);
      if (tipo === "fechar" || tipo === "separar") router.push("/garcom");
    },
    onError: (error) => toast.error(error.message),
  });

  const alternar = (id: string, unica: boolean) =>
    setSelecionadas((atual) =>
      unica
        ? [id]
        : atual.includes(id)
          ? atual.filter((x) => x !== id)
          : [...atual, id],
    );

  const pedirAjuda = useMutation({
    mutationFn: () =>
      api<{ jaExistia: boolean }>("/api/ajuda", {
        method: "POST",
        json: { mesaId: mesa.id },
      }),
    onSuccess: ({ jaExistia }) => {
      toast.success(
        jaExistia
          ? "O pedido de ajuda já estava ativo."
          : "Alerta enviado para os outros garçons.",
      );
      queryClient.invalidateQueries({ queryKey: ["ajuda"] });
      fechar();
    },
    onError: (error) => toast.error(error.message),
  });

  const oferecer = useMutation({
    mutationFn: () => api(`/api/mesas/${mesa.id}/auxiliar`, { method: "POST" }),
    onSuccess: () => {
      toast.success(`Você entrou como auxiliar na mesa ${mesa.numero}`);
      queryClient.invalidateQueries({ queryKey: ["mesas"] });
      fechar();
    },
    onError: (error) => toast.error(error.message),
  });

  const opcoes = [
    {
      modo: "juntar" as const,
      rotulo: "Juntar mesas",
      icone: Combine,
      visivel: principal,
    },
    {
      modo: "transferir" as const,
      rotulo: "Transferir para outra mesa",
      icone: ArrowRightLeft,
      visivel: Boolean(comanda) && principal,
    },
    {
      modo: "fechar" as const,
      rotulo: "Receber pagamento e fechar",
      icone: DoorOpen,
      visivel: Boolean(comanda),
    },
  ];

  return (
    <>
      <button
        type="button"
        aria-label="Ações da mesa"
        onClick={() => setModo("menu")}
        className="flex size-12 items-center justify-center"
      >
        <MoreVertical />
      </button>

      <Drawer
        open={modo !== null}
        onOpenChange={(aberto) => !aberto && fechar()}
      >
        <DrawerContent>
          <DrawerHeader className="text-left">
            <DrawerTitle className="text-xl">
              {modo === "juntar" && `Juntar com a mesa ${mesa.numero}`}
              {modo === "transferir" && `Mover a mesa ${mesa.numero} para...`}
              {modo === "fechar" && `Pagamento da mesa ${mesa.numero}`}
              {modo === "menu" && `Mesa ${mesa.numero}`}
            </DrawerTitle>
          </DrawerHeader>

          <div className="overflow-y-auto px-4">
            {modo === "menu" && (
              <div className="flex flex-col gap-2">
                <Button
                  size="lg"
                  variant="acao"
                  className="justify-start"
                  disabled={pedirAjuda.isPending}
                  onClick={() => pedirAjuda.mutate()}
                >
                  <Hand /> Pedir ajuda a outro garçom
                </Button>
                {comanda && !souDaMesa && (
                  <Button
                    size="lg"
                    className="justify-start"
                    disabled={oferecer.isPending}
                    onClick={() => oferecer.mutate()}
                  >
                    <HandHeart /> Ajudar nesta mesa (entrar como auxiliar)
                  </Button>
                )}
                {opcoes
                  .filter((o) => o.visivel)
                  .map((o) => (
                    <Button
                      key={o.modo}
                      size="lg"
                      className="justify-start"
                      onClick={() =>
                        o.modo === "fechar" ? abrirPagamento() : setModo(o.modo)
                      }
                    >
                      <o.icone /> {o.rotulo}
                    </Button>
                  ))}
                {comanda && !principal && (
                  <Button
                    size="lg"
                    className="justify-start"
                    onClick={() => acao.mutate("separar")}
                  >
                    <Split /> Separar esta mesa
                  </Button>
                )}
              </div>
            )}

            {(modo === "juntar" || modo === "transferir") && (
              <>
                {livres.length === 0 && (
                  <p className="p-4 text-center text-texto-secundario">
                    Nenhuma mesa livre.
                  </p>
                )}
                <div className="grid grid-cols-4 gap-2">
                  {livres.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      aria-pressed={selecionadas.includes(m.id)}
                      onClick={() => alternar(m.id, modo === "transferir")}
                      className={cn(
                        "aspect-square rounded-lg border-2 font-bold text-2xl",
                        selecionadas.includes(m.id)
                          ? "border-status-ocupada bg-status-ocupada text-white"
                          : "border-status-livre text-status-livre",
                      )}
                    >
                      {m.numero}
                    </button>
                  ))}
                </div>
              </>
            )}

            {modo === "fechar" && comanda && (
              <div className="flex flex-col gap-4">
                {comanda.pedidoConta && (
                  <p className="rounded-xl bg-status-conta/10 p-3 text-sm">
                    O cliente pediu a conta pelo QR
                    {comanda.pedidoConta.taxaServico
                      ? " com taxa de serviço"
                      : " sem taxa de serviço"}
                    {comanda.pedidoConta.gorjetaCentavos > 0 &&
                      ` e ${formatBRL(comanda.pedidoConta.gorjetaCentavos)} de gorjeta`}
                    .
                  </p>
                )}

                <dl className="grid grid-cols-2 gap-y-1 rounded-xl border border-borda p-4">
                  <dt className="text-texto-secundario">Consumo</dt>
                  <dd className="text-right">
                    {formatBRL(comanda.totalCentavos)}
                  </dd>
                  <dt className="text-texto-secundario">
                    Taxa de serviço ({comanda.taxa.pct}%)
                  </dt>
                  <dd className="text-right">
                    {taxaServico ? formatBRL(taxaCentavos) : "Não paga"}
                  </dd>
                  <dt className="text-texto-secundario">Gorjeta</dt>
                  <dd className="text-right">{formatBRL(gorjetaCentavos)}</dd>
                  <dt className="mt-2 self-center font-semibold">
                    Cobrar na maquininha
                  </dt>
                  <dd className="mt-2 text-right font-bold text-3xl">
                    {formatBRL(totalCobrar)}
                  </dd>
                </dl>

                <button
                  type="button"
                  role="switch"
                  aria-checked={taxaServico}
                  onClick={() => setTaxaServico((v) => !v)}
                  className="flex h-12 items-center justify-between rounded-lg border border-borda px-3 font-semibold"
                >
                  Cliente paga a taxa de serviço
                  <span
                    className={cn(
                      "flex h-7 w-12 items-center rounded-full p-0.5 transition-colors",
                      taxaServico ? "bg-acao" : "bg-borda",
                    )}
                  >
                    <span
                      className={cn(
                        "size-6 rounded-full bg-white shadow transition-transform",
                        taxaServico && "translate-x-5",
                      )}
                    />
                  </span>
                </button>

                <div>
                  <p className="mb-2 font-semibold">Gorjeta</p>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant={gorjetaCentavos === 0 ? "marca" : "outline"}
                      onClick={() => setGorjeta("")}
                    >
                      Sem gorjeta
                    </Button>
                    <input
                      inputMode="decimal"
                      placeholder="Valor (R$)"
                      value={gorjeta}
                      onChange={(e) => setGorjeta(e.target.value)}
                      className="h-12 min-w-36 flex-1 rounded-lg border border-borda bg-surface px-3"
                    />
                  </div>
                </div>

                {(previaGorjeta.length > 0 || previaTaxa.length > 0) && (
                  <div className="rounded-xl bg-fundo p-3">
                    <p className="mb-1 font-semibold text-sm">
                      Divisão (pelo valor que cada um lançou)
                    </p>
                    <ul className="flex flex-col gap-1 text-sm">
                      {comanda.equipe.map((e) => {
                        const valor = (lista: typeof previaTaxa) =>
                          lista.find((p) => p.funcionarioId === e.id)
                            ?.valorCentavos ?? 0;
                        return (
                          <li key={e.id} className="flex justify-between gap-2">
                            <span>
                              {e.nome}
                              <span className="text-texto-secundario">
                                {" "}
                                · lançou {formatBRL(e.baseCentavos)}
                              </span>
                            </span>
                            <span className="text-right">
                              {previaTaxa.length > 0 && (
                                <span className="block">
                                  taxa{" "}
                                  <strong>
                                    {formatBRL(valor(previaTaxa))}
                                  </strong>
                                </span>
                              )}
                              {previaGorjeta.length > 0 && (
                                <span className="block">
                                  gorjeta{" "}
                                  <strong>
                                    {formatBRL(valor(previaGorjeta))}
                                  </strong>
                                </span>
                              )}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>

          {modo && modo !== "menu" && (
            <DrawerFooter>
              <Button
                variant="acao"
                size="lg"
                disabled={
                  acao.isPending ||
                  (modo !== "fechar" && selecionadas.length === 0)
                }
                onClick={() => acao.mutate(modo)}
              >
                {acao.isPending ? (
                  <Loader2 className="animate-spin" />
                ) : modo === "juntar" ? (
                  "Juntar"
                ) : modo === "transferir" ? (
                  "Transferir"
                ) : (
                  `Conta paga · ${formatBRL(totalCobrar)}`
                )}
              </Button>
            </DrawerFooter>
          )}
        </DrawerContent>
      </Drawer>
    </>
  );
};
