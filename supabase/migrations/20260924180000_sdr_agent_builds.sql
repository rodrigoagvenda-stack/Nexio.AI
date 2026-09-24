-- Progresso da criação do agente pelo assistente ("Criando a Laura"). O trabalho roda no servidor, então
-- continua mesmo se a pessoa sair da tela; a tela consulta esta tabela para mostrar o andamento real.
-- Só a API (chave de serviço) lê e grava, depois de conferir a empresa de quem está logado.
create table if not exists public.sdr_agent_builds (
  id uuid primary key default gen_random_uuid(),
  company_id bigint not null,
  flow_id uuid not null,
  agent_name text,
  status text not null default 'running' check (status in ('running', 'done', 'error')),
  roteiro_done boolean not null default false,
  objecoes_done boolean not null default false,
  error text,
  chunks integer,
  created_at timestamptz not null default now(),
  finished_at timestamptz
);

create index if not exists sdr_agent_builds_company_flow_idx
  on public.sdr_agent_builds (company_id, flow_id, created_at desc);

alter table public.sdr_agent_builds enable row level security;
