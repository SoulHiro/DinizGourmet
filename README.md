# Xis Diniz

Monorepo (pnpm workspaces) com os dois sistemas do Xis Diniz:

| App | O que é | Onde roda | Banco |
|---|---|---|---|
| [`apps/site`](apps/site) | Site público de eventos + reservas e admin de eventos | Vercel (Root Directory = `apps/site`) | Neon (nuvem) |
| [`apps/salao`](apps/salao) | Sistema de pedidos do salão: painel do garçom, gerência, impressão | PC do restaurante (Windows), como serviço | PostgreSQL local |

Os dois apps não compartilham código nem banco de propósito. O salão precisa
funcionar sem internet e usa bibliotecas nativas do Windows (impressão RAW),
que quebrariam o build do site na Vercel.

## Comandos

```bash
pnpm install          # instala tudo (Node 24, ver .nvmrc)
pnpm dev:site         # site em http://localhost:3000
pnpm dev:salao        # salão (ver apps/salao/README.md para o banco local)
pnpm test             # testes do salão
pnpm lint             # Biome em todo o repositório
```

Documentação de produto e arquitetura: Notion > Diniz Gourmet > Sistema de Pedidos.
