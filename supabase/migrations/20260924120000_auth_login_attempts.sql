-- Falhas de login por e-mail (guardado só o hash) e por IP, para travar tentativa em série.
-- Só falhas são gravadas; login certo apaga as falhas daquele e-mail.
-- RLS ligado e sem policy: só o service role (rota /api/auth/login) lê e escreve.
create table if not exists public.auth_login_attempts (
  id bigint generated always as identity primary key,
  email_hash text not null,
  ip text,
  created_at timestamptz not null default now()
);

create index if not exists auth_login_attempts_email_idx
  on public.auth_login_attempts (email_hash, created_at desc);

create index if not exists auth_login_attempts_ip_idx
  on public.auth_login_attempts (ip, created_at desc);

alter table public.auth_login_attempts enable row level security;
