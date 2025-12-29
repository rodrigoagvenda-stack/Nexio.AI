# Instruções - Workflow n8n UAZapi

## Como Importar

1. Abra seu n8n em: https://vendai-n8n.aw5nou.easypanel.host
2. Clique em "Import from File"
3. Selecione o arquivo `n8n-uazapi-workflow.json`
4. Ative o workflow

## URL do Webhook

```
https://vendai-n8n.aw5nou.easypanel.host/webhook/send-manual-message
```

## Formato dos Dados (Body JSON)

### Enviar Texto
```json
{
  "messageType": "text",
  "url_instancia": "https://api.uazapi.com",
  "token": "seu_token_uazapi",
  "number": "5511999999999",
  "text": "Olá! Esta é uma mensagem de texto."
}
```

### Enviar Imagem
```json
{
  "messageType": "image",
  "url_instancia": "https://api.uazapi.com",
  "token": "seu_token_uazapi",
  "number": "5511999999999",
  "mediaUrl": "https://example.com/imagem.jpg",
  "caption": "Legenda da imagem (opcional)"
}
```

### Enviar Documento
```json
{
  "messageType": "document",
  "url_instancia": "https://api.uazapi.com",
  "token": "seu_token_uazapi",
  "number": "5511999999999",
  "mediaUrl": "https://example.com/documento.pdf",
  "filename": "documento.pdf"
}
```

### Enviar Áudio
```json
{
  "messageType": "audio",
  "url_instancia": "https://api.uazapi.com",
  "token": "seu_token_uazapi",
  "number": "5511999999999",
  "mediaUrl": "https://example.com/audio.mp3"
}
```

### Enviar Figurinha (Sticker)
```json
{
  "messageType": "sticker",
  "url_instancia": "https://api.uazapi.com",
  "token": "seu_token_uazapi",
  "number": "5511999999999",
  "mediaUrl": "https://example.com/sticker.webp"
}
```

### Reagir a uma Mensagem
```json
{
  "messageType": "reaction",
  "url_instancia": "https://api.uazapi.com",
  "token": "seu_token_uazapi",
  "number": "5511999999999",
  "messageId": "ID_DA_MENSAGEM_PARA_REAGIR",
  "emoji": "👍"
}
```

## Parâmetros Obrigatórios

### Todos os tipos de mensagem precisam:
- `messageType` - Tipo da mensagem (text, image, document, audio, sticker, reaction)
- `url_instancia` - URL base da sua instância UAZapi
- `token` - Token de autenticação da UAZapi
- `number` - Número do destinatário (formato: DDI + DDD + número)

### Parâmetros específicos por tipo:

**text:**
- `text` - Conteúdo da mensagem

**image:**
- `mediaUrl` - URL da imagem
- `caption` - Legenda (opcional)

**document:**
- `mediaUrl` - URL do documento
- `filename` - Nome do arquivo (opcional, padrão: documento.pdf)

**audio:**
- `mediaUrl` - URL do áudio

**sticker:**
- `mediaUrl` - URL da figurinha

**reaction:**
- `messageId` - ID da mensagem para reagir
- `emoji` - Emoji da reação (ex: 👍, ❤️, 😂)

## Integração com seu Sistema

Para integrar com o chat espelhado, você deve chamar o webhook passando os dados do chat que já tem disponíveis. Exemplo usando os dados que você já coleta:

```javascript
// Exemplo de chamada do seu frontend
const sendMessage = async (chatData, messageData) => {
  const payload = {
    messageType: messageData.type, // 'text', 'image', etc
    url_instancia: chatData.url_instancia,
    token: chatData.token,
    number: chatData['Quem mandou'], // Número do contato
    ...messageData // Outros dados específicos do tipo
  };

  const response = await fetch('https://vendai-n8n.aw5nou.easypanel.host/webhook/send-manual-message', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  return response.json();
};
```

## Teste

Você pode testar o webhook usando curl:

```bash
curl -X POST https://vendai-n8n.aw5nou.easypanel.host/webhook/send-manual-message \
  -H "Content-Type: application/json" \
  -d '{
    "messageType": "text",
    "url_instancia": "https://api.uazapi.com",
    "token": "SEU_TOKEN",
    "number": "5511999999999",
    "text": "Teste de mensagem"
  }'
```

## Resposta do Webhook

Em caso de sucesso:
```json
{
  "success": true,
  "message": "Mensagem enviada com sucesso"
}
```
