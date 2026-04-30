-- Adiciona campos de vector table ao sdr_configs para empresas sem sdr_flows
ALTER TABLE sdr_configs
  ADD COLUMN IF NOT EXISTS vector_table_conhecimento TEXT,
  ADD COLUMN IF NOT EXISTS vector_table_objecoes TEXT,
  ADD COLUMN IF NOT EXISTS conhecimento_ativo BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS objecoes_ativo BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN sdr_configs.vector_table_conhecimento IS 'Nome da tabela vetorial de conhecimento no Supabase (ex: Nexio_conhecimento)';
COMMENT ON COLUMN sdr_configs.vector_table_objecoes IS 'Nome da tabela vetorial de objeções no Supabase';
COMMENT ON COLUMN sdr_configs.conhecimento_ativo IS 'Habilita busca RAG na tabela de conhecimento';
COMMENT ON COLUMN sdr_configs.objecoes_ativo IS 'Habilita busca RAG na tabela de objeções';
