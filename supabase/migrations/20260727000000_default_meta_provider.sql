-- Novos clientes usam Meta Cloud API (CoEx) por padrao.
-- UAZAPI so fica disponivel quando o admin habilitar explicitamente por empresa.
-- Empresas existentes ja configuradas com UAZAPI nao sao afetadas (DEFAULT so vale para novos inserts).
ALTER TABLE companies ALTER COLUMN allow_uazapi SET DEFAULT FALSE;
ALTER TABLE sdr_configs ALTER COLUMN whatsapp_provider SET DEFAULT 'meta';
