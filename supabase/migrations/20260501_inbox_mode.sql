-- Inbox mode per SDR flow: 'vendas' = round-robin auto-assign, 'suporte' = shared inbox
ALTER TABLE sdr_flows
  ADD COLUMN IF NOT EXISTS inbox_mode text DEFAULT 'suporte'
    CHECK (inbox_mode IN ('vendas', 'suporte'));
