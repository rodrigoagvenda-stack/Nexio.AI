-- ─── Follow-up v2: novos tipos, pool de mensagens, contexto SDR ──────────────

-- 1. Expande CHECK de tipo em follow_sequences
ALTER TABLE follow_sequences DROP CONSTRAINT IF EXISTS follow_sequences_tipo_check;
ALTER TABLE follow_sequences
  ADD CONSTRAINT follow_sequences_tipo_check
  CHECK (tipo IN ('follow_geral', 'anti_noshow', 'remarketing', 'follow_proposta'));

-- 2. Novos campos em follow_steps
ALTER TABLE follow_steps
  ADD COLUMN IF NOT EXISTS usar_contexto_sdr BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pool_mensagens    JSONB;   -- array de strings, disparo aleatório

-- 3. company_id em follow_executions (para rate-limiting eficiente)
ALTER TABLE follow_executions
  ADD COLUMN IF NOT EXISTS company_id BIGINT REFERENCES companies(id) ON DELETE SET NULL;

UPDATE follow_executions fe
SET    company_id = fs.company_id
FROM   follow_sequences fs
WHERE  fs.id = fe.sequence_id
  AND  fe.company_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_follow_exec_company_time
  ON follow_executions (company_id, disparado_em DESC);

-- 4. respondeu em follow_logs (rastreamento de taxa de resposta)
ALTER TABLE follow_logs
  ADD COLUMN IF NOT EXISTS respondeu BOOLEAN NOT NULL DEFAULT false;
