# UAZapi GO V2 — Documentação de Referência

Base URL: `https://{subdomain}.uazapi.com`
Exemplo: `https://nexioai.uazapi.com`

---

## Autenticação

- **admintoken** — header para endpoints administrativos (criar/listar/deletar instâncias, webhook global)
- **token** — header da instância para operações de envio, webhook, perfil, etc.

---

## Instâncias

### POST /instance/create
Cria nova instância. Requer `admintoken`.

```json
{ "name": "minha-instancia", "systemName": "zaapli", "adminField01": "company_id", "adminField02": "plan" }
```
Retorna `token` único — guardar no banco imediatamente.
Estados: `disconnected` | `connecting` | `connected`

Campos `adminField01`/`adminField02` são opcionais para metadados personalizados. Visíveis ao dono via token, editáveis apenas pelo admin.

Resposta inclui `instance.id`, `instance.token`, `instance.status`, `instance.qrcode`, `instance.paircode`, `instance.name`, `instance.profileName`, `instance.profilePicUrl`.

---

### GET /instance/all
Lista todas as instâncias. Requer `admintoken`. Retorna array com status, datas, perfil, metadados de cada instância.

---

### POST /instance/connect
Inicia conexão. Sem `phone` → gera QR code. Com `phone` → gera paircode.

```json
{ "phone": "5511999999999" }
```
Timeout: 2min QR | 5min paircode. Monitorar via `/instance/status`.

**Histórico:** Mensagens dos últimos 7 dias sincronizadas no evento `history` do webhook e acessíveis via `POST /message/find` e `POST /chat/find`.

---

### GET /instance/status
Retorna status atual + QR code atualizado (se connecting).

Resposta:
```json
{
  "instance": { "status": "connected", "qrcode": "...", "paircode": "...", "name": "..." },
  "status": { "connected": true, "loggedIn": true, "jid": "5511999@s.whatsapp.net" }
}
```
**IMPORTANTE:** `instance.status` é a string de status. `status` (raiz) é um objeto, não string.

---

### POST /instance/disconnect
Encerra sessão. Exige novo QR para reconectar.

---

### POST /instance/reset
Reset controlado do runtime. Útil quando sessão trava sem apagar a instância.

---

### DELETE /instance
Remove instância permanentemente. Requer `token` da instância.

---

### POST /instance/updateInstanceName
```json
{ "name": "Novo Nome" }
```

---

### POST /instance/updateAdminFields
Requer `admintoken`. Atualiza metadados.
```json
{ "id": "inst_123", "adminField01": "company_id_456", "adminField02": "plan_pro" }
```

---

### POST /instance/updateDelaySettings
Delay entre mensagens diretas (anti-ban).
```json
{ "msg_delay_min": 1, "msg_delay_max": 3 }
```
- `msg_delay_min`: 0 = sem delay
- `msg_delay_max`: se menor que min, ajustado para min
- Aplica apenas para mensagens diretas (não campanhas)

---

### GET /instance/wa_messages_limits
Verifica restrições da conta para iniciar novas conversas. Útil para diagnosticar ban (provider_code 463).

Retorna `new_chat_message_capping` e `reachout_timelock`.

---

### GET /instance/privacy
### POST /instance/privacy
Configurações de privacidade: `groupadd`, `last`, `status`, `profile`, `readreceipts`, `online`, `calladd`

Valores: `all` | `contacts` | `contact_blacklist` | `none`
- `online`: `all` | `match_last_seen`
- `calladd`: `all` | `known`

---

### POST /instance/presence
```json
{ "presence": "available" }
```
Valores: `available` | `unavailable`

⚠️ Com `unavailable`: confirmações de entrega/leitura podem não funcionar se for o único dispositivo ativo.

---

## Webhook

### GET /webhook
Retorna webhooks configurados na instância (array).

