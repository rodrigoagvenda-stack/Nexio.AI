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
  Zap, Wifi, WifiOff, Bot, Plus,
  Upload, FileText, AlertCircle,
  CheckCircle2, X, BookOpen, ShieldAlert, LogOut,
  Settings, Brain, Link2, Sparkles, ChevronDown,
} from 'lucide-react'
import { NICHES, VAR_LABELS, type NicheTemplate, type SdrVariables, type VariableKey } from '@/lib/sdr/templates'

// ── Types ──────────────────────────────────────────────────────────────────

interface AgentPersona {
  nome_agente: string; tom: string; empresa: string
  produto: string; restricoes: string; horario: string
  // Template variables
  url_empresa: string; preco: string; periodo_teste: string
  link_teste: string; link_playlist: string; link_agendamento: string
  link_catalogo: string; link_pedido: string; endereco: string
  taxa_entrega: string; tempo_entrega: string; nicho_id: string
}
interface SdrConfig {
  id?: string; agent_type: 'atendimento_venda' | 'atendimento_venda_agendamento'
  persona: AgentPersona; agente_ativo: boolean; webhook_url: string | null
  instance_status: 'disconnected' | 'connecting' | 'connected'; instance_phone: string | null
  vector_table_conhecimento: string; vector_table_objecoes: string
  conhecimento_ativo: boolean; objecoes_ativo: boolean
  google_calendar_id: string; flow_id: string | null
  inbox_mode: 'suporte' | 'vendas'
}
interface GoogleStatus { connected: boolean; email: string | null }
interface CalendarItem { id: string; summary: string; primary: boolean; backgroundColor?: string }
interface KnowledgeItem { id: string; pergunta: string; resposta: string }
interface ObjectionItem { id: string; objecao: string; resposta: string; exemplo: string }

// ── Helpers ────────────────────────────────────────────────────────────────

const uid = () => Math.random().toString(36).slice(2)

