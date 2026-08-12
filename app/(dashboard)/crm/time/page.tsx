'use client'

import { useState, useEffect } from 'react'
import { Loader2, Users, TrendingUp, Clock, MessageSquare, DollarSign, Award, BarChart2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface TeamMetrics {
  period_days: number
  summary: {
    total_conversations: number
    closed_deals: number
    total_revenue_cents: number
    conversion_rate: string
    avg_queue_min: number | null
  }
  funnel: { stage: string; count: number }[]
  heatmap: { date: string; count: number }[]
  leaderboard: {
    id: string
    name: string
    email: string
    role: string
    active_conversations: number
    closed_deals: number
    revenue_cents: number
  }[]
  migration_pending?: boolean
}

const STAGE_LABELS: Record<string, string> = {
  novo: 'Novo',
  qualificacao: 'Qualificação',
  fila: 'Fila',
  em_atendimento: 'Em Atendimento',
  negociacao: 'Negociação',
  fechado: 'Fechado',
}

const STAGE_COLORS: Record<string, string> = {
  novo: 'bg-zinc-500',
  qualificacao: 'bg-blue-500',
  fila: 'bg-yellow-500',
  em_atendimento: 'bg-orange-500',
  negociacao: 'bg-purple-500',
  fechado: 'bg-emerald-500',
}

function fmt(cents: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100)
}

function fmtMin(min: number | null) {
  if (min === null) return '-'
  if (min < 60) return `${min}min`
  const h = Math.floor(min / 60)
  const m = min % 60
  return m > 0 ? `${h}h ${m}min` : `${h}h`
}

