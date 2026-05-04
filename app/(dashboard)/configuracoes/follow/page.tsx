'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { toast } from '@/components/ui/use-toast'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils/cn'
import {
  Plus,
  Trash2,
  Loader2,
  Clock,
  CalendarClock,
  Sparkles,
  Pencil,
  Megaphone,
  FileText,
  BarChart2,
  CheckCircle2,
  XCircle,
  Bot,
  MessageSquare,
  ArrowRight,
  RefreshCw,
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

type SequenceTipo = 'follow_geral' | 'anti_noshow' | 'remarketing' | 'follow_proposta'

interface FollowStep {
  id?: string
  dia_offset: number
  horario: string
  mensagem: string
  pool_mensagens: string[]
  usar_ia: boolean
  usar_contexto_sdr: boolean
  ordem: number
}

interface FollowSequence {
  id: string
  nome: string
  tipo: SequenceTipo
  ativo: boolean
  follow_steps: FollowStep[]
}

interface Stats {
  total_enviados: number
  total_falhas: number
  sequencias_ativas: number
  por_tipo: { tipo: string; label: string; enviados: number; falhas: number; pulados: number }[]
  ultimos: {
    id: number
    tipo: string
    lead_name: string
    lead_status: string
    mensagem: string
    enviado_em: string
    respondeu: boolean
  }[]
}

// ─── Config de tipos ──────────────────────────────────────────────────────────

const TIPO_CONFIG: Record<SequenceTipo, {
  label: string
  desc: string
  color: string
  icon: React.FC<{ className?: string }>
  offsetLabel: string
  tab: 'follow' | 'remarketing'
}> = {
  follow_geral: {
    label: 'Follow Geral',
    desc: 'Dispara após X dias sem resposta',
    color: 'bg-blue-500/10 text-blue-600 border-blue-500/20 dark:text-blue-400',
    icon: Clock,
    offsetLabel: 'Dias sem resposta',
    tab: 'follow',
  },
  anti_noshow: {
    label: 'Anti-Noshow',
    desc: 'Lembretes baseados na call agendada',
    color: 'bg-orange-500/10 text-orange-600 border-orange-500/20 dark:text-orange-400',
    icon: CalendarClock,
    offsetLabel: 'Horas da call (negativo = antes)',
    tab: 'follow',
  },
  follow_proposta: {
    label: 'Follow Proposta',
    desc: 'Após call realizada, sem fechamento',
    color: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:text-emerald-400',
    icon: FileText,
    offsetLabel: 'Dias sem resposta (pós-call)',
    tab: 'follow',
  },
  remarketing: {
    label: 'Remarketing',
    desc: 'Re-engajamento de leads perdidos',
    color: 'bg-purple-500/10 text-purple-600 border-purple-500/20 dark:text-purple-400',
    icon: Megaphone,
    offsetLabel: 'Dias desde último contato',
    tab: 'remarketing',
  },
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const EMPTY_STEP = (): FollowStep => ({
  dia_offset: 1,
  horario: '09:00',
  mensagem: '',
  pool_mensagens: [],
  usar_ia: false,
  usar_contexto_sdr: false,
  ordem: 0,
})

const DEFAULT_FORM = (tipo: SequenceTipo = 'follow_geral') => ({
  nome: '',
  tipo,
  ativo: true,
  steps: [EMPTY_STEP()],
})

function formatOffset(tipo: SequenceTipo, offset: number) {
  if (tipo === 'anti_noshow') return `${offset > 0 ? '+' : ''}${offset}h`
  return `D+${offset}`
}

// ─── Componentes auxiliares ───────────────────────────────────────────────────

function TipoBadge({ tipo }: { tipo: SequenceTipo }) {
  const cfg = TIPO_CONFIG[tipo]
  const Icon = cfg.icon
  return (
    <span className={cn('text-xs px-2 py-0.5 rounded-full border flex items-center gap-1 w-fit', cfg.color)}>
      <Icon className="w-3 h-3" />
      {cfg.label}
    </span>
  )
}

// ─── Sequência card ───────────────────────────────────────────────────────────

function SequenceCard({
  seq,
  onToggle,
  onEdit,
  onDelete,
  deleting,
}: {
  seq: FollowSequence
  onToggle: () => void
  onEdit: () => void
  onDelete: () => void
  deleting: boolean
}) {
  const cfg = TIPO_CONFIG[seq.tipo]
  return (
    <Card className={cn('transition-opacity', !seq.ativo && 'opacity-60')}>
      <CardContent className="pt-5 pb-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0 space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold text-sm">{seq.nome}</h3>
              <TipoBadge tipo={seq.tipo} />
              {!seq.ativo && <Badge variant="secondary" className="text-xs">Inativa</Badge>}
            </div>
            <p className="text-xs text-muted-foreground">{cfg.desc}</p>

            {seq.follow_steps.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {seq.follow_steps.map((step, i) => (
                  <div
                    key={step.id ?? i}
                    className="flex items-center gap-1.5 text-xs bg-muted/50 border border-border rounded-lg px-2 py-1"
                  >
                    <span className="font-medium text-muted-foreground">
                      {formatOffset(seq.tipo, step.dia_offset)}
                    </span>
                    <span className="text-muted-foreground/60">·</span>
                    <span>{step.horario.slice(0, 5)}</span>
                    {step.usar_ia && <Sparkles className="w-3 h-3 text-primary" />}
                    {step.pool_mensagens?.length > 0 && (
                      <span className="text-muted-foreground/60 text-[10px]">{step.pool_mensagens.length}msg</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <Switch checked={seq.ativo} onCheckedChange={onToggle} />
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onEdit}>
              <Pencil className="w-3.5 h-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-destructive hover:text-destructive"
              onClick={onDelete}
              disabled={deleting}
            >
              {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ─── Painel de edição de passo ────────────────────────────────────────────────

function StepEditor({
  step,
  index,
  tipo,
  total,
  onChange,
  onRemove,
}: {
  step: FollowStep
  index: number
  tipo: SequenceTipo
  total: number
  onChange: (patch: Partial<FollowStep>) => void
  onRemove: () => void
}) {
  const cfg = TIPO_CONFIG[tipo]

  function addPoolMessage() {
    onChange({ pool_mensagens: [...(step.pool_mensagens ?? []), ''] })
  }

  function updatePoolMessage(i: number, value: string) {
    const pool = [...(step.pool_mensagens ?? [])]
    pool[i] = value
    onChange({ pool_mensagens: pool })
  }

  function removePoolMessage(i: number) {
    onChange({ pool_mensagens: (step.pool_mensagens ?? []).filter((_, idx) => idx !== i) })
  }

  return (
    <div className="border border-border rounded-xl p-4 space-y-3 bg-muted/10">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-muted-foreground">Passo {index + 1}</span>
        {total > 1 && (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-destructive hover:text-destructive"
            onClick={onRemove}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs">{cfg.offsetLabel}</Label>
          <Input
            type="number"
            value={step.dia_offset}
            onChange={(e) => onChange({ dia_offset: parseInt(e.target.value) || 0 })}
            className="h-8 text-sm"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Horário de disparo</Label>
          <Input
            type="time"
            value={step.horario}
            onChange={(e) => onChange({ horario: e.target.value })}
            className="h-8 text-sm"
          />
        </div>
      </div>

      {/* Toggle IA */}
      <div className="flex items-center gap-2">
        <Switch checked={step.usar_ia} onCheckedChange={(v) => onChange({ usar_ia: v })} />
        <span className="text-sm flex items-center gap-1">
          <Sparkles className="w-3.5 h-3.5 text-primary" />
          Gerar mensagem com IA
        </span>
      </div>

      {/* Contexto SDR — só quando usar_ia = true */}
      {step.usar_ia && (
        <div className="flex items-center gap-2 pl-1">
          <Switch
            checked={step.usar_contexto_sdr}
            onCheckedChange={(v) => onChange({ usar_contexto_sdr: v })}
          />
          <span className="text-sm flex items-center gap-1 text-muted-foreground">
            <Bot className="w-3.5 h-3.5" />
            Usar contexto do agente SDR
          </span>
        </div>
      )}

      {/* Mensagem(s) — quando usar_ia = false */}
      {!step.usar_ia && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs">
              {(step.pool_mensagens?.length ?? 0) > 0
                ? `Pool de mensagens (${step.pool_mensagens.length} — escolha aleatória)`
                : 'Mensagem'}
            </Label>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-6 text-xs px-2 text-muted-foreground hover:text-foreground"
              onClick={addPoolMessage}
            >
              <Plus className="w-3 h-3 mr-1" />
              Adicionar variação
            </Button>
          </div>

          {/* Mensagem fixa (se sem pool) */}
          {(step.pool_mensagens?.length ?? 0) === 0 && (
            <Textarea
              value={step.mensagem}
              onChange={(e) => onChange({ mensagem: e.target.value })}
              placeholder="Oi, {nome}! Gostaria de retomar nossa conversa…"
              className="min-h-[72px] text-sm resize-none"
            />
          )}

          {/* Pool de mensagens */}
          {(step.pool_mensagens?.length ?? 0) > 0 && (
            <div className="space-y-2">
              {step.pool_mensagens.map((msg, i) => (
                <div key={i} className="flex gap-2">
                  <Textarea
                    value={msg}
                    onChange={(e) => updatePoolMessage(i, e.target.value)}
                    placeholder={`Variação ${i + 1}…`}
                    className="flex-1 min-h-[64px] text-sm resize-none"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="shrink-0 h-8 w-8 self-start mt-1 text-destructive hover:text-destructive"
                    onClick={() => removePoolMessage(i)}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Aba de métricas ──────────────────────────────────────────────────────────

function MetricasTab() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/follow/stats')
      if (res.ok) setStats(await res.json())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  if (loading) return (
    <div className="flex items-center justify-center h-48">
      <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
    </div>
  )

  if (!stats) return <p className="text-sm text-muted-foreground text-center py-12">Erro ao carregar métricas.</p>

  const taxaResposta = stats.total_enviados > 0
    ? Math.round(
        (stats.ultimos.filter((u) => u.respondeu).length / Math.min(stats.ultimos.length, stats.total_enviados)) * 100
      )
    : 0

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Últimos 30 dias</p>
        <Button variant="ghost" size="sm" onClick={load} className="h-7 text-xs gap-1">
          <RefreshCw className="w-3 h-3" /> Atualizar
        </Button>
      </div>

      {/* Cards de resumo */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Enviados', value: stats.total_enviados, icon: MessageSquare, color: 'text-blue-600' },
          { label: 'Falhas', value: stats.total_falhas, icon: XCircle, color: 'text-red-500' },
          { label: 'Sequências ativas', value: stats.sequencias_ativas, icon: CheckCircle2, color: 'text-emerald-600' },
          { label: 'Taxa resposta', value: `${taxaResposta}%`, icon: BarChart2, color: 'text-purple-600' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="rounded-xl border border-border p-4 space-y-1">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">{label}</p>
              <Icon className={cn('w-4 h-4', color)} />
            </div>
            <p className="text-2xl font-bold">{value}</p>
          </div>
        ))}
      </div>

      {/* Por tipo */}
      {stats.por_tipo.length > 0 && (
        <div className="rounded-xl border border-border overflow-hidden">
          <div className="px-4 py-3 bg-muted/20 border-b border-border">
            <p className="text-sm font-medium">Por tipo de sequência</p>
          </div>
          <div className="divide-y divide-border">
            {stats.por_tipo.map((row) => (
              <div key={row.tipo} className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-2">
                  <TipoBadge tipo={row.tipo as SequenceTipo} />
                </div>
                <div className="flex gap-4 text-sm">
                  <span className="text-muted-foreground">
                    <span className="font-medium text-foreground">{row.enviados}</span> enviados
                  </span>
                  {row.falhas > 0 && (
                    <span className="text-red-500">{row.falhas} falhas</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Últimos disparos */}
      {stats.ultimos.length > 0 && (
        <div className="rounded-xl border border-border overflow-hidden">
          <div className="px-4 py-3 bg-muted/20 border-b border-border">
            <p className="text-sm font-medium">Últimos disparos</p>
          </div>
          <div className="divide-y divide-border">
            {stats.ultimos.map((log) => (
              <div key={log.id} className="flex items-start gap-3 px-4 py-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium">{log.lead_name}</span>
                    <TipoBadge tipo={log.tipo as SequenceTipo} />
                    {log.respondeu && (
                      <span className="text-xs text-emerald-600 flex items-center gap-0.5">
                        <CheckCircle2 className="w-3 h-3" /> Respondeu
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">{log.mensagem}</p>
                </div>
                <span className="text-xs text-muted-foreground shrink-0">
                  {new Date(log.enviado_em).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {stats.ultimos.length === 0 && stats.total_enviados === 0 && (
        <div className="text-center py-12">
          <BarChart2 className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Nenhum disparo nos últimos 30 dias</p>
          <p className="text-xs text-muted-foreground mt-1">Crie uma sequência e ative-a para começar</p>
        </div>
      )}
    </div>
  )
}

// ─── Página principal ─────────────────────────────────────────────────────────

type TabId = 'follow' | 'remarketing' | 'metricas'

const TABS: { id: TabId; label: string; icon: React.FC<{ className?: string }> }[] = [
  { id: 'follow', label: 'Follow-up', icon: Clock },
  { id: 'remarketing', label: 'Remarketing', icon: Megaphone },
  { id: 'metricas', label: 'Métricas', icon: BarChart2 },
]

export default function FollowPage() {
  const [activeTab, setActiveTab] = useState<TabId>('follow')
  const [sequences, setSequences] = useState<FollowSequence[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<FollowSequence | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [form, setForm] = useState(DEFAULT_FORM())

  const loadSequences = useCallback(async () => {
    try {
      const res = await fetch('/api/follow/sequences')
      const data = await res.json()
      setSequences(data.sequences ?? [])
    } catch {
      toast({ title: 'Erro ao carregar cadências', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadSequences() }, [loadSequences])

  function openNew(defaultTipo?: SequenceTipo) {
    setEditing(null)
    setForm(DEFAULT_FORM(defaultTipo ?? (activeTab === 'remarketing' ? 'remarketing' : 'follow_geral')))
    setDialogOpen(true)
  }

  function openEdit(seq: FollowSequence) {
    setEditing(seq)
    setForm({
      nome: seq.nome,
      tipo: seq.tipo,
      ativo: seq.ativo,
      steps: seq.follow_steps.length > 0
        ? seq.follow_steps.map((s) => ({
            ...s,
            mensagem: s.mensagem ?? '',
            pool_mensagens: s.pool_mensagens ?? [],
            usar_contexto_sdr: s.usar_contexto_sdr ?? false,
          }))
        : [EMPTY_STEP()],
    })
    setDialogOpen(true)
  }

  function updateStep(i: number, patch: Partial<FollowStep>) {
    setForm((prev) => ({
      ...prev,
      steps: prev.steps.map((s, idx) => idx === i ? { ...s, ...patch } : s),
    }))
  }

  function addStep() {
    setForm((prev) => ({
      ...prev,
      steps: [
        ...prev.steps,
        { ...EMPTY_STEP(), dia_offset: prev.steps.length + 1, ordem: prev.steps.length },
      ],
    }))
  }

  function removeStep(i: number) {
    setForm((prev) => ({ ...prev, steps: prev.steps.filter((_, idx) => idx !== i) }))
  }

  async function handleSave() {
    if (!form.nome.trim()) {
      toast({ title: 'Nome é obrigatório', variant: 'destructive' })
      return
    }
    setSaving(true)
    try {
      const body = {
        nome: form.nome,
        tipo: form.tipo,
        ativo: form.ativo,
        steps: form.steps.map((s, i) => ({
          ...s,
          ordem: i,
          pool_mensagens: s.pool_mensagens.filter(Boolean),
          mensagem: s.mensagem || null,
        })),
      }

      const res = editing
        ? await fetch(`/api/follow/sequences/${editing.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          })
        : await fetch('/api/follow/sequences', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      toast({ title: editing ? 'Cadência atualizada!' : 'Cadência criada!' })
      setDialogOpen(false)
      loadSequences()
    } catch (err: any) {
      toast({ title: err.message || 'Erro ao salvar', variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  async function handleToggle(seq: FollowSequence) {
    try {
      const res = await fetch(`/api/follow/sequences/${seq.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ativo: !seq.ativo }),
      })
      if (!res.ok) throw new Error()
      setSequences((prev) => prev.map((s) => s.id === seq.id ? { ...s, ativo: !s.ativo } : s))
    } catch {
      toast({ title: 'Erro ao alterar status', variant: 'destructive' })
    }
  }

  async function handleDelete(id: string) {
    setDeleting(id)
    try {
      const res = await fetch(`/api/follow/sequences/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      setSequences((prev) => prev.filter((s) => s.id !== id))
      toast({ title: 'Cadência removida' })
    } catch {
      toast({ title: 'Erro ao remover', variant: 'destructive' })
    } finally {
      setDeleting(null)
    }
  }

  const followSeqs = sequences.filter((s) => TIPO_CONFIG[s.tipo]?.tab === 'follow')
  const remarketingSeqs = sequences.filter((s) => TIPO_CONFIG[s.tipo]?.tab === 'remarketing')
  const currentSeqs = activeTab === 'follow' ? followSeqs : remarketingSeqs
  const tipoConfig = TIPO_CONFIG[form.tipo]

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Follow-up & Remarketing</h1>
          <p className="text-sm text-muted-foreground">Cadências automáticas para leads e re-engajamento</p>
        </div>
        {activeTab !== 'metricas' && (
          <Button onClick={() => openNew()}>
            <Plus className="w-4 h-4 mr-2" /> Nova cadência
          </Button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-muted/30 rounded-xl border border-border w-fit">
        {TABS.map((tab) => {
          const Icon = tab.icon
          const count = tab.id === 'follow' ? followSeqs.length : tab.id === 'remarketing' ? remarketingSeqs.length : null
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm transition-colors',
                activeTab === tab.id
                  ? 'bg-background shadow-sm font-medium text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
              {count !== null && count > 0 && (
                <span className={cn(
                  'text-xs px-1.5 py-0.5 rounded-full min-w-[18px] text-center',
                  activeTab === tab.id ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
                )}>{count}</span>
              )}
            </button>
          )
        })}
      </div>

      {/* Métricas */}
      {activeTab === 'metricas' && <MetricasTab />}

      {/* Listas */}
      {activeTab !== 'metricas' && (
        loading ? (
          <div className="flex items-center justify-center h-48">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : currentSeqs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-4 rounded-xl border border-dashed border-border">
            {activeTab === 'follow'
              ? <Clock className="w-10 h-10 text-muted-foreground/30" />
              : <Megaphone className="w-10 h-10 text-muted-foreground/30" />}
            <div className="text-center">
              <p className="text-sm text-muted-foreground font-medium">
                Nenhuma cadência de {activeTab === 'follow' ? 'follow-up' : 'remarketing'} configurada
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {activeTab === 'follow'
                  ? 'Crie sequências para follow geral, anti-noshow ou pós-proposta'
                  : 'Re-engaje leads perdidos com campanhas de remarketing'}
              </p>
            </div>
            <Button onClick={() => openNew()}>
              <Plus className="w-4 h-4 mr-2" /> Criar primeira cadência
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {currentSeqs.map((seq) => (
              <SequenceCard
                key={seq.id}
                seq={seq}
                onToggle={() => handleToggle(seq)}
                onEdit={() => openEdit(seq)}
                onDelete={() => handleDelete(seq.id)}
                deleting={deleting === seq.id}
              />
            ))}
          </div>
        )
      )}

      {/* Dialog criar/editar */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {editing ? <Pencil className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
              {editing ? 'Editar cadência' : 'Nova cadência'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-5 py-2">
            {/* Nome + tipo */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Nome *</Label>
                <Input
                  value={form.nome}
                  onChange={(e) => setForm((p) => ({ ...p, nome: e.target.value }))}
                  placeholder="Ex: Follow 7 dias"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Tipo *</Label>
                <Select
                  value={form.tipo}
                  onValueChange={(v: SequenceTipo) => setForm((p) => ({ ...p, tipo: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="follow_geral">
                      <span className="flex items-center gap-2">
                        <Clock className="w-3.5 h-3.5 text-blue-500" /> Follow Geral
                      </span>
                    </SelectItem>
                    <SelectItem value="anti_noshow">
                      <span className="flex items-center gap-2">
                        <CalendarClock className="w-3.5 h-3.5 text-orange-500" /> Anti-Noshow
                      </span>
                    </SelectItem>
                    <SelectItem value="follow_proposta">
                      <span className="flex items-center gap-2">
                        <FileText className="w-3.5 h-3.5 text-emerald-500" /> Follow Proposta
                      </span>
                    </SelectItem>
                    <SelectItem value="remarketing">
                      <span className="flex items-center gap-2">
                        <Megaphone className="w-3.5 h-3.5 text-purple-500" /> Remarketing
                      </span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Descrição do tipo */}
            {tipoConfig && (
              <div className={cn('flex items-start gap-3 p-3 rounded-xl border', tipoConfig.color.replace('text-', 'border-').replace('/20', '/30'))}>
                <ArrowRight className="w-4 h-4 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium">{tipoConfig.label}</p>
                  <p className="text-xs mt-0.5 opacity-80">{tipoConfig.desc}</p>
                </div>
              </div>
            )}

            {/* Ativo */}
            <div className="flex items-center justify-between p-3 bg-muted/30 rounded-xl border border-border">
              <div>
                <p className="text-sm font-medium">Cadência ativa</p>
                <p className="text-xs text-muted-foreground">Ativar disparos automáticos</p>
              </div>
              <Switch
                checked={form.ativo}
                onCheckedChange={(v) => setForm((p) => ({ ...p, ativo: v }))}
              />
            </div>

            {/* Passos */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">Passos da cadência</p>
                <Button variant="outline" size="sm" onClick={addStep} className="h-7 text-xs">
                  <Plus className="w-3.5 h-3.5 mr-1" /> Adicionar passo
                </Button>
              </div>

              {form.steps.map((step, i) => (
                <StepEditor
                  key={i}
                  step={step}
                  index={i}
                  tipo={form.tipo}
                  total={form.steps.length}
                  onChange={(patch) => updateStep(i, patch)}
                  onRemove={() => removeStep(i)}
                />
              ))}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              {editing ? 'Salvar' : 'Criar cadência'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
