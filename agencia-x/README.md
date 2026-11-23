# Agência X: sistema operacional de agência com IA

Plataforma para agências de marketing e criadores: **conteúdo com IA (Claude)**, **Espião de concorrentes**, CRM, calendário editorial, portal do cliente e um **assistente de voz** com visual HUD.

> Nome provisório. As sugestões de marca estão em [docs/01](docs/01-produto-e-arquitetura.md).

## Documentação
1. [Nome, posicionamento, stack e arquitetura](docs/01-produto-e-arquitetura.md)
2. [Modelagem do banco de dados](docs/02-banco-de-dados.md)
3. [Lista de páginas/telas](docs/03-telas.md)
4. [Prompt system](docs/04-prompt-system.md)

## O que já funciona (protótipo, etapa 1)
| Tela | Status |
|------|--------|
| Layout (sidebar + header + assistente flutuante), responsivo | ✅ |
| Dashboard | ✅ com dados de demonstração |
| Estúdio de Conteúdo (Reels, Legenda, Carrossel, Hooks) | ✅ IA real, streaming |
| Espião (relatório de concorrente) | ✅ IA real; dados reais do Instagram se houver `APIFY_TOKEN` |
| Assistente (chat + voz pt-BR) | ✅ IA real, streaming |
| Clientes, Calendário, Campanhas, Tarefas, Portal, Lote, Configurações | 🔜 páginas provisórias |

## Rodando localmente
```bash
cd agencia-x
cp .env.example .env        # coloque sua ANTHROPIC_API_KEY
npm install
npm run dev                 # http://localhost:3000
```
- **Sem `APIFY_TOKEN`:** o Espião faz uma análise **estimada** (deixa isso claro no relatório). Colar legendas e a bio no campo de observações melhora muito o resultado.
- **Com `APIFY_TOKEN`:** coleta seguidores, curtidas, comentários e os 12 posts mais recentes do perfil público.
- **Voz:** use Chrome ou Edge (Web Speech API). Clique no alto-falante para ouvir as respostas.
- O banco (Prisma/Supabase) entra na próxima etapa. Por enquanto as telas usam `src/lib/mock-data.ts`.

## Deploy
Vercel: importe o repositório, defina **Root Directory = `agencia-x`** e cadastre as variáveis do `.env.example`.
