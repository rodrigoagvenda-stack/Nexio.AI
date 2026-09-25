-- Profundidade das conversas que vieram de anúncio (clique para WhatsApp), medida no sistema:
-- quantas conversas o lead respondeu com 2, 3, 5 e 10 ou mais mensagens. Usado no card
-- "Conversas do anúncio" do Dashboard, no lugar dos números de profundidade da Meta (unidades misturadas).
CREATE OR REPLACE FUNCTION ad_conversation_depth(p_company bigint, p_from timestamptz, p_to timestamptz)
RETURNS TABLE (total integer, lead_2 integer, lead_3 integer, lead_5 integer, lead_10 integer)
LANGUAGE sql
STABLE
SECURITY INVOKER
AS $$
  WITH convs AS (
    SELECT DISTINCT a.conversation_id
    FROM attribution_events a
    JOIN conversas_do_whatsapp c ON c.id = a.conversation_id
    WHERE c.company_id = p_company
      AND a.source = 'meta_ctwa'
      AND a.captured_at >= p_from
      AND a.captured_at <= p_to
  ), n AS (
    SELECT cv.conversation_id, count(m.id) FILTER (WHERE m.direcao = 'inbound') AS entrada
    FROM convs cv
    LEFT JOIN mensagens_do_whatsapp m ON m.id_da_conversacao = cv.conversation_id AND m.company_id = p_company
    GROUP BY cv.conversation_id
  )
  SELECT count(*)::integer,
         (count(*) FILTER (WHERE entrada >= 2))::integer,
         (count(*) FILTER (WHERE entrada >= 3))::integer,
         (count(*) FILTER (WHERE entrada >= 5))::integer,
         (count(*) FILTER (WHERE entrada >= 10))::integer
  FROM n;
$$;

-- A função recebe o company_id por parâmetro: só o service role (rotas do servidor) pode chamar.
REVOKE ALL ON FUNCTION ad_conversation_depth(bigint, timestamptz, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION ad_conversation_depth(bigint, timestamptz, timestamptz) TO service_role;
