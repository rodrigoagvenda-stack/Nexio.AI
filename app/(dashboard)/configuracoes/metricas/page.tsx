'use client'

import { useState, useEffect, useCallback } from 'react'
import { cn } from '@/lib/utils/cn'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { toast } from '@/components/ui/use-toast'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts'
import {
  Send, XCircle, MessageSquare, TrendingUp, Users, RefreshCw,
  Clock, CheckCircle2, AlertCircle, BarChart2, Loader2,
  PhoneCall, UserCheck, Activity, Target,
} from 'lucide-react'

// ─── Types ───────────────────────────────────────────────────────────────────

type Periodo = '7d' | '30d' | '90d'

interface Overview {
  total_enviados: number
  total_falhas: number
  total_responderam: number
  taxa_resposta: number
  sequencias_ativas: number
  trials_ativos: number
  leads_remarketing: number
}

interface DiaData {
  data: string
  enviados: number
  falhas: number
  responderam: number
}

interface TipoData {
  tipo: string
  label: string
  enviados: number
  falhas: number
  responderam: number
  taxa_resposta: number
}

interface TrialItem {
  id: number
  nome: string
  whatsapp: string
  status: string
  estagio: string | null
  dia_no_trial: number
  trial_days: number
  criado_em: string
}

interface RemarketingItem {
  id: number
  nome: string
  whatsapp: string
  status: string
  updated_at: string
}

interface ExecucaoItem {
  id: number
  tipo: string
  label: string
  lead_name: string
  lead_status: string
  lead_whatsapp: string
  mensagem: string
  enviado_em: string
  respondeu: boolean
  resposta: string | null
}

interface MetricasData {
  periodo: Periodo
  overview: Overview
  por_dia: DiaData[]
  por_tipo: TipoData[]
  trial: {
    ativos: number
    expirados: number
    convertidos: number
    por_estagio: { estagio: string; count: number }[]
    lista: TrialItem[]
  }
  remarketing: {
    total: number
    responderam: number
    lista: RemarketingItem[]
  }
  ultimas_execucoes: ExecucaoItem[]
}

// ─── Colors ──────────────────────────────────────────────────────────────────

const COLORS = {
  enviados: '#6366f1',
  falhas: '#ef4444',
  responderam: '#22c55e',
  trial: '#f59e0b',
  remarketing: '#8b5cf6',
}

const PIE_COLORS = ['#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899']

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtPhone(p: string) {
  if (!p) return '—'
  const d = p.replace(/\D/g, '')
  if (d.length === 13) return `+${d.slice(0, 2)} (${d.slice(2, 4)}) ${d.slice(4, 9)}-${d.slice(9)}`
  return p
}

