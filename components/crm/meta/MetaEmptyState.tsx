'use client'

import { BarChart2 } from 'lucide-react'

export function MetaEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[40vh] gap-4 text-center">
      <div className="p-3 rounded-xl" style={{ background: 'rgba(24,119,242,0.1)' }}>
        <BarChart2 className="h-8 w-8" style={{ color: '#1877F2' }} />
      </div>
      <div className="space-y-1">
        <p className="text-sm font-medium text-foreground">Nenhum dado encontrado</p>
        <p className="text-xs text-muted-foreground max-w-xs">
          Nenhum lead com atribuição Meta Ads foi encontrado no período selecionado.
        </p>
      </div>
    </div>
  )
}
