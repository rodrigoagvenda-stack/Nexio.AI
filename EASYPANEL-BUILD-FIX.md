# 🔧 Fix para Erro de Build no Easypanel

## Problema
O build está sendo cancelado durante a compilação do Next.js com erro `CANCELED: context canceled`.

## ✅ Otimizações Aplicadas

Já foram aplicadas as seguintes otimizações no código:

1. **next.config.js**:
   - ✅ Limitado a 1 CPU durante build
   - ✅ Desabilitado worker threads
   - ✅ Removido console.log em produção

## 🚀 Próximos Passos no Easypanel

Se o erro persistir, você precisa **aumentar os limites de recursos** no Easypanel:

### 1. Aumentar Memória do Build

No Easypanel, vá até:
```
Seu App → Settings → Resources
```

Aumente:
- **Memory**: Mínimo **2GB** (recomendado **4GB**)
- **CPU**: Mínimo **1 core** (recomendado **2 cores**)

### 2. Aumentar Timeout do Build

Adicione variável de ambiente:
```
DOCKER_BUILDKIT_TIMEOUT=1200
```

Ou configure no `docker-compose.yml` (se usar):
```yaml
build:
  context: .
  args:
    BUILDKIT_INLINE_CACHE: 1
  timeout: 1200s
```

### 3. Verificar Variáveis de Ambiente

Certifique-se de que todas as variáveis estão configuradas:

**Build Args (públicas):**
```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

**Runtime Env Vars (secretas):**
```
SUPABASE_SERVICE_ROLE_KEY=...
N8N_WEBHOOK_MAPS=...
N8N_WEBHOOK_ICP=...
N8N_WEBHOOK_WHATSAPP=...
N8N_WEBHOOK_SECRET=...
```

### 4. Limpar Cache do Docker

No Easypanel, tente fazer **rebuild from scratch**:
```
App → Actions → Rebuild
```

Ou via CLI:
```bash
docker builder prune -a
```

## 🐛 Debug

Se ainda não funcionar, verifique os logs completos:
```
App → Logs → Build Logs
```

Procure por:
- `killed` ou `OOMKilled` = falta de memória
- `timeout` = build muito lento
- `permission denied` = problema de permissões

## 📊 Estatísticas de Build

Build típico do Next.js:
- **Tempo**: 2-5 minutos
- **Memória**: 1.5-3GB
- **CPU**: 1-2 cores

Com as otimizações aplicadas, deve usar **menos memória** mas pode demorar **um pouco mais**.
