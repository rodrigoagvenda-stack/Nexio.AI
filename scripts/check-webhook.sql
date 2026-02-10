-- Verificar se o webhook WhatsApp está configurado
SELECT
  id,
  webhook_type,
  webhook_url,
  auth_type,
  is_active,
  created_at,
  updated_at
FROM n8n_webhook_config
WHERE webhook_type = 'whatsapp';

-- Se não existir, criar um registro de exemplo
-- Descomente as linhas abaixo e ajuste os valores:
/*
INSERT INTO n8n_webhook_config (
  webhook_type,
  webhook_url,
  auth_type,
  auth_username,
  auth_password,
  is_active
) VALUES (
  'whatsapp',
  'https://nexio-sdr-n8n.g2vop6.easypanel.host/webhook/send-manual-message',
  'basic',
  'SEU_USERNAME_AQUI',
  'SUA_SENHA_AQUI',
  true
)
ON CONFLICT (webhook_type) DO UPDATE SET
  webhook_url = EXCLUDED.webhook_url,
  auth_type = EXCLUDED.auth_type,
  auth_username = EXCLUDED.auth_username,
  auth_password = EXCLUDED.auth_password,
  is_active = EXCLUDED.is_active,
  updated_at = NOW();
*/
