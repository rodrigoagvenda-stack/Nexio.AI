'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ChartContainer, ChartConfig } from '@/components/ui/chart'
import { toast } from '@/components/ui/use-toast'
import { cn } from '@/lib/utils/cn'
import { Bar, BarChart, CartesianGrid, XAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import {
  Send, XCircle, MessageSquare, TrendingUp, Users, RefreshCw, CheckCircle2, AlertCircle,
  BarChart2, Loader2, Target, Activity, ChevronLeft, ChevronRight, Download, Search,
  ArrowUpRight, ArrowDownRight, Minus, AlertTriangle, Flame, Thermometer, Snowflake,
  Clock, TrendingDown,
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

type Periodo = '7d' | '30d' | '90d'

interface MetricasData {
  periodo: Periodo
  overview: {
    total_enviados: number; total_falhas: number; total_responderam: number; taxa_resposta: number
    sequencias_ativas: number; trials_ativos: number; leads_remarketing: number; leads_frios: number
    delta_enviados: number; delta_responderam: number; delta_taxa_resposta: number; delta_trials: number
  }
  funil: { etapa: string; count: number; pct: number }[]
  por_dia: { data: string; enviados: number; falhas: number; responderam: number }[]
  por_tipo: { tipo: string; label: string; enviados: number; falhas: number; responderam: number; taxa_resposta: number }[]
  heatmap: { hora: number; dom: number; seg: number; ter: number; qua: number; qui: number; sex: number; sab: number }[]
  ranking_sequencias: { id: string; nome: string; tipo: string; label: string; enviados: number; falhas: number; responderam: number; taxa_resposta: number }[]
  trial: {
    ativos: number; expirados: number; convertidos: number; conversion_rate: number; avg_days_to_convert: number | null
    por_estagio: { estagio: string; count: number }[]
    lista: { id: number; nome: string; whatsapp: string; status: string; estagio: string | null; dia_no_trial: number; trial_days: number; criado_em: string }[]
    expirando: { id: number; nome: string; whatsapp: string; estagio: string | null; dia_no_trial: number; trial_days: number }[]
  }
  remarketing: {
    total: number; responderam: number
    lista: { id: number; nome: string; whatsapp: string; status: string; updated_at: string }[]
  }
  anti_noshow: { enviados: number; responderam: number; taxa_resposta: number; lista: any[] }
  follow_proposta: { enviados: number; responderam: number; taxa_resposta: number; lista: any[] }
  leads_frios: { id: number; nome: string; whatsapp: string; status: string; total_msgs: number }[]
  ultimas_execucoes: {
    id: number; tipo: string; label: string; lead_name: string; lead_status: string
    lead_whatsapp: string; mensagem: string; enviado_em: string; respondeu: boolean; resposta: string | null
  }[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtPhone(p: string) {
  const d = (p ?? '').replace(/\D/g, '')
  if (d.length === 13) return `+${d.slice(0,2)} (${d.slice(2,4)}) ${d.slice(4,9)}-${d.slice(9)}`
  return p || '—'
}
function fmtDate(iso: string) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('pt-BR', { day:'2-digit', month:'2-digit', year:'2-digit', hour:'2-digit', minute:'2-digit' })
}
function exportCSV(rows: object[], filename: string) {
  if (!rows.length) return
  const keys = Object.keys(rows[0])
  const csv = [keys.join(','), ...rows.map((r: any) => keys.map((k) => `"${String(r[k] ?? '').replace(/"/g, '""')}"`).join(','))].join('\n')
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
  a.download = filename; a.click()
}

// ─── Hooks ────────────────────────────────────────────────────────────────────

function usePagination<T>(items: T[], perPage: number) {
  const [page, setPage] = useState(1)
  const totalPages = Math.max(1, Math.ceil(items.length / perPage))
  const safePage = Math.min(page, totalPages)
  return { page: safePage, setPage, totalPages, slice: items.slice((safePage-1)*perPage, safePage*perPage), total: items.length }
}

function useSearch<T>(items: T[], keys: (keyof T)[]) {
  const [q, setQ] = useState('')
  const filtered = q.trim()
    ? items.filter((item) => keys.some((k) => String((item as any)[k] ?? '').toLowerCase().includes(q.toLowerCase())))
    : items
  return { q, setQ, filtered }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Pagination({ page, totalPages, setPage, total, perPage }: { page:number; totalPages:number; setPage:(p:number)=>void; total:number; perPage:number }) {
  if (totalPages <= 1) return null
  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-border text-xs text-muted-foreground">
      <span>{(page-1)*perPage+1}–{Math.min(page*perPage, total)} de {total}</span>
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="icon" className="h-7 w-7" disabled={page===1} onClick={()=>setPage(page-1)}>
          <ChevronLeft className="h-3.5 w-3.5" />
        </Button>
        {Array.from({length:totalPages},(_,i)=>i+1).map((p)=>(
          <button key={p} onClick={()=>setPage(p)} className={cn('h-7 w-7 rounded-md text-xs font-medium transition-colors', p===page?'bg-primary text-primary-foreground':'hover:bg-muted')}>{p}</button>
        ))}
        <Button variant="ghost" size="icon" className="h-7 w-7" disabled={page===totalPages} onClick={()=>setPage(page+1)}>
          <ChevronRight className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  )
}

function Delta({ value, suffix = '%', inverse = false }: { value: number; suffix?: string; inverse?: boolean }) {
  const positive = inverse ? value < 0 : value > 0
  const neutral = value === 0
  if (neutral) return <span className="flex items-center gap-0.5 text-xs text-muted-foreground"><Minus className="h-3 w-3" />0{suffix}</span>
  return (
    <span className={cn('flex items-center gap-0.5 text-xs font-medium', positive ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive')}>
      {positive ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
      {Math.abs(value)}{suffix}
    </span>
  )
}

function KpiCard({ icon: Icon, label, value, sub, delta, deltaLabel, highlight }: {
  icon: any; label: string; value: string | number; sub?: string
  delta?: number; deltaLabel?: string; highlight?: boolean
}) {
  return (
    <Card className={cn('hover:shadow-md transition-all', highlight && 'border-primary/30 bg-primary/5')}>
      <CardContent className="p-4 md:p-5">
        <div className="flex items-start justify-between gap-2">
          <div className={cn('p-2 rounded-lg', highlight ? 'bg-primary/15' : 'bg-primary/10')}>
            <Icon className="h-4 w-4 text-primary" />
          </div>
          {delta !== undefined && <Delta value={delta} />}
        </div>
        <div className="mt-3">
          <p className="text-2xl font-bold">{value}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
          {sub && <p className="text-[10px] text-muted-foreground/60 mt-0.5">{sub}</p>}
          {deltaLabel && delta !== undefined && <p className="text-[10px] text-muted-foreground/50 mt-1">{deltaLabel}</p>}
        </div>
      </CardContent>
    </Card>
  )
}

function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-lg bg-muted', className)} />
}

function PageSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
        {Array(4).fill(0).map((_, i) => <Skeleton key={i} className="h-28" />)}
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <Skeleton className="lg:col-span-2 h-72" />
        <Skeleton className="h-72" />
      </div>
    </div>
  )
}

// ─── Funnel ───────────────────────────────────────────────────────────────────

function Funil({ data }: { data: MetricasData['funil'] }) {
  const max = data[0]?.count ?? 1
  const colors = ['#15803d', '#16a34a', '#22c55e', '#4ade80']
  return (
    <div className="space-y-3">
      {data.map((step, i) => (
        <div key={step.etapa}>
          <div className="flex items-center justify-between text-sm mb-1.5">
            <span className="font-medium">{step.etapa}</span>
            <div className="flex items-center gap-3">
              <span className="font-bold text-foreground">{step.count.toLocaleString('pt-BR')}</span>
              <span className="text-xs text-muted-foreground w-10 text-right">{step.pct}%</span>
            </div>
          </div>
          <div className="h-8 rounded-md bg-muted overflow-hidden">
            <div
              className="h-full rounded-md flex items-center px-3 text-xs font-semibold text-white transition-all duration-700"
              style={{ width: max > 0 ? `${Math.max((step.count / max) * 100, 2)}%` : '2%', background: colors[i] }}
            >
              {step.pct > 15 && step.etapa}
            </div>
          </div>
          {i < data.length - 1 && step.count > 0 && (
            <p className="text-[10px] text-muted-foreground mt-1 text-right">
              ↓ {data[i+1].count > 0 ? Math.round((data[i+1].count / step.count) * 100) : 0}% avançam
            </p>
          )}
        </div>
      ))}
    </div>
  )
}

// ─── Heatmap ──────────────────────────────────────────────────────────────────

function Heatmap({ data }: { data: MetricasData['heatmap'] }) {
  const days = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'] as const
  const dayKeys = ['dom','seg','ter','qua','qui','sex','sab'] as const
  const allValues = data.flatMap((r) => dayKeys.map((k) => r[k]))
  const maxVal = Math.max(...allValues, 1)

  function intensity(v: number) {
    const p = v / maxVal
    if (p === 0) return 'bg-muted'
    if (p < 0.25) return 'bg-emerald-100 dark:bg-emerald-950'
    if (p < 0.5) return 'bg-emerald-300 dark:bg-emerald-800'
    if (p < 0.75) return 'bg-emerald-500 dark:bg-emerald-600'
    return 'bg-emerald-700 dark:bg-emerald-400'
  }

  const hours = [0,6,9,12,15,18,21]
  const shown = data.filter((r) => hours.includes(r.hora))

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[480px]">
        <div className="flex items-center mb-2">
          <div className="w-12" />
          {days.map((d) => <div key={d} className="flex-1 text-center text-xs text-muted-foreground font-medium">{d}</div>)}
        </div>
        <div className="space-y-1">
          {shown.map((row) => (
            <div key={row.hora} className="flex items-center gap-1">
              <div className="w-12 text-xs text-muted-foreground text-right pr-2">
                {String(row.hora).padStart(2,'0')}h
              </div>
              {dayKeys.map((k) => (
                <div key={k} className="flex-1 flex items-center justify-center">
                  <div
                    title={`${days[dayKeys.indexOf(k)]} ${row.hora}h — ${row[k]} respostas`}
                    className={cn('w-full h-8 rounded text-[10px] flex items-center justify-center font-medium transition-colors cursor-default', intensity(row[k]))}
                  >
                    {row[k] > 0 && <span className={cn(row[k]/maxVal > 0.4 ? 'text-white' : 'text-foreground')}>{row[k]}</span>}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
        <div className="flex items-center gap-2 mt-3 justify-end">
          <span className="text-xs text-muted-foreground">Menos</span>
          {['bg-muted','bg-emerald-100 dark:bg-emerald-950','bg-emerald-300 dark:bg-emerald-800','bg-emerald-500 dark:bg-emerald-600','bg-emerald-700 dark:bg-emerald-400'].map((c,i)=>(
            <div key={i} className={cn('h-4 w-6 rounded', c)} />
          ))}
          <span className="text-xs text-muted-foreground">Mais</span>
        </div>
      </div>
    </div>
  )
}

// ─── Chart config ─────────────────────────────────────────────────────────────

const chartCfg: ChartConfig = {
  enviados:    { label: 'Enviados',    color: '#15803d' },
  responderam: { label: 'Responderam', color: '#4ade80' },
  falhas:      { label: 'Falhas',      color: 'hsl(var(--destructive))' },
}
const PIE = ['#15803d','#166534','#16a34a','#22c55e','#4ade80','#052e16','#14532d']
const tooltipStyle = {
  backgroundColor: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))',
  borderRadius: '6px', color: 'hsl(var(--popover-foreground))', fontSize: 12,
}
const PERIODOS: { value: Periodo; label: string }[] = [
  { value:'7d', label:'7 dias' }, { value:'30d', label:'30 dias' }, { value:'90d', label:'90 dias' },
]

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function MetricasPage() {
  const [periodo, setPeriodo] = useState<Periodo>('30d')
  const [data, setData] = useState<MetricasData | null>(null)
  const [loading, setLoading] = useState(true)
  const [autoRefresh, setAutoRefresh] = useState(false)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  const trialPag     = usePagination(data?.trial.lista ?? [], 6)
  const remPag       = usePagination(data?.remarketing.lista ?? [], 6)
  const friosPag     = usePagination(data?.leads_frios ?? [], 6)
  const execSearch   = useSearch(data?.ultimas_execucoes ?? [], ['lead_name', 'label', 'mensagem'])
  const execPag      = usePagination(execSearch.filtered, 10)

  const load = useCallback(async (p: Periodo) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/metricas?periodo=${p}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Erro')
      setData(json)
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' })
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { load(periodo) }, [periodo, load])

  useEffect(() => {
    if (autoRefresh) {
      intervalRef.current = setInterval(() => load(periodo), 5 * 60 * 1000)
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [autoRefresh, periodo, load])

  const periodoLabel = PERIODOS.find((p) => p.value === periodo)?.label ?? ''

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-6 pb-8 space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Métricas</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Follow-up · Trial SaaS · Remarketing</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex rounded-lg border border-border overflow-hidden text-sm">
            {PERIODOS.map(({ value, label }) => (
              <button key={value} onClick={() => setPeriodo(value)}
                className={cn('px-3 py-1.5 transition-colors font-medium',
                  periodo === value ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted/50')}>
                {label}
              </button>
            ))}
          </div>
          <Button variant={autoRefresh ? 'default' : 'outline'} size="sm" onClick={() => setAutoRefresh((v) => !v)}
            className="gap-1.5 text-xs">
            <Clock className="h-3.5 w-3.5" />{autoRefresh ? 'Auto' : '5min'}
          </Button>
          <Button variant="outline" size="sm" onClick={() => load(periodo)} disabled={loading}>
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          </Button>
        </div>
      </div>

      {loading && !data && <PageSkeleton />}

      {data && (
        <Tabs defaultValue="overview">
          <TabsList className="flex-wrap h-auto gap-1 mb-2">
            <TabsTrigger value="overview"><BarChart2 className="h-3.5 w-3.5 mr-1.5" />Visão Geral</TabsTrigger>
            <TabsTrigger value="trial">
              <Target className="h-3.5 w-3.5 mr-1.5" />Trial SaaS
              {data.trial.expirando.length > 0 && (
                <span className="ml-1.5 bg-destructive text-destructive-foreground text-[10px] px-1.5 py-0.5 rounded-full font-bold">
                  {data.trial.expirando.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="sequencias"><Activity className="h-3.5 w-3.5 mr-1.5" />Sequências</TabsTrigger>
            <TabsTrigger value="insights"><Flame className="h-3.5 w-3.5 mr-1.5" />Insights</TabsTrigger>
            <TabsTrigger value="execucoes"><Send className="h-3.5 w-3.5 mr-1.5" />Execuções</TabsTrigger>
          </TabsList>

          {/* ── VISÃO GERAL ───────────────────────────────────────────────── */}
          <TabsContent value="overview" className="space-y-6 mt-4">
            <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
              <KpiCard icon={Send} label="Enviados" value={data.overview.total_enviados.toLocaleString('pt-BR')}
                sub={periodoLabel} delta={data.overview.delta_enviados} deltaLabel="vs período anterior" />
              <KpiCard icon={TrendingUp} label="Taxa de Resposta" value={`${data.overview.taxa_resposta}%`}
                sub={`${data.overview.total_responderam} responderam`}
                delta={data.overview.delta_taxa_resposta} deltaLabel="pp vs anterior" highlight />
              <KpiCard icon={XCircle} label="Falhas" value={data.overview.total_falhas.toLocaleString('pt-BR')}
                sub="envios com erro" delta={-data.overview.delta_enviados} deltaLabel="inversamente" />
              <KpiCard icon={CheckCircle2} label="Sequências Ativas" value={data.overview.sequencias_ativas}
                sub="em execução" />
            </div>
            <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
              <KpiCard icon={Target} label="Trials Ativos" value={data.overview.trials_ativos}
                sub="em período de teste" delta={data.overview.delta_trials} />
              <KpiCard icon={Users} label="Em Remarketing" value={data.overview.leads_remarketing} sub="leads neste estágio" />
              <KpiCard icon={MessageSquare} label="Responderam" value={data.overview.total_responderam}
                sub={periodoLabel} delta={data.overview.delta_responderam} deltaLabel="vs período anterior" />
              <KpiCard icon={Snowflake} label="Leads Frios" value={data.overview.leads_frios} sub="3+ msgs sem resposta" />
            </div>

            {/* Funil + Chart */}
            <div className="grid gap-6 lg:grid-cols-3 items-stretch">
              <Card className="lg:col-span-2">
                <CardHeader><CardTitle className="text-base">Disparos por dia</CardTitle></CardHeader>
                <CardContent>
                  <ChartContainer config={chartCfg} className="h-[220px] w-full">
                    <BarChart data={data.por_dia} margin={{ top:0, right:0, bottom:0, left:-20 }}>
                      <CartesianGrid vertical={false} stroke="hsl(var(--border))" opacity={0.4} />
                      <XAxis dataKey="data" tickLine={false} axisLine={false} tickMargin={8} tick={{ fontSize:11 }}
                        interval={Math.max(0, Math.floor(data.por_dia.length/7)-1)} />
                      <Tooltip contentStyle={tooltipStyle} itemStyle={{ color:'hsl(var(--popover-foreground))' }} />
                      <Bar dataKey="enviados"    name="Enviados"    fill="var(--color-enviados)"    radius={[3,3,0,0]} />
                      <Bar dataKey="responderam" name="Responderam" fill="var(--color-responderam)" radius={[3,3,0,0]} />
                      <Bar dataKey="falhas"      name="Falhas"      fill="var(--color-falhas)"      radius={[3,3,0,0]} />
                    </BarChart>
                  </ChartContainer>
                  <div className="mt-3 flex flex-wrap gap-4 justify-center">
                    {Object.entries(chartCfg).map(([k, c]) => (
                      <div key={k} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <div className="h-2.5 w-2.5 rounded-full" style={{ background: c.color }} />{c.label as string}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="text-base">Funil de conversão</CardTitle></CardHeader>
                <CardContent><Funil data={data.funil} /></CardContent>
              </Card>
            </div>

            {/* Taxa por tipo */}
            {data.por_tipo.length > 0 && (
              <Card>
                <CardHeader><CardTitle className="text-base">Taxa de resposta por sequência</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  {data.por_tipo.sort((a,b) => b.enviados - a.enviados).map((t, i) => (
                    <div key={t.tipo} className="space-y-1.5">
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-2 rounded-full" style={{ background: PIE[i%PIE.length] }} />
                          <span className="font-medium">{t.label}</span>
                        </div>
                        <div className="flex items-center gap-5 text-xs text-muted-foreground">
                          <span>{t.enviados} enviados</span>
                          <span className="text-emerald-600 dark:text-emerald-400 font-medium">{t.responderam} resp.</span>
                          <span className="font-bold text-foreground w-9 text-right">{t.taxa_resposta}%</span>
                        </div>
                      </div>
                      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                        <div className="h-full rounded-full bg-primary transition-all" style={{ width:`${t.taxa_resposta}%` }} />
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* ── TRIAL SAAS ────────────────────────────────────────────────── */}
          <TabsContent value="trial" className="space-y-6 mt-4">
            {/* Alerta expiração */}
            {data.trial.expirando.length > 0 && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-destructive">
                    {data.trial.expirando.length} trial{data.trial.expirando.length>1?'s':''} expirando em até 7 dias
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {data.trial.expirando.map((t) => (
                      <Badge key={t.id} variant="outline" className="border-destructive/30 text-destructive text-xs">
                        {t.nome} — D{t.dia_no_trial}/{t.trial_days}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
              <KpiCard icon={Target} label="Ativos" value={data.trial.ativos} sub="em trial agora" highlight />
              <KpiCard icon={TrendingUp} label="Taxa de Conversão" value={`${data.trial.conversion_rate}%`}
                sub={`${data.trial.convertidos} convertidos`} />
              <KpiCard icon={Clock} label="Tempo Médio" value={data.trial.avg_days_to_convert ? `${data.trial.avg_days_to_convert}d` : '—'}
                sub="para converter" />
              <KpiCard icon={XCircle} label="Expirados" value={data.trial.expirados} sub="sem conversão" />
            </div>

            <div className="grid gap-6 lg:grid-cols-3 items-start">
              <Card>
                <CardHeader><CardTitle className="text-base">Por estágio</CardTitle></CardHeader>
                <CardContent>
                  {data.trial.por_estagio.length > 0 ? (
                    <div className="space-y-3">
                      {data.trial.por_estagio.sort((a,b)=>b.count-a.count).map((e,i)=>(
                        <div key={e.estagio} className="space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-mono text-muted-foreground">{e.estagio}</span>
                            <span className="font-semibold">{e.count}</span>
                          </div>
                          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                            <div className="h-full rounded-full transition-all"
                              style={{ width: data.trial.ativos>0?`${Math.round((e.count/data.trial.ativos)*100)}%`:'0%', background:PIE[i%PIE.length] }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : <p className="text-sm text-muted-foreground text-center py-8">Nenhum estágio</p>}
                </CardContent>
              </Card>

              <Card className="lg:col-span-2">
                <CardHeader className="flex flex-row items-center justify-between space-y-0">
                  <CardTitle className="text-base">Leads em trial ativo</CardTitle>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{data.trial.ativos} ativos</Badge>
                    <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs"
                      onClick={() => exportCSV(data.trial.lista, 'trials.csv')}>
                      <Download className="h-3 w-3" />CSV
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  {data.trial.lista.length > 0 ? (
                    <>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Nome</TableHead>
                            <TableHead>WhatsApp</TableHead>
                            <TableHead className="text-center">Progresso</TableHead>
                            <TableHead>Estágio</TableHead>
                            <TableHead>Início</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {trialPag.slice.map((t) => {
                            const pct = t.trial_days > 0 ? t.dia_no_trial / t.trial_days : 0
                            const expiring = (t.trial_days - t.dia_no_trial) <= 7
                            return (
                              <TableRow key={t.id} className={expiring ? 'bg-destructive/5' : ''}>
                                <TableCell className="font-medium">
                                  <div className="flex items-center gap-2">
                                    {expiring && <AlertTriangle className="h-3.5 w-3.5 text-destructive shrink-0" />}
                                    {t.nome}
                                  </div>
                                </TableCell>
                                <TableCell className="text-muted-foreground font-mono text-xs">{fmtPhone(t.whatsapp)}</TableCell>
                                <TableCell>
                                  <div className="flex items-center gap-2">
                                    <div className="h-1.5 w-16 rounded-full bg-muted overflow-hidden">
                                      <div className="h-full rounded-full bg-primary transition-all"
                                        style={{ width:`${Math.min(pct*100,100)}%` }} />
                                    </div>
                                    <span className={cn('text-xs font-bold',
                                      pct>=1?'text-destructive':pct>=0.7?'text-yellow-600 dark:text-yellow-400':'text-emerald-600 dark:text-emerald-400')}>
                                      D{t.dia_no_trial}/{t.trial_days}
                                    </span>
                                  </div>
                                </TableCell>
                                <TableCell>
                                  {t.estagio
                                    ? <Badge variant="secondary" className="font-mono text-xs">{t.estagio}</Badge>
                                    : <span className="text-muted-foreground">—</span>}
                                </TableCell>
                                <TableCell className="text-muted-foreground text-xs">{fmtDate(t.criado_em)}</TableCell>
                              </TableRow>
                            )
                          })}
                        </TableBody>
                      </Table>
                      <Pagination page={trialPag.page} totalPages={trialPag.totalPages}
                        setPage={trialPag.setPage} total={trialPag.total} perPage={6} />
                    </>
                  ) : <p className="text-sm text-muted-foreground text-center py-10">Nenhum trial ativo</p>}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* ── SEQUÊNCIAS ────────────────────────────────────────────────── */}
          <TabsContent value="sequencias" className="space-y-6 mt-4">
            {/* Ranking */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-base">Ranking de sequências</CardTitle>
                <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs"
                  onClick={() => exportCSV(data.ranking_sequencias, 'ranking.csv')}>
                  <Download className="h-3 w-3" />CSV
                </Button>
              </CardHeader>
              <CardContent>
                {data.ranking_sequencias.length > 0 ? (
                  <div className="space-y-3">
                    {data.ranking_sequencias.map((s, i) => (
                      <div key={s.id} className="flex items-center gap-4">
                        <span className="text-lg font-bold text-muted-foreground/30 w-6 shrink-0">#{i+1}</span>
                        <div className="flex-1 space-y-1">
                          <div className="flex items-center justify-between text-sm">
                            <div>
                              <span className="font-medium">{s.nome}</span>
                              <Badge variant="outline" className="ml-2 text-[10px]">{s.label}</Badge>
                            </div>
                            <div className="flex items-center gap-4 text-xs text-muted-foreground">
                              <span>{s.enviados} enviados</span>
                              <span className="text-emerald-600 dark:text-emerald-400">{s.responderam} resp.</span>
                              <span className="font-bold text-foreground w-9 text-right">{s.taxa_resposta}%</span>
                            </div>
                          </div>
                          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                            <div className="h-full rounded-full transition-all"
                              style={{ width:`${s.taxa_resposta}%`, background: PIE[i%PIE.length] }} />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : <p className="text-sm text-muted-foreground text-center py-8">Sem dados no período</p>}
              </CardContent>
            </Card>

            {/* Anti-Noshow + Follow Proposta */}
            <div className="grid gap-6 md:grid-cols-2">
              {[
                { title: 'Anti-Noshow', d: data.anti_noshow },
                { title: 'Follow Proposta', d: data.follow_proposta },
              ].map(({ title, d }) => (
                <Card key={title}>
                  <CardHeader><CardTitle className="text-base">{title}</CardTitle></CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-3 gap-3 text-center">
                      {[
                        { label:'Enviados', v: d.enviados, color:'text-foreground' },
                        { label:'Responderam', v: d.responderam, color:'text-emerald-600 dark:text-emerald-400' },
                        { label:'Taxa', v: `${d.taxa_resposta}%`, color:'text-primary' },
                      ].map(({ label, v, color }) => (
                        <div key={label} className="rounded-lg bg-muted/50 p-3">
                          <p className={cn('text-xl font-bold', color)}>{v}</p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">{label}</p>
                        </div>
                      ))}
                    </div>
                    {d.lista.length > 0 && (
                      <div className="space-y-2 max-h-48 overflow-y-auto">
                        {d.lista.slice(0, 8).map((l: any, i: number) => (
                          <div key={i} className="flex items-center justify-between text-xs gap-2 py-1 border-b border-border/50 last:border-0">
                            <div className="flex-1 min-w-0">
                              <span className="font-medium">{l.lead_name}</span>
                              <span className="text-muted-foreground ml-2 truncate">{l.mensagem}</span>
                            </div>
                            {l.respondeu
                              ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                              : <AlertCircle className="h-3.5 w-3.5 text-muted-foreground/30 shrink-0" />}
                          </div>
                        ))}
                      </div>
                    )}
                    {d.lista.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">Sem disparos no período</p>}
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Remarketing */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-base">Leads em Remarketing</CardTitle>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{data.remarketing.total} leads</Badge>
                  <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs"
                    onClick={() => exportCSV(data.remarketing.lista, 'remarketing.csv')}>
                    <Download className="h-3 w-3" />CSV
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {data.remarketing.lista.length > 0 ? (
                  <>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Nome</TableHead>
                          <TableHead>WhatsApp</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Atualizado</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {remPag.slice.map((l) => (
                          <TableRow key={l.id}>
                            <TableCell className="font-medium">{l.nome}</TableCell>
                            <TableCell className="text-muted-foreground font-mono text-xs">{fmtPhone(l.whatsapp)}</TableCell>
                            <TableCell><Badge variant="secondary">{l.status}</Badge></TableCell>
                            <TableCell className="text-muted-foreground text-xs">{fmtDate(l.updated_at)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    <Pagination page={remPag.page} totalPages={remPag.totalPages}
                      setPage={remPag.setPage} total={remPag.total} perPage={6} />
                  </>
                ) : <p className="text-sm text-muted-foreground text-center py-8">Nenhum lead em Remarketing</p>}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── INSIGHTS ──────────────────────────────────────────────────── */}
          <TabsContent value="insights" className="space-y-6 mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Heatmap — Melhor horário para disparar</CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">Hora × dia da semana com mais respostas recebidas</p>
              </CardHeader>
              <CardContent>
                {data.heatmap.some((r) => Object.values(r).slice(1).some((v) => v > 0))
                  ? <Heatmap data={data.heatmap} />
                  : <p className="text-sm text-muted-foreground text-center py-10">Dados insuficientes no período</p>}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Snowflake className="h-4 w-4 text-sky-500" />Leads Frios
                  </CardTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">3+ mensagens enviadas, nenhuma resposta</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{data.leads_frios.length}</Badge>
                  <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs"
                    onClick={() => exportCSV(data.leads_frios, 'leads-frios.csv')}>
                    <Download className="h-3 w-3" />CSV
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {data.leads_frios.length > 0 ? (
                  <>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Nome</TableHead>
                          <TableHead>WhatsApp</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-center">Msgs enviadas</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {friosPag.slice.map((l) => (
                          <TableRow key={l.id}>
                            <TableCell className="font-medium">{l.nome}</TableCell>
                            <TableCell className="text-muted-foreground font-mono text-xs">{fmtPhone(l.whatsapp)}</TableCell>
                            <TableCell><Badge variant="outline" className="text-xs">{l.status}</Badge></TableCell>
                            <TableCell className="text-center">
                              <span className="font-bold text-muted-foreground">{l.total_msgs}</span>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    <Pagination page={friosPag.page} totalPages={friosPag.totalPages}
                      setPage={friosPag.setPage} total={friosPag.total} perPage={6} />
                  </>
                ) : <p className="text-sm text-muted-foreground text-center py-10">Nenhum lead frio identificado</p>}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── EXECUÇÕES ─────────────────────────────────────────────────── */}
          <TabsContent value="execucoes" className="mt-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 flex-wrap gap-3">
                <div>
                  <CardTitle className="text-base">Histórico de execuções</CardTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">Follow-up, Remarketing e Trial SaaS</p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input placeholder="Buscar lead, sequência..." value={execSearch.q}
                      onChange={(e) => execSearch.setQ(e.target.value)}
                      className="pl-8 h-8 text-xs w-52" />
                  </div>
                  <Button variant="ghost" size="sm" className="h-8 gap-1 text-xs"
                    onClick={() => exportCSV(execSearch.filtered, 'execucoes.csv')}>
                    <Download className="h-3.5 w-3.5" />CSV
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {execPag.slice.length > 0 ? (
                  <>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Lead</TableHead>
                          <TableHead>Sequência</TableHead>
                          <TableHead className="max-w-[180px]">Mensagem</TableHead>
                          <TableHead className="text-center">Respondeu</TableHead>
                          <TableHead className="max-w-[160px]">Resposta</TableHead>
                          <TableHead>Enviado</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {execPag.slice.map((ex) => (
                          <TableRow key={`${ex.tipo}-${ex.id}`}>
                            <TableCell>
                              <p className="font-medium text-sm">{ex.lead_name}</p>
                              <p className="text-muted-foreground font-mono text-xs">{fmtPhone(ex.lead_whatsapp)}</p>
                            </TableCell>
                            <TableCell><Badge variant="outline" className="text-xs">{ex.label}</Badge></TableCell>
                            <TableCell className="max-w-[180px]">
                              <p className="truncate text-xs text-muted-foreground">{ex.mensagem}</p>
                            </TableCell>
                            <TableCell className="text-center">
                              {ex.respondeu
                                ? <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 mx-auto" />
                                : <AlertCircle className="h-4 w-4 text-muted-foreground/30 mx-auto" />}
                            </TableCell>
                            <TableCell className="max-w-[160px]">
                              <p className="truncate text-xs text-muted-foreground">{ex.resposta ?? '—'}</p>
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                              {fmtDate(ex.enviado_em)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    <Pagination page={execPag.page} totalPages={execPag.totalPages}
                      setPage={execPag.setPage} total={execPag.total} perPage={10} />
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-10">
                    {execSearch.q ? 'Nenhum resultado para a busca' : 'Nenhuma execução no período'}
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  )
}
