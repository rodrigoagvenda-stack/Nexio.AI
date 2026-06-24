'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import {
  Wallet,
  CheckCircle2,
  Clock,
  AlertCircle,
  ExternalLink,
  Copy,
  RefreshCw,
  Settings,
  ChevronDown,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { OrbitCard } from '@/components/ui/orbit-card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { toast } from '@/components/ui/use-toast'

interface Charge {
  id: string
  platform: string
  external_id: string
  amount: number
  description: string | null
  billing_type: string | null
  due_date: string | null
  status: string
  payment_url: string | null
  invoice_url: string | null
  created_at: string
  lead_name: string | null
  external_reference: string | null
}

interface Stats {
  received: number
  pending: number
  overdue: number
  total: number
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  paid: { label: 'Pago', color: 'text-emerald-500' },
  pending: { label: 'Em aberto', color: 'text-amber-500' },
  overdue: { label: 'Vencida', color: 'text-red-500' },
  cancelled: { label: 'Cancelada', color: 'text-muted-foreground' },
}

const BILLING_LABELS: Record<string, string> = {
  PIX: 'PIX',
  BOLETO: 'Boleto',
  CREDIT_CARD: 'Cartão',
  UNDEFINED: 'Livre',
}

const PLATFORM_LABELS: Record<string, string> = {
  asaas: 'Asaas',
  mercadopago: 'Mercado Pago',
  kiwify: 'Kiwify',
}

