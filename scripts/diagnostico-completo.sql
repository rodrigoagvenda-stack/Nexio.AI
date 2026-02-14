-- 🔍 DIAGNÓSTICO COMPLETO DOS PROBLEMAS

-- =============================================================================
-- PROBLEMA 1: WEBHOOK 404
-- =============================================================================

-- Verificar se o webhook existe e está ativo
SELECT
  id,
  webhook_type,
  webhook_url,
  auth_type,
  is_active,
  created_at
FROM n8n_webhook_config
WHERE webhook_type = 'whatsapp';

-- Se retornar vazio ou is_active = false, execute o INSERT do arquivo fix-webhook-whatsapp.sql


-- =============================================================================
-- PROBLEMA 2: CHAT ESPELHADO - ERRO 400 (Company ID)
-- =============================================================================

-- Verificar se o usuário tem company_id configurado
SELECT
  id,
  user_id,
  auth_user_id,
  name,
  email,
  company_id,  -- 👈 ESTE CAMPO DEVE ESTAR PREENCHIDO
  role,
  is_active
FROM users
WHERE auth_user_id = 'SEU_AUTH_USER_ID_AQUI';  -- 👈 COLOQUE SEU AUTH USER ID AQUI
-- Para descobrir seu auth_user_id, vá no console do navegador e digite: JSON.parse(localStorage.getItem('sb-[project-ref]-auth-token')).user.id

-- Se company_id estiver NULL, atualize:
/*
UPDATE users
SET company_id = 3  -- 👈 SEU COMPANY ID
WHERE auth_user_id = 'SEU_AUTH_USER_ID_AQUI';
*/


-- =============================================================================
-- PROBLEMA 3: CHAT ESPELHADO - ERRO 400 (Foreign Key)
-- =============================================================================

-- Verificar qual é a coluna primary key da tabela users
SELECT
  c.column_name,
  c.data_type,
  tc.constraint_type
FROM information_schema.columns c
LEFT JOIN information_schema.key_column_usage kcu
  ON c.table_name = kcu.table_name
  AND c.column_name = kcu.column_name
LEFT JOIN information_schema.table_constraints tc
  ON kcu.constraint_name = tc.constraint_name
WHERE c.table_name = 'users'
  AND c.column_name IN ('id', 'user_id')
ORDER BY c.ordinal_position;

-- Verificar as mensagens que estão com sender_user_id incorreto
SELECT
  m.id,
  m.company_id,
  m.id_da_conversacao,
  m.sender_user_id,
  m.sender_type,
  m.direcao,
  m.texto_da_mensagem,
  u.name as user_name,  -- Se esta coluna retornar NULL, o sender_user_id está errado
  CASE
    WHEN u.user_id IS NULL THEN '❌ USUÁRIO NÃO ENCONTRADO'
    ELSE '✅ OK'
  END as status
FROM mensagens_do_whatsapp m
LEFT JOIN users u ON m.sender_user_id = u.user_id  -- 👈 PODE SER 'id' ao invés de 'user_id'
WHERE m.company_id = 3  -- 👈 ALTERE PARA SEU COMPANY_ID
ORDER BY m.carimbo_de_data_e_hora DESC
LIMIT 50;

-- Se muitas mensagens retornarem "USUÁRIO NÃO ENCONTRADO", o problema é a foreign key
-- Execute o script de correção abaixo:

/*
-- CORREÇÃO DA FOREIGN KEY
-- Descobrir qual é a coluna correta (id ou user_id)
SELECT 'id' as coluna_correta FROM users LIMIT 1;
-- OU
SELECT 'user_id' as coluna_correta FROM users LIMIT 1;

-- Depois, recrie a foreign key:
ALTER TABLE mensagens_do_whatsapp
DROP CONSTRAINT IF EXISTS mensagens_do_whatsapp_sender_user_id_fkey;

ALTER TABLE mensagens_do_whatsapp
ADD CONSTRAINT mensagens_do_whatsapp_sender_user_id_fkey
FOREIGN KEY (sender_user_id)
REFERENCES users(user_id)  -- 👈 OU 'id' se for o caso
ON DELETE SET NULL;
*/


-- =============================================================================
-- TESTE FINAL
-- =============================================================================

-- Teste a query que está falhando
SELECT
  m.id,
  m.company_id,
  m.id_da_conversacao,
  m.texto_da_mensagem,
  m.tipo_de_mensagem,
  m.direcao,
  m.sender_type,
  m.sender_user_id,
  m.status,
  m.carimbo_de_data_e_hora,
  m.url_da_midia,
  u.name as user_name
FROM mensagens_do_whatsapp m
LEFT JOIN users u ON m.sender_user_id = u.user_id
WHERE m.id_da_conversacao = 57  -- 👈 ALTERE PARA ID DA SUA CONVERSAÇÃO
  AND m.company_id = 3          -- 👈 ALTERE PARA SEU COMPANY_ID
ORDER BY m.carimbo_de_data_e_hora ASC;

-- Se esta query funcionar mas o frontend continua dando erro 400,
-- o problema está no código TypeScript (na sintaxe do Supabase)
