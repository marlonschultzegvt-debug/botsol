# Agência X: sistema operacional de agência com IA

Plataforma para agências de marketing e criadores: **conteúdo com IA (Claude)**, **Espião de concorrentes**, CRM, calendário editorial, portal do cliente e um **assistente de voz** com visual HUD.

> Nome provisório. As sugestões de marca estão em [docs/01](docs/01-produto-e-arquitetura.md).

## Documentação
1. [Nome, posicionamento, stack e arquitetura](docs/01-produto-e-arquitetura.md)
2. [Modelagem do banco de dados](docs/02-banco-de-dados.md)
3. [Lista de páginas/telas](docs/03-telas.md)
4. [Prompt system](docs/04-prompt-system.md)

## O que já funciona
| Módulo | Status |
|------|--------|
| Login, cadastro de agência, sair, rotas protegidas, papéis (Admin, Gestor, Redator, Editor, Cliente) | ✅ etapa 2 |
| Dashboard com dados reais (faturado x recebido, pipeline, prazos, campanhas, clientes) | ✅ etapa 2 |
| **Clientes**: lista com filtros e busca, cadastro, ficha completa (notas, conteúdos, financeiro, contratos, concorrentes), edição | ✅ etapa 2 |
| **Calendário editorial**: mês e semana, filtro por cliente, arrastar e soltar, editor de conteúdo, agenda no celular | ✅ etapa 2 |
| Estúdio de Conteúdo (Reels, Legenda, Carrossel, Hooks) + histórico no banco + "salvar no calendário" | ✅ IA real |
| Espião + análises salvas (reabrir sem gastar crédito) | ✅ IA real; dados reais do Instagram com `APIFY_TOKEN` |
| Assistente (chat + voz pt-BR) com os dados reais da agência | ✅ IA real |
| Créditos de IA por mês (limite do plano) | ✅ |
| Campanhas, Tarefas, Portal do Cliente, Lote, Configurações | 🔜 páginas provisórias |

## Rodando localmente
```bash
cd agencia-x
cp .env.example .env        # preencha ANTHROPIC_API_KEY, DATABASE_URL e AUTH_SECRET
npm install
npm run db:push             # cria as tabelas
npm run db:seed             # (opcional) agência demo com dados
npm run dev                 # http://localhost:3000
```

**Logins da demo** (senha `demo1234`): `admin@agenciax.com` (Admin), `gestor@agenciax.com` (Gestor), `redator@agenciax.com` (Redator), `editor@agenciax.com` (Editor). Ou crie sua própria agência em `/cadastro`.

- **Sem `APIFY_TOKEN`:** o Espião faz uma análise **estimada** (deixa isso claro no relatório). Colar legendas e a bio no campo de observações melhora muito o resultado.
- **Com `APIFY_TOKEN`:** coleta seguidores, curtidas, comentários e os 12 posts mais recentes do perfil público.
- **Voz:** use Chrome ou Edge (Web Speech API). Clique no alto-falante para ouvir as respostas.

## Permissões por papel
| Ação | Admin | Gestor | Redator | Editor | Cliente |
|------|:----:|:----:|:----:|:----:|:----:|
| Usar IA (Estúdio, Espião, Assistente) | ✅ | ✅ | ✅ | ✅ | — |
| Criar/editar clientes | ✅ | ✅ | — | — | — |
| Ver e editar financeiro | ✅ | ✅ | — | — | — |
| Criar/editar conteúdos no calendário | ✅ | ✅ | ✅ | ✅ | — |
| Excluir cliente | ✅ | — | — | — | — |
| Área da agência | ✅ | ✅ | ✅ | ✅ | só `/portal` |

## Deploy
Vercel: importe o repositório, defina **Root Directory = `agencia-x`** e cadastre as variáveis do `.env.example` (na Vercel, `AUTH_TRUST_HOST` não é necessário). Banco: Supabase (use a connection string em `DATABASE_URL` e rode `npm run db:push` uma vez).