const EMPTY_PERSONA: AgentPersona = {
  nome_agente: '', tom: '', empresa: '', produto: '', restricoes: '', horario: '',
  url_empresa: '', preco: '', periodo_teste: '', link_teste: '', link_playlist: '',
  link_agendamento: '', link_catalogo: '', link_pedido: '', endereco: '',
  taxa_entrega: '', tempo_entrega: '', nicho_id: '',
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

function Field({ label, hint, children, optional }: { label: string; hint?: string; children: React.ReactNode; optional?: boolean }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5">
        <label className="text-xs font-medium text-muted-foreground">{label}</label>
        {optional && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground/70">opcional</span>}
      </div>
      {children}
      {hint && <p className="text-[11px] text-muted-foreground/70">{hint}</p>}
    </div>
  )
}

// ── Knowledge Builder ──────────────────────────────────────────────────────

type KBMode = 'template' | 'form' | 'pdf'

interface ExistingBase { filename: string; chunks: number }
interface PendingAction { newName: string; execute: () => void }

function friendlyFilename(filename: string): string {
  return filename.replace(/\.[^.]+$/, '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

function KnowledgeBuilder({ flowId, type, active, onActiveChange, persona }: {
  flowId: string | null; type: 'conhecimento' | 'objecoes'
  active: boolean; onActiveChange: (v: boolean) => void
  persona: AgentPersona
}) {
  const [mode, setMode] = useState<KBMode>('template')
  const [selectedNicheId, setSelectedNicheId] = useState<string>(persona.nicho_id || '')
  const [processing, setProcessing] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<string | null>(null)
  const [lastResult, setLastResult] = useState<{ chunks: number; table: string } | null>(null)
  const [nicheDropdownOpen, setNicheDropdownOpen] = useState(false)
  const [items, setItems] = useState<KnowledgeItem[] | ObjectionItem[]>(
    type === 'conhecimento'
      ? [{ id: uid(), pergunta: '', resposta: '' }] as KnowledgeItem[]
      : [{ id: uid(), objecao: '', resposta: '', exemplo: '' }] as ObjectionItem[]
  )
  const fileRef = useRef<HTMLInputElement>(null)
  const [existingBase, setExistingBase] = useState<ExistingBase | null>(null)
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null)

  const isConhecimento = type === 'conhecimento'
  const label = isConhecimento ? 'conhecimento' : 'objeções'

  useEffect(() => {
    if (!flowId || !active) return
    const url = isConhecimento
      ? `/api/sdr/flows/${flowId}/knowledge`
      : `/api/sdr/flows/${flowId}/objections`
    fetch(url)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d?.exists) setExistingBase({ filename: d.filename, chunks: d.chunks }) })
      .catch(() => {})
  }, [flowId, active, isConhecimento])

  function withConfirm(execute: () => void, newName: string) {
    if (!existingBase) { execute(); return }
    setPendingAction({ newName, execute })
  }

  const selectedNiche = NICHES.find((n) => n.id === selectedNicheId)

  // Build variables from persona
  const buildVariables = (): SdrVariables => ({
    nome_agente: persona.nome_agente,
    nome_empresa: persona.empresa,
    descricao_produto: persona.produto,
    tom_agente: persona.tom,
    horario: persona.horario,
    url_empresa: persona.url_empresa,
    preco: persona.preco,
    periodo_teste: persona.periodo_teste,
    link_teste: persona.link_teste,
    link_playlist: persona.link_playlist,
    link_agendamento: persona.link_agendamento,
    link_catalogo: persona.link_catalogo,
    link_pedido: persona.link_pedido,
    endereco: persona.endereco,
    taxa_entrega: persona.taxa_entrega,
    tempo_entrega: persona.tempo_entrega,
  })

  function getMissingRequired(niche: NicheTemplate): VariableKey[] {
    const vars = buildVariables()
    return niche.requiredVars.filter((k) => !vars[k]?.trim())
  }

  function getMissingOptional(niche: NicheTemplate): VariableKey[] {
    const vars = buildVariables()
    return niche.optionalVars.filter((k) => !vars[k]?.trim())
  }

  async function processTemplate() {
    if (!flowId) { toast({ title: 'Salve a configuração primeiro', variant: 'destructive' }); return }
    if (!selectedNicheId) { toast({ title: 'Selecione um nicho', variant: 'destructive' }); return }
    setProcessing(true)
    try {
      const endpoint = isConhecimento
        ? `/api/sdr/flows/${flowId}/knowledge/from-template`
        : `/api/sdr/flows/${flowId}/objections/from-template`
      const res = await fetch(endpoint, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nicheId: selectedNicheId, variables: buildVariables() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setLastResult(data)
      toast({ title: `Template processado! ${data.chunks} chunks salvos.` })
    } catch (err: any) {
      toast({ title: err.message || 'Erro ao processar template', variant: 'destructive' })
    } finally { setProcessing(false) }
  }

  function addItem() {
    if (isConhecimento) {
      setItems((prev) => [...prev, { id: uid(), pergunta: '', resposta: '' }] as KnowledgeItem[])
    } else {
      setItems((prev) => [...prev, { id: uid(), objecao: '', resposta: '', exemplo: '' }] as ObjectionItem[])
    }
  }
  function removeItem(id: string) { setItems((prev) => (prev as any[]).filter((i) => i.id !== id)) }
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
      toast({ title: `Processado! ${data.chunks} chunks salvos.` })
    } catch (err: any) {
      toast({ title: err.message || 'Erro ao processar', variant: 'destructive' })
    } finally { setProcessing(false) }
  }

  async function uploadPdf(file: File) {
    if (!flowId) { toast({ title: 'Salve a configuração primeiro', variant: 'destructive' }); return }
    setProcessing(true); setUploadProgress(`Enviando ${file.name}…`)
    try {
      const fd = new FormData(); fd.append('file', file)
      const endpoint = isConhecimento ? `/api/sdr/flows/${flowId}/knowledge` : `/api/sdr/flows/${flowId}/objections`
      const res = await fetch(endpoint, { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setLastResult(data)
      toast({ title: `PDF processado! ${data.chunks} chunks salvos.` })
    } catch (err: any) {
      toast({ title: err.message || 'Erro ao processar PDF', variant: 'destructive' })
    } finally { setProcessing(false); setUploadProgress(null) }
  }

  const MODES: { id: KBMode; label: string; icon: React.ElementType }[] = [
    { id: 'template', label: 'Nosso padrão', icon: Sparkles },
    { id: 'form', label: 'Formulário', icon: FileText },
    { id: 'pdf', label: 'Upload PDF', icon: Upload },
  ]

  const vendas = NICHES.filter((n) => n.category === 'vendas')
  const atendimento = NICHES.filter((n) => n.category === 'atendimento')

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium">Usar base de {label}</p>
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
          {/* Mode tabs */}
          <div className="flex gap-0.5 p-1 bg-muted rounded-lg">
            {MODES.map(({ id, label: ml, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setMode(id)}
                className={cn(
                  'flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-md text-xs font-medium transition-all',
                  mode === id ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <Icon className="w-3 h-3 shrink-0" />{ml}
              </button>
            ))}
          </div>

          {/* ── Template mode ── */}
          {mode === 'template' && (
            <div className="space-y-4">
              {/* Niche selector */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Nicho de atuação</label>
                <div className="relative">
                  <button
                    onClick={() => setNicheDropdownOpen((o) => !o)}
                    className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-input bg-background text-sm hover:bg-accent transition-colors"
                  >
                    <span className={selectedNiche ? 'text-foreground' : 'text-muted-foreground'}>
                      {selectedNiche ? `${selectedNiche.emoji} ${selectedNiche.label}` : 'Selecione o nicho…'}
                    </span>
                    <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
                  </button>
                  {nicheDropdownOpen && (
                    <div className="absolute top-full left-0 right-0 mt-1 z-20 rounded-lg border border-border bg-background shadow-lg overflow-hidden max-h-72 overflow-y-auto">
                      {[{ label: '🎯 Vendas', items: vendas }, { label: '🛎️ Atendimento', items: atendimento }].map((group) => (
                        <div key={group.label}>
                          <p className="px-3 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide bg-muted/40">{group.label}</p>
                          {group.items.map((n) => (
                            <button
                              key={n.id}
                              onClick={() => { setSelectedNicheId(n.id); setNicheDropdownOpen(false) }}
                              className={cn(
                                'w-full flex items-start gap-3 px-3 py-2.5 hover:bg-accent transition-colors text-left',
                                selectedNicheId === n.id && 'bg-primary/5'
                              )}
                            >
                              <span className="text-base shrink-0 mt-0.5">{n.emoji}</span>
                              <div className="min-w-0">
                                <p className="text-sm font-medium">{n.label}</p>
                                <p className="text-xs text-muted-foreground">{n.description}</p>
                              </div>
                              {selectedNicheId === n.id && <CheckCircle2 className="w-3.5 h-3.5 text-primary shrink-0 mt-1 ml-auto" />}
                            </button>
                          ))}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Variable status */}
              {selectedNiche && (() => {
                const missing = getMissingRequired(selectedNiche)
                const missingOpt = getMissingOptional(selectedNiche)
                return (
                  <div className="space-y-2">
                    {missing.length > 0 ? (
                      <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-xs text-destructive">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                        <div>
                          <p className="font-semibold">Campos obrigatórios faltando:</p>
                          <p className="mt-0.5">{missing.map((k) => VAR_LABELS[k]).join(', ')} — preencha na aba Identidade.</p>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-green-500/20 bg-green-500/5 text-xs text-green-700 dark:text-green-400">
                        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                        Todos os campos obrigatórios preenchidos.
                      </div>
                    )}
                    {missingOpt.length > 0 && (
                      <div className="flex items-start gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                        <span>Opcionais não preenchidos (o template usará [placeholder]): {missingOpt.map((k) => VAR_LABELS[k]).join(', ')}</span>
                      </div>
                    )}
                  </div>
                )
              })()}

              <Button
                size="sm"
                onClick={() => withConfirm(processTemplate, selectedNiche ? `${selectedNiche.emoji} ${selectedNiche.label}` : 'template')}
                disabled={processing || !flowId || !selectedNicheId}
                className="gap-1.5 text-xs h-8 w-full"
              >
                {processing
                  ? <><Loader2 className="w-3 h-3 animate-spin" />Processando…</>
                  : <><Sparkles className="w-3 h-3" />Gerar e processar template</>}
              </Button>
            </div>
          )}

          {/* ── Form mode ── */}
          {mode === 'form' && (
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
                      <Input value={(item as KnowledgeItem).pergunta} onChange={(e) => updateItem(item.id, 'pergunta', e.target.value)} placeholder="Ex: Como funciona o onboarding?" className="h-8 text-sm" />
                      <Textarea value={(item as KnowledgeItem).resposta} onChange={(e) => updateItem(item.id, 'resposta', e.target.value)} placeholder="Resposta completa…" className="min-h-[60px] text-sm resize-none" />
                    </>
                  ) : (
                    <>
                      <Input value={(item as ObjectionItem).objecao} onChange={(e) => updateItem(item.id, 'objecao', e.target.value)} placeholder="Ex: Está muito caro" className="h-8 text-sm" />
                      <Textarea value={(item as ObjectionItem).resposta} onChange={(e) => updateItem(item.id, 'resposta', e.target.value)} placeholder="Como responder…" className="min-h-[60px] text-sm resize-none" />
                      <Input value={(item as ObjectionItem).exemplo} onChange={(e) => updateItem(item.id, 'exemplo', e.target.value)} placeholder="Exemplo de uso (opcional)" className="h-8 text-sm" />
                    </>
                  )}
                </div>
              ))}
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={addItem} className="gap-1.5 text-xs h-8">
                  <Plus className="w-3 h-3" />Adicionar {isConhecimento ? 'pergunta' : 'objeção'}
                </Button>
                <Button size="sm" onClick={() => withConfirm(processForm, `Base manual de ${label}`)} disabled={processing || !flowId} className="gap-1.5 text-xs h-8 min-w-[120px]">
                  {processing ? <><Loader2 className="w-3 h-3 animate-spin" />Processando…</> : 'Salvar na base'}
                </Button>
              </div>
            </div>
          )}

          {/* ── PDF mode ── */}
          {mode === 'pdf' && (
            <div>
              <input ref={fileRef} type="file" accept=".pdf" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) withConfirm(() => uploadPdf(f), f.name) }} />
              <button
                onClick={() => fileRef.current?.click()}
                disabled={processing || !flowId}
                className={cn('w-full rounded-xl border-2 border-dashed p-6 flex flex-col items-center gap-2 transition-colors hover:border-primary/50 hover:bg-primary/5', processing && 'opacity-50 pointer-events-none')}
              >
                {processing
                  ? <><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /><p className="text-xs text-muted-foreground">{uploadProgress}</p></>
                  : <><Upload className="w-5 h-5 text-muted-foreground" /><p className="text-sm font-medium">Clique para enviar PDF</p><p className="text-xs text-muted-foreground">Máximo 10 MB</p></>}
              </button>
            </div>
          )}

          {pendingAction && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/8 p-3.5 space-y-3">
              <div className="flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <div className="space-y-1 text-sm">
                  <p className="font-semibold text-foreground">Substituir base de {label}?</p>
                  <p className="text-muted-foreground text-xs leading-relaxed">
                    Você possui <span className="font-medium text-foreground">"{friendlyFilename(existingBase!.filename)}"</span> cadastrada ({existingBase!.chunks} chunks).
                    Ao prosseguir, ela será <span className="text-destructive font-medium">permanentemente deletada</span> e substituída por{' '}
                    <span className="font-medium text-foreground">"{friendlyFilename(pendingAction.newName)}"</span>.
                  </p>
                </div>
              </div>
              <div className="flex gap-2 pl-6">
                <Button
                  size="sm"
                  variant="destructive"
                  className="h-7 text-xs gap-1.5"
                  onClick={() => {
                    const action = pendingAction.execute
                    setPendingAction(null)
                    setExistingBase(null)
                    action()
                  }}
                >
                  <ShieldAlert className="w-3 h-3" />Substituir
                </Button>
                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setPendingAction(null)}>
                  Cancelar
                </Button>
              </div>
            </div>
          )}

          {lastResult && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-green-500/10 border border-green-500/20 text-xs text-green-700 dark:text-green-400">
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
              Base salva — {lastResult.chunks} chunks · <code className="font-mono">{lastResult.table}</code>
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
    fetch('/api/google/status').then((r) => r.json()).then((d) => setGoogleStatus({ connected: d.connected, email: d.email })).catch(() => {})
  }, [])

  useEffect(() => {
    if (!googleStatus.connected) return
    setLoadingCals(true); setCalError(null)
    fetch('/api/google/calendars')
      .then(async (r) => { const d = await r.json(); if (!r.ok) throw new Error(d.error || `HTTP ${r.status}`); setCalendars(d.calendars ?? []) })
      .catch((err) => setCalError(err.message))
      .finally(() => setLoadingCals(false))
  }, [googleStatus.connected])

  async function disconnect() {
    setDisconnecting(true)
    try {
      await fetch('/api/google/status', { method: 'DELETE' })
      setGoogleStatus({ connected: false, email: null }); setCalendars([]); onCalendarIdChange('')
    } finally { setDisconnecting(false) }
  }

  if (!googleStatus.connected) {
    return (
      <div className="space-y-3">
        <p className="text-xs text-muted-foreground">Conecte uma conta Google com acesso ao Calendar para habilitar o agendamento automático.</p>
        <Button variant="outline" onClick={() => { window.location.href = '/api/google/auth' }} className="gap-2">
          <svg className="w-4 h-4" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
          Conectar com Google
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 rounded-lg border border-green-500/30 bg-green-500/5 px-3 py-2">
        <div className="flex items-center gap-2 text-xs min-w-0">
          <CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0" />
          <span className="font-mono text-foreground truncate">{googleStatus.email}</span>
        </div>
        <Button variant="ghost" size="sm" onClick={disconnect} disabled={disconnecting} className="text-xs text-muted-foreground gap-1.5 h-7 shrink-0">
          {disconnecting ? <Loader2 className="w-3 h-3 animate-spin" /> : <LogOut className="w-3 h-3" />}Desconectar
        </Button>
      </div>
      <div className="space-y-2">
        <label className="text-xs font-medium text-muted-foreground">Calendário para agendamentos</label>
        {loadingCals ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground py-1"><Loader2 className="w-3.5 h-3.5 animate-spin" />Carregando calendários…</div>
        ) : calError ? (
          <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
            <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" /><span>Erro ao carregar calendários: {calError}</span>
          </div>
        ) : calendars.length === 0 ? (
          <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
            <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            <span>Nenhum calendário encontrado. <a href="https://calendar.google.com" target="_blank" rel="noopener noreferrer" className="underline">Crie um em calendar.google.com</a> e recarregue.</span>
          </div>
        ) : (
          <div className="grid gap-2">
            {calendars.map((cal) => (
              <button key={cal.id} onClick={() => onCalendarIdChange(cal.id ?? '')}
                className={cn('flex items-center gap-2.5 px-3 py-2.5 rounded-lg border text-sm transition-all text-left', calendarId === cal.id ? 'border-primary bg-primary/5 ring-1 ring-primary/20' : 'border-border hover:bg-muted/50')}>
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: cal.backgroundColor || '#4285F4' }} />
                <span className="flex-1 truncate font-medium">{cal.summary}</span>
                {cal.primary && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground font-medium">Principal</span>}
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
    agente_ativo: false, webhook_url: null,
    instance_status: 'disconnected', instance_phone: null,
    vector_table_conhecimento: '', vector_table_objecoes: '',
    conhecimento_ativo: true, objecoes_ativo: false,
    google_calendar_id: '', flow_id: null, inbox_mode: 'suporte',
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
          inbox_mode: data.config.inbox_mode ?? 'suporte',
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
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agent_type: config.agent_type,
          prompt: JSON.stringify(config.persona),
          agente_ativo: config.agente_ativo,
          google_calendar_id: config.google_calendar_id,
          vector_table_conhecimento: config.vector_table_conhecimento,
          vector_table_objecoes: config.vector_table_objecoes,
          conhecimento_ativo: config.conhecimento_ativo,
          objecoes_ativo: config.objecoes_ativo,
          inbox_mode: config.inbox_mode,
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

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>

  return (
    <div className="max-w-2xl mx-auto p-4 md:p-6 pb-8">

      {/* Header */}
      <div className="flex items-center justify-between gap-4 mb-5">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Agente SDR</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Atendimento automático via WhatsApp</p>
        </div>
        <div className="flex items-center gap-2">
          <div className={cn('flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border',
            isConnected ? 'bg-green-500/10 text-green-700 border-green-500/30 dark:text-green-400'
              : isConnecting ? 'bg-yellow-500/10 text-yellow-700 border-yellow-500/30 dark:text-yellow-400'
              : 'bg-muted text-muted-foreground border-border')}>
            {isConnected ? <Wifi className="w-3 h-3" /> : isConnecting ? <Loader2 className="w-3 h-3 animate-spin" /> : <WifiOff className="w-3 h-3" />}
            {isConnected ? config.instance_phone || 'Conectado' : isConnecting ? 'Conectando' : 'Desconectado'}
          </div>
          <Button onClick={handleSave} disabled={saving} size="sm" className="gap-1.5 h-8">
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            {saving ? 'Salvando…' : 'Salvar'}
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-0.5 p-1 bg-muted rounded-xl mb-5">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setActiveTab(id)}
            className={cn('flex-1 flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-xs font-medium transition-all',
              activeTab === id ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground')}>
            <Icon className="w-3.5 h-3.5 shrink-0" />
            <span className="hidden sm:inline">{label}</span>
          </button>
        ))}
      </div>

      {/* ── Geral ── */}
      {activeTab === 'geral' && (
        <div className="space-y-4">
          <div className={cn('flex items-center justify-between gap-4 p-4 rounded-xl border transition-colors',
            config.agente_ativo ? 'bg-primary/5 border-primary/30' : 'bg-muted/30 border-border')}>
            <div className="flex items-center gap-3">
              <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center shrink-0', config.agente_ativo ? 'bg-primary/15' : 'bg-muted')}>
                <Zap className={cn('w-4 h-4', config.agente_ativo ? 'text-primary' : 'text-muted-foreground')} />
              </div>
              <div>
                <p className="text-sm font-medium">Agente ativo</p>
                <p className="text-xs text-muted-foreground">{config.agente_ativo ? 'Respondendo automaticamente' : 'Ative para responder automaticamente'}</p>
              </div>
            </div>
            <Switch checked={config.agente_ativo} onCheckedChange={(v) => setConfig((p) => ({ ...p, agente_ativo: v }))} />
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">Tipo de agente</p>
            <div className="grid grid-cols-2 gap-2">
              {AGENT_TYPES.map((opt) => {
                const Icon = opt.icon; const selected = config.agent_type === opt.value
                return (
                  <button key={opt.value} onClick={() => setConfig((p) => ({ ...p, agent_type: opt.value as any }))}
                    className={cn('text-left p-3 rounded-xl border transition-all', selected ? 'border-primary bg-primary/5 ring-1 ring-primary/20' : 'border-border hover:bg-muted/40')}>
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
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">Modo de atendimento</p>
            <div className="grid grid-cols-2 gap-2">
              {([
                { value: 'suporte', label: 'Suporte', desc: 'Inbox compartilhado — qualquer atendente pode pegar' },
                { value: 'vendas', label: 'Vendas', desc: 'Distribui automaticamente entre os atendentes (round-robin)' },
              ] as const).map((opt) => {
                const selected = config.inbox_mode === opt.value
                return (
                  <button key={opt.value} onClick={() => setConfig((p) => ({ ...p, inbox_mode: opt.value }))}
                    className={cn('text-left p-3 rounded-xl border transition-all', selected ? 'border-primary bg-primary/5 ring-1 ring-primary/20' : 'border-border hover:bg-muted/40')}>
                    <p className="text-xs font-semibold leading-tight">{opt.label}</p>
                    <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">{opt.desc}</p>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── Identidade ── */}
      {activeTab === 'identidade' && (
        <div className="space-y-5">
          {/* Persona */}
          <div className="space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Persona do agente</p>
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
              <Textarea value={config.persona.produto} onChange={(e) => setPersona('produto', e.target.value)} placeholder="Ex: procedimentos estéticos de laser e harmonização facial" className="min-h-[60px] text-sm resize-none" />
            </Field>
            <Field label="O que nunca dizer" hint="Restrições e comportamentos que o agente deve evitar">
              <Textarea value={config.persona.restricoes} onChange={(e) => setPersona('restricoes', e.target.value)} placeholder="Ex: não mencione preços sem entender a necessidade" className="min-h-[60px] text-sm resize-none" />
            </Field>
          </div>

          {/* Links e valores */}
          <div className="border-t border-border/60 pt-4 space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Informações do negócio</p>
            <p className="text-xs text-muted-foreground">Usadas automaticamente pelo template do nicho escolhido.</p>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Site / URL da empresa" optional>
                <Input value={config.persona.url_empresa} onChange={(e) => setPersona('url_empresa', e.target.value)} placeholder="https://suaempresa.com.br" className="h-8 text-sm" />
              </Field>
              <Field label="Endereço" optional>
                <Input value={config.persona.endereco} onChange={(e) => setPersona('endereco', e.target.value)} placeholder="Rua X, 123 — Bairro, Cidade" className="h-8 text-sm" />
              </Field>
              <Field label="Preço" optional>
                <Input value={config.persona.preco} onChange={(e) => setPersona('preco', e.target.value)} placeholder="Ex: R$ 49,90/mês" className="h-8 text-sm" />
              </Field>
              <Field label="Período de teste" optional>
                <Input value={config.persona.periodo_teste} onChange={(e) => setPersona('periodo_teste', e.target.value)} placeholder="Ex: 7 dias" className="h-8 text-sm" />
              </Field>
              <Field label="Taxa de entrega" optional>
                <Input value={config.persona.taxa_entrega} onChange={(e) => setPersona('taxa_entrega', e.target.value)} placeholder="Ex: R$ 5,00 ou Grátis" className="h-8 text-sm" />
              </Field>
              <Field label="Tempo de entrega" optional>
                <Input value={config.persona.tempo_entrega} onChange={(e) => setPersona('tempo_entrega', e.target.value)} placeholder="Ex: 40–60 min" className="h-8 text-sm" />
              </Field>
            </div>
            <div className="grid grid-cols-1 gap-3">
              <Field label="Link de teste grátis / aula experimental" optional>
                <Input value={config.persona.link_teste} onChange={(e) => setPersona('link_teste', e.target.value)} placeholder="https://" className="h-8 text-sm" />
              </Field>
              <Field label="Link de playlist / tutoriais" optional>
                <Input value={config.persona.link_playlist} onChange={(e) => setPersona('link_playlist', e.target.value)} placeholder="https://" className="h-8 text-sm" />
              </Field>
              <Field label="Link de agendamento" optional>
                <Input value={config.persona.link_agendamento} onChange={(e) => setPersona('link_agendamento', e.target.value)} placeholder="https://" className="h-8 text-sm" />
              </Field>
              <Field label="Link do catálogo / cardápio" optional>
                <Input value={config.persona.link_catalogo} onChange={(e) => setPersona('link_catalogo', e.target.value)} placeholder="https://" className="h-8 text-sm" />
              </Field>
              <Field label="Link de pedido / compra" optional>
                <Input value={config.persona.link_pedido} onChange={(e) => setPersona('link_pedido', e.target.value)} placeholder="https://" className="h-8 text-sm" />
              </Field>
            </div>
          </div>
        </div>
      )}

      {/* ── Conhecimento ── */}
      {activeTab === 'conhecimento' && (
        <div className="space-y-6">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <BookOpen className="w-3.5 h-3.5 text-muted-foreground" />
              <p className="text-sm font-semibold">Base de conhecimento</p>
            </div>
            <KnowledgeBuilder flowId={config.flow_id} type="conhecimento" active={config.conhecimento_ativo} onActiveChange={(v) => setConfig((p) => ({ ...p, conhecimento_ativo: v }))} persona={config.persona} />
          </div>
          <div className="border-t border-border/60 pt-5">
            <div className="flex items-center gap-2 mb-3">
              <ShieldAlert className="w-3.5 h-3.5 text-muted-foreground" />
              <p className="text-sm font-semibold">Base de objeções</p>
            </div>
            <KnowledgeBuilder flowId={config.flow_id} type="objecoes" active={config.objecoes_ativo} onActiveChange={(v) => setConfig((p) => ({ ...p, objecoes_ativo: v }))} persona={config.persona} />
          </div>
        </div>
      )}

      {/* ── Integrações ── */}
      {activeTab === 'integracoes' && (
        <div className="space-y-5">
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
              <CalendarSection calendarId={config.google_calendar_id} onCalendarIdChange={(id) => setConfig((p) => ({ ...p, google_calendar_id: id }))} />
            </div>
          </div>
          {config.webhook_url && (
            <div className="border-t border-border/60 pt-4">
              <div className="flex items-center gap-2 mb-3">
                <Link2 className="w-3.5 h-3.5 text-muted-foreground" />
                <p className="text-sm font-semibold">Webhook URL</p>
              </div>
              <p className="text-xs text-muted-foreground mb-2">Configure esta URL na sua instância UAZapi</p>
              <div className="flex gap-2 items-center p-3 rounded-lg bg-muted/30 border border-border">
                <code className="flex-1 text-xs font-mono text-muted-foreground truncate">{config.webhook_url}</code>
                <button onClick={() => { navigator.clipboard.writeText(config.webhook_url!); setCopied(true); setTimeout(() => setCopied(false), 2000) }} className="shrink-0 text-muted-foreground hover:text-foreground transition-colors">
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
