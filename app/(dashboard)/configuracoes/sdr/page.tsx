'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { toast } from '@/components/ui/use-toast'
import { cn } from '@/lib/utils/cn'
import { Loader2, Save, MessageSquare, Copy, CheckCheck, Calendar, Zap, Wifi, WifiOff, Database } from 'lucide-react'

interface SdrConfig {
  id?: string
  agent_type: 'atendimento_venda' | 'atendimento_venda_agendamento'
  prompt: string
  agente_ativo: boolean
  webhook_url: string | null
  instance_status: 'disconnected' | 'connecting' | 'connected'
  instance_phone: string | null
  vector_table_conhecimento: string
  vector_table_objecoes: string
  conhecimento_ativo: boolean
  objecoes_ativo: boolean
}

const AGENT_TYPES = [
  {
    value: 'atendimento_venda',
    label: 'Atendimento + Venda',
    desc: 'Responde dúvidas dos leads e conduz a conversa para uma venda',
    icon: MessageSquare,
  },
  {
    value: 'atendimento_venda_agendamento',
    label: 'Atendimento + Venda + Agendamento',
    desc: 'Inclui agendamento automático de calls via Google Calendar',
    icon: Calendar,
  },
]

export default function SdrConfigPage() {
  const [config, setConfig] = useState<SdrConfig>({
    agent_type: 'atendimento_venda',
    prompt: '',
    agente_ativo: false,
    webhook_url: null,
    instance_status: 'disconnected',
    instance_phone: null,
    vector_table_conhecimento: '',
    vector_table_objecoes: '',
    conhecimento_ativo: true,
    objecoes_ativo: false,
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [copied, setCopied] = useState(false)

  const loadConfig = useCallback(async () => {
    try {
      const [configRes, statusRes] = await Promise.all([
        fetch('/api/sdr/config'),
        fetch('/api/sdr/status'),
      ])
      const data = await configRes.json()
      const liveStatus = statusRes.ok ? await statusRes.json() : null

      if (data.config) {
        setConfig({
          id: data.config.id,
          agent_type: data.config.agent_type ?? 'atendimento_venda',
          prompt: data.config.prompt ?? '',
          agente_ativo: data.config.agente_ativo ?? false,
          webhook_url: data.config.webhook_url ?? null,
          instance_status: liveStatus?.status ?? data.config.instance_status ?? 'disconnected',
          instance_phone: liveStatus?.phone ?? data.config.instance_phone ?? null,
          vector_table_conhecimento: data.config.vector_table_conhecimento ?? '',
          vector_table_objecoes: data.config.vector_table_objecoes ?? '',
          conhecimento_ativo: data.config.conhecimento_ativo ?? true,
          objecoes_ativo: data.config.objecoes_ativo ?? false,
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
          vector_table_conhecimento: config.vector_table_conhecimento,
          vector_table_objecoes: config.vector_table_objecoes,
          conhecimento_ativo: config.conhecimento_ativo,
          objecoes_ativo: config.objecoes_ativo,
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

  const isConnected = config.instance_status === 'connected'
  const isConnecting = config.instance_status === 'connecting'

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6 pb-12">

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Agente SDR</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Configure o agente de atendimento automático via WhatsApp
          </p>
        </div>
        <div className={cn(
          'flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border shrink-0',
          isConnected
            ? 'bg-green-500/10 text-green-700 border-green-500/30 dark:text-green-400'
            : isConnecting
            ? 'bg-yellow-500/10 text-yellow-700 border-yellow-500/30 dark:text-yellow-400'
            : 'bg-destructive/10 text-destructive border-destructive/30'
        )}>
          {isConnected
            ? <><Wifi className="w-3 h-3" /> Conectado</>
            : isConnecting
            ? <><Loader2 className="w-3 h-3 animate-spin" /> Conectando</>
            : <><WifiOff className="w-3 h-3" /> Desconectado</>
          }
          {config.instance_phone && (
            <span className="text-muted-foreground font-normal ml-1">· {config.instance_phone}</span>
          )}
        </div>
      </div>

      {/* ── Agente ativo ── */}
      <div className={cn(
        'flex items-center justify-between gap-4 p-4 rounded-xl border transition-colors',
        config.agente_ativo
          ? 'bg-primary/5 border-primary/30'
          : 'bg-muted/30 border-border'
      )}>
        <div className="flex items-center gap-3">
          <div className={cn(
            'w-9 h-9 rounded-lg flex items-center justify-center shrink-0',
            config.agente_ativo ? 'bg-primary/15' : 'bg-muted'
          )}>
            <Zap className={cn('w-4 h-4', config.agente_ativo ? 'text-primary' : 'text-muted-foreground')} />
          </div>
          <div>
            <p className={cn('font-medium text-sm', config.agente_ativo ? 'text-foreground' : 'text-muted-foreground')}>
              Agente ativo
            </p>
            <p className="text-xs text-muted-foreground">
              {config.agente_ativo
                ? 'Respondendo mensagens automaticamente'
                : 'Ative para responder mensagens automaticamente'}
            </p>
          </div>
        </div>
        <Switch
          checked={config.agente_ativo}
          onCheckedChange={(val) => setConfig((prev) => ({ ...prev, agente_ativo: val }))}
        />
      </div>

      {/* ── Tipo de agente ── */}
      <div className="space-y-2.5">
        <p className="text-sm font-medium">Tipo de agente</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {AGENT_TYPES.map((opt) => {
            const Icon = opt.icon
            const selected = config.agent_type === opt.value
            return (
              <button
                key={opt.value}
                onClick={() => setConfig((prev) => ({ ...prev, agent_type: opt.value as any }))}
                className={cn(
                  'text-left p-4 rounded-xl border transition-all',
                  selected
                    ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                    : 'border-border hover:border-border/80 hover:bg-muted/40'
                )}
              >
                <div className={cn(
                  'w-8 h-8 rounded-lg flex items-center justify-center mb-3',
                  selected ? 'bg-primary/15' : 'bg-muted'
                )}>
                  <Icon className={cn('w-4 h-4', selected ? 'text-primary' : 'text-muted-foreground')} />
                </div>
                <p className={cn('text-sm font-semibold', selected ? 'text-foreground' : 'text-muted-foreground')}>
                  {opt.label}
                </p>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{opt.desc}</p>
                {selected && (
                  <div className="mt-3 flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                    <span className="text-xs text-primary font-medium">Selecionado</span>
                  </div>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Instruções do agente ── */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">Instruções do agente</p>
          <span className="text-xs text-muted-foreground">{config.prompt.length} caracteres</span>
        </div>
        <Textarea
          value={config.prompt}
          onChange={(e) => setConfig((prev) => ({ ...prev, prompt: e.target.value }))}
          placeholder={'Descreva o comportamento do agente:\n• Tom de voz e personalidade\n• Produtos ou serviços oferecidos\n• Como abordar o cliente\n• O que nunca dizer\n• Horários de atendimento'}
          className="min-h-[220px] font-mono text-sm resize-y bg-muted/20 border-border/60 leading-relaxed"
        />
        <p className="text-xs text-muted-foreground">
          Essas instruções são injetadas no agente antes de cada resposta.
        </p>
      </div>

      {/* ── Base de conhecimento (RAG) ── */}
      <div className="space-y-4 p-4 rounded-xl border border-border bg-muted/20">
        <div className="flex items-center gap-2">
          <Database className="w-4 h-4 text-muted-foreground" />
          <p className="text-sm font-medium">Base de conhecimento (RAG)</p>
        </div>
        <p className="text-xs text-muted-foreground -mt-2">
          Nome das tabelas vetoriais no Supabase. Deixe em branco para usar o padrão da plataforma.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Conhecimento */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-muted-foreground">Tabela de conhecimento</label>
              <Switch
                checked={config.conhecimento_ativo}
                onCheckedChange={(val) => setConfig((prev) => ({ ...prev, conhecimento_ativo: val }))}
              />
            </div>
            <Input
              value={config.vector_table_conhecimento}
              onChange={(e) => setConfig((prev) => ({ ...prev, vector_table_conhecimento: e.target.value }))}
              placeholder="ex: Nexio_conhecimento"
              disabled={!config.conhecimento_ativo}
              className="font-mono text-xs h-8 bg-background"
            />
          </div>

          {/* Objeções */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-muted-foreground">Tabela de objeções</label>
              <Switch
                checked={config.objecoes_ativo}
                onCheckedChange={(val) => setConfig((prev) => ({ ...prev, objecoes_ativo: val }))}
              />
            </div>
            <Input
              value={config.vector_table_objecoes}
              onChange={(e) => setConfig((prev) => ({ ...prev, vector_table_objecoes: e.target.value }))}
              placeholder="ex: Nexio_objecoes"
              disabled={!config.objecoes_ativo}
              className="font-mono text-xs h-8 bg-background"
            />
          </div>
        </div>
      </div>

      {/* ── Webhook URL ── */}
      {config.webhook_url && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Webhook URL
          </p>
          <div className="flex gap-2 p-3 rounded-xl bg-muted/30 border border-border">
            <code className="flex-1 text-xs font-mono text-muted-foreground truncate">
              {config.webhook_url}
            </code>
            <button
              onClick={copyWebhook}
              className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
            >
              {copied
                ? <CheckCheck className="w-4 h-4 text-green-600" />
                : <Copy className="w-4 h-4" />}
            </button>
          </div>
          <p className="text-xs text-muted-foreground">Configure esta URL como webhook na sua instância UAZapi.</p>
        </div>
      )}

      {/* ── Save ── */}
      <div className="flex justify-end pt-2">
        <Button onClick={handleSave} disabled={saving} size="lg" className="min-w-[160px]">
          {saving
            ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Salvando…</>
            : <><Save className="w-4 h-4 mr-2" />Salvar configuração</>}
        </Button>
      </div>

    </div>
  )
}
