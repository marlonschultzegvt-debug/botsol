# 2. Modelagem do banco de dados

Arquivo-fonte: [`prisma/schema.prisma`](../prisma/schema.prisma) (validado com `prisma validate`).

## 2.1 Diagrama de relacionamentos

```
Agency ─┬─< Membership >── User
        │        └──(opcional)── Client   (usuário CLIENT acessa o portal desse cliente)
        ├─< Client ─┬─< ClientNote >── User
        │           ├─< ClientService >── Service
        │           │        └─< Deliverable
        │           ├─< Invoice
        │           ├─< ContentPiece ─┬─< Approval >── User
        │           │                 ├─< Asset
        │           │                 └── AiGeneration (origem)
        │           ├─< Competitor ─< CompetitorSnapshot
        │           └─< Task
        ├─< Service
        ├─< AiGeneration ── PromptTemplate
        ├─< PromptTemplate
        ├─< Task >── User (responsável)
        ├─< BriefingTemplate
        └─< JarvisThread ─< JarvisMessage
```
`─<` = um para muitos.

## 2.2 Tabelas

| Grupo | Tabela | Para que serve | Campos-chave |
|------|--------|----------------|--------------|
| **Núcleo** | `Agency` | Cada agência assinante (tenant) | `slug`, `logoUrl`, `primaryColor`, `plan`, `aiCredits` |
| | `User` | Pessoa que faz login | `email`, `passwordHash` |
| | `Membership` | Liga usuário ↔ agência com papel | `role` (ADMIN, MANAGER, WRITER, EDITOR, CLIENT), `clientId` |
| **CRM** | `Client` | Cliente da agência | `niche`, `instagram`, `goals`, `brandVoice`, `avgTicket`, `monthlyFee`, `status` |
| | `ClientNote` | Histórico de interações | `type` (NOTE, CALL, MEETING, WHATSAPP, EMAIL), `body` |
| **Serviços** | `Service` | Pacotes vendidos | `price`, `billingCycle`, `deliverables` (JSON) |
| | `ClientService` | Contrato/campanha de um cliente | `status`, `price`, `startDate`, `endDate` |
| | `Deliverable` | Entregas e prazos do contrato | `dueDate`, `status` (PENDING, IN_PROGRESS, DELIVERED, LATE) |
| | `Invoice` | Financeiro | `amount`, `dueDate`, `status` (PENDING, PAID, OVERDUE) |
| **Conteúdo** | `ContentPiece` | Item do calendário editorial | `format`, `platform`, `status` (IDEA → SCRIPTED → FILMED → EDITED → IN_APPROVAL → APPROVED → PUBLISHED), `scheduledAt`, `script`, `caption` |
| | `Approval` | Decisão do cliente no portal | `decision`, `comment` |
| | `Asset` | Arquivos enviados | `storageKey` (Supabase Storage), `mimeType` |
| **IA** | `AiGeneration` | Histórico de tudo que a IA gerou | `type`, `input` (JSON), `output`, `model`, tokens, `favorite` |
| | `PromptTemplate` | Templates por nicho (globais ou da agência) | `niche`, `type`, `instruction` |
| **Espião** | `Competitor` | Perfil monitorado | `handle`, `platform`, `clientId` |
| | `CompetitorSnapshot` | Foto do perfil em uma data | `followers`, `engagementRate`, `postsPerWeek`, `report` (JSON), `dataSource` |
| **Produtividade** | `Task` | Tarefas internas | `status`, `priority`, `assigneeId`, `dueDate` |
| | `BriefingTemplate` | Formulários de briefing | `fields` (JSON) |
| **Assistente** | `JarvisThread` / `JarvisMessage` | Memória das conversas | `content` (blocos da API, preservados como vieram) |

## 2.3 Decisões importantes
- **Multi-tenant:** toda tabela de negócio tem `agencyId` (direto ou via `Client`). Toda query filtra pela agência da sessão. No Supabase dá para reforçar com Row Level Security.
- **Papéis via `Membership`**, não no `User`: a mesma pessoa pode ser freelancer em duas agências com papéis diferentes.
- **Snapshots do Espião:** guardar histórico permite gráfico de evolução do concorrente ("ganhou 3 mil seguidores no mês").
- **`AiGeneration` registra tokens:** base para cobrar créditos por plano e mostrar custo por cliente.
- **Índices** nos filtros mais usados: `(agencyId, status)`, `(agencyId, scheduledAt)`, `(agencyId, status, dueDate)`.

## 2.4 Como subir o banco
```bash
# 1. Crie um projeto no Supabase e copie a connection string para DATABASE_URL no .env
npm run db:push      # cria as tabelas
npm run db:studio    # abre um painel para ver os dados
```
