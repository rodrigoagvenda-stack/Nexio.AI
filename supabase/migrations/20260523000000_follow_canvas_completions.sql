-- ─── Follow canvas: colunas faltando + constraint trial_saas ─────────────────
-- Colunas adicionadas diretamente no Supabase mas nunca migradas

-- 1. follow_steps — colunas usadas pelo canvas que estavam faltando
ALTER TABLE follow_steps
  ADD COLUMN IF NOT EXISTS tipo_mensagem   text    DEFAULT 'texto',
  ADD COLUMN IF NOT EXISTS media_config    jsonb,
  ADD COLUMN IF NOT EXISTS condicao        text,
  ADD COLUMN IF NOT EXISTS condicao_estagio text,
  ADD COLUMN IF NOT EXISTS sdr_ativo       boolean;

-- 2. follow_sequences — canvas_config (posições + edges do ReactFlow)
ALTER TABLE follow_sequences
  ADD COLUMN IF NOT EXISTS canvas_config jsonb;

-- 3. Expande CHECK de tipo para incluir trial_saas
ALTER TABLE follow_sequences DROP CONSTRAINT IF EXISTS follow_sequences_tipo_check;
ALTER TABLE follow_sequences
  ADD CONSTRAINT follow_sequences_tipo_check
  CHECK (tipo IN ('follow_geral', 'anti_noshow', 'remarketing', 'follow_proposta', 'trial_saas'));

-- 4. RLS policy para follow_executions (se ainda não existir)
ALTER TABLE follow_executions ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "company_isolation_follow_executions" ON follow_executions
  USING (
    sequence_id IN (
      SELECT id FROM follow_sequences
      WHERE company_id IN (
        SELECT company_id FROM users WHERE auth_user_id = auth.uid()
      )
    )
  );
