'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { toast } from '@/components/ui/use-toast'
import { cn } from '@/lib/utils/cn'
import {
  Bot, Wifi, WifiOff, Loader2, Save, MessageSquare,
  Copy, CheckCheck, Smartphone, RefreshCw, Calendar, Zap,
} from 'lucide-react'
import Image from 'next/image'

interface SdrConfig {
  id?: string
  agent_type: 'atendimento_venda' | 'atendimento_venda_agendamento'
  prompt: string
  agente_ativo: boolean
  webhook_url: string | null
  instance_status: 'disconnected' | 'connecting' | 'connected'
  instance_phone: string | null
}

interface StatusData {
  status: 'disconnected' | 'connecting' | 'connected'
  phone: string | null
  qrcode: string | null
  pairingCode: string | null
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
  })
  const [status, setStatus] = useState<StatusData>({
    status: 'disconnected',
    phone: null,
    qrcode: null,
    pairingCode: null,
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)
  const [pollingStatus, setPollingStatus] = useState(false)
  const [connectPhone, setConnectPhone] = useState('')
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

  const loadStatus = useCallback(async (silent = false) => {
    if (!silent) setPollingStatus(true)
    try {
      const res = await fetch('/api/sdr/status')
      if (!res.ok) return
      const data: StatusData = await res.json()
      setStatus(data)
      setConfig((prev) => ({
        ...prev,
        instance_status: data.status,
        instance_phone: data.phone,
      }))
    } catch {
      // silencioso
    } finally {
      if (!silent) setPollingStatus(false)
    }
  }, [])

  useEffect(() => {
    loadConfig()
    loadStatus(true)
  }, [loadConfig, loadStatus])

  useEffect(() => {
    if (status.status !== 'connecting') return
    const interval = setInterval(() => loadStatus(true), 4000)
    return () => clearInterval(interval)
  }, [status.status, loadStatus])

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

  const handleConnect = async () => {
    setConnecting(true)
    setStatus({ status: 'connecting', phone: null, qrcode: null, pairingCode: null })
    try {
      const res = await fetch('/api/sdr/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(connectPhone ? { phone: connectPhone } : {}),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setStatus((prev) => ({
        ...prev,
        qrcode: data.qrcode ?? null,
        pairingCode: data.pairingCode ?? null,
        status: 'connecting',
      }))
    } catch (err: any) {
      toast({ title: err.message || 'Erro ao conectar', variant: 'destructive' })
      setStatus((prev) => ({ ...prev, status: 'disconnected' }))
    } finally {
      setConnecting(false)
    }
  }

  const handleDisconnect = async () => {
    setDisconnecting(true)
    try {
      const res = await fetch('/api/sdr/connect', { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setStatus({ status: 'disconnected', phone: null, qrcode: null, pairingCode: null })
      toast({ title: 'WhatsApp desconectado' })
    } catch (err: any) {
      toast({ title: err.message || 'Erro ao desconectar', variant: 'destructive' })
    } finally {
      setDisconnecting(false)
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

  const isConnected = config.instance_status === 'connected'
  const isConnecting = config.instance_status === 'connecting'

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

      {/* ── Conexão WhatsApp ── */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Smartphone className="w-4 h-4 text-muted-foreground" />
          <p className="text-sm font-medium">Conexão WhatsApp</p>
        </div>

        {isConnected ? (
          <div className="flex items-center justify-between p-4 rounded-xl bg-green-500/8 border border-green-500/20">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-green-500/15 flex items-center justify-center">
                <Wifi className="w-4 h-4 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-green-700 dark:text-green-400">Conectado</p>
                {status.phone && (
                  <p className="text-xs text-muted-foreground">{status.phone}</p>
                )}
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={handleDisconnect} disabled={disconnecting}>
              {disconnecting
                ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                : <WifiOff className="w-3.5 h-3.5 mr-1.5" />}
              Desconectar
            </Button>
          </div>
        ) : (
          <div className="rounded-xl border border-border overflow-hidden">
            {/* QR Code */}
            {status.qrcode && (
              <div className="flex flex-col items-center gap-3 p-6 bg-muted/20 border-b border-border">
                <p className="text-sm font-medium">Escaneie com o WhatsApp</p>
                <div className="p-3 bg-white rounded-xl shadow-sm">
                  <Image
                    src={`data:image/png;base64,${status.qrcode}`}
                    alt="QR Code WhatsApp"
                    width={200}
                    height={200}
                    className="rounded-lg"
                  />
                </div>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Aguardando leitura…
                </div>
              </div>
            )}

            {/* Pairing Code */}
            {status.pairingCode && !status.qrcode && (
              <div className="flex flex-col items-center gap-3 p-6 bg-muted/20 border-b border-border">
                <p className="text-sm font-medium">Código de emparelhamento</p>
                <div className="px-6 py-3 bg-background rounded-xl border border-border">
                  <p className="text-3xl font-mono font-bold tracking-[0.3em] text-foreground">
                    {status.pairingCode}
                  </p>
                </div>
                <p className="text-xs text-muted-foreground text-center max-w-xs leading-relaxed">
                  No WhatsApp: <strong>Configurações → Aparelhos conectados → Conectar com número de telefone</strong>
                </p>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Aguardando confirmação…
                </div>
              </div>
            )}

            {/* Connect form */}
            <div className="p-4 space-y-3">
              <div className="flex gap-2">
                <Input
                  value={connectPhone}
                  onChange={(e) => setConnectPhone(e.target.value)}
                  placeholder="DDI + número (ex: 5511999999999) — opcional"
                  className="flex-1 text-sm"
                />
                <Button onClick={handleConnect} disabled={connecting}>
                  {connecting
                    ? <Loader2 className="w-4 h-4 animate-spin" />
                    : <Wifi className="w-4 h-4" />}
                  <span className="ml-2">{connectPhone ? 'Código' : 'QR Code'}</span>
                </Button>
              </div>
              <button
                onClick={() => loadStatus()}
                disabled={pollingStatus}
                className="w-full flex items-center justify-center gap-1.5 text-xs text-muted-foreground hover:text-foreground py-1.5 transition-colors"
              >
                {pollingStatus
                  ? <Loader2 className="w-3 h-3 animate-spin" />
                  : <RefreshCw className="w-3 h-3" />}
                Atualizar status
              </button>
            </div>
          </div>
        )}
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
