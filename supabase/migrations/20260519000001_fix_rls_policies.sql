-- ============================================================================
-- FIX: Corrige policies RLS com USING (true) — isolamento por company_id
-- Data: 2026-05-19
-- Problema: tabelas criadas em 20260103000006_chat_completo.sql e
--           20250204_lead_qualification_system.sql tinham policies abertas
--           (USING (true)) sem isolamento por empresa.
-- ============================================================================

-- ============================================================================
-- 1. REACTIONS — tem company_id direto
-- ============================================================================

DROP POLICY IF EXISTS reactions_select_policy ON reactions;
DROP POLICY IF EXISTS reactions_insert_policy ON reactions;
DROP POLICY IF EXISTS reactions_update_policy ON reactions;
DROP POLICY IF EXISTS reactions_delete_policy ON reactions;

CREATE POLICY reactions_select_policy ON reactions FOR SELECT
  USING (company_id IN (
    SELECT company_id FROM users WHERE auth_user_id = auth.uid()
  ));

CREATE POLICY reactions_insert_policy ON reactions FOR INSERT
  WITH CHECK (company_id IN (
    SELECT company_id FROM users WHERE auth_user_id = auth.uid()
  ));

-- reactions não tem UPDATE policy original — adicionada para completude
CREATE POLICY reactions_update_policy ON reactions FOR UPDATE
  USING (company_id IN (
    SELECT company_id FROM users WHERE auth_user_id = auth.uid()
  ));

CREATE POLICY reactions_delete_policy ON reactions FOR DELETE
  USING (company_id IN (
    SELECT company_id FROM users WHERE auth_user_id = auth.uid()
  ));

-- ============================================================================
-- 2. SCHEDULED_MESSAGES — tem company_id direto
-- ============================================================================

DROP POLICY IF EXISTS scheduled_messages_select_policy ON scheduled_messages;
DROP POLICY IF EXISTS scheduled_messages_insert_policy ON scheduled_messages;
DROP POLICY IF EXISTS scheduled_messages_update_policy ON scheduled_messages;
DROP POLICY IF EXISTS scheduled_messages_delete_policy ON scheduled_messages;

CREATE POLICY scheduled_messages_select_policy ON scheduled_messages FOR SELECT
  USING (company_id IN (
    SELECT company_id FROM users WHERE auth_user_id = auth.uid()
  ));

CREATE POLICY scheduled_messages_insert_policy ON scheduled_messages FOR INSERT
  WITH CHECK (company_id IN (
    SELECT company_id FROM users WHERE auth_user_id = auth.uid()
  ));

CREATE POLICY scheduled_messages_update_policy ON scheduled_messages FOR UPDATE
  USING (company_id IN (
    SELECT company_id FROM users WHERE auth_user_id = auth.uid()
  ));

CREATE POLICY scheduled_messages_delete_policy ON scheduled_messages FOR DELETE
  USING (company_id IN (
    SELECT company_id FROM users WHERE auth_user_id = auth.uid()
  ));

-- ============================================================================
-- 3. CHAT_NOTES — tem company_id direto
-- ============================================================================

DROP POLICY IF EXISTS chat_notes_select_policy ON chat_notes;
DROP POLICY IF EXISTS chat_notes_insert_policy ON chat_notes;
DROP POLICY IF EXISTS chat_notes_update_policy ON chat_notes;
DROP POLICY IF EXISTS chat_notes_delete_policy ON chat_notes;

CREATE POLICY chat_notes_select_policy ON chat_notes FOR SELECT
  USING (company_id IN (
    SELECT company_id FROM users WHERE auth_user_id = auth.uid()
  ));

CREATE POLICY chat_notes_insert_policy ON chat_notes FOR INSERT
  WITH CHECK (company_id IN (
    SELECT company_id FROM users WHERE auth_user_id = auth.uid()
  ));

CREATE POLICY chat_notes_update_policy ON chat_notes FOR UPDATE
  USING (company_id IN (
    SELECT company_id FROM users WHERE auth_user_id = auth.uid()
  ));

CREATE POLICY chat_notes_delete_policy ON chat_notes FOR DELETE
  USING (company_id IN (
    SELECT company_id FROM users WHERE auth_user_id = auth.uid()
  ));

