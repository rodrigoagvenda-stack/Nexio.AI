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
  Copy,
  Check,
  Webhook,
  Settings2,
  ListChecks,
  Users,
  Pencil,
  AlarmClock,
  Info,
  Image,
  Video,
  FileAudio,
  FileText,
  MapPin,
  LayoutList,
  Rows3,
  Mic,
  ChevronRight,
  Clock,
  CalendarDays,
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

type StepTipo =
  | 'text' | 'image' | 'video' | 'audio' | 'ptt'
  | 'document' | 'menu' | 'carousel' | 'location'

interface MediaConfig {
  file?: string
  text?: string
  docName?: string
  viewOnce?: boolean
  menuType?: 'button' | 'list' | 'poll'
  choices?: string[]
  selectableCount?: number
  carousel?: { text: string; image?: string; buttons?: string[] }[]
  name?: string
  address?: string
  latitude?: number
  longitude?: number
}

interface TrialStep {
  id?: string
  dia_offset: number
  horario: string
  mensagem: string
  pool_mensagens: string[]
  tipo_mensagem: StepTipo
  media_config: MediaConfig
  ordem: number
}

interface TrialSequence {
  id: string
  nome: string
  ativo: boolean
  follow_steps: TrialStep[]
}

interface TrialRecord {
  id: number
  nome: string
  email: string
  whatsapp: string
  status: string
  criado_em: string
  trial_days: number
}

interface TrialConfig {
  webhook_token: string
  trial_days_options: number[]
  trial_days_default: number
}

// ─── Tipo de mensagem config ──────────────────────────────────────────────────

