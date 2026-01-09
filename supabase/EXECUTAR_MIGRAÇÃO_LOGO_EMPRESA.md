# 🚀 Como Corrigir o Upload de Logo da Empresa

## Problema
Não é possível fazer upload do logo da empresa. O sistema retorna erro 500 (Internal Server Error).

## Causa Raiz
As políticas RLS (Row Level Security) do Storage só permitiam uploads na pasta `avatars/`, mas o código tenta fazer upload em `company-logos/`.

## Solução

### Passo 1: Acessar o Supabase SQL Editor
1. Abra o dashboard do Supabase: https://app.supabase.com
2. Selecione seu projeto **Vend.AI**
3. No menu lateral, clique em **SQL Editor**

### Passo 2: Executar o Script de Migração
1. Clique em **"New Query"** (ou qualquer editor em branco)
2. Copie TODO o conteúdo do arquivo `supabase/migrations/20260109000001_fix_company_logo_upload.sql`
3. Cole no SQL Editor
4. Clique em **"Run"** (ou pressione Ctrl/Cmd + Enter)

### Passo 3: Verificar se Funcionou
1. Após executar, você verá a mensagem "Success. No rows returned"
2. Volte para a página de configuração da empresa
3. Tente fazer upload do logo novamente
4. Deve funcionar normalmente agora! ✅

## O que o Script Faz?

### ✅ Adiciona 3 Políticas de Storage:

**1. `Usuarios podem fazer upload de logos de empresa` (INSERT)**
- Permite usuários autenticados fazerem upload na pasta `company-logos/`
- Necessário para criar novos arquivos

**2. `Usuarios podem atualizar logos de empresa` (UPDATE)**
- Permite atualizar logos existentes
- Funciona com a opção `upsert: true` no código

**3. `Usuarios podem deletar logos de empresa` (DELETE)**
- Permite remover logos antigos
- Útil quando o usuário troca o logo da empresa

### Arquivos Afetados no Storage

```
user-uploads/
├── avatars/          ← Fotos de perfil (já funcionava)
└── company-logos/    ← Logos de empresa (agora funciona) ✅
```

### Antes x Depois

**ANTES:**
- ❌ Upload de logo retornava erro 500
- ❌ Apenas pasta 'avatars/' tinha permissões
- ❌ Impossível personalizar a empresa

**DEPOIS:**
- ✅ Upload funciona normalmente
- ✅ Pasta 'company-logos/' com permissões corretas
- ✅ Empresas podem ter logos personalizados
- ✅ Logos são públicos (podem ser vistos por todos)

## Segurança

✅ **Apenas usuários autenticados** podem fazer upload
✅ **Logos são públicos** para exibição na interface
✅ **Limite de 2MB** por arquivo (validado no código)
✅ **Tipos permitidos:** JPG, PNG, WEBP, GIF

## Importante
⚠️ O script usa `DROP POLICY IF EXISTS` + `CREATE POLICY`, então é 100% seguro executar mesmo que as políticas já existam.

## Precisa de Ajuda?
Se continuar com erro após executar a migration:
1. Verifique se o bucket 'user-uploads' existe no Supabase Storage
2. Confirme que o usuário está autenticado
3. Verifique se o arquivo tem menos de 2MB
4. Confirme que o tipo do arquivo é JPG, PNG, WEBP ou GIF
5. Tente limpar o cache do navegador (Ctrl + Shift + Del)
