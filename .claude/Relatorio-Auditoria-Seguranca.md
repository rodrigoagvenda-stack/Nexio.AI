# Relatório de Auditoria de Segurança — Nexio.AI (Zaapply)
**Data:** 2026-05-21
**Auditor:** Claude Code
**Versão analisada:** branch `claude/church-management-system-AQZ8r`

---

## Resumo Executivo

| Severidade | Qtd | Status |
|---|---|---|
| 🔴 Crítico | 1 | npm deps |
| 🟠 Alto | 3 | Webhook sem auth, middleware getSession, n8n fallback plaintext |
| 🟡 Médio | 4 | Sem Zod, sem rate limit geral, sem security headers, RLS não verificado |
| 🟢 OK | 12 | Ver seção Verde abaixo |

---

## 🔴 CRÍTICO

### C1 — 19 Vulnerabilidades em Dependências npm
**Arquivo:** `package.json`
**Detalhe:** `npm audit` retornou 1 crítica, 12 altas, 5 moderadas, 1 baixa.

**Ação imediata:**
```bash
npm audit fix
# Para vulnerabilidades que exigem breaking changes:
npm audit fix --force  # testar em dev antes
```

---

## 🟠 ALTO

### A1 — Webhook `nexio-uazapi` sem verificação de autenticidade
**Arquivo:** `app/api/webhook/nexio-uazapi/route.ts`

O endpoint aceita qualquer POST sem validar origem. Qualquer um que descobrir a URL pode injetar eventos falsos no sistema SDR.

**Fix:**
```ts
// Adicionar no início do POST handler:
const secret = request.headers.get('x-webhook-secret')
if (secret !== process.env.NEXIO_WEBHOOK_SECRET) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}
```
Configurar `NEXIO_WEBHOOK_SECRET` no EasyPanel e no painel da uazapi ao cadastrar o webhook.

---

### A2 — Middleware usa `getSession()` em vez de `getUser()`
**Arquivo:** `lib/supabase/middleware.ts:59`

`getSession()` apenas lê o cookie local sem validar o JWT contra o servidor Supabase. Um JWT expirado ou revogado mas ainda presente no cookie passaria. A Supabase documenta explicitamente que `getUser()` deve ser usado em contextos de segurança.

**Fix:**
```ts
// Trocar:
const { data: { session } } = await supabase.auth.getSession()
// Por:
const { data: { user } } = await supabase.auth.getUser()
```
O middleware só precisa atualizar o cookie de sessão — `getUser()` faz isso corretamente e com validação server-side.

---

### A3 — Fallback de criptografia em plaintext para API keys do n8n
**Arquivo:** `app/api/admin/n8n/sync/route.ts:61-67`

```ts
try {
  apiKey = decrypt(instance.api_key);
} catch {
  try {
    apiKey = Buffer.from(instance.api_key, 'base64').toString('utf-8');
  } catch {
    apiKey = instance.api_key; // ← chave usada em plaintext
  }
}
```

Se a descriptografia falhar, a chave é usada como texto puro — o que significa que instâncias legacy podem ter API keys armazenadas sem criptografia real no banco.

**Fix:**
```ts
// Remover fallbacks. Se não conseguir descriptografar, falhar explicitamente:
try {
  apiKey = decrypt(instance.api_key);
} catch {
  log(`Erro ao descriptografar API key de "${instance.name}" — ignorando instância`)
  continue
}
```
Migrar instâncias legacy para criptografia adequada com um script pontual.

---

## 🟡 MÉDIO

### M1 — Zero validação com Zod nas API Routes
**Escopo:** todas as ~100 rotas em `app/api/`

A validação é feita manualmente verificando campos obrigatórios com `if (!campo)`, sem validação de tipo, tamanho ou formato. Isso abre espaço para type coercion e campos inesperados no body.

**Recomendação:** Adotar Zod progressivamente, começando pelas rotas com dados mais sensíveis (membros, financeiro, admin).

```ts
import { z } from 'zod'

const schema = z.object({
  nome: z.string().min(1).max(100),
  email: z.string().email(),
})

const parsed = schema.safeParse(await request.json())
if (!parsed.success) {
  return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })
}
```

---

### M2 — Rate limiting ausente na maioria das rotas autenticadas
**Escopo:** ~95 das ~100 rotas

