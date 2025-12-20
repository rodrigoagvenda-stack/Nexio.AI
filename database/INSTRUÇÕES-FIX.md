# 🔧 FIX COMPLETO - Sistema Travado

## Problema
Sistema trava com erros de infinite recursion e loops. Páginas não carregam.

## Solução (3 passos simples)

### 1️⃣ Rodar SQL no Supabase

Vá no **Supabase Dashboard → SQL Editor** e execute:

```sql
-- Cole o conteúdo completo do arquivo: database/fix-complete.sql
```

Este SQL vai:
- ✅ Remover todas as policies de RLS
- ✅ Desabilitar RLS completamente
- ✅ Corrigir o link entre auth.users e users table
- ✅ Verificar se tudo funcionou

### 2️⃣ Verificar o Resultado

Após rodar o SQL, veja os resultados:

**Tabela 1 - RLS Status:**
Todas as tabelas devem mostrar `rls_enabled = false`

**Tabela 2 - Usuário:**
Deve mostrar o usuário com:
- `auth_user_id` = um UUID válido (NÃO pode ser NULL!)
- `email` = admin@vendai.com
- `company_id` = número da empresa

### 3️⃣ Limpar e Relogar

1. **Logout** do sistema (se conseguir)
2. **Fechar o navegador completamente**
3. **Abrir novamente**
4. **Login** com: admin@vendai.com / vendai123
5. **Teste**: Ir para Dashboard, CRM, etc.

---

## ✅ Como Saber se Funcionou

Após login, você deve conseguir:
- ✅ Ver o Dashboard com números/métricas
- ✅ Navegar para CRM e ver leads
- ✅ Não ter erros no console do navegador
- ✅ Sistema NÃO trava mais

---

## ❌ Se Ainda Não Funcionar

Mande print de:
1. Resultado do SQL (as duas tabelas que aparecem no final)
2. Console do navegador (F12 → Console)
3. Qual página trava
