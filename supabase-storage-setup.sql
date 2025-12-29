-- Script para configurar Supabase Storage para logos de empresas
-- Execute este script no Supabase SQL Editor

-- 1. Criar bucket 'public' se não existir
INSERT INTO storage.buckets (id, name, public)
VALUES ('public', 'public', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Permitir uploads públicos no bucket
CREATE POLICY "Public uploads for company logos"
ON storage.objects FOR INSERT
TO public
WITH CHECK (bucket_id = 'public' AND (storage.foldername(name))[1] = 'company-logos');

-- 3. Permitir leitura pública
CREATE POLICY "Public access to company logos"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'public');

-- 4. Permitir updates para donos
CREATE POLICY "Allow updates to company logos"
ON storage.objects FOR UPDATE
TO public
USING (bucket_id = 'public' AND (storage.foldername(name))[1] = 'company-logos');

-- 5. Permitir deletes para donos
CREATE POLICY "Allow deletes of company logos"
ON storage.objects FOR DELETE
TO public
USING (bucket_id = 'public' AND (storage.foldername(name))[1] = 'company-logos');
