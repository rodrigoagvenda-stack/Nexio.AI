# Nexio.AI / Zaapli — Estado Atual do Projeto

## Stack
- Next.js 14 App Router
- Supabase (Auth + Postgres + RLS + Realtime + Storage)
- shadcn/ui + Radix UI + Tailwind (tema verde #15803d)
- UAZapi GO V2 (WhatsApp)
- n8n (automação / agente IA)
- Stripe (pagamentos)

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
- `/configuracoes` — perfil + **planos Stripe** + **Google Calendar** (3 abas)
- `/configuracoes/sdr` — agente IA (toggle, tipo, prompt, **QR code auto-connect**)
- `/configuracoes/follow` — follow-up sequences
- `/configuracoes/fluxos` — fluxos SDR
- `/notificacoes` — activity logs
- `/briefing` — link para formulário público

### Admin (Rodrigo)
- `/admin/empresas` — CRUD empresas
- `/admin/empresas/[id]` — detalhes empresa
- `/admin/briefing` — respostas do formulário
- `/admin/n8n` — configuração webhooks ICP e Maps
- `/admin/usuarios` — gestão usuários globais
- `/admin/logs` — system logs
- `/admin/webhooks` — configuração webhooks

### Públicas
- `/brief` — formulário briefing
- `/auth/callback` — OAuth Supabase
- `/login` — login user + admin (toggle)

---

## APIs Principais

### Auth / Multi-tenant
- `lib/auth/require-auth.ts` — `requireAuth()`, `requireAdmin()`, `validateCompanyAccess()`

### Stripe (pagamentos)
- `POST /api/stripe/checkout` — cria sessão de checkout por plano
- `POST /api/stripe/portal` — abre portal de faturamento Stripe
- `POST /api/stripe/webhook` — handles `checkout.session.completed`, `invoice.payment_succeeded`, `invoice.payment_failed`, `customer.subscription.deleted`

### Google Calendar (OAuth por empresa)
- `GET /api/google/auth` — inicia OAuth Google
- `GET /api/google/callback` — salva tokens em `google_integrations`
- `GET/DELETE /api/google/status` — status + desconectar

### WhatsApp / UAZapi
- `POST /api/sdr/connect` — **auto-cria instância UAZapi se não existe**, conecta e retorna QR/paircode
- `DELETE /api/sdr/connect` — desconecta instância
- `GET /api/sdr/status` — status em tempo real + QR atualizado
- `GET/PUT /api/sdr/config` — config SDR (prompt, tipo agente, agente_ativo)
- `POST /api/whatsapp/instance/create` — cria instância via admin token (usado internamente)
- `POST /api/whatsapp/send` — envio mensagem chat espelhado → n8n

### Outros
- `GET /api/leads` etc — CRUD leads (todos com requireAuth)
- `GET /api/tags`, `GET /api/members` etc — todos protegidos

---

## Banco — Tabelas

```sql
companies          -- empresa, plano, UAZapi, Stripe, tokens
users              -- usuários com company_id (multi-tenant)
admin_users        -- super_admin, admin, support
leads              -- CRM leads com kanban status
conversas_do_whatsapp  -- conversas por empresa
mensagens_do_whatsapp  -- mensagens (inbound/outbound, ai/human)
sdr_configs        -- config SDR + UAZapi token criptografado
sdr_message_buffer -- buffer Redis espelhado
sdr_logs           -- logs SDR
google_integrations -- tokens OAuth Google por empresa (NOVA)
follow_up_config   -- config follow-up por empresa (NOVA)
tokens_usage       -- controle tokens por empresa (NOVA)
system_logs        -- logs gerais
briefing_responses -- respostas formulário
documents          -- base de conhecimento
```

### Migrations que PRECISAM ser rodadas no Supabase
1. `database/multi-tenant-migration.sql` — colunas agente_ativo, whatsapp_instance_name, tokens_used, tokens_limit, google_integrations table, follow_up_config table
2. `database/stripe-columns.sql` — stripe_customer_id, stripe_subscription_id nas companies

---

## Integrações

| Integração | Status |
|---|---|
| Supabase Auth + DB + RLS + Realtime + Storage | ✅ |
| UAZapi GO V2 (multi-tenant, auto-create) | ✅ |
| n8n webhooks (Maps, ICP, WhatsApp) | ✅ |
| OpenAI SDK | ✅ |
| Stripe (checkout, portal, webhook) | ✅ |
| Google Calendar OAuth por empresa | ✅ |
| Resend (email) | ⚠️ integrado, sem triggers |
| Asaas PIX | ❌ não implementado |

---

## Segurança / Multi-tenant

- `requireAuth()` em todas as rotas do dashboard
- `company_id` vem sempre do DB do usuário logado, nunca do body
- AES-256-GCM para credenciais UAZapi e OpenAI
- Rate limiting disponível em `lib/rate-limit.ts`

---

## Cores / Tema

- **Verde**: `#15803d` (primary) — substituiu roxo/lilás
- CSS vars em `app/globals.css`

---

## Arquivos de Referência

- `UAZAPI.md` — documentação UAZapi GO V2
- `ZAPPLY_CONTEXTO.md` — contexto produto, decisões, arquitetura
- `lib/uazapi-admin.ts` — admin client (criar/deletar instâncias)
- `lib/sdr/uazapi.ts` — instance client (60 métodos)
- `lib/stripe.ts` — Stripe lazy init + PLANS config
- `lib/auth/require-auth.ts` — auth middleware
- `lib/crypto.ts` — AES-256-GCM
