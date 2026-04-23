'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { toast } from '@/components/ui/use-toast'
import { Bot, Wifi, WifiOff, Loader2, Save, MessageSquare, Copy, CheckCheck } from 'lucide-react'

interface SdrConfig {
  id?: string
  agent_type: 'atendimento_venda' | 'atendimento_venda_agendamento'
  prompt: string
  agente_ativo: boolean
  webhook_url: string | null
  instance_status: 'disconnected' | 'connecting' | 'connected'
  instance_phone: string | null
}

const STATUS_LABEL: Record<string, string> = {
  connected: 'WhatsApp conectado',
  connecting: 'Conectando…',
  disconnected: 'WhatsApp desconectado',
}

const STATUS_COLOR: Record<string, 'default' | 'secondary' | 'destructive'> = {
  connected: 'default',
  connecting: 'secondary',
  disconnected: 'destructive',
}

export default function SdrConfigPage() {
  const [config, setConfig] = useState<SdrConfig>({
    agent_type: 'atendimento_venda',
    prompt: '',
    agente_ativo: false,
    webhook_url: null,
    instance_status: 'disconnected',
    instance_phone: null,
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [copied, setCopied] = useState(false)

  const loadConfig = useCallback(async () => {
    try {
      const res = await fetch('/api/sdr/config')
      const data = await res.json()
      if (data.config) {
        setConfig({
          id: data.config.id,
          agent_type: data.config.agent_type ?? 'atendimento_venda',
          prompt: data.config.prompt ?? '',
          agente_ativo: data.config.agente_ativo ?? false,
          webhook_url: data.config.webhook_url ?? null,
          instance_status: data.config.instance_status ?? 'disconnected',
          instance_phone: data.config.instance_phone ?? null,
        })
      }
    } catch {
      toast({ title: 'Erro ao carregar configuração', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadConfig() }, [loadConfig])

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/sdr/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agent_type: config.agent_type,
          prompt: config.prompt,
          agente_ativo: config.agente_ativo,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast({ title: 'Configuração salva!' })
    } catch (err: any) {
      toast({ title: err.message || 'Erro ao salvar', variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const copyWebhook = () => {
    if (!config.webhook_url) return
    navigator.clipboard.writeText(config.webhook_url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Bot className="w-7 h-7 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Agente SDR</h1>
            <p className="text-sm text-muted-foreground">Configure o agente de atendimento automático via WhatsApp</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={STATUS_COLOR[config.instance_status]}>
            {config.instance_status === 'connected'
              ? <><Wifi className="w-3 h-3 mr-1" />{STATUS_LABEL[config.instance_status]}</>
              : <><WifiOff className="w-3 h-3 mr-1" />{STATUS_LABEL[config.instance_status]}</>}
          </Badge>
          {config.instance_phone && (
            <span className="text-xs text-muted-foreground">{config.instance_phone}</span>
          )}
        </div>
      </div>

      {/* Toggle agente ativo */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Agente ativo</p>
              <p className="text-sm text-muted-foreground">
                Quando ativo, o agente responde automaticamente às mensagens recebidas
              </p>
            </div>
            <Switch
              checked={config.agente_ativo}
              onCheckedChange={(val) => setConfig((prev) => ({ ...prev, agente_ativo: val }))}
            />
          </div>
        </CardContent>
      </Card>

      {/* Tipo de agente */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <MessageSquare className="w-4 h-4" />
            Tipo de agente
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[
            { value: 'atendimento_venda', label: 'Atendimento + Venda', desc: 'Responde dúvidas e converte leads' },
            { value: 'atendimento_venda_agendamento', label: 'Atendimento + Venda + Agendamento', desc: 'Inclui agendamento de calls via Google Calendar' },
          ].map((opt) => (
            <label
              key={opt.value}
              className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                config.agent_type === opt.value ? 'border-primary bg-primary/5' : 'border-muted hover:bg-muted/30'
              }`}
            >
              <input
                type="radio"
                name="agent_type"
                value={opt.value}
                checked={config.agent_type === opt.value}
                onChange={(e) => setConfig((prev) => ({ ...prev, agent_type: e.target.value as any }))}
                className="mt-0.5"
              />
              <div>
                <p className="font-medium text-sm">{opt.label}</p>
                <p className="text-xs text-muted-foreground">{opt.desc}</p>
              </div>
            </label>
          ))}
        </CardContent>
      </Card>

      {/* Prompt do agente */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Bot className="w-4 h-4" />
            Instruções do agente
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            value={config.prompt}
            onChange={(e) => setConfig((prev) => ({ ...prev, prompt: e.target.value }))}
            placeholder="Descreva o comportamento do agente: tom de voz, produtos/serviços, como abordar o cliente, o que não dizer…"
            className="min-h-[200px] font-mono text-sm resize-y"
          />
          <p className="text-xs text-muted-foreground mt-2">
            Instruções injetadas no agente antes de cada resposta. Quanto mais específico, melhor o resultado.
          </p>
        </CardContent>
      </Card>

      {/* Webhook URL — somente leitura */}
      {config.webhook_url && (
        <Card>
          <CardContent className="pt-5">
            <p className="text-sm font-medium mb-1.5">URL do Webhook WhatsApp</p>
            <div className="flex gap-2">
              <code className="flex-1 text-xs bg-muted px-3 py-2 rounded-lg font-mono truncate">
                {config.webhook_url}
              </code>
              <Button variant="outline" size="icon" onClick={copyWebhook}>
                {copied ? <CheckCheck className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-1.5">
              Configure esta URL no painel do WhatsApp para receber mensagens.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Salvar */}
      <div className="flex justify-end pb-6">
        <Button onClick={handleSave} disabled={saving} size="lg">
          {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
          Salvar configuração
        </Button>
      </div>
    </div>
  )
}
