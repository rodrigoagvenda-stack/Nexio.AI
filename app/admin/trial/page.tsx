'use client'

import { useEffect, useState } from 'react'
import { Copy, Check, ExternalLink, Send, RefreshCw, FlaskConical } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from '@/components/ui/use-toast'
import { Badge } from '@/components/ui/badge'

interface CompanyTrialConfig {
  company_id: number
  company_name: string
  webhook_token: string | null
  trial_days_default: number | null
  test_mode: boolean
  test_phone: string | null
  form_url: string | null
  webhook_url: string | null
}

export default function AdminTrialPage() {
  const [configs, setConfigs] = useState<CompanyTrialConfig[]>([])
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState<string | null>(null)
  const [testing, setTesting] = useState<number | null>(null)
  const [testName, setTestName] = useState('Teste Admin')
  const [testEmail, setTestEmail] = useState('')
  const [testPhone, setTestPhone] = useState('')

  async function load() {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/trial/configs')
      const data = await res.json()
      setConfigs(data.configs ?? [])
    } catch {
      toast({ title: 'Erro ao carregar configs', variant: 'destructive' })
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

  async function test(cfg: CompanyTrialConfig) {
    if (!cfg.webhook_url) return
    if (!testPhone) { toast({ title: 'Informe o WhatsApp de teste', variant: 'destructive' }); return }
    setTesting(cfg.company_id)
    try {
      const res = await fetch(cfg.webhook_url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: testName, email: testEmail || `teste+${Date.now()}@admin.com`, whatsapp: testPhone.replace(/\D/g, '') }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Erro')
      toast({ title: '✅ Teste enviado com sucesso!' })
    } catch (err: any) {
      toast({ title: `Erro: ${err.message}`, variant: 'destructive' })
    } finally {
      setTesting(null)
    }
  }

  return (
    <div className="p-6 max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <FlaskConical className="w-5 h-5 text-emerald-500" />
            Trial SaaS — Formulários
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">Webhook URL e link do formulário por empresa</p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
      </div>

      {/* Dados para teste */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <p className="text-sm font-semibold">Dados para teste</p>
        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Nome</Label>
            <Input value={testName} onChange={e => setTestName(e.target.value)} placeholder="Nome" className="h-8 text-sm" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">E-mail (opcional)</Label>
            <Input value={testEmail} onChange={e => setTestEmail(e.target.value)} placeholder="teste@email.com" className="h-8 text-sm" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">WhatsApp *</Label>
            <Input value={testPhone} onChange={e => setTestPhone(e.target.value)} placeholder="11999999999" className="h-8 text-sm" />
          </div>
        </div>
      </div>

      {/* Lista de empresas */}
      {loading ? (
        <div className="text-sm text-muted-foreground">Carregando...</div>
      ) : configs.length === 0 ? (
        <div className="text-sm text-muted-foreground">Nenhuma empresa com Trial SaaS configurado.</div>
      ) : (
        <div className="space-y-3">
          {configs.map(cfg => (
            <div key={cfg.company_id} className="rounded-xl border border-border bg-card p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm">{cfg.company_name}</span>
                  <Badge variant="outline" className="text-[10px]">ID {cfg.company_id}</Badge>
                  {cfg.test_mode && <Badge className="text-[10px] bg-yellow-500/10 text-yellow-400 border-yellow-400/30">Modo Teste</Badge>}
                </div>
                <span className="text-xs text-muted-foreground">{cfg.trial_days_default ?? 7} dias de trial</span>
              </div>

              {cfg.webhook_url ? (
                <div className="space-y-2">
                  {/* Webhook URL */}
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Webhook URL</Label>
                    <div className="flex items-center gap-2">
                      <Input value={cfg.webhook_url} readOnly className="h-8 text-xs font-mono bg-muted/40" />
                      <Button variant="outline" size="icon" className="h-8 w-8 shrink-0"
                        onClick={() => copy(cfg.webhook_url!, `wh-${cfg.company_id}`)}>
                        {copied === `wh-${cfg.company_id}` ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                      </Button>
                    </div>
                  </div>

                  {/* Form URL */}
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Link do formulário</Label>
                    <div className="flex items-center gap-2">
                      <Input value={cfg.form_url ?? ''} readOnly className="h-8 text-xs font-mono bg-muted/40" />
                      <Button variant="outline" size="icon" className="h-8 w-8 shrink-0"
                        onClick={() => copy(cfg.form_url!, `form-${cfg.company_id}`)}>
                        {copied === `form-${cfg.company_id}` ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                      </Button>
                      <Button variant="outline" size="icon" className="h-8 w-8 shrink-0"
                        onClick={() => window.open(cfg.form_url!, '_blank')}>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>

                  {/* Test button */}
                  <Button size="sm" variant="outline" className="w-full h-8 text-xs border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
                    onClick={() => test(cfg)} disabled={testing === cfg.company_id}>
                    {testing === cfg.company_id
                      ? <><RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" />Enviando...</>
                      : <><Send className="w-3.5 h-3.5 mr-1.5" />Testar agora</>}
                  </Button>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">Token não gerado — empresa precisa acessar Configurações → Trial SaaS.</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
