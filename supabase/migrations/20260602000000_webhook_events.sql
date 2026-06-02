-- Tabela de idempotência para webhooks Asaas
-- Garante que o mesmo evento não seja processado mais de uma vez
-- mesmo que o Asaas entregue duplicatas ("at least once delivery")

CREATE TABLE IF NOT EXISTS webhook_events (
  id         bigserial    PRIMARY KEY,
  event_key  text         NOT NULL UNIQUE,  -- "PAYMENT_RECEIVED:pay_xxx"
  event      text         NOT NULL,
  payment_id text         NOT NULL,
  processed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS webhook_events_event_key_idx    ON webhook_events (event_key);
CREATE INDEX IF NOT EXISTS webhook_events_processed_at_idx ON webhook_events (processed_at);

-- RLS: apenas service_role pode ler/gravar
ALTER TABLE webhook_events ENABLE ROW LEVEL SECURITY;

-- Cleanup automático: deleta eventos com mais de 15 dias
-- (Asaas mantém eventos por 14 dias; 1 dia de margem)
-- Execute via pg_cron ou cron job separado:
-- DELETE FROM webhook_events WHERE processed_at < now() - interval '15 days';
