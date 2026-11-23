# 1. Nome, posicionamento e arquitetura

## 1.1 Três opções de nome

| # | Nome | Posicionamento (frase de venda) | Por que funciona |
|---|------|------------------------------|------------------|
| 1 | **Órbita** | "O centro de comando da sua agência, com uma IA que trabalha com você." | Combina com o visual HUD e com o assistente: tudo gira em torno da agência. Curto, fácil de lembrar, `.com.br` provável. |
| 2 | **Hookly** | "Conteúdo que prende nos 3 primeiros segundos, para cada cliente, em minutos." | Foco no resultado que o criador quer (gancho e viral). Bom para vender no Instagram como produto de entrada (R$ 97). |
| 3 | **Radar OS** | "Veja o que funciona no nicho antes do seu concorrente, e transforme em pauta." | Puxa pela ferramenta Espião, que é o recurso mais "vendável" em anúncio. "OS" passa a ideia de sistema completo. |

**Minha recomendação:** **Órbita** como marca do sistema completo (assinatura mensal para agências) e **Hookly** como nome do produto de entrada de R$ 97 (só Estúdio de Conteúdo + Espião). Uma escada de valor: o criador entra pelo Hookly e sobe para o Órbita quando vira agência.

O nome está centralizado em `NEXT_PUBLIC_AGENCY_NAME` e o assistente em `NEXT_PUBLIC_ASSISTANT_NAME`. Trocar é só mudar o `.env`.

### Público e proposta
- **ICP 1:** agência pequena (1 a 10 pessoas, 5 a 40 clientes) que hoje usa planilha, Trello, WhatsApp e ChatGPT soltos.
- **ICP 2:** social media / criador freelancer com 2 a 8 clientes.
- **Dor:** tempo gasto criando pauta, roteiro e legenda; falta de método para "o que postar"; cliente sumido na aprovação; cobrança desorganizada.
- **Promessa:** "Planeje, crie e aprove o mês de conteúdo de um cliente em 1 hora."

### Planos sugeridos
| Plano | Preço | Inclui |
|------|-------|--------|
| Starter (Hookly) | R$ 97/mês | Estúdio + Espião, 1 usuário, 150 gerações |
| Pro | R$ 297/mês | Tudo + CRM, Calendário, Portal, 5 usuários, 800 gerações |
| Agency | R$ 697/mês | Ilimitado de usuários, marca própria (white-label), 3.000 gerações, Apify incluso |

---

## 1.2 Stack

| Camada | Escolha | Motivo |
|-------|---------|--------|
| Front + back | **Next.js 15 (App Router) + React 19 + TypeScript** | Um projeto só: telas, API Routes e streaming de IA |
| UI | **Tailwind CSS + componentes no padrão shadcn/ui** (`cva` + `tailwind-merge`) | Visual Linear/Notion, fácil de customizar por agência |
| Gráficos | **Recharts** | Leve, responsivo |
| Ícones | **lucide-react** | |
| IA | **Claude API (`@anthropic-ai/sdk`)**, modelo `claude-opus-5-5` | Streaming, structured outputs (JSON garantido), fallback automático no servidor |
| Coleta de dados | **Apify** (actor `apify/instagram-profile-scraper`) | Dados públicos reais do Instagram para o Espião |
| Banco | **PostgreSQL no Supabase + Prisma ORM** | Supabase também dá Storage (uploads do portal) e backups |
| Auth | **NextAuth (Auth.js v5)** com credenciais + Google | Papéis por agência (tabela `Membership`) |
| Voz | Web Speech API do navegador (fala e escuta em pt-BR) | Grátis. Upgrade: ElevenLabs para uma voz premium |
| Deploy | **Vercel** (app) + **Supabase** (banco/arquivos) | Deploy por push no GitHub |

## 1.3 Arquitetura

