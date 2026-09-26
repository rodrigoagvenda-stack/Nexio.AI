-- SDR v3: contadores auxiliares do estado (respostas "outro" seguidas, confiança baixa, horários oferecidos etc.)
alter table public.sdr_conversation_state add column if not exists contadores jsonb not null default '{}'::jsonb;
