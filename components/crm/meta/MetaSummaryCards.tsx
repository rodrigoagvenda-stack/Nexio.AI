'use client'

import { Users, CheckCircle2, DollarSign, TrendingUp, Megaphone } from 'lucide-react'
import { MetricCard } from '@/components/dashboard/MetricCard'
import type { MetaSummary } from './types'

interface MetaSummaryCardsProps {
  summary: MetaSummary
}

export function MetaSummaryCards({ summary }: MetaSummaryCardsProps) {
  const cpl = summary.leads > 0 ? summary.spend / summary.leads : 0

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
      <MetricCard
        title="Leads gerados"
        value={summary.leads}
        subtitle="via Meta Ads"
        icon={Users}
        format="number"
      />
      <MetricCard
        title="Conversões"
        value={summary.conversions}
        subtitle="leads fechados"
        icon={CheckCircle2}
        format="number"
      />
      <MetricCard
        title="Receita"
        value={summary.revenue}
        subtitle="via Meta Ads"
        icon={DollarSign}
        format="currency"
      />
      <MetricCard
        title="Investimento"
        value={summary.spend}
        subtitle="gasto em anúncios"
        icon={Megaphone}
        format="currency"
      />
      <MetricCard
        title="ROAS"
        value={summary.roas.toFixed(2)}
        subtitle={`CPL: ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cpl)}`}
        icon={TrendingUp}
        format="number"
      />
    </div>
  )
}
