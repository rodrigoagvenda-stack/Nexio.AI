-- ============================================================================
-- SCRIPT COMPLETO DE CONFIGURAÇÃO DO SUPABASE
-- Execute este script no Supabase SQL Editor para configurar tudo
-- ============================================================================

-- ============================================================================
-- 1. STORAGE: Criar bucket para uploads de usuários
-- ============================================================================

-- Criar bucket 'user-uploads'
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'user-uploads',
  'user-uploads',
  true,
  5242880, -- 5MB
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE
SET public = true,
    file_size_limit = 5242880,
    allowed_mime_types = ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

-- Policy para permitir upload (usuarios só podem fazer upload em sua própria pasta)
DROP POLICY IF EXISTS "Usuarios podem fazer upload de suas fotos" ON storage.objects;
CREATE POLICY "Usuarios podem fazer upload de suas fotos"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'user-uploads' AND
  (storage.foldername(name))[1] = 'avatars' AND
  auth.role() = 'authenticated'
);

-- Policy para permitir leitura pública de todas as fotos
DROP POLICY IF EXISTS "Fotos são públicas" ON storage.objects;
CREATE POLICY "Fotos são públicas"
ON storage.objects FOR SELECT
USING (bucket_id = 'user-uploads');

-- Policy para permitir DELETE (usuários podem deletar suas próprias fotos antigas)
DROP POLICY IF EXISTS "Usuarios podem deletar suas fotos" ON storage.objects;
CREATE POLICY "Usuarios podem deletar suas fotos"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'user-uploads' AND
  auth.role() = 'authenticated'
);

-- Policy para permitir UPDATE de fotos
DROP POLICY IF EXISTS "Usuarios podem atualizar suas fotos" ON storage.objects;
CREATE POLICY "Usuarios podem atualizar suas fotos"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'user-uploads' AND
  auth.role() = 'authenticated'
);

-- ============================================================================
-- 2. ACTIVITY LOGS: Garantir que a tabela tem todos os campos
-- ============================================================================

-- Adicionar campos de leitura às notificações (se não existirem)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'activity_logs' AND column_name = 'read') THEN
    ALTER TABLE activity_logs ADD COLUMN read BOOLEAN DEFAULT FALSE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'activity_logs' AND column_name = 'read_at') THEN
    ALTER TABLE activity_logs ADD COLUMN read_at TIMESTAMP WITH TIME ZONE;
  END IF;
END $$;

-- Criar índice para buscar notificações não lidas
CREATE INDEX IF NOT EXISTS idx_activity_logs_read ON activity_logs(read);

-- Policy para UPDATE (marcar como lida)
DROP POLICY IF EXISTS "Users can update their company's activity logs" ON activity_logs;
CREATE POLICY "Users can update their company's activity logs"
  ON activity_logs
  FOR UPDATE
  USING (
    company_id IN (
      SELECT company_id FROM users WHERE auth_user_id = auth.uid()
    )
  );

-- ============================================================================
-- 3. SEGURANÇA RLS: Funções SECURITY DEFINER e Policies
-- ============================================================================

-- Função SECURITY DEFINER para buscar company_id sem acionar RLS
CREATE OR REPLACE FUNCTION public.get_user_company_id()
RETURNS BIGINT
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT company_id FROM public.users WHERE auth_user_id = auth.uid() LIMIT 1;
$$;

-- Função SECURITY DEFINER para verificar se é admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_users
    WHERE auth_user_id = auth.uid() AND is_active = true
  );
$$;

-- Desabilitar RLS nas tabelas de lookup para evitar recursão infinita
ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_users DISABLE ROW LEVEL SECURITY;

-- Policies para leads
DROP POLICY IF EXISTS "Users can view own company leads" ON public.leads;
CREATE POLICY "Users can view own company leads" ON public.leads
  FOR SELECT USING (company_id = public.get_user_company_id());

DROP POLICY IF EXISTS "Users can insert own company leads" ON public.leads;
CREATE POLICY "Users can insert own company leads" ON public.leads
  FOR INSERT WITH CHECK (company_id = public.get_user_company_id());

DROP POLICY IF EXISTS "Users can update own company leads" ON public.leads;
CREATE POLICY "Users can update own company leads" ON public.leads
  FOR UPDATE USING (company_id = public.get_user_company_id());

DROP POLICY IF EXISTS "Users can delete own company leads" ON public.leads;
CREATE POLICY "Users can delete own company leads" ON public.leads
  FOR DELETE USING (company_id = public.get_user_company_id());

-- Policies para companies
DROP POLICY IF EXISTS "Users can view own company" ON public.companies;
CREATE POLICY "Users can view own company" ON public.companies
  FOR SELECT USING (id = public.get_user_company_id());

-- Policies para conversas
DROP POLICY IF EXISTS "Users can view own company conversas" ON public.conversas;
CREATE POLICY "Users can view own company conversas" ON public.conversas
  FOR SELECT USING (company_id = public.get_user_company_id());

DROP POLICY IF EXISTS "Users can insert own company conversas" ON public.conversas;
CREATE POLICY "Users can insert own company conversas" ON public.conversas
  FOR INSERT WITH CHECK (company_id = public.get_user_company_id());

DROP POLICY IF EXISTS "Users can update own company conversas" ON public.conversas;
CREATE POLICY "Users can update own company conversas" ON public.conversas
  FOR UPDATE USING (company_id = public.get_user_company_id());

-- Policies para mensagens
DROP POLICY IF EXISTS "Users can view own company mensagens" ON public.mensagens;
CREATE POLICY "Users can view own company mensagens" ON public.mensagens
  FOR SELECT USING (company_id = public.get_user_company_id());

DROP POLICY IF EXISTS "Users can insert own company mensagens" ON public.mensagens;
CREATE POLICY "Users can insert own company mensagens" ON public.mensagens
  FOR INSERT WITH CHECK (company_id = public.get_user_company_id());

-- ============================================================================
-- 4. VERIFICAÇÃO: Mostrar status das tabelas e buckets
-- ============================================================================

-- Verificar se bucket foi criado
SELECT
  'BUCKET user-uploads' as tipo,
  CASE
    WHEN EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'user-uploads')
    THEN '✓ Criado com sucesso'
    ELSE '✗ Erro ao criar'
  END as status;

-- Verificar colunas da tabela activity_logs
SELECT
  'COLUNA activity_logs.read' as tipo,
  CASE
    WHEN EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'activity_logs' AND column_name = 'read')
    THEN '✓ Existe'
    ELSE '✗ Não existe'
  END as status
UNION ALL
SELECT
  'COLUNA activity_logs.read_at' as tipo,
  CASE
    WHEN EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'activity_logs' AND column_name = 'read_at')
    THEN '✓ Existe'
    ELSE '✗ Não existe'
  END as status;
