'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { toast } from '@/components/ui/use-toast'
import { cn } from '@/lib/utils/cn'
import {
  Loader2, Save, MessageSquare, Copy, CheckCheck, Calendar,
  Zap, Wifi, WifiOff, Bot, Plus, Trash2,
  Upload, FileText, AlertCircle,
  CheckCircle2, X, BookOpen, ShieldAlert, LogOut,
  Settings, Brain, Link2,
} from 'lucide-react'

// ── Types ──────────────────────────────────────────────────────────────────

interface AgentPersona {
  nome_agente: string; tom: string; empresa: string
  produto: string; restricoes: string; horario: string
}
interface SdrConfig {
  id?: string; agent_type: 'atendimento_venda' | 'atendimento_venda_agendamento'
  persona: AgentPersona; agente_ativo: boolean; webhook_url: string | null
  instance_status: 'disconnected' | 'connecting' | 'connected'; instance_phone: string | null
  vector_table_conhecimento: string; vector_table_objecoes: string
  conhecimento_ativo: boolean; objecoes_ativo: boolean
  google_calendar_id: string; flow_id: string | null
}
interface GoogleStatus { connected: boolean; email: string | null }
interface CalendarItem { id: string; summary: string; primary: boolean; backgroundColor?: string }
interface KnowledgeItem { id: string; pergunta: string; resposta: string }
interface ObjectionItem { id: string; objecao: string; resposta: string; exemplo: string }

// ── Helpers ────────────────────────────────────────────────────────────────

const uid = () => Math.random().toString(36).slice(2)

const EMPTY_PERSONA: AgentPersona = {
  nome_agente: '', tom: '', empresa: '', produto: '', restricoes: '', horario: '',
}

function parsePersona(raw: string): AgentPersona {
  if (!raw) return { ...EMPTY_PERSONA }
  try { const p = JSON.parse(raw); if (p && typeof p === 'object') return { ...EMPTY_PERSONA, ...p } } catch {}
  return { ...EMPTY_PERSONA }
}

const AGENT_TYPES = [
  { value: 'atendimento_venda', label: 'Atendimento + Venda', desc: 'Responde dúvidas e conduz para a venda', icon: MessageSquare },
  { value: 'atendimento_venda_agendamento', label: '+ Agendamento', desc: 'Inclui agendamento via Google Calendar', icon: Calendar },
]

const TABS = [
  { id: 'geral', label: 'Geral', icon: Settings },
  { id: 'identidade', label: 'Identidade', icon: Bot },
  { id: 'conhecimento', label: 'Conhecimento', icon: Brain },
  { id: 'integracoes', label: 'Integrações', icon: Link2 },
] as const
type TabId = typeof TABS[number]['id']

// ── Field ──────────────────────────────────────────────────────────────────

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      {children}
      {hint && <p className="text-[11px] text-muted-foreground/70">{hint}</p>}
    </div>
  )
}

// ── Knowledge Builder ──────────────────────────────────────────────────────

