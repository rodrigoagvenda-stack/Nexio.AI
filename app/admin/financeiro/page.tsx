export const dynamic = 'force-dynamic';

import { createServiceClient } from '@/lib/supabase/server';
import { FinanceiroContent } from '@/components/admin/FinanceiroContent';

export default async function FinanceiroPage() {
  const supabase = createServiceClient();

  // ── Assinaturas ativas ─────────────────────────────────────────────────────
  const { data: subscriptions } = await supabase
    .from('companies')
    .select('id, name, email, plan_type, plan_name, asaas_subscription_id, asaas_customer_id, subscription_start_date, subscription_expires_at, is_active')
    .not('asaas_subscription_id', 'is', null)
    .order('subscription_start_date', { ascending: false });

  // ── Recargas de tokens confirmadas ─────────────────────────────────────────
  const { data: tokenCharges } = await supabase
    .from('extra_package_charges')
    .select(`
      id, amount, tokens_to_grant, status, confirmed_at, created_at, valid_until,
      tenant_id,
      company:companies(name)
    `)
    .order('created_at', { ascending: false });

  // ── Recargas pendentes ─────────────────────────────────────────────────────
  const pendingCharges = (tokenCharges ?? []).filter(c => c.status === 'pending');

  // ── MRR (soma dos planos com subscription ativa) ───────────────────────────
  const PLAN_PRICES: Record<string, number> = {
    starter: 1600, pro: 2000, scale: 2600,
  };
  const activeSubs = (subscriptions ?? []).filter(s => {
    if (!s.subscription_expires_at) return false;
    return new Date(s.subscription_expires_at) > new Date();
  });
  const mrr = activeSubs.reduce((sum, s) => sum + (PLAN_PRICES[s.plan_type ?? ''] ?? 0), 0);

  // ── Receita de tokens (confirmadas) ───────────────────────────────────────
  const tokenRevenue = (tokenCharges ?? [])
    .filter(c => c.status === 'confirmed')
    .reduce((sum, c) => sum + (c.amount ?? 0), 0);

  // ── Pendentes (valor a receber) ────────────────────────────────────────────
  const pendingAmount = pendingCharges.reduce((sum, c) => sum + (c.amount ?? 0), 0);

  return (
    <FinanceiroContent
      subscriptions={subscriptions ?? []}
      tokenCharges={(tokenCharges ?? []) as any}
      stats={{
        mrr,
        activeSubs: activeSubs.length,
        tokenRevenue,
        pendingAmount,
        pendingCount: pendingCharges.length,
      }}
    />
  );
}
