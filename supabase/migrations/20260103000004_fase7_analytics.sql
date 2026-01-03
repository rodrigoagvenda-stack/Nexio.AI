-- ============================================================================
-- FASE 7: Relatórios e Analytics de Atendimento
-- Data: 2026-01-03
-- Descrição: Views e funções para métricas de desempenho do atendimento
-- ============================================================================

-- ============================================================================
-- 1. VIEW: MÉTRICAS GERAIS DE ATENDIMENTO
-- ============================================================================

CREATE OR REPLACE VIEW analytics_overview AS
SELECT
  c.company_id,

  -- Conversas
  COUNT(DISTINCT c.id) as total_chats,
  COUNT(DISTINCT CASE WHEN c.status_da_conversa = 'open' THEN c.id END) as open_chats,
  COUNT(DISTINCT CASE WHEN c.status_da_conversa = 'closed' THEN c.id END) as closed_chats,
  COUNT(DISTINCT CASE WHEN c.contagem_nao_lida > 0 THEN c.id END) as unread_chats,

  -- Mensagens
  COUNT(m.id) as total_messages,
  COUNT(CASE WHEN m.direcao = 'inbound' THEN 1 END) as inbound_messages,
  COUNT(CASE WHEN m.direcao = 'outbound' THEN 1 END) as outbound_messages,

  -- Taxa de resposta
  ROUND(
    COUNT(CASE WHEN m.direcao = 'outbound' THEN 1 END)::numeric /
    NULLIF(COUNT(CASE WHEN m.direcao = 'inbound' THEN 1 END), 0) * 100,
    2
  ) as response_rate_percent,

  -- Atribuição
  COUNT(DISTINCT CASE WHEN c.assigned_to IS NOT NULL THEN c.id END) as assigned_chats,
  COUNT(DISTINCT CASE WHEN c.assigned_to IS NULL THEN c.id END) as unassigned_chats,

  -- Período
  MIN(m.carimbo_de_data_e_hora) as first_message_at,
  MAX(m.carimbo_de_data_e_hora) as last_message_at

FROM conversas_do_whatsapp c
LEFT JOIN mensagens_do_whatsapp m ON m.id_da_conversacao = c.id AND m.company_id = c.company_id
GROUP BY c.company_id;

COMMENT ON VIEW analytics_overview IS 'Visão geral das métricas de atendimento por empresa';

-- ============================================================================
-- 2. VIEW: MÉTRICAS POR USUÁRIO
-- ============================================================================

CREATE OR REPLACE VIEW analytics_by_user AS
SELECT
  c.company_id,
  u.id as user_id,
  u.name as user_name,
  u.email as user_email,

  -- Conversas atribuídas
  COUNT(DISTINCT c.id) as total_assigned_chats,
  COUNT(DISTINCT CASE WHEN c.status_da_conversa = 'open' THEN c.id END) as active_chats,
  COUNT(DISTINCT CASE WHEN c.status_da_conversa = 'closed' THEN c.id END) as resolved_chats,
  COUNT(DISTINCT CASE WHEN c.contagem_nao_lida > 0 THEN c.id END) as chats_with_unread,

  -- Mensagens enviadas
  COUNT(CASE WHEN m.direcao = 'outbound' AND m.sender_user_id = u.user_id THEN 1 END) as messages_sent,

  -- Primeira e última atividade
  MIN(CASE WHEN m.sender_user_id = u.user_id THEN m.carimbo_de_data_e_hora END) as first_activity,
  MAX(CASE WHEN m.sender_user_id = u.user_id THEN m.carimbo_de_data_e_hora END) as last_activity,

  -- Taxa de resolução
  ROUND(
    COUNT(DISTINCT CASE WHEN c.status_da_conversa = 'closed' THEN c.id END)::numeric /
    NULLIF(COUNT(DISTINCT c.id), 0) * 100,
    2
  ) as resolution_rate_percent

FROM users u
LEFT JOIN conversas_do_whatsapp c ON c.assigned_to = u.id AND c.company_id = u.company_id
LEFT JOIN mensagens_do_whatsapp m ON m.id_da_conversacao = c.id AND m.company_id = c.company_id
WHERE u.is_active = TRUE
GROUP BY c.company_id, u.id, u.name, u.email;

COMMENT ON VIEW analytics_by_user IS 'Métricas de desempenho por usuário/atendente';

-- ============================================================================
-- 3. VIEW: MÉTRICAS POR DIA (ÚLTIMOS 30 DIAS)
-- ============================================================================

CREATE OR REPLACE VIEW analytics_daily AS
SELECT
  c.company_id,
  DATE(m.carimbo_de_data_e_hora) as date,

  -- Conversas
  COUNT(DISTINCT c.id) as total_chats,
  COUNT(DISTINCT CASE WHEN c.status_da_conversa = 'open' THEN c.id END) as new_chats,

  -- Mensagens
  COUNT(m.id) as total_messages,
  COUNT(CASE WHEN m.direcao = 'inbound' THEN 1 END) as received_messages,
  COUNT(CASE WHEN m.direcao = 'outbound' THEN 1 END) as sent_messages,

  -- Usuários ativos
  COUNT(DISTINCT m.sender_user_id) as active_users

FROM conversas_do_whatsapp c
INNER JOIN mensagens_do_whatsapp m ON m.id_da_conversacao = c.id AND m.company_id = c.company_id
WHERE m.carimbo_de_data_e_hora >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY c.company_id, DATE(m.carimbo_de_data_e_hora)
ORDER BY date DESC;

COMMENT ON VIEW analytics_daily IS 'Métricas diárias dos últimos 30 dias';

-- ============================================================================
-- 4. VIEW: TEMPO MÉDIO DE RESPOSTA
-- ============================================================================

