-- Add 'system' to the tipo_de_mensagem constraint so test-run system chips can be saved
ALTER TABLE mensagens_do_whatsapp
  DROP CONSTRAINT IF EXISTS mensagens_do_whatsapp_tipo_de_mensagem_check;

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
    'template',
    'system'
  ));
