-- ================================================
-- SETUP COMPLETO DO BANCO - Execute tudo de uma vez
-- ================================================

-- Habilitar extensão UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ================================================
-- CRIAR TABELA IGREJAS
-- ================================================
CREATE TABLE IF NOT EXISTS igrejas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nome TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('sede', 'congregacao')),
  endereco JSONB,
  responsavel_id UUID,
  telefone TEXT,
  email TEXT,
  capacidade INT,
  logo_url TEXT,
  ativo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ================================================
-- CRIAR TABELA PROFILES
-- ================================================
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  telefone TEXT,
  role TEXT NOT NULL CHECK (role IN ('admin', 'pastor', 'secretaria', 'tesoureiro', 'lider', 'membro')),
  igreja_id UUID REFERENCES igrejas(id) ON DELETE SET NULL,
  foto_url TEXT,
  ativo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ================================================
-- INSERIR IGREJA INICIAL
-- ================================================
INSERT INTO igrejas (
  id,
  nome,
  tipo,
  endereco,
  telefone,
  email,
  ativo
) VALUES (
  'e0a3f3e2-8b5c-4d3e-9f2a-1a2b3c4d5e6f',
  'Igreja Pentecostal Vale da Bênção',
  'sede',
  '{"rua": "Rua Principal, 123", "cidade": "Sua Cidade", "estado": "BA", "cep": "00000-000"}'::jsonb,
  '(00) 00000-0000',
  'contato@igreja.com',
  true
) ON CONFLICT (id) DO NOTHING;

-- ================================================
-- ATUALIZAR PROFILE EXISTENTE
-- ================================================
UPDATE profiles
SET igreja_id = 'e0a3f3e2-8b5c-4d3e-9f2a-1a2b3c4d5e6f'
WHERE id = 'e31dc275-6314-4bb3-9b75-1b68d619b10d';

-- Verificar resultado
SELECT
  p.id,
  p.nome,
  p.email,
  p.role,
  p.igreja_id,
  i.nome as igreja_nome
FROM profiles p
LEFT JOIN igrejas i ON i.id = p.igreja_id
WHERE p.id = 'e31dc275-6314-4bb3-9b75-1b68d619b10d';
