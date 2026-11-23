# 3. Lista de páginas / telas

Legenda: ✅ protótipo pronto · 🔜 próxima etapa

## Públicas
| Rota | Tela | Conteúdo |
|------|------|----------|
| `/` | Landing page 🔜 | Hero, demo do assistente, recursos, planos, depoimentos, FAQ, CTA (hoje redireciona ao dashboard) |
| `/login`, `/cadastro` | **Autenticação** ✅ | E-mail + senha; cadastro cria a agência e o Admin |
| `/recuperar-senha` | Recuperar senha 🔜 | Link por e-mail |
| `/onboarding` | Onboarding 🔜 | Nome da agência, logo, cores, primeiro cliente, convite da equipe |

## Área da agência — grupo `(app)`
| Rota | Tela | Conteúdo | Papéis |
|------|------|----------|--------|
| `/dashboard` | **Dashboard** ✅ | Briefing do assistente, KPIs (clientes ativos/MRR, faturado no mês, campanhas, aprovações), gráfico Faturado x Recebido, pipeline de conteúdo, prazos, campanhas, clientes com status de pagamento | todos internos |
| `/jarvis` | **Assistente (tela cheia)** ✅ | Orb animado, chat em streaming, comando de voz, resposta falada, sugestões | todos internos |
| `/conteudo` | **Estúdio de Conteúdo** ✅ | Tipos (Reels, Legenda, Carrossel, Hooks/CTAs), briefing com cliente + template de nicho + tom + objetivo, resultado em tempo real, copiar, histórico no banco, salvar no calendário | Admin, Gestor, Redator |
| `/conteudo/historico` | Histórico de gerações 🔜 | Busca, filtros por cliente/tipo, favoritos, reusar | Admin, Gestor, Redator |
| `/conteudo/templates` | Templates de prompt 🔜 | Templates por nicho (globais + da agência), criar/editar | Admin, Gestor |
| `/espiao` | **Espião** ✅ | @ do concorrente, cliente, nicho, notas; relatório: resumo, confiança, métricas, perfil, mix, formatos vencedores, ganchos, ideias (→ gerar roteiro), tendências, lacunas, plano de ação | Admin, Gestor, Redator |
| `/espiao/[id]` | Concorrente monitorado 🔜 | Evolução por snapshots, comparar com o cliente | idem |
| `/lote` | Geração em lote 🔜 | Mês inteiro de conteúdo para um cliente → calendário | Admin, Gestor |
| `/calendario` | **Calendário editorial** ✅ | Mês/semana, filtro por cliente, arrastar e soltar, editor (roteiro, legenda, status, data), agenda no celular | todos internos |
| `/clientes` | **Lista de clientes** ✅ | Abas por status, busca (nome, nicho, @), MRR, última fatura | todos internos (valores só Admin/Gestor) |
| `/clientes/novo` | **Novo cliente** ✅ | Formulário completo (tom de voz e público alimentam a IA) | Admin, Gestor |
| `/clientes/[id]` | **Ficha do cliente** ✅ | Indicadores, conteúdos, financeiro (criar fatura, mudar status), contratos e entregas, histórico de interações, estratégia, concorrentes, edição | todos internos (financeiro só Admin/Gestor) |
| `/campanhas` | **Campanhas & serviços** ✅ | Abas: contratos (entregas com prazo, atrasos), serviços (pacotes), financeiro (em aberto, gerar mensalidades) | todos internos (valores só Admin/Gestor) |
| (aba de `/campanhas`) | **Financeiro** ✅ | Faturado x recebido do mês, em aberto, atrasado, status das faturas | Admin, Gestor |
| `/tarefas` | **Tarefas** ✅ | Kanban com arrastar e soltar, prioridade, responsável, prazo, filtros (minhas, por cliente) | todos internos |
| `/briefings` | Templates de briefing 🔜 | Construtor de formulário, link para o cliente responder | Admin, Gestor |
| `/configuracoes` | Configurações 🔜 | Marca (logo, cores), equipe e papéis, plano e créditos, integrações | Admin |

## Portal do Cliente — grupo `(portal)` ✅
Uma página só, com layout próprio. O cliente vê apenas o próprio cadastro; a equipe abre `/portal?client=ID` em modo prévia (sem aprovar).

| Rota | Tela | Conteúdo |
|------|------|----------|
| `/portal` | Início ✅ | Pendências de aprovação, próximos 30 dias, publicados, arquivos, faturas |
| (seção) | Aprovações ✅ | Ver roteiro e legenda, aprovar ou pedir ajuste com comentário (volta para a equipe em "Editado") |
| (seção) | Calendário ✅ | Próximos 30 dias, somente leitura |
| `/portal/relatorios` | Relatórios 🔜 | Resultados do mês |
| (seção) | Arquivos ✅ | Enviar fotos, vídeos, áudio e PDF; baixar; apagar os próprios |

## Componentes globais
- **Sidebar** (gaveta no mobile) agrupada por Comando / Criação / Gestão / Sistema, com medidor de créditos de IA ✅
- **Header** com busca (Ctrl K), botão do assistente, notificações, avatar ✅
- **Assistente flutuante**: orb no canto, abre painel lateral em qualquer tela ✅
