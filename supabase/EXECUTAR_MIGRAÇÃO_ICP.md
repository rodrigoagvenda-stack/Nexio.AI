# 🚀 Como Corrigir o Erro do ICP Configuration

## Problema
Erro: `Could not find the 'tamanho_empresa' column of 'icp_configuration' in the schema cache`

## Solução

### Passo 1: Acessar o Supabase SQL Editor
1. Abra o dashboard do Supabase: https://app.supabase.com
2. Selecione seu projeto **Vend.AI**
3. No menu lateral, clique em **SQL Editor**

### Passo 2: Executar o Script de Migração
1. Clique em **"New Query"** (ou qualquer editor em branco)
2. Copie TODO o conteúdo do arquivo `supabase/migrations/add_icp_columns.sql`
3. Cole no SQL Editor
4. Clique em **"Run"** (ou pressione Ctrl/Cmd + Enter)

### Passo 3: Verificar se Funcionou
1. Após executar, você verá a mensagem "Success. No rows returned"
2. Volte para a aplicação e tente salvar o ICP novamente
3. Deve funcionar normalmente agora! ✅

## O que o Script Faz?
- ✅ Cria a tabela `icp_configuration` se não existir
- ✅ Adiciona TODAS as colunas necessárias (idade, renda, gênero, escolaridade, nichos, etc.)
- ✅ Configura índices para melhor performance
- ✅ Configura Row Level Security (RLS)
- ✅ Adiciona políticas de segurança para admins e usuários

## Importante
⚠️ O script usa `ADD COLUMN IF NOT EXISTS`, então é 100% seguro executar mesmo que algumas colunas já existam.

## Precisa de Ajuda?
Se continuar com erro, me avise qual mensagem aparece!
