# Plano de Implementação — Motor SDR + Follow-up AntNoshow

**Data:** 2026-04-30  
**Referências:** `Nexio - Fluxo (1).json` (227 nós), `Follow AntNoshow V2.0.json`  
**Princípio:** tradução fiel dos fluxos N8N validados. Nenhuma lógica nova.

---

## Decisões de arquitetura

### Configuração global — duas camadas

**Camada 1 — EasyPanel (variáveis de ambiente):**  
Tudo que é global da Zaapli e muda raramente.

```
SUPABASE_URL
SUPABASE_ANON_KEY
SUPABASE_ROLE_KEY
OPENAI_API_KEY
GROQ_API_KEY
UAZAPI_URL         → https://vendai.uazapi.com
REDIS_URL
```

**Motivo:** são chaves globais da plataforma, não por empresa. Supabase anon/role nunca podem estar no banco (dependência circular). Redeploy no EasyPanel é custo zero.

**Camada 2 — tabela `system_config` no Supabase (editável via admin panel):**  
Apenas `GROQ_API_KEY` e `OPENAI_API_KEY` — para rotação de chaves sem redeploy.

```ts
// Padrão de leitura em todo o código
const groqKey = await getSystemConfig('GROQ_API_KEY') ?? process.env.GROQ_API_KEY
```

**Motivo:** permite trocar a chave de transcrição (Groq) e do modelo (OpenAI) sem redeploy, via painel admin. As demais chaves nunca precisam mudar em produção.

**Camada 3 — tabela `companies` (já existe, por empresa):**  
`whatsapp_token`, `agente_ativo`, `whatsapp_instance_name`. Já implementado.

---

### GROQ_API_KEY — papel real

O GROQ **não é o modelo do SDR**. É a API usada para **transcrição de áudio** com `whisper-large-v3-turbo` via `https://api.groq.com/openai/v1/audio/transcriptions`.

O modelo do orquestrador SDR é **GPT-4.1** (confirmado no JSON, node `OpenAI Chat Model`).  
O modelo do Follow-up AntNoshow é **GPT-4.1** (confirmado no JSON, node `OpenAI Chat Model12`).

O PRD mencionava "Groq" como modelo do SDR — isso era um erro. O JSON é a fonte de verdade.

---

### Supabase anon/role no código

No N8N os fluxos usavam HTTP direto com anon/role hardcoded. No código TypeScript **não fazemos isso** — usamos o Supabase client (`createServiceClient`) que lê as chaves do `process.env` automaticamente. Nenhuma injeção dinâmica necessária.

---

## Motor 1 — SDR (modificações no `lib/sdr/engine.ts`)

### O que muda

**1. Webhook path**  
- Atual: `POST /api/sdr/webhook/[companyId]`  
- Novo: `POST /api/webhook/nexio` (principal) + `POST /api/webhook/nexio-uazapi` (chat espelhado)  
- `company_id` resolvido pelo `instanceName` via `SELECT * FROM companies WHERE whatsapp_instance_name = $instanceName`

**2. Buffer Redis — parâmetros corretos do JSON**
```
Chave fila:  {company_id}_{phone}_buffer   (RPUSH, tail=true)
Chave lock:  processing{phone}             (INCR com TTL=25s)
Espera:      30 segundos                   (não 8 como dizia o PRD)
```
Fluxo exato:
1. RPUSH → adiciona mensagem na fila
2. INCR → se retornar 1 → aguarda 30s
3. INCR → se retornar > 1 → encerrar (outra instância processa)
4. Após 30s: Switch de 15s — verifica se timestamp da última msg da fila é > 15s atrás; se não → espera mais
5. GET → busca todas as mensagens acumuladas
6. DELETE → deleta fila
7. DELETE → deleta lock `processing{phone}` *(no JSON há um bug: deleta a fila novamente. Corrigimos deletando o lock.)*

**3. Deduplicação de mensagem por ID**  
Antes de entrar na fila, verificar se o `messageId` já foi processado (usando Redis SET com TTL de 60s). Evita processar a mesma mensagem duas vezes.

