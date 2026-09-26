// Registra o servidor do salão como serviço do Windows (node-windows).
// Rodar UMA vez, num terminal aberto como Administrador:
//
//   pnpm build
//   pnpm servico:instalar     (ou: pnpm servico:remover)
//
// O serviço inicia no boot sem ninguém logado, roda sem janela, reinicia
// sozinho se o processo cair e grava logs em dist/daemon/.
import path from "node:path";
import { Service } from "node-windows";

const raiz = path.resolve(import.meta.dirname, "..");

const servico = new Service({
  name: "Xis Diniz Salao",
  description:
    "Servidor local do sistema de pedidos do salão (painel do garçom).",
  script: path.join(raiz, "dist", "iniciar.mjs"),
  workingDirectory: raiz,
  nodeOptions: ["--enable-source-maps"],
  // Reinício automático: espera 2s, dobrando até 60s se continuar caindo.
  wait: 2,
  grow: 0.5,
  maxRestarts: 50,
  abortOnError: false,
});

const acao = process.argv[2];

servico.on("install", () => {
  console.log("Serviço instalado. Iniciando...");
  servico.start();
});
servico.on("alreadyinstalled", () =>
  console.log("O serviço já estava instalado."),
);
servico.on("start", () =>
  console.log('Serviço rodando. Confira em services.msc: "Xis Diniz Salao".'),
);
servico.on("uninstall", () => console.log("Serviço removido."));
servico.on("error", (erro) => console.error("Erro:", erro));

if (acao === "instalar") servico.install();
else if (acao === "remover") servico.uninstall();
else {
  console.log("Uso: node ops/servico.mjs instalar|remover");
  process.exit(1);
}
