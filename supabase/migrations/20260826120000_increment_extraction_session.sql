-- RPC chamada pelo n8n a cada lead com WhatsApp válido extraído (ver
-- app/api/extraction/callback/route.ts). Incremento atômico evita
-- race condition quando múltiplos callbacks chegam em paralelo.
CREATE OR REPLACE FUNCTION increment_extraction_session(p_session_id uuid)
RETURNS integer
LANGUAGE sql
AS $$
  UPDATE extraction_sessions
  SET inserted = inserted + 1
  WHERE id = p_session_id
  RETURNING inserted;
$$;
