// Teste de carga antes da abertura (System Design, seção 5.1).
// Simula o salão lotado: muitos celulares lendo o mapa e lançando pedidos.
//
//   RATE_LIMIT_ESCRITA_POR_MIN=100000 pnpm start      (num terminal)
//   pnpm carga [url] [conexoes] [segundos]             (noutro)
//
// NÃO rodar contra o banco de produção com o restaurante aberto: cria
// comandas e pedidos de teste de verdade.
import { randomUUID } from "node:crypto";
import autocannon from "autocannon";

const [url = "http://127.0.0.1:3000", conexoes = "120", segundos = "20"] =
  process.argv.slice(2);

const json = async <T>(caminho: string, init?: RequestInit): Promise<T> => {
  const r = await fetch(url + caminho, init);
  if (!r.ok) throw new Error(`${caminho}: ${r.status} ${await r.text()}`);
  return r.json() as Promise<T>;
};

const main = async () => {
  const funcionarios = await json<
    { id: string; nome: string; papel: string }[]
  >("/api/auth/funcionarios");
  const garcom = funcionarios.find((f) => f.papel === "garcom");
  const pin = process.env.PIN_CARGA ?? "1111";
  if (!garcom) throw new Error("Nenhum garçom cadastrado");

  const login = await fetch(`${url}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ funcionarioId: garcom.id, pin }),
  });
  const cookie = login.headers.get("set-cookie")?.split(";")[0];
  if (!cookie)
    throw new Error(`Login falhou (${login.status}). Defina PIN_CARGA.`);

  const headers = { cookie, "content-type": "application/json" };
  const mesas = await json<{ id: string }[]>("/api/mapa", { headers });
  const cardapio = await json<
    { produtos: { id: string; esgotado: boolean }[] }[]
  >("/api/cardapio", { headers });
  const produtos = cardapio
    .flatMap((c) => c.produtos)
    .filter((p) => !p.esgotado);

  console.log(
    `Carga: ${conexoes} conexões por ${segundos}s contra ${url} (${mesas.length} mesas)\n`,
  );

  // 70% leituras (mapa/mesa, como os celulares re-sincronizando) e
  // 30% lançamentos de pedido em mesas aleatórias, cada um com chave própria.
  const resultado = await autocannon({
    url,
    connections: Number(conexoes),
    duration: Number(segundos),
    headers,
    requests: [
      {
        setupRequest: (req) => {
          const mesa = mesas[Math.floor(Math.random() * mesas.length)];
          const sorteio = Math.random();
          if (sorteio < 0.5)
            return { ...req, method: "GET", path: "/api/mapa" };
          if (sorteio < 0.7)
            return { ...req, method: "GET", path: `/api/mesas/${mesa.id}` };
          const produto = produtos[Math.floor(Math.random() * produtos.length)];
          return {
            ...req,
            method: "POST",
            path: `/api/mesas/${mesa.id}/rodadas`,
            body: JSON.stringify({
              idempotencyKey: randomUUID(),
              itens: [
                { produtoId: produto.id, quantidade: 1, modificadorIds: [] },
              ],
            }),
          };
        },
      },
    ],
  });

  console.log(autocannon.printResult(resultado));
  const erros = resultado.errors + resultado.timeouts + resultado.non2xx;
  console.log(
    `p50 ${resultado.latency.p50}ms · p99 ${resultado.latency.p99}ms · ` +
      `${resultado.requests.average} req/s · não-2xx/erros: ${erros}`,
  );
  console.log(
    "\nConflitos 409 (esgotado) são esperados em produtos com estoque; 5xx ou timeouts não.",
  );
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