function fmtDate(iso: string) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function KpiCard({
  icon: Icon, label, value, sub, color = 'text-indigo-400',
}: {
  icon: any; label: string; value: string | number; sub?: string; color?: string
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-5 flex flex-col gap-2">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Icon className={cn('size-4', color)} />
        {label}
      </div>
      <p className={cn('text-3xl font-bold', color)}>{value}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <div className="h-px flex-1 bg-white/10" />
      <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground px-2">{children}</span>
      <div className="h-px flex-1 bg-white/10" />
    </div>
  )
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-xs shadow-xl">
      <p className="font-semibold mb-1 text-white">{label}</p>
      {payload.map((p: any) => (
        <p key={p.dataKey} style={{ color: p.color }}>
          {p.name}: <strong>{p.value}</strong>
        </p>
      ))}
    </div>
  )
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function MetricasPage() {
  const [periodo, setPeriodo] = useState<Periodo>('30d')
  const [data, setData] = useState<MetricasData | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'overview' | 'trial' | 'remarketing' | 'execucoes'>('overview')

  const load = useCallback(async (p: Periodo) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/metricas?periodo=${p}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Erro ao carregar métricas')
      setData(json)
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load(periodo) }, [periodo, load])

  const PERIODO_LABELS: Record<Periodo, string> = { '7d': '7 dias', '30d': '30 dias', '90d': '90 dias' }
  const TABS = [
    { id: 'overview', label: 'Visão Geral', icon: BarChart2 },
    { id: 'trial', label: 'Trial SaaS', icon: Target },
    { id: 'remarketing', label: 'Remarketing', icon: Users },
    { id: 'execucoes', label: 'Execuções', icon: Activity },
  ] as const

  return (
    <div className="min-h-screen bg-background p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Métricas de Automações</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Follow-up, Trial SaaS e Remarketing — dados em tempo real</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-white/10 overflow-hidden text-sm">
            {(['7d', '30d', '90d'] as Periodo[]).map((p) => (
              <button
                key={p}
                onClick={() => setPeriodo(p)}
                className={cn(
                  'px-4 py-2 transition-colors',
                  periodo === p ? 'bg-indigo-600 text-white' : 'text-muted-foreground hover:bg-white/5'
                )}
              >
                {PERIODO_LABELS[p]}
              </button>
            ))}
          </div>
          <Button variant="outline" size="sm" onClick={() => load(periodo)} disabled={loading}>
            <RefreshCw className={cn('size-4', loading && 'animate-spin')} />
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-white/10">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id as any)}
            className={cn(
              'flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors',
              activeTab === id
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            )}
          >
            <Icon className="size-4" /> {label}
          </button>
        ))}
      </div>

      {loading && (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="size-8 animate-spin text-indigo-400" />
        </div>
      )}

      {!loading && data && (
        <>
          {/* ── VISÃO GERAL ── */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* KPI cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <KpiCard icon={Send} label="Enviados" value={data.overview.total_enviados.toLocaleString('pt-BR')}
                  sub={`últimos ${PERIODO_LABELS[periodo]}`} color="text-indigo-400" />
                <KpiCard icon={TrendingUp} label="Taxa de Resposta" value={`${data.overview.taxa_resposta}%`}
                  sub={`${data.overview.total_responderam} responderam`} color="text-emerald-400" />
                <KpiCard icon={XCircle} label="Falhas" value={data.overview.total_falhas.toLocaleString('pt-BR')}
                  sub="envios com erro" color="text-red-400" />
                <KpiCard icon={CheckCircle2} label="Sequências Ativas" value={data.overview.sequencias_ativas}
                  sub="em execução" color="text-sky-400" />
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <KpiCard icon={Target} label="Trials Ativos" value={data.overview.trials_ativos}
                  sub="no período de teste" color="text-amber-400" />
                <KpiCard icon={Users} label="Em Remarketing" value={data.overview.leads_remarketing}
                  sub="leads neste estágio" color="text-violet-400" />
                <KpiCard icon={MessageSquare} label="Responderam" value={data.overview.total_responderam}
                  sub="total no período" color="text-emerald-400" />
              </div>

              {/* Charts */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Bar chart: disparos por dia */}
                <div className="lg:col-span-2 rounded-xl border border-white/10 bg-white/5 p-5">
                  <h3 className="text-sm font-semibold mb-4">Disparos por dia</h3>
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={data.por_dia} margin={{ top: 0, right: 8, bottom: 0, left: -20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                      <XAxis dataKey="data" tick={{ fontSize: 11, fill: '#888' }} tickLine={false} axisLine={false}
                        interval={Math.floor(data.por_dia.length / 6)} />
                      <YAxis tick={{ fontSize: 11, fill: '#888' }} tickLine={false} axisLine={false} allowDecimals={false} />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <Bar dataKey="enviados" name="Enviados" fill={COLORS.enviados} radius={[3, 3, 0, 0]} />
                      <Bar dataKey="responderam" name="Responderam" fill={COLORS.responderam} radius={[3, 3, 0, 0]} />
                      <Bar dataKey="falhas" name="Falhas" fill={COLORS.falhas} radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* Donut: por tipo */}
                <div className="rounded-xl border border-white/10 bg-white/5 p-5">
                  <h3 className="text-sm font-semibold mb-4">Enviados por tipo</h3>
                  {data.por_tipo.length > 0 ? (
                    <>
                      <ResponsiveContainer width="100%" height={180}>
                        <PieChart>
                          <Pie data={data.por_tipo} dataKey="enviados" nameKey="label"
                            cx="50%" cy="50%" innerRadius={50} outerRadius={80}
                            paddingAngle={3}>
                            {data.por_tipo.map((_, i) => (
                              <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(v, n) => [v, n]} contentStyle={{ background: '#18181b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 12 }} />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="space-y-1.5 mt-2">
                        {data.por_tipo.map((t, i) => (
                          <div key={t.tipo} className="flex items-center justify-between text-xs">
                            <div className="flex items-center gap-2">
                              <div className="size-2.5 rounded-full" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                              <span className="text-muted-foreground">{t.label}</span>
                            </div>
                            <span className="font-medium">{t.enviados}</span>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    <p className="text-xs text-muted-foreground text-center py-8">Sem dados no período</p>
                  )}
                </div>
              </div>

              {/* Por tipo: horizontal bars */}
              {data.por_tipo.length > 0 && (
                <div className="rounded-xl border border-white/10 bg-white/5 p-5">
                  <h3 className="text-sm font-semibold mb-4">Taxa de resposta por tipo de sequência</h3>
                  <div className="space-y-3">
                    {data.por_tipo.sort((a, b) => b.enviados - a.enviados).map((t, i) => (
                      <div key={t.tipo} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2">
                            <div className="size-2.5 rounded-full" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                            <span className="font-medium">{t.label}</span>
                          </div>
                          <div className="flex items-center gap-4 text-muted-foreground">
                            <span>{t.enviados} enviados</span>
                            <span className="text-emerald-400">{t.responderam} responderam</span>
                            <span className="font-semibold text-foreground w-10 text-right">{t.taxa_resposta}%</span>
                          </div>
                        </div>
                        <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                          <div className="h-full rounded-full bg-emerald-500 transition-all"
                            style={{ width: `${t.taxa_resposta}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── TRIAL SAAS ── */}
          {activeTab === 'trial' && (
            <div className="space-y-6">
              {/* Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <KpiCard icon={Target} label="Ativos" value={data.trial.ativos} color="text-amber-400" />
                <KpiCard icon={CheckCircle2} label="Convertidos" value={data.trial.convertidos} color="text-emerald-400" />
                <KpiCard icon={XCircle} label="Expirados" value={data.trial.expirados} color="text-red-400" />
                <KpiCard icon={Activity} label="Estágios únicos" value={data.trial.por_estagio.length} color="text-indigo-400" />
              </div>

              {/* Por estágio + lista */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Estágios */}
                <div className="rounded-xl border border-white/10 bg-white/5 p-5">
                  <h3 className="text-sm font-semibold mb-4">Distribuição por estágio</h3>
                  {data.trial.por_estagio.length > 0 ? (
                    <div className="space-y-3">
                      {data.trial.por_estagio.sort((a, b) => b.count - a.count).map((e, i) => (
                        <div key={e.estagio} className="space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-mono text-muted-foreground">{e.estagio}</span>
                            <span className="font-semibold">{e.count}</span>
                          </div>
                          <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                            <div className="h-full rounded-full transition-all"
                              style={{ width: `${Math.round((e.count / data.trial.ativos) * 100)}%`, background: PIE_COLORS[i % PIE_COLORS.length] }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground text-center py-8">Nenhum estágio definido</p>
                  )}
                </div>

                {/* Tabela trials ativos */}
                <div className="lg:col-span-2 rounded-xl border border-white/10 bg-white/5 overflow-hidden">
                  <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
                    <h3 className="text-sm font-semibold">Leads em trial ativo</h3>
                    <Badge variant="outline" className="text-amber-400 border-amber-400/30 bg-amber-400/10">
                      {data.trial.ativos} ativos
                    </Badge>
                  </div>
                  <div className="overflow-x-auto">
                    {data.trial.lista.length > 0 ? (
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-white/10">
                            <th className="text-left px-5 py-3 text-muted-foreground font-medium">Nome</th>
                            <th className="text-left px-3 py-3 text-muted-foreground font-medium">WhatsApp</th>
                            <th className="text-center px-3 py-3 text-muted-foreground font-medium">Dia</th>
                            <th className="text-left px-3 py-3 text-muted-foreground font-medium">Estágio</th>
                            <th className="text-left px-3 py-3 text-muted-foreground font-medium">Início</th>
                          </tr>
                        </thead>
                        <tbody>
                          {data.trial.lista.map((t) => (
                            <tr key={t.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                              <td className="px-5 py-3 font-medium">{t.nome}</td>
                              <td className="px-3 py-3 text-muted-foreground font-mono">{fmtPhone(t.whatsapp)}</td>
                              <td className="px-3 py-3 text-center">
                                <span className={cn(
                                  'font-bold',
                                  t.dia_no_trial >= t.trial_days ? 'text-red-400' : t.dia_no_trial >= t.trial_days * 0.7 ? 'text-amber-400' : 'text-emerald-400'
                                )}>
                                  D{t.dia_no_trial}
                                </span>
                                <span className="text-muted-foreground">/{t.trial_days}</span>
                              </td>
                              <td className="px-3 py-3">
                                {t.estagio ? (
                                  <Badge variant="outline" className="font-mono text-xs border-indigo-400/30 text-indigo-300 bg-indigo-400/10">
                                    {t.estagio}
                                  </Badge>
                                ) : (
                                  <span className="text-muted-foreground">—</span>
                                )}
                              </td>
                              <td className="px-3 py-3 text-muted-foreground">{fmtDate(t.criado_em)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : (
                      <p className="text-xs text-muted-foreground text-center py-10">Nenhum trial ativo</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── REMARKETING ── */}
          {activeTab === 'remarketing' && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <KpiCard icon={Users} label="Leads em Remarketing" value={data.remarketing.total} color="text-violet-400" />
                <KpiCard icon={MessageSquare} label="Responderam" value={data.remarketing.responderam}
                  sub={`últimos ${PERIODO_LABELS[periodo]}`} color="text-emerald-400" />
                <KpiCard icon={TrendingUp} label="Taxa de Resposta" color="text-indigo-400"
                  value={data.remarketing.total > 0 ? `${Math.round((data.remarketing.responderam / data.remarketing.total) * 100)}%` : '—'} />
              </div>

              <div className="rounded-xl border border-white/10 bg-white/5 overflow-hidden">
                <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
                  <h3 className="text-sm font-semibold">Leads neste estágio</h3>
                  <Badge variant="outline" className="text-violet-400 border-violet-400/30 bg-violet-400/10">
                    {data.remarketing.total} leads
                  </Badge>
                </div>
                {data.remarketing.lista.length > 0 ? (
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-white/10">
                        <th className="text-left px-5 py-3 text-muted-foreground font-medium">Nome</th>
                        <th className="text-left px-3 py-3 text-muted-foreground font-medium">WhatsApp</th>
                        <th className="text-left px-3 py-3 text-muted-foreground font-medium">Status</th>
                        <th className="text-left px-3 py-3 text-muted-foreground font-medium">Atualizado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.remarketing.lista.map((l) => (
                        <tr key={l.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                          <td className="px-5 py-3 font-medium">{l.nome}</td>
                          <td className="px-3 py-3 text-muted-foreground font-mono">{fmtPhone(l.whatsapp)}</td>
                          <td className="px-3 py-3">
                            <Badge variant="outline" className="text-violet-300 border-violet-400/30 bg-violet-400/10">{l.status}</Badge>
                          </td>
                          <td className="px-3 py-3 text-muted-foreground">{fmtDate(l.updated_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p className="text-xs text-muted-foreground text-center py-10">Nenhum lead em Remarketing</p>
                )}
              </div>
            </div>
          )}

          {/* ── EXECUÇÕES ── */}
          {activeTab === 'execucoes' && (
            <div className="space-y-4">
              <div className="rounded-xl border border-white/10 bg-white/5 overflow-hidden">
                <div className="px-5 py-4 border-b border-white/10">
                  <h3 className="text-sm font-semibold">Últimas execuções de follow-up</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">Mensagens enviadas pelas sequências automáticas</p>
                </div>
                {data.ultimas_execucoes.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-white/10">
                          <th className="text-left px-5 py-3 text-muted-foreground font-medium">Lead</th>
                          <th className="text-left px-3 py-3 text-muted-foreground font-medium">Tipo</th>
                          <th className="text-left px-3 py-3 text-muted-foreground font-medium">Mensagem</th>
                          <th className="text-center px-3 py-3 text-muted-foreground font-medium">Respondeu</th>
                          <th className="text-left px-3 py-3 text-muted-foreground font-medium">Resposta</th>
                          <th className="text-left px-3 py-3 text-muted-foreground font-medium">Enviado</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.ultimas_execucoes.map((ex) => (
                          <tr key={ex.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                            <td className="px-5 py-3">
                              <p className="font-medium">{ex.lead_name}</p>
                              <p className="text-muted-foreground font-mono">{fmtPhone(ex.lead_whatsapp)}</p>
                            </td>
                            <td className="px-3 py-3">
                              <Badge variant="outline" className="text-xs border-white/20">{ex.label}</Badge>
                            </td>
                            <td className="px-3 py-3 text-muted-foreground max-w-[200px] truncate">{ex.mensagem}</td>
                            <td className="px-3 py-3 text-center">
                              {ex.respondeu
                                ? <CheckCircle2 className="size-4 text-emerald-400 mx-auto" />
                                : <AlertCircle className="size-4 text-muted-foreground/40 mx-auto" />}
                            </td>
                            <td className="px-3 py-3 text-muted-foreground max-w-[200px] truncate">
                              {ex.resposta ?? <span className="text-white/20">—</span>}
                            </td>
                            <td className="px-3 py-3 text-muted-foreground whitespace-nowrap">{fmtDate(ex.enviado_em)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground text-center py-10">Nenhuma execução no período</p>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