CREATE OR REPLACE VIEW analytics_response_time AS
WITH response_times AS (
  SELECT
    c.company_id,
    c.id as chat_id,
    c.assigned_to as user_id,
    m1.carimbo_de_data_e_hora as customer_message_time,
    (
      SELECT MIN(m2.carimbo_de_data_e_hora)
      FROM mensagens_do_whatsapp m2
      WHERE m2.id_da_conversacao = c.id
        AND m2.direcao = 'outbound'
        AND m2.carimbo_de_data_e_hora > m1.carimbo_de_data_e_hora
        AND m2.company_id = c.company_id
    ) as agent_response_time,
    EXTRACT(EPOCH FROM (
      (
        SELECT MIN(m2.carimbo_de_data_e_hora)
        FROM mensagens_do_whatsapp m2
        WHERE m2.id_da_conversacao = c.id
          AND m2.direcao = 'outbound'
          AND m2.carimbo_de_data_e_hora > m1.carimbo_de_data_e_hora
          AND m2.company_id = c.company_id
      ) - m1.carimbo_de_data_e_hora
    )) / 60 as response_time_minutes
  FROM conversas_do_whatsapp c
  INNER JOIN mensagens_do_whatsapp m1 ON m1.id_da_conversacao = c.id AND m1.company_id = c.company_id
  WHERE m1.direcao = 'inbound'
    AND m1.carimbo_de_data_e_hora >= CURRENT_DATE - INTERVAL '30 days'
)
SELECT
  company_id,
  user_id,
  COUNT(*) as total_responses,
  ROUND(AVG(response_time_minutes)::numeric, 2) as avg_response_time_minutes,
  ROUND(MIN(response_time_minutes)::numeric, 2) as min_response_time_minutes,
  ROUND(MAX(response_time_minutes)::numeric, 2) as max_response_time_minutes,
  ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY response_time_minutes)::numeric, 2) as median_response_time_minutes
FROM response_times
WHERE response_time_minutes IS NOT NULL
  AND response_time_minutes < 1440 -- Menos de 24 horas
GROUP BY company_id, user_id;

COMMENT ON VIEW analytics_response_time IS 'Tempo médio de resposta por usuário (últimos 30 dias)';

-- ============================================================================
-- 5. VIEW: TOP LEADS POR VOLUME DE MENSAGENS
-- ============================================================================

CREATE OR REPLACE VIEW analytics_top_leads AS
SELECT
  c.company_id,
  l.id as lead_id,
  l.company_name as lead_company,
  l.name as lead_name,
  COUNT(m.id) as total_messages,
  COUNT(CASE WHEN m.direcao = 'inbound' THEN 1 END) as messages_received,
  COUNT(CASE WHEN m.direcao = 'outbound' THEN 1 END) as messages_sent,
  MAX(m.carimbo_de_data_e_hora) as last_message_at,
  c.status_da_conversa as chat_status
FROM conversas_do_whatsapp c
INNER JOIN leads l ON l.id = c.id_do_lead
INNER JOIN mensagens_do_whatsapp m ON m.id_da_conversacao = c.id AND m.company_id = c.company_id
WHERE m.carimbo_de_data_e_hora >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY c.company_id, l.id, l.company_name, l.name, c.status_da_conversa
ORDER BY total_messages DESC
LIMIT 50;

COMMENT ON VIEW analytics_top_leads IS 'Top 50 leads por volume de mensagens (últimos 30 dias)';

-- ============================================================================
-- 6. FUNÇÃO: CALCULAR MÉTRICAS POR PERÍODO
-- ============================================================================

CREATE OR REPLACE FUNCTION get_analytics_by_period(
  p_company_id INTEGER,
  p_start_date TIMESTAMPTZ,
  p_end_date TIMESTAMPTZ
)
RETURNS TABLE (
  date DATE,
  total_chats BIGINT,
  total_messages BIGINT,
  inbound_messages BIGINT,
  outbound_messages BIGINT,
  active_users BIGINT,
  avg_response_time_minutes NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    DATE(m.carimbo_de_data_e_hora) as date,
    COUNT(DISTINCT c.id) as total_chats,
    COUNT(m.id) as total_messages,
    COUNT(CASE WHEN m.direcao = 'inbound' THEN 1 END) as inbound_messages,
    COUNT(CASE WHEN m.direcao = 'outbound' THEN 1 END) as outbound_messages,
    COUNT(DISTINCT m.sender_user_id) as active_users,
    0::numeric as avg_response_time_minutes -- Placeholder
  FROM conversas_do_whatsapp c
  INNER JOIN mensagens_do_whatsapp m ON m.id_da_conversacao = c.id
  WHERE c.company_id = p_company_id
    AND m.company_id = p_company_id
    AND m.carimbo_de_data_e_hora >= p_start_date
    AND m.carimbo_de_data_e_hora <= p_end_date
  GROUP BY DATE(m.carimbo_de_data_e_hora)
  ORDER BY date DESC;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_analytics_by_period IS 'Retorna métricas detalhadas para um período específico';

-- ============================================================================
-- 7. ÍNDICES PARA PERFORMANCE
-- ============================================================================

-- Índice para queries de analytics por data
CREATE INDEX IF NOT EXISTS idx_mensagens_timestamp_company
  ON mensagens_do_whatsapp(company_id, carimbo_de_data_e_hora DESC);

-- Índice para queries de analytics por usuário
CREATE INDEX IF NOT EXISTS idx_mensagens_sender_timestamp
  ON mensagens_do_whatsapp(sender_user_id, carimbo_de_data_e_hora DESC)
  WHERE sender_user_id IS NOT NULL;

-- Índice para queries de conversas por status
CREATE INDEX IF NOT EXISTS idx_conversas_status_company
  ON conversas_do_whatsapp(company_id, status_da_conversa);
