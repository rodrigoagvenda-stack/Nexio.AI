# 🤖 Configuração n8n - Automações WhatsApp

Guia completo para configurar as 3 automações principais do sistema.

## 📋 Pré-requisitos

- n8n instalado e rodando na VPS
- WhatsApp Business API (UAZapi, Evolution API, ou similar)
- Webhooks configurados no sistema

## 🔗 URLs dos Webhooks

Configure estas URLs no n8n:

1. **Confirmação de Escalas**: `https://n8n.seudominio.com/webhook/escala-confirmacao`
2. **Envio de PDF**: `https://n8n.seudominio.com/webhook/enviar-pdf`
3. **Notificações Financeiras**: `https://n8n.seudominio.com/webhook/notificacoes`

## 🔐 Autenticação

Todas as chamadas do sistema → n8n incluem:

```
Authorization: Bearer SEU_N8N_WEBHOOK_SECRET
```

Configure o secret no `.env`:

```bash
N8N_WEBHOOK_SECRET=gerar_string_aleatoria_aqui
```

## 1️⃣ AUTOMAÇÃO 1: Confirmação de Escalas

### Fluxo Completo

```
Sistema → n8n → WhatsApp → Aguarda Resposta → Sistema
```

### Nodes do Workflow

#### 1. Webhook (Trigger)

```json
{
  "httpMethod": "POST",
  "path": "escala-confirmacao",
  "authentication": "headerAuth",
  "responseMode": "lastNode"
}
```

**Input esperado:**

```json
{
  "escala_id": "uuid",
  "mes_ano": "Janeiro 2026",
  "igreja_id": "uuid",
  "escalados": [
    {
      "membro_id": "uuid",
      "nome": "Pastor Márcio",
      "telefone": "5573999999999",
      "funcao": "Louvor",
      "data": "2026-01-15",
      "horario": "19:00"
    }
  ]
}
```

#### 2. Loop sobre escalados

```javascript
// Code Node
const escalados = $input.all()[0].json.escalados;
return escalados.map(e => ({ json: e }));
```

#### 3. Formatar Mensagem WhatsApp

```javascript
// Code Node
const { nome, funcao, data, horario } = $input.item.json;

const dataFormatada = new Date(data).toLocaleDateString('pt-BR', {
  weekday: 'long',
  year: 'numeric',
  month: 'long',
  day: 'numeric'
});

const mensagem = `🙏 Olá, ${nome}!

Você foi escalado(a) para:
📅 *${dataFormatada}*
⏰ *${horario}*
🎵 *Função:* ${funcao}

Por favor, confirme sua presença respondendo:
✅ *SIM* - Confirmo presença
❌ *NÃO* - Não posso comparecer

_Sistema de Gestão - Igreja_`;

return {
  json: {
    telefone: $input.item.json.telefone,
    mensagem,
    membro_id: $input.item.json.membro_id,
    funcao: $input.item.json.funcao
  }
};
```

#### 4. Enviar WhatsApp (HTTP Request)

```json
{
  "method": "POST",
  "url": "={{$env.WHATSAPP_API_URL}}/send-message",
  "authentication": "genericCredentialType",
  "headers": {
    "Content-Type": "application/json",
    "Authorization": "Bearer {{$env.WHATSAPP_API_TOKEN}}"
  },
  "body": {
    "phone": "={{$json.telefone}}",
    "message": "={{$json.mensagem}}"
  }
}
```

#### 5. Aguardar Resposta (Wait for Webhook)

```json
{
  "path": "resposta-escala",
  "timeout": 86400,
  "resumeOnMatch": "phone"
}
```

**Webhook de resposta recebe:**

```json
{
  "phone": "5573999999999",
  "message": "SIM",
  "timestamp": "2026-01-10T10:30:00Z"
}
```

#### 6. Processar Resposta

```javascript
// Code Node
const resposta = $input.item.json.message.toUpperCase();
const membro_id = $input.first().json.membro_id;
const funcao = $input.first().json.funcao;

let status = 'pendente';

if (resposta.includes('SIM') || resposta.includes('CONFIRMO')) {
  status = 'confirmado';
} else if (resposta.includes('NÃO') || resposta.includes('NAO')) {
  status = 'recusado';
}

return {
  json: {
    membro_id,
    funcao,
    status,
    data_resposta: new Date().toISOString()
  }
};
```

#### 7. Enviar ao Sistema (HTTP Request)

```json
{
  "method": "POST",
  "url": "https://igreja.seudominio.com/api/webhooks/n8n/escala-confirmacao",
  "headers": {
    "Content-Type": "application/json",
    "Authorization": "Bearer {{$env.N8N_WEBHOOK_SECRET}}"
  },
  "body": "={{$json}}"
}
```

#### 8. Confirmar ao Usuário

```javascript
// Code Node - Se confirmado
const status = $input.item.json.status;
const telefone = $input.item.json.telefone;

let mensagem = '';

if (status === 'confirmado') {
  mensagem = '✅ *Presença confirmada!*\n\nObrigado! Te esperamos no culto. 🙏';
} else if (status === 'recusado') {
  mensagem = '❌ *Confirmado*\n\nObrigado por avisar! Vamos escalar outra pessoa.';
}

return {
  json: {
    telefone,
    mensagem
  }
};
```

