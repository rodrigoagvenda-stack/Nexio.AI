-- Adicionar coluna resumo_ia na tabela leads
ALTER TABLE leads
ADD COLUMN IF NOT EXISTS resumo_ia TEXT;

-- Criar índice para melhorar performance de busca
CREATE INDEX IF NOT EXISTS idx_leads_resumo_ia ON leads(id) WHERE resumo_ia IS NOT NULL;

-- Comentário explicativo
COMMENT ON COLUMN leads.resumo_ia IS 'Resumo automático gerado pela IA sobre o lead baseado no histórico de conversas';
