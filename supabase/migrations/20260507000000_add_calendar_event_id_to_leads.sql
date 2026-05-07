-- Adiciona calendar_event_id na tabela leads para permitir cancelamento real no Google Calendar
ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS calendar_event_id text;

-- Adiciona event_title_template em sdr_flows para personalizar título dos eventos no Google Calendar
ALTER TABLE sdr_flows
  ADD COLUMN IF NOT EXISTS event_title_template text;
