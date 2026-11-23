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
| **Campanhas & Serviços**: catálogo de pacotes, contratos com entregas automáticas e prazos, entregas atrasadas destacadas | ✅ etapa 3 |
| **Financeiro**: faturado x recebido do mês, faturas em aberto, gerar mensalidades do mês em 1 clique, marcar atrasadas | ✅ etapa 3 |
| **Tarefas**: kanban (a fazer, fazendo, revisão, feito) com arrastar e soltar, prioridade, responsável, prazo, filtros | ✅ etapa 3 |
| **Portal do Cliente**: login próprio, aprovar ou pedir ajuste, próximos 30 dias, publicados, envio de arquivos, faturas | ✅ etapa 3 |
| Acesso ao portal criado pela ficha do cliente (senha temporária) + "ver como cliente" | ✅ etapa 3 |
| Geração em Lote, Configurações (marca, equipe) | 🔜 páginas provisórias |

## ✅ Publicação: o que já está feito e o que falta
**Já feito (23/11/2026):** projeto Supabase `agencia-x` em **São Paulo** (ref `rjriyuuiydbjkfwouspd`) com as 20 tabelas, RLS ligado em todas (bloqueia a API pública; o app acessa direto pelo servidor) e o bucket privado `assets` para os arquivos do portal.

**Falta você pegar (são segredos, só você vê no painel):**
1. **Chave do Claude:** console.anthropic.com → API Keys → `ANTHROPIC_API_KEY`.
2. **Conexão do banco:** Supabase → botão *Connect* → **Transaction pooler** (porta 6543) → copie a URI, troque `[YOUR-PASSWORD]` pela senha do banco e acrescente no final `?pgbouncer=true&connection_limit=1` → `DATABASE_URL`.
3. **Arquivos:** Supabase → Project Settings → API Keys → `service_role` → `SUPABASE_SERVICE_ROLE_KEY`. E `SUPABASE_URL=https://rjriyuuiydbjkfwouspd.supabase.co`.
4. **`AUTH_SECRET`:** qualquer texto longo e aleatório (ex.: gere em 1password.com/password-generator, 40+ caracteres).

**Publicar:** vercel.com → *Add New → Project* → importe `botsol` → **Root Directory = `agencia-x`** → cole as variáveis acima → Deploy. Depois, entre em `/cadastro` para criar sua agência (o banco de produção começa vazio, sem os logins de demonstração).

*(Opcional)* `APIFY_TOKEN` em apify.com para o Espião usar dados reais do Instagram.

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
| Contratos, serviços e acesso ao portal | ✅ | ✅ | — | — | — |
| Marcar entregas e mover tarefas | ✅ | ✅ | ✅ | ✅ | — |
| Aprovar conteúdo / pedir ajuste | — | — | — | — | ✅ (só os seus) |
| Enviar arquivos | ✅ | ✅ | ✅ | ✅ | ✅ (só os seus) |
| Área da agência | ✅ | ✅ | ✅ | ✅ | só `/portal` |

## Deploy
Vercel: importe o repositório, defina **Root Directory = `agencia-x`** e cadastre as variáveis do `.env.example` (na Vercel, `AUTH_TRUST_HOST` não é necessário). Banco: Supabase (use a connection string em `DATABASE_URL` e rode `npm run db:push` uma vez).
