-- ID da Página do Facebook usado no envio de conversões (CAPI) quando o número não está na API oficial.
-- A Meta aceita page_id OU whatsapp_business_account_id em user_data de eventos business_messaging.
ALTER TABLE sdr_configs ADD COLUMN IF NOT EXISTS meta_capi_page_id text;