## 2️⃣ AUTOMAÇÃO 2: Envio de PDF no Grupo

### Nodes do Workflow

#### 1. Webhook (Trigger)

```json
{
  "httpMethod": "POST",
  "path": "enviar-pdf",
  "authentication": "headerAuth"
}
```

**Input:**

```json
{
  "event": "escala_gerada",
  "escala_id": "uuid",
  "pdf_url": "https://igreja.seudominio.com/storage/escalas/escala_123.pdf",
  "igreja": "Sede",
  "periodo": "Janeiro 2026",
  "grupos_whatsapp": ["5573999999999-1234567890@g.us"]
}
```

#### 2. Download PDF

```json
{
  "method": "GET",
  "url": "={{$json.pdf_url}}",
  "responseFormat": "file"
}
```

#### 3. Formatar Mensagem

```javascript
const { igreja, periodo } = $input.first().json;

return {
  json: {
    caption: `📅 *Escala de Cultos - ${periodo}*\n\n🏛️ Igreja: ${igreja}\n\n_Gerado automaticamente pelo Sistema de Gestão_`
  }
};
```

#### 4. Enviar no Grupo

```json
{
  "method": "POST",
  "url": "={{$env.WHATSAPP_API_URL}}/send-file",
  "body": {
    "chatId": "={{$json.grupos_whatsapp[0]}}",
    "file": "={{$binary.data}}",
    "caption": "={{$json.caption}}",
    "filename": "escala_{{$json.periodo}}.pdf"
  }
}
```

#### 5. Confirmar ao Sistema

```json
{
  "method": "POST",
  "url": "https://igreja.seudominio.com/api/webhooks/n8n/notificacao-enviada",
  "body": {
    "evento": "pdf_enviado",
    "escala_id": "={{$json.escala_id}}",
    "enviado_em": "={{$now}}"
  }
}
```

## 3️⃣ AUTOMAÇÃO 3: Notificações Financeiras

### Nodes do Workflow

#### 1. Cron (Trigger)

```
0 9 * * * (Todos os dias às 9h)
```

#### 2. Buscar Contas a Vencer (HTTP Request)

```json
{
  "method": "GET",
  "url": "https://igreja.seudominio.com/api/financeiro/contas-vencer?dias=3"
}
```

#### 3. Filtrar se há contas

```javascript
const contas = $input.item.json.data;
return contas && contas.length > 0 ? [{ json: { contas } }] : [];
```

#### 4. Formatar Mensagem

```javascript
const contas = $input.item.json.contas;

let mensagem = '⚠️ *CONTAS A VENCER NOS PRÓXIMOS 3 DIAS*\n\n';

contas.forEach((conta, i) => {
  const valor = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(conta.valor);

  const vencimento = new Date(conta.vencimento).toLocaleDateString('pt-BR');

  mensagem += `${i + 1}. ${conta.descricao}\n`;
  mensagem += `   💰 ${valor}\n`;
  mensagem += `   📅 Vence: ${vencimento}\n\n`;
});

mensagem += '_Sistema de Gestão Financeira_';

return { json: { mensagem } };
```

#### 5. Enviar WhatsApp para Tesoureiro

```json
{
  "method": "POST",
  "url": "={{$env.WHATSAPP_API_URL}}/send-message",
  "body": {
    "phone": "5573888888888",
    "message": "={{$json.mensagem}}"
  }
}
```

## 🔧 Configurações Adicionais

### Credenciais no n8n

1. **WhatsApp API**
   - Type: Header Auth
   - Name: Authorization
   - Value: `Bearer SEU_TOKEN_WHATSAPP`

2. **Sistema Backend**
   - Type: Header Auth
   - Name: Authorization
   - Value: `Bearer {{$env.N8N_WEBHOOK_SECRET}}`

### Variáveis de Ambiente no n8n

```bash
WHATSAPP_API_URL=https://api.uazapi.com
WHATSAPP_API_TOKEN=seu_token
N8N_WEBHOOK_SECRET=mesmo_secret_do_sistema
```

## 📊 Monitoramento

### Ver logs de execução

1. Acesse n8n: `https://n8n.seudominio.com`
2. Clique em "Executions"
3. Filtre por workflow
4. Veja detalhes de cada execução

### Webhooks de Status

Adicione node final em cada workflow para registrar no sistema:

```json
{
  "method": "POST",
  "url": "https://igreja.seudominio.com/api/webhooks/n8n/log",
  "body": {
    "workflow": "escala-confirmacao",
    "status": "success",
    "timestamp": "={{$now}}",
    "dados": "={{$json}}"
  }
}
```

## 🆘 Troubleshooting

### Webhook não recebe dados

1. Verificar se URL está correta
2. Testar com Postman/curl
3. Ver logs do n8n

### WhatsApp não envia

1. Verificar token da API
2. Testar endpoint diretamente
3. Verificar formato do número (55 + DDD + número)

### Resposta não é processada

1. Verificar timeout do Wait node
2. Confirmar que phone match está correto
3. Ver logs de execução

---

**Dica**: Teste cada workflow individualmente antes de ativar em produção!
