-- Trava no PRÓPRIO Supabase Auth, para quem chama a API de autenticação direto (a chave anon é pública)
-- e contorna a rota /api/auth/login. As funções só passam a valer depois de ligadas no painel:
--   Authentication > Auth Hooks > "Password verification attempt" -> public.hook_password_verification_attempt
--   Authentication > Auth Hooks > "MFA verification attempt"      -> public.hook_mfa_verification_attempt
-- Regra igual à da rota: 5 falhas em 15 min travam por 5 min (contado da última falha).

create table if not exists public.auth_hook_failures (
  id bigint generated always as identity primary key,
  user_id uuid not null,
  kind text not null,
  created_at timestamptz not null default now()
);

create index if not exists auth_hook_failures_user_idx
  on public.auth_hook_failures (user_id, kind, created_at desc);

alter table public.auth_hook_failures enable row level security;

create or replace function public.hook_auth_attempt(p_user_id uuid, p_kind text, p_valid boolean)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  n int;
  last_fail timestamptz;
begin
  select count(*), max(t.created_at) into n, last_fail
  from (
    select created_at from public.auth_hook_failures
    where user_id = p_user_id and kind = p_kind and created_at > now() - interval '15 minutes'
    order by created_at desc limit 5
  ) t;

  if n >= 5 and last_fail + interval '5 minutes' > now() then
    return jsonb_build_object('decision', 'reject', 'message', 'Muitas tentativas. Tente de novo em alguns minutos.');
  end if;

  if p_valid then
    delete from public.auth_hook_failures where user_id = p_user_id and kind = p_kind;
  else
    insert into public.auth_hook_failures (user_id, kind) values (p_user_id, p_kind);
    delete from public.auth_hook_failures where created_at < now() - interval '1 day';
  end if;

  return jsonb_build_object('decision', 'continue');
end;
$$;

create or replace function public.hook_password_verification_attempt(event jsonb)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select public.hook_auth_attempt((event->>'user_id')::uuid, 'password', coalesce((event->>'valid')::boolean, false));
$$;

create or replace function public.hook_mfa_verification_attempt(event jsonb)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select public.hook_auth_attempt((event->>'user_id')::uuid, 'mfa', coalesce((event->>'valid')::boolean, false));
$$;

grant execute on function public.hook_password_verification_attempt(jsonb) to supabase_auth_admin;
grant execute on function public.hook_mfa_verification_attempt(jsonb) to supabase_auth_admin;
revoke execute on function public.hook_auth_attempt(uuid, text, boolean) from public, anon, authenticated;
revoke execute on function public.hook_password_verification_attempt(jsonb) from public, anon, authenticated;
revoke execute on function public.hook_mfa_verification_attempt(jsonb) from public, anon, authenticated;
grant execute on function public.hook_auth_attempt(uuid, text, boolean) to supabase_auth_admin;
