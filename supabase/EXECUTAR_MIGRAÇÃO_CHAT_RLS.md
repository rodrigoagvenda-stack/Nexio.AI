# 🚀 Como Corrigir o Acesso ao Chat para Membros da Equipe

## Problema
Membros da equipe (não-admin) não conseguem ver as conversas do WhatsApp. O chat só aparece quando o usuário tem privilégios de admin.

## Causa Raiz
As políticas RLS (Row Level Security) não estavam configuradas para permitir que membros da equipe acessassem conversas e mensagens da própria empresa.

## Solução

### Passo 1: Acessar o Supabase SQL Editor
1. Abra o dashboard do Supabase: https://app.supabase.com
2. Selecione seu projeto **Vend.AI**
3. No menu lateral, clique em **SQL Editor**

### Passo 2: Executar o Script de Migração
1. Clique em **"New Query"** (ou qualquer editor em branco)
2. Copie TODO o conteúdo do arquivo `supabase/migrations/20260109000000_fix_chat_rls_permissions.sql`
3. Cole no SQL Editor
4. Clique em **"Run"** (ou pressione Ctrl/Cmd + Enter)

### Passo 3: Verificar se Funcionou
1. Após executar, você verá a mensagem "Success. No rows returned"
2. Faça logout e login novamente com um usuário **não-admin** (membro da equipe)
3. Acesse a página de **Atendimento** (Chat)
4. Deve aparecer as conversas da empresa normalmente agora! ✅

## O que o Script Faz?

### ✅ Adiciona 2 Políticas RLS Críticas:

**1. `users_own_conversas`**
- Permite que usuários vejam **conversas da própria empresa**
- Funciona da mesma forma que a política de leads

**2. `users_own_mensagens`**
- Permite que usuários vejam **mensagens das conversas da própria empresa**
- Garante que só acessem mensagens de conversas que pertencem à sua empresa

### Antes x Depois

**ANTES:**
- ❌ Apenas admins podiam ver o chat
- ❌ Vendedores não tinham acesso às conversas
- ❌ Era necessário tornar alguém admin para dar acesso ao WhatsApp

**DEPOIS:**
- ✅ Todos os membros da equipe veem o chat
- ✅ Cada empresa vê apenas suas próprias conversas
- ✅ Vendedores têm acesso completo ao WhatsApp da empresa
- ✅ Mantém segurança: cada empresa só vê seus dados

## Importante
⚠️ O script usa `DROP POLICY IF EXISTS` e `CREATE POLICY`, então é 100% seguro executar mesmo que as políticas já existam.

## Precisa de Ajuda?
Se continuar com erro após executar a migration:
1. Verifique se o usuário está vinculado à uma empresa (campo `company_id` na tabela `users`)
2. Verifique se o usuário está ativo (`is_active = true`)
3. Tente fazer logout e login novamente
4. Limpe o cache do navegador (Ctrl + Shift + Del)
