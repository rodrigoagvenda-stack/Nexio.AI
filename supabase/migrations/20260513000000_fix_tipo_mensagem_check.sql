-- Remove o constraint antigo que não inclui menu/button/carousel/location/sticker
ALTER TABLE mensagens_do_whatsapp
  DROP CONSTRAINT IF EXISTS mensagens_do_whatsapp_tipo_de_mensagem_check;

-- Recria com todos os tipos suportados
ALTER TABLE mensagens_do_whatsapp
  ADD CONSTRAINT mensagens_do_whatsapp_tipo_de_mensagem_check
  CHECK (tipo_de_mensagem IN (
    'text',
    'image',
    'video',
    'audio',
    'ptt',
    'document',
    'location',
    'sticker',
    'menu',
    'button',
    'carousel',
    'reaction',
    'poll',
    'template'
  ));
