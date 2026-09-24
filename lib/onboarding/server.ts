import type { SupabaseClient } from '@supabase/supabase-js';
import { ChecklistFacts, OnboardingState, sanitizeGoals } from './model';

/** Lê companies.onboarding de forma segura (o campo pode vir vazio em empresas antigas). */
export function readOnboarding(raw: unknown): OnboardingState {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  return {
    goals: sanitizeGoals(o.goals),
    plan_intent: o.plan_intent === 'starter' || o.plan_intent === 'pro' ? o.plan_intent : undefined,
    pending_finish: o.pending_finish === true,
    checklist_hidden: o.checklist_hidden === true,
  };
}

/** Une mudanças no companies.onboarding sem apagar o que já estava lá. */
export async function patchOnboarding(supabase: SupabaseClient, companyId: number, patch: Partial<OnboardingState>): Promise<boolean> {
  const { data } = await supabase.from('companies').select('onboarding').eq('id', companyId).single();
  if (!data) return false;
  const next = { ...((data.onboarding as Record<string, unknown>) ?? {}), ...patch };
  const { error } = await supabase.from('companies').update({ onboarding: next }).eq('id', companyId);
  return !error;
}

/** O que a empresa já fez de verdade, para marcar cada passo do checklist. */
export async function getChecklistFacts(supabase: SupabaseClient, companyId: number): Promise<ChecklistFacts> {
  const head = { count: 'exact' as const, head: true };
  const [cfg, flows, google, leads, follow] = await Promise.all([
    supabase.from('sdr_configs').select('instance_status, meta_wa_phone_number_id, google_calendar_id').eq('company_id', companyId).maybeSingle(),
    supabase.from('sdr_flows').select('id', head).eq('company_id', companyId),
    supabase.from('google_integrations').select('id', head).eq('company_id', companyId),
    supabase.from('leads').select('id', head).eq('company_id', companyId),
    supabase.from('follow_sequences').select('id', head).eq('company_id', companyId),
  ]);
  return {
    whatsappConnected: cfg.data?.instance_status === 'connected' || !!cfg.data?.meta_wa_phone_number_id,
    hasAgent: (flows.count ?? 0) > 0,
    calendarConnected: (google.count ?? 0) > 0 || !!cfg.data?.google_calendar_id,
    hasLeads: (leads.count ?? 0) > 0,
    hasFollowUp: (follow.count ?? 0) > 0,
  };
}
