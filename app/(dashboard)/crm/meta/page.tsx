'use client'

import { useState, useCallback, useEffect } from 'react'
import { format } from 'date-fns'
import { Loader2 } from 'lucide-react'
import { FilterButtons, FilterPeriod } from '@/components/dashboard/FilterButtons'
import { DateRangePicker } from '@/components/dashboard/DateRangePicker'
import { MetaGate } from '@/components/crm/meta/MetaGate'
import { MetaSummaryCards } from '@/components/crm/meta/MetaSummaryCards'
import { CampaignTable } from '@/components/crm/meta/CampaignTable'
import { MetaEmptyState } from '@/components/crm/meta/MetaEmptyState'
import type { MetaAttributionData } from '@/components/crm/meta/types'

interface DateRange {
  from: Date | undefined
  to: Date | undefined
}

export default function MetaAdsPage() {
  const [period, setPeriod]       = useState<FilterPeriod>('month')
  const [dateRange, setDateRange] = useState<DateRange | undefined>()
  const [data, setData]           = useState<MetaAttributionData | null>(null)
  const [loading, setLoading]     = useState(true)
  const [connected, setConnected] = useState(true)
  const [error, setError]         = useState<string | null>(null)

  const fetchData = useCallback(async (p: FilterPeriod, range?: DateRange) => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ period: p })
      if (p === 'custom' && range?.from && range?.to) {
        params.set('since', format(range.from, 'yyyy-MM-dd'))
        params.set('until', format(range.to,   'yyyy-MM-dd'))
      }
      const res = await fetch(`/api/crm/meta?${params}`)
      if (res.status === 424) { setConnected(false); return }
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setError(body?.error ?? `Erro ${res.status}`)
        return
      }
      setData(await res.json())
    } catch (err: any) {
      setError(err?.message ?? 'Erro de conexão')
    } finally {
      setLoading(false)
    }
  }, [])

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchData(period) }, [])

  function handlePeriodChange(p: FilterPeriod) {
    setPeriod(p)
    if (p !== 'custom') fetchData(p)
  }

  function handleDateChange(range: DateRange | undefined) {
    setDateRange(range)
    if (range?.from && range?.to) fetchData('custom', range)
  }

  if (!connected) return <MetaGate />

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Meta Ads</h1>
          <p className="text-sm text-muted-foreground">Atribuição de campanhas via WhatsApp</p>
        </div>

        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
          <FilterButtons selectedPeriod={period} onPeriodChange={handlePeriodChange} />
          {period === 'custom' && (
            <div className="w-full sm:w-64">
              <DateRangePicker date={dateRange} onDateChange={handleDateChange} />
            </div>
          )}
        </div>
      </div>

      {/* Conteúdo */}
      {loading ? (
        <div className="flex flex-col items-center justify-center min-h-[40vh] gap-3">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Carregando dados...</p>
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center min-h-[40vh] gap-3 text-center">
          <p className="text-sm font-medium text-foreground">Falha ao carregar dados</p>
          <p className="text-xs text-muted-foreground font-mono bg-muted px-3 py-1.5 rounded-md">{error}</p>
          <button
            onClick={() => fetchData(period)}
            className="text-xs text-primary underline"
          >
            Tentar novamente
          </button>
        </div>
      ) : data ? (
        <>
          <MetaSummaryCards summary={data.summary} />
          {data.campaigns.length > 0
            ? <CampaignTable campaigns={data.campaigns} />
            : <MetaEmptyState />}
        </>
      ) : null}
    </div>
  )
}
