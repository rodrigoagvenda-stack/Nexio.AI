'use client'

import { useEffect, useState } from 'react'
import { Copy, Check, Send, RefreshCw, FlaskConical, ChevronDown, ChevronUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from '@/components/ui/use-toast'
import { Badge } from '@/components/ui/badge'

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
  const [loadingList, setLoadingList] = useState(true)
  const [showList, setShowList] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)

  // Tester
  const [webhookUrl, setWebhookUrl] = useState('')
  const [testName, setTestName] = useState('')
  const [testEmail, setTestEmail] = useState('')
  const [testPhone, setTestPhone] = useState('')
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null)

  async function loadConfigs() {
    setLoadingList(true)
    try {
      const res = await fetch('/api/admin/trial/configs')
      const data = await res.json()
      setConfigs(data.configs ?? [])
    } catch {
      toast({ title: 'Erro ao carregar webhooks', variant: 'destructive' })
    } finally {
      setLoadingList(false)
    }
  }

  useEffect(() => { loadConfigs() }, [])

  function copy(text: string, key: string) {
    navigator.clipboard.writeText(text)
    setCopied(key)
    setTimeout(() => setCopied(null), 2000)
  }

  function useWebhook(url: string) {
    setWebhookUrl(url)
    window.scrollTo({ top: 0, behavior: 'smooth' })
    setShowList(false)
  }

  async function handleTest(e: React.FormEvent) {
    e.preventDefault()
    if (!webhookUrl) { toast({ title: 'Cole o webhook URL', variant: 'destructive' }); return }
    if (!testPhone) { toast({ title: 'WhatsApp é obrigatório', variant: 'destructive' }); return }
    setSending(true)
    setResult(null)
    try {
      const res = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: testName || 'Teste Admin',
          email: testEmail || `teste+${Date.now()}@admin.com`,
          whatsapp: testPhone.replace(/\D/g, ''),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Erro')
      setResult({ ok: true, msg: data.message || 'Cadastro realizado com sucesso!' })
    } catch (err: any) {
      setResult({ ok: false, msg: err.message || 'Erro inesperado' })
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="p-6 max-w-2xl space-y-6">
      <div>
        <h1 className="text-xl font-bold flex items-center gap-2">
          <FlaskConical className="w-5 h-5 text-emerald-500" />
          Testar Trial SaaS
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">Cole o webhook de um cliente e dispare o fluxo.</p>
      </div>

      {/* Formulário de teste */}
      <form onSubmit={handleTest} className="rounded-xl border border-border bg-card p-5 space-y-4">
        <div className="space-y-1.5">
          <Label className="text-xs">Webhook URL do cliente</Label>
          <Input
            value={webhookUrl}
            onChange={e => setWebhookUrl(e.target.value)}
            placeholder="https://app.zaapply.com.br/api/trial/webhook/..."
            className="font-mono text-xs h-9"
          />
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Nome</Label>
            <Input value={testName} onChange={e => setTestName(e.target.value)} placeholder="Teste Admin" className="h-9 text-sm" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">E-mail</Label>
            <Input value={testEmail} onChange={e => setTestEmail(e.target.value)} placeholder="opcional" className="h-9 text-sm" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">WhatsApp *</Label>
            <Input value={testPhone} onChange={e => setTestPhone(e.target.value)} placeholder="11999999999" className="h-9 text-sm" />
          </div>
        </div>

        <Button type="submit" disabled={sending} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white">
          {sending ? <><RefreshCw className="w-4 h-4 mr-2 animate-spin" />Enviando...</> : <><Send className="w-4 h-4 mr-2" />Disparar teste</>}
        </Button>

        {result && (
          <div className={`rounded-lg px-4 py-3 text-sm ${result.ok ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400' : 'bg-red-500/10 border border-red-500/20 text-red-400'}`}>
            {result.ok ? '✅ ' : '❌ '}{result.msg}
          </div>
        )}
      </form>

      {/* Lista de webhooks por empresa */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <button
          type="button"
          onClick={() => { setShowList(v => !v); if (!showList) loadConfigs() }}
          className="w-full flex items-center justify-between px-5 py-3.5 text-sm font-medium hover:bg-muted/30 transition-colors"
        >
          <span>Webhooks dos clientes</span>
          {showList ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
        </button>

        {showList && (
          <div className="border-t border-border divide-y divide-border">
            {loadingList ? (
              <p className="px-5 py-4 text-sm text-muted-foreground">Carregando...</p>
            ) : configs.length === 0 ? (
              <p className="px-5 py-4 text-sm text-muted-foreground">Nenhum cliente com trial configurado.</p>
            ) : configs.map(cfg => (
              <div key={cfg.company_id} className="flex items-center gap-3 px-5 py-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{cfg.company_name}</span>
                    {cfg.test_mode && <Badge className="text-[10px] bg-yellow-500/10 text-yellow-400 border-yellow-400/30">Modo Teste</Badge>}
                  </div>
                  <p className="text-[11px] text-muted-foreground font-mono truncate">{cfg.webhook_url}</p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <Button variant="outline" size="icon" className="h-7 w-7"
                    onClick={() => copy(cfg.webhook_url!, `copy-${cfg.company_id}`)}>
                    {copied === `copy-${cfg.company_id}` ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                  </Button>
                  <Button variant="outline" size="sm" className="h-7 text-xs"
                    onClick={() => useWebhook(cfg.webhook_url!)}>
                    Usar
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
