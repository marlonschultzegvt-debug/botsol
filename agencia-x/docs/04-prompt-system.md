# 4. Prompt system (os prompts internos da IA)

Todos os prompts estão versionados em `src/lib/ai/prompts/`. Este documento explica a arquitetura. Para o texto completo, veja os arquivos.

## 4.1 Camadas

```
┌───────────────────────────────────────────────────────────┐
│ BASE_STRATEGIST  (base.ts)                                │  personalidade + regras comuns
│   └─ + instruções do módulo  (CONTENT_SYSTEM / SPY_SYSTEM │  → vai no "system" (cacheado)
│        / buildJarvisSystem)                               │
├───────────────────────────────────────────────────────────┤
│ Prompt do usuário montado pelo builder                    │  → vai em "messages"
│   tarefa + briefing + template de nicho + formato de saída│
└───────────────────────────────────────────────────────────┘
```

O **system** é fixo (sem data nem ID), então o cache de prompt funciona e cada chamada fica mais barata. O que muda a cada pedido vai na mensagem do usuário.

## 4.2 Base: estrategista-chefe (`base.ts`)
Regras que valem para tudo:
- Português do Brasil natural, sem tom robótico.
- Gancho nos 3 primeiros segundos; uma ideia por conteúdo; CTA específico.
- Adaptar a nicho, público e tom; se faltar contexto, assumir o mais provável e seguir.
- **Nunca inventar dados, depoimentos ou promessas de resultado.** Respeitar conselhos de classe (CFO, CRM, OAB, CVM...).
- Saída em Markdown pronto para copiar.

## 4.3 Estúdio de Conteúdo (`content.ts`)
Cada tipo tem uma **receita de saída**:

| Tipo | Receita |
|------|---------|
| `reels` | Gancho (0–3s) com fala + texto na tela → cenas numeradas `[CENA]` + fala → virada → CTA → duração → dica de gravação → legenda curta + 5 hashtags |
| `legenda` | 1ª linha que funciona cortada no "...mais" → corpo escaneável → CTA → 8–12 hashtags (amplas + nicho + locais) |
| `carrossel` | Tabela slide a slide (título ≤ 8 palavras, apoio ≤ 25, visual), capa com gancho, último slide CTA, 7–10 slides + legenda |
| `hooks` | Ganchos agrupados por estilo (curiosidade, dor, contraste, número, polêmica leve, POV) + 10 CTAs com quando usar |

`buildContentPrompt()` junta: tipo, quantidade, tema, cliente, **template do nicho**, público, objetivo, tom, plataforma e observações. Com mais de 1 item, exige ângulos diferentes.

### Templates por nicho (`niches.ts`)
8 prontos: Odontologia, Fitness, Moda, Imobiliária, Restaurante, Infoprodutor, Energia Solar e Negócio local. Cada um injeta formatos que funcionam no nicho e as **restrições éticas** do setor. Na etapa do banco, a agência poderá criar os seus (tabela `PromptTemplate`).

## 4.4 Espião (`spy.ts`)
- **Papel:** analista de inteligência competitiva.
- **Regras de honestidade:** com dados coletados (Apify), calcula médias reais; sem dados, rotula como **estimativa**, usa faixas e não inventa número de seguidores. Ideias são **adaptações**, nunca cópia.
- **Saída garantida por JSON Schema** (`SPY_REPORT_SCHEMA`): resumo, confiança, perfil (bio, posicionamento, público, nota da bio), métricas, mix de conteúdo (%), pilares, formatos vencedores, ganchos, 8–10 ideias (título, formato, gancho, porquê), tendências, oportunidades (lacunas) e plano de ação em 5 passos.
- **Coleta:** `apify.ts` resume os 12 posts mais recentes (curtidas, comentários, views, legenda cortada em 280 caracteres) antes de mandar à IA. Isso economiza tokens.

## 4.5 Assistente (`jarvis.ts`)
- Persona: assistente de IA ao estilo de filme de ficção; educado, preciso, levemente espirituoso, proativo; chama o usuário de "chefe" com moderação.
- Respostas curtas (até 6 linhas, porque podem ser lidas em voz alta), exceto quando pedirem algo longo.
- Indica o módulo certo do sistema (`/conteudo`, `/espiao`...).
- Recebe um **retrato da agência** (`agencySnapshotForAI()`): MRR, clientes com status e pagamento, pipeline, prazos, campanhas e receita. Assim responde "quem está atrasado?" com dados. Se um dado não estiver no retrato, ele diz que não tem.

## 4.6 Próximos prompts (já desenhados)
| Função | Ideia |
|--------|-------|
| Geração em lote | Recebe o calendário do mês (datas + formatos) e devolve JSON com um item por data, que vai direto para `ContentPiece` |
| Briefing → estratégia | Lê as respostas do briefing e gera pilares, persona e linha editorial do cliente |
| Relatório mensal | Junta métricas + entregas e escreve o relatório para o portal do cliente |
| Assistente com ferramentas | Tool use: `criar_tarefa`, `agendar_conteudo`, `buscar_cliente`, `gerar_roteiro`, para o assistente agir no sistema e não só responder |
