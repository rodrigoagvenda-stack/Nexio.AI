'use client'

import { CampaignRow } from './CampaignRow'
import type { MetaCampaign } from './types'

const HEADERS = [
  { label: 'Campanha',    align: 'left'  },
  { label: 'Leads',       align: 'right' },
  { label: 'Conversões',  align: 'right' },
  { label: 'Receita',     align: 'right' },
  { label: 'Investimento',align: 'right' },
  { label: 'CPL',         align: 'right' },
  { label: 'ROAS',        align: 'right' },
] as const

interface CampaignTableProps {
  campaigns: MetaCampaign[]
}

export function CampaignTable({ campaigns }: CampaignTableProps) {
  return (
    <div className="rounded-xl border border-border overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              {HEADERS.map(h => (
                <th
                  key={h.label}
                  className={`px-4 py-3 text-xs font-medium text-muted-foreground whitespace-nowrap ${h.align === 'right' ? 'text-right' : 'text-left'}`}
                >
                  {h.label}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {campaigns.map(c => (
              <CampaignRow key={c.id} campaign={c} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
