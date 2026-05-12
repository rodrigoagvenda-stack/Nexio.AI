'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { toast } from '@/components/ui/use-toast'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils/cn'
import {
  Plus, Trash2, Loader2, Copy, Check, Webhook, Settings2, ListChecks,
  Users, Pencil, Clock, CalendarDays, Info, Image, Video, FileAudio,
  FileText, MapPin, LayoutList, Rows3, Mic, ChevronLeft, ChevronRight,
  Phone, MessageSquare, X, Square,
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

type StepTipo = 'text' | 'image' | 'video' | 'audio' | 'ptt' | 'document' | 'menu' | 'carousel' | 'location'

interface MediaConfig {
  file?: string; text?: string; docName?: string; viewOnce?: boolean
  menuType?: 'button' | 'list' | 'poll'; choices?: string[]
  carousel?: { text: string; image?: string }[]
  name?: string; address?: string; latitude?: number; longitude?: number
}

interface TrialStep {
  id?: string; dia_offset: number; horario: string; mensagem: string
  tipo_mensagem: StepTipo; media_config: MediaConfig; ordem: number
}

interface TrialSequence {
  id: string; nome: string; ativo: boolean; follow_steps: TrialStep[]
}

interface TrialRecord {
  id: number; nome: string; email: string; whatsapp: string
  status: string; criado_em: string; trial_days: number
}

interface TrialConfig {
  webhook_token: string; trial_days_options: number[]; trial_days_default: number
}

// ─── Tipo msg config ──────────────────────────────────────────────────────────

const TIPO_MSG: Record<StepTipo, { label: string; icon: React.FC<{ className?: string }>; color: string }> = {
  text:     { label: 'Texto',       icon: MessageSquare, color: 'text-blue-500'   },
  image:    { label: 'Imagem',      icon: Image,         color: 'text-emerald-500' },
  video:    { label: 'Vídeo',       icon: Video,         color: 'text-purple-500'  },
  audio:    { label: 'Áudio',       icon: FileAudio,     color: 'text-orange-500'  },
  ptt:      { label: 'PTT',         icon: Mic,           color: 'text-rose-500'    },
  document: { label: 'Documento',   icon: FileText,      color: 'text-amber-500'   },
  menu:     { label: 'Menu',        icon: LayoutList,    color: 'text-sky-500'     },
  carousel: { label: 'Carrossel',   icon: Rows3,         color: 'text-violet-500'  },
  location: { label: 'Localização', icon: MapPin,        color: 'text-teal-500'    },
}

const EMPTY_STEP = (): TrialStep => ({ dia_offset: 0, horario: '09:00', mensagem: '', tipo_mensagem: 'text', media_config: {}, ordem: 0 })

// ─── Upload Zone ──────────────────────────────────────────────────────────────

function UploadZone({ accept, label, icon: Icon, current, currentName, onUpload }: {
  accept: string; label: string; icon: React.FC<{ className?: string }>
  current?: string; currentName?: string
  onUpload: (url: string, name: string) => void
}) {
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)

  async function handleFile(file: File) {
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/follow/upload', { method: 'POST', body: fd })
      const data = await res.json()
      if (res.ok) onUpload(data.url, data.name ?? file.name)
      else toast({ title: data.error ?? 'Erro no upload', variant: 'destructive' })
    } finally { setUploading(false) }
  }

  function openPicker() {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = accept
    input.onchange = (e) => { const f = (e.target as HTMLInputElement).files?.[0]; if (f) handleFile(f) }
    input.click()
  }

  return (
    <div
      onClick={!uploading ? openPicker : undefined}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f && !uploading) handleFile(f) }}
      className={cn(
        'border-2 border-dashed rounded-xl p-4 text-center transition-all select-none',
        !uploading && 'cursor-pointer',
        dragOver ? 'border-primary bg-primary/5 scale-[1.01]' : 'border-border hover:border-primary/50 hover:bg-muted/20',
        uploading && 'opacity-60 pointer-events-none',
      )}
    >
      {uploading ? (
        <div className="flex flex-col items-center gap-2 py-1">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          <span className="text-xs text-muted-foreground">Enviando…</span>
        </div>
      ) : current ? (
        <div className="flex items-center gap-2 justify-center py-1">
          <Icon className="w-4 h-4 text-emerald-500 shrink-0" />
          <span className="text-xs text-emerald-600 truncate max-w-[160px]">{currentName || 'Arquivo enviado'}</span>
          <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
        </div>
      ) : (
        <div className="flex flex-col items-center gap-1.5 py-1">
          <Icon className="w-5 h-5 text-muted-foreground/50" />
          <span className="text-xs text-muted-foreground font-medium">{label}</span>
          <span className="text-[10px] text-muted-foreground/60">Clique ou arraste aqui</span>
        </div>
      )}
    </div>
  )
}

// ─── Audio Recorder ───────────────────────────────────────────────────────────

