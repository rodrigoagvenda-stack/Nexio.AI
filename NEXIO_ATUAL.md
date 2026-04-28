# Nexio.AI — Estado Atual do Projeto

## Stack
- Next.js 14 App Router
- Supabase (Auth + Postgres + RLS + Realtime + Storage)
- shadcn/ui + Radix UI + Tailwind
- 91 componentes React, 102 rotas de API

---

## Páginas Implementadas

### Dashboard do Cliente (/dashboard)
- `/dashboard` — métricas (leads, conversão, funil)
- `/crm` — Kanban + tabela (6 status de leads)
- `/atendimento` — chat WhatsApp real-time
- `/captacao` — extração Google Maps via n8n
- `/outbound` — campanhas outbound (admin only na prática)
- `/lead-pro` — qualificação ICP
- `/prospect` — geração de prospects
- `/membros` — gestão de usuários da empresa
- `/configuracoes/*` — perfil, fluxos SDR, follow-up, webhooks
- `/notificacoes` — activity logs
- `/briefing` — link para formulário público

### Admin (Rodrigo)
- `/admin/empresas` — CRUD empresas
- `/admin/empresas/[id]` — detalhes empresa (inclui UAZap + Webhook N8N)
- `/admin/briefing` — respostas do formulário
- `/admin/n8n` — configuração webhooks ICP e Maps
- `/admin/usuarios` — gestão usuários globais
- `/admin/logs` — system logs
- `/admin/webhooks` — configuração webhooks
- `/admin/sdr/[companyId]` — credenciais SDR criptografadas

### Públicas
- `/brief` — formulário briefing (12 perguntas)
- `/auth/callback` — OAuth Supabase

---

## APIs Principais

- `POST/GET /api/admin/companies` — CRUD empresas
- `PATCH /api/admin/companies/[id]` — atualiza empresa (aceita qualquer campo)
- `POST /api/admin/users` — criar usuários
- `POST /api/company/upload-logo` — upload logo para Supabase Storage
- `POST /api/whatsapp/send` — envio mensagem (chat espelhado) → n8n fire-and-forget
- `POST /api/whatsapp/presence/typing` — status digitando (silencia erros)
- `GET /api/admin/sdr/[companyId]` — config SDR criptografada
- `POST /api/sdr/connect` — conectar instância WhatsApp
- `POST /api/follow/execute` — executar follow-up
- `GET /api/extraction/maps` — extração Google Maps

---

## Banco — Tabelas Existentes

```sql
companies          -- empresa, plano, UAZapi, webhook
users              -- usuários com company_id (multi-tenant)
admin_users        -- super_admin, admin, support
leads              -- CRM leads com kanban status
icp_configuration  -- config ICP por empresa
ICP_leads          -- leads gerados por ICP
conversas_do_whatsapp  -- conversas por empresa
mensagens_do_whatsapp  -- mensagens (inbound/outbound, ai/human)
sdr_configs        -- credenciais SDR criptografadas (AES-256-GCM)
sdr_message_buffer -- buffer Redis espelhado no banco
sdr_logs           -- logs do SDR
system_logs        -- logs gerais
briefing_responses -- respostas do formulário
briefing_config    -- config do briefing
documents          -- base de conhecimento (embeddings)
outbound_campaigns -- campanhas outbound
follow_logs        -- log de disparos follow-up
```

### Colunas adicionadas (sessão atual)
- `companies.image_url` — logo da empresa
- `companies.n8n_webhook_url` — webhook chat espelhado por empresa

### Colunas a adicionar
- `companies.agente_ativo` — toggle SDR
- `companies.whatsapp_instance_name` — nome da instância UAZapi

---

## Integrações Implementadas

- **Supabase:** Auth, DB, RLS, Realtime, Storage ✅
- **UAZapi:** cliente com 60 métodos, multi-tenant ✅
- **n8n:** webhooks Maps, ICP, WhatsApp send ✅
- **OpenAI:** SDK integrado, key criptografada ✅
- **Google Calendar:** estrutura pronta, implementação incompleta ⚠️
- **Stripe/Asaas:** pasta existe, vazia ❌
- **Resend (email):** integrado, sem triggers ⚠️

---

## Autenticação

- Supabase Auth (email/password)
- 2 modos de login: `user` (empresa) e `admin` (Rodrigo)
- Roles em `admin_users`: `super_admin`, `admin`, `support`
- Multi-tenant via `users.company_id` + RLS

---

## Erros Críticos (da auditoria)

### 🔴 Corrigir antes de lançar

1. **Bug login admin** — `admin_users` lookup usa `user_id` em vez de `auth_user_id`
2. **`disable-rls-complete.sql` existe** — deletar, nunca executar em produção
3. **Rate limiting ausente** — endpoints públicos sem limite
4. **Billing não valida limites** — `plan_monthly_limit` existe mas não é verificado

### 🟠 Importantes

5. **Validação de `company_id` inconsistente** — alguns endpoints não validam
6. **Google Calendar incompleto** — estrutura OK, integração não finalizada
7. **Webhook signature não validada** — n8n/UAZapi sem HMAC check
8. **Sem testes** — nenhum arquivo de teste

---

## Qualidade do Código

- TypeScript bem tipado ✅
- Try/catch em todas as rotas ✅
- Error handling com mensagens amigáveis ✅
- Criptografia AES-256-GCM nas credenciais ✅
- Índices SQL criados ✅
- Muitos `console.log()` em produção ⚠️
- Dependências com versões não pinadas ⚠️
- Código morto (múltiplas pastas briefing) ⚠️

---

## Arquivos de Referência

- `UAZAPI.md` — documentação UAZapi GO V2
- `ZAPPLY_CONTEXTO.md` — contexto do produto, decisões, arquitetura
- `database/complete-schema.sql` — schema base
- `database/add-company-image-url.sql` — migrations recentes
- `lib/sdr/uazapi.ts` — cliente UAZapi (60 métodos)
- `lib/n8n/client.ts` — cliente n8n (webhooks)
- `lib/crypto.ts` — criptografia AES-256-GCM
