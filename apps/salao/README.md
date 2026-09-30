# Salão — sistema de pedidos do Xis Diniz

Painel do garçom (PWA no celular), gerência e impressão roteada para as
impressoras térmicas. Roda **no computador do restaurante**, na rede local, e
continua funcionando sem internet.

## Arquitetura

```
server.ts  (um processo Node, serviço do Windows)
 ├─ Express 5 ........ rate limit, /health, repassa o resto para o Next
 ├─ Socket.io ........ só avisa "o escopo X mudou"; o celular busca de novo no banco
 ├─ Next.js 16 ....... telas + Route Handlers (src/app/api) → regras em src/lib/dominio
 └─ Workers .......... fila de impressão no Postgres, 1 loop por impressora
PostgreSQL local (serviço do Windows)
```

Decisões que o código assume:

- **Rodada imutável.** Lançar pedido sempre cria uma rodada nova; não existe
  "editar pedido". Cancelamento é item a item, com quem/quando/motivo.
- **Idempotency key** em todo lançamento (gerada quando a tela abre). Apertar
  "Lançar" duas vezes, ou a rede reenviar, não duplica pedido nem ticket.
- **Estoque atômico:** `UPDATE ... WHERE estoque >= q`, em ordem de id. Nunca
  "ler, subtrair, salvar".
- **Comanda por cartão, mesa é o lugar:** cada pessoa (ou casal) que paga
  separado recebe um cartão físico numerado (`cartao_comanda`). O garçom abre
  a comanda com o número do cartão numa mesa; uma mesa pode ter várias
  comandas, e cada comanda está em uma mesa por vez (`comanda_mesa`, índice
  único por comanda). Um cartão só tem uma comanda aberta (índice único
  parcial `comanda_cartao_aberta_idx`): dois garçons abrindo o mesmo cartão
  ao mesmo tempo, o segundo recebe "cartão em uso na mesa X". Pagou, o número
  volta para o monte. Não existe mais "juntar mesas": grupo espalhado usa os
  cartões; "trocar de mesa" move só a comanda.
- **Cartão**: QR (`/c/k/<token>`) leva o cliente à conta da comanda dele, na
  mesa onde ela está agora; código de barras (o número, 3 dígitos) acha a
  comanda no caixa e no garçom (`/api/comandas/numero/<n>`). O leitor USB
  funciona como teclado: digita o número e aperta Enter. Impressão dos
  cartões em `/gerente/cartoes`.
- **QR da mesa com várias comandas**: "chamar garçom" é da mesa; "pedir a
  conta" e "minha conta" são da comanda. Mesa com uma comanda só funciona sem
  identificação; com várias, o cliente digita o número do cartão (só vale
  comanda daquela mesa) ou usa o QR do cartão (`src/lib/dominio/cliente.ts`).
- **Status da mesa é derivado** (comandas abertas nela + rodadas + chamados),
  nunca gravado.
- **Editar item lançado** não altera a linha original: ela é cancelada
  ("Alterado") e um item novo aponta para ela (`substitui_item_id`). Se o
  ticket ainda está na fila, é corrigido lá; se já saiu, vai um ticket de
  ALTERAÇÃO (antes/depois). Estoque ajustado só pela diferença.
- **Pedido de ajuda** (`pedido_ajuda`): um aberto por mesa (índice único), o
  primeiro que aceitar leva (`UPDATE ... WHERE aceito_por IS NULL`), e sem
  resposta em `AJUDA_ESCALAR_APOS_SEGUNDOS` o servidor escala para o gerente.
- **Código do cardápio**: cada categoria tem uma faixa (Lanches 1–19, Porções
  20–29, Bebidas 30–79, Sobremesas 80–99); produto novo pega o próximo livre.
  Digitar o número na busca acha o item; o código sai no ticket.
- **Revisão antes de lançar**: o "+" só adiciona; "Revisar pedido" abre a
  revisão, onde ficam as observações (cada chip separa 1 unidade) e o botão
  que de fato lança. Ponto da carne (`tipo = preparo`) é exclusivo.
- **Cardápio digital**: o QR abre `/c/<token>` (sem login) direto no
  cardápio (banner de destaques, busca, categorias, foto/vídeo e a lista do
  que vem no lanche) com barra fixa: Minha conta (itens ativos da comanda da
  mesa), Chamar garçom e Pedir a conta. Só visualização: quem lança é o
  garçom. Fotos enviadas em `/gerente` viram WebP 1200px + miniatura 480px
  em `MIDIA_DIR`, servidas pelo Express em `/midia` (cache de 30 dias).
  `pnpm fotos:importar <pasta>` importa uma pasta de fotos de uma vez
  (o nome do arquivo é o nome do produto).
