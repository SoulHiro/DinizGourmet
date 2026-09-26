# 🍽️ Diniz Gourmet

Uma aplicação web moderna para restaurante desenvolvida com Next.js 15, oferecendo uma experiência completa de pedidos online com opções de entrega e retirada.

## ✨ Funcionalidades

- 🏠 **Página inicial** com seleção de método de consumo (Entrega/Retirada)
- 📱 **Interface responsiva** otimizada para dispositivos móveis
- 🛒 **Sistema de carrinho** com gerenciamento de estado
- 📋 **Catálogo de produtos** organizados por categorias
- 🎯 **Sistema de pedidos** com validação de CPF
- 📊 **Consulta de pedidos** por CPF do cliente
- 🚚 **Zonas de entrega** configuráveis
- 💰 **Sistema de promoções** flexível
- 🍱 **Combos personalizáveis**

## 🛠️ Tecnologias Utilizadas

### Frontend

- **Next.js 15** - Framework React com App Router
- **React 19** - Biblioteca para interfaces de usuário
- **TypeScript** - Tipagem estática
- **Tailwind CSS 4** - Framework CSS utilitário
- **Radix UI** - Componentes acessíveis
- **Lucide React** - Ícones modernos
- **React Hook Form** - Gerenciamento de formulários
- **Zod** - Validação de schemas
- **Sonner** - Notificações toast

### Backend & Database

- **Drizzle ORM** - ORM type-safe para PostgreSQL
- **PostgreSQL** - Banco de dados relacional
- **Drizzle Kit** - Ferramentas de migração

### Desenvolvimento

- **Biome** - Linter e formatter
- **PNPM** - Gerenciador de pacotes
- **Turbopack** - Bundler de alta performance

## 🚀 Como Usar

### 🌐 Acesso à Aplicação
Acesse a aplicação em produção: N/A

> 📋 **Nota**: Este projeto está disponível apenas para visualização e demonstração. Não é permitida a clonagem, replicação, revenda ou uso comercial sem autorização expressa do autor.

## 📁 Estrutura do Projeto

```
src/
├── app/
│   ├── (main)/                 # Grupo de rotas principais
│   │   ├── _components/        # Componentes compartilhados
│   │   ├── menu/              # Páginas do cardápio
│   │   │   ├── _components/   # Componentes do menu
│   │   │   ├── actions/       # Server actions
│   │   │   ├── contexts/      # Context providers
│   │   │   └── helpers/       # Funções utilitárias
│   │   ├── orders/            # Sistema de pedidos
│   │   └── page.tsx           # Página inicial
│   ├── globals.css            # Estilos globais
│   └── layout.tsx             # Layout raiz
├── components/
│   └── ui/                    # Componentes de UI reutilizáveis
├── db/
│   ├── schema.ts              # Schema do banco de dados
│   ├── index.ts               # Configuração do Drizzle
│   └── seed.ts                # Script de seed
├── lib/
│   └── utils.ts               # Utilitários gerais
└── types/
    ├── global.d.ts            # Tipos globais
    └── restaurant.ts          # Tipos específicos do domínio
```

## 🗄️ Schema do Banco de Dados

O projeto utiliza um schema robusto com as seguintes entidades principais:

- **Menu Categories** - Categorias do cardápio
- **Products** - Produtos individuais
- **Combos** - Combinações de produtos
- **Orders** - Pedidos dos clientes
- **Order Products** - Itens dos pedidos
- **Promotions** - Sistema de promoções
- **Delivery Zones** - Zonas de entrega

## 📱 Funcionalidades Detalhadas

### Sistema de Pedidos

- Seleção de método de consumo (Entrega/Retirada)
- Carrinho de compras com persistência
- Validação de dados do cliente
- Cálculo automático de taxas de entrega

### Gestão de Produtos

- Organização por categorias
- Suporte a ingredientes
- Sistema de preços flexível
- Imagens otimizadas

### Promoções

- Desconto percentual
- Valor fixo de desconto
- Promoções "Leve 1, Pague 1"
- Aplicação por categoria ou produto específico

## 🔧 Tecnologias e Arquitetura

Este projeto demonstra o uso de tecnologias modernas e boas práticas de desenvolvimento:

```bash
# Stack principal utilizada
Next.js 15 + React 19 + TypeScript
Tailwind CSS 4 + Radix UI
Drizzle ORM + PostgreSQL
Biome + Turbopack
```

## 🤝 Sobre o Projeto

Este projeto foi desenvolvido como uma demonstração de habilidades técnicas e está disponível publicamente apenas para fins de **visualização e portfólio**.

### ⚠️ Termos de Uso
- ✅ **Permitido**: Visualizar o código e a aplicação
- ✅ **Permitido**: Usar como referência de aprendizado
- ❌ **Não permitido**: Clonar, copiar ou replicar o projeto
- ❌ **Não permitido**: Uso comercial ou revenda
- ❌ **Não permitido**: Redistribuição do código

## 📄 Licença

Este projeto está protegido por direitos autorais. Todos os direitos reservados ao autor.

## 👨‍💻 Autor

Desenvolvido com ❤️ por Victor Matheus Dos Santos

---

⭐ Se este projeto foi útil para você, considere dar uma estrela no repositório!
