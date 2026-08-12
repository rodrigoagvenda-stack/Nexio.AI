'use client'

import { useState, useEffect, useCallback } from 'react'
import { Loader2, Shield, ChevronLeft, ChevronRight, Search, Filter } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface AuditEntry {
  id: string
  created_at: string
  event_type: string
  conversation_id: number | null
  actor: string | null
  detail: Record<string, unknown> | null
}

const EVENT_LABELS: Record<string, string> = {
  assigned: 'Atribuída',
  reassigned: 'Reatribuída',
  warmed_up: 'Warm-up concluído',
  released: 'Liberada',
  reviewed: 'Revisada',
  deal_closed: 'Negócio fechado',
  transferred: 'Transferida',
}

const EVENT_COLORS: Record<string, string> = {
  deal_closed: 'bg-emerald-500/15 text-emerald-400',
  transferred: 'bg-blue-500/15 text-blue-400',
  released: 'bg-yellow-500/15 text-yellow-500',
  reassigned: 'bg-orange-500/15 text-orange-400',
}

function fmtDate(iso: string) {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit', month: '2-digit', year: '2-digit',
    hour: '2-digit', minute: '2-digit',
  }).format(new Date(iso))
}

const PAGE_SIZE = 50

export default function AuditoriaPage() {
  const [entries, setEntries] = useState<AuditEntry[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(0)
  const [actionFilter, setActionFilter] = useState('')
  const [migrationPending, setMigrationPending] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({
      limit: String(PAGE_SIZE),
      offset: String(page * PAGE_SIZE),
    })
    if (actionFilter) params.set('action', actionFilter)  // maps to event_type on API

    const res = await fetch(`/api/audit-log?${params}`)
    const d = await res.json()
    if (d?.migration_pending) { setMigrationPending(true); setLoading(false); return; }
    setEntries(d?.data ?? [])
    setTotal(d?.total ?? 0)
    setLoading(false)
  }, [page, actionFilter])

  useEffect(() => { load() }, [load])

  const totalPages = Math.ceil(total / PAGE_SIZE)

  if (migrationPending) {
    return (
      <div className="p-8 text-center">
        <Shield className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
        <p className="font-medium">Log de Auditoria</p>
        <p className="text-sm text-muted-foreground mt-1">
          Execute a migration <code className="text-xs bg-muted px-1 rounded">20260812000000_prd_zaapply_fase1.sql</code> para habilitar esta funcionalidade.
        </p>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-5 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Log de Auditoria
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Histórico de ações críticas da equipe
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Filter className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <select
              value={actionFilter}
              onChange={e => { setActionFilter(e.target.value); setPage(0); }}
              className="h-8 pl-8 pr-3 text-xs rounded-lg border border-border bg-background appearance-none cursor-pointer"
            >
              <option value="">Todos os eventos</option>
              {Object.entries(EVENT_LABELS).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>
          <Button variant="outline" size="sm" className="h-8 text-xs" onClick={load}>
            Atualizar
          </Button>
        </div>
      </div>

      {/* Tabela */}
      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-40">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : entries.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-center">
            <Shield className="h-8 w-8 text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">Nenhum evento registrado ainda.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border">
                <tr>
                  <th className="text-left text-xs font-medium text-muted-foreground px-4 py-2.5">Data</th>
                  <th className="text-left text-xs font-medium text-muted-foreground px-4 py-2.5">Ação</th>
                  <th className="text-left text-xs font-medium text-muted-foreground px-4 py-2.5">Atendente</th>
                  <th className="text-left text-xs font-medium text-muted-foreground px-4 py-2.5">Conversa</th>
                  <th className="text-left text-xs font-medium text-muted-foreground px-4 py-2.5">Detalhe</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {entries.map(entry => {
                  const eventColor = EVENT_COLORS[entry.event_type] ?? 'bg-muted text-muted-foreground'
                  const label = EVENT_LABELS[entry.event_type] ?? entry.event_type
                  return (
                    <tr key={entry.id} className="hover:bg-accent/30 transition-colors">
                      <td className="px-4 py-2.5 text-xs text-muted-foreground tabular-nums whitespace-nowrap">
                        {fmtDate(entry.created_at)}
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={cn('text-[11px] font-medium px-2 py-0.5 rounded-full', eventColor)}>
                          {label}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-xs text-muted-foreground font-mono">
                        {entry.actor && entry.actor !== 'system'
                          ? entry.actor.slice(0, 8) + '...'
                          : entry.actor ?? '-'}
                      </td>
                      <td className="px-4 py-2.5 text-xs text-muted-foreground font-mono">
                        {entry.conversation_id ?? '-'}
                      </td>
                      <td className="px-4 py-2.5 text-xs text-muted-foreground max-w-xs truncate">
                        {entry.detail ? JSON.stringify(entry.detail).slice(0, 80) : '-'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Paginação */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            {total} evento{total !== 1 ? 's' : ''} no total
          </p>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="h-7 w-7 p-0" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            <span className="text-xs text-muted-foreground tabular-nums">
              {page + 1} / {totalPages}
            </span>
            <Button variant="outline" size="sm" className="h-7 w-7 p-0" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
