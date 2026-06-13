-- Adiciona 'pagamento' ao CHECK constraint de follow_sequences.tipo
ALTER TABLE follow_sequences DROP CONSTRAINT IF EXISTS follow_sequences_tipo_check;
ALTER TABLE follow_sequences
  ADD CONSTRAINT follow_sequences_tipo_check
  CHECK (tipo IN ('follow_geral', 'anti_noshow', 'remarketing', 'follow_proposta', 'trial_saas', 'pagamento'));

NOTIFY pgrst, 'reload schema';
