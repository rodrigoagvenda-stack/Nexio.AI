-- O sino escuta INSERT em activity_logs, mas a tabela não estava na publicação do Realtime,
-- então os avisos do sistema (SDR pediu uma pessoa, teste do SDR) só apareciam ao recarregar.
-- A tabela tem RLS por empresa (só quem é da empresa vê as linhas), então publicar é seguro.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'activity_logs'
  ) then
    alter publication supabase_realtime add table public.activity_logs;
  end if;
end $$;
