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
  RefreshCw,
  Info,
  AlarmClock,
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
  por_tipo: { tipo: string; label: string; enviados: number; falhas: number }[]
  ultimos: {
    id: number
    tipo: string
    lead_name: string
    mensagem: string
    enviado_em: string
    respondeu: boolean
  }[]
}

// ─── Config ───────────────────────────────────────────────────────────────────

const TIPO_CONFIG: Record<SequenceTipo, {
  label: string
  desc: string
  hint: string
  color: string
  badgeColor: string
  icon: React.FC<{ className?: string }>
  tab: 'follow' | 'remarketing'
  isHours: boolean
}> = {
  follow_geral: {
    label: 'Follow Geral',
    desc: 'Leads em contato sem resposta por X dias',
    hint: 'O disparo ocorre quando o lead fica X dias sem responder sua última mensagem, no horário configurado.',
    color: 'border-blue-500/30 bg-blue-500/5',
    badgeColor: 'bg-blue-500/10 text-blue-600 border-blue-500/20 dark:text-blue-400',
    icon: Clock,
    tab: 'follow',
    isHours: false,
  },
  anti_noshow: {
    label: 'Anti-Noshow',
    desc: 'Lembretes antes e depois de calls agendadas',
    hint: 'Dispara em relação ao horário da call agendada do lead. Use negativo para antes da call, positivo para depois.',
    color: 'border-orange-500/30 bg-orange-500/5',
    badgeColor: 'bg-orange-500/10 text-orange-600 border-orange-500/20 dark:text-orange-400',
    icon: CalendarClock,
    tab: 'follow',
    isHours: true,
  },
  follow_proposta: {
    label: 'Follow Proposta',
    desc: 'Pós-call realizada, lead sem fechar',
    hint: 'Dispara X dias após a call ter sido realizada, quando o lead ainda não fechou negócio.',
    color: 'border-emerald-500/30 bg-emerald-500/5',
    badgeColor: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:text-emerald-400',
    icon: FileText,
    tab: 'follow',
    isHours: false,
  },
  remarketing: {
    label: 'Remarketing',
    desc: 'Re-engajamento de leads perdidos',
    hint: 'Dispara X dias após o último contato com leads de status Perdido.',
    color: 'border-purple-500/30 bg-purple-500/5',
    badgeColor: 'bg-purple-500/10 text-purple-600 border-purple-500/20 dark:text-purple-400',
    icon: Megaphone,
    tab: 'remarketing',
    isHours: false,
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

function stepTimingLabel(tipo: SequenceTipo, offset: number, horario: string): string {
  const time = horario.slice(0, 5)
  if (tipo === 'anti_noshow') {
    const abs = Math.abs(offset)
    const dir = offset < 0 ? 'antes' : offset === 0 ? 'no momento' : 'depois'
    if (abs === 0) return `No momento da call · ${time}`
    return `${abs}h ${dir} da call · ${time}`
  }
  return `D+${offset} · ${time}`
}

function stepTimingSummary(tipo: SequenceTipo, offset: number, horario: string): string {
  const time = horario.slice(0, 5)
  if (tipo === 'anti_noshow') {
    const abs = Math.abs(offset)
    if (offset < 0) return `Dispara ${abs} hora${abs !== 1 ? 's' : ''} antes da call agendada, às ${time}`
    if (offset === 0) return `Dispara no exato horário da call, às ${time}`
    return `Dispara ${abs} hora${abs !== 1 ? 's' : ''} após a call, às ${time}`
  }
  const unit = offset === 1 ? 'dia' : 'dias'
  return `Dispara quando o lead ficar ${offset} ${unit} sem responder, às ${time}`
}

// ─── Badge de tipo ────────────────────────────────────────────────────────────

function TipoBadge({ tipo }: { tipo: SequenceTipo }) {
  const cfg = TIPO_CONFIG[tipo]
  const Icon = cfg.icon
  return (
    <span className={cn('text-xs px-2 py-0.5 rounded-full border inline-flex items-center gap-1 w-fit', cfg.badgeColor)}>
      <Icon className="w-3 h-3" />
      {cfg.label}
    </span>
  )
}

// ─── Card de sequência na lista ───────────────────────────────────────────────

function SequenceCard({
  seq, onToggle, onEdit, onDelete, deleting,
}: {
  seq: FollowSequence
  onToggle: () => void
  onEdit: () => void
  onDelete: () => void
  deleting: boolean
}) {
  const cfg = TIPO_CONFIG[seq.tipo]
  return (
    <Card className={cn('transition-opacity', !seq.ativo && 'opacity-55')}>
      <CardContent className="py-4 px-5">
        <div className="flex items-start justify-between gap-4">
          {/* Info */}
          <div className="flex-1 min-w-0 space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold text-sm">{seq.nome}</h3>
              <TipoBadge tipo={seq.tipo} />
              {!seq.ativo && <Badge variant="secondary" className="text-xs">Inativa</Badge>}
            </div>

            {/* Passos em timeline horizontal */}
            {seq.follow_steps.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                {seq.follow_steps.map((step, i) => (
                  <div key={step.id ?? i} className="flex items-center gap-1">
                    {i > 0 && <span className="text-border text-xs">→</span>}
                    <div
                      title={stepTimingSummary(seq.tipo, step.dia_offset, step.horario)}
                      className="flex items-center gap-1.5 text-xs bg-muted/60 border border-border rounded-lg px-2.5 py-1 cursor-default"
                    >
                      <AlarmClock className="w-3 h-3 text-muted-foreground" />
                      <span className="font-medium">{stepTimingLabel(seq.tipo, step.dia_offset, step.horario)}</span>
                      {step.usar_ia && <Sparkles className="w-3 h-3 text-primary" />}
                      {(step.pool_mensagens?.length ?? 0) > 1 && (
                        <span className="text-muted-foreground/60 text-[10px]">{step.pool_mensagens.length}×</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Ações */}
          <div className="flex items-center gap-1.5 shrink-0 pt-0.5">
            <Switch checked={seq.ativo} onCheckedChange={onToggle} />
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onEdit}>
              <Pencil className="w-3.5 h-3.5" />
            </Button>
            <Button
              variant="ghost" size="icon"
              className="h-8 w-8 text-destructive hover:text-destructive"
              onClick={onDelete} disabled={deleting}
            >
              {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ─── Editor de passo ──────────────────────────────────────────────────────────

function StepEditor({
  step, index, tipo, total, onChange, onRemove,
}: {
  step: FollowStep
  index: number
  tipo: SequenceTipo
  total: number
  onChange: (patch: Partial<FollowStep>) => void
  onRemove: () => void
}) {
  const isAntiNoshow = tipo === 'anti_noshow'

  // Anti-noshow: split signed offset → abs value + direction
  const absHours = Math.abs(step.dia_offset)
  const direction: 'antes' | 'depois' = step.dia_offset <= 0 ? 'antes' : 'depois'

  function setAntiOffset(abs: number, dir: 'antes' | 'depois') {
    onChange({ dia_offset: dir === 'antes' ? -Math.abs(abs) : Math.abs(abs) })
  }

  function addPoolMsg() {
    onChange({ pool_mensagens: [...(step.pool_mensagens ?? []), ''] })
  }
  function updatePoolMsg(i: number, v: string) {
    const p = [...(step.pool_mensagens ?? [])]
    p[i] = v
    onChange({ pool_mensagens: p })
  }
  function removePoolMsg(i: number) {
    onChange({ pool_mensagens: (step.pool_mensagens ?? []).filter((_, idx) => idx !== i) })
  }

  const hasPool = (step.pool_mensagens?.length ?? 0) > 0
  const summary = stepTimingSummary(tipo, step.dia_offset, step.horario)

  return (
    <div className="rounded-xl border border-border bg-background shadow-sm overflow-hidden">
      {/* Cabeçalho do passo */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-muted/30 border-b border-border">
        <span className="text-sm font-semibold text-foreground">Passo {index + 1}</span>
        {total > 1 && (
          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={onRemove}>
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        )}
      </div>

      <div className="p-4 space-y-4">
        {/* ── Quando disparar ── */}
        <div className="space-y-2">
          <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Quando disparar</Label>

          {isAntiNoshow ? (
            /* Anti-noshow: abs hours + antes/depois + horário */
            <div className="flex items-center gap-2 flex-wrap">
              <Input
                type="number"
                min={0}
                value={absHours}
                onChange={(e) => setAntiOffset(parseInt(e.target.value) || 0, direction)}
                className="w-20 h-9 text-sm text-center font-mono"
              />
              <span className="text-sm text-muted-foreground">hora{absHours !== 1 ? 's' : ''}</span>
              <Select value={direction} onValueChange={(v: 'antes' | 'depois') => setAntiOffset(absHours, v)}>
                <SelectTrigger className="w-28 h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="antes">antes</SelectItem>
                  <SelectItem value="depois">depois</SelectItem>
                </SelectContent>
              </Select>
              <span className="text-sm text-muted-foreground">da call, às</span>
              <Input
                type="time"
                value={step.horario}
                onChange={(e) => onChange({ horario: e.target.value })}
                className="w-28 h-9 text-sm font-mono"
              />
            </div>
          ) : (
            /* Demais tipos: dias + horário */
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm text-muted-foreground">Após</span>
              <Input
                type="number"
                min={1}
                value={step.dia_offset}
                onChange={(e) => onChange({ dia_offset: parseInt(e.target.value) || 1 })}
                className="w-20 h-9 text-sm text-center font-mono"
              />
              <span className="text-sm text-muted-foreground">
                {step.dia_offset === 1 ? 'dia' : 'dias'} sem resposta, às
              </span>
              <Input
                type="time"
                value={step.horario}
                onChange={(e) => onChange({ horario: e.target.value })}
                className="w-28 h-9 text-sm font-mono"
              />
            </div>
          )}

          {/* Resumo em linguagem natural */}
          <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-muted/40 border border-border">
            <Info className="w-3.5 h-3.5 text-muted-foreground mt-0.5 shrink-0" />
            <p className="text-xs text-muted-foreground">{summary}</p>
          </div>
        </div>

        {/* ── Mensagem ── */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Mensagem</Label>
          </div>

          {/* Toggle IA */}
          <div className="space-y-2">
            <div className="flex items-center gap-3 py-2 px-3 rounded-lg border border-border bg-muted/20">
              <Switch
                checked={step.usar_ia}
                onCheckedChange={(v) => onChange({ usar_ia: v })}
              />
              <div>
                <p className="text-sm font-medium flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-primary" />
                  Gerar com IA
                </p>
                <p className="text-xs text-muted-foreground">A IA cria a mensagem baseada no contexto do lead</p>
              </div>
            </div>

            {/* Contexto SDR — só quando usar_ia = true */}
            {step.usar_ia && (
              <div className="flex items-center gap-3 py-2 px-3 ml-4 rounded-lg border border-dashed border-border bg-muted/10">
                <Switch
                  checked={step.usar_contexto_sdr}
                  onCheckedChange={(v) => onChange({ usar_contexto_sdr: v })}
                />
                <div>
                  <p className="text-sm font-medium flex items-center gap-1.5 text-muted-foreground">
                    <Bot className="w-3.5 h-3.5" />
                    Usar contexto do agente SDR
                  </p>
                  <p className="text-xs text-muted-foreground">Inclui o prompt do agente para manter o tom</p>
                </div>
              </div>
            )}
          </div>

          {/* Mensagem manual */}
          {!step.usar_ia && (
            <div className="space-y-2">
              {hasPool && (
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">
                    {step.pool_mensagens.length} variação{step.pool_mensagens.length !== 1 ? 'ões' : ''} — disparo aleatório
                  </p>
                  <Button type="button" variant="ghost" size="sm" className="h-6 text-xs px-2" onClick={addPoolMsg}>
                    <Plus className="w-3 h-3 mr-1" /> Mais variação
                  </Button>
                </div>
              )}

              {!hasPool && (
                <>
                  <Textarea
                    value={step.mensagem}
                    onChange={(e) => onChange({ mensagem: e.target.value })}
                    placeholder="Oi, {nome}! Gostaria de retomar nossa conversa…"
                    className="min-h-[80px] text-sm resize-none"
                  />
                  <Button type="button" variant="ghost" size="sm" className="h-7 text-xs px-2 text-muted-foreground hover:text-foreground" onClick={addPoolMsg}>
                    <Plus className="w-3 h-3 mr-1" /> Adicionar variações (disparo aleatório)
                  </Button>
                </>
              )}

              {hasPool && (
                <div className="space-y-2">
                  {step.pool_mensagens.map((msg, i) => (
                    <div key={i} className="flex gap-2 items-start">
                      <div className="flex items-center justify-center w-6 h-6 rounded-full bg-muted border border-border text-xs font-mono text-muted-foreground shrink-0 mt-1.5">
                        {i + 1}
                      </div>
                      <Textarea
                        value={msg}
                        onChange={(e) => updatePoolMsg(i, e.target.value)}
                        placeholder={`Variação ${i + 1}…`}
                        className="flex-1 min-h-[72px] text-sm resize-none"
                      />
                      <Button
                        type="button" variant="ghost" size="icon"
                        className="shrink-0 h-8 w-8 self-start mt-1 text-destructive hover:text-destructive"
                        onClick={() => removePoolMsg(i)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  ))}
                  <Button type="button" variant="outline" size="sm" className="w-full h-8 text-xs border-dashed" onClick={addPoolMsg}>
                    <Plus className="w-3 h-3 mr-1" /> Adicionar variação
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Aba Métricas ─────────────────────────────────────────────────────────────

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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Últimos 30 dias</p>
        <Button variant="ghost" size="sm" onClick={load} className="h-7 text-xs gap-1">
          <RefreshCw className="w-3 h-3" /> Atualizar
        </Button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Enviados', value: stats.total_enviados, icon: MessageSquare, color: 'text-blue-600' },
          { label: 'Falhas', value: stats.total_falhas, icon: XCircle, color: 'text-red-500' },
          { label: 'Sequências ativas', value: stats.sequencias_ativas, icon: CheckCircle2, color: 'text-emerald-600' },
          { label: 'Taxa resposta', value: `${stats.total_enviados > 0 ? Math.round((stats.ultimos.filter(u => u.respondeu).length / stats.ultimos.length) * 100) : 0}%`, icon: BarChart2, color: 'text-purple-600' },
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

      {stats.por_tipo.length > 0 && (
        <div className="rounded-xl border border-border overflow-hidden">
          <div className="px-4 py-3 bg-muted/20 border-b border-border">
            <p className="text-sm font-medium">Por tipo</p>
          </div>
          <div className="divide-y divide-border">
            {stats.por_tipo.map((row) => (
              <div key={row.tipo} className="flex items-center justify-between px-4 py-3">
                <TipoBadge tipo={row.tipo as SequenceTipo} />
                <div className="flex gap-4 text-sm">
                  <span className="text-muted-foreground"><span className="font-medium text-foreground">{row.enviados}</span> enviados</span>
                  {row.falhas > 0 && <span className="text-red-500">{row.falhas} falhas</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

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

      {stats.ultimos.length === 0 && (
        <div className="text-center py-12">
          <BarChart2 className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Nenhum disparo nos últimos 30 dias</p>
        </div>
      )}
    </div>
  )
}

// ─── Página ───────────────────────────────────────────────────────────────────

type TabId = 'follow' | 'remarketing' | 'metricas'

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

  function openNew() {
    setEditing(null)
    setForm(DEFAULT_FORM(activeTab === 'remarketing' ? 'remarketing' : 'follow_geral'))
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
    setForm((prev) => {
      const last = prev.steps[prev.steps.length - 1]
      const nextOffset = TIPO_CONFIG[prev.tipo].isHours
        ? (last?.dia_offset ?? -24) - 1
        : (last?.dia_offset ?? 0) + 1
      return {
        ...prev,
        steps: [...prev.steps, { ...EMPTY_STEP(), dia_offset: nextOffset, ordem: prev.steps.length }],
      }
    })
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
            method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
          })
        : await fetch('/api/follow/sequences', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
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
      await fetch(`/api/follow/sequences/${seq.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ativo: !seq.ativo }),
      })
      setSequences((prev) => prev.map((s) => s.id === seq.id ? { ...s, ativo: !s.ativo } : s))
    } catch {
      toast({ title: 'Erro ao alterar status', variant: 'destructive' })
    }
  }

  async function handleDelete(id: string) {
    setDeleting(id)
    try {
      await fetch(`/api/follow/sequences/${id}`, { method: 'DELETE' })
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

  const TABS = [
    { id: 'follow' as TabId, label: 'Follow-up', icon: Clock, count: followSeqs.length },
    { id: 'remarketing' as TabId, label: 'Remarketing', icon: Megaphone, count: remarketingSeqs.length },
    { id: 'metricas' as TabId, label: 'Métricas', icon: BarChart2, count: null },
  ]

  const tipoConfig = TIPO_CONFIG[form.tipo]

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Follow-up & Remarketing</h1>
          <p className="text-sm text-muted-foreground">Cadências automáticas de engajamento</p>
        </div>
        {activeTab !== 'metricas' && (
          <Button onClick={openNew}>
            <Plus className="w-4 h-4 mr-2" /> Nova cadência
          </Button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-muted/30 rounded-xl border border-border w-fit">
        {TABS.map(({ id, label, icon: Icon, count }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={cn(
              'flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm transition-colors',
              activeTab === id
                ? 'bg-background shadow-sm font-medium text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <Icon className="w-4 h-4" />
            {label}
            {count !== null && count > 0 && (
              <span className={cn(
                'text-xs px-1.5 py-0.5 rounded-full min-w-[18px] text-center leading-none',
                activeTab === id ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
              )}>{count}</span>
            )}
          </button>
        ))}
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
            <div className="text-center space-y-1">
              <p className="text-sm font-medium text-muted-foreground">
                Nenhuma cadência de {activeTab === 'follow' ? 'follow-up' : 'remarketing'}
              </p>
              <p className="text-xs text-muted-foreground">
                {activeTab === 'follow'
                  ? 'Crie sequências automáticas para follow geral, anti-noshow ou pós-proposta'
                  : 'Re-engaje leads perdidos com campanhas automáticas'}
              </p>
            </div>
            <Button onClick={openNew} size="sm">
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

          <div className="space-y-5 py-1">
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
                    {(Object.entries(TIPO_CONFIG) as [SequenceTipo, typeof TIPO_CONFIG[SequenceTipo]][]).map(([key, cfg]) => {
                      const Icon = cfg.icon
                      return (
                        <SelectItem key={key} value={key}>
                          <span className="flex items-center gap-2">
                            <Icon className={cn('w-3.5 h-3.5', cfg.badgeColor.includes('blue') ? 'text-blue-500' : cfg.badgeColor.includes('orange') ? 'text-orange-500' : cfg.badgeColor.includes('emerald') ? 'text-emerald-500' : 'text-purple-500')} />
                            {cfg.label}
                          </span>
                        </SelectItem>
                      )
                    })}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Hint do tipo */}
            {tipoConfig && (
              <div className={cn('flex items-start gap-3 p-3 rounded-xl border', tipoConfig.color)}>
                <Info className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium">{tipoConfig.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{tipoConfig.hint}</p>
                </div>
              </div>
            )}

            {/* Ativo */}
            <div className="flex items-center justify-between p-3 rounded-xl border border-border bg-muted/20">
              <div>
                <p className="text-sm font-medium">Cadência ativa</p>
                <p className="text-xs text-muted-foreground">Habilitar disparos automáticos</p>
              </div>
              <Switch checked={form.ativo} onCheckedChange={(v) => setForm((p) => ({ ...p, ativo: v }))} />
            </div>

            {/* Passos */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold">Passos</p>
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
                  onRemove={() => setForm((p) => ({ ...p, steps: p.steps.filter((_, idx) => idx !== i) }))}
                />
              ))}
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              {editing ? 'Salvar alterações' : 'Criar cadência'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
