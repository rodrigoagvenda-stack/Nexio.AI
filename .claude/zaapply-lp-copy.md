# Copy final — Landing Page Zaapply MVP

Texto pronto pra colar no layout, seção por seção.

---

### Hero

**Enquanto seu lead espera, ele já foi pra outro.**

O Zaapply responde no WhatsApp em segundos, qualifica e chama seu vendedor na hora certa.

`[CTA: Ver o Zaapply em ação]`

---

### Como funciona

**Da primeira mensagem à venda, em três passos**

1. O lead manda mensagem. O Zaapply responde na hora, qualquer horário.
2. O SDR qualifica. Entende o que o lead precisa e conduz a conversa.
3. A venda acontece. Produto simples, o próprio agente fecha. Produto consultivo, o agente entrega o lead quente pro vendedor no momento certo.

---

### Para quem é

**Dois jeitos de vender, um único SDR**

**SDR que fecha**
Produto com preço fixo ou agendamento simples. A conversa começa e termina com o Zaapply, sem precisar de um vendedor humano no meio.

**SDR que qualifica**
Produto complexo ou consultivo. O Zaapply aquece o lead e passa o bastão pro seu vendedor exatamente quando a conversa está pronta pra fechar.

---

### Features

**O que todo plano Zaapply já vem com**

- Agente SDR com IA: responde, qualifica e conduz a conversa no WhatsApp
- Atendimento via chat: seu time acompanha e assume qualquer conversa quando quiser
- CRM Kanban: funil de vendas com o histórico completo de cada lead

**No plano Growth, além disso**
- Google Calendar integrado: agendamento automático direto na conversa
- Até 5 membros na equipe

---

### Planos

**Escolha o tamanho do seu time**

| Plano | Preço | Membros | Inclui |
|---|---|---|---|
| Zaapply Start | R$297/mês | 1 | SDR + CRM + chat |
| Zaapply Growth | R$397/mês | 5 | Tudo do Start + Google Calendar |

`[CTA: Assinar o Zaapply]`

---

### Prova social

**Quem já usa o Zaapply vende mais rápido**

`[placeholder: depoimento ou logo de cliente real. Não preencher com prova social fictícia até existir uma]`

---

### CTA final

**Pare de perder lead por demora**

O Zaapply responde primeiro, qualifica certo e passa a venda pra você fechar.

`[CTA: Assinar o Zaapply]`

---
---

# SEO técnico (aplicação da skill `seo`)

### Meta tags

**Title** (54 caracteres):
`Zaapply: SDR com IA que Responde e Vende no WhatsApp`

**Meta description** (148 caracteres, sem afirmação absoluta):
`SDR com IA que responde, qualifica e vende no WhatsApp antes do concorrente. CRM integrado. A partir de R$297/mês.`

**URL sugerida:** `zaapply.com/` (página única, sem parâmetro)

### Hierarquia de heading

```
H1: Enquanto seu lead espera, ele já foi pra outro.
 H2: Da primeira mensagem à venda, em três passos
 H2: Dois jeitos de vender, um único SDR
   H3: SDR que fecha
   H3: SDR que qualifica
 H2: O que todo plano Zaapply já vem com
   H3: No plano Growth, além disso
 H2: Escolha o tamanho do seu time
 H2: Quem já usa o Zaapply vende mais rápido
 H2: Pare de perder lead por demora
```

Um H1 só, sem pular nível, cada H2 corresponde a uma seção real da página (regra da skill `seo`, evita heading decorativo).

### Structured data (JSON-LD)

Organization, pra reforçar identidade da marca nos resultados de busca:

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "Zaapply",
  "url": "https://zaapply.com",
  "description": "SDR com IA nativo do WhatsApp com CRM integrado"
}
</script>
```

Product, um bloco por plano, pra habilitar rich snippet de preço:

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Product",
  "name": "Zaapply Start",
  "description": "SDR com IA, CRM Kanban e atendimento via chat no WhatsApp",
  "offers": {
    "@type": "Offer",
    "price": "297.00",
    "priceCurrency": "BRL",
    "url": "https://zaapply.com#planos"
  }
}
</script>
```
(repetir a mesma estrutura pro plano Growth, com preço 397.00)

### Imagem

Se o hero tiver imagem/ilustração, `alt` descritivo, não genérico:
`alt="Conversa de WhatsApp entre lead e o SDR com IA do Zaapply"`, não `alt="hero.png"`.

---

# Notas abertas

- **CTA**: usei "Ver o Zaapply em ação" e "Assinar o Zaapply" como placeholder. Depende do fluxo real (teste grátis, demo agendada, checkout direto).
- **Keyword**: título e meta description usam "SDR com IA" e "WhatsApp" como aposta, sem dado de volume de busca real. Vale validar no Search Console antes de travar.
- **Prova social**: seção 6 está vazia de propósito. Não inventar depoimento.
