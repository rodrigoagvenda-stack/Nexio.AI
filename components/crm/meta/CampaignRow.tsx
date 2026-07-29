'use client'

import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { MetaCampaign } from './types'

const brl = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)

interface CampaignRowProps {
  campaign: MetaCampaign
}

export function CampaignRow({ campaign }: CampaignRowProps) {
  const [open, setOpen] = useState(false)
  const hasCreatives = campaign.creatives.length > 0

  return (
    <>
      <tr
        className={cn(
          'border-b border-border transition-colors',
          hasCreatives && 'cursor-pointer hover:bg-muted/40',
        )}
        onClick={() => hasCreatives && setOpen(o => !o)}
      >
        {/* Campanha */}
        <td className="px-4 py-3">
          <div className="flex items-center gap-2">
            {hasCreatives ? (
              open
                ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
            ) : (
              <span className="w-3.5" />
            )}
            <span className="text-sm font-medium text-foreground truncate max-w-[220px]">
              {campaign.name}
            </span>
          </div>
        </td>

        <td className="px-4 py-3 text-right text-sm tabular-nums">{campaign.leads}</td>
        <td className="px-4 py-3 text-right text-sm tabular-nums">{campaign.conversions}</td>
        <td className="px-4 py-3 text-right text-sm tabular-nums">{brl(campaign.revenue)}</td>
        <td className="px-4 py-3 text-right text-sm tabular-nums">{brl(campaign.spend)}</td>
        <td className="px-4 py-3 text-right text-sm tabular-nums">{brl(campaign.cpl)}</td>
        <td className="px-4 py-3 text-right text-sm tabular-nums font-medium">
          <span className={cn(campaign.roas >= 1 ? 'text-emerald-400' : 'text-red-400')}>
            {campaign.roas.toFixed(2)}x
          </span>
        </td>
      </tr>

      {/* Criativos expandidos */}
      {open && campaign.creatives.map((c, i) => (
        <tr key={i} className="border-b border-border/50 bg-muted/20">
          <td className="px-4 py-2 pl-10">
            <span className="text-xs text-muted-foreground truncate max-w-[200px] block">
              {c.headline}
            </span>
          </td>
          <td className="px-4 py-2 text-right text-xs tabular-nums text-muted-foreground">{c.leads}</td>
          <td className="px-4 py-2 text-right text-xs tabular-nums text-muted-foreground">{c.conversions}</td>
          <td className="px-4 py-2 text-right text-xs tabular-nums text-muted-foreground">{brl(c.revenue)}</td>
          <td className="px-4 py-2 text-right text-xs text-muted-foreground">-</td>
          <td className="px-4 py-2 text-right text-xs text-muted-foreground">-</td>
          <td className="px-4 py-2 text-right text-xs text-muted-foreground">-</td>
        </tr>
      ))}
    </>
  )
}
