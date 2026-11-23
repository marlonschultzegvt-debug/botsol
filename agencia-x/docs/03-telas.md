# 3. Lista de páginas / telas

Legenda: ✅ protótipo pronto · 🔜 próxima etapa

## Públicas
| Rota | Tela | Conteúdo |
|------|------|----------|
| `/` | Landing page 🔜 | Hero, demo do assistente, recursos, planos, depoimentos, FAQ, CTA (hoje redireciona ao dashboard) |
| `/login`, `/cadastro`, `/recuperar-senha` | Autenticação 🔜 | E-mail + senha, Google; cadastro cria a Agency |
| `/onboarding` | Onboarding 🔜 | Nome da agência, logo, cores, primeiro cliente, convite da equipe |

## Área da agência — grupo `(app)`
| Rota | Tela | Conteúdo | Papéis |
|------|------|----------|--------|
| `/dashboard` | **Dashboard** ✅ | Briefing do assistente, KPIs (clientes ativos, receita, campanhas, aprovações), gráfico Receita x Meta, pipeline de conteúdo, prazos, campanhas, clientes com status de pagamento | todos internos |
| `/jarvis` | **Assistente (tela cheia)** ✅ | Orb animado, chat em streaming, comando de voz, resposta falada, sugestões | todos internos |
| `/conteudo` | **Estúdio de Conteúdo** ✅ | Tipos (Reels, Legenda, Carrossel, Hooks/CTAs), briefing com cliente + template de nicho + tom + objetivo, resultado em tempo real, copiar, histórico | Admin, Gestor, Redator |
| `/conteudo/historico` | Histórico de gerações 🔜 | Busca, filtros por cliente/tipo, favoritos, reusar | Admin, Gestor, Redator |
| `/conteudo/templates` | Templates de prompt 🔜 | Templates por nicho (globais + da agência), criar/editar | Admin, Gestor |
| `/espiao` | **Espião** ✅ | @ do concorrente, cliente, nicho, notas; relatório: resumo, confiança, métricas, perfil, mix, formatos vencedores, ganchos, ideias (→ gerar roteiro), tendências, lacunas, plano de ação | Admin, Gestor, Redator |
| `/espiao/[id]` | Concorrente monitorado 🔜 | Evolução por snapshots, comparar com o cliente | idem |
| `/lote` | Geração em lote 🔜 | Mês inteiro de conteúdo para um cliente → calendário | Admin, Gestor |
| `/calendario` | Calendário editorial 🔜 | Mês/semana, arrastar e soltar, filtros, status, prazos | todos internos |
| `/clientes` | Lista de clientes 🔜 | Tabela com filtros (status, nicho), busca | Admin, Gestor |
| `/clientes/[id]` | Ficha do cliente 🔜 | Abas: visão geral, conteúdos, contratos, financeiro, notas, concorrentes, arquivos | Admin, Gestor |
| `/campanhas` | Campanhas & serviços 🔜 | Catálogo de pacotes, contratos, entregas e prazos | Admin, Gestor |
| `/financeiro` | Financeiro 🔜 | Faturas pagas/pendentes/atrasadas, MRR, inadimplência | Admin |
| `/tarefas` | Tarefas 🔜 | Kanban + lista, responsável, prioridade | todos internos |
| `/briefings` | Templates de briefing 🔜 | Construtor de formulário, link para o cliente responder | Admin, Gestor |
| `/configuracoes` | Configurações 🔜 | Marca (logo, cores), equipe e papéis, plano e créditos, integrações | Admin |

## Portal do Cliente — grupo `(portal)` 🔜
| Rota | Tela | Conteúdo |
|------|------|----------|
| `/portal` | Início | Resumo do mês, pendências de aprovação |
| `/portal/aprovacoes` | Aprovações | Ver roteiro/arte/vídeo, aprovar ou pedir ajuste com comentário |
| `/portal/calendario` | Calendário | Somente leitura |
| `/portal/relatorios` | Relatórios | Resultados do mês |
| `/portal/arquivos` | Upload | Enviar fotos e vídeos brutos |

## Componentes globais
- **Sidebar** (gaveta no mobile) agrupada por Comando / Criação / Gestão / Sistema, com medidor de créditos de IA ✅
- **Header** com busca (Ctrl K), botão do assistente, notificações, avatar ✅
- **Assistente flutuante**: orb no canto, abre painel lateral em qualquer tela ✅
