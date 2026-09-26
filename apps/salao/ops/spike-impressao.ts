// SPIKE S1 — rodar no PC do restaurante, com as Elgin i9 ligadas.
//
//   pnpm impressao:spike                       lista as impressoras do Windows
//   pnpm impressao:spike "ELGIN i9" [codepage]  imprime ticket de teste e acompanha o job
//
// Codepages para testar acentos: PC850_MULTILINGUAL (padrão), PC860_PORTUGUESE, WPC1252.
// ASCII imprime sem acentos (Ç vira C) e funciona em qualquer impressora.
// Repita com a impressora DESLIGADA e SEM PAPEL e anote o que aparece aqui.
import printer from "@ssxv/node-printer";

import {
  type Codepage,
  montarLinhas,
  renderizarEscPos,
} from "@/lib/impressao/ticket";

const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms));

const main = async () => {
  const [nome, codepage = "PC850_MULTILINGUAL"] = process.argv.slice(2);

  const lista = await printer.printers.list();
  console.log("\nImpressoras instaladas no Windows:");
  for (const p of lista) {
    console.log(
      `  - "${p.name}"  estado=${p.state}${p.isDefault ? "  (padrão)" : ""}`,
    );
  }
  if (!nome) {
    console.log(
      '\nPara imprimir o teste: pnpm impressao:spike "<nome exato acima>"',
    );
    return;
  }

  const info = await printer.printers.get(nome);
  console.log(`\nEstado antes de enviar: ${info.state}`);

  const linhas = montarLinhas("pedido", "chapa", {
    mesas: [12, 13],
    garcom: "Teste",
    rodada: 1,
    lancadaEm: new Date().toISOString(),
    itens: [
      {
        itemId: "t1",
        quantidade: 2,
        nome: "Xis Coração",
        modificadores: ["Sem ervilha", "Bacon extra"],
        observacao: "ÇÃÉÕÜ çãéõü - acentos ok?",
        mesaOrigem: 12,
      },
    ],
  });
  const dados = renderizarEscPos(linhas, 48, codepage as Codepage);

  const inicio = Date.now();
  const { id } = await printer.jobs.printRaw({
    printer: nome,
    data: dados,
    format: "RAW",
    options: { jobName: "spike-xis-diniz" },
  });
  console.log(
    `Job ${id} entregue ao spooler em ${Date.now() - inicio}ms (codepage ${codepage})`,
  );

  // Acompanha o job: é isso que decide se "impresso" pode ser confirmado.
  for (let i = 0; i < 40; i++) {
    try {
      const job = await printer.jobs.get(nome, id);
      console.log(
        `  t+${((Date.now() - inicio) / 1000).toFixed(1)}s  job=${job.state}`,
      );
      if (job.state === "completed" || job.state === "error") break;
    } catch (error) {
      console.log(
        `  t+${((Date.now() - inicio) / 1000).toFixed(1)}s  job saiu da fila (${(error as { code?: string }).code ?? "?"})`,
      );
      break;
    }
    await dormir(500);
  }
  const depois = await printer.printers.get(nome);
  console.log(`Estado da impressora depois: ${depois.state}\n`);
};

main().catch((error) => {
  console.error("Falhou:", error);
  process.exit(1);
});
