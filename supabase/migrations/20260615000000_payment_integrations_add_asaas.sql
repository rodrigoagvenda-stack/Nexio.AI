-- Adiciona 'asaas' ao CHECK constraint de platform em payment_integrations
-- PostgreSQL não permite ALTER CHECK diretamente — drop e recria

ALTER TABLE payment_integrations
  DROP CONSTRAINT IF EXISTS payment_integrations_platform_check;

ALTER TABLE payment_integrations
  ADD CONSTRAINT payment_integrations_platform_check
  CHECK (platform IN ('mercadopago', 'kiwify', 'asaas'));

NOTIFY pgrst, 'reload schema';