```
 Navegador (React)
   │  Dashboard · Estúdio · Espião · Calendário · Portal · Assistente (voz)
   ▼
 Next.js (Vercel)
   ├─ Server Components ── leem o banco via Prisma
   ├─ /api/ai/content ──┐
   ├─ /api/ai/spy ──────┼─► src/lib/ai/claude.ts ──► Claude API (streaming / JSON)
   ├─ /api/jarvis ──────┘        ▲ prompts em src/lib/ai/prompts/*
   │                             │
   ├─ src/lib/apify.ts ──────────┴─► Apify (dados públicos do Instagram)
   └─ Prisma ───────────────────────► PostgreSQL (Supabase) + Storage
```

**Princípios:**
1. **Toda IA passa por um único arquivo** (`src/lib/ai/claude.ts`): modelo, custo, erros e fallback ficam num lugar só.
2. **Prompts são código** (`src/lib/ai/prompts/`): versionados no Git, testáveis, fáceis de melhorar.
3. **Multi-tenant por `agencyId`** em todas as tabelas: um banco atende várias agências (SaaS).
4. **Chaves só no servidor:** o navegador nunca vê `ANTHROPIC_API_KEY` nem `APIFY_TOKEN`.
5. **Mobile-first:** sidebar vira gaveta, grids colapsam para uma coluna.

## 1.4 Estrutura de pastas

```
agencia-x/
├─ prisma/
│  └─ schema.prisma            # modelagem completa (ver docs/02)
├─ docs/                       # esta documentação
├─ src/
│  ├─ app/
│  │  ├─ layout.tsx            # HTML raiz, fontes, tema
│  │  ├─ globals.css           # tema HUD (variáveis de cor = marca da agência)
│  │  ├─ (app)/                # área logada (Sidebar + Header + Assistente)
│  │  │  ├─ layout.tsx
│  │  │  ├─ dashboard/         # ✅ pronto
│  │  │  ├─ conteudo/          # ✅ Estúdio de Conteúdo com IA
│  │  │  ├─ espiao/            # ✅ Ferramenta Espião
│  │  │  ├─ jarvis/            # ✅ Assistente em tela cheia
│  │  │  ├─ clientes/ calendario/ campanhas/ tarefas/ portal/ lote/ configuracoes/   # próximas etapas
│  │  ├─ (portal)/             # (futuro) área do cliente com layout próprio
│  │  └─ api/
│  │     ├─ ai/content/route.ts   # streaming de conteúdo
│  │     ├─ ai/spy/route.ts       # Apify + relatório JSON
│  │     └─ jarvis/route.ts       # chat do assistente
│  ├─ components/
│  │  ├─ ui/                   # button, card, input, badge, markdown (padrão shadcn)
│  │  ├─ layout/               # sidebar, header, app-shell, nav
│  │  ├─ dashboard/            # stat-card, charts
│  │  └─ jarvis/               # orb, chat, painel flutuante, hook de voz
│  └─ lib/
│     ├─ ai/claude.ts          # cliente Claude (streaming, JSON, erros)
│     ├─ ai/prompts/           # base, content, spy, jarvis, niches
│     ├─ apify.ts              # coletor do Instagram
│     ├─ mock-data.ts          # dados de demonstração (sai quando o banco entrar)
│     ├─ read-stream.ts        # leitor de streaming no navegador
│     └─ utils.ts
└─ .env.example
```

## 1.5 Decisões da integração com o Claude

| Rota | Modo | `effort` | Por quê |
|------|------|----------|---------|
| Assistente (chat) | streaming | `low` | Resposta rápida, conversa |
| Estúdio de Conteúdo | streaming | `medium` | Qualidade criativa com custo controlado |
| Espião | JSON estruturado (`json_schema`) | `high` | Análise mais profunda; o JSON é garantido pelo schema, sem "parse quebrado" |

- **Fallback no servidor** (`fallbacks: "default"`): se o modelo principal recusar um pedido por política, a própria API tenta outro modelo na mesma chamada. Está ligado em todas as rotas; para desligar, remova `fallbacks` e o `betas` em `claude.ts`.
- **Cache de prompt:** os system prompts são fixos e marcados com `cache_control`, então as chamadas repetidas ficam mais baratas.
- **Erros em português:** chave inválida, limite de uso etc. aparecem para o usuário com instrução clara.
