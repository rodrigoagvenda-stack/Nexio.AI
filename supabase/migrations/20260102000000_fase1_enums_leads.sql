-- ============================================================================
-- MIGRATION: FASE 1 - ENUMs e Campos Leads
-- Data: 2026-01-02
-- Descrição: Criar ENUMs e aplicar nas colunas da tabela leads
-- ============================================================================

-- ============================================================================
-- 1. CRIAR ENUMS
-- ============================================================================

-- Segmento
CREATE TYPE "Segmento" AS ENUM (
  'E-commerce',
  'Saúde/Medicina',
  'Educação',
  'Alimentação',
  'Beleza/Estética',
  'Imobiliária',
  'Advocacia',
  'Consultoria',
  'Tecnologia',
  'Moda/Fashion',
  'Arquitetura',
  'Outros'
);

-- Prioridade
CREATE TYPE "Prioridade" AS ENUM (
  'Alta',
  'Média',
  'Baixa'
);

-- Fonte de importação
CREATE TYPE "Fonte de importação" AS ENUM (
  'PEG',
  'Linkedin',
  'Interno',
  'Meta Ads',
  'Google Ads',
  'Site/Landing Page',
  'Indicação',
  'WhatsApp',
  'TikTok Ads',
  'E-mail Marketing',
  'Evento/Feira'
);

-- Estágio do lead
CREATE TYPE "Estágio do lead" AS ENUM (
  'Lead novo',
  'Em contato',
  'Interessado',
  'Proposta enviada',
  'Fechado',
  'Perdido',
  'Remarketing'
);

-- Status do Lead (Nível de interesse)
CREATE TYPE "Status do Lead" AS ENUM (
  'Quente 🔥',
  'Morno 🟡',
  'Frio ❄️'
);

-- Cargo (role)
CREATE TYPE "Cargo (role)" AS ENUM (
  'Proprietário/Dono',
  'Gerente Comercial',
  'Vendedor',
  'Representante Comercial',
  'Consultor de Vendas'
);

-- ============================================================================
-- 2. APLICAR ENUMS NAS COLUNAS EXISTENTES DA TABELA LEADS
-- ============================================================================

-- Aplicar tipo Segmento
ALTER TABLE leads
  ALTER COLUMN segment TYPE "Segmento"
  USING CASE
    WHEN segment IS NULL THEN NULL
    WHEN segment = 'E-commerce' THEN 'E-commerce'::"Segmento"
    WHEN segment = 'Saúde/Medicina' THEN 'Saúde/Medicina'::"Segmento"
    WHEN segment = 'Educação' THEN 'Educação'::"Segmento"
    WHEN segment = 'Alimentação' THEN 'Alimentação'::"Segmento"
    WHEN segment = 'Beleza/Estética' THEN 'Beleza/Estética'::"Segmento"
    WHEN segment = 'Imobiliária' THEN 'Imobiliária'::"Segmento"
    WHEN segment = 'Advocacia' THEN 'Advocacia'::"Segmento"
    WHEN segment = 'Consultoria' THEN 'Consultoria'::"Segmento"
    WHEN segment = 'Tecnologia' THEN 'Tecnologia'::"Segmento"
    WHEN segment = 'Moda/Fashion' THEN 'Moda/Fashion'::"Segmento"
    WHEN segment = 'Arquitetura' THEN 'Arquitetura'::"Segmento"
    ELSE 'Outros'::"Segmento"
  END;

-- Aplicar tipo Prioridade
ALTER TABLE leads
  ALTER COLUMN priority TYPE "Prioridade"
  USING CASE
    WHEN priority IS NULL THEN NULL
    WHEN priority = 'Alta' THEN 'Alta'::"Prioridade"
    WHEN priority = 'Média' THEN 'Média'::"Prioridade"
    ELSE 'Baixa'::"Prioridade"
  END;