- **Chamados do cliente (Fase 2)**: cada mesa tem `token_qr` secreto; o QR
  dá acesso a "Chamar garçom" / "Pedir a conta". Um
  chamado aberto por tipo e mesa (índice único), fila por ordem de chegada,
  primeiro que atender leva, escalado ao gerente após
  `CHAMADO_ESCALAR_APOS_SEGUNDOS`. `/api/publico` tem rate limit próprio.
  `PUBLIC_URL` define o endereço impresso nos QR (`/gerente/qr`).
- **Pedir a conta, taxa de serviço e gorjeta**: o cliente abre "Pedir a
  conta" no QR, escolhe se paga a taxa de serviço e se deixa gorjeta, e o
  pedido vai só para a equipe da mesa (`comanda_garcom`: titular e
  auxiliares); sem resposta, escala para o gerente. O garçom abre
  "Receber pagamento" já preenchido, pode corrigir e marca como paga. A taxa
  é calculada no servidor: `taxa_servico_pct` (10%) até
  `taxa_servico_limite_centavos` (R$ 300) e `taxa_servico_pct_reduzida`
  (5%) acima, configuráveis em `/gerente > Noite`. Taxa e gorjeta são
  divididas separadamente pelo valor que cada garçom lançou (maiores restos:
  fecha no centavo) em `gorjeta_divisao` (coluna `tipo`), e aparecem
  separadas no resumo da noite.
- **Estoque por insumo (Fase 3)**: `insumo` guarda a contagem da noite
  (nula = não controla), `produto_insumo` a receita (insumo **base**) e
  `modificador.insumo_id` o insumo de um **adicional**. Lançar, editar e
  cancelar (antes do preparo) baixam/devolvem pela mesma regra atômica do
  estoque por produto (`src/lib/dominio/estoque.ts`). Base acabou: lanche
  esgotado (garçom e QR); adicional acabou: só o chip fica cinza. Contagem e
  receitas em `/gerente > Estoque`.
- **Desconto e taxa não cobrada (Fase 3)**: ao receber, o garçom aplica só
  descontos cadastrados (`/gerente > Descontos`); valor livre é de gerente e
  caixa. A taxa incide sobre o consumo já com desconto. Sem taxa, o motivo é
  obrigatório (lista de 1 toque; "Outro" pede texto) e já vem marcado como
  "Cliente recusou" quando ele recusou pelo QR. `/gerente > Noite` mostra
  contas sem taxa por motivo e por garçom, e os descontos.
