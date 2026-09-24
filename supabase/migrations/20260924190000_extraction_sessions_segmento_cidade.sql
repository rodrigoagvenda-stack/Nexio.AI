-- O histórico do Orbit precisa mostrar o que foi buscado (segmento e cidade). Antes isso só existia em activity_logs.metadata.
alter table public.extraction_sessions
  add column if not exists segmento text,
  add column if not exists cidade text,
  add column if not exists uf text;

-- Preenche as buscas antigas a partir do registro de atividade (quando existir)
update public.extraction_sessions s
set segmento = nullif(a.metadata->>'nicho', ''),
    cidade   = nullif(a.metadata->>'cidade', ''),
    uf       = nullif(a.metadata->>'estado', '')
from public.activity_logs a
where a.action = 'prospect_extraction'
  and a.metadata->>'session_id' = s.id::text
  and s.segmento is null and s.cidade is null;
