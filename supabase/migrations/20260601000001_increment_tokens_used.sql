-- RPC para incrementar tokens_used na empresa de forma atômica
CREATE OR REPLACE FUNCTION increment_tokens_used(p_company_id INT, p_tokens INT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE companies
  SET tokens_used = COALESCE(tokens_used, 0) + p_tokens
  WHERE id = p_company_id;
END;
$$;
