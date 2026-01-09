-- ============================================================================
-- FIX: Adicionar política de storage para upload de logos de empresa
-- ============================================================================
--
-- PROBLEMA:
-- Usuários não conseguem fazer upload de logo da empresa porque a política
-- de INSERT no bucket 'user-uploads' só permite uploads na pasta 'avatars',
-- mas o código tenta fazer upload em 'company-logos/'.
--
-- SOLUÇÃO:
-- Criar política que permite usuários autenticados (especialmente admins)
-- fazerem upload na pasta 'company-logos'.
-- ============================================================================

-- Policy para permitir upload de logos de empresa
DROP POLICY IF EXISTS "Usuarios podem fazer upload de logos de empresa" ON storage.objects;
CREATE POLICY "Usuarios podem fazer upload de logos de empresa"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'user-uploads' AND
  (storage.foldername(name))[1] = 'company-logos' AND
  auth.role() = 'authenticated'
);

-- Policy para permitir atualização (upsert) de logos de empresa
DROP POLICY IF EXISTS "Usuarios podem atualizar logos de empresa" ON storage.objects;
CREATE POLICY "Usuarios podem atualizar logos de empresa"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'user-uploads' AND
  (storage.foldername(name))[1] = 'company-logos' AND
  auth.role() = 'authenticated'
);

-- Policy para permitir deletar logos de empresa
DROP POLICY IF EXISTS "Usuarios podem deletar logos de empresa" ON storage.objects;
CREATE POLICY "Usuarios podem deletar logos de empresa"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'user-uploads' AND
  (storage.foldername(name))[1] = 'company-logos' AND
  auth.role() = 'authenticated'
);

-- Comentário: A política de leitura (SELECT) já existe e permite acesso
-- público a todos os arquivos do bucket 'user-uploads'
