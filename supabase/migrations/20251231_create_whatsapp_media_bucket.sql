-- Criar bucket para mídias do WhatsApp
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'whatsapp-media',
  'whatsapp-media',
  true, -- Público para permitir que a UAZapi acesse as URLs
  52428800, -- 50 MB
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'audio/webm', 'audio/mpeg', 'audio/ogg', 'video/mp4', 'video/webm', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'text/plain']
)
ON CONFLICT (id) DO NOTHING;

-- Políticas de acesso ao bucket
-- 1. Permitir leitura pública (necessário para UAZapi acessar as mídias)
CREATE POLICY "Permitir leitura pública de mídias do WhatsApp"
ON storage.objects FOR SELECT
USING (bucket_id = 'whatsapp-media');

-- 2. Permitir upload apenas para usuários autenticados da mesma empresa
CREATE POLICY "Permitir upload de mídias para usuários autenticados"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'whatsapp-media'
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] IN (
    SELECT id::text FROM companies
    WHERE id IN (
      SELECT company_id FROM users WHERE auth_user_id = auth.uid()
    )
  )
);

-- 3. Permitir atualização apenas do próprio conteúdo
CREATE POLICY "Permitir atualização de próprias mídias"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'whatsapp-media'
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] IN (
    SELECT id::text FROM companies
    WHERE id IN (
      SELECT company_id FROM users WHERE auth_user_id = auth.uid()
    )
  )
);

-- 4. Permitir deleção apenas do próprio conteúdo
CREATE POLICY "Permitir deleção de próprias mídias"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'whatsapp-media'
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] IN (
    SELECT id::text FROM companies
    WHERE id IN (
      SELECT company_id FROM users WHERE auth_user_id = auth.uid()
    )
  )
);
