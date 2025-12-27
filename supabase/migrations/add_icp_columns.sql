-- ============================================================================
-- MIGRAÇÃO: Adicionar/Atualizar colunas da tabela icp_configuration
-- ============================================================================
-- Execute este SQL no Supabase SQL Editor
-- ============================================================================

-- Primeiro, garantir que a tabela existe
CREATE TABLE IF NOT EXISTS icp_configuration (
  id SERIAL PRIMARY KEY,
  company_id INTEGER UNIQUE REFERENCES companies(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Adicionar todas as colunas do Perfil Demográfico
ALTER TABLE icp_configuration
  ADD COLUMN IF NOT EXISTS idade_min INTEGER,
  ADD COLUMN IF NOT EXISTS idade_max INTEGER,
  ADD COLUMN IF NOT EXISTS renda_min NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS renda_max NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS genero TEXT,
  ADD COLUMN IF NOT EXISTS escolaridade TEXT,
  ADD COLUMN IF NOT EXISTS estados TEXT[],
  ADD COLUMN IF NOT EXISTS regioes TEXT[];

-- Adicionar colunas do Perfil da Empresa
ALTER TABLE icp_configuration
  ADD COLUMN IF NOT EXISTS nichos TEXT[],
  ADD COLUMN IF NOT EXISTS tamanho_empresa TEXT,
  ADD COLUMN IF NOT EXISTS tempo_mercado TEXT,
  ADD COLUMN IF NOT EXISTS empresa_funcionarios TEXT;

-- Adicionar colunas de Preferências de Comunicação
ALTER TABLE icp_configuration
  ADD COLUMN IF NOT EXISTS canais TEXT[],
  ADD COLUMN IF NOT EXISTS preferencia_contato TEXT,
  ADD COLUMN IF NOT EXISTS horario TEXT,
  ADD COLUMN IF NOT EXISTS linguagem TEXT;

-- Adicionar colunas de Perfil Comportamental
ALTER TABLE icp_configuration
  ADD COLUMN IF NOT EXISTS ciclo_compra TEXT,
  ADD COLUMN IF NOT EXISTS comprou_online BOOLEAN,
  ADD COLUMN IF NOT EXISTS influenciador BOOLEAN,
  ADD COLUMN IF NOT EXISTS budget_min NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS budget_max NUMERIC(10,2);

-- Adicionar colunas de Dores e Objetivos
ALTER TABLE icp_configuration
  ADD COLUMN IF NOT EXISTS dores TEXT,
  ADD COLUMN IF NOT EXISTS objetivos TEXT;

-- Adicionar colunas de Configurações de Extração
ALTER TABLE icp_configuration
  ADD COLUMN IF NOT EXISTS leads_por_dia_max INTEGER DEFAULT 3,
  ADD COLUMN IF NOT EXISTS usar_ia BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS entregar_fins_semana BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS notificar_novos_leads BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS prioridade TEXT DEFAULT 'Média';

-- Criar índice para melhor performance
CREATE INDEX IF NOT EXISTS idx_icp_configuration_company_id ON icp_configuration(company_id);

-- Habilitar RLS se ainda não estiver habilitado
ALTER TABLE icp_configuration ENABLE ROW LEVEL SECURITY;

-- Adicionar políticas RLS
DROP POLICY IF EXISTS "service_role_all_icp_config" ON icp_configuration;
CREATE POLICY "service_role_all_icp_config" ON icp_configuration FOR ALL USING (true);

DROP POLICY IF EXISTS "users_own_icp_config" ON icp_configuration;
CREATE POLICY "users_own_icp_config" ON icp_configuration
  FOR SELECT USING (company_id = (SELECT company_id FROM users WHERE auth_user_id = auth.uid()));

DROP POLICY IF EXISTS "admins_manage_icp_config" ON icp_configuration;
CREATE POLICY "admins_manage_icp_config" ON icp_configuration
  FOR ALL USING (auth.uid() IN (SELECT auth_user_id FROM admin_users WHERE is_active = true));

-- Criar trigger para updated_at se ainda não existir
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_icp_configuration_updated_at ON icp_configuration;
CREATE TRIGGER update_icp_configuration_updated_at
  BEFORE UPDATE ON icp_configuration
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- FIM DA MIGRAÇÃO
-- ============================================================================
