"use client";

import { ChevronDown, Hand, Info } from "lucide-react";
import { useState } from "react";

import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { cn } from "@/lib/utils";
import { STATUS_MESA } from "./status-mesa";

// Só o que já funciona no sistema.
const SECOES: { titulo: string; conteudo: React.ReactNode }[] = [
  {
    titulo: "O que significa cada cor",
    conteudo: (
      <ul className="flex flex-col gap-2">
        {(["livre", "aguardando", "ocupada", "chamado", "conta"] as const).map(
          (status) => (
            <li key={status} className="flex items-center gap-3">
              <span
                className={cn(
                  "size-8 shrink-0 rounded-lg",
                  STATUS_MESA[status].classe,
                )}
              />
              <span>
                <strong>{STATUS_MESA[status].rotulo}</strong>
                {status === "livre" && " — ninguém sentado, sem comanda."}
                {status === "aguardando" &&
                  " — mesa aberta, mas ainda sem nenhum pedido."}
                {status === "ocupada" &&
                  " — já tem pedido lançado. Mostra o total e há quanto tempo foi o último."}
                {status === "chamado" && " — o cliente chamou pelo QR da mesa."}
                {status === "conta" &&
                  " — o cliente pediu a conta pelo QR. Some quando a mesa é fechada."}
              </span>
            </li>
          ),
        )}
        <li className="flex items-center gap-3">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-status-chamado text-black">
            <Hand className="size-5" />
          </span>
          <span>
            <strong>Mão na mesa</strong> — o garçom daquela mesa pediu ajuda.
          </span>
        </li>
      </ul>
    ),
  },
  {
    titulo: "Lançar um pedido rápido",
    conteudo: (
      <ol className="flex list-decimal flex-col gap-2 pl-5">
        <li>
          Toque na mesa e abra a <strong>comanda</strong> com o número do cartão
          (ou passe o leitor). Já tem comanda? Toque nela. Atalho: no topo do
          mapa, digite o número do cartão.
        </li>
        <li>
          Ache o item pela <strong>busca</strong>: digite 2 ou 3 letras do nome
          ou o <strong>número</strong> do item (ex.: <em>5</em>).
        </li>
        <li>
          O <strong>+</strong> adiciona o item completo. Toque várias vezes para
          vários.
        </li>
        <li>
          Toque em <strong>Revisar pedido</strong> (embaixo): confira tudo,
          ajuste quantidades ou tire itens.
        </li>
        <li>
          Algum sem salada? Na revisão, toque em <strong>Observações</strong> do
          item e no chip <strong>Sem salada</strong>: ele separa{" "}
          <strong>uma</strong> unidade. Ex.: 5× Xis Buenas → "Sem salada" e "Sem
          ovo" = 3 completos, 1 sem salada, 1 sem ovo. Mesma pessoa com duas
          observações? Toque na pílula dela e depois no segundo chip.
        </li>
        <li>
          Para observação escrita (ex.: "molho à parte"), toque no{" "}
          <strong>nome</strong> do item na lista.
        </li>
        <li>
          Item ou adicional <strong>cinza</strong> ("acabou") não dá para
          lançar: o ingrediente acabou nesta noite.
        </li>
        <li>
          <strong>Lançar pedido</strong> (dentro da revisão): sai sozinho na
          chapa, na fritura e no bar. Não precisa fazer mais nada.
        </li>
      </ol>
    ),
  },
  {
    titulo: "Editar ou cancelar um item já lançado",
    conteudo: (
      <p>
        Na mesa, aba <strong>Conta</strong>. <strong>Editar</strong> muda
        quantidade e observações; se o ticket já saiu, a cozinha recebe um aviso
        de <strong>ALTERAÇÃO</strong> com o antes e o depois.{" "}
        <strong>Cancelar</strong> pede o motivo e se o preparo já começou (se
        não começou, o item volta ao estoque).
      </p>
    ),
  },
  {
    titulo: "Grupo que paga separado (cartões)",
    conteudo: (
      <p>
        Cada pessoa ou casal que vai pagar o seu recebe um{" "}
        <strong>cartão</strong>. Na mesa, abra uma comanda para cada cartão
        (quantas quiser na mesma mesa) e lance cada pedido na comanda de quem
        pediu. Na hora de pagar, cada comanda fecha sozinha; a mesa só fica
        livre quando a última for paga. Não precisa juntar mesas: um grupo
        espalhado em duas mesas usa os cartões do mesmo jeito.
      </p>
    ),
  },
  {
    titulo: "Chamados do cliente (QR da mesa)",
    conteudo: (
      <p>
        O cliente lê o QR da mesa e toca em <strong>Chamar garçom</strong> ou{" "}
        <strong>Pedir a conta</strong>. "Chamar garçom" aparece para todos, na
        ordem de chegada (as suas mesas vêm marcadas); "Pedir a conta" vai só
        para quem atendeu a mesa, já com o valor, a taxa e a gorjeta que o
        cliente escolheu. Toque em <strong>Atender</strong>: o chamado some da
        tela dos colegas (na conta, abre direto o pagamento). Se ninguém atender
        em cerca de <strong>3 minutos</strong>, o alerta pisca em vermelho e o{" "}
        <strong>gerente</strong> é acionado.
      </p>
    ),
  },
  {
    titulo: "Pedir ajuda",
    conteudo: (
      <p>
        Dentro da mesa, menu <strong>⋮ → Pedir ajuda</strong>. Todos os garçons
        recebem o alerta e o celular vibra; o primeiro que tocar em{" "}
        <strong>Vou ajudar</strong> assume e você é avisado. Se ninguém
        responder em cerca de <strong>2 minutos</strong>, o alerta fica vermelho
        e o <strong>gerente</strong> é acionado. Viu um colega apertado? Menu{" "}
        <strong>⋮ → Ajudar nesta mesa</strong>: você entra como auxiliar e ele é
        avisado.
      </p>
    ),
  },
  {
    titulo: "Trocar de lugar e receber",
    conteudo: (
      <p>
        Na comanda, menu <strong>⋮ → Trocar de mesa</strong> leva só aquela
        comanda para outra mesa (mesmo ocupada).{" "}
        <strong>Receber pagamento e fechar</strong> mostra quanto cobrar na
        maquininha. Cliente não quis a taxa de serviço? Desligue e toque no{" "}
        <strong>motivo</strong> (obrigatório). Desconto: só os da lista (valor
        livre é com o gerente ou o caixa). Informe a <strong>gorjeta</strong>,
        toque na <strong>forma de pagamento</strong> (mais de uma para dividir;
        no dinheiro, informe quanto o cliente deu e aparece o troco) e em{" "}
        <strong>Conta paga</strong>: a comanda fecha e o cartão volta para o
        monte. Taxa e gorjeta são divididas entre os garçons da comanda na
        proporção do que cada um lançou. O cliente quer conferir antes? Menu{" "}
        <strong>⋮ → Imprimir conta</strong> (sai no caixa).
      </p>
    ),
  },
];

