'use client'

import { useState, useCallback, useEffect } from 'react'
import { format } from 'date-fns'
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
  const [period, setPeriod]   = useState<FilterPeriod>('month')
  const [dateRange, setDateRange] = useState<DateRange | undefined>()
  const [data, setData]       = useState<MetaAttributionData | null>(null)
  const [loading, setLoading] = useState(true)
  const [connected, setConnected] = useState(true)

  const fetchData = useCallback(async (p: FilterPeriod, range?: DateRange) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ period: p })
      if (p === 'custom' && range?.from && range?.to) {
        params.set('since', format(range.from, 'yyyy-MM-dd'))
        params.set('until', format(range.to,   'yyyy-MM-dd'))
      }
      const res = await fetch(`/api/crm/meta?${params}`)
      if (res.status === 424) { setConnected(false); return }
      if (!res.ok) return
      setData(await res.json())
    } finally {
      setLoading(false)
    }
  }, [])

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

        {/* Filtros */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
          <FilterButtons selectedPeriod={period} onPeriodChange={handlePeriodChange} />
          {period === 'custom' && (
            <div className="w-full sm:w-64">
              <DateRangePicker date={dateRange} onDateChange={handleDateChange} />
            </div>
          )}
        </div>
      </div>

      {/* Cards de resumo */}
      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-24 rounded-xl bg-muted/40 animate-pulse" />
          ))}
        </div>
      ) : data ? (
        <MetaSummaryCards summary={data.summary} />
      ) : null}

      {/* Tabela de campanhas */}
      {loading ? (
        <div className="h-48 rounded-xl bg-muted/30 animate-pulse" />
      ) : data && data.campaigns.length > 0 ? (
        <CampaignTable campaigns={data.campaigns} />
      ) : data && data.campaigns.length === 0 ? (
        <MetaEmptyState />
      ) : null}
    </div>
  )
}
