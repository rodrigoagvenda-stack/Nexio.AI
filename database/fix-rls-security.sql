-- ============================================================
-- Fix RLS Security Warnings
-- Habilita RLS em todas as tabelas sem proteção.
-- O service role (backend) bypassa RLS automaticamente.
-- Clientes diretos (anon/authenticated) ficam bloqueados.
-- ============================================================

-- 1. plans — tabela de planos, leitura pública para usuários autenticados
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "plans_read" ON public.plans;
CREATE POLICY "plans_read" ON public.plans
  FOR SELECT USING (auth.role() = 'authenticated');

-- 2. follow_logs
ALTER TABLE public.follow_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_only" ON public.follow_logs;
CREATE POLICY "service_only" ON public.follow_logs
  USING (false) WITH CHECK (false);

-- 3. remarketing_campaigns
ALTER TABLE public.remarketing_campaigns ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_only" ON public.remarketing_campaigns;
CREATE POLICY "service_only" ON public.remarketing_campaigns
  USING (false) WITH CHECK (false);

-- 4. briefing_mt_responses
ALTER TABLE public.briefing_mt_responses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_only" ON public.briefing_mt_responses;
CREATE POLICY "service_only" ON public.briefing_mt_responses
  USING (false) WITH CHECK (false);

-- 5. outbound_campaigns_errors
ALTER TABLE public.outbound_campaigns_errors ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_only" ON public.outbound_campaigns_errors;
CREATE POLICY "service_only" ON public.outbound_campaigns_errors
  USING (false) WITH CHECK (false);

-- 6. outbound_campaigns
ALTER TABLE public.outbound_campaigns ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_only" ON public.outbound_campaigns;
CREATE POLICY "service_only" ON public.outbound_campaigns
  USING (false) WITH CHECK (false);

-- 7. audit_logs
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_only" ON public.audit_logs;
CREATE POLICY "service_only" ON public.audit_logs
  USING (false) WITH CHECK (false);

-- 8. outbound_limits
ALTER TABLE public.outbound_limits ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_only" ON public.outbound_limits;
CREATE POLICY "service_only" ON public.outbound_limits
  USING (false) WITH CHECK (false);

-- 9. outbound_templates
ALTER TABLE public.outbound_templates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_only" ON public.outbound_templates;
CREATE POLICY "service_only" ON public.outbound_templates
  USING (false) WITH CHECK (false);

-- 10. tocli_informacoes
ALTER TABLE public.tocli_informacoes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_only" ON public.tocli_informacoes;
CREATE POLICY "service_only" ON public.tocli_informacoes
  USING (false) WITH CHECK (false);

-- ============================================================
-- Views com SECURITY DEFINER (vw_leads_disponiveis, vw_financeiro_mensal)
-- Essas views bypassam RLS das tabelas base intencionalmente
-- pois são usadas apenas pelo service role no backend.
-- Para remover o warning, recriar como SECURITY INVOKER:
-- ============================================================

-- Descomente e ajuste se quiser converter as views:
-- CREATE OR REPLACE VIEW public.vw_leads_disponiveis
--   WITH (security_invoker = true) AS
--   <mesma query da view atual>;

-- CREATE OR REPLACE VIEW public.vw_financeiro_mensal
--   WITH (security_invoker = true) AS
--   <mesma query da view atual>;
