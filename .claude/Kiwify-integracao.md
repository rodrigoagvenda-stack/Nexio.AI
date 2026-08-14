# Integração Kiwify — Zaapply

## O que faz

Quando um aluno compra um curso ou infoproduto na Kiwify, o Zaapply recebe automaticamente a notificação e:

1. **Busca o lead** no CRM pelo e-mail ou telefone do comprador
2. **Se não existir**, cria o lead automaticamente com nome, e-mail, telefone, status **Fechado** e origem `kiwify`
3. **Move o lead para Fechado** e registra o valor da venda
4. **Dispara a sequência de follow-up** configurada no Canvas (evento `kiwify`)

---

## Como configurar (passo a passo)

### No Zaapply
1. Vá em **Configurações → Integrações → Kiwify**
2. Clique em **Configurar**
3. **Copie a URL do Webhook** exibida (ex: `https://app.zaapply.com.br/api/webhooks/payment/18/kiwify`)

### Na Kiwify
1. Acesse o painel da Kiwify → **Apps → Webhooks**
2. Clique em **Criar Webhook**
3. Cole a URL copiada do Zaapply no campo de URL
4. Selecione o evento **`order_approved`** (venda confirmada)
5. Salve — a Kiwify gera automaticamente um **Token de Verificação**
6. Copie esse token

### De volta no Zaapply
1. Cole o token no campo **Token de Verificação**
2. Clique em **Salvar**
3. O card ficará com o badge **Ativo** ✓

---

## Como usar no Canvas

Para disparar mensagens automáticas quando uma compra for confirmada:

1. Vá em **Automações → Canvas**
2. Crie ou edite um fluxo
3. No nó de entrada, selecione o evento **`kiwify`**
4. Monte a sequência: boas-vindas → acesso ao curso → upsell → etc.

**Variáveis disponíveis na sequência:**
- `{{nome}}` — nome do comprador
- `{{produto}}` — nome do curso/produto comprado
- `{{valor}}` — valor da compra

---

## Casos de uso

| Situação | O que acontece |
|---|---|
| Lead já estava no CRM (veio pelo WhatsApp) | Atualiza para Fechado + dispara sequência |
| Lead comprou direto na Kiwify (nunca conversou) | Cria lead automaticamente + dispara sequência se tiver telefone |
| Lead sem telefone cadastrado na Kiwify | Lead criado no CRM mas sequência WhatsApp não dispara |

---

## Limitações atuais

- **Sem API de listagem**: a Kiwify não oferece API pública para listar pedidos, então o histórico no Financeiro mostra apenas compras que chegaram via webhook depois da integração ser configurada
- **Somente `order_approved`**: eventos de reembolso, chargeback e cancelamento ainda não atualizam o lead no CRM
- **Telefone obrigatório para WhatsApp**: se o comprador não colocou telefone na Kiwify, o lead é criado mas não recebe mensagem

---

## Troubleshooting

| Problema | Causa provável |
|---|---|
| Compra confirmada mas lead não apareceu | Token errado — reconectar com o token correto gerado pela Kiwify |
| Sequência não disparou | Nenhum fluxo com evento `kiwify` configurado no Canvas |
| Lead criado mas sem nome | Kiwify não enviou `full_name` no payload — verificar campos obrigatórios no checkout |