export default function TimeDashboardPage() {
  const [metrics, setMetrics] = useState<TeamMetrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [days, setDays] = useState(30)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/team-metrics?days=${days}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => setMetrics(d))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [days])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (metrics?.migration_pending) {
    return (
      <div className="p-8 text-center">
        <BarChart2 className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
        <p className="font-medium">Dashboard de Time</p>
        <p className="text-sm text-muted-foreground mt-1">
          Execute a migration <code className="text-xs bg-muted px-1 rounded">20260812000000_prd_zaapply_fase1.sql</code> no Supabase para habilitar esta funcionalidade.
        </p>
      </div>
    )
  }

  if (!metrics) return null

  const { summary, funnel, heatmap, leaderboard } = metrics
  const funnelMax = Math.max(...funnel.map(f => f.count), 1)

  // Heatmap: last N days grid
  const heatmapMap: Record<string, number> = {}
  for (const h of heatmap) heatmapMap[h.date] = h.count
  const heatmapMax = Math.max(...heatmap.map(h => h.count), 1)
  const heatDays: string[] = []
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000)
    heatDays.push(d.toISOString().slice(0, 10))
  }

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold flex items-center gap-2">
            <Users className="h-5 w-5" />
            Dashboard de Time
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">Performance da equipe e funil de conversas</p>
        </div>
        <div className="flex gap-1.5">
          {[7, 14, 30, 90].map(d => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={cn(
                'h-7 px-3 rounded-lg text-xs font-medium transition-colors',
                days === d
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/70'
              )}
            >
              {d}d
            </button>
          ))}
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="p-4 rounded-2xl border border-border bg-card space-y-1">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <MessageSquare className="h-3.5 w-3.5" />
            <p className="text-xs">Conversas</p>
          </div>
          <p className="text-2xl font-semibold tabular-nums">{summary.total_conversations}</p>
          <p className="text-xs text-muted-foreground">últimos {days}d</p>
        </div>

        <div className="p-4 rounded-2xl border border-border bg-card space-y-1">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <TrendingUp className="h-3.5 w-3.5" />
            <p className="text-xs">Taxa de conversão</p>
          </div>
          <p className="text-2xl font-semibold tabular-nums">{summary.conversion_rate}%</p>
          <p className="text-xs text-muted-foreground">{summary.closed_deals} fechamentos</p>
        </div>

        <div className="p-4 rounded-2xl border border-border bg-card space-y-1">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <DollarSign className="h-3.5 w-3.5" />
            <p className="text-xs">Receita total</p>
          </div>
          <p className="text-2xl font-semibold tabular-nums">{fmt(summary.total_revenue_cents)}</p>
          <p className="text-xs text-muted-foreground">negócios fechados</p>
        </div>

        <div className="p-4 rounded-2xl border border-border bg-card space-y-1">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Clock className="h-3.5 w-3.5" />
            <p className="text-xs">Tempo médio na fila</p>
          </div>
          <p className="text-2xl font-semibold tabular-nums">{fmtMin(summary.avg_queue_min)}</p>
          <p className="text-xs text-muted-foreground">por atendimento</p>
        </div>
      </div>

      {/* Funil + Heatmap */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Funil */}
        <div className="p-5 rounded-2xl border border-border bg-card">
          <p className="text-sm font-semibold mb-4">Funil de conversas</p>
          <div className="space-y-2">
            {funnel.map(({ stage, count }) => (
              <div key={stage} className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground w-28 shrink-0">{STAGE_LABELS[stage] ?? stage}</span>
                <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden">
                  <div
                    className={cn('h-2 rounded-full transition-all', STAGE_COLORS[stage] ?? 'bg-primary')}
                    style={{ width: `${Math.max((count / funnelMax) * 100, count > 0 ? 4 : 0)}%` }}
                  />
                </div>
                <span className="text-xs font-mono tabular-nums w-6 text-right">{count}</span>
              </div>
            ))}
          </div>
          {funnel.every(f => f.count === 0) && (
            <p className="text-xs text-muted-foreground text-center mt-4">Nenhuma conversa no período.</p>
          )}
        </div>

        {/* Volume heatmap */}
        <div className="p-5 rounded-2xl border border-border bg-card">
          <p className="text-sm font-semibold mb-4">Volume diário de conversas</p>
          <div className="flex flex-wrap gap-1">
            {heatDays.map(date => {
              const count = heatmapMap[date] ?? 0
              const intensity = count === 0 ? 0 : Math.ceil((count / heatmapMax) * 4)
              const bg = [
                'bg-muted',
                'bg-emerald-500/20',
                'bg-emerald-500/40',
                'bg-emerald-500/70',
                'bg-emerald-500',
              ][intensity]
              return (
                <div
                  key={date}
                  title={`${date}: ${count} conversa${count !== 1 ? 's' : ''}`}
                  className={cn('w-4 h-4 rounded-sm transition-colors cursor-default', bg)}
                />
              )
            })}
          </div>
          <div className="flex items-center gap-1.5 mt-3">
            <span className="text-[10px] text-muted-foreground">Menos</span>
            {['bg-muted', 'bg-emerald-500/20', 'bg-emerald-500/40', 'bg-emerald-500/70', 'bg-emerald-500'].map((b, i) => (
              <div key={i} className={cn('w-3 h-3 rounded-sm', b)} />
            ))}
            <span className="text-[10px] text-muted-foreground">Mais</span>
          </div>
        </div>
      </div>

      {/* Leaderboard */}
      <div className="p-5 rounded-2xl border border-border bg-card">
        <p className="text-sm font-semibold mb-4 flex items-center gap-2">
          <Award className="h-4 w-4" />
          Ranking da equipe
        </p>

        {leaderboard.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            Nenhum atendente cadastrado ainda.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left text-xs font-medium text-muted-foreground pb-2 pr-4">#</th>
                  <th className="text-left text-xs font-medium text-muted-foreground pb-2 pr-4">Atendente</th>
                  <th className="text-right text-xs font-medium text-muted-foreground pb-2 pr-4">Conversas ativas</th>
                  <th className="text-right text-xs font-medium text-muted-foreground pb-2 pr-4">Fechamentos</th>
                  <th className="text-right text-xs font-medium text-muted-foreground pb-2">Receita gerada</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {leaderboard.map((att, idx) => (
                  <tr key={att.id} className={cn(idx === 0 && 'bg-amber-500/5')}>
                    <td className="py-2.5 pr-4">
                      <span className={cn(
                        'text-xs font-bold tabular-nums',
                        idx === 0 ? 'text-amber-500' : idx === 1 ? 'text-zinc-400' : idx === 2 ? 'text-orange-600' : 'text-muted-foreground'
                      )}>
                        {idx + 1}
                      </span>
                    </td>
                    <td className="py-2.5 pr-4">
                      <p className="font-medium text-sm">{att.name}</p>
                      <p className="text-xs text-muted-foreground">{att.email}</p>
                    </td>
                    <td className="py-2.5 pr-4 text-right">
                      <span className="font-mono tabular-nums text-sm">{att.active_conversations}</span>
                    </td>
                    <td className="py-2.5 pr-4 text-right">
                      <span className="font-mono tabular-nums text-sm">{att.closed_deals}</span>
                    </td>
                    <td className="py-2.5 text-right">
                      <span className="font-mono tabular-nums text-sm font-medium">
                        {att.revenue_cents > 0 ? fmt(att.revenue_cents) : '-'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
