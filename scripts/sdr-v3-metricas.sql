-- SDR v3: metas da "nota 10" (spec seção 1), só leitura. Rodar semanalmente por empresa.
-- Troque :company e :dias (ex.: 30 e 7).
with t as (
  select l.*, (select string_agg(b, ' ') from jsonb_array_elements_text(coalesce(l.blocos_enviados, '[]')) b) as txt
  from sdr_turn_log l
  where l.engine = 'v3' and l.company_id = :company and l.created_at > now() - make_interval(days => :dias)
),
cfg as (
  select config from sdr_company_configs where company_id = :company order by version desc limit 1
),
proib as (
  -- "=palavra" vale só como palavra inteira (igual ao validador): "=prime" não pega "primeiro"
  select case when p like '=%' then '\m' || lower(substr(p, 2)) || '\M' else lower(p) end re
  from cfg, jsonb_array_elements_text(cfg.config->'palavras_proibidas') p
),
frases as (
  select conversation_id, lower(trim(f)) f
  from t, regexp_split_to_table(t.txt, '(?<=[.!?])\s+') f
  where length(trim(f)) > 25
),
convs as (
  select conversation_id,
         bool_or(acao->>'tipo' = 'oferecer_horarios') ofertou,
         bool_or(acao->>'tipo' = 'agendar' and estado_depois->>'etapa' = 'agendado') agendou,
         bool_or(estado_depois->>'etapa' in ('oferta_horario','confirmando','agendado')) qualificou,
         max(turno) turnos
  from t group by conversation_id
),
estados as (
  select s.conversation_id, p->>'id' id, count(*) n
  from sdr_conversation_state s, jsonb_array_elements(s.perguntas_feitas) p
  where s.company_id = :company and s.updated_at > now() - make_interval(days => :dias)
  group by 1, 2
)
select 'turnos v3' metrica, count(*)::text valor, 'acompanhar' meta from t
union all select 'conversas', (select count(*) from convs)::text, 'acompanhar'
union all select 'valor em R$ enviado', count(*) filter (where txt ~* 'R\$\s?\d')::text,
  case when (select (config->'preco'->>'pode_informar')::boolean from cfg) then 'permitido pela config' else '0' end from t
union all select 'palavra proibida enviada', count(*) filter (where exists (select 1 from proib where lower(t.txt) ~ proib.re))::text, '0' from t
union all select 'turno com 2+ perguntas', count(*) filter (where length(txt) - length(replace(txt, '?', '')) >= 2)::text, '0' from t
union all select 'frase repetida na mesma conversa', (select count(*) from (select conversation_id, f from frases group by 1, 2 having count(*) > 1) x)::text, '0'
union all select 'mesma pergunta feita 3+ vezes', (select count(*) from estados where n >= 3)::text, '0'
union all select 'oferta de horário sem qualificação completa', count(*) filter (where acao->>'tipo' = 'oferecer_horarios' and coalesce(estado_antes->>'etapa','') in ('abertura'))::text, '0' from t
union all select 'V10 agendamento sem evento (bloqueado)', count(*) filter (where validador_violacoes::text like '%"V10"%')::text, '0 enviado' from t
union all select 'conversas que chegaram à oferta de horário', (select count(*) filter (where qualificou) || '/' || count(*) from convs), 'subir'
union all select 'oferta → agendado', (select count(*) filter (where agendou) || '/' || count(*) filter (where ofertou) from convs), 'subir'
union all select 'escalados para humano', count(*) filter (where acao->>'tipo' in ('escalar','escalar_duvida'))::text, 'acompanhar' from t
union all select 'latência média do turno (s)', round(avg(latencia_ms) / 1000.0, 1)::text, 'acompanhar' from t;
