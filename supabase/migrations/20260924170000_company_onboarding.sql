-- Estado do onboarding por empresa: objetivos escolhidos, plano pretendido e se o passo final
-- ("Tudo certo") ainda falta depois do pagamento. Empresas antigas ficam com '{}' e não são afetadas.
--   goals            texto[] com até 2 objetivos: ai_replies | crm | followup | calendar
--   plan_intent      'starter' | 'pro' (plano escolhido no passo 3, ainda não pago)
--   pending_finish   true depois do cadastro e até a pessoa clicar em "Ir para o painel"
--   checklist_hidden true quando a pessoa oculta o card "Primeiros passos"
alter table public.companies add column if not exists onboarding jsonb not null default '{}'::jsonb;