-- ============================================================================
-- 4. TAGS — tem company_id direto
-- ============================================================================

DROP POLICY IF EXISTS tags_select_policy ON tags;
DROP POLICY IF EXISTS tags_insert_policy ON tags;
DROP POLICY IF EXISTS tags_update_policy ON tags;
DROP POLICY IF EXISTS tags_delete_policy ON tags;

CREATE POLICY tags_select_policy ON tags FOR SELECT
  USING (company_id IN (
    SELECT company_id FROM users WHERE auth_user_id = auth.uid()
  ));

CREATE POLICY tags_insert_policy ON tags FOR INSERT
  WITH CHECK (company_id IN (
    SELECT company_id FROM users WHERE auth_user_id = auth.uid()
  ));

CREATE POLICY tags_update_policy ON tags FOR UPDATE
  USING (company_id IN (
    SELECT company_id FROM users WHERE auth_user_id = auth.uid()
  ));

CREATE POLICY tags_delete_policy ON tags FOR DELETE
  USING (company_id IN (
    SELECT company_id FROM users WHERE auth_user_id = auth.uid()
  ));

-- ============================================================================
-- 5. LEAD_TAGS — tem company_id direto
-- ============================================================================

DROP POLICY IF EXISTS lead_tags_select_policy ON lead_tags;
DROP POLICY IF EXISTS lead_tags_insert_policy ON lead_tags;
DROP POLICY IF EXISTS lead_tags_update_policy ON lead_tags;
DROP POLICY IF EXISTS lead_tags_delete_policy ON lead_tags;

CREATE POLICY lead_tags_select_policy ON lead_tags FOR SELECT
  USING (company_id IN (
    SELECT company_id FROM users WHERE auth_user_id = auth.uid()
  ));

CREATE POLICY lead_tags_insert_policy ON lead_tags FOR INSERT
  WITH CHECK (company_id IN (
    SELECT company_id FROM users WHERE auth_user_id = auth.uid()
  ));

-- lead_tags não tinha UPDATE policy original, mas adicionada por consistência
CREATE POLICY lead_tags_update_policy ON lead_tags FOR UPDATE
  USING (company_id IN (
    SELECT company_id FROM users WHERE auth_user_id = auth.uid()
  ));

CREATE POLICY lead_tags_delete_policy ON lead_tags FOR DELETE
  USING (company_id IN (
    SELECT company_id FROM users WHERE auth_user_id = auth.uid()
  ));

-- ============================================================================
-- 6. PRODUCTS — tem company_id direto
-- ============================================================================

DROP POLICY IF EXISTS products_select_policy ON products;
DROP POLICY IF EXISTS products_insert_policy ON products;
DROP POLICY IF EXISTS products_update_policy ON products;
DROP POLICY IF EXISTS products_delete_policy ON products;

CREATE POLICY products_select_policy ON products FOR SELECT
  USING (company_id IN (
    SELECT company_id FROM users WHERE auth_user_id = auth.uid()
  ));

CREATE POLICY products_insert_policy ON products FOR INSERT
  WITH CHECK (company_id IN (
    SELECT company_id FROM users WHERE auth_user_id = auth.uid()
  ));

CREATE POLICY products_update_policy ON products FOR UPDATE
  USING (company_id IN (
    SELECT company_id FROM users WHERE auth_user_id = auth.uid()
  ));

CREATE POLICY products_delete_policy ON products FOR DELETE
  USING (company_id IN (
    SELECT company_id FROM users WHERE auth_user_id = auth.uid()
  ));

-- ============================================================================
-- 7. CAROUSEL_CARDS — tem company_id direto
-- ============================================================================

DROP POLICY IF EXISTS carousel_cards_select_policy ON carousel_cards;
DROP POLICY IF EXISTS carousel_cards_insert_policy ON carousel_cards;
DROP POLICY IF EXISTS carousel_cards_update_policy ON carousel_cards;
DROP POLICY IF EXISTS carousel_cards_delete_policy ON carousel_cards;