export const BotaoTutorial = () => {
  const [aberto, setAberto] = useState(false);
  const [secao, setSecao] = useState<number | null>(0);

  return (
    <>
      <button
        type="button"
        aria-label="Como usar"
        onClick={() => setAberto(true)}
        className="flex size-12 items-center justify-center"
      >
        <Info />
      </button>
      <Drawer open={aberto} onOpenChange={setAberto}>
        <DrawerContent>
          <DrawerHeader className="text-left">
            <DrawerTitle className="text-xl">Como usar</DrawerTitle>
          </DrawerHeader>
          <div className="flex flex-col gap-2 overflow-y-auto px-4 pb-6">
            {SECOES.map(({ titulo, conteudo }, indice) => {
              const ativa = secao === indice;
              return (
                <section
                  key={titulo}
                  className="rounded-xl border border-borda bg-surface"
                >
                  <button
                    type="button"
                    aria-expanded={ativa}
                    onClick={() => setSecao(ativa ? null : indice)}
                    className="flex min-h-12 w-full items-center justify-between gap-2 px-4 text-left font-semibold"
                  >
                    {titulo}
                    <ChevronDown
                      className={cn(
                        "size-5 transition-transform",
                        ativa && "rotate-180",
                      )}
                    />
                  </button>
                  {ativa && (
                    <div className="px-4 pb-4 text-texto">{conteudo}</div>
                  )}
                </section>
              );
            })}
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
};
