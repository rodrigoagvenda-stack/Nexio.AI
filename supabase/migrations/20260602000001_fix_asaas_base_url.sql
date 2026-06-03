-- Fix: URL base do Asaas estava apontando para o painel web, não a API
-- Correto: https://api-sandbox.asaas.com/v3 (sandbox) | https://api.asaas.com/v3 (produção)
UPDATE platform_config
SET value = 'https://api-sandbox.asaas.com/v3'
WHERE key = 'asaas_base_url'
  AND value = 'https://sandbox.asaas.com/api/v3';
