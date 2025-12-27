-- Criar bucket para uploads de usuários
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
