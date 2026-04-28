# Zaapli — Contexto do Produto

## O que é

SaaS de IA SDR (vendedor digital via WhatsApp) multi-tenant.
Domínio: zaapli.com.br
Concorre com Frontzapp (frontzapp.com.br).
Diferencial: arquitetura multi-agente com memória longa, não é chatbot simples.

---

## Nome

- **Zaapli** — produto/plataforma
- **Nexio AI** — nome do agente IA SDR (mantido internamente)

---

## Planos

| | Starter | Pro | Scale |
|---|---|---|---|
| Preço | R$397/mês | R$597/mês | R$997/mês |
| Números WhatsApp | 1 | 3 | 10 |
| Número adicional | R$147 | R$127 | R$97 |

Tudo incluso em todos os planos — diferença só por volume.

---

## Features (todos os planos)

- IA SDR ativa (orquestrador multi-agente)
- CRM + Kanban
- Atendimento humano (chat espelhado)
- Follow-up automático
- Anti-noshow (para quem usa reuniões)
- Remarketing
- Extração de leads (Google Maps)
- Google Calendar (agendamento)
- Base de conhecimento (upload PDF)

**Fora do produto (admin only):** Outbound/Orbit — risco de ban do WhatsApp, uso interno apenas.

---

## Arquitetura de Roles

- `super_admin` — Rodrigo, acesso total
- `company_admin` — dono da conta do cliente
- `company_user` — vendedor/atendente do cliente

---

## Stack

- **Frontend/Backend:** Next.js 14 (App Router)
- **Banco:** Supabase (Postgres + RLS + Realtime)
- **Automação:** n8n
- **WhatsApp:** UAZapi GO V2
- **IA:** OpenAI GPT-4.1 (orquestrador) + GPT-4.1-mini (sub-agentes) — Claude como opção futura
- **Fila:** Redis (buffer de mensagens)
- **Pagamentos:** Stripe + possível Asaas para PIX
- **E-mail:** Resend
- **Criptografia:** AES-256-GCM para credenciais sensíveis

---

## Arquitetura de Agentes (n8n)

### Orquestrador (AI Agent2)
- Modelo: GPT-4.1
- System prompt fixo + variáveis customizáveis por empresa (via formulário, não prompt livre)
- Tools: Think1, Nexio_conhecimento, Nexio_objeções, Agente de Pipeline, Agente de Segmentação, Memory_long, Agente de Agendamento (condicional)
- **Agente de Inteligência Outbound: REMOVIDO** (risco ban WhatsApp)

### Sub-agentes (GPT-4.1-mini)
- **Agente de Pipeline:** movimentação do Kanban por regras determinísticas (não por IA)
- **Agente de Segmentação:** identifica nicho do lead
- **Agente de Agendamento:** Google Calendar OAuth por empresa
- **Memory expert:** consolida informações no CRM após cada interação

### Memory
- **Curto prazo:** Postgres Chat Memory (sessão da conversa)
- **Longo prazo:** Memory_long (workflow separado, resumo do lead)

### Fluxo de mensagens
1. UAZapi recebe mensagem → webhook → n8n
2. Prompt Injection Security check
3. Identifica empresa por `whatsapp_instance_name`
4. Redis buffer (30s) — agrupa mensagens rápidas
5. Verificação `agente_ativo` — se false, não processa
6. Verificação `fromMe` — ignora mensagens enviadas pelo bot
7. Roteamento por tipo (texto/áudio/imagem/PDF)
8. Orquestrador processa → resposta
9. Salva em `mensagens_do_whatsapp` + `conversas_do_whatsapp`
10. Envia resposta via UAZapi

### Chat Espelhado (envio humano)
- Humano envia pelo painel → salva em `mensagens_do_whatsapp` (sender_type: 'human')
- Webhook `nexio-uazapi` no n8n recebe → processa payload → envia via UAZapi
- URL configurada por empresa em `companies.n8n_webhook_url`

---

## UAZapi — Gestão de Instâncias

- **Um admintoken** para toda a plataforma
- Criar instância via `POST /instance/create` — automático no onboarding
- `adminField01` = `company_id` do Zapply (rastreabilidade)
- QR code exibido no painel do cliente via `GET /instance/status`
- Token da instância salvo criptografado no banco

---

## Google Calendar

- Um Google Cloud Project (Rodrigo)
- OAuth por empresa — cada cliente autoriza via painel
- Tokens (access_token + refresh_token) salvos por empresa
- Chamadas via HTTP Request no n8n com token dinâmico (não nó nativo)
- Refresh automático antes de cada uso

---

## Credenciais Dinâmicas (a implementar)

- Tabela `platform_config` ou env vars: Supabase keys, UAZapi admintoken, OpenAI key da plataforma
- Removidas dos nós hardcoded no n8n

---

## Banco — Tabelas Necessárias

Existentes (Nexio.AI atual):
- `companies`, `users`, `leads`, `conversas_do_whatsapp`, `mensagens_do_whatsapp`
- `sdr_configs`, `sdr_message_buffer`, `sdr_logs`
- `admin_users`, `system_logs`, `documents`

A adicionar/adaptar:
- `companies.agente_ativo` (boolean) — toggle SDR por empresa
- `companies.whatsapp_instance_name` — nome da instância para identificação no webhook
- `companies.n8n_webhook_url` — webhook do chat espelhado ✅ já adicionado
- `companies.image_url` — logo da empresa ✅ já adicionado
- `google_integrations` — tokens OAuth por empresa
- `follow_up_config` — dias/timing configurável por empresa/nicho
- `tokens_usage` — controle de consumo por empresa/plano

---

## Decisões de Produto

- **Outbound:** fora do produto (risco ban), uso interno admin only
- **Voz:** não implementar agora, prioridade futura
- **Kanban:** estágios fixos no lançamento, customizável na v2
- **OpenAI key:** plataforma absorve custo, cobra via limite de tokens por plano
- **Claude:** opção configurável futura (n8n suporta via HTTP Request)
- **Multi-tenant:** um admintoken UAZapi, tokens de instância por empresa
