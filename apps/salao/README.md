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
- **Uma mesa, uma comanda aberta:** índice único parcial em `comanda_mesa`.
  Dois garçons abrindo a mesma mesa ao mesmo tempo caem na mesma comanda.
- **Status da mesa é derivado** (comanda aberta + rodadas), nunca gravado.
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

Se o navegador não abrir `localhost`, use `http://127.0.0.1:3000` (o servidor
escuta em IPv4). PINs do seed: Gerente `1234`, Garçom A `1111`, Garçom B `2222`.
O cardápio do seed é provisório; o real é cadastrado em `/gerente`.

Sem impressora, `IMPRESSAO_DRIVER=arquivo` grava cada ticket em `.tickets/`
(`.txt` legível + `.bin` ESC/POS). Para simular uma impressora desligada, crie
`.tickets/<nome_do_driver>.offline`.

| Comando | O que faz |
|---|---|
| `pnpm test` | Testes de domínio contra o banco de teste (concorrência de estoque, idempotência, mesas, fila de impressão) |
| `pnpm db:reset` | Recria o banco de dev (recusa qualquer host que não seja localhost) |
| `pnpm db:generate --name x` | Nova migration a partir de `src/db/schema.ts` |
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
5. Backup diário: `ops\agendar-backup.ps1` (Administrador). Destino local em
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

- **Juntar mesas** só aceita mesas livres ou abertas sem pedido. Para juntar
  duas comandas que já têm pedidos, feche ou transfira uma antes.
- **Fechar mesa** só encerra a comanda (o pagamento é na maquininha). Caixa,
  divisão de conta, taxa de serviço e desconto ficam para as próximas fases.
- Status **"chamou garçom"** e **"pediu a conta"** chegam na Fase 2 (tabela de
  chamados); as cores e rótulos já existem.
- **Carga medida** (máquina de dev, Postgres embutido, 120 conexões sem pausa):
  zero erros; ~136 req/s no mapa de mesas, p99 de 4s no cenário misto com 30%
  de lançamentos. O teto é o overhead do Next por requisição num único
  processo. É bem acima do uso real (um celular por garçom), mas repetir no PC
  do restaurante antes da abertura.
