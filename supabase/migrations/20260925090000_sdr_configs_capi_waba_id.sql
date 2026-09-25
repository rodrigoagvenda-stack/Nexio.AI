-- ID da conta do WhatsApp Business (WABA) usado no envio de conversões (CAPI) para números que não
-- estão na API oficial (ex.: uazapi). A Meta exige whatsapp_business_account_id ou page_id em user_data
-- para eventos business_messaging. meta_wa_waba_id continua só para a conexão pela API oficial.
ALTER TABLE sdr_configs ADD COLUMN IF NOT EXISTS meta_capi_waba_id text;
