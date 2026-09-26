-- Origem de cada mensagem enviada e motivo da pausa do SDR (spec SDR v3, fase 1, itens 4 e 5).
-- Colunas nulas, sem default: nada muda para o que já existe.
--   mensagens_do_whatsapp.source: sdr | funil | follow:<tipo> | remarketing | antinoshow | outbound | humano
--   conversas_do_whatsapp.pause_reason: humano_assumiu | pausar_conversa | midia | recepcao | lead_bloqueado | follow
alter table public.mensagens_do_whatsapp add column if not exists source text;
alter table public.conversas_do_whatsapp add column if not exists pause_reason text;