### POST /webhook
Modo simples (recomendado):
```json
{
  "url": "https://meusite.com/webhook",
  "events": ["messages", "connection"],
  "excludeMessages": ["wasSentByApi"]
}
```
**IMPORTANTE:** sempre usar `excludeMessages: ["wasSentByApi"]` para evitar loop.

Modo avançado (múltiplos webhooks): usar `action: "add"` | `"update"` | `"delete"` com campo `id`.

Eventos disponíveis: `connection`, `history`, `messages`, `messages_update`, `call`, `contacts`, `presence`, `groups`, `labels`, `chats`, `chat_labels`, `blocks`, `sender`, `newsletter_messages`

Filtros excludeMessages: `wasSentByApi`, `wasNotSentByApi`, `fromMeYes`, `fromMeNo`, `isGroupYes`, `isGroupNo`

Parâmetros opcionais:
- `addUrlEvents: true` → adiciona evento na URL: `/webhook/message`
- `addUrlTypesMessages: true` → adiciona tipo: `/webhook/message/conversation`

### GET /webhook/errors
Últimos 20 erros de entrega (em memória). Inclui url, evento, status HTTP, tentativas, payload.

---

## Webhook Global (admintoken)

### GET /globalwebhook
### POST /globalwebhook
Recebe eventos de TODAS as instâncias.
```json
{
  "url": "https://meusite.com/webhook/global",
  "events": ["messages", "connection"],
  "excludeMessages": ["wasSentByApi"]
}
```

### GET /globalwebhook/errors
Últimos 20 erros globais (admintoken).

---

## Perfil

### POST /profile/name
```json
{ "name": "Empresa - Atendimento" }
```

### POST /profile/image
```json
{ "image": "https://url-da-imagem.jpg" }
```
Ou base64. Ou `"remove"` / `"delete"` para deletar. Formato JPEG 640x640.

---

## Business

### POST /business/get/profile
```json
{ "jid": "5511999999999@s.whatsapp.net" }
```
Retorna `description`, `address`, `email`, `websites`, `categories`.

---

## Chamadas

### POST /call/make
```json
{ "number": "5511999999999", "call_duration": 15 }
```
Inicia chamada de voz. `call_duration`: segundos até encerrar automaticamente.

### POST /call/reject
Rejeita chamada recebida.

---

## Admin

### POST /admin/restart
Reinicia toda a aplicação. Usar apenas em instabilidades gerais.

---

## SSE (Server-Sent Events)

### GET /sse
Conexão persistente para eventos em tempo real. Alternativa ao webhook.
Eventos: `connection`, `history`, `messages`, `messages_update`, `call`, `contacts`, `presence`, `groups`, `labels`, `chats`, `chat_labels`, `blocks`

---

## Mensagens (PENDENTE — documentação truncada)

> Endpoints a documentar: POST /send/text, POST /send/media, POST /send/reaction,
> POST /message/find, POST /message/markread, POST /message/download,
> POST /message/delete, POST /message/presence

---

## Chats (PENDENTE — documentação truncada)

> Endpoints a documentar: POST /chat/find, POST /chat/archive, POST /chat/block

---

## Grupos (PENDENTE — documentação truncada)

> Endpoints a documentar: POST /group/create, GET /group/list, POST /group/sendtext, etc.

---

## Notas Importantes

1. **instance.status** — string de status está em `raw.instance.status`, não em `raw.status` (que é objeto)
2. **adminField01/adminField02** — usar para vincular instância ao `company_id` do Zaapli
3. **Loop prevention** — sempre `excludeMessages: ["wasSentByApi"]` no webhook
4. **Token** — gerado na criação da instância, necessário para todas operações
5. **Auto-delete** — instâncias novas são deletadas após 1h se não conectadas
6. **Histórico** — mensagens dos últimos 7 dias armazenadas, acessíveis via `/message/find` e `/chat/find`
7. **Delay** — configurar `msg_delay_min/max` via `/instance/updateDelaySettings` para anti-ban
