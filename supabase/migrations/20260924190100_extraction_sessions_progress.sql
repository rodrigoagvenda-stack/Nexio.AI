-- Andamento real da busca do Orbit: quantas empresas o Maps devolveu e quantas já foram conferidas.
alter table public.extraction_sessions
  add column if not exists found integer not null default 0,
  add column if not exists processed integer not null default 0;