**4. Prompt Injection Security — código completo do JSON**  
O nó `Prompt Injection Security1` tem código extenso com:
- Padrões críticos (confidence 0.9): override de instrução, role change, injeção de template, encoding attacks, meta-prompt
- Padrões de bloqueio (confidence 0.75): mensagem > 4000 chars, alta entropia, comandos shell
- Palavras-chave de alto risco em PT e EN
- Resultado: `{ shouldBlock: boolean, confidence: number, classification: string }`
- Se bloqueado → chama `/chat/block` na UaZapi + envia email de alerta para `rodrigoevangelista.proj@gmail.com`

**5. Tipo de mensagem — detecção por mimetype**
```
application/pdf          → PDF
image/jpeg               → Imagem
audio/ogg; codecs=opus   → Áudio
(texto)                  → Texto (fallback)
```

**6. Upload de mídias para Supabase Storage**
```
Áudio:   whatsapp-media/{company_id}/audios_leads/{lead_id}/audio_{timestamp}-{random}.webm
Imagem:  whatsapp-media/{company_id}/imagens_leads/{lead_id}/image_{timestamp}-{random}.jpg
PDF:     whatsapp-media/{company_id}/pdfs_leads/{lead_id}/pdf_{timestamp}-{random}.pdf
```
- Áudio: download base64 → converter → upload → transcrever com Groq Whisper
- Imagem: download base64 → upload → analisar com GPT-4o-mini
- PDF: download base64 → extrair texto → resumir com GPT-4o-mini

**7. Orquestrador (AI Agent2) — system prompt exato do JSON**
```
Modelo: GPT-4.1, temperature: 0.1, maxTokens: 1000, maxIterations: 30, streaming: true

Tools (ordem obrigatória):
1. Think1 — raciocínio interno
2. Play_conhecimento — vector store `documents`, filtro company_id
3. Play_objeções — vector store `documents`, filtro company_id
4. Agente de Pipeline — sub-agente
5. Agente de Segmentação — sub-agente
6. Memory_long — sub-agente de registro
7. Agente de Agendamento — condicional (intenção de agendar)

NÃO implementar: Agente de Inteligência Outbound (está no JSON mas PRD instrui remover)
```

**8. Memória de curto prazo**
```
Postgres Chat Memory
sessionKey: body.chat.phone  (número bruto, não normalizado)
contextWindowLength: 10
```

**9. Resposta dividida e enviada em partes**
- Output do orquestrador → dividir por `\n\n` em blocos
- Cada bloco enviado separadamente com wait aleatório de 3–8s entre cada um
- Antes de cada envio: simular typing (`/message/markread`)

**10. Agente de Pipeline — tools reais**
- `Buscar lead1`: SELECT em `leads` WHERE whatsapp = phone AND company_id = id
- `Atualizar resumo1`: UPDATE `leads` SET status = $estagio WHERE whatsapp + contact_name + company_id
- `Think5`: raciocínio interno

**11. Agente de Segmentação — tools reais**
- `Buscar nincho`: SELECT em `leads` WHERE whatsapp + company_id
- `Atualizar nincho`: UPDATE `leads` SET segment = $nicho WHERE whatsapp + contact_name + company_id
- `Think`: raciocínio interno

**12. Memory_long (Memory expert) — sub-agente direto**
- No N8N era um `toolWorkflow` chamando outro workflow. No código: função TypeScript direta.
- System prompt: Agente de Registro
- Tools: `Think4`, `Buscar lead` (SELECT), `Atualizar resumo` (UPDATE priority + resumo_ia + nivel_interesse + segment)
- `Atualizar resumo` filtra por whatsapp + contact_name + company_id

**13. Agente de Agendamento**
- Acionado condicionalmente quando lead demonstra intenção de agendar/remarcar/cancelar
- Modelo: GPT-4.1-mini
- Tools: `Hora atual`, `Buscar reunião`, `Consultar` (Google Calendar), `Agendar` (Google Calendar + Meet), `Reunião marcada`
- `Reunião marcada`: UPDATE `leads` SET call_de_venda=true, call_agendada_para, call_status='agendada', meet_url
- Calendário: `1980893a19a39d59410218c334e07ad59e530f8e0e64c1d583e9cc548e98fac7@group.calendar.google.com` (Nexio.AI)

