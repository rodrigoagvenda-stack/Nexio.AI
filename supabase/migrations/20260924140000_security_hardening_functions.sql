-- Endurecimento apontado pelo advisor de segurança do Supabase.
-- Nenhuma destas funções é chamada com a chave do usuário (anon/authenticated): o código só usa
-- a chave de serviço (service_role), que continua com acesso. As de gatilho não precisam de EXECUTE.

-- 1) Funções SECURITY DEFINER que qualquer visitante ou usuário logado podia chamar por /rest/v1/rpc
do $$
declare
  f record;
begin
  for f in
    select p.oid::regprocedure as sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'count_monthly_leads_extracted', 'get_faturamento', 'get_funil_vendas',
        'get_leads_em_atendimento', 'get_novos_leads', 'get_performance_lead',
        'get_taxa_conversao', 'get_taxa_conversao_geral', 'handle_new_user',
        'increment_tokens_used', 'match_lead_by_phone', 'reset_monthly_counters_if_needed',
        'update_company_leads_counter'
      )
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', f.sig);
    execute format('grant execute on function %s to service_role', f.sig);
  end loop;
end $$;

-- 2) search_path fixo em todas as funções do schema public que ainda estão sem (mantém o comportamento atual)
do $$
declare
  f record;
begin
  for f in
    select p.oid::regprocedure as sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prokind = 'f'
      and not exists (
        select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e'
      )
      and (p.proconfig is null or not exists (
        select 1 from unnest(p.proconfig) c where c like 'search_path=%'
      ))
  loop
    execute format('alter function %s set search_path = public, extensions, pg_temp', f.sig);
  end loop;
end $$;

-- 3) A visão materializada agrega dados de todas as empresas e não deve ser lida pela API pública
revoke select on public.channel_conversion_report from anon, authenticated;