function AudioRecorder({ onUpload, current }: { onUpload: (url: string) => void; current?: string }) {
  const [recording, setRecording] = useState(false)
  const [seconds, setSeconds] = useState(0)
  const [uploading, setUploading] = useState(false)
  const mrRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  async function start() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mr = new MediaRecorder(stream)
      chunksRef.current = []
      mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      mr.onstop = async () => {
        setUploading(true)
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        const file = new File([blob], `audio-${Date.now()}.webm`, { type: 'audio/webm' })
        const fd = new FormData()
        fd.append('file', file)
        try {
          const res = await fetch('/api/follow/upload', { method: 'POST', body: fd })
          const data = await res.json()
          if (res.ok) onUpload(data.url)
          else toast({ title: data.error ?? 'Erro no upload', variant: 'destructive' })
        } finally { setUploading(false) }
        stream.getTracks().forEach((t) => t.stop())
      }
      mr.start()
      mrRef.current = mr
      setRecording(true)
      setSeconds(0)
      timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000)
    } catch { toast({ title: 'Permissão de microfone negada', variant: 'destructive' }) }
  }

  function stop() {
    mrRef.current?.stop()
    if (timerRef.current) clearInterval(timerRef.current)
    setRecording(false)
  }

  const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`

  return (
    <div className="space-y-2">
      {recording ? (
        <div className="flex items-center gap-3 p-3 rounded-xl border border-red-500/30 bg-red-500/5">
          <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse shrink-0" />
          <span className="font-mono text-sm text-red-500 flex-1">{fmt(seconds)}</span>
          <Button size="sm" variant="destructive" onClick={stop} className="h-7 gap-1.5 text-xs shrink-0">
            <Square className="w-3 h-3" /> Parar
          </Button>
        </div>
      ) : uploading ? (
        <div className="flex items-center gap-2 p-3 rounded-xl border border-border bg-muted/20">
          <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
          <span className="text-xs text-muted-foreground">Enviando áudio…</span>
        </div>
      ) : (
        <Button variant="outline" onClick={start} className="w-full h-9 gap-2">
          <Mic className="w-3.5 h-3.5 text-rose-500" />
          {current ? 'Regravar áudio' : 'Gravar áudio'}
        </Button>
      )}
      {current && !recording && !uploading && (
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
          <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
          <span className="text-xs text-emerald-600">Áudio gravado com sucesso</span>
        </div>
      )}
    </div>
  )
}

// ─── WhatsApp Preview ─────────────────────────────────────────────────────────

function WaPreview({ step }: { step: TrialStep }) {
  const { tipo_mensagem: tipo, mensagem, media_config: media } = step
  const text = mensagem || (tipo === 'text' ? 'Sua mensagem aparecerá aqui…' : '')

  return (
    <div className="bg-[#0b141a] flex flex-col" style={{ minHeight: 260 }}>
      <div className="flex items-center gap-2.5 px-3 py-2.5 bg-[#202c33]">
        <div className="w-7 h-7 rounded-full bg-[#3a4a54] flex items-center justify-center shrink-0">
          <Phone className="w-3.5 h-3.5 text-[#8696a0]" />
        </div>
        <div>
          <p className="text-[11px] font-medium text-[#e9edef]">Lead</p>
          <p className="text-[10px] text-[#8696a0]">online</p>
        </div>
      </div>
      <div className="flex-1 p-3 flex flex-col justify-end">
        <div className="flex justify-end">
          <div className="bg-[#005c4b] rounded-xl rounded-tr-sm px-3 py-2 max-w-[88%] space-y-1.5 shadow">
            {tipo === 'image' && (
              <div className="w-full h-24 rounded-lg overflow-hidden bg-[#007a62] flex items-center justify-center">
                {media.file ? <img src={media.file} className="h-full w-full object-cover" alt="" /> : <Image className="w-6 h-6 text-[#00a884]/60" />}
              </div>
            )}
            {tipo === 'video' && (
              <div className="w-full h-24 rounded-lg bg-[#007a62] flex items-center justify-center gap-2">
                <Video className="w-6 h-6 text-[#00a884]/60" />
                <span className="text-[10px] text-[#cfe9e5]">Vídeo</span>
              </div>
            )}
            {(tipo === 'audio' || tipo === 'ptt') && (
              <div className="flex items-center gap-2 py-1">
                <div className="w-6 h-6 rounded-full bg-[#00a884] flex items-center justify-center shrink-0">
                  <Mic className="w-3 h-3 text-white" />
                </div>
                <div className="flex-1 h-1.5 rounded-full bg-[#00a884]/40">
                  <div className="h-full w-[55%] bg-[#00a884] rounded-full" />
                </div>
                <span className="text-[10px] text-[#8696a0]">0:12</span>
              </div>
            )}
            {tipo === 'document' && (
              <div className="flex items-center gap-2 py-0.5">
                <div className="w-7 h-7 rounded-lg bg-[#00a884]/30 flex items-center justify-center shrink-0">
                  <FileText className="w-3.5 h-3.5 text-[#00a884]" />
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] text-[#e9edef] truncate">{media.docName || 'documento.pdf'}</p>
                  <p className="text-[10px] text-[#8696a0]">PDF</p>
                </div>
              </div>
            )}
            {tipo === 'location' && (
              <div className="w-full h-20 rounded-lg bg-[#007a62] flex flex-col items-center justify-center gap-1">
                <MapPin className="w-5 h-5 text-[#00a884]" />
                <p className="text-[10px] text-[#cfe9e5]">{media.name || 'Local'}</p>
              </div>
            )}
            {tipo === 'menu' && (
              <div className="space-y-1.5">
                {text && <p className="text-[12px] text-[#e9edef] leading-relaxed whitespace-pre-wrap">{text}</p>}
                <div className="space-y-1 pt-1">
                  {(media.choices ?? ['Opção 1', 'Opção 2']).slice(0, 3).map((c, i) => (
                    <div key={i} className="text-center text-[11px] text-[#53bdeb] border border-[#2a3942] rounded-lg py-1.5">
                      {c || `Opção ${i + 1}`}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {tipo !== 'menu' && text && (
              <p className="text-[12px] text-[#e9edef] leading-relaxed whitespace-pre-wrap">{text}</p>
            )}
            <div className="flex justify-end">
              <span className="text-[10px] text-[#8696a0]">agora ✓✓</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function PhoneMockup({ step }: { step: TrialStep }) {
  return (
    <div className="rounded-[36px] bg-[#18181b] p-[5px] shadow-2xl ring-1 ring-white/10 shrink-0">
      <div className="rounded-[31px] overflow-hidden" style={{ width: 200 }}>
        <div className="bg-[#18181b] h-5 flex items-center justify-center">
          <div className="w-12 h-1.5 rounded-full bg-black/60" />
        </div>
        <WaPreview step={step} />
        <div className="bg-[#0b141a] h-4 flex items-end justify-center pb-1">
          <div className="w-14 h-[3px] rounded-full bg-white/20" />
        </div>
      </div>
    </div>
  )
}

// ─── Media editor ─────────────────────────────────────────────────────────────

function MediaEditor({ tipo, config, onChange }: { tipo: StepTipo; config: MediaConfig; onChange: (p: Partial<MediaConfig>) => void }) {
  if (tipo === 'text') return null

  if (tipo === 'image') {
    return (
      <div className="space-y-3">
        <UploadZone accept="image/*" label="Enviar imagem" icon={Image}
          current={config.file} currentName={config.file ? 'Imagem enviada' : undefined}
          onUpload={(url) => onChange({ file: url })} />
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Legenda (opcional)</Label>
          <Input value={config.text ?? ''} onChange={(e) => onChange({ text: e.target.value })} placeholder="Legenda…" className="h-9 text-sm" />
        </div>
      </div>
    )
  }

  if (tipo === 'video') {
    return (
      <div className="space-y-3">
        <UploadZone accept="video/*" label="Enviar vídeo" icon={Video}
          current={config.file} currentName={config.file ? 'Vídeo enviado' : undefined}
          onUpload={(url) => onChange({ file: url })} />
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Legenda (opcional)</Label>
          <Input value={config.text ?? ''} onChange={(e) => onChange({ text: e.target.value })} placeholder="Legenda…" className="h-9 text-sm" />
        </div>
      </div>
    )
  }

  if (tipo === 'document') {
    return (
      <UploadZone accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip,.csv" label="Enviar documento" icon={FileText}
        current={config.file} currentName={config.docName}
        onUpload={(url, name) => onChange({ file: url, docName: name })} />
    )
  }

  if (tipo === 'audio' || tipo === 'ptt') {
    return (
      <div className="space-y-3">
        <AudioRecorder current={config.file} onUpload={(url) => onChange({ file: url })} />
        <div className="relative">
          <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border" /></div>
          <div className="relative flex justify-center"><span className="bg-background px-2 text-[10px] text-muted-foreground">ou enviar arquivo</span></div>
        </div>
        <UploadZone accept="audio/*" label="Enviar arquivo de áudio" icon={FileAudio}
          current={config.file} currentName={config.file ? 'Áudio enviado' : undefined}
          onUpload={(url) => onChange({ file: url })} />
      </div>
    )
  }

  if (tipo === 'menu') {
    const choices = config.choices ?? []
    return (
      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Tipo</Label>
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
            <Button type="button" variant="ghost" size="sm" className="h-6 text-xs px-2" onClick={() => onChange({ choices: [...choices, ''] })}>
              <Plus className="w-3 h-3 mr-1" /> Adicionar
            </Button>
          </div>
          {choices.map((c, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className="w-5 h-5 rounded bg-muted flex items-center justify-center text-[10px] text-muted-foreground shrink-0">{i + 1}</div>
              <Input value={c} onChange={(e) => { const n = [...choices]; n[i] = e.target.value; onChange({ choices: n }) }} placeholder={`Opção ${i + 1}`} className="h-8 text-sm" />
              <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-destructive hover:text-destructive" onClick={() => onChange({ choices: choices.filter((_, idx) => idx !== i) })}>
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (tipo === 'location') {
    return (
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2 space-y-1.5">
          <Label className="text-xs text-muted-foreground">Nome do local</Label>
          <Input value={config.name ?? ''} onChange={(e) => onChange({ name: e.target.value })} className="h-9 text-sm" placeholder="Escritório" />
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

// ─── Step editor (flat) ───────────────────────────────────────────────────────

function TrialStepEditor({ step, index, onChange }: {
  step: TrialStep; index: number
  onChange: (p: Partial<TrialStep>) => void
}) {
  const needsText = ['text', 'menu', 'carousel'].includes(step.tipo_mensagem)
  return (
    <div className="space-y-4">
      {/* Timing */}
      <div className="space-y-2">
        <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Quando enviar</Label>
        {step.dia_offset === 0 ? (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/5 border border-primary/20 text-sm font-medium text-primary w-fit">
            <Clock className="w-3.5 h-3.5" /> Imediatamente após cadastro
          </div>
        ) : (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm text-muted-foreground">Dia</span>
            <Input type="number" min={1} value={step.dia_offset} onChange={(e) => onChange({ dia_offset: parseInt(e.target.value) || 1 })} className="w-20 h-9 text-sm text-center font-mono" />
            <span className="text-sm text-muted-foreground">do trial, às</span>
            <Input type="time" value={step.horario} onChange={(e) => onChange({ horario: e.target.value })} className="w-28 h-9 text-sm font-mono" />
          </div>
        )}
      </div>

      {/* Tipo */}
      <div className="space-y-2">
        <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Tipo de mensagem</Label>
        <div className="grid grid-cols-3 gap-1.5">
          {(Object.entries(TIPO_MSG) as [StepTipo, typeof TIPO_MSG[StepTipo]][]).map(([key, cfg]) => {
            const Icon = cfg.icon
            return (
              <button key={key} type="button" onClick={() => onChange({ tipo_mensagem: key, media_config: {} })}
                className={cn('flex items-center gap-1.5 p-2 rounded-lg border text-xs transition-all',
                  step.tipo_mensagem === key ? 'border-primary/40 bg-primary/5 text-primary' : 'border-border bg-muted/20 text-muted-foreground hover:bg-muted/40')}>
                <Icon className={cn('w-3.5 h-3.5 shrink-0', step.tipo_mensagem === key ? 'text-primary' : cfg.color)} />
                <span>{cfg.label}</span>
              </button>
            )
          })}
        </div>
      </div>

      {needsText && (
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            {step.tipo_mensagem === 'text' ? 'Mensagem' : 'Texto introdutório'}
          </Label>
          <Textarea value={step.mensagem} onChange={(e) => onChange({ mensagem: e.target.value })}
            placeholder={`Olá, {nome}! ${index === 0 ? 'Bem-vindo ao trial! 🎉' : 'Como está sendo sua experiência?'}`}
            className="min-h-[72px] text-sm resize-none" />
        </div>
      )}

      {step.tipo_mensagem !== 'text' && (
        <MediaEditor tipo={step.tipo_mensagem} config={step.media_config}
          onChange={(patch) => onChange({ media_config: { ...step.media_config, ...patch } })} />
      )}
    </div>
  )
}

// ─── Sequence card ────────────────────────────────────────────────────────────

function SequenceCard({ seq, onToggle, onEdit, onDelete, deleting }: {
  seq: TrialSequence; onToggle: () => void; onEdit: () => void; onDelete: () => void; deleting: boolean
}) {
  return (
    <div className={cn('rounded-xl border border-border p-4 transition-opacity', !seq.ativo && 'opacity-55')}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-sm">{seq.nome}</h3>
            {!seq.ativo && <Badge variant="secondary" className="text-xs">Inativa</Badge>}
          </div>
          {seq.follow_steps.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              {seq.follow_steps.map((step, i) => {
                const TipoIcon = TIPO_MSG[step.tipo_mensagem ?? 'text']?.icon ?? MessageSquare
                return (
                  <div key={step.id ?? i} className="flex items-center gap-1">
                    {i > 0 && <ChevronRight className="w-3 h-3 text-muted-foreground/40" />}
                    <div className="flex items-center gap-1.5 text-xs bg-muted/60 border border-border rounded-lg px-2.5 py-1">
                      <TipoIcon className={cn('w-3 h-3', TIPO_MSG[step.tipo_mensagem ?? 'text']?.color)} />
                      <span className="font-medium">{step.dia_offset === 0 ? 'D0' : `D${step.dia_offset}`}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <Switch checked={seq.ativo} onCheckedChange={onToggle} />
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onEdit}><Pencil className="w-3.5 h-3.5" /></Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={onDelete} disabled={deleting}>
            {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
          </Button>
        </div>
      </div>
    </div>
  )
}

// ─── Calendar de trials ───────────────────────────────────────────────────────

const MONTH_NAMES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
const DAY_NAMES = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

function TrialCalendar({ trials }: { trials: TrialRecord[] }) {
  const [current, setCurrent] = useState(() => { const d = new Date(); d.setDate(1); return d })
  const [selected, setSelected] = useState<TrialRecord | null>(null)

  const year = current.getFullYear()
  const month = current.getMonth()
  const firstDow = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  const byDay = new Map<string, TrialRecord[]>()
  for (const t of trials) {
    const exp = new Date(new Date(t.criado_em).getTime() + (t.trial_days ?? 7) * 86_400_000)
    const key = `${exp.getFullYear()}-${exp.getMonth()}-${exp.getDate()}`
    if (!byDay.has(key)) byDay.set(key, [])
    byDay.get(key)!.push(t)
  }

  const today = new Date()

  function trialColor(trial: TrialRecord) {
    const exp = new Date(new Date(trial.criado_em).getTime() + (trial.trial_days ?? 7) * 86_400_000)
    const daysLeft = Math.ceil((exp.getTime() - Date.now()) / 86_400_000)
    if (daysLeft < 0) return 'bg-muted text-muted-foreground'
    if (daysLeft <= 2) return 'bg-red-500/20 text-red-600 border-red-500/30 dark:text-red-400'
    if (daysLeft <= 5) return 'bg-amber-500/20 text-amber-600 border-amber-500/30 dark:text-amber-400'
    return 'bg-emerald-500/20 text-emerald-600 border-emerald-500/30 dark:text-emerald-400'
  }

  const cells: (null | number)[] = []
  for (let i = 0; i < firstDow; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)

  // Trial detail dialog
  const trialDetailInfo = selected ? (() => {
    const exp = new Date(new Date(selected.criado_em).getTime() + (selected.trial_days ?? 7) * 86_400_000)
    const daysLeft = Math.ceil((exp.getTime() - Date.now()) / 86_400_000)
    const daysGone = (selected.trial_days ?? 7) - Math.max(0, daysLeft)
    const expired = daysLeft < 0
    return { exp, daysLeft, daysGone, expired }
  })() : null

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm">{MONTH_NAMES[month]} {year}</h3>
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setCurrent(new Date(year, month - 1, 1))}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setCurrent(new Date(year, month + 1, 1))}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-px bg-border rounded-xl overflow-hidden">
        {DAY_NAMES.map((d) => (
          <div key={d} className="bg-muted/40 text-center py-2 text-[11px] font-medium text-muted-foreground">{d}</div>
        ))}
        {cells.map((day, i) => {
          if (!day) return <div key={`empty-${i}`} className="bg-background min-h-[72px]" />
          const key = `${year}-${month}-${day}`
          const dayTrials = byDay.get(key) ?? []
          const isToday = today.getFullYear() === year && today.getMonth() === month && today.getDate() === day
          return (
            <div key={day} className={cn('bg-background min-h-[72px] p-1.5 space-y-1', isToday && 'bg-primary/5')}>
              <div className={cn('text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full', isToday ? 'bg-primary text-primary-foreground' : 'text-muted-foreground')}>
                {day}
              </div>
              {dayTrials.slice(0, 3).map((trial) => (
                <button key={trial.id} onClick={() => setSelected(trial)}
                  className={cn('w-full text-left text-[10px] px-1.5 py-0.5 rounded border truncate transition-all hover:opacity-80', trialColor(trial))}>
                  {trial.nome.split(' ')[0]}
                </button>
              ))}
              {dayTrials.length > 3 && <p className="text-[10px] text-muted-foreground text-center">+{dayTrials.length - 3}</p>}
            </div>
          )
        })}
      </div>

      <div className="flex items-center gap-4 text-[11px] text-muted-foreground">
        <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-sm bg-emerald-500/20 border border-emerald-500/30" /> &gt;5 dias</div>
        <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-sm bg-amber-500/20 border border-amber-500/30" /> 2-5 dias</div>
        <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-sm bg-red-500/20 border border-red-500/30" /> &lt;2 dias</div>
        <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-sm bg-muted border border-border" /> Expirado</div>
      </div>

      {/* Trial detail dialog */}
      <Dialog open={!!selected} onOpenChange={(open) => { if (!open) setSelected(null) }}>
        <DialogContent className="max-w-sm">
          {selected && trialDetailInfo && (
            <>
              <DialogHeader>
                <DialogTitle className="text-base">{selected.nome}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">{selected.email}</p>
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge className={cn('text-xs border',
                    trialDetailInfo.expired ? 'bg-muted text-muted-foreground border-border'
                    : trialDetailInfo.daysLeft <= 2 ? 'bg-red-500/10 text-red-600 border-red-500/20'
                    : trialDetailInfo.daysLeft <= 5 ? 'bg-amber-500/10 text-amber-600 border-amber-500/20'
                    : 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20')}>
                    {trialDetailInfo.expired ? 'Expirado' : trialDetailInfo.daysLeft === 0 ? 'Expira hoje' : `${trialDetailInfo.daysLeft} dias restantes`}
                  </Badge>
                  <span className="text-xs text-muted-foreground">Trial de {selected.trial_days ?? 7} dias</span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div className={cn('h-full rounded-full transition-all',
                    trialDetailInfo.expired ? 'bg-muted-foreground'
                    : trialDetailInfo.daysLeft <= 2 ? 'bg-red-500'
                    : trialDetailInfo.daysLeft <= 5 ? 'bg-amber-500' : 'bg-emerald-500')}
                    style={{ width: `${Math.min(100, Math.round((trialDetailInfo.daysGone / (selected.trial_days ?? 7)) * 100))}%` }} />
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                  <div><span className="font-medium">WhatsApp: </span>{selected.whatsapp}</div>
                  <div><span className="font-medium">Cadastro: </span>{new Date(selected.criado_em).toLocaleDateString('pt-BR')}</div>
                  <div><span className="font-medium">Expiração: </span>{trialDetailInfo.exp.toLocaleDateString('pt-BR')}</div>
                  <div><span className="font-medium">Progresso: </span>{Math.max(0, trialDetailInfo.daysGone)}/{selected.trial_days ?? 7} dias</div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setSelected(null)}>Fechar</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ─── Aba Configurações ────────────────────────────────────────────────────────

function ConfigContent() {
  const [config, setConfig] = useState<TrialConfig | null>(null)
  const [webhookUrl, setWebhookUrl] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [copied, setCopied] = useState(false)
  const [daysDefault, setDaysDefault] = useState(7)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/trial/config')
      if (res.ok) {
        const data = await res.json()
        setConfig(data.config)
        setWebhookUrl(data.webhookUrl ?? '')
        if (data.config) setDaysDefault(data.config.trial_days_default ?? 7)
      }
    } finally { setLoading(false) }
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
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trial_days_options: [7, 15, 30], trial_days_default: daysDefault }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setWebhookUrl(data.webhookUrl)
      setConfig(data.config)
      toast({ title: 'Configuração salva!' })
    } catch (err: any) {
      toast({ title: err.message, variant: 'destructive' })
    } finally { setSaving(false) }
  }

  if (loading) return <div className="flex items-center justify-center h-48"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>

  return (
    <div className="space-y-5">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Webhook className="w-3.5 h-3.5 text-muted-foreground" />
          <p className="text-sm font-semibold">URL do Webhook</p>
        </div>
        <p className="text-xs text-muted-foreground mb-3">Configure esta URL no seu formulário de cadastro. Ela receberá os dados de cada novo trial.</p>
        {webhookUrl ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Input value={webhookUrl} readOnly className="h-9 text-sm font-mono bg-muted/40 text-muted-foreground" />
              <Button variant="outline" size="icon" className="h-9 w-9 shrink-0" onClick={handleCopy}>
                {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
              </Button>
            </div>
            <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-muted/40 border border-border">
              <Info className="w-3.5 h-3.5 text-muted-foreground mt-0.5 shrink-0" />
              <p className="text-xs text-muted-foreground">
                Envie <code className="bg-muted px-1 py-0.5 rounded text-[11px]">POST</code> com{' '}
                <code className="bg-muted px-1 py-0.5 rounded text-[11px]">{`{ "name", "email", "whatsapp" }`}</code>
              </p>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Salve a configuração para gerar sua URL.</p>
        )}
      </div>

      <div>
        <div className="flex items-center gap-2 mb-1">
          <CalendarDays className="w-3.5 h-3.5 text-muted-foreground" />
          <p className="text-sm font-semibold">Duração padrão do trial</p>
        </div>
        <p className="text-xs text-muted-foreground mb-3">Quantos dias de teste gratuito cada usuário terá por padrão.</p>
        <div className="flex gap-2 flex-wrap">
          {[7, 15, 30].map((d) => (
            <button key={d} type="button" onClick={() => setDaysDefault(d)}
              className={cn('px-4 py-2 rounded-lg text-sm border transition-all', daysDefault === d ? 'bg-primary text-primary-foreground border-primary shadow-sm' : 'border-border bg-muted/20 text-muted-foreground hover:bg-muted/40')}>
              {d} dias
            </button>
          ))}
          <Input type="number" min={1} value={![7, 15, 30].includes(daysDefault) ? daysDefault : ''} onChange={(e) => setDaysDefault(parseInt(e.target.value) || 7)}
            placeholder="Outro" className="w-24 h-9 text-sm text-center font-mono" />
        </div>
      </div>

      <Button onClick={handleSave} disabled={saving} size="sm" className="gap-1.5">
        {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
        Salvar configuração
      </Button>
    </div>
  )
}

// ─── Página ───────────────────────────────────────────────────────────────────

type ActiveTab = 'config' | 'sequences' | 'trials'

export default function TrialPage() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('config')
  const [sequences, setSequences] = useState<TrialSequence[]>([])
  const [trials, setTrials] = useState<TrialRecord[]>([])
  const [loadingSeqs, setLoadingSeqs] = useState(true)
  const [loadingTrials, setLoadingTrials] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<TrialSequence | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [activeStep, setActiveStep] = useState(0)
  const [form, setForm] = useState<{ nome: string; ativo: boolean; steps: TrialStep[] }>({
    nome: '', ativo: true, steps: [EMPTY_STEP()],
  })

  const loadSequences = useCallback(async () => {
    try {
      const res = await fetch('/api/follow/sequences')
      const data = await res.json()
      setSequences((data.sequences ?? []).filter((s: any) => s.tipo === 'trial_saas'))
    } catch { toast({ title: 'Erro ao carregar sequências', variant: 'destructive' }) }
    finally { setLoadingSeqs(false) }
  }, [])

  const loadTrials = useCallback(async () => {
    try {
      const res = await fetch('/api/trial/list')
      if (res.ok) { const d = await res.json(); setTrials(d.trials ?? []) }
    } finally { setLoadingTrials(false) }
  }, [])

  useEffect(() => { loadSequences() }, [loadSequences])
  useEffect(() => { if (activeTab === 'trials') loadTrials() }, [activeTab, loadTrials])

  function openNew() {
    setEditing(null)
    setForm({ nome: '', ativo: true, steps: [EMPTY_STEP()] })
    setActiveStep(0)
    setDialogOpen(true)
  }

  function openEdit(seq: TrialSequence) {
    setEditing(seq)
    setForm({
      nome: seq.nome, ativo: seq.ativo,
      steps: seq.follow_steps.length > 0
        ? seq.follow_steps.map((s) => ({ ...s, mensagem: s.mensagem ?? '', tipo_mensagem: s.tipo_mensagem ?? 'text', media_config: s.media_config ?? {} }))
        : [EMPTY_STEP()],
    })
    setActiveStep(0)
    setDialogOpen(true)
  }

  function updateStep(patch: Partial<TrialStep>) {
    setForm((prev) => ({ ...prev, steps: prev.steps.map((s, idx) => idx === activeStep ? { ...s, ...patch } : s) }))
  }

  function addStep() {
    setForm((prev) => {
      const last = prev.steps[prev.steps.length - 1]
      const nextOffset = (last?.dia_offset ?? 0) === 0 ? 3 : (last?.dia_offset ?? 0) + 2
      const newIdx = prev.steps.length
      setTimeout(() => setActiveStep(newIdx), 0)
      return { ...prev, steps: [...prev.steps, { ...EMPTY_STEP(), dia_offset: nextOffset, ordem: newIdx }] }
    })
  }

  function removeStep(i: number) {
    setForm((prev) => ({ ...prev, steps: prev.steps.filter((_, idx) => idx !== i) }))
    setActiveStep(Math.max(0, i - 1))
  }

  async function handleSave() {
    if (!form.nome.trim()) { toast({ title: 'Nome é obrigatório', variant: 'destructive' }); return }
    setSaving(true)
    try {
      const body = { nome: form.nome, tipo: 'trial_saas', ativo: form.ativo, steps: form.steps.map((s, i) => ({ ...s, ordem: i, mensagem: s.mensagem || null, pool_mensagens: [] })) }
      const res = editing
        ? await fetch(`/api/follow/sequences/${editing.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
        : await fetch('/api/follow/sequences', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast({ title: editing ? 'Sequência atualizada!' : 'Sequência criada!' })
      setDialogOpen(false)
      loadSequences()
    } catch (err: any) {
      toast({ title: err.message || 'Erro ao salvar', variant: 'destructive' })
    } finally { setSaving(false) }
  }

  async function handleToggle(seq: TrialSequence) {
    try {
      await fetch(`/api/follow/sequences/${seq.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ativo: !seq.ativo }) })
      setSequences((prev) => prev.map((s) => s.id === seq.id ? { ...s, ativo: !s.ativo } : s))
    } catch { toast({ title: 'Erro ao alterar status', variant: 'destructive' }) }
  }

  async function handleDelete(id: string) {
    setDeleting(id)
    try {
      await fetch(`/api/follow/sequences/${id}`, { method: 'DELETE' })
      setSequences((prev) => prev.filter((s) => s.id !== id))
      toast({ title: 'Sequência removida' })
    } catch { toast({ title: 'Erro ao remover', variant: 'destructive' }) }
    finally { setDeleting(null) }
  }

  const SIDEBAR = [
    { id: 'config'    as ActiveTab, label: 'Configurações', icon: Settings2,  desc: 'Webhook e período de trial' },
    { id: 'sequences' as ActiveTab, label: 'Sequências',    icon: ListChecks, desc: 'Mensagens automáticas do trial' },
    { id: 'trials'    as ActiveTab, label: 'Trials ativos', icon: Users,      desc: 'Calendário de expiração' },
  ]

  const currentTab = SIDEBAR.find((t) => t.id === activeTab)!
  const TabIcon = currentTab.icon

  const stepLabel = (step: TrialStep) => step.dia_offset === 0 ? 'D0 (imediato)' : `D${step.dia_offset}`

  return (
    <div className="max-w-5xl mx-auto p-4 md:p-6 pb-8">
      <div className="flex items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Trial SaaS</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Automação de onboarding e acompanhamento do período de teste</p>
        </div>
      </div>

      <div className="flex gap-6">
        <aside className="w-44 shrink-0 space-y-1">
          {SIDEBAR.map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => setActiveTab(id)}
              className={cn('w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm transition-colors text-left',
                activeTab === id ? 'bg-primary/10 text-primary font-medium' : 'text-muted-foreground hover:text-foreground hover:bg-muted/50')}>
              <Icon className={cn('w-4 h-4 shrink-0', activeTab === id ? 'text-primary' : 'text-muted-foreground')} />
              {label}
            </button>
          ))}
        </aside>

        <div className="flex-1 min-w-0">
          <div className="rounded-xl border border-border overflow-hidden">
            <div className="flex items-center gap-3 px-5 py-4 bg-muted/20 border-b border-border">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <TabIcon className="w-4 h-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm">{currentTab.label}</p>
                <p className="text-xs text-muted-foreground">{currentTab.desc}</p>
              </div>
              {activeTab === 'sequences' && (
                <Button onClick={openNew} size="sm" className="h-8 gap-1.5 shrink-0">
                  <Plus className="w-3.5 h-3.5" /> Nova sequência
                </Button>
              )}
              {activeTab === 'trials' && (
                <Badge variant="secondary">{trials.length} ativos</Badge>
              )}
            </div>

            <div className="p-5">
              {activeTab === 'config' && <ConfigContent />}

              {activeTab === 'trials' && (
                loadingTrials ? (
                  <div className="flex items-center justify-center h-48"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
                ) : trials.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-14 gap-4">
                    <Users className="w-10 h-10 text-muted-foreground/30" />
                    <div className="text-center space-y-1">
                      <p className="text-sm font-medium text-muted-foreground">Nenhum trial ativo</p>
                      <p className="text-xs text-muted-foreground">Os cadastros aparecerão aqui após o primeiro formulário enviado</p>
                    </div>
                  </div>
                ) : <TrialCalendar trials={trials} />
              )}

              {activeTab === 'sequences' && (
                loadingSeqs ? (
                  <div className="flex items-center justify-center h-48"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
                ) : sequences.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-14 gap-4">
                    <ListChecks className="w-10 h-10 text-muted-foreground/30" />
                    <div className="text-center space-y-1">
                      <p className="text-sm font-medium text-muted-foreground">Nenhuma sequência configurada</p>
                      <p className="text-xs text-muted-foreground">Crie boas-vindas (D0), acompanhamento (D3) e conversão (D6)</p>
                    </div>
                    <Button onClick={openNew} size="sm"><Plus className="w-4 h-4 mr-2" /> Criar sequência</Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {sequences.map((seq) => (
                      <SequenceCard key={seq.id} seq={seq}
                        onToggle={() => handleToggle(seq)} onEdit={() => openEdit(seq)}
                        onDelete={() => handleDelete(seq.id)} deleting={deleting === seq.id} />
                    ))}
                  </div>
                )
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Dialog criar/editar sequência */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[92vh] overflow-hidden flex flex-col p-0 gap-0">
          <DialogHeader className="px-6 py-4 border-b border-border shrink-0">
            <DialogTitle className="flex items-center gap-2">
              {editing ? <Pencil className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
              {editing ? 'Editar sequência' : 'Nova sequência de trial'}
            </DialogTitle>
          </DialogHeader>

          <div className="flex gap-0 flex-1 overflow-hidden min-h-0">
            {/* Esquerda */}
            <div className="flex-1 overflow-y-auto p-5 space-y-5 border-r border-border">
              <div className="flex items-end gap-3">
                <div className="flex-1 space-y-1.5">
                  <Label>Nome da sequência *</Label>
                  <Input value={form.nome} onChange={(e) => setForm((p) => ({ ...p, nome: e.target.value }))} placeholder="Ex: Trial 7 dias" className="h-9" />
                </div>
                <div className="flex items-center gap-2 pb-1">
                  <Switch checked={form.ativo} onCheckedChange={(v) => setForm((p) => ({ ...p, ativo: v }))} />
                  <span className="text-sm text-muted-foreground">Ativa</span>
                </div>
              </div>

              <div className="flex items-start gap-2.5 p-3 rounded-xl border border-border bg-muted/20 text-xs text-muted-foreground">
                <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                O passo <strong>D0</strong> é enviado imediatamente após o cadastro. Os demais são processados pelo cron diário.
              </div>

              {/* Step chips */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Passos</span>
                  <div className="flex-1" />
                  <Button variant="ghost" size="sm" onClick={addStep} className="h-7 text-xs px-2.5 gap-1">
                    <Plus className="w-3 h-3" /> Novo passo
                  </Button>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {form.steps.map((step, i) => {
                    const TipoIcon = TIPO_MSG[step.tipo_mensagem]?.icon ?? MessageSquare
                    const isActive = activeStep === i
                    return (
                      <div key={i} onClick={() => setActiveStep(i)}
                        className={cn('flex items-center gap-1.5 pl-2.5 pr-1.5 py-1.5 rounded-lg border text-xs cursor-pointer transition-all',
                          isActive ? 'border-primary/50 bg-primary/10 text-primary shadow-sm' : 'border-border bg-muted/30 text-muted-foreground hover:bg-muted/50')}>
                        <TipoIcon className={cn('w-3 h-3 shrink-0', isActive ? 'text-primary' : TIPO_MSG[step.tipo_mensagem]?.color)} />
                        <span className="font-medium">{stepLabel(step)}</span>
                        {form.steps.length > 1 && (
                          <button onClick={(e) => { e.stopPropagation(); removeStep(i) }}
                            className={cn('ml-0.5 rounded transition-colors', isActive ? 'hover:text-red-400' : 'hover:text-destructive')}>
                            <X className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Active step editor */}
              {form.steps[activeStep] && (
                <div className="rounded-xl border border-border bg-muted/10 p-4">
                  <div className="flex items-center gap-2 mb-4 pb-3 border-b border-border">
                    <div className="w-5 h-5 rounded-full bg-primary/15 flex items-center justify-center">
                      <span className="text-[10px] font-bold text-primary">{activeStep + 1}</span>
                    </div>
                    <span className="text-sm font-semibold">Passo {activeStep + 1}</span>
                    <span className="text-xs text-muted-foreground">· {stepLabel(form.steps[activeStep])}</span>
                  </div>
                  <TrialStepEditor
                    step={form.steps[activeStep]}
                    index={activeStep}
                    onChange={updateStep}
                  />
                </div>
              )}
            </div>

            {/* Direita: phone mockup */}
            <div className="w-[260px] shrink-0 flex flex-col items-center gap-4 p-5 bg-muted/10">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide self-start">Preview</p>
              {form.steps[activeStep] && <PhoneMockup step={form.steps[activeStep]} />}
              {form.steps.length > 1 && (
                <div className="flex gap-1.5 items-center">
                  {form.steps.map((_, i) => (
                    <button key={i} onClick={() => setActiveStep(i)}
                      className={cn('rounded-full transition-all duration-200',
                        activeStep === i ? 'w-4 h-1.5 bg-primary' : 'w-1.5 h-1.5 bg-muted-foreground/30 hover:bg-muted-foreground/50')} />
                  ))}
                </div>
              )}
              {form.steps[activeStep] && (
                <div className="text-center space-y-0.5">
                  <p className="text-xs font-medium text-muted-foreground">
                    {TIPO_MSG[form.steps[activeStep].tipo_mensagem]?.label}
                  </p>
                  <p className="text-[10px] text-muted-foreground/60">{stepLabel(form.steps[activeStep])}</p>
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="px-6 py-4 border-t border-border shrink-0 bg-background">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving} className="gap-2">
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {editing ? 'Salvar alterações' : 'Criar sequência'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
