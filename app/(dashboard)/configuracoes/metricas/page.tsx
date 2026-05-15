'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { MetricCard } from '@/components/dashboard/MetricCard'
import { ChartContainer, ChartConfig } from '@/components/ui/chart'
import { toast } from '@/components/ui/use-toast'
import { cn } from '@/lib/utils/cn'
import {
  Bar, BarChart, CartesianGrid, XAxis, Tooltip,
  PieChart, Pie, Cell, ResponsiveContainer,
} from 'recharts'
import {
  Send, XCircle, MessageSquare, TrendingUp, Users, RefreshCw,
  CheckCircle2, AlertCircle, BarChart2, Loader2, Target, Activity,
} from 'lucide-react'

// ─── Types ───────────────────────────────────────────────────────────────────

type Periodo = '7d' | '30d' | '90d'

interface MetricasData {
  periodo: Periodo
  overview: {
    total_enviados: number
    total_falhas: number
    total_responderam: number
    taxa_resposta: number
    sequencias_ativas: number
    trials_ativos: number
    leads_remarketing: number
  }
  por_dia: { data: string; enviados: number; falhas: number; responderam: number }[]
  por_tipo: { tipo: string; label: string; enviados: number; falhas: number; responderam: number; taxa_resposta: number }[]
  trial: {
    ativos: number
    expirados: number
    convertidos: number
    por_estagio: { estagio: string; count: number }[]
    lista: {
      id: number; nome: string; whatsapp: string; status: string
      estagio: string | null; dia_no_trial: number; trial_days: number; criado_em: string
    }[]
  }
  remarketing: {
    total: number
    responderam: number
    lista: { id: number; nome: string; whatsapp: string; status: string; updated_at: string }[]
  }
  ultimas_execucoes: {
    id: number; tipo: string; label: string; lead_name: string; lead_status: string
    lead_whatsapp: string; mensagem: string; enviado_em: string; respondeu: boolean; resposta: string | null
  }[]
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtPhone(p: string) {
  const d = (p ?? '').replace(/\D/g, '')
  if (d.length === 13) return `+${d.slice(0, 2)} (${d.slice(2, 4)}) ${d.slice(4, 9)}-${d.slice(9)}`
  return p || '—'
}

function fmtDate(iso: string) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
}

// ─── Chart configs ───────────────────────────────────────────────────────────

const chartConfigDisparos = {
  enviados:   { label: 'Enviados',   color: '#15803d' },
  responderam:{ label: 'Responderam',color: '#4ade80' },
  falhas:     { label: 'Falhas',     color: 'hsl(var(--destructive))' },
} satisfies ChartConfig

const PIE_COLORS = ['#15803d', '#166534', '#16a34a', '#22c55e', '#4ade80', '#052e16', '#14532d']

const tooltipStyle = {
  backgroundColor: 'hsl(var(--popover))',
  border: '1px solid hsl(var(--border))',
  borderRadius: '6px',
  color: 'hsl(var(--popover-foreground))',
  fontSize: 12,
}

// ─── Period selector ─────────────────────────────────────────────────────────

const PERIODOS: { value: Periodo; label: string }[] = [
  { value: '7d', label: '7 dias' },
  { value: '30d', label: '30 dias' },
  { value: '90d', label: '90 dias' },
]

// ─── Page ────────────────────────────────────────────────────────────────────