CREATE POLICY carousel_cards_select_policy ON carousel_cards FOR SELECT
  USING (company_id IN (
    SELECT company_id FROM users WHERE auth_user_id = auth.uid()
  ));

CREATE POLICY carousel_cards_insert_policy ON carousel_cards FOR INSERT
  WITH CHECK (company_id IN (
    SELECT company_id FROM users WHERE auth_user_id = auth.uid()
  ));

CREATE POLICY carousel_cards_update_policy ON carousel_cards FOR UPDATE
  USING (company_id IN (
    SELECT company_id FROM users WHERE auth_user_id = auth.uid()
  ));

CREATE POLICY carousel_cards_delete_policy ON carousel_cards FOR DELETE
  USING (company_id IN (
    SELECT company_id FROM users WHERE auth_user_id = auth.uid()
  ));

-- ============================================================================
-- 8. QUOTATIONS — tem company_id direto
-- ============================================================================

DROP POLICY IF EXISTS quotations_select_policy ON quotations;
DROP POLICY IF EXISTS quotations_insert_policy ON quotations;
DROP POLICY IF EXISTS quotations_update_policy ON quotations;
DROP POLICY IF EXISTS quotations_delete_policy ON quotations;

CREATE POLICY quotations_select_policy ON quotations FOR SELECT
  USING (company_id IN (
    SELECT company_id FROM users WHERE auth_user_id = auth.uid()
  ));

CREATE POLICY quotations_insert_policy ON quotations FOR INSERT
  WITH CHECK (company_id IN (
    SELECT company_id FROM users WHERE auth_user_id = auth.uid()
  ));

CREATE POLICY quotations_update_policy ON quotations FOR UPDATE
  USING (company_id IN (
    SELECT company_id FROM users WHERE auth_user_id = auth.uid()
  ));

CREATE POLICY quotations_delete_policy ON quotations FOR DELETE
  USING (company_id IN (
    SELECT company_id FROM users WHERE auth_user_id = auth.uid()
  ));

-- ============================================================================
-- 9. N8N_WEBHOOK_CONFIG — tabela global de sistema (sem company_id)
--    Acessível apenas via service_role. Usuários autenticados não têm acesso
--    direto — todas as operações passam por API routes server-side.
-- ============================================================================

DROP POLICY IF EXISTS "service_role_all_n8n_config" ON n8n_webhook_config;
DROP POLICY IF EXISTS "n8n_webhook_config_service_all" ON n8n_webhook_config;

-- Nega acesso a anon e authenticated (service_role bypassa RLS por default)
-- Sem policy = sem acesso para roles não-service
-- Garantia explícita: anon não pode ler
CREATE POLICY "n8n_webhook_config_deny_anon" ON n8n_webhook_config
  FOR ALL TO anon
  USING (false)
  WITH CHECK (false);

CREATE POLICY "n8n_webhook_config_deny_authenticated" ON n8n_webhook_config
  FOR ALL TO authenticated
  USING (false)
  WITH CHECK (false);

-- ============================================================================
-- 10. BRIEFING_CONFIG — configuração global de sistema (sem company_id)
--     Igual ao n8n_webhook_config: apenas service_role via API server-side.
-- ============================================================================

DROP POLICY IF EXISTS "briefing_config_service_all" ON briefing_config;

CREATE POLICY "briefing_config_deny_anon" ON briefing_config
  FOR ALL TO anon
  USING (false)
  WITH CHECK (false);

CREATE POLICY "briefing_config_deny_authenticated" ON briefing_config
  FOR ALL TO authenticated
  USING (false)
  WITH CHECK (false);

-- ============================================================================
-- 11. LEAD_QUALIFICATION_CONFIG — configuração global de sistema (sem company_id)
--     Igual ao briefing_config: apenas service_role via API server-side.
-- ============================================================================

DROP POLICY IF EXISTS "lead_qualification_config_service_all" ON lead_qualification_config;

CREATE POLICY "lead_qualification_config_deny_anon" ON lead_qualification_config
  FOR ALL TO anon
  USING (false)
  WITH CHECK (false);

CREATE POLICY "lead_qualification_config_deny_authenticated" ON lead_qualification_config
  FOR ALL TO authenticated
  USING (false)
  WITH CHECK (false);