- **Caixa** (`/caixa`, papéis caixa e gerente; o login do caixa já cai
  lá): salão inteiro com consumo e tempo de cada mesa, fila de "pediram a
  conta", busca pelo número da mesa + Enter, conta detalhada, **Imprimir
  conta** (conferência, com a taxa como opcional) e **Receber pagamento**
  (o mesmo formulário do garçom: `src/components/salao/recebimento.tsx`).
  O pagamento fica em `pagamento` e pode ser dividido entre dinheiro,
  crédito, débito, Pix e vale-refeição; a soma tem que bater com o total. No
  dinheiro, o recebido a mais vira troco (`src/lib/dominio/pagamento.ts`,
  regras puras usadas na tela e no servidor). A conta e o comprovante saem
  na impressora do setor **Caixa** (tipo de trabalho `conta`, "não é
  documento fiscal"). **Histórico**: qualquer dia, faixa de horário e mesa,
  com tudo o que aconteceu na conta (pedidos, cancelamentos com quem e por
  quê, pagamentos, divisão) e reimpressão do comprovante. **Resumo do
  caixa**: turno das 12h às 12h, total por forma de pagamento, dinheiro na
  gaveta, ticket médio.
- **Impressão assíncrona:** o garçom recebe sucesso na hora. A fila
  (`trabalho_impressao`) usa `FOR UPDATE SKIP LOCKED`, com retry 2s/8s/30s,
  depois `falhou` e reenvio automático quando a impressora volta. Com a
  impressora offline o ticket nem é entregue ao spooler do Windows (que
  aceitaria e seguraria o job); depois de enviar, o worker confirma que o job
  saiu da fila.
- **`globalThis` como ponte** entre o `server.ts` e o bundle do Next
  (`src/lib/runtime.ts`, `src/db/index.ts`): são cópias diferentes dos módulos
  no mesmo processo. O addon nativo de impressão nunca é importado pelo Next.
- **`restaurante_id` em toda tabela principal**, pensando nas filiais.

## Desenvolvimento

```bash
cp .env.example .env        # já aponta para o Postgres embutido de dev
pnpm db:local               # Postgres embutido na porta 5433 (deixe rodando)
pnpm db:migrate && pnpm db:seed
pnpm dev                    # http://localhost:3000/garcom
```

Ao subir, o servidor mostra os endereços para abrir neste computador e no
celular (mesma rede Wi-Fi). Os IPs da própria máquina já são liberados no
`allowedDevOrigins` do Next; outros hosts vão em `ALLOWED_DEV_ORIGINS`. Sem essa
liberação, o Next bloqueia o WebSocket de HMR e a página nunca hidrata (fica
carregando para sempre). PINs do seed: Gerente `1234`, Garçom A `1111`,
Garçom B `2222`, Caixa `3333`.
O cardápio do seed é provisório; o real é cadastrado em `/gerente`.

Sem impressora, `IMPRESSAO_DRIVER=arquivo` grava cada ticket em `.tickets/`
(`.txt` legível + `.bin` ESC/POS). Para simular uma impressora desligada, crie
`.tickets/<nome_do_driver>.offline`.

| Comando | O que faz |
|---|---|
| `pnpm test` | Testes de domínio contra o banco de teste (concorrência de estoque, idempotência, mesas, fila de impressão) |
| `pnpm db:reset` | Recria o banco de dev (recusa qualquer host que não seja localhost) |
| `pnpm db:generate --name x` | Nova migration a partir de `src/db/schema.ts` |
| `pnpm fotos:importar <pasta>` | Usa cada foto da pasta no produto de mesmo nome |
| `pnpm build` / `pnpm start` | Build de produção e servidor (`dist/iniciar.mjs`) |
| `pnpm impressao:spike` | Lista as impressoras do Windows / imprime ticket de teste |
| `pnpm carga` | Teste de carga (autocannon) |

## Instalação no PC do restaurante

O passo a passo manual, em ordem, está no Notion: **Checklist manual —
Implantação**. Resumo técnico:

1. Node 24 (`.nvmrc`), pnpm, Git e **PostgreSQL nativo** (o instalador já cria
   o serviço que sobe no boot).
2. `pnpm install`, criar `.env` com `IMPRESSAO_DRIVER=windows`, `pnpm db:migrate`,
   `pnpm db:seed`.
3. `pnpm impressao:spike` → copiar os nomes exatos das Elgin para `/gerente > Impressoras`.
4. `pnpm build`, depois, como Administrador: `pnpm servico:instalar` e
   `powershell -ExecutionPolicy Bypass -File ops\firewall.ps1`.
5. Backup diário do banco e das fotos do cardápio (`midia/`):
   `ops\agendar-backup.ps1` (Administrador). Destino local em
   `backup.ps1 -Destino`; cópia na nuvem via `XIS_BACKUP_NUVEM` (pasta
   sincronizada do Drive/OneDrive).
6. Atualizações: `ops\deploy.ps1` (faz backup, pull, install, migrate, build e
   reinicia o serviço).

### HTTPS na rede local

Instalar o app na tela inicial (e notificações no futuro) exige HTTPS. Com
`http://192.168.x.x` o sistema funciona no navegador, mas não instala como app.
Opção recomendada para começar ([mkcert](https://github.com/FiloSottile/mkcert)):

```powershell
mkcert -install
mkcert 192.168.1.50 caixa.local localhost   # IP fixo do PC do caixa
```

Depois, no `.env`: `HTTPS_KEY` e `HTTPS_CERT` com os caminhos dos arquivos
gerados, e `COOKIE_SECURE=true`. A CA do mkcert (`mkcert -CAROOT`) precisa ser
instalada uma vez em cada celular de garçom.

## Limitações conhecidas (MVP)

- **Dividir uma comanda** já lançada entre pessoas não existe: a divisão é
  feita antes, com um cartão por pessoa ou casal.
- **Receber pagamento** registra o pagamento feito na maquininha; não há
  integração com a maquininha nem tela de caixa. Dividir a conta entre
  pessoas fica para as próximas fases.
- O cardápio do cliente é **só visualização**: pedir pelo celular não existe.
- **Carga medida** (máquina de dev, Postgres embutido, 120 conexões sem pausa):
  zero erros; ~136 req/s no mapa de mesas, p99 de 4s no cenário misto com 30%
  de lançamentos. O teto é o overhead do Next por requisição num único
  processo. É bem acima do uso real (um celular por garçom), mas repetir no PC
  do restaurante antes da abertura.