export default function MetricasPage() {
  const [periodo, setPeriodo] = useState<Periodo>('30d')
  const [data, setData] = useState<MetricasData | null>(null)
  const [loading, setLoading] = useState(true)

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

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-6 pb-8 space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Métricas</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Acompanhe o desempenho de Follow-up, Trial SaaS e Remarketing
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-border overflow-hidden text-sm">
            {PERIODOS.map(({ value, label }) => (
              <button
                key={value}
                onClick={() => setPeriodo(value)}
                className={cn(
                  'px-3 py-1.5 transition-colors font-medium',
                  periodo === value
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                )}
              >
                {label}
              </button>
            ))}
          </div>
          <Button variant="outline" size="sm" onClick={() => load(periodo)} disabled={loading}>
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          </Button>
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-7 w-7 animate-spin text-primary" />
        </div>
      )}

      {!loading && data && (
        <Tabs defaultValue="overview">
          <TabsList className="mb-2">
            <TabsTrigger value="overview"><BarChart2 className="h-3.5 w-3.5 mr-1.5" />Visão Geral</TabsTrigger>
            <TabsTrigger value="trial"><Target className="h-3.5 w-3.5 mr-1.5" />Trial SaaS</TabsTrigger>
            <TabsTrigger value="remarketing"><Users className="h-3.5 w-3.5 mr-1.5" />Remarketing</TabsTrigger>
            <TabsTrigger value="execucoes"><Activity className="h-3.5 w-3.5 mr-1.5" />Execuções</TabsTrigger>
          </TabsList>

          {/* ── VISÃO GERAL ──────────────────────────────────────────────── */}
          <TabsContent value="overview" className="space-y-6 mt-4">
            {/* KPI cards */}
            <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
              <MetricCard
                title="Enviados"
                value={data.overview.total_enviados}
                subtitle={`últimos ${PERIODOS.find(p => p.value === periodo)?.label}`}
                icon={Send}
              />
              <MetricCard
                title="Taxa de Resposta"
                value={`${data.overview.taxa_resposta}%`}
                subtitle={`${data.overview.total_responderam} responderam`}
                icon={TrendingUp}
                format="percentage"
                highlight={{ bg: 'linear-gradient(135deg,#052e16,#14532d)', text: '#4ade80' }}
              />
              <MetricCard
                title="Falhas"
                value={data.overview.total_falhas}
                subtitle="envios com erro"
                icon={XCircle}
              />
              <MetricCard
                title="Sequências Ativas"
                value={data.overview.sequencias_ativas}
                subtitle="em execução automática"
                icon={CheckCircle2}
              />
            </div>
            <div className="grid gap-4 grid-cols-2 md:grid-cols-3">
              <MetricCard
                title="Trials Ativos"
                value={data.overview.trials_ativos}
                subtitle="em período de teste"
                icon={Target}
                highlight={{ bg: 'linear-gradient(135deg,#78350f,#92400e)', text: '#fbbf24' }}
              />
              <MetricCard
                title="Em Remarketing"
                value={data.overview.leads_remarketing}
                subtitle="leads neste estágio"
                icon={Users}
              />
              <MetricCard
                title="Responderam"
                value={data.overview.total_responderam}
                subtitle="total no período"
                icon={MessageSquare}
              />
            </div>

            {/* Charts */}
            <div className="grid gap-6 lg:grid-cols-3 items-stretch">
              {/* Bar chart */}
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle className="text-base">Disparos por dia</CardTitle>
                </CardHeader>
                <CardContent>
                  <ChartContainer config={chartConfigDisparos} className="h-[220px] w-full">
                    <BarChart data={data.por_dia} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
                      <CartesianGrid vertical={false} stroke="hsl(var(--border))" opacity={0.4} />
                      <XAxis
                        dataKey="data"
                        tickLine={false}
                        axisLine={false}
                        tickMargin={8}
                        tick={{ fontSize: 11 }}
                        interval={Math.max(0, Math.floor(data.por_dia.length / 7) - 1)}
                      />
                      <Tooltip contentStyle={tooltipStyle} itemStyle={{ color: 'hsl(var(--popover-foreground))' }} />
                      <Bar dataKey="enviados"    name="Enviados"    fill="var(--color-enviados)"    radius={[3,3,0,0]} />
                      <Bar dataKey="responderam" name="Responderam" fill="var(--color-responderam)" radius={[3,3,0,0]} />
                      <Bar dataKey="falhas"      name="Falhas"      fill="var(--color-falhas)"      radius={[3,3,0,0]} />
                    </BarChart>
                  </ChartContainer>
                  <div className="mt-4 flex flex-wrap gap-4 justify-center">
                    {Object.entries(chartConfigDisparos).map(([key, cfg]) => (
                      <div key={key} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <div className="h-2.5 w-2.5 rounded-full" style={{ background: cfg.color }} />
                        {cfg.label}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Donut: por tipo */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Por tipo de sequência</CardTitle>
                </CardHeader>
                <CardContent>
                  {data.por_tipo.length > 0 ? (
                    <>
                      <ResponsiveContainer width="100%" height={170}>
                        <PieChart>
                          <Pie
                            data={data.por_tipo} dataKey="enviados" nameKey="label"
                            cx="50%" cy="50%" innerRadius={48} outerRadius={72} paddingAngle={3}
                          >
                            {data.por_tipo.map((_, i) => (
                              <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip contentStyle={tooltipStyle} />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="mt-3 space-y-2">
                        {data.por_tipo.map((t, i) => (
                          <div key={t.tipo} className="flex items-center justify-between text-xs">
                            <div className="flex items-center gap-2">
                              <div className="h-2 w-2 rounded-full" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                              <span className="text-muted-foreground">{t.label}</span>
                            </div>
                            <span className="font-semibold">{t.enviados}</span>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-10">Sem dados no período</p>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Taxa por tipo */}
            {data.por_tipo.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Taxa de resposta por sequência</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {data.por_tipo.sort((a, b) => b.enviados - a.enviados).map((t, i) => (
                    <div key={t.tipo} className="space-y-1.5">
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-2 rounded-full" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                          <span className="font-medium">{t.label}</span>
                        </div>
                        <div className="flex items-center gap-5 text-xs text-muted-foreground">
                          <span>{t.enviados} enviados</span>
                          <span className="text-emerald-600 dark:text-emerald-400 font-medium">{t.responderam} responderam</span>
                          <span className="font-bold text-foreground w-9 text-right">{t.taxa_resposta}%</span>
                        </div>
                      </div>
                      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full bg-primary transition-all"
                          style={{ width: `${t.taxa_resposta}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* ── TRIAL SAAS ───────────────────────────────────────────────── */}
          <TabsContent value="trial" className="space-y-6 mt-4">
            <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
              <MetricCard title="Ativos" value={data.trial.ativos} subtitle="em trial agora"
                icon={Target} highlight={{ bg: 'linear-gradient(135deg,#78350f,#92400e)', text: '#fbbf24' }} />
              <MetricCard title="Convertidos" value={data.trial.convertidos} subtitle="fecharam plano" icon={CheckCircle2} />
              <MetricCard title="Expirados" value={data.trial.expirados} subtitle="trial encerrado" icon={XCircle} />
              <MetricCard title="Estágios" value={data.trial.por_estagio.length} subtitle="etapas mapeadas" icon={Activity} />
            </div>

            <div className="grid gap-6 lg:grid-cols-3 items-start">
              {/* Estágios */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Distribuição por estágio</CardTitle>
                </CardHeader>
                <CardContent>
                  {data.trial.por_estagio.length > 0 ? (
                    <div className="space-y-3">
                      {data.trial.por_estagio.sort((a, b) => b.count - a.count).map((e, i) => (
                        <div key={e.estagio} className="space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-mono text-muted-foreground">{e.estagio}</span>
                            <span className="font-semibold">{e.count}</span>
                          </div>
                          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all"
                              style={{
                                width: data.trial.ativos > 0 ? `${Math.round((e.count / data.trial.ativos) * 100)}%` : '0%',
                                background: PIE_COLORS[i % PIE_COLORS.length],
                              }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-8">Nenhum estágio definido</p>
                  )}
                </CardContent>
              </Card>

              {/* Tabela de trials */}
              <Card className="lg:col-span-2">
                <CardHeader className="flex flex-row items-center justify-between space-y-0">
                  <CardTitle className="text-base">Leads em trial ativo</CardTitle>
                  <Badge variant="outline">{data.trial.ativos} ativos</Badge>
                </CardHeader>
                <CardContent className="p-0">
                  {data.trial.lista.length > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Nome</TableHead>
                          <TableHead>WhatsApp</TableHead>
                          <TableHead className="text-center">Dia</TableHead>
                          <TableHead>Estágio</TableHead>
                          <TableHead>Início</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {data.trial.lista.map((t) => {
                          const pct = t.trial_days > 0 ? t.dia_no_trial / t.trial_days : 0
                          return (
                            <TableRow key={t.id}>
                              <TableCell className="font-medium">{t.nome}</TableCell>
                              <TableCell className="text-muted-foreground font-mono text-xs">{fmtPhone(t.whatsapp)}</TableCell>
                              <TableCell className="text-center">
                                <span className={cn(
                                  'font-bold text-sm',
                                  pct >= 1 ? 'text-destructive' : pct >= 0.7 ? 'text-yellow-600 dark:text-yellow-400' : 'text-emerald-600 dark:text-emerald-400'
                                )}>
                                  D{t.dia_no_trial}
                                </span>
                                <span className="text-muted-foreground text-xs">/{t.trial_days}</span>
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
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-10">Nenhum trial ativo</p>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* ── REMARKETING ──────────────────────────────────────────────── */}
          <TabsContent value="remarketing" className="space-y-6 mt-4">
            <div className="grid gap-4 grid-cols-2 md:grid-cols-3">
              <MetricCard title="Em Remarketing" value={data.remarketing.total} subtitle="leads neste estágio" icon={Users} />
              <MetricCard title="Responderam" value={data.remarketing.responderam}
                subtitle={`últimos ${PERIODOS.find(p => p.value === periodo)?.label}`} icon={MessageSquare} />
              <MetricCard
                title="Taxa de Resposta"
                value={data.remarketing.total > 0 ? Math.round((data.remarketing.responderam / data.remarketing.total) * 100) : 0}
                subtitle="do total em remarketing"
                icon={TrendingUp}
                format="percentage"
                highlight={{ bg: 'linear-gradient(135deg,#052e16,#14532d)', text: '#4ade80' }}
              />
            </div>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-base">Leads em remarketing</CardTitle>
                <Badge variant="outline">{data.remarketing.total} leads</Badge>
              </CardHeader>
              <CardContent className="p-0">
                {data.remarketing.lista.length > 0 ? (
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
                      {data.remarketing.lista.map((l) => (
                        <TableRow key={l.id}>
                          <TableCell className="font-medium">{l.nome}</TableCell>
                          <TableCell className="text-muted-foreground font-mono text-xs">{fmtPhone(l.whatsapp)}</TableCell>
                          <TableCell><Badge variant="secondary">{l.status}</Badge></TableCell>
                          <TableCell className="text-muted-foreground text-xs">{fmtDate(l.updated_at)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-10">Nenhum lead em Remarketing</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── EXECUÇÕES ────────────────────────────────────────────────── */}
          <TabsContent value="execucoes" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Últimas execuções de follow-up</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {data.ultimas_execucoes.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Lead</TableHead>
                        <TableHead>Sequência</TableHead>
                        <TableHead className="max-w-[200px]">Mensagem</TableHead>
                        <TableHead className="text-center">Respondeu</TableHead>
                        <TableHead className="max-w-[180px]">Resposta</TableHead>
                        <TableHead>Enviado</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.ultimas_execucoes.map((ex) => (
                        <TableRow key={ex.id}>
                          <TableCell>
                            <p className="font-medium text-sm">{ex.lead_name}</p>
                            <p className="text-muted-foreground font-mono text-xs">{fmtPhone(ex.lead_whatsapp)}</p>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs">{ex.label}</Badge>
                          </TableCell>
                          <TableCell className="max-w-[200px]">
                            <p className="truncate text-xs text-muted-foreground">{ex.mensagem}</p>
                          </TableCell>
                          <TableCell className="text-center">
                            {ex.respondeu
                              ? <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 mx-auto" />
                              : <AlertCircle className="h-4 w-4 text-muted-foreground/30 mx-auto" />}
                          </TableCell>
                          <TableCell className="max-w-[180px]">
                            <p className="truncate text-xs text-muted-foreground">{ex.resposta ?? '—'}</p>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                            {fmtDate(ex.enviado_em)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-10">Nenhuma execução no período</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  )
}