**14. Verificação conversa antes de inserir mensagem**
Para cada tipo de mídia há um fluxo próprio:
1. `Campos exatos - Mensagem final` — monta objeto com id_do_lead, company_id, tipo, direção
2. `Checar se a conversa existe` — GET em `conversas_do_whatsapp` por id_do_lead + company_id
3. `Normalizar` — mapeia resultado: `{ existe: boolean, id_da_conversacao }`
4. Se não existe → criar conversa com status_da_conversa='aberto', contagem_nao_lida=1
5. Inserir em `mensagens_do_whatsapp` com id_da_conversacao, tipo, direção, sender_type

---

## Motor 2 — Follow-up AntNoshow (novo arquivo `lib/sdr/follow-antnoshow.ts`)

### O que é

Fluxo completamente separado do `follow.ts` existente (que cuida do `follow_geral`). O AntNoshow dispara lembretes pré-call para leads com reunião agendada.

### Trigger

Cron job a cada 15 minutos. Verificação de horário comercial **via SQL** (como no JSON):
```sql
SELECT
  EXTRACT(HOUR FROM NOW() AT TIME ZONE 'America/Sao_Paulo') as hora,
  EXTRACT(DOW FROM NOW() AT TIME ZONE 'America/Sao_Paulo') as dia_semana,
  CASE
    WHEN DOW BETWEEN 1 AND 5 AND HOUR BETWEEN 9 AND 17 THEN true
    WHEN DOW = 6 AND HOUR BETWEEN 9 AND 12 THEN true
    ELSE false
  END as horario_ok
```

### Fluxo exato do JSON

```
1. Verificar horário → horario_ok?
2. Buscar leads: call_de_venda=true AND call_status='agendada' AND call_agendada_para IS NOT NULL
3. Para cada lead: calcular janela de tempo
4. Checar se já disparou (follow_logs)
5. Rate limit: máximo 30 disparos por hora (contador em memória por execução)
6. Delay anti-ban: random(45, 135) segundos
7. AI Agent1 → gera mensagem personalizada
8. Formatação de texto: capitaliza início de cada frase
9. Registrar em follow_logs (lead_id, momento, company_id)
10. Buscar token UaZapi da empresa
11. Simular typing: random(2, 5) segundos
12. Enviar mensagem via UaZapi
13. Buscar/criar conversa em conversas_do_whatsapp
14. Inserir em mensagens_do_whatsapp (outbound)
```

### Janelas de disparo

```js
const statusBloqueados = ['nao_interessado','descadastrado','perdido','bloqueado',
                          'Perdido','Não Interessado','no_show','cancelada','realizada']

if (diffHoras >= 23 && diffHoras <= 25)       tipoFollow = '24h_antes'
else if (diffHoras >= 1.5 && diffHoras <= 2.5) tipoFollow = '2h_antes'
else if (diffMin >= 10 && diffMin <= 20)        tipoFollow = '15min_antes'
else if (diffMin >= -10 && diffMin <= -2)       tipoFollow = '5min_apos'
else continue  // fora de janela
```

### Deduplicação

```sql
SELECT id FROM follow_logs WHERE lead_id = $id AND momento = $momento LIMIT 1
```
Se existe → pular lead.

### Agente Follow-up (AI Agent1)

```
Modelo: GPT-4.1, temperature: 0.1, maxTokens: 1000, maxIterations: 30

Tools:
- Buscar Dados Reunião: SELECT em leads WHERE id = lead_id
- Buscar Memory_Long: SELECT em leads WHERE id = lead_id (resumo_ia)
- Abordagem Noshow: função JS que sorteia do pool de 50 templates
- Think14: raciocínio interno
- Buscar Mensagem1: SELECT em mensagens_do_whatsapp WHERE id_do_lead + company_id LIMIT 1
- Criar Chat Mensagem 2: INSERT em conversas_do_whatsapp (só se Buscar Mensagem1 retornar vazio)
```

