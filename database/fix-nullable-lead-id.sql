-- ============================================================================
-- FIX: Tornar id_do_lead NULLABLE na tabela mensagens_do_whatsapp
--
-- PROBLEMA: Nem todas as conversas do WhatsApp estão vinculadas a um lead.
-- Usuários podem enviar mensagens para contatos que ainda não são leads no CRM.
--
-- SOLUÇÃO: Remover constraint NOT NULL da coluna id_do_lead
-- ============================================================================

-- Tornar id_do_lead nullable (permitir NULL)
ALTER TABLE mensagens_do_whatsapp
ALTER COLUMN id_do_lead DROP NOT NULL;

-- Verificar a mudança (deve mostrar is_nullable = YES)
SELECT
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'mensagens_do_whatsapp'
    AND column_name = 'id_do_lead';

-- NOTA: Execute este SQL no Supabase SQL Editor
-- Após executar, mensagens podem ser enviadas mesmo sem um lead associado