-- Aplicar tipo Fonte de importação
ALTER TABLE leads
  ALTER COLUMN import_source TYPE "Fonte de importação"
  USING CASE
    WHEN import_source IS NULL THEN NULL
    WHEN import_source = 'PEG' THEN 'PEG'::"Fonte de importação"
    WHEN import_source = 'Linkedin' THEN 'Linkedin'::"Fonte de importação"
    WHEN import_source = 'Interno' THEN 'Interno'::"Fonte de importação"
    WHEN import_source = 'Meta Ads' THEN 'Meta Ads'::"Fonte de importação"
    WHEN import_source = 'Google Ads' THEN 'Google Ads'::"Fonte de importação"
    WHEN import_source = 'Site/Landing Page' THEN 'Site/Landing Page'::"Fonte de importação"
    WHEN import_source = 'Indicação' THEN 'Indicação'::"Fonte de importação"
    WHEN import_source = 'WhatsApp' THEN 'WhatsApp'::"Fonte de importação"
    WHEN import_source = 'TikTok Ads' THEN 'TikTok Ads'::"Fonte de importação"
    WHEN import_source = 'E-mail Marketing' THEN 'E-mail Marketing'::"Fonte de importação"
    ELSE 'Evento/Feira'::"Fonte de importação"
  END;

-- Aplicar tipo Estágio do lead
ALTER TABLE leads
  ALTER COLUMN status TYPE "Estágio do lead"
  USING CASE
    WHEN status IS NULL THEN NULL
    WHEN status = 'Lead novo' THEN 'Lead novo'::"Estágio do lead"
    WHEN status = 'Em contato' THEN 'Em contato'::"Estágio do lead"
    WHEN status = 'Interessado' THEN 'Interessado'::"Estágio do lead"
    WHEN status = 'Proposta enviada' THEN 'Proposta enviada'::"Estágio do lead"
    WHEN status = 'Fechado' THEN 'Fechado'::"Estágio do lead"
    WHEN status = 'Perdido' THEN 'Perdido'::"Estágio do lead"
    ELSE 'Remarketing'::"Estágio do lead"
  END;

-- Aplicar tipo Status do Lead (nível de interesse)
ALTER TABLE leads
  ALTER COLUMN nivel_interesse TYPE "Status do Lead"
  USING CASE
    WHEN nivel_interesse IS NULL THEN NULL
    WHEN nivel_interesse LIKE '%🔥%' OR nivel_interesse LIKE '%Quente%' THEN 'Quente 🔥'::"Status do Lead"
    WHEN nivel_interesse LIKE '%🟡%' OR nivel_interesse LIKE '%Morno%' THEN 'Morno 🟡'::"Status do Lead"
    ELSE 'Frio ❄️'::"Status do Lead"
  END;

-- ============================================================================
-- 3. ADICIONAR COLUNA CARGO (se não existir)
-- ============================================================================

ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS cargo "Cargo (role)";

-- ============================================================================
-- 4. ADICIONAR COLUNA project_value SE NÃO EXISTIR (para Valor do Projeto)
-- ============================================================================

-- Já existe como project_value NUMERIC, vamos garantir que existe
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'leads' AND column_name = 'project_value'
  ) THEN
    ALTER TABLE leads ADD COLUMN project_value NUMERIC(12, 2);
  END IF;
END $$;

-- ============================================================================
-- 5. COMENTÁRIOS DAS COLUNAS (documentação)
-- ============================================================================

COMMENT ON COLUMN leads.segment IS 'Segmento de mercado do lead (ENUM)';
COMMENT ON COLUMN leads.priority IS 'Prioridade do lead (ENUM)';
COMMENT ON COLUMN leads.import_source IS 'Fonte de importação do lead (ENUM)';
COMMENT ON COLUMN leads.status IS 'Estágio atual do lead no funil (ENUM)';
COMMENT ON COLUMN leads.nivel_interesse IS 'Nível de interesse/temperatura do lead (ENUM)';
COMMENT ON COLUMN leads.cargo IS 'Cargo/função do contato (ENUM)';
COMMENT ON COLUMN leads.project_value IS 'Valor estimado do projeto em R$';