### Formatação de texto pós-IA

```js
// Capitaliza início de cada frase
output.split(/([.!?]\s+)/)
  .map((parte, index) => index % 2 === 0 ? parte.charAt(0).toUpperCase() + parte.slice(1) : parte)
  .join('')
```

### Pool de 50 templates

- `24h_antes`: ids 1–15 (sem link)
- `2h_antes`: ids 16–30 (sem link)
- `15min_antes`: ids 31–40 (com meet_url)
- `5min_apos`: ids 41–50 (com meet_url)

Substituições: `[Nome]` → contact_name, `[link]` → meet_url, `[segmento]` → segment

---

## Tabelas e migrations necessárias

### `system_config` (nova)

```sql
CREATE TABLE system_config (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
-- Apenas super_admin acessa
```

### `follow_logs` (verificar se existe)

```sql
CREATE TABLE IF NOT EXISTS follow_logs (
  id         BIGSERIAL PRIMARY KEY,
  lead_id    BIGINT NOT NULL REFERENCES leads(id),
  momento    TEXT NOT NULL,  -- '24h_antes' | '2h_antes' | '15min_antes' | '5min_apos'
  company_id INT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(lead_id, momento)   -- garante deduplicação no banco também
);
```

---

## Arquivos a criar/modificar

| Arquivo | Ação |
|---|---|
| `lib/sdr/engine.ts` | Modificar — buffer Redis correto (30s), deduplicação, prompt injection completo, tipos de mídia com storage, resposta dividida |
| `lib/sdr/follow-antnoshow.ts` | Criar — Motor 2 completo |
| `lib/sdr/system-config.ts` | Criar — helper `getSystemConfig(key)` |
| `app/api/webhook/nexio/route.ts` | Criar — webhook principal (substitui `/api/sdr/webhook/[companyId]`) |
| `app/api/webhook/nexio-uazapi/route.ts` | Criar — chat espelhado |
| `app/api/cron/antnoshow/route.ts` | Criar — cron do follow-up AntNoshow |
| `app/admin/configuracoes/route.ts` | Modificar — adicionar campo GROQ_API_KEY e OPENAI_API_KEY |
| `supabase/migrations/YYYYMMDD_system_config.sql` | Criar — tabela system_config |
| `supabase/migrations/YYYYMMDD_follow_logs.sql` | Criar — tabela follow_logs (se não existir) |

---

## O que NÃO implementar

- Agente de Inteligência Outbound (está no JSON mas PRD instrui remover — módulo outbound separado)
- `Deletar memoria1` com session_id hardcoded (lixo de teste)
- `Configuração global` com chaves hardcoded (substituído por env vars + system_config)
- Módulo Apify / extração Google Maps (outbound, fora do escopo)
- Módulo de formulário / briefing (já existe separado)
- MiniMax Text to Speech (disabled no JSON)

---

## Notas de campo

- **`Atualizar resumo1`** filtra por `whatsapp + contact_name + company_id` e atualiza só `status` (estágio do pipeline)
- **`Atualizar resumo`** filtra por `whatsapp + contact_name + company_id` e atualiza `priority + resumo_ia + nivel_interesse + segment`
- **`Atualizar nincho`** filtra por `whatsapp + contact_name + company_id` e atualiza só `segment`
- **Calendário Google** hardcoded no JSON: `1980893a19a39d59410218c334e07ad59e530f8e0e64c1d583e9cc548e98fac7@group.calendar.google.com` — mover para `companies` ou `system_config` futuramente
- **`Buscar conversa`** no follow-up: busca por `id_do_lead + company_id` em `mensagens_do_whatsapp` (não em `conversas_do_whatsapp`)
- **`Criar Chat Mensagem 2`** (follow-up): INSERT em `conversas_do_whatsapp` com campos: id_do_lead, company_id, numero_de_telefone, nome_do_contato, contagem_nao_lida=1, status_da_conversa='aberto'
