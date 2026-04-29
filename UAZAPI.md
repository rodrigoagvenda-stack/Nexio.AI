# UAZapi GO V2 — Documentação de Referência Completa

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
{ "name": "zaapli-empresa-2", "systemName": "zaapli", "adminField01": "company_id", "adminField02": "plan" }
```
Retorna `token` único — guardar no banco imediatamente.
Estados: `disconnected` | `connecting` | `connected`
Instâncias novas são deletadas após 1h se não conectadas.

### GET /instance/all
Lista todas as instâncias. Requer `admintoken`.

### POST /instance/connect
```json
{ "phone": "5511999999999" }
```
Sem `phone` → QR code. Com `phone` → paircode.
Timeout: 2min QR | 5min paircode. Monitorar via `/instance/status`.
Mensagens dos últimos 7 dias acessíveis via `POST /message/find` e `POST /chat/find`.

### GET /instance/status
Retorna status + QR code atualizado.
```json
{
  "instance": { "status": "connected", "qrcode": "base64...", "paircode": "1234-5678", "name": "..." },
  "status": { "connected": true, "loggedIn": true, "jid": "5511999@s.whatsapp.net" }
}
```
**CRÍTICO:** `instance.status` é a string correta. `raw.status` raiz é objeto, NÃO string.

### POST /instance/disconnect
Encerra sessão. Exige novo QR para reconectar.

### POST /instance/reset
Reset controlado do runtime. Útil quando sessão trava.

### DELETE /instance
Remove instância permanentemente. Requer `token`.

### POST /instance/updateInstanceName
```json
{ "name": "Novo Nome" }
```

### POST /instance/updateAdminFields
Requer `admintoken`.
```json
{ "id": "inst_123", "adminField01": "company_id_456", "adminField02": "plan_pro" }
```

### POST /instance/updateDelaySettings
```json
{ "msg_delay_min": 1, "msg_delay_max": 3 }
```
Aplica apenas para mensagens diretas (não campanhas). Min 0 = sem delay.

### GET /instance/wa_messages_limits
Diagnóstico de ban/restrição de novas conversas (provider_code 463).

### GET /instance/privacy
### POST /instance/privacy
```json
{ "groupadd": "contacts", "last": "none", "profile": "all", "readreceipts": "all", "online": "all", "calladd": "all" }
```
Valores: `all` | `contacts` | `contact_blacklist` | `none`

### POST /instance/presence
```json
{ "presence": "available" }
```
Valores: `available` | `unavailable`

---

## Mensagens — Envio

### POST /send/text
```json
{ "number": "5511999999999", "text": "Olá!", "delay": 1000, "replyid": "3EB0...", "readchat": true }
```
Campos opcionais: `delay`, `readchat`, `readmessages`, `replyid`, `mentions`, `forward`, `linkPreview`, `async`

### POST /send/media
```json
{ "number": "5511999999999", "type": "image", "file": "https://url.jpg", "text": "Legenda" }
```
Tipos: `image` | `video` | `videoplay` | `document` | `audio` | `myaudio` | `ptt` | `ptv` | `sticker`
Campos extras: `docName` (documentos), `thumbnail`, `mimetype`, `viewOnce`

### POST /send/location
```json
{ "number": "5511999999999", "name": "MASP", "address": "Av. Paulista...", "latitude": -23.56, "longitude": -46.65 }
```

### POST /send/status
Envia story/status. Tipos: `text` | `image` | `video` | `audio` | `ptt`
```json
{ "type": "text", "text": "Novidades!", "background_color": 7, "font": 1 }
```

### POST /send/menu
Botões, listas, enquetes ou carrossel.
```json
{ "number": "5511999999999", "type": "button|list|poll|carousel", "text": "Escolha:", "choices": [...] }
```
- Botão: `"Texto|id"` ou `"Texto|https://url"` ou `"Texto|call:+55..."`
- Lista: `"[Seção]"` + `"Item|id|descrição"`
- Enquete: array simples + `"selectableCount": 1`

### POST /send/carousel
```json
{ "number": "5511999999999", "text": "Produtos", "carousel": [{ "text": "Item", "image": "url", "buttons": [...] }] }
```
Tipos de botão: `REPLY` | `URL` | `COPY` | `CALL`

### POST /send/location-button
Solicita localização do usuário.
```json
{ "number": "5511999999999", "text": "Compartilhe sua localização" }
```

### POST /send/request-payment
Solicitação de pagamento (PIX, boleto, link).
```json
{ "number": "5511999999999", "amount": 199.90, "pixKey": "uuid...", "pixType": "EVP" }
```

### POST /send/pix-button
```json
{ "number": "5511999999999", "pixType": "EVP", "pixKey": "uuid...", "pixName": "Loja" }
```

---

## Mensagens — Gestão

### POST /message/presence
```json
{ "number": "5511999999999", "presence": "composing", "delay": 30000 }
```
Tipos: `composing` | `recording` | `paused`. Max 5 min (300000ms).

### POST /message/download
```json
{ "id": "7EB0...", "return_base64": false, "generate_mp3": true, "return_link": true, "transcribe": false }
```
Mídias mantidas 2 dias no storage. `transcribe: true` requer `openai_apikey`.

### POST /message/find
Busca mensagens com filtros. Mensagens dos últimos 7 dias.
```json
{ "chatid": "5511999999999@s.whatsapp.net", "limit": 50, "offset": 0 }
```
Retorna: `{ returnedMessages, messages[], limit, offset, nextOffset, hasMore }`

### POST /message/markread
```json
{ "id": ["62AD1AD844E518180227BF68DA7ED710", "ECB9DE48EB41F77BFA8491BFA8D6EF9B"] }
```

### POST /message/react
```json
{ "number": "5511999999999@s.whatsapp.net", "text": "👍", "id": "3EB0538DA65A59F6D8A251" }
```
`text: ""` remove a reação.

### POST /message/delete
Apaga mensagem para todos.
```json
{ "id": "3EB0538DA65A59F6D8A251" }
```

### POST /message/edit
```json
{ "id": "3A12345678...", "text": "Texto editado" }
```

### POST /message/pin
```json
{ "id": "3A12345678...", "pin": true, "duration": 7 }
```
`duration`: 1, 7 ou 30 dias. `pin: false` desafixa.

---

## Chats

### POST /chat/find
Busca chats armazenados (últimos 7 dias após conexão).

### POST /chat/details
Retorna informações completas do chat (60+ campos: WhatsApp, lead/CRM, grupo, chatbot).
```json
{ "number": "5511999999999", "preview": false }
```

### POST /chat/delete
```json
{ "number": "5511999999999", "deleteChatDB": true, "deleteMessagesDB": true, "clearChatWhatsApp": true }
```

### POST /chat/archive
```json
{ "number": "5511999999999", "archive": true }
```

### POST /chat/check
Verifica se números estão no WhatsApp.
```json
{ "numbers": ["5511999999999", "123456789@g.us"] }
```

### POST /chat/block
```json
{ "number": "5511999999999", "block": true }
```

### GET /chat/blocklist
Lista contatos bloqueados.

### POST /chat/labels
```json
{ "number": "5511999999999", "labelids": ["10", "20"] }
```
Ou `add_labelid` / `remove_labelid` para operação individual.

---

## Contatos

### GET /contacts
Lista contatos. Query: `?contactScope=address_book|outside_address_book|all`

### POST /contacts/list
Lista paginada.
```json
{ "limit": 100, "offset": 0, "contactScope": "address_book" }
```

### POST /contact/add
```json
{ "number": "5511999999999", "name": "João Silva" }
```

### POST /contact/remove
```json
{ "number": "5511999999999" }
```

---

## Grupos

### POST /group/create
```json
{ "name": "Nome do Grupo", "participants": ["5511999999999", "5521888888888"] }
```

### POST /group/info
```json
{ "groupjid": "120363...@g.us", "getInviteLink": true }
```

### POST /group/inviteInfo
```json
{ "invitecode": "https://chat.whatsapp.com/AbCdEf..." }
```

### POST /group/join
```json
{ "invitecode": "https://chat.whatsapp.com/AbCdEf..." }
```

### POST /group/leave
```json
{ "groupjid": "120363...@g.us" }
```

### GET /group/list
Query: `?force=false&noparticipants=false`

### POST /group/list
```json
{ "limit": 50, "offset": 0, "search": "nome", "noParticipants": false }
```

### POST /group/resetInviteCode
```json
{ "groupjid": "120363...@g.us" }
```

### POST /group/updateAnnounce
```json
{ "groupjid": "120363...@g.us", "announce": true }
```
`true` = somente admins enviam mensagens.

### POST /group/updateDescription
```json
{ "groupjid": "120363...@g.us", "description": "Descrição do grupo" }
```

### POST /group/updateImage
```json
{ "groupjid": "120363...@g.us", "image": "https://url.jpg" }
```
`"remove"` para deletar. JPEG 640x640.

### POST /group/updateLocked
```json
{ "groupjid": "120363...@g.us", "locked": true }
```
`true` = somente admins editam info do grupo.

### POST /group/updateName
```json
{ "groupjid": "120363...@g.us", "name": "Novo Nome" }
```

### POST /group/updateParticipants
```json
{ "groupjid": "120363...@g.us", "action": "add", "participants": ["5511999999999"] }
```
Actions: `add` | `remove` | `promote` | `demote` | `approve` | `reject`

---

## Comunidades

### POST /community/create
```json
{ "name": "Nome da Comunidade" }
```

### POST /community/editgroups
```json
{ "community": "120363...@g.us", "action": "add", "groupjids": ["120363...@g.us"] }
```

---

## Etiquetas (Labels)

### GET /labels
Lista todas as etiquetas.

### POST /labels/refresh
```json
{ "force": false }
```

### POST /label/edit
Criar: `{ "labelid": "new", "name": "VIP", "color": 2, "delete": false }`
Editar: `{ "labelid": "25", "name": "Novo nome" }`
Deletar: `{ "labelid": "25", "delete": true }`

---

## Respostas Rápidas

### GET /quickreply/showall
Lista todas as respostas rápidas da instância.

### POST /quickreply/edit
Criar: omitir `id`. Editar: incluir `id`. Deletar: `delete: true` + `id`.
```json
{ "shortCut": "saudacao", "type": "text", "text": "Olá! Como posso ajudar?" }
```

---

## Chamadas

### POST /call/make
```json
{ "number": "5511999999999", "call_duration": 15 }
```
Nota: apenas toca, não estabelece comunicação de voz real.

### POST /call/reject
`{}`

---

## Webhook

### GET /webhook
Retorna webhooks da instância (array).

### POST /webhook
Modo simples (recomendado):
```json
{
  "url": "https://meusite.com/webhook",
  "events": ["messages", "connection"],
  "excludeMessages": ["wasSentByApi"]
}
```
**SEMPRE usar `excludeMessages: ["wasSentByApi"]` para evitar loop.**

Eventos: `connection`, `history`, `messages`, `messages_update`, `call`, `contacts`, `presence`, `groups`, `labels`, `chats`, `chat_labels`, `blocks`, `sender`, `newsletter_messages`

Filtros excludeMessages: `wasSentByApi`, `wasNotSentByApi`, `fromMeYes`, `fromMeNo`, `isGroupYes`, `isGroupNo`

### GET /webhook/errors
Últimos 20 erros de entrega (em memória).

---

## Webhook Global (admintoken)

### GET /globalwebhook
### POST /globalwebhook
```json
{ "url": "https://meusite.com/webhook/global", "events": ["messages", "connection"], "excludeMessages": ["wasSentByApi"] }
```

### GET /globalwebhook/errors

---

## Perfil

### POST /profile/name
```json
{ "name": "Empresa - Atendimento" }
```

### POST /profile/image
```json
{ "image": "https://url.jpg" }
```
Ou base64. `"remove"` para deletar. JPEG 640x640.

---

## Business

### POST /business/get/profile
```json
{ "jid": "5511999999999@s.whatsapp.net" }
```

---

## SSE (Server-Sent Events)

### GET /sse
```
/sse?token=TOKEN&events=chats,messages&excludeMessages=poll,reaction
```
Alternativa ao webhook para eventos em tempo real.

---

## Admin

### POST /admin/restart
Reinicia toda a aplicação. Usar apenas em instabilidades gerais.

---

## Notas Críticas de Implementação

1. **`instance.status`** — string de status real está em `raw.instance.status`. `raw.status` raiz é objeto `{ connected, loggedIn, jid }`, NÃO string.
2. **QR code** → `raw.instance.qrcode`
3. **Phone/JID** → `raw.status.jid` ou `raw.jid`
4. **Loop prevention** — sempre `excludeMessages: ["wasSentByApi"]`
5. **Token** — gerado na criação, necessário para todas operações
6. **Auto-delete** — instâncias deletadas após 1h sem conectar
7. **Histórico** — 7 dias armazenados, acessíveis via `/message/find` e `/chat/find`
8. **Delay anti-ban** — configurar via `/instance/updateDelaySettings`
9. **Reação** — `POST /message/react` com `{ number: "jid@s.whatsapp.net", text: "emoji", id: "msgId" }`
10. **Arquivar** — `POST /chat/archive` com `{ number, archive: true }`
11. **Deletar msg** — `POST /message/delete` com `{ id }` (apaga para todos)
12. **Grupos** — JID formato `120363...@g.us`