function fmt(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export default function FinanceiroPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [noIntegration, setNoIntegration] = useState(false)
  const [charges, setCharges] = useState<Charge[]>([])
  const [stats, setStats] = useState<Stats>({ received: 0, pending: 0, overdue: 0, total: 0 })
  const [statusFilter, setStatusFilter] = useState('all')
  const [periodFilter, setPeriodFilter] = useState('30')
  const [platformFilter, setPlatformFilter] = useState('all')

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        status: statusFilter,
        period: periodFilter,
        platform: platformFilter ?? 'all',
      })
      const res = await fetch(`/api/financeiro/charges?${params}`)
      if (res.status === 404) {
        setNoIntegration(true)
        return
      }
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      setCharges(json.charges)
      setStats(json.stats)
    } catch (e: any) {
      toast({ title: 'Erro ao carregar cobranças', description: e.message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [statusFilter, periodFilter, platformFilter])

  // Check integrations on mount
  useEffect(() => {
    fetch('/api/payment-integrations')
      .then(r => r.json())
      .then(d => {
        const active = (d.integrations ?? []).some((i: any) => i.active)
        if (!active) setNoIntegration(true)
        else fetchData()
      })
      .catch(() => fetchData())
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!noIntegration) fetchData()
  }, [statusFilter, periodFilter, platformFilter, fetchData, noIntegration])

  const copyLink = (url: string) => {
    navigator.clipboard.writeText(url)
    toast({ title: 'Link copiado!' })
  }

  if (noIntegration) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-6 px-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
          <Wallet className="w-8 h-8 text-primary" />
        </div>
        <div>
          <h2 className="text-xl font-semibold mb-2">Nenhuma integração de pagamento ativa</h2>
          <p className="text-muted-foreground text-sm max-w-sm">
            Configure Asaas, Mercado Pago ou Kiwify em Configurações para começar a gerar cobranças e visualizar o financeiro aqui.
          </p>
        </div>
        <Button onClick={() => router.push('/configuracoes?tab=integracoes')} className="gap-2">
          <Settings className="w-4 h-4" />
          Ir para Configurações
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="px-4 md:px-6 pt-4 pb-3 flex-shrink-0">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-bold">Financeiro</h1>
            <p className="text-sm text-muted-foreground">Cobranças geradas para seus leads</p>
          </div>
          <Button variant="outline" size="sm" onClick={fetchData} disabled={loading} className="gap-2">
            <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
            <span className="hidden sm:inline">Atualizar</span>
          </Button>
        </div>

        {/* Stats cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <OrbitCard className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              <span className="text-xs text-muted-foreground">Recebido</span>
            </div>
            <p className="text-lg font-bold text-emerald-500">{fmt(stats.received)}</p>
          </OrbitCard>
          <OrbitCard className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Clock className="w-4 h-4 text-amber-500" />
              <span className="text-xs text-muted-foreground">Em aberto</span>
            </div>
            <p className="text-lg font-bold text-amber-500">{fmt(stats.pending)}</p>
          </OrbitCard>
          <OrbitCard className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <AlertCircle className="w-4 h-4 text-red-500" />
              <span className="text-xs text-muted-foreground">Vencidas</span>
            </div>
            <p className="text-lg font-bold text-red-500">{fmt(stats.overdue)}</p>
          </OrbitCard>
          <OrbitCard className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Wallet className="w-4 h-4 text-primary" />
              <span className="text-xs text-muted-foreground">Cobranças</span>
            </div>
            <p className="text-lg font-bold">{stats.total}</p>
          </OrbitCard>
        </div>

        {/* Filter bar */}
        <div className="flex flex-wrap gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-9 text-sm bg-muted border-border w-36">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="paid">Pagos</SelectItem>
              <SelectItem value="pending">Em aberto</SelectItem>
              <SelectItem value="overdue">Vencidas</SelectItem>
              <SelectItem value="cancelled">Canceladas</SelectItem>
            </SelectContent>
          </Select>
          <Select value={periodFilter} onValueChange={setPeriodFilter}>
            <SelectTrigger className="h-9 text-sm bg-muted border-border w-36">
              <SelectValue placeholder="Período" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Últimos 7 dias</SelectItem>
              <SelectItem value="30">Últimos 30 dias</SelectItem>
              <SelectItem value="90">Últimos 90 dias</SelectItem>
              <SelectItem value="all">Todos</SelectItem>
            </SelectContent>
          </Select>
          <Select value={platformFilter} onValueChange={setPlatformFilter}>
            <SelectTrigger className="h-9 text-sm bg-muted border-border w-36">
              <SelectValue placeholder="Plataforma" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              <SelectItem value="asaas">Asaas</SelectItem>
              <SelectItem value="mercadopago">Mercado Pago</SelectItem>
              <SelectItem value="kiwify">Kiwify</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto px-4 md:px-6 pb-6">
        {loading ? (
          <div className="space-y-3 mt-2">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-20 rounded-xl bg-muted animate-pulse" />
            ))}
          </div>
        ) : charges.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Wallet className="w-12 h-12 text-muted-foreground/30 mb-3" />
            <p className="text-muted-foreground text-sm">Nenhuma cobrança encontrada</p>
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden md:block mt-2">
              <div className="rounded-xl border border-border overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/50 border-b border-border">
                      <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Lead</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Descrição</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Plataforma</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Tipo</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Vencimento</th>
                      <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground">Valor</th>
                      <th className="text-center px-4 py-3 text-xs font-medium text-muted-foreground">Status</th>
                      <th className="text-center px-4 py-3 text-xs font-medium text-muted-foreground">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {charges.map((charge, i) => {
                      const leadName = charge.lead_name || '—'
                      const statusInfo = STATUS_LABELS[charge.status] ?? { label: charge.status, color: 'text-muted-foreground' }
                      const link = charge.payment_url || charge.invoice_url
                      return (
                        <tr
                          key={charge.id}
                          className={cn(
                            'border-b border-border/50 last:border-0 hover:bg-muted/30 transition-colors',
                          )}
                        >
                          <td className="px-4 py-3 font-medium truncate max-w-[140px]">{leadName}</td>
                          <td className="px-4 py-3 text-muted-foreground truncate max-w-[180px]">
                            {charge.description || '—'}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {PLATFORM_LABELS[charge.platform] || charge.platform}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {BILLING_LABELS[charge.billing_type ?? ''] || charge.billing_type || '—'}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {charge.due_date
                              ? format(new Date(charge.due_date + 'T12:00:00'), 'dd/MM/yyyy', { locale: ptBR })
                              : '—'}
                          </td>
                          <td className="px-4 py-3 text-right font-semibold">{fmt(charge.amount)}</td>
                          <td className="px-4 py-3 text-center">
                            <span className={cn('text-xs font-medium', statusInfo.color)}>
                              {statusInfo.label}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-center gap-1">
                              {link && (
                                <>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7"
                                    onClick={() => copyLink(link)}
                                    title="Copiar link"
                                  >
                                    <Copy className="w-3.5 h-3.5" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7"
                                    onClick={() => window.open(link, '_blank')}
                                    title="Abrir cobrança"
                                  >
                                    <ExternalLink className="w-3.5 h-3.5" />
                                  </Button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden space-y-3 mt-2">
              {charges.map((charge) => {
                const leadName = charge.lead_name || '—'
                const statusInfo = STATUS_LABELS[charge.status] ?? { label: charge.status, color: 'text-muted-foreground' }
                const link = charge.payment_url || charge.invoice_url
                return (
                  <OrbitCard key={charge.id} className="p-4">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="min-w-0">
                        <p className="font-semibold text-sm truncate">{leadName}</p>
                        <p className="text-xs text-muted-foreground truncate">{charge.description || '—'}</p>
                      </div>
                      <span className={cn('text-xs font-medium flex-shrink-0', statusInfo.color)}>
                        {statusInfo.label}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span>{PLATFORM_LABELS[charge.platform] || charge.platform}</span>
                        <span>•</span>
                        <span>{BILLING_LABELS[charge.billing_type ?? ''] || '—'}</span>
                        {charge.due_date && (
                          <>
                            <span>•</span>
                            <span>{format(new Date(charge.due_date + 'T12:00:00'), 'dd/MM/yy', { locale: ptBR })}</span>
                          </>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-sm font-bold">{fmt(charge.amount)}</span>
                        {link && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 ml-1"
                            onClick={() => copyLink(link)}
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </OrbitCard>
                )
              })}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
