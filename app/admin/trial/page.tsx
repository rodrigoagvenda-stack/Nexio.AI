'use client'

import { useEffect, useState } from 'react'
import { Copy, Check, ExternalLink, RefreshCw, FlaskConical, ChevronDown, ChevronUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { toast } from '@/components/ui/use-toast'

interface CompanyTrialConfig {
  company_id: number
  company_name: string
  webhook_url: string | null
  form_url: string | null
  test_mode: boolean
  trial_days_default: number | null
}

export default function AdminTrialPage() {
  const [configs, setConfigs] = useState<CompanyTrialConfig[]>([])
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState<string | null>(null)
  const [showList, setShowList] = useState(true)

  async function load() {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/trial/configs')
      const data = await res.json()
      setConfigs(data.configs ?? [])
    } catch {
      toast({ title: 'Erro ao carregar', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  function copy(text: string, key: string) {
    navigator.clipboard.writeText(text)
    setCopied(key)
    setTimeout(() => setCopied(null), 2000)
  }

  function openTestForm(webhookUrl: string) {
    const encoded = btoa(webhookUrl)
    window.open(`/trial/test?wh=${encoded}`, '_blank')
  }

  return (
    <div className="p-6 max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <FlaskConical className="w-5 h-5 text-emerald-500" />
            Trial SaaS: Testes
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Selecione um cliente e abra o formulário de teste para simular um cadastro.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <button
          type="button"
          onClick={() => setShowList(v => !v)}
          className="w-full flex items-center justify-between px-5 py-3.5 text-sm font-medium hover:bg-muted/30 transition-colors"
        >
          <span>Clientes com Trial configurado</span>
          {showList ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
        </button>

        {showList && (
          <div className="border-t border-border divide-y divide-border">
            {loading ? (
              <p className="px-5 py-4 text-sm text-muted-foreground">Carregando...</p>
            ) : configs.length === 0 ? (
              <p className="px-5 py-4 text-sm text-muted-foreground">Nenhum cliente com trial configurado.</p>
            ) : configs.map(cfg => (
              <div key={cfg.company_id} className="flex items-center gap-3 px-5 py-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium">{cfg.company_name}</span>
                    <Badge variant="outline" className="text-[10px]">ID {cfg.company_id}</Badge>
                    {cfg.test_mode && <Badge className="text-[10px] bg-yellow-500/10 text-yellow-400 border-yellow-400/30">Modo Teste</Badge>}
                  </div>
                  <p className="text-[11px] text-muted-foreground font-mono truncate">{cfg.webhook_url}</p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Button variant="outline" size="icon" className="h-8 w-8"
                    title="Copiar webhook"
                    onClick={() => copy(cfg.webhook_url!, `copy-${cfg.company_id}`)}>
                    {copied === `copy-${cfg.company_id}` ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                  </Button>
                  <Button
                    size="sm"
                    className="h-8 bg-emerald-600 hover:bg-emerald-500 text-white text-xs gap-1.5"
                    onClick={() => openTestForm(cfg.webhook_url!)}
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    Abrir formulário
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
