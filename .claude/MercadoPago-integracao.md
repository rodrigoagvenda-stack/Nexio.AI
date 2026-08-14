# Integração Mercado Pago — Zaapply

## O que faz

Conecta sua conta Mercado Pago ao Zaapply para:
- Disparar automações quando um pagamento for aprovado
- Exibir todas as transações no **Financeiro** em tempo real via API do MP

---

## Como configurar (passo a passo)

### Passo 1 — Pegar o Access Token de Produção

1. Acesse [mercadopago.com.br/developers](https://mercadopago.com.br/developers)
2. Vá em **Suas integrações → (selecione sua aplicação) → Credenciais → Produção**
3. Copie o **Access Token** — começa com `APP_USR-...`

> ⚠️ Use sempre o token de **Produção**. O token de **Teste** (começa com `TEST-`) não recebe pagamentos reais.

### Passo 2 — Configurar no Zaapply

1. Vá em **Configurações → Integrações → Mercado Pago → Configurar**
2. Cole o **Access Token** no campo indicado
3. Clique em **Salvar**

### Passo 3 — Configurar Webhook no MP (para automações)

> O Financeiro funciona sem webhook (busca via API). O webhook é necessário apenas para disparar sequências automáticas no Canvas quando um pagamento chegar.

1. Em Mercado Pago Developers → **Suas integrações → Webhooks**
2. Clique em **Adicionar webhook**
3. Configure:
   - **URL**: `https://app.zaapply.com.br/api/webhooks/payment/{SEU_COMPANY_ID}/mercadopago`
   - **Eventos**: marque `Pagamentos`
4. Salve

---

## Casos de uso no Canvas

| Evento de entrada | Quando dispara | Exemplo de uso |
|---|---|---|
| `mp_pago` | Pagamento aprovado via MP | Mensagem de confirmação + envio de acesso |

### Exemplo de fluxo

```
[Cliente paga via MP]
        ↓ webhook → mp_pago
[Lead movido para Fechado no CRM]
[Mensagem: "Pagamento aprovado! Bem-vindo ✅"]
```

---

## Financeiro — o que aparece

O Financeiro chama diretamente `GET /v1/payments/search` na API do MP com seu Access Token:
- Filtra por período (7/30/90 dias)
- Ordena por data de criação (mais recente primeiro)
- Mostra: Descrição, Tipo de pagamento, Vencimento, Valor, Status, link

**Status mapeados:**
| Status MP | Exibido como |
|---|---|
| `approved` | Pago ✅ |
| `pending` / `in_process` | Em aberto |
| `cancelled` / `rejected` | Cancelado |

---

## Diferença entre Access Token e Secret Key

Ao configurar no Zaapply, só é necessário o **Access Token**. O **Secret Key** não é usado aqui.

| Campo | Para que serve |
|---|---|
| Access Token (`APP_USR-...`) | Autenticar nas APIs do MP — **este é o necessário** |
| Secret Key | Validar assinatura HMAC de webhooks — configuração futura |

---

## Troubleshooting

| Problema | Causa provável |
|---|---|
| Financeiro não carrega dados do MP | Token de teste (`TEST-...`) em vez de produção |
| Financeiro mostra período errado | O MP exige `begin_date` e `end_date` juntos — atualizar o app |
| Webhook não dispara sequência | URL do webhook sem o company_id correto |
| "Mercado Pago não configurado" | Access Token não salvo ou conta desativada |
