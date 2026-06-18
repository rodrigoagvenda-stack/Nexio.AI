'use client'

import Link from 'next/link'
import { BarChart2, Settings } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function MetaGate() {
  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[60vh] gap-6 text-center">
      <div className="p-4 rounded-2xl" style={{ background: 'rgba(24,119,242,0.12)' }}>
        <BarChart2 className="h-10 w-10" style={{ color: '#1877F2' }} />
      </div>

      <div className="space-y-2 max-w-sm">
        <h2 className="text-lg font-semibold text-foreground">Painel Meta Ads</h2>
        <p className="text-sm text-muted-foreground">
          Conecte sua conta GTPRO nas configurações para visualizar a atribuição de campanhas.
        </p>
      </div>

      <Button asChild>
        <Link href="/configuracoes?tab=integracoes">
          <Settings className="h-4 w-4 mr-2" />
          Conectar GTPRO
        </Link>
      </Button>
    </div>
  )
}
