import { CHAVE_CARDAPIO, lerConfiguracao } from "@/lib/links-publicos";

import { EnvioCardapio } from "./_components/envio-cardapio";

const CardapioPage = async () => {
  const atual = await lerConfiguracao(CHAVE_CARDAPIO);

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Cardápio digital</h1>
        <p className="text-sm text-muted-foreground">
          Envie o PDF do cardápio. O endereço público é sempre{" "}
          <code className="rounded bg-muted px-1">/cardapio</code>, então o
          botão da bio não precisa mudar quando você trocar o arquivo.
        </p>
      </div>

      <EnvioCardapio
        urlAtual={atual?.value ?? null}
        atualizadoEm={atual?.updatedAt.toISOString() ?? null}
      />
    </div>
  );
};

export default CardapioPage;
