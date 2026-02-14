-- 🔧 FIX: Diagnóstico e correção do chat espelhado
-- Execute passo a passo para identificar o problema

-- PASSO 1: Verificar se há mensagens com sender_user_id NULL ou inválido
SELECT
  id,
  company_id,
  id_da_conversacao,
  sender_user_id,
  sender_type,
  direcao,
  texto_da_mensagem
FROM mensagens_do_whatsapp
WHERE sender_user_id IS NULL
   OR sender_user_id NOT IN (SELECT user_id FROM users)
ORDER BY carimbo_de_data_e_hora DESC
LIMIT 20;

-- PASSO 2: Verificar a foreign key atual
SELECT
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name,
    tc.constraint_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.table_name = 'mensagens_do_whatsapp'
  AND tc.constraint_type = 'FOREIGN KEY';

-- PASSO 3: Verificar estrutura da tabela users
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'users'
  AND column_name IN ('id', 'user_id', 'name');

-- PASSO 4: Verificar estrutura da tabela mensagens_do_whatsapp
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'mensagens_do_whatsapp'
  AND column_name IN ('sender_user_id', 'company_id', 'id_da_conversacao');

-- PASSO 5: Testar query que está falhando
-- Se esta query retornar erro 400, o problema está na foreign key
SELECT
  m.*,
  u.name as user_name
FROM mensagens_do_whatsapp m
LEFT JOIN users u ON m.sender_user_id = u.user_id  -- 👈 PODE SER 'id' ao invés de 'user_id'
WHERE m.id_da_conversacao = 57  -- 👈 ALTERE PARA ID DA SUA CONVERSAÇÃO
  AND m.company_id = 3          -- 👈 ALTERE PARA SEU COMPANY_ID
ORDER BY m.carimbo_de_data_e_hora ASC;

-- POSSÍVEL SOLUÇÃO: Se a foreign key estiver errada, recrie assim:
/*
-- 1. Remover foreign key antiga (se existir)
ALTER TABLE mensagens_do_whatsapp
DROP CONSTRAINT IF EXISTS mensagens_do_whatsapp_sender_user_id_fkey;

-- 2. Adicionar foreign key correta
-- IMPORTANTE: Verifique se a coluna em 'users' é 'id' ou 'user_id'
ALTER TABLE mensagens_do_whatsapp
ADD CONSTRAINT mensagens_do_whatsapp_sender_user_id_fkey
FOREIGN KEY (sender_user_id)
REFERENCES users(user_id)  -- 👈 OU 'id' se for o caso
ON DELETE SET NULL;
*/
