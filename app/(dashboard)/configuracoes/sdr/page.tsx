'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { toast } from '@/components/ui/use-toast'
import {
  Bot,
  Wifi,
  WifiOff,
  Loader2,
  RefreshCw,
  Save,
  Smartphone,
  Key,
  MessageSquare,
  Calendar,
  Copy,
  CheckCheck,
} from 'lucide-react'
import Image from 'next/image'

// ─── Tipos ────────────────────────────────────────────────

interface SdrConfig {
  id?: string
  agent_type: 'atendimento_venda' | 'atendimento_venda_agendamento'
  prompt: string
  agente_ativo: boolean
  uazapi_instance_name: string | null
  uazapi_instance_url: string | null
  uazapi_token: string | null
  google_calendar_id: string | null
  openai_key: string | null
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

const STATUS_LABEL: Record<string, string> = {
  connected: 'Conectado',
  connecting: 'Conectando…',
  disconnected: 'Desconectado',
}

const STATUS_COLOR: Record<string, 'default' | 'secondary' | 'destructive'> = {
  connected: 'default',
  connecting: 'secondary',
  disconnected: 'destructive',
}

// ─── Page ─────────────────────────────────────────────────

export default function SdrConfigPage() {
  const [config, setConfig] = useState<SdrConfig>({
    agent_type: 'atendimento_venda',
    prompt: '',
    agente_ativo: false,
    uazapi_instance_name: '',
    uazapi_instance_url: 'https://nexioai.uazapi.com',
    uazapi_token: '',
    google_calendar_id: '',
    openai_key: '',
    webhook_url: null,
    instance_status: 'disconnected',
    instance_phone: null,
  })
  // Flags separadas para saber se já existe token salvo (sem expor o valor)
  const [hasUazapiToken, setHasUazapiToken] = useState(false)
  const [hasOpenaiKey, setHasOpenaiKey] = useState(false)
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

  // ─── Carrega config ──────────────────────────────────────

  const loadConfig = useCallback(async () => {
    try {
      const res = await fetch('/api/sdr/config')
      const data = await res.json()
      if (data.config) {
        const cfg = data.config
        // Tokens mascarados ficam como string vazia no state — nunca sobrescrever o campo com '••••••••'
        setHasUazapiToken(!!cfg.uazapi_token)
        setHasOpenaiKey(!!cfg.openai_key)
        setConfig((prev) => ({
          ...prev,
          ...cfg,
          uazapi_token: '',
          openai_key: '',
        }))
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
      // silencioso em polling
    } finally {
      if (!silent) setPollingStatus(false)
    }
  }, [])

  useEffect(() => {
    loadConfig()
    loadStatus(true)
  }, [loadConfig, loadStatus])

  // Polling automático quando está conectando
  useEffect(() => {
    if (status.status !== 'connecting') return
    const interval = setInterval(() => loadStatus(true), 4000)
    return () => clearInterval(interval)
  }, [status.status, loadStatus])

  // ─── Salvar config ───────────────────────────────────────

  const handleSave = async () => {
    setSaving(true)
    try {
      const body: Record<string, any> = {
        agent_type: config.agent_type,
        prompt: config.prompt,
        agente_ativo: config.agente_ativo,
        uazapi_instance_name: config.uazapi_instance_name,
        uazapi_instance_url: config.uazapi_instance_url,
        google_calendar_id: config.google_calendar_id,
      }

      if (config.uazapi_token?.trim()) body.uazapi_token = config.uazapi_token.trim()
      if (config.openai_key?.trim()) body.openai_key = config.openai_key.trim()

      const res = await fetch('/api/sdr/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      // Atualiza flags e limpa campos de senha após salvar
      setHasUazapiToken(!!data.config?.uazapi_token)
      setHasOpenaiKey(!!data.config?.openai_key)
      setConfig((prev) => ({ ...prev, ...data.config, uazapi_token: '', openai_key: '' }))
      toast({ title: 'Configuração salva!' })
    } catch (err: any) {
      toast({ title: err.message || 'Erro ao salvar', variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  // ─── Conectar WhatsApp ───────────────────────────────────

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

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Bot className="w-7 h-7 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Agente SDR</h1>
            <p className="text-sm text-muted-foreground">Configure e ative o agente de atendimento automático</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant={STATUS_COLOR[config.instance_status]}>
            {STATUS_LABEL[config.instance_status]}
          </Badge>
          {config.instance_phone && (
            <span className="text-sm text-muted-foreground">{config.instance_phone}</span>
          )}
        </div>
      </div>

      {/* Toggle ativo */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Agente ativo</p>
              <p className="text-sm text-muted-foreground">
                Quando ativo, o agente responde automaticamente às mensagens recebidas no WhatsApp
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
            { value: 'atendimento_venda_agendamento', label: 'Atendimento + Venda + Agendamento', desc: 'Inclui agendamento via Google Calendar' },
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
                onChange={(e) =>
                  setConfig((prev) => ({ ...prev, agent_type: e.target.value as any }))
                }
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

      {/* Prompt */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Bot className="w-4 h-4" />
            Prompt do agente
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
            Este prompt é enviado ao modelo de IA como instrução de sistema antes de cada resposta.
          </p>
        </CardContent>
      </Card>

      {/* Credenciais uazapi */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Key className="w-4 h-4" />
            Credenciais uazapi
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>URL da instância</Label>
              <Input
                value={config.uazapi_instance_url ?? ''}
                onChange={(e) => setConfig((prev) => ({ ...prev, uazapi_instance_url: e.target.value }))}
                placeholder="https://nexioai.uazapi.com"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Nome da instância</Label>
              <Input
                value={config.uazapi_instance_name ?? ''}
                onChange={(e) => setConfig((prev) => ({ ...prev, uazapi_instance_name: e.target.value }))}
                placeholder="empresa-xyz"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Token da instância</Label>
            <Input
              type="password"
              value={config.uazapi_token ?? ''}
              onChange={(e) => setConfig((prev) => ({ ...prev, uazapi_token: e.target.value }))}
              placeholder={hasUazapiToken ? 'Token já salvo — cole aqui para alterar' : 'Cole o token aqui'}
            />
            {hasUazapiToken && !config.uazapi_token && (
              <p className="text-xs text-green-600">✓ Token configurado. Deixe vazio para manter o atual.</p>
            )}
          </div>

          {/* Webhook URL */}
          {config.webhook_url && (
            <div className="space-y-1.5">
              <Label>URL do webhook (configurar na uazapi)</Label>
              <div className="flex gap-2">
                <Input value={config.webhook_url} readOnly className="font-mono text-xs" />
                <Button variant="outline" size="icon" onClick={copyWebhook}>
                  {copied ? <CheckCheck className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                </Button>
              </div>
            </div>
          )}

          {/* OpenAI key opcional */}
          <div className="space-y-1.5">
            <Label>OpenAI API Key (opcional — usa chave global se vazio)</Label>
            <Input
              type="password"
              value={config.openai_key ?? ''}
              onChange={(e) => setConfig((prev) => ({ ...prev, openai_key: e.target.value }))}
              placeholder={hasOpenaiKey ? 'Chave já salva — cole aqui para alterar' : 'sk-…'}
            />
            {hasOpenaiKey && !config.openai_key && (
              <p className="text-xs text-green-600">✓ Chave configurada. Deixe vazio para manter a atual.</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Google Calendar (apenas se tipo = agendamento) */}
      {config.agent_type === 'atendimento_venda_agendamento' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Calendar className="w-4 h-4" />
              Google Calendar
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1.5">
              <Label>Calendar ID</Label>
              <Input
                value={config.google_calendar_id ?? ''}
                onChange={(e) => setConfig((prev) => ({ ...prev, google_calendar_id: e.target.value }))}
                placeholder="example@group.calendar.google.com"
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Conexão WhatsApp */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Smartphone className="w-4 h-4" />
            Conexão WhatsApp
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {status.status === 'connected' ? (
            <div className="flex items-center justify-between p-3 bg-green-500/10 rounded-lg border border-green-500/20">
              <div className="flex items-center gap-2">
                <Wifi className="w-5 h-5 text-green-600" />
                <div>
                  <p className="font-medium text-sm text-green-700">WhatsApp conectado</p>
                  {status.phone && <p className="text-xs text-muted-foreground">{status.phone}</p>}
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDisconnect}
                disabled={disconnecting}
              >
                {disconnecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <WifiOff className="w-4 h-4 mr-1" />}
                Desconectar
              </Button>
            </div>
          ) : (
            <>
              {/* QR Code ou Pairing Code */}
              {status.qrcode && (
                <div className="flex flex-col items-center gap-2 p-4 bg-muted/30 rounded-lg">
                  <p className="text-sm font-medium">Escaneie o QR Code com o WhatsApp</p>
                  <Image
                    src={`data:image/png;base64,${status.qrcode}`}
                    alt="QR Code WhatsApp"
                    width={220}
                    height={220}
                    className="rounded-lg border"
                  />
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Aguardando leitura…
                  </div>
                </div>
              )}

              {status.pairingCode && !status.qrcode && (
                <div className="flex flex-col items-center gap-2 p-4 bg-muted/30 rounded-lg">
                  <p className="text-sm font-medium">Código de emparelhamento</p>
                  <p className="text-3xl font-mono font-bold tracking-widest">{status.pairingCode}</p>
                  <p className="text-xs text-muted-foreground text-center">
                    No WhatsApp: Configurações → Aparelhos conectados → Conectar aparelho → Conectar com número de telefone
                  </p>
                </div>
              )}

              <div className="flex gap-2">
                <Input
                  value={connectPhone}
                  onChange={(e) => setConnectPhone(e.target.value)}
                  placeholder="Número para pairing code (ex: 5511999999999) — opcional"
                  className="flex-1"
                />
                <Button onClick={handleConnect} disabled={connecting}>
                  {connecting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Wifi className="w-4 h-4 mr-2" />}
                  {connectPhone ? 'Pairing Code' : 'Gerar QR Code'}
                </Button>
              </div>

              <Button
                variant="ghost"
                size="sm"
                className="w-full"
                onClick={() => loadStatus()}
                disabled={pollingStatus}
              >
                {pollingStatus ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <RefreshCw className="w-4 h-4 mr-1" />}
                Atualizar status
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      {/* Botão salvar */}
      <div className="flex justify-end pb-6">
        <Button onClick={handleSave} disabled={saving} size="lg">
          {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
          Salvar configuração
        </Button>
      </div>
    </div>
  )
}