function KnowledgeBuilder({ flowId, type, active, onActiveChange }: {
  flowId: string | null; type: 'conhecimento' | 'objecoes'
  active: boolean; onActiveChange: (v: boolean) => void
}) {
  const [mode, setMode] = useState<'form' | 'pdf'>('form')
  const [items, setItems] = useState<KnowledgeItem[] | ObjectionItem[]>(
    type === 'conhecimento'
      ? [{ id: uid(), pergunta: '', resposta: '' }] as KnowledgeItem[]
      : [{ id: uid(), objecao: '', resposta: '', exemplo: '' }] as ObjectionItem[]
  )
  const [processing, setProcessing] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<string | null>(null)
  const [lastResult, setLastResult] = useState<{ chunks: number; table: string } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const isConhecimento = type === 'conhecimento'
  const label = isConhecimento ? 'Conhecimento' : 'Objeções'

  function addItem() {
    if (isConhecimento) {
      setItems((prev) => [...prev, { id: uid(), pergunta: '', resposta: '' }] as KnowledgeItem[])
    } else {
      setItems((prev) => [...prev, { id: uid(), objecao: '', resposta: '', exemplo: '' }] as ObjectionItem[])
    }
  }

  function removeItem(id: string) {
    setItems((prev) => (prev as any[]).filter((i) => i.id !== id))
  }

  function updateItem(id: string, field: string, value: string) {
    setItems((prev) => (prev as any[]).map((i) => i.id === id ? { ...i, [field]: value } : i))
  }

  async function processForm() {
    if (!flowId) { toast({ title: 'Salve a configuração primeiro', variant: 'destructive' }); return }
    setProcessing(true)
    try {
      const endpoint = isConhecimento
        ? `/api/sdr/flows/${flowId}/knowledge/structured`
        : `/api/sdr/flows/${flowId}/objections/structured`

      const body = isConhecimento
        ? { items: (items as KnowledgeItem[]).map(({ pergunta, resposta }) => ({ pergunta, resposta })) }
        : { items: (items as ObjectionItem[]).map(({ objecao, resposta, exemplo }) => ({ objecao, resposta, exemplo })) }

      const res = await fetch(endpoint, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setLastResult(data)
      toast({ title: `${label} processada! ${data.chunks} chunks salvos.` })
    } catch (err: any) {
      toast({ title: err.message || 'Erro ao processar', variant: 'destructive' })
    } finally {
      setProcessing(false)
    }
  }

  async function uploadPdf(file: File) {
    if (!flowId) { toast({ title: 'Salve a configuração primeiro', variant: 'destructive' }); return }
    setProcessing(true)
    setUploadProgress(`Enviando ${file.name}…`)
    try {
      const fd = new FormData(); fd.append('file', file)
      const endpoint = isConhecimento
        ? `/api/sdr/flows/${flowId}/knowledge`
        : `/api/sdr/flows/${flowId}/objections`
      const res = await fetch(endpoint, { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setLastResult(data)
      toast({ title: `PDF processado! ${data.chunks} chunks salvos.` })
    } catch (err: any) {
      toast({ title: err.message || 'Erro ao processar PDF', variant: 'destructive' })
    } finally {
      setProcessing(false)
      setUploadProgress(null)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium">Usar base de {label.toLowerCase()}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {isConhecimento
              ? 'O agente consulta estas informações ao responder perguntas'
              : 'O agente usa estas respostas quando o lead levantar objeções'}
          </p>
        </div>
        <Switch checked={active} onCheckedChange={onActiveChange} />
      </div>

      {active && (
        <>
          <div className="flex gap-1 p-1 bg-muted rounded-lg w-fit">
            {(['form', 'pdf'] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all',
                  mode === m ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {m === 'form' ? <><FileText className="w-3 h-3" />Formulário</> : <><Upload className="w-3 h-3" />Upload PDF</>}
              </button>
            ))}
          </div>

          {mode === 'form' ? (
            <div className="space-y-3">
              {(items as any[]).map((item, idx) => (
                <div key={item.id} className="rounded-lg border border-border bg-muted/20 p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                      {isConhecimento ? `Pergunta ${idx + 1}` : `Objeção ${idx + 1}`}
                    </span>
                    {(items as any[]).length > 1 && (
                      <button onClick={() => removeItem(item.id)} className="text-muted-foreground hover:text-destructive transition-colors">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {isConhecimento ? (
                    <>
                      <Input
                        value={(item as KnowledgeItem).pergunta}
                        onChange={(e) => updateItem(item.id, 'pergunta', e.target.value)}
                        placeholder="Ex: Como funciona o onboarding?"
                        className="h-8 text-sm"
                      />
                      <Textarea
                        value={(item as KnowledgeItem).resposta}
                        onChange={(e) => updateItem(item.id, 'resposta', e.target.value)}
                        placeholder="Resposta completa…"
                        className="min-h-[60px] text-sm resize-none"
                      />
                    </>
                  ) : (
                    <>
                      <Input
                        value={(item as ObjectionItem).objecao}
                        onChange={(e) => updateItem(item.id, 'objecao', e.target.value)}
                        placeholder="Ex: Está muito caro"
                        className="h-8 text-sm"
                      />
                      <Textarea
                        value={(item as ObjectionItem).resposta}
                        onChange={(e) => updateItem(item.id, 'resposta', e.target.value)}
                        placeholder="Como responder esta objeção…"
                        className="min-h-[60px] text-sm resize-none"
                      />
                      <Input
                        value={(item as ObjectionItem).exemplo}
                        onChange={(e) => updateItem(item.id, 'exemplo', e.target.value)}
                        placeholder="Exemplo de uso (opcional)"
                        className="h-8 text-sm"
                      />
                    </>
                  )}
                </div>
              ))}

              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={addItem} className="gap-1.5 text-xs h-8">
                  <Plus className="w-3 h-3" />
                  Adicionar {isConhecimento ? 'pergunta' : 'objeção'}
                </Button>
                <Button
                  size="sm"
                  onClick={processForm}
                  disabled={processing || !flowId}
                  className="gap-1.5 text-xs h-8 min-w-[140px]"
                >
                  {processing ? <><Loader2 className="w-3 h-3 animate-spin" />Processando…</> : 'Salvar na base'}
                </Button>
              </div>
            </div>
          ) : (
            <div>
              <input
                ref={fileRef}
                type="file"
                accept=".pdf"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadPdf(f) }}
              />
              <button
                onClick={() => fileRef.current?.click()}
                disabled={processing || !flowId}
                className={cn(
                  'w-full rounded-xl border-2 border-dashed p-6 flex flex-col items-center gap-2 transition-colors',
                  'hover:border-primary/50 hover:bg-primary/5',
                  processing && 'opacity-50 pointer-events-none'
                )}
              >
                {processing
                  ? <><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /><p className="text-xs text-muted-foreground">{uploadProgress}</p></>
                  : <><Upload className="w-5 h-5 text-muted-foreground" /><p className="text-sm font-medium">Clique para enviar PDF</p><p className="text-xs text-muted-foreground">Máximo 10 MB</p></>
                }
              </button>
            </div>
          )}

          {lastResult && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-green-500/10 border border-green-500/20 text-xs text-green-700 dark:text-green-400">
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
              Base salva — {lastResult.chunks} chunks · tabela <code className="font-mono">{lastResult.table}</code>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ── Calendar Section ───────────────────────────────────────────────────────

function CalendarSection({ calendarId, onCalendarIdChange }: {
  calendarId: string; onCalendarIdChange: (id: string) => void
}) {
  const [googleStatus, setGoogleStatus] = useState<GoogleStatus>({ connected: false, email: null })
  const [calendars, setCalendars] = useState<CalendarItem[]>([])
  const [loadingCals, setLoadingCals] = useState(false)
  const [calError, setCalError] = useState<string | null>(null)
  const [disconnecting, setDisconnecting] = useState(false)

  useEffect(() => {
    fetch('/api/google/status')
      .then((r) => r.json())
      .then((d) => setGoogleStatus({ connected: d.connected, email: d.email }))
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (!googleStatus.connected) return
    setLoadingCals(true)
    setCalError(null)
    fetch('/api/google/calendars')
      .then(async (r) => {
        const d = await r.json()
        if (!r.ok) throw new Error(d.error || `HTTP ${r.status}`)
        setCalendars(d.calendars ?? [])
      })
      .catch((err) => setCalError(err.message))
      .finally(() => setLoadingCals(false))
  }, [googleStatus.connected])

  async function disconnect() {
    setDisconnecting(true)
    try {
      await fetch('/api/google/status', { method: 'DELETE' })
      setGoogleStatus({ connected: false, email: null })
      setCalendars([])
      onCalendarIdChange('')
    } finally {
      setDisconnecting(false)
    }
  }

  if (!googleStatus.connected) {
    return (
      <div className="space-y-3">
        <p className="text-xs text-muted-foreground">
          Conecte uma conta Google com acesso ao Calendar para habilitar o agendamento automático.
        </p>
        <Button
          variant="outline"
          onClick={() => { window.location.href = '/api/google/auth' }}
          className="gap-2"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
          Conectar com Google
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Connected account row */}
      <div className="flex items-center justify-between gap-3 rounded-lg border border-green-500/30 bg-green-500/5 px-3 py-2">
        <div className="flex items-center gap-2 text-xs min-w-0">
          <CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0" />
          <span className="font-mono text-foreground truncate">{googleStatus.email}</span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={disconnect}
          disabled={disconnecting}
          className="text-xs text-muted-foreground gap-1.5 h-7 shrink-0"
        >
          {disconnecting ? <Loader2 className="w-3 h-3 animate-spin" /> : <LogOut className="w-3 h-3" />}
          Desconectar
        </Button>
      </div>

      {/* Calendar picker */}
      <div className="space-y-2">
        <label className="text-xs font-medium text-muted-foreground">Calendário para agendamentos</label>

        {loadingCals ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground py-1">
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Carregando calendários…
          </div>
        ) : calError ? (
          <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
            <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            <span>Erro ao carregar calendários: {calError}</span>
          </div>
        ) : calendars.length === 0 ? (
          <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
            <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            <span>
              Nenhum calendário encontrado.{' '}
              <a href="https://calendar.google.com" target="_blank" rel="noopener noreferrer" className="underline">
                Crie um em calendar.google.com
              </a>{' '}
              e recarregue.
            </span>
          </div>
        ) : (
          <div className="grid gap-2">
            {calendars.map((cal) => (
              <button
                key={cal.id}
                onClick={() => onCalendarIdChange(cal.id ?? '')}
                className={cn(
                  'flex items-center gap-2.5 px-3 py-2.5 rounded-lg border text-sm transition-all text-left',
                  calendarId === cal.id
                    ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                    : 'border-border hover:bg-muted/50'
                )}
              >
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: cal.backgroundColor || '#4285F4' }}
                />
                <span className="flex-1 truncate font-medium">{cal.summary}</span>
                {cal.primary && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground font-medium">
                    Principal
                  </span>
                )}
                {calendarId === cal.id && <CheckCircle2 className="w-3.5 h-3.5 text-primary shrink-0" />}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Main Page ──────────────────────────────────────────────────────────────

export default function SdrConfigPage() {
  const [activeTab, setActiveTab] = useState<TabId>('geral')
  const [config, setConfig] = useState<SdrConfig>({
    agent_type: 'atendimento_venda',
    persona: { ...EMPTY_PERSONA },
    agente_ativo: false,
    webhook_url: null,
    instance_status: 'disconnected',
    instance_phone: null,
    vector_table_conhecimento: '',
    vector_table_objecoes: '',
    conhecimento_ativo: true,
    objecoes_ativo: false,
    google_calendar_id: '',
    flow_id: null,
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [copied, setCopied] = useState(false)

  const loadConfig = useCallback(async () => {
    try {
      const [configRes, statusRes] = await Promise.all([fetch('/api/sdr/config'), fetch('/api/sdr/status')])
      const data = await configRes.json()
      const liveStatus = statusRes.ok ? await statusRes.json() : null
      if (data.config) {
        setConfig({
          id: data.config.id,
          agent_type: data.config.agent_type ?? 'atendimento_venda',
          persona: parsePersona(data.config.prompt ?? ''),
          agente_ativo: data.config.agente_ativo ?? false,
          webhook_url: data.config.webhook_url ?? null,
          instance_status: liveStatus?.status ?? data.config.instance_status ?? 'disconnected',
          instance_phone: liveStatus?.phone ?? data.config.instance_phone ?? null,
          vector_table_conhecimento: data.config.vector_table_conhecimento ?? '',
          vector_table_objecoes: data.config.vector_table_objecoes ?? '',
          conhecimento_ativo: data.config.conhecimento_ativo ?? true,
          objecoes_ativo: data.config.objecoes_ativo ?? false,
          google_calendar_id: data.config.google_calendar_id ?? '',
          flow_id: data.config.flow_id ?? null,
        })
      }
    } catch { toast({ title: 'Erro ao carregar configuração', variant: 'destructive' }) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { loadConfig() }, [loadConfig])

  const setPersona = (field: keyof AgentPersona, value: string) =>
    setConfig((prev) => ({ ...prev, persona: { ...prev.persona, [field]: value } }))

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/sdr/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agent_type: config.agent_type,
          prompt: JSON.stringify(config.persona),
          agente_ativo: config.agente_ativo,
          google_calendar_id: config.google_calendar_id,
          vector_table_conhecimento: config.vector_table_conhecimento,
          vector_table_objecoes: config.vector_table_objecoes,
          conhecimento_ativo: config.conhecimento_ativo,
          objecoes_ativo: config.objecoes_ativo,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      if (data.config?.flow_id && !config.flow_id) {
        setConfig((prev) => ({ ...prev, flow_id: data.config.flow_id }))
      }
      toast({ title: 'Configuração salva!' })
      await loadConfig()
    } catch (err: any) {
      toast({ title: err.message || 'Erro ao salvar', variant: 'destructive' })
    } finally { setSaving(false) }
  }

  const isConnected = config.instance_status === 'connected'
  const isConnecting = config.instance_status === 'connecting'
  const needsAgendamento = config.agent_type === 'atendimento_venda_agendamento'

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto p-4 md:p-6 pb-8">

      {/* ── Header ── */}
      <div className="flex items-center justify-between gap-4 mb-5">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Agente SDR</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Atendimento automático via WhatsApp</p>
        </div>
        <div className="flex items-center gap-2">
          <div className={cn(
            'flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border',
            isConnected ? 'bg-green-500/10 text-green-700 border-green-500/30 dark:text-green-400'
              : isConnecting ? 'bg-yellow-500/10 text-yellow-700 border-yellow-500/30 dark:text-yellow-400'
              : 'bg-muted text-muted-foreground border-border'
          )}>
            {isConnected ? <Wifi className="w-3 h-3" /> : isConnecting ? <Loader2 className="w-3 h-3 animate-spin" /> : <WifiOff className="w-3 h-3" />}
            {isConnected ? config.instance_phone || 'Conectado' : isConnecting ? 'Conectando' : 'Desconectado'}
          </div>
          <Button onClick={handleSave} disabled={saving} size="sm" className="gap-1.5 h-8">
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            {saving ? 'Salvando…' : 'Salvar'}
          </Button>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="flex gap-0.5 p-1 bg-muted rounded-xl mb-5">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={cn(
              'flex-1 flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-xs font-medium transition-all',
              activeTab === id
                ? 'bg-background shadow-sm text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <Icon className="w-3.5 h-3.5 shrink-0" />
            <span className="hidden sm:inline">{label}</span>
          </button>
        ))}
      </div>

      {/* ── Tab: Geral ── */}
      {activeTab === 'geral' && (
        <div className="space-y-4">
          {/* Agente ativo */}
          <div className={cn(
            'flex items-center justify-between gap-4 p-4 rounded-xl border transition-colors',
            config.agente_ativo ? 'bg-primary/5 border-primary/30' : 'bg-muted/30 border-border'
          )}>
            <div className="flex items-center gap-3">
              <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center shrink-0', config.agente_ativo ? 'bg-primary/15' : 'bg-muted')}>
                <Zap className={cn('w-4 h-4', config.agente_ativo ? 'text-primary' : 'text-muted-foreground')} />
              </div>
              <div>
                <p className="text-sm font-medium">Agente ativo</p>
                <p className="text-xs text-muted-foreground">
                  {config.agente_ativo ? 'Respondendo mensagens automaticamente' : 'Ative para responder automaticamente'}
                </p>
              </div>
            </div>
            <Switch checked={config.agente_ativo} onCheckedChange={(v) => setConfig((p) => ({ ...p, agente_ativo: v }))} />
          </div>

          {/* Tipo */}
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">Tipo de agente</p>
            <div className="grid grid-cols-2 gap-2">
              {AGENT_TYPES.map((opt) => {
                const Icon = opt.icon; const selected = config.agent_type === opt.value
                return (
                  <button
                    key={opt.value}
                    onClick={() => setConfig((p) => ({ ...p, agent_type: opt.value as any }))}
                    className={cn(
                      'text-left p-3 rounded-xl border transition-all',
                      selected ? 'border-primary bg-primary/5 ring-1 ring-primary/20' : 'border-border hover:bg-muted/40'
                    )}
                  >
                    <div className={cn('w-7 h-7 rounded-lg flex items-center justify-center mb-2', selected ? 'bg-primary/15' : 'bg-muted')}>
                      <Icon className={cn('w-3.5 h-3.5', selected ? 'text-primary' : 'text-muted-foreground')} />
                    </div>
                    <p className="text-xs font-semibold leading-tight">{opt.label}</p>
                    <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">{opt.desc}</p>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── Tab: Identidade ── */}
      {activeTab === 'identidade' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Nome do agente">
              <Input value={config.persona.nome_agente} onChange={(e) => setPersona('nome_agente', e.target.value)} placeholder="Ex: Ana" className="h-8 text-sm" />
            </Field>
            <Field label="Tom de voz">
              <Input value={config.persona.tom} onChange={(e) => setPersona('tom', e.target.value)} placeholder="Ex: informal e consultivo" className="h-8 text-sm" />
            </Field>
            <Field label="Nome da empresa">
              <Input value={config.persona.empresa} onChange={(e) => setPersona('empresa', e.target.value)} placeholder="Ex: Clínica Silva" className="h-8 text-sm" />
            </Field>
            <Field label="Horário de atendimento">
              <Input value={config.persona.horario} onChange={(e) => setPersona('horario', e.target.value)} placeholder="Ex: Seg-Sex 9h-18h" className="h-8 text-sm" />
            </Field>
          </div>
          <Field label="Produto / serviço oferecido">
            <Textarea value={config.persona.produto} onChange={(e) => setPersona('produto', e.target.value)} placeholder="Ex: procedimentos estéticos de laser e harmonização facial" className="min-h-[72px] text-sm resize-none" />
          </Field>
          <Field label="O que nunca dizer" hint="Restrições e comportamentos que o agente deve evitar">
            <Textarea value={config.persona.restricoes} onChange={(e) => setPersona('restricoes', e.target.value)} placeholder="Ex: não mencione preços sem entender a necessidade, não cite concorrentes" className="min-h-[72px] text-sm resize-none" />
          </Field>
        </div>
      )}

      {/* ── Tab: Conhecimento ── */}
      {activeTab === 'conhecimento' && (
        <div className="space-y-6">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <BookOpen className="w-3.5 h-3.5 text-muted-foreground" />
              <p className="text-sm font-semibold">Base de conhecimento</p>
            </div>
            <KnowledgeBuilder
              flowId={config.flow_id}
              type="conhecimento"
              active={config.conhecimento_ativo}
              onActiveChange={(v) => setConfig((p) => ({ ...p, conhecimento_ativo: v }))}
            />
          </div>

          <div className="border-t border-border/60 pt-5">
            <div className="flex items-center gap-2 mb-3">
              <ShieldAlert className="w-3.5 h-3.5 text-muted-foreground" />
              <p className="text-sm font-semibold">Base de objeções</p>
            </div>
            <KnowledgeBuilder
              flowId={config.flow_id}
              type="objecoes"
              active={config.objecoes_ativo}
              onActiveChange={(v) => setConfig((p) => ({ ...p, objecoes_ativo: v }))}
            />
          </div>
        </div>
      )}

      {/* ── Tab: Integrações ── */}
      {activeTab === 'integracoes' && (
        <div className="space-y-5">
          {/* Google Calendar */}
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
              <p className="text-sm font-semibold">Google Calendar</p>
              {!needsAgendamento && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground font-medium ml-auto">
                  Ative o tipo "Agendamento" na aba Geral
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground mb-3">Calendário usado pelo agente para agendar reuniões automaticamente</p>
            <div className={cn(!needsAgendamento && 'opacity-50 pointer-events-none')}>
              <CalendarSection
                calendarId={config.google_calendar_id}
                onCalendarIdChange={(id) => setConfig((p) => ({ ...p, google_calendar_id: id }))}
              />
            </div>
          </div>

          {/* Webhook URL */}
          {config.webhook_url && (
            <div className="border-t border-border/60 pt-4">
              <div className="flex items-center gap-2 mb-3">
                <Link2 className="w-3.5 h-3.5 text-muted-foreground" />
                <p className="text-sm font-semibold">Webhook URL</p>
              </div>
              <p className="text-xs text-muted-foreground mb-2">Configure esta URL na sua instância UAZapi</p>
              <div className="flex gap-2 items-center p-3 rounded-lg bg-muted/30 border border-border">
                <code className="flex-1 text-xs font-mono text-muted-foreground truncate">{config.webhook_url}</code>
                <button
                  onClick={() => { navigator.clipboard.writeText(config.webhook_url!); setCopied(true); setTimeout(() => setCopied(false), 2000) }}
                  className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {copied ? <CheckCheck className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

    </div>
  )
}
