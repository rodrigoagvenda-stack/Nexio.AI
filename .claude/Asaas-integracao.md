# Integração Asaas — Zaapply

## O que faz

Conecta sua conta Asaas ao Zaapply para disparar automações quando:
- ✅ **Pagamento confirmado** (`asaas_pago`) — PIX, boleto ou cartão pago
- 📄 **Boleto gerado** (`asaas_boleto_gerado`) — cliente recebeu o boleto mas ainda não pagou
- ⚠️ **Boleto vencido** (`asaas_boleto_vencido`) — boleto passou do prazo sem pagamento

Também mostra todas as cobranças da conta no **Financeiro** em tempo real via API do Asaas.

---

## Como configurar (passo a passo)

> ⚠️ O erro mais comum é **confundir a Chave de API com o Token do Webhook** — são dois tokens diferentes, um para cada campo.

### Passo 1 — Pegar a Chave de API

1. No painel Asaas → **Menu (☰) → Integrações → Chaves de API**
2. Clique em **Gerar nova chave**
3. Selecione o ambiente **Produção**
4. Copie a chave — começa com `$aact_prod_...`

> ⚠️ Cole essa chave no campo **"Chave de API Asaas"** no Zaapply. NÃO é o token do webhook.

### Passo 2 — Configurar o Webhook no Asaas

1. No painel Asaas → **Menu (☰) → Integrações → Configurar Webhook**
2. Clique em **Adicionar webhook**
3. Configure:
   - **URL**: cole a URL exibida no Zaapply (ex: `https://app.zaapply.com.br/api/webhooks/payment/18/asaas`)
   - **Versão da API**: v3
   - **Eventos a notificar**: marque pelo menos:
     - `PAYMENT_RECEIVED`
     - `PAYMENT_CONFIRMED`
     - `PAYMENT_CREATED`
     - `PAYMENT_OVERDUE`
4. No campo **"Token"** (ou "Chave de autenticação"), **crie um token próprio** — pode ser qualquer texto, ex: `zaapply_2024_asaas`
5. Salve o webhook

> ⚠️ Este token que você **criou** no Asaas é diferente da Chave de API. Cole ele no campo **"Token do Webhook"** no Zaapply.

### Passo 3 — Preencher no Zaapply

1. Vá em **Configurações → Integrações → Asaas → Configurar**
2. **URL do Webhook** — copie e cole no painel Asaas (passo 2)
3. **Chave de API Asaas** — cole a chave `$aact_prod_...` do passo 1
4. **Token do Webhook** — cole o token que você criou no Asaas no passo 2
5. Clique em **Salvar**

---

## Por que deu errado antes

O Asaas envia o "Token do Webhook" no **header `asaas-access-token`** de cada requisição. O Zaapply compara esse token com o que está salvo. Se forem diferentes → webhook rejeitado.

O erro clássico é:
- Colocar a **Chave de API** (`$aact_prod_...`) no campo de Token do Webhook
- Colocar o **Token do Webhook** no campo de Chave de API

São dois campos obrigatórios e independentes.

---

## Casos de uso no Canvas

| Evento de entrada | Quando dispara | Exemplo de uso |
|---|---|---|
| `asaas_pago` | PIX/cartão confirmado ou boleto compensado | Mensagem de boas-vindas + envio de acesso/contrato |
| `asaas_boleto_gerado` | Boleto criado e enviado para o cliente | Lembrete com o código de barras |
| `asaas_boleto_vencido` | Boleto passou do vencimento | Recuperação de boleto vencido com novo link |

### Exemplo de fluxo de cobrança

```
[Gerar cobrança no chat] → Boleto criado
        ↓ asaas_boleto_gerado
[Mensagem: "Seu boleto vence em 3 dias. Código: ..."]
        ↓ (3 dias depois, se não pagar)
        ↓ asaas_boleto_vencido
[Mensagem: "Seu boleto venceu. Clique aqui para gerar um novo"]
        ↓ (cliente paga)
        ↓ asaas_pago
[Mensagem: "Pagamento confirmado! Acesso liberado ✅"]
```

---

## Financeiro — o que aparece

O Financeiro busca **diretamente da API do Asaas** todas as cobranças da conta:
- Filtra por período (7/30/90 dias ou todas)
- Filtra por status (Em aberto / Pago / Vencida)
- Mostra: Descrição, Tipo (PIX/Boleto/Cartão), Vencimento, Valor, Status, link para a cobrança

> Cobranças criadas direto no painel Asaas também aparecem, não só as criadas pelo Zaapply.

---

## Sandbox (ambiente de testes)

Se a chave começa com `$aact_hmlg_...`, o Zaapply automaticamente usa `https://api-sandbox.asaas.com/v3` em vez de produção. Nenhuma configuração extra necessária.

---

## Troubleshooting

| Problema | Causa provável |
|---|---|
| Histórico de eventos mostra "Token inválido" | Token do Webhook no Zaapply diferente do configurado no Asaas |
| Pagamento confirmado mas sequência não disparou | Evento `PAYMENT_RECEIVED` não marcado no webhook do Asaas |
| Financeiro aparece vazio | Chave de API incorreta ou expirada |
| Webhook não chega (sem eventos no histórico) | URL do webhook errada no Asaas — verifique o company_id na URL |
