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
{ "name": "minha-instancia", "systemName": "zapply", "adminField01": "company_id", "adminField02": "plan" }
```
Retorna `token` único — guardar no banco imediatamente.
Estados: `disconnected` | `connecting` | `connected`

---

### GET /instance/all
Lista todas as instâncias. Requer `admintoken`.

---

### POST /instance/connect
Inicia conexão. Sem `phone` → gera QR code. Com `phone` → gera paircode.

```json
{ "phone": "5511999999999" }
```
Timeout: 2min QR | 5min paircode. Monitorar via `/instance/status`.

---

### GET /instance/status
Retorna status atual + QR code atualizado (se connecting).
Estados: `disconnected` | `connecting` | `connected`

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
{ "id": "inst_123", "adminField01": "company_id_456" }
```

---

### POST /instance/updateDelaySettings
Delay entre mensagens diretas (anti-ban).
```json
{ "msg_delay_min": 1, "msg_delay_max": 3 }
```

---

### GET /instance/wa_messages_limits
Verifica restrições da conta para iniciar novas conversas. Útil para diagnosticar ban.

---

### GET /instance/privacy
### POST /instance/privacy
Configurações de privacidade: `groupadd`, `last`, `status`, `profile`, `readreceipts`, `online`, `calladd`
Valores: `all` | `contacts` | `contact_blacklist` | `none`

---

### POST /instance/presence
```json
{ "presence": "available" }
```
Valores: `available` | `unavailable`

---

## Webhook

### GET /webhook
Retorna webhooks configurados na instância (array).

### POST /webhook
Modo simples (recomendado):
```json
{
  "url": "https://n8n.exemplo.com/webhook/nexio",
  "events": ["messages", "connection"],
  "excludeMessages": ["wasSentByApi"]
}
```
**IMPORTANTE:** sempre usar `excludeMessages: ["wasSentByApi"]` para evitar loop.

Eventos disponíveis: `connection`, `history`, `messages`, `messages_update`, `call`, `contacts`, `presence`, `groups`, `labels`, `chats`, `chat_labels`, `blocks`, `sender`

Filtros excludeMessages: `wasSentByApi`, `wasNotSentByApi`, `fromMeYes`, `fromMeNo`, `isGroupYes`, `isGroupNo`

### GET /webhook/errors
Últimos 20 erros de entrega (em memória).

---

## Webhook Global (admintoken)

### GET /globalwebhook
### POST /globalwebhook
Recebe eventos de TODAS as instâncias.
```json
{
  "url": "https://n8n.exemplo.com/webhook/global",
  "events": ["messages", "connection"],
  "excludeMessages": ["wasSentByApi"]
}
```

### GET /globalwebhook/errors
Últimos 20 erros globais.

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
Ou base64. Ou `"remove"` para deletar.

---

## Business

### POST /business/get/profile
```json
{ "jid": "5511999999999@s.whatsapp.net" }
```

---

## Admin

### POST /admin/restart
Reinicia toda a aplicação. Usar apenas em instabilidades gerais.

---

## SSE (Server-Sent Events)

### GET /sse
Conexão persistente para eventos em tempo real. Alternativa ao webhook.

---

## Notas Importantes

1. **adminField01/adminField02** — usar para vincular instância ao `company_id` do Zapply
2. **Loop prevention** — sempre `excludeMessages: ["wasSentByApi"]` no webhook
3. **Token** — gerado na criação da instância, necessário para todas operações
4. **Auto-delete** — instâncias novas são deletadas após 1h se não conectadas
5. **Histórico** — mensagens dos últimos 7 dias são armazenadas, mais antigas deletadas à meia-noite
