-- sdr_products: catálogo de produtos por empresa para o agente de delivery
create table if not exists public.sdr_products (
  id           serial primary key,
  company_id   integer not null references public.companies(id) on delete cascade,
  numero       integer not null,
  nome         text not null,
  descricao    text,
  preco        numeric(10, 2),
  ativo        boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (company_id, numero)
);

-- RLS
alter table public.sdr_products enable row level security;

create policy "empresa lê seus produtos"
  on public.sdr_products for select
  using (
    company_id in (
      select company_id from public.users where auth_user_id = auth.uid()
    )
  );

create policy "empresa gerencia seus produtos"
  on public.sdr_products for all
  using (
    company_id in (
      select company_id from public.users where auth_user_id = auth.uid()
    )
  );

-- updated_at automático
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

create trigger sdr_products_updated_at
  before update on public.sdr_products
  for each row execute function public.set_updated_at();

-- índice para listagem rápida por empresa
create index if not exists sdr_products_company_ativo_idx
  on public.sdr_products (company_id, ativo, numero);
