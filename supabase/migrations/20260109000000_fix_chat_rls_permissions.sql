-- ============================================================================
-- FIX: Adicionar políticas RLS para permitir membros da equipe acessar chat
-- ============================================================================
--
-- PROBLEMA: Atualmente apenas service_role pode acessar conversas e mensagens
-- do WhatsApp. Usuários regulares (membros da equipe/vendedores) não conseguem
-- ver o chat mesmo sendo da mesma empresa.
--
-- SOLUÇÃO: Criar políticas que permitam usuários da mesma empresa acessar
-- conversas e mensagens, similar ao que já existe para leads.
-- ============================================================================

-- Remover políticas antigas se existirem (para recriar corretamente)
DROP POLICY IF EXISTS "users_own_conversas" ON conversas_do_whatsapp;
DROP POLICY IF EXISTS "users_own_mensagens" ON mensagens_do_whatsapp;

-- Criar política para usuários acessarem conversas da própria empresa
CREATE POLICY "users_own_conversas" ON conversas_do_whatsapp
  FOR ALL
  USING (company_id = (SELECT company_id FROM users WHERE auth_user_id = auth.uid()));

-- Criar política para usuários acessarem mensagens das conversas da própria empresa
CREATE POLICY "users_own_mensagens" ON mensagens_do_whatsapp
  FOR ALL
  USING (
    id_da_conversacao IN (
      SELECT id FROM conversas_do_whatsapp
      WHERE company_id = (SELECT company_id FROM users WHERE auth_user_id = auth.uid())
    )
  );

-- Comentário: As políticas service_role já existem e continuam funcionando
-- para operações de backend que usam a SERVICE_ROLE_KEY
