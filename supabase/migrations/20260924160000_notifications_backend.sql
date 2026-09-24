-- Backend das notificações: preferências por pessoa, push por pessoa e RLS correto.

-- 1) Preferências de notificação da pessoa (valem em qualquer navegador).
--    Só a API (chave de serviço) lê e grava, depois de conferir quem está logado.
create table if not exists public.user_notification_prefs (
  auth_user_id uuid primary key,
  prefs jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.user_notification_prefs enable row level security;

-- 2) Inscrições de push: a política antiga "push_subs_open" liberava tudo (using true) para qualquer
--    pessoa, inclusive sem login. Endpoint e chaves de uma inscrição permitem enviar push a alguém,
--    então a tabela passa a ser só da chave de serviço. A inscrição agora é da pessoa, não do "primeiro
--    atendente ativo da empresa".
drop policy if exists push_subs_open on public.push_subscriptions;
alter table public.push_subscriptions enable row level security;
alter table public.push_subscriptions alter column attendant_id drop not null;
alter table public.push_subscriptions add column if not exists user_id uuid;
alter table public.push_subscriptions add column if not exists company_id bigint;
alter table public.push_subscriptions add column if not exists user_agent text;
create unique index if not exists push_subscriptions_user_endpoint_idx
  on public.push_subscriptions (user_id, endpoint) where user_id is not null;
create index if not exists push_subscriptions_company_idx on public.push_subscriptions (company_id);

-- 3) Marcar aviso como lido: a política antiga comparava users.user_id em vez de users.auth_user_id
--    (hoje os dois valem o mesmo, mas a coluna certa para "quem está logado" é auth_user_id).
drop policy if exists "Users can update activity logs" on public.activity_logs;
create policy "Users can update activity logs" on public.activity_logs
  for update to authenticated
  using (company_id in (select u.company_id from public.users u where u.auth_user_id = auth.uid()))
  with check (company_id in (select u.company_id from public.users u where u.auth_user_id = auth.uid()));