const TIPO_MSG: Record<StepTipo, { label: string; icon: React.FC<{ className?: string }>; color: string }> = {
  text:     { label: 'Texto',     icon: FileText,  color: 'text-blue-500' },
  image:    { label: 'Imagem',    icon: Image,     color: 'text-emerald-500' },
  video:    { label: 'Vídeo',     icon: Video,     color: 'text-purple-500' },
  audio:    { label: 'Áudio',     icon: FileAudio, color: 'text-orange-500' },
  ptt:      { label: 'Áudio PTT', icon: Mic,       color: 'text-rose-500' },
  document: { label: 'Documento', icon: FileText,  color: 'text-amber-500' },
  menu:     { label: 'Menu',      icon: LayoutList, color: 'text-sky-500' },
  carousel: { label: 'Carrossel', icon: Rows3,     color: 'text-violet-500' },
  location: { label: 'Localização', icon: MapPin,  color: 'text-teal-500' },
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const EMPTY_STEP = (): TrialStep => ({
  dia_offset: 0,
  horario: '09:00',
  mensagem: '',
  pool_mensagens: [],
  tipo_mensagem: 'text',
  media_config: {},
  ordem: 0,
})

const DEFAULT_FORM = () => ({
  nome: '',
  ativo: true,
  steps: [EMPTY_STEP()],
})

function daysLabel(d: number) {
  if (d === 0) return 'Boas-vindas (imediato)'
  return `Dia ${d}`
}

// ─── Editor de media por tipo ─────────────────────────────────────────────────

function MediaEditor({
  tipo, config, onChange,
}: {
  tipo: StepTipo
  config: MediaConfig
  onChange: (patch: Partial<MediaConfig>) => void
}) {
  if (tipo === 'text') return null

  if (tipo === 'image' || tipo === 'video' || tipo === 'document' || tipo === 'audio' || tipo === 'ptt') {
    return (
      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">URL do arquivo</Label>
          <Input
            value={config.file ?? ''}
            onChange={(e) => onChange({ file: e.target.value })}
            placeholder="https://..."
            className="h-9 text-sm font-mono"
          />
        </div>
        {(tipo === 'image' || tipo === 'video' || tipo === 'document') && (
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">
              {tipo === 'document' ? 'Nome do arquivo' : 'Legenda (opcional)'}
            </Label>
            <Input
              value={tipo === 'document' ? (config.docName ?? '') : (config.text ?? '')}
              onChange={(e) => onChange(tipo === 'document' ? { docName: e.target.value } : { text: e.target.value })}
              placeholder={tipo === 'document' ? 'relatorio.pdf' : 'Legenda da mídia…'}
              className="h-9 text-sm"
            />
          </div>
        )}
        {(tipo === 'image' || tipo === 'video') && (
          <div className="flex items-center gap-3 py-2 px-3 rounded-lg border border-border bg-muted/20">
            <Switch checked={config.viewOnce ?? false} onCheckedChange={(v) => onChange({ viewOnce: v })} />
            <div>
              <p className="text-sm font-medium">Ver uma vez</p>
              <p className="text-xs text-muted-foreground">Destinatário só pode abrir uma vez</p>
            </div>
          </div>
        )}
      </div>
    )
  }

  if (tipo === 'menu') {
    const choices = config.choices ?? []
    return (
      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Tipo de menu</Label>
          <Select value={config.menuType ?? 'button'} onValueChange={(v: 'button' | 'list' | 'poll') => onChange({ menuType: v })}>
            <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="button">Botões</SelectItem>
              <SelectItem value="list">Lista</SelectItem>
              <SelectItem value="poll">Enquete</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs text-muted-foreground">Opções</Label>
            <Button type="button" variant="ghost" size="sm" className="h-6 text-xs px-2"
              onClick={() => onChange({ choices: [...choices, ''] })}>
              <Plus className="w-3 h-3 mr-1" /> Adicionar
            </Button>
          </div>
          {choices.map((c, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className="w-5 h-5 rounded bg-muted flex items-center justify-center text-[10px] text-muted-foreground shrink-0">{i + 1}</div>
              <Input
                value={c}
                onChange={(e) => { const n = [...choices]; n[i] = e.target.value; onChange({ choices: n }) }}
                placeholder={`Opção ${i + 1}`}
                className="h-8 text-sm"
              />
              <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-destructive hover:text-destructive"
                onClick={() => onChange({ choices: choices.filter((_, idx) => idx !== i) })}>
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (tipo === 'carousel') {
    const items = config.carousel ?? []
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-xs text-muted-foreground">Itens do carrossel</Label>
          <Button type="button" variant="ghost" size="sm" className="h-6 text-xs px-2"
            onClick={() => onChange({ carousel: [...items, { text: '', image: '', buttons: [] }] })}>
            <Plus className="w-3 h-3 mr-1" /> Adicionar item
          </Button>
        </div>
        {items.map((item, i) => (
          <div key={i} className="rounded-lg border border-border p-3 space-y-2 bg-muted/10">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Item {i + 1}</span>
              <Button type="button" variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:text-destructive"
                onClick={() => onChange({ carousel: items.filter((_, idx) => idx !== i) })}>
                <Trash2 className="w-3 h-3" />
              </Button>
            </div>
            <Input value={item.image ?? ''} placeholder="URL da imagem" className="h-8 text-sm font-mono"
              onChange={(e) => { const n = [...items]; n[i] = { ...n[i], image: e.target.value }; onChange({ carousel: n }) }} />
            <Textarea value={item.text} placeholder="Texto do item…" className="min-h-[56px] text-sm resize-none"
              onChange={(e) => { const n = [...items]; n[i] = { ...n[i], text: e.target.value }; onChange({ carousel: n }) }} />
          </div>
        ))}
      </div>
    )
  }

  if (tipo === 'location') {
    return (
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2 space-y-1.5">
          <Label className="text-xs text-muted-foreground">Nome do local</Label>
          <Input value={config.name ?? ''} onChange={(e) => onChange({ name: e.target.value })} className="h-9 text-sm" placeholder="Ex: Escritório" />
        </div>
        <div className="col-span-2 space-y-1.5">
          <Label className="text-xs text-muted-foreground">Endereço</Label>
          <Input value={config.address ?? ''} onChange={(e) => onChange({ address: e.target.value })} className="h-9 text-sm" placeholder="Av. Paulista, 1000" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Latitude</Label>
          <Input type="number" value={config.latitude ?? ''} onChange={(e) => onChange({ latitude: parseFloat(e.target.value) })} className="h-9 text-sm font-mono" placeholder="-23.56" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Longitude</Label>
          <Input type="number" value={config.longitude ?? ''} onChange={(e) => onChange({ longitude: parseFloat(e.target.value) })} className="h-9 text-sm font-mono" placeholder="-46.65" />
        </div>
      </div>
    )
  }

  return null
}

// ─── Editor de passo ──────────────────────────────────────────────────────────

function TrialStepEditor({
  step, index, total, onChange, onRemove,
}: {
  step: TrialStep
  index: number
  total: number
  onChange: (patch: Partial<TrialStep>) => void
  onRemove: () => void
}) {
  const tipoInfo = TIPO_MSG[step.tipo_mensagem]
  const TipoIcon = tipoInfo.icon
  const needsText = step.tipo_mensagem === 'text' || step.tipo_mensagem === 'menu' || step.tipo_mensagem === 'carousel'

  return (
    <div className="rounded-xl border border-border bg-background shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 bg-muted/30 border-b border-border">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">Passo {index + 1}</span>
          <span className="text-xs text-muted-foreground">·</span>
          <span className="text-xs text-muted-foreground">{daysLabel(step.dia_offset)}</span>
        </div>
        {total > 1 && (
          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={onRemove}>
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        )}
      </div>

      <div className="p-4 space-y-4">
        {/* Timing */}
        <div className="space-y-2">
          <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Quando enviar</Label>
          <div className="flex items-center gap-2 flex-wrap">
            {step.dia_offset === 0
              ? <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/5 border border-primary/20 text-sm font-medium text-primary">
                  <Clock className="w-3.5 h-3.5" /> Imediatamente após cadastro
                </div>
              : <>
                  <span className="text-sm text-muted-foreground">Dia</span>
                  <Input
                    type="number" min={1}
                    value={step.dia_offset}
                    onChange={(e) => onChange({ dia_offset: parseInt(e.target.value) || 1 })}
                    className="w-20 h-9 text-sm text-center font-mono"
                  />
                  <span className="text-sm text-muted-foreground">do trial, às</span>
                  <Input
                    type="time" value={step.horario}
                    onChange={(e) => onChange({ horario: e.target.value })}
                    className="w-28 h-9 text-sm font-mono"
                  />
                </>
            }
          </div>
        </div>

        {/* Tipo de mensagem */}
        <div className="space-y-2">
          <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Tipo de mensagem</Label>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
            {(Object.entries(TIPO_MSG) as [StepTipo, typeof TIPO_MSG[StepTipo]][]).map(([key, cfg]) => {
              const Icon = cfg.icon
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => onChange({ tipo_mensagem: key, media_config: {} })}
                  className={cn(
                    'flex flex-col items-center gap-1 p-2.5 rounded-xl border text-xs transition-all',
                    step.tipo_mensagem === key
                      ? 'border-primary/40 bg-primary/5 text-primary shadow-sm'
                      : 'border-border bg-muted/20 text-muted-foreground hover:border-border hover:bg-muted/40'
                  )}
                >
                  <Icon className={cn('w-4 h-4', step.tipo_mensagem === key ? 'text-primary' : cfg.color)} />
                  <span className="leading-tight text-center">{cfg.label}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Texto principal (para tipos que precisam) */}
        {needsText && (
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              {step.tipo_mensagem === 'text' ? 'Mensagem' : 'Texto introdutório'}
            </Label>
            <Textarea
              value={step.mensagem}
              onChange={(e) => onChange({ mensagem: e.target.value })}
              placeholder={`Olá, {nome}! ${step.dia_offset === 0 ? 'Bem-vindo ao trial!' : 'Tudo bem com o sistema?'}`}
              className="min-h-[80px] text-sm resize-none"
            />
          </div>
        )}

        {/* Config específica do tipo */}
        {step.tipo_mensagem !== 'text' && (
          <MediaEditor
            tipo={step.tipo_mensagem}
            config={step.media_config}
            onChange={(patch) => onChange({ media_config: { ...step.media_config, ...patch } })}
          />
        )}
      </div>
    </div>
  )
}

// ─── Card de sequência ────────────────────────────────────────────────────────

function SequenceCard({
  seq, onToggle, onEdit, onDelete, deleting,
}: {
  seq: TrialSequence
  onToggle: () => void
  onEdit: () => void
  onDelete: () => void
  deleting: boolean
}) {
  return (
    <Card className={cn('transition-opacity', !seq.ativo && 'opacity-55')}>
      <CardContent className="py-4 px-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0 space-y-2">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-sm">{seq.nome}</h3>
              {!seq.ativo && <Badge variant="secondary" className="text-xs">Inativa</Badge>}
            </div>
            {seq.follow_steps.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                {seq.follow_steps.map((step, i) => {
                  const TipoIcon = TIPO_MSG[step.tipo_mensagem ?? 'text']?.icon ?? FileText
                  return (
                    <div key={step.id ?? i} className="flex items-center gap-1">
                      {i > 0 && <ChevronRight className="w-3 h-3 text-muted-foreground/40" />}
                      <div className="flex items-center gap-1.5 text-xs bg-muted/60 border border-border rounded-lg px-2.5 py-1">
                        <TipoIcon className={cn('w-3 h-3', TIPO_MSG[step.tipo_mensagem ?? 'text']?.color)} />
                        <span className="font-medium">{daysLabel(step.dia_offset)}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
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

// ─── Aba Configurações ────────────────────────────────────────────────────────

function ConfigTab() {
  const [config, setConfig] = useState<TrialConfig | null>(null)
  const [webhookUrl, setWebhookUrl] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [copied, setCopied] = useState(false)
  const [daysDefault, setDaysDefault] = useState(7)
  const [daysOptions, setDaysOptions] = useState<number[]>([7, 15, 30])

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/trial/config')
      if (res.ok) {
        const data = await res.json()
        setConfig(data.config)
        setWebhookUrl(data.webhookUrl ?? '')
        if (data.config) {
          setDaysDefault(data.config.trial_days_default ?? 7)
          setDaysOptions(data.config.trial_days_options ?? [7, 15, 30])
        }
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  async function handleCopy() {
    await navigator.clipboard.writeText(webhookUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function handleSave() {
    setSaving(true)
    try {
      const res = await fetch('/api/trial/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trial_days_options: daysOptions, trial_days_default: daysDefault }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setWebhookUrl(data.webhookUrl)
      setConfig(data.config)
      toast({ title: 'Configuração salva!' })
    } catch (err: any) {
      toast({ title: err.message, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center h-48">
      <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
    </div>
  )

  const PRESET_DAYS = [7, 15, 30]

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Webhook URL */}
      <div className="rounded-xl border border-border overflow-hidden">
        <div className="px-5 py-4 border-b border-border bg-muted/20">
          <div className="flex items-center gap-2">
            <Webhook className="w-4 h-4 text-primary" />
            <p className="font-semibold text-sm">Webhook de cadastro</p>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Configure esta URL no seu formulário de cadastro. Ela receberá os dados de cada novo trial.
          </p>
        </div>
        <div className="p-5 space-y-3">
          {webhookUrl ? (
            <>
              <div className="flex items-center gap-2">
                <Input value={webhookUrl} readOnly className="h-9 text-sm font-mono bg-muted/40 text-muted-foreground" />
                <Button variant="outline" size="icon" className="h-9 w-9 shrink-0" onClick={handleCopy}>
                  {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                </Button>
              </div>
              <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-muted/40 border border-border">
                <Info className="w-3.5 h-3.5 text-muted-foreground mt-0.5 shrink-0" />
                <p className="text-xs text-muted-foreground">
                  Envie <code className="bg-muted px-1 py-0.5 rounded text-[11px]">POST</code> com{' '}
                  <code className="bg-muted px-1 py-0.5 rounded text-[11px]">{`{ "name": "...", "email": "...", "whatsapp": "..." }`}</code>
                </p>
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Salve a configuração para gerar sua URL.</p>
          )}
        </div>
      </div>

      {/* Período de trial */}
      <div className="rounded-xl border border-border overflow-hidden">
        <div className="px-5 py-4 border-b border-border bg-muted/20">
          <div className="flex items-center gap-2">
            <CalendarDays className="w-4 h-4 text-primary" />
            <p className="font-semibold text-sm">Período de trial</p>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Defina quantos dias de teste gratuito o usuário terá.
          </p>
        </div>
        <div className="p-5 space-y-5">
          <div className="space-y-2">
            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Duração padrão</Label>
            <div className="flex gap-2">
              {PRESET_DAYS.map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDaysDefault(d)}
                  className={cn(
                    'px-4 py-2 rounded-lg text-sm border transition-all',
                    daysDefault === d
                      ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                      : 'border-border bg-muted/20 text-muted-foreground hover:bg-muted/40'
                  )}
                >
                  {d} dias
                </button>
              ))}
              <div className="flex items-center gap-2">
                <Input
                  type="number" min={1}
                  value={![7, 15, 30].includes(daysDefault) ? daysDefault : ''}
                  onChange={(e) => setDaysDefault(parseInt(e.target.value) || 7)}
                  placeholder="Outro"
                  className="w-24 h-9 text-sm text-center font-mono"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <Button onClick={handleSave} disabled={saving} className="w-full sm:w-auto">
        {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
        Salvar configuração
      </Button>
    </div>
  )
}

// ─── Aba Trials ativos ────────────────────────────────────────────────────────

function TrialsTab() {
  const [trials, setTrials] = useState<TrialRecord[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/trial/list')
      .then((r) => r.json())
      .then((d) => setTrials(d.trials ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) return (
    <div className="flex items-center justify-center h-48">
      <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
    </div>
  )

  if (!trials.length) return (
    <div className="flex flex-col items-center justify-center py-20 gap-4 rounded-xl border border-dashed border-border">
      <Users className="w-10 h-10 text-muted-foreground/30" />
      <div className="text-center space-y-1">
        <p className="text-sm font-medium text-muted-foreground">Nenhum trial ativo</p>
        <p className="text-xs text-muted-foreground">Os cadastros aparecerão aqui após o primeiro formulário enviado</p>
      </div>
    </div>
  )

  return (
    <div className="rounded-xl border border-border overflow-hidden">
      <div className="px-4 py-3 bg-muted/20 border-b border-border flex items-center justify-between">
        <p className="text-sm font-medium">Trials ativos</p>
        <Badge variant="secondary">{trials.length}</Badge>
      </div>
      <div className="divide-y divide-border">
        {trials.map((trial) => {
          const daysGone = Math.floor((Date.now() - new Date(trial.criado_em).getTime()) / 86_400_000)
          const daysLeft = Math.max(0, (trial.trial_days ?? 7) - daysGone)
          const pct = Math.min(100, Math.round((daysGone / (trial.trial_days ?? 7)) * 100))
          return (
            <div key={trial.id} className="flex items-center gap-4 px-4 py-3">
              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium truncate">{trial.nome}</span>
                  <Badge
                    variant="outline"
                    className={cn(
                      'text-xs shrink-0',
                      daysLeft <= 1 ? 'border-red-500/30 text-red-600 bg-red-500/5' :
                      daysLeft <= 3 ? 'border-amber-500/30 text-amber-600 bg-amber-500/5' :
                      'border-emerald-500/30 text-emerald-600 bg-emerald-500/5'
                    )}
                  >
                    {daysLeft === 0 ? 'Expira hoje' : `${daysLeft}d restantes`}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground truncate">{trial.email} · {trial.whatsapp}</p>
                <div className="flex items-center gap-2 pt-0.5">
                  <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className={cn('h-full rounded-full transition-all',
                        pct >= 80 ? 'bg-red-500' : pct >= 60 ? 'bg-amber-500' : 'bg-emerald-500'
                      )}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-muted-foreground shrink-0">Dia {daysGone}/{trial.trial_days}</span>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Página ───────────────────────────────────────────────────────────────────

type TabId = 'config' | 'sequences' | 'trials'

export default function TrialPage() {
  const [activeTab, setActiveTab] = useState<TabId>('config')
  const [sequences, setSequences] = useState<TrialSequence[]>([])
  const [loadingSeqs, setLoadingSeqs] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<TrialSequence | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [form, setForm] = useState(DEFAULT_FORM())

  const loadSequences = useCallback(async () => {
    try {
      const res = await fetch('/api/follow/sequences')
      const data = await res.json()
      const trialSeqs = (data.sequences ?? []).filter((s: any) => s.tipo === 'trial_saas')
      setSequences(trialSeqs)
    } catch {
      toast({ title: 'Erro ao carregar sequências', variant: 'destructive' })
    } finally {
      setLoadingSeqs(false)
    }
  }, [])

  useEffect(() => { loadSequences() }, [loadSequences])

  function openNew() {
    setEditing(null)
    setForm(DEFAULT_FORM())
    setDialogOpen(true)
  }

  function openEdit(seq: TrialSequence) {
    setEditing(seq)
    setForm({
      nome: seq.nome,
      ativo: seq.ativo,
      steps: seq.follow_steps.length > 0
        ? seq.follow_steps.map((s) => ({
            ...s,
            mensagem: s.mensagem ?? '',
            pool_mensagens: s.pool_mensagens ?? [],
            tipo_mensagem: s.tipo_mensagem ?? 'text',
            media_config: s.media_config ?? {},
          }))
        : [EMPTY_STEP()],
    })
    setDialogOpen(true)
  }

  function updateStep(i: number, patch: Partial<TrialStep>) {
    setForm((prev) => ({
      ...prev,
      steps: prev.steps.map((s, idx) => idx === i ? { ...s, ...patch } : s),
    }))
  }

  function addStep() {
    setForm((prev) => {
      const last = prev.steps[prev.steps.length - 1]
      const nextOffset = (last?.dia_offset ?? 0) === 0 ? 3 : (last?.dia_offset ?? 0) + 2
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
        tipo: 'trial_saas',
        ativo: form.ativo,
        steps: form.steps.map((s, i) => ({
          ...s,
          ordem: i,
          mensagem: s.mensagem || null,
          pool_mensagens: [],
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

      toast({ title: editing ? 'Sequência atualizada!' : 'Sequência criada!' })
      setDialogOpen(false)
      loadSequences()
    } catch (err: any) {
      toast({ title: err.message || 'Erro ao salvar', variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  async function handleToggle(seq: TrialSequence) {
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
      toast({ title: 'Sequência removida' })
    } catch {
      toast({ title: 'Erro ao remover', variant: 'destructive' })
    } finally {
      setDeleting(null)
    }
  }

  const TABS = [
    { id: 'config' as TabId,    label: 'Configurações', icon: Settings2 },
    { id: 'sequences' as TabId, label: 'Sequências',    icon: ListChecks, count: sequences.length },
    { id: 'trials' as TabId,    label: 'Trials ativos', icon: Users },
  ]

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Trial SaaS</h1>
          <p className="text-sm text-muted-foreground">Automação de onboarding e acompanhamento do período de teste</p>
        </div>
        {activeTab === 'sequences' && (
          <Button onClick={openNew}>
            <Plus className="w-4 h-4 mr-2" /> Nova sequência
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
            {count !== undefined && count > 0 && (
              <span className={cn(
                'text-xs px-1.5 py-0.5 rounded-full min-w-[18px] text-center leading-none',
                activeTab === id ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
              )}>{count}</span>
            )}
          </button>
        ))}
      </div>

      {/* Conteúdo */}
      {activeTab === 'config' && <ConfigTab />}
      {activeTab === 'trials' && <TrialsTab />}

      {activeTab === 'sequences' && (
        loadingSeqs ? (
          <div className="flex items-center justify-center h-48">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : sequences.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-4 rounded-xl border border-dashed border-border">
            <ListChecks className="w-10 h-10 text-muted-foreground/30" />
            <div className="text-center space-y-1">
              <p className="text-sm font-medium text-muted-foreground">Nenhuma sequência configurada</p>
              <p className="text-xs text-muted-foreground">
                Crie uma sequência com boas-vindas, acompanhamento e mensagem de conversão
              </p>
            </div>
            <Button onClick={openNew} size="sm">
              <Plus className="w-4 h-4 mr-2" /> Criar sequência
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {sequences.map((seq) => (
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
              {editing ? 'Editar sequência' : 'Nova sequência de trial'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-5 py-1">
            {/* Nome + ativo */}
            <div className="flex items-end gap-4">
              <div className="flex-1 space-y-1.5">
                <Label>Nome *</Label>
                <Input
                  value={form.nome}
                  onChange={(e) => setForm((p) => ({ ...p, nome: e.target.value }))}
                  placeholder="Ex: Trial 7 dias"
                />
              </div>
              <div className="flex items-center gap-3 pb-1">
                <Switch checked={form.ativo} onCheckedChange={(v) => setForm((p) => ({ ...p, ativo: v }))} />
                <span className="text-sm text-muted-foreground">Ativa</span>
              </div>
            </div>

            {/* Info */}
            <div className="flex items-start gap-3 p-3 rounded-xl border border-border bg-muted/20">
              <Info className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
              <p className="text-xs text-muted-foreground">
                O passo com <strong>dia 0</strong> é enviado imediatamente após o cadastro no formulário.
                Os demais são enviados via cron diário conforme o dia do trial.
              </p>
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
                <TrialStepEditor
                  key={i}
                  step={step}
                  index={i}
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
              {editing ? 'Salvar alterações' : 'Criar sequência'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