Apenas `briefing/submit`, `lead-qualification/submit`, `contact` e `support/ticket` têm rate limiting. Todas as demais rotas autenticadas estão abertas para abuso via loop (ex: bulk inserts, geração em massa de IA).

**Recomendação:** Adicionar rate limiting nas rotas de IA e operações pesadas:
```ts
// Rotas prioritárias:
// - /api/sdr/simulate
// - /api/sdr/auto-simulate
// - /api/extraction/*
// - /api/messages/schedule
```

A lib `lib/rate-limit.ts` já existe — só aplicar.

---

### M3 — Headers de segurança HTTP ausentes
**Arquivo:** `next.config.js`

O `headers()` atual só configura CORS. Faltam os headers de segurança padrão:

**Fix — adicionar ao `next.config.js`:**
```js
async headers() {
  return [
    {
      source: '/:path*',
      headers: [
        // CORS existente...
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        // HSTS — só ativar em produção com HTTPS garantido:
        { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
      ],
    },
  ]
}
```

---

### M4 — RLS do Supabase não verificado (MCP requer access token)

Não foi possível conectar via MCP para auditar as policies RLS. **Ação manual necessária:**

Rodar no SQL Editor do Supabase:
```sql
-- Tabelas SEM RLS ativo
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public' AND rowsecurity = false;

-- Policies existentes por tabela
SELECT tablename, policyname, cmd, qual
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, cmd;

-- Tabelas com RLS ativo mas SEM nenhuma policy (bloqueia tudo)
SELECT t.tablename
FROM pg_tables t
WHERE t.schemaname = 'public' AND t.rowsecurity = true
  AND NOT EXISTS (
    SELECT 1 FROM pg_policies p
    WHERE p.schemaname = 'public' AND p.tablename = t.tablename
  );
```

---

## 🟢 OK — Controles Verificados

| # | Controle | Evidência |
|---|---|---|
| ✅ | `SERVICE_ROLE_KEY` sem `NEXT_PUBLIC_` | `lib/supabase/server.ts` usa `process.env.SUPABASE_SERVICE_ROLE_KEY` |
| ✅ | Nenhuma chave sensível exposta ao cliente | Grep em `NEXT_PUBLIC_*KEY\|SECRET` retornou zero |
| ✅ | `.env` no `.gitignore` | Cobre `.env`, `.env*.local`, `.env.development`, `.env.production` |
| ✅ | Source maps desabilitados em prod | `productionBrowserSourceMaps: false` + `config.devtool = false` |
| ✅ | Stripe webhook com assinatura | `stripe.webhooks.constructEvent()` com `STRIPE_WEBHOOK_SECRET` |
| ✅ | Asaas webhook com secret token | Verifica `agente.webhook_secret` no banco |
| ✅ | SDR webhook com secret | `SDR_WEBHOOK_SECRET` via env |
| ✅ | Cron routes com Bearer token | `Authorization: Bearer CRON_SECRET` em `cron/keep-alive` |
| ✅ | Admin routes verificam role | Consulta `admin_users` além de `getUser()` em `/api/admin/companies` |
| ✅ | API keys de terceiros criptografadas | `encrypt(api_key)` antes de salvar; `decrypt()` ao usar |
| ✅ | `dangerouslySetInnerHTML` em chart.tsx | Injeta CSS variables internas (não input de usuário) — baixo risco |
| ✅ | Sem chaves hardcoded no código | Grep por `secret\s*=\s*['"]` retornou zero casos hardcoded |

---

## Prioridades de Ação

| Prioridade | Item | Esforço |
|---|---|---|
| 🔴 IMEDIATO | `npm audit fix` | 15 min |
| 🔴 IMEDIATO | Adicionar secret no webhook `nexio-uazapi` | 20 min |
| 🟠 ESTA SEMANA | Trocar `getSession()` por `getUser()` no middleware | 5 min |
| 🟠 ESTA SEMANA | Remover fallback plaintext no n8n sync | 15 min |
| 🟠 ESTA SEMANA | Adicionar security headers no `next.config.js` | 15 min |
| 🟡 SPRINT 1 | Auditar RLS manualmente no Supabase | 1h |
| 🟡 SPRINT 1 | Rate limiting nas rotas de IA | 2h |
| 🟡 SPRINT 2 | Adotar Zod progressivamente | Contínuo |

---

*Auditoria executada em 2026-05-21 — re-executar a cada release maior*
