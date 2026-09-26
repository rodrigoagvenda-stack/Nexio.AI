-- SDR v3, fase 2 (spec, seções 4, 7 e 8). Só tabelas novas; nada do motor atual depende delas.
-- RLS ligado em todas. Escrita: só o servidor (service role). Leitura: usuários da própria empresa.

-- Estado da conversa (uma linha por conversa)
create table if not exists public.sdr_conversation_state (
  conversation_id bigint primary key,
  company_id bigint not null,
  etapa text not null default 'abertura',
  dados jsonb not null default '{}'::jsonb,
  perguntas_feitas jsonb not null default '[]'::jsonb,
  pedidos_de_preco integer not null default 0,
  recusas integer not null default 0,
  objecoes_respondidas jsonb not null default '[]'::jsonb,
  frases_enviadas jsonb not null default '[]'::jsonb,
  ultima_reacao_social_turno integer not null default 0,
  turno integer not null default 0,
  config_version integer,
  updated_at timestamptz not null default now()
);
create index if not exists idx_sdr_state_company on public.sdr_conversation_state (company_id);

-- Log de turno (motor atual e v3 escrevem aqui, para medir os dois do mesmo jeito)
create table if not exists public.sdr_turn_log (
  id bigserial primary key,
  company_id bigint not null,
  conversation_id bigint not null,
  lead_id bigint,
  turno integer not null,
  engine text not null default 'atual',
  extracao jsonb,
  estado_antes jsonb,
  estado_depois jsonb,
  acao jsonb,
  fatos_recuperados jsonb,
  redator_blocos jsonb,
  validador_violacoes jsonb,
  regenerou boolean not null default false,
  blocos_enviados jsonb,
  modelo text,
  tokens integer,
  latencia_ms integer,
  config_version integer,
  created_at timestamptz not null default now()
);
create index if not exists idx_sdr_turn_conv on public.sdr_turn_log (company_id, conversation_id, turno);
create index if not exists idx_sdr_turn_created on public.sdr_turn_log (company_id, created_at desc);

-- Config versionada por empresa (spec seção 7)
create table if not exists public.sdr_company_configs (
  id bigserial primary key,
  company_id bigint not null,
  version integer not null,
  config jsonb not null,
  ativo boolean not null default false,
  nota text,
  created_by text,
  created_at timestamptz not null default now(),
  unique (company_id, version)
);
create unique index if not exists uq_sdr_company_configs_ativo on public.sdr_company_configs (company_id) where ativo;

alter table public.sdr_conversation_state enable row level security;
alter table public.sdr_turn_log enable row level security;
alter table public.sdr_company_configs enable row level security;

do $$
begin
  if not exists (select 1 from pg_policy where polname = 'sdr_state_le_propria_empresa') then
    create policy sdr_state_le_propria_empresa on public.sdr_conversation_state for select
      using (company_id in (select u.company_id from public.users u where u.auth_user_id = auth.uid()));
  end if;
  if not exists (select 1 from pg_policy where polname = 'sdr_turn_le_propria_empresa') then
    create policy sdr_turn_le_propria_empresa on public.sdr_turn_log for select
      using (company_id in (select u.company_id from public.users u where u.auth_user_id = auth.uid()));
  end if;
  if not exists (select 1 from pg_policy where polname = 'sdr_config_le_propria_empresa') then
    create policy sdr_config_le_propria_empresa on public.sdr_company_configs for select
      using (company_id in (select u.company_id from public.users u where u.auth_user_id = auth.uid()));
  end if;
end $$;
