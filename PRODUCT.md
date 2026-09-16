# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Duas audiências na mesma página: (1) clientes finais do Diniz Gourmet — a operação noturna de Xis Gaúcho que funciona dentro do espaço do restaurante Nosso Quintal — descobrindo um evento com música ao vivo, majoritariamente pelo Instagram e no celular, decidindo se vale sair de casa naquela noite; (2) o dono/gestor do restaurante, que cadastra eventos e acompanha reservas recebidas em um painel interno simples.

## Product Purpose

Divulgar um evento noturno específico (data, horário, atração musical) e converter quem vê a página em uma reserva de mesa, com o mínimo de fricção possível. Sucesso = a pessoa entende o evento em segundos e consegue reservar em poucos toques.

## Positioning

Não é "mais um restaurante com site" nem uma vitrine de cardápio — é um convite direto para uma noite específica. O Diniz Gourmet é Xis Gaúcho prensado, chapa, queijo derretido, ambiente noturno de encontro com amigos e música ao vivo — não hamburgueria americana moderna, não bar de tecnologia/startup, não restaurante gourmet sofisticado.

## Operating Context

A pessoa normalmente chega pela bio/story do Instagram, no celular, já com alguma intenção de comparecer. Precisa decidir rápido: quem toca, quando, onde, e reservar sem preencher um formulário longo. O dono cadastra o evento no painel interno (`/admin/eventos`) antes de divulgar o link público (`/eventos/[slug]`).

## Capabilities and Constraints

- Cada evento tem sua própria página pública (`/eventos/[slug]`), com nome, atração, data, horário, local e descrição vindos do banco (não hardcoded).
- Reserva pede apenas nome, WhatsApp e quantidade de pessoas — sem conta, sem login.
- Painel interno (`/admin`) protegido por senha única (sem sistema de contas ainda), onde o dono cadastra eventos e vê as reservas recebidas.
- Ainda não existe uma página pública listando todos os eventos — cada link é divulgado individualmente por enquanto.
- Fotos reais (cantor, logo, prato) ainda não foram fornecidas; a primeira versão usa placeholders claramente identificáveis como tal.

## Brand Commitments

- Nome da marca: **Diniz Gourmet**. Opera dentro do espaço físico do restaurante **Nosso Quintal**.
- Logo é um badge/selo circular rústico — quando a arte real chegar, não distorcer proporções nem recriar o logo.
- Direção estética travada pelo usuário (registrada com detalhe na direction contract da surface `/eventos`): rústico + vintage + artesanal + noturno + premium; paleta escura (marrom quase preto `#291A0C`, dourado/âmbar `#C9A227` e `#ED9316`, laranja queimado `#BC430D` com moderação); serif de destaque para títulos (ex: Playfair Display) + sans-serif para texto/UI (ex: Montserrat); texturas sutis (madeira, papel envelhecido, grain) sem prejudicar legibilidade.
- Referências negativas explícitas: nada de hamburgueria americana moderna, estética de startup/SaaS, glassmorphism, gradiente roxo/azul corporativo, neon, cards brancos genéricos, excesso de animação.

## Evidence on Hand

Nenhuma foto real, avaliação de cliente ou logo definitivo disponível ainda — todos serão fornecidos pelo usuário depois. Não inventar depoimentos/avaliações; a seção de prova social só entra quando houver conteúdo real.

## Product Principles

- Evento → desejo → confiança → reserva: cada seção da página existe para mover a pessoa nessa sequência.
- Menor fricção possível na reserva — nome, WhatsApp, quantidade de pessoas, nada além disso.
- Mobile-first de verdade: a maior parte do tráfego vem do Instagram, no celular.
- Autenticidade acima de perfeição: fotografia e tom devem parecer o Diniz Gourmet de verdade, não um template de restaurante genérico.
