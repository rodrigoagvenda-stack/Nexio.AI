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
  Plus, Trash2, Loader2, Clock, CalendarClock, Sparkles, Pencil,
  Megaphone, FileText, BarChart2, CheckCircle2, XCircle, Bot,
  MessageSquare, RefreshCw, Info, AlarmClock,
  Image, Video, FileAudio, Mic, MapPin, LayoutList, Rows3,
  Phone, X, Check, Square, Send,
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

type SequenceTipo = 'follow_geral' | 'anti_noshow' | 'remarketing' | 'follow_proposta'
type StepTipo = 'text' | 'image' | 'video' | 'audio' | 'ptt' | 'document' | 'menu' | 'carousel' | 'location'

interface ButtonAction {
  status?: string
  schedule_days?: number
  stop_sequence?: boolean
}

interface MediaConfig {
  file?: string; text?: string; docName?: string; viewOnce?: boolean
  menuType?: 'button' | 'list' | 'poll'; choices?: string[]; selectableCount?: number
  button_actions?: Record<string, ButtonAction>
  carousel?: { text: string; image?: string; buttons?: string[] }[]
  name?: string; address?: string; latitude?: number; longitude?: number
}

interface FollowStep {
  id?: string
  dia_offset: number; horario: string
  mensagem: string; pool_mensagens: string[]
  usar_ia: boolean; usar_contexto_sdr: boolean; ordem: number
  tipo_mensagem: StepTipo; media_config: MediaConfig
}

interface FollowSequence {
  id: string; nome: string; tipo: SequenceTipo; ativo: boolean
  follow_steps: FollowStep[]
}

interface Stats {
  total_enviados: number; total_falhas: number; total_respondeu: number; sequencias_ativas: number
  por_tipo: { tipo: string; label: string; enviados: number; falhas: number }[]
  ultimos: {
    id: number; tipo: string; lead_id: number; lead_name: string; lead_status: string
    mensagem: string; enviado_em: string; respondeu: boolean; resposta: string | null
  }[]
}

// ─── Config ───────────────────────────────────────────────────────────────────

const TIPO_CONFIG: Record<SequenceTipo, {
  label: string; desc: string; hint: string; color: string
  badgeColor: string; icon: React.FC<{ className?: string }>; isHours: boolean
}> = {
  follow_geral:    { label: 'Follow Geral',    desc: 'Leads sem resposta por X dias',       hint: 'Dispara quando o lead fica X dias sem responder.',                             color: 'border-blue-500/30 bg-blue-500/5',     badgeColor: 'bg-blue-500/10 text-blue-600 border-blue-500/20 dark:text-blue-400',       icon: Clock,        isHours: false },
  anti_noshow:     { label: 'Anti-Noshow',     desc: 'Antes e depois de calls agendadas',   hint: 'Relativo ao horário da call. Negativo = antes, positivo = depois.',            color: 'border-orange-500/30 bg-orange-500/5', badgeColor: 'bg-orange-500/10 text-orange-600 border-orange-500/20 dark:text-orange-400', icon: CalendarClock, isHours: true  },
  follow_proposta: { label: 'Follow Proposta', desc: 'Pós-call realizada sem fechar',       hint: 'Dispara X dias após a call, quando o lead ainda não fechou.',                  color: 'border-emerald-500/30 bg-emerald-500/5', badgeColor: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:text-emerald-400', icon: FileText, isHours: false },
  remarketing:     { label: 'Remarketing',     desc: 'Re-engajamento de leads perdidos',    hint: 'Dispara X dias após o último contato com leads de status Perdido.',            color: 'border-purple-500/30 bg-purple-500/5', badgeColor: 'bg-purple-500/10 text-purple-600 border-purple-500/20 dark:text-purple-400', icon: Megaphone,   isHours: false },
}

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

const SIDEBAR_TABS = [
  { id: 'follow_geral'    as SequenceTipo, label: 'Follow Geral',    icon: Clock         },
  { id: 'anti_noshow'     as SequenceTipo, label: 'Anti-Noshow',     icon: CalendarClock },
  { id: 'follow_proposta' as SequenceTipo, label: 'Follow Proposta', icon: FileText      },
  { id: 'remarketing'     as SequenceTipo, label: 'Remarketing',     icon: Megaphone     },
]

const EMPTY_STEP = (): FollowStep => ({
  dia_offset: 1, horario: '09:00', mensagem: '', pool_mensagens: [],
  usar_ia: false, usar_contexto_sdr: false, ordem: 0,
  tipo_mensagem: 'text', media_config: {},
})

// Variáveis disponíveis nos templates de mensagem
const TEMPLATE_VARS = [
  { token: '{nome}',         label: 'Nome completo'    },
  { token: '{primeiro_nome}', label: 'Primeiro nome'   },
  { token: '{status}',       label: 'Status do lead'   },
  { token: '{data_call}',    label: 'Data/hora da call'},
]

// ─── VarPicker — insere variável na posição do cursor ────────────────────────

function VarPicker({ textareaRef, value, onChange }: {
  textareaRef: React.RefObject<HTMLTextAreaElement>
  value: string
  onChange: (v: string) => void
}) {
  const insert = (token: string) => {
    const el = textareaRef.current
    const start = el?.selectionStart ?? value.length
    const end = el?.selectionEnd ?? value.length
    const next = value.slice(0, start) + token + value.slice(end)
    onChange(next)
    requestAnimationFrame(() => {
      el?.focus()
      el?.setSelectionRange(start + token.length, start + token.length)
    })
  }

  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[10px] text-muted-foreground uppercase tracking-wide shrink-0">Variáveis</span>
      {TEMPLATE_VARS.map((v) => (
        <button key={v.token} type="button" onClick={() => insert(v.token)} title={`Inserir ${v.token}`}
          className="text-[11px] font-mono bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 rounded px-1.5 py-0.5 transition-colors cursor-pointer leading-none">
          {v.token}
        </button>
      ))}
    </div>
  )
}

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
    input.onchange = (e) => {
      const f = (e.target as HTMLInputElement).files?.[0]
      if (f) handleFile(f)
    }
    input.click()
  }

  return (
    <div
      onClick={!uploading ? openPicker : undefined}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault(); setDragOver(false)
        const f = e.dataTransfer.files[0]
        if (f && !uploading) handleFile(f)
      }}
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
    } catch {
      toast({ title: 'Permissão de microfone negada', variant: 'destructive' })
    }
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

// ─── Chat Preview — estilo idêntico ao SimulatorChat do SDR ─────────────────

function ChatPreview({ step }: { step: FollowStep }) {
  const { tipo_mensagem: tipo, mensagem, media_config: media } = step
  const text = mensagem || (tipo === 'text' ? 'Sua mensagem aparecerá aqui…' : '')

  return (
    <div className="flex flex-col flex-1 overflow-hidden rounded-xl border border-border/60 bg-background">

      {/* Header */}
      <div className="flex items-center gap-2.5 px-4 py-3 border-b border-border/60 bg-card shrink-0">
        <div className="relative shrink-0">
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
            <Bot className="w-4 h-4 text-primary" />
          </div>
          <span className="absolute bottom-0 right-0 w-2 h-2 rounded-full bg-emerald-500 border-2 border-card" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold leading-none">Agente</p>
          <p className="text-xs text-emerald-500 mt-0.5">online · SaaS</p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 px-4 py-4 space-y-3 overflow-y-auto" style={{ background: 'hsl(var(--muted)/0.3)' }}>
        <div className="flex justify-center">
          <span className="px-3 py-1 rounded-full bg-muted/60 text-xs text-muted-foreground/70 border border-border/40">Hoje</span>
        </div>

        <div className="flex items-end gap-2">
          <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mb-5">
            <Bot className="w-3.5 h-3.5 text-primary" />
          </div>
          <div className="space-y-1" style={{ maxWidth: '82%' }}>
            <div className="rounded-2xl rounded-tl-none bg-card border border-border/60 px-3.5 py-2.5 shadow-sm">

              {tipo === 'image' && (
                <div className="rounded-lg overflow-hidden bg-muted/50 flex items-center justify-center mb-2" style={{ height: 100 }}>
                  {media.file ? <img src={media.file} className="h-full w-full object-cover" alt="" /> : <Image className="w-6 h-6 text-muted-foreground/40" />}
                </div>
              )}
              {tipo === 'video' && (
                <div className="rounded-lg bg-muted/50 flex items-center justify-center gap-2 mb-2" style={{ height: 100 }}>
                  <Video className="w-5 h-5 text-muted-foreground/40" />
                  <span className="text-xs text-muted-foreground/60">Vídeo</span>
                </div>
              )}
              {(tipo === 'audio' || tipo === 'ptt') && (
                <div className="flex items-center gap-2 py-1">
                  <div className="w-7 h-7 rounded-full bg-emerald-500/10 flex items-center justify-center shrink-0">
                    <Mic className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div className="flex items-end gap-px flex-1 h-5">
                    {[4,9,6,14,8,12,5,11,15,7,13,5,8,10,6].map((h, i) => (
                      <div key={i} className="rounded-full bg-muted-foreground/35 flex-1" style={{ height: `${h}px` }} />
                    ))}
                  </div>
                  <span className="text-xs text-muted-foreground/50">0:08</span>
                </div>
              )}
              {tipo === 'document' && (
                <div className="flex items-center gap-2 py-1">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <FileText className="w-4 h-4 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{media.docName || 'documento.pdf'}</p>
                    <p className="text-xs text-muted-foreground/60">PDF · Documento</p>
                  </div>
                </div>
              )}
              {tipo === 'location' && (
                <div className="rounded-lg bg-muted/50 flex flex-col items-center justify-center gap-1 mb-1.5" style={{ height: 80 }}>
                  <MapPin className="w-5 h-5 text-muted-foreground/60" />
                  <p className="text-xs text-muted-foreground/60">{media.name || 'Local'}</p>
                </div>
              )}
              {tipo === 'menu' && (
                <div className="space-y-1.5">
                  {text && <p className="text-sm whitespace-pre-wrap leading-relaxed">{text}</p>}
                  {(media.choices ?? ['Opção 1', 'Opção 2']).slice(0, 3).map((c, i) => (
                    <div key={i} className="text-center text-xs text-primary border border-border/60 rounded-lg py-1">
                      {c || `Opção ${i + 1}`}
                    </div>
                  ))}
                </div>
              )}
              {tipo === 'carousel' && (
                <div className="space-y-2">
                  {text && <p className="text-sm whitespace-pre-wrap leading-relaxed">{text}</p>}
                  <div className="flex gap-2 overflow-hidden">
                    {(media.carousel ?? [{ text: 'Item 1' }]).slice(0, 2).map((item, i) => (
                      <div key={i} className="min-w-[100px] rounded-lg bg-muted/50 border border-border/60 overflow-hidden shrink-0">
                        {item.image ? <img src={item.image} className="w-full object-cover" style={{ height: 56 }} alt="" /> : <div className="w-full bg-muted flex items-center justify-center" style={{ height: 56 }}><Image className="w-4 h-4 text-muted-foreground/40" /></div>}
                        <p className="text-xs px-2 py-1 truncate">{item.text || `Item ${i + 1}`}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {tipo !== 'menu' && tipo !== 'carousel' && text && (
                <p className="text-sm whitespace-pre-wrap leading-relaxed">{text}</p>
              )}
            </div>
            <p className="text-xs text-muted-foreground/50 pl-1">agora</p>
          </div>
        </div>
      </div>

      {/* Input */}
      <div className="border-t border-border/60 bg-card shrink-0">
        <div className="flex gap-2 items-end px-3 py-3">
          <div className="flex-1 flex items-center rounded-xl border border-border bg-background px-3 py-2">
            <span className="text-sm text-muted-foreground/50">Mensagem…</span>
          </div>
          <div className="w-9 h-9 rounded-full bg-emerald-600 flex items-center justify-center shrink-0">
            <Send className="w-4 h-4 text-white" />
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Location editor (controlled, com state próprio) ─────────────────────────

function parseGoogleMapsUrl(url: string): { lat: number; lng: number } | null {
  // !3d<lat>!4d<lng> — coordenadas do pin (mais precisas, têm prioridade)
  let m = url.match(/!3d(-?\d+\.\d+).*?!4d(-?\d+\.\d+)/)
  if (m) return { lat: parseFloat(m[1]), lng: parseFloat(m[2]) }
  // @lat,lng — centro do mapa
  m = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/)
  if (m) return { lat: parseFloat(m[1]), lng: parseFloat(m[2]) }
  // ?q=lat,lng
  m = url.match(/[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/)
  if (m) return { lat: parseFloat(m[1]), lng: parseFloat(m[2]) }
  // ll=lat,lng
  m = url.match(/[?&]ll=(-?\d+\.\d+),(-?\d+\.\d+)/)
  if (m) return { lat: parseFloat(m[1]), lng: parseFloat(m[2]) }
  return null
}

function LocationEditor({ config, onChange }: { config: MediaConfig; onChange: (p: Partial<MediaConfig>) => void }) {
  const [mapsUrl, setMapsUrl] = useState('')
  const hasCoords = config.latitude != null && config.longitude != null

  const handleUrl = (url: string) => {
    setMapsUrl(url)
    const coords = parseGoogleMapsUrl(url)
    if (coords) onChange({ latitude: coords.lat, longitude: coords.lng })
  }

  const verifyHref = hasCoords
    ? `https://www.google.com/maps/search/?api=1&query=${config.latitude},${config.longitude}`
    : '#'

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label className="text-xs text-muted-foreground">Link do Google Maps</Label>
          <a
            href={mapsUrl || 'https://maps.google.com'}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-primary hover:underline"
          >
            {mapsUrl ? 'Abrir URL colada ↗' : 'Abrir Google Maps ↗'}
          </a>
        </div>
        <Input
          value={mapsUrl}
          className="h-9 text-sm"
          placeholder="Cole aqui o link copiado do Google Maps…"
          onChange={(e) => handleUrl(e.target.value)}
        />
        <p className="text-xs text-muted-foreground">
          No Google Maps: clique no local → compartilhar → copiar link → cole aqui
        </p>
      </div>

      {hasCoords && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-teal-500/10 border border-teal-500/20 text-xs text-teal-400">
          <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
          <span>Coordenadas: {config.latitude?.toFixed(6)}, {config.longitude?.toFixed(6)}</span>
          <a href={verifyHref} target="_blank" rel="noopener noreferrer"
            className="ml-auto hover:text-teal-300 underline">verificar ↗</a>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2 space-y-1.5">
          <Label className="text-xs text-muted-foreground">Nome do local</Label>
          <Input value={config.name ?? ''} onChange={(e) => onChange({ name: e.target.value })}
            className="h-9 text-sm" placeholder="Ex: Escritório Nexio" />
        </div>
        <div className="col-span-2 space-y-1.5">
          <Label className="text-xs text-muted-foreground">Endereço (aparece no WhatsApp)</Label>
          <Input value={config.address ?? ''} onChange={(e) => onChange({ address: e.target.value })}
            className="h-9 text-sm" placeholder="Ex: Av. Paulista, 1000 — São Paulo, SP" />
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
          <Input value={config.text ?? ''} onChange={(e) => onChange({ text: e.target.value })} placeholder="Legenda da imagem…" className="h-9 text-sm" />
        </div>
        <div className="flex items-center gap-3 py-2 px-3 rounded-lg border border-border bg-muted/20">
          <Switch checked={config.viewOnce ?? false} onCheckedChange={(v) => onChange({ viewOnce: v })} />
          <p className="text-sm">Ver uma vez</p>
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
    const buttonActions = config.button_actions ?? {}

    const getActionValue = (choice: string): string => {
      const a = buttonActions[choice]
      if (!a) return 'none'
      if (a.stop_sequence) return 'stop'
      if (a.schedule_days === 3) return 'schedule_3'
      if (a.schedule_days === 7) return 'schedule_7'
      if (a.schedule_days === 14) return 'schedule_14'
      if (a.status) return `status_${a.status}`
      return 'none'
    }

    const setActionValue = (choice: string, value: string) => {
      const next = { ...buttonActions }
      if (value === 'none') {
        delete next[choice]
      } else if (value === 'stop') {
        next[choice] = { stop_sequence: true }
      } else if (value === 'schedule_3') {
        next[choice] = { schedule_days: 3 }
      } else if (value === 'schedule_7') {
        next[choice] = { schedule_days: 7 }
      } else if (value === 'schedule_14') {
        next[choice] = { schedule_days: 14 }
      } else if (value.startsWith('status_')) {
        next[choice] = { status: value.replace('status_', '') }
      }
      onChange({ button_actions: next })
    }

    const renameActionKey = (oldChoice: string, newChoice: string) => {
      if (oldChoice === newChoice || !buttonActions[oldChoice]) return
      const next = { ...buttonActions }
      next[newChoice] = next[oldChoice]
      delete next[oldChoice]
      onChange({ button_actions: next })
    }

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
            <Button type="button" variant="ghost" size="sm" className="h-6 text-xs px-2"
              onClick={() => onChange({ choices: [...choices, ''] })}>
              <Plus className="w-3 h-3 mr-1" /> Adicionar
            </Button>
          </div>
          {choices.map((c, i) => (
            <div key={i} className="space-y-1.5 rounded-lg border border-border/60 bg-muted/10 p-2.5">
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded bg-muted flex items-center justify-center text-[10px] text-muted-foreground shrink-0">{i + 1}</div>
                <Input
                  value={c}
                  onChange={(e) => {
                    const prev = c
                    const n = [...choices]; n[i] = e.target.value; onChange({ choices: n })
                    renameActionKey(prev, e.target.value)
                  }}
                  placeholder={`Opção ${i + 1}`} className="h-8 text-sm" />
                <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-destructive hover:text-destructive"
                  onClick={() => {
                    const next = { ...buttonActions }; delete next[c]
                    onChange({ choices: choices.filter((_, idx) => idx !== i), button_actions: next })
                  }}>
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
              {c && (
                <Select value={getActionValue(c)} onValueChange={(v) => setActionValue(c, v)}>
                  <SelectTrigger className="h-7 text-xs text-muted-foreground border-dashed">
                    <SelectValue placeholder="Ação ao clicar…" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhuma ação</SelectItem>
                    <SelectItem value="status_Interessado">Mover → Interessado</SelectItem>
                    <SelectItem value="status_Em contato">Mover → Em contato</SelectItem>
                    <SelectItem value="status_Negociando">Mover → Negociando</SelectItem>
                    <SelectItem value="status_Perdido">Mover → Perdido</SelectItem>
                    <SelectItem value="schedule_3">Reagendar em 3 dias</SelectItem>
                    <SelectItem value="schedule_7">Reagendar em 7 dias</SelectItem>
                    <SelectItem value="schedule_14">Reagendar em 14 dias</SelectItem>
                    <SelectItem value="stop">Parar sequência</SelectItem>
                  </SelectContent>
                </Select>
              )}
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
            onClick={() => onChange({ carousel: [...items, { text: '', image: '' }] })}>
            <Plus className="w-3 h-3 mr-1" /> Adicionar
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
            <UploadZone accept="image/*" label="Imagem do item" icon={Image}
              current={item.image} currentName={item.image ? 'Imagem' : undefined}
              onUpload={(url) => { const n = [...items]; n[i] = { ...n[i], image: url }; onChange({ carousel: n }) }} />
            <Input value={item.text} placeholder="Texto do item…" className="h-8 text-sm"
              onChange={(e) => { const n = [...items]; n[i] = { ...n[i], text: e.target.value }; onChange({ carousel: n }) }} />
          </div>
        ))}
      </div>
    )
  }

  if (tipo === 'location') {
    return <LocationEditor config={config} onChange={onChange} />
  }

  return null
}

// ─── Step editor (flat — sem card próprio) ────────────────────────────────────

function StepEditor({ step, tipo, onChange }: {
  step: FollowStep; tipo: SequenceTipo
  onChange: (p: Partial<FollowStep>) => void
}) {
  const mensagemRef = useRef<HTMLTextAreaElement>(null)
  const isAntiNoshow = tipo === 'anti_noshow'
  const absHours = Math.abs(step.dia_offset)
  const direction: 'antes' | 'depois' = step.dia_offset <= 0 ? 'antes' : 'depois'
  const needsText = ['text', 'menu', 'carousel'].includes(step.tipo_mensagem)

  return (
    <div className="space-y-4">
      {/* Timing */}
      <div className="space-y-2">
        <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Quando disparar</Label>
        {isAntiNoshow ? (
          <div className="flex items-center gap-2 flex-wrap">
            <Input type="number" min={0} value={absHours}
              onChange={(e) => onChange({ dia_offset: direction === 'antes' ? -Math.abs(parseInt(e.target.value) || 0) : Math.abs(parseInt(e.target.value) || 0) })}
              className="w-20 h-9 text-sm text-center font-mono" />
            <span className="text-sm text-muted-foreground">hora{absHours !== 1 ? 's' : ''}</span>
            <Select value={direction} onValueChange={(v: 'antes' | 'depois') => onChange({ dia_offset: v === 'antes' ? -absHours : absHours })}>
              <SelectTrigger className="w-28 h-9 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="antes">antes</SelectItem>
                <SelectItem value="depois">depois</SelectItem>
              </SelectContent>
            </Select>
            <span className="text-sm text-muted-foreground">da call, às</span>
            <Input type="time" value={step.horario} onChange={(e) => onChange({ horario: e.target.value })} className="w-28 h-9 text-sm font-mono" />
          </div>
        ) : (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm text-muted-foreground">Após</span>
            <Input type="number" min={0} value={step.dia_offset}
              onChange={(e) => onChange({ dia_offset: Math.max(0, parseInt(e.target.value) || 0) })}
              className="w-20 h-9 text-sm text-center font-mono" />
            <span className="text-sm text-muted-foreground">
              {step.dia_offset === 0 ? 'dias (hoje), às' : step.dia_offset === 1 ? 'dia, às' : 'dias, às'}
            </span>
            <Input type="time" value={step.horario} onChange={(e) => onChange({ horario: e.target.value })} className="w-28 h-9 text-sm font-mono" />
          </div>
        )}
      </div>

      {/* Tipo de mensagem */}
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

      {/* IA toggle */}
      {step.tipo_mensagem === 'text' && (
        <div className="space-y-2">
          <div className="flex items-center gap-3 py-2.5 px-3 rounded-lg border border-border bg-muted/20">
            <Switch checked={step.usar_ia} onCheckedChange={(v) => onChange({ usar_ia: v })} />
            <div>
              <p className="text-sm font-medium flex items-center gap-1.5"><Sparkles className="w-3.5 h-3.5 text-primary" /> Gerar com IA</p>
              <p className="text-xs text-muted-foreground">A IA cria a mensagem baseada no contexto do lead</p>
            </div>
          </div>
          {step.usar_ia && (
            <div className="flex items-center gap-3 py-2.5 px-3 ml-4 rounded-lg border border-dashed border-border bg-muted/10">
              <Switch checked={step.usar_contexto_sdr} onCheckedChange={(v) => onChange({ usar_contexto_sdr: v })} />
              <div>
                <p className="text-sm font-medium flex items-center gap-1.5 text-muted-foreground"><Bot className="w-3.5 h-3.5" /> Usar contexto SDR</p>
                <p className="text-xs text-muted-foreground">Inclui o prompt do agente para manter o tom</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Texto */}
      {!step.usar_ia && needsText && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              {step.tipo_mensagem === 'text' ? 'Mensagem' : 'Texto introdutório'}
            </Label>
            <VarPicker textareaRef={mensagemRef} value={step.mensagem}
              onChange={(v) => onChange({ mensagem: v })} />
          </div>
          <Textarea ref={mensagemRef} value={step.mensagem} onChange={(e) => onChange({ mensagem: e.target.value })}
            placeholder="Oi, {nome}! Gostaria de retomar nossa conversa…"
            className="min-h-[80px] text-sm resize-none" />
        </div>
      )}

      {/* Media */}
      {step.tipo_mensagem !== 'text' && (
        <MediaEditor tipo={step.tipo_mensagem} config={step.media_config}
          onChange={(patch) => onChange({ media_config: { ...step.media_config, ...patch } })} />
      )}
    </div>
  )
}

// ─── Sequence card ────────────────────────────────────────────────────────────

function SequenceCard({ seq, onToggle, onEdit, onDelete, deleting }: {
  seq: FollowSequence; onToggle: () => void; onEdit: () => void; onDelete: () => void; deleting: boolean
}) {
  const cfg = TIPO_CONFIG[seq.tipo]
  return (
    <div className={cn('rounded-xl border border-border p-4 transition-opacity', !seq.ativo && 'opacity-55')}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-sm">{seq.nome}</h3>
            {!seq.ativo && <Badge variant="secondary" className="text-xs">Inativa</Badge>}
          </div>
          {seq.follow_steps.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              {seq.follow_steps.map((step, i) => {
                const TipoIcon = TIPO_MSG[step.tipo_mensagem ?? 'text']?.icon ?? MessageSquare
                return (
                  <div key={step.id ?? i} className="flex items-center gap-1">
                    {i > 0 && <span className="text-muted-foreground/40 text-xs">→</span>}
                    <div className="flex items-center gap-1.5 text-xs bg-muted/60 border border-border rounded-lg px-2.5 py-1">
                      <TipoIcon className={cn('w-3 h-3', TIPO_MSG[step.tipo_mensagem ?? 'text']?.color)} />
                      <AlarmClock className="w-3 h-3 text-muted-foreground" />
                      <span className="font-medium">
                        {cfg.isHours ? `${Math.abs(step.dia_offset)}h ${step.dia_offset <= 0 ? 'antes' : 'depois'}` : `D+${step.dia_offset}`}
                      </span>
                      {step.usar_ia && <Sparkles className="w-3 h-3 text-primary" />}
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

// ─── Métricas ─────────────────────────────────────────────────────────────────

function MetricasContent() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/follow/stats')
      if (res.ok) setStats(await res.json())
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  if (loading) return <div className="flex items-center justify-center h-48"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
  if (!stats) return <p className="text-sm text-muted-foreground text-center py-12">Erro ao carregar métricas.</p>

  return (
    <div className="space-y-5">
      <div className="flex justify-end">
        <Button variant="ghost" size="sm" onClick={load} className="h-7 text-xs gap-1">
          <RefreshCw className="w-3 h-3" /> Atualizar
        </Button>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {[
          { label: 'Enviados',          value: stats.total_enviados,    icon: MessageSquare, color: 'text-blue-600'    },
          { label: 'Falhas',            value: stats.total_falhas,      icon: XCircle,       color: 'text-red-500'     },
          { label: 'Sequências ativas', value: stats.sequencias_ativas, icon: CheckCircle2,  color: 'text-emerald-600' },
          { label: 'Responderam',       value: stats.total_respondeu,   icon: BarChart2,     color: 'text-purple-600'  },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="rounded-xl border border-border p-4">
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs text-muted-foreground">{label}</p>
              <Icon className={cn('w-4 h-4', color)} />
            </div>
            <p className="text-2xl font-bold">{value}</p>
          </div>
        ))}
      </div>
      {stats.ultimos.length > 0 && (
        <div className="rounded-xl border border-border overflow-hidden">
          <div className="px-4 py-3 bg-muted/20 border-b border-border">
            <p className="text-sm font-medium">Últimos disparos</p>
          </div>
          <div className="divide-y divide-border">
            {stats.ultimos.map((log) => (
              <div key={log.id} className="px-4 py-3 space-y-1.5">
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium">{log.lead_name}</span>
                      <span className="text-xs text-muted-foreground/60 border border-border rounded px-1.5 py-0.5">{log.lead_status}</span>
                      <span className="text-xs text-muted-foreground/50">{TIPO_CONFIG[log.tipo as SequenceTipo]?.label ?? log.tipo}</span>
                      {log.respondeu
                        ? <span className="text-xs text-emerald-600 flex items-center gap-0.5 ml-auto"><CheckCircle2 className="w-3 h-3" /> Respondeu</span>
                        : <span className="text-xs text-muted-foreground/40 ml-auto">Sem resposta</span>
                      }
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">
                      <span className="text-muted-foreground/50">Enviado: </span>{log.mensagem}
                    </p>
                    {log.respondeu && log.resposta && (
                      <p className="text-xs text-emerald-700 dark:text-emerald-400 mt-0.5 truncate">
                        <span className="text-emerald-600/60">Resposta: </span>{log.resposta}
                      </p>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0 pt-0.5">
                    {new Date(log.enviado_em).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Página ───────────────────────────────────────────────────────────────────

type ActiveTab = SequenceTipo | 'metricas'

export default function FollowPage() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('follow_geral')
  const [sequences, setSequences] = useState<FollowSequence[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<FollowSequence | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [firing, setFiring] = useState(false)
  const [activeStep, setActiveStep] = useState(0)
  const [form, setForm] = useState<{ nome: string; ativo: boolean; steps: FollowStep[] }>({
    nome: '', ativo: true, steps: [EMPTY_STEP()],
  })

  const loadSequences = useCallback(async () => {
    try {
      const res = await fetch('/api/follow/sequences')
      const data = await res.json()
      setSequences(data.sequences ?? [])
    } catch { toast({ title: 'Erro ao carregar cadências', variant: 'destructive' }) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { loadSequences() }, [loadSequences])

  function openNew() {
    setEditing(null)
    setForm({ nome: '', ativo: true, steps: [EMPTY_STEP()] })
    setActiveStep(0)
    setDialogOpen(true)
  }

  function openEdit(seq: FollowSequence) {
    setEditing(seq)
    setForm({
      nome: seq.nome, ativo: seq.ativo,
      steps: seq.follow_steps.length > 0
        ? seq.follow_steps.map((s) => ({
            ...s,
            mensagem: s.mensagem ?? '', pool_mensagens: s.pool_mensagens ?? [],
            tipo_mensagem: s.tipo_mensagem ?? 'text', media_config: s.media_config ?? {},
          }))
        : [EMPTY_STEP()],
    })
    setActiveStep(0)
    setDialogOpen(true)
  }

  function updateStep(patch: Partial<FollowStep>) {
    setForm((prev) => ({
      ...prev,
      steps: prev.steps.map((s, idx) => idx === activeStep ? { ...s, ...patch } : s),
    }))
  }

  function addStep() {
    const tipo = editing?.tipo ?? (activeTab === 'metricas' ? 'follow_geral' : activeTab as SequenceTipo)
    const isHours = TIPO_CONFIG[tipo]?.isHours
    setForm((prev) => {
      const last = prev.steps[prev.steps.length - 1]
      const defaultFirst = tipo === 'remarketing' ? 0 : 1
      const nextOffset = isHours
        ? (last?.dia_offset ?? -2) - 1
        : last ? last.dia_offset + 1 : defaultFirst
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
      const tipo = editing?.tipo ?? (activeTab === 'metricas' ? 'follow_geral' : activeTab as SequenceTipo)
      const body = {
        nome: form.nome, tipo, ativo: form.ativo,
        steps: form.steps.map((s, i) => ({
          ...s, ordem: i,
          pool_mensagens: s.pool_mensagens?.filter(Boolean) ?? [],
          mensagem: s.mensagem || null,
        })),
      }
      const res = editing
        ? await fetch(`/api/follow/sequences/${editing.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
        : await fetch('/api/follow/sequences', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast({ title: editing ? 'Cadência atualizada!' : 'Cadência criada!' })
      setDialogOpen(false)
      loadSequences()
    } catch (err: any) {
      toast({ title: err.message || 'Erro ao salvar', variant: 'destructive' })
    } finally { setSaving(false) }
  }

  async function handleToggle(seq: FollowSequence) {
    try {
      await fetch(`/api/follow/sequences/${seq.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ativo: !seq.ativo }) })
      setSequences((prev) => prev.map((s) => s.id === seq.id ? { ...s, ativo: !s.ativo } : s))
    } catch { toast({ title: 'Erro ao alterar status', variant: 'destructive' }) }
  }

  async function handleFireNow() {
    setFiring(true)
    try {
      const res = await fetch('/api/follow/run-remarketing', { method: 'POST' })
      const data = await res.json()
      if (data.ok) {
        toast({ title: data.sent > 0 ? `✅ ${data.sent} mensagem(ns) enviada(s)!` : 'Nenhuma mensagem disparada (verifique se a hora já passou e a cadência está ativa com mensagem)' })
      } else {
        toast({ title: `Erro: ${data.error}`, variant: 'destructive' })
      }
    } catch { toast({ title: 'Erro ao disparar', variant: 'destructive' }) }
    finally { setFiring(false) }
  }

  async function handleDelete(id: string) {
    setDeleting(id)
    try {
      await fetch(`/api/follow/sequences/${id}`, { method: 'DELETE' })
      setSequences((prev) => prev.filter((s) => s.id !== id))
      toast({ title: 'Cadência removida' })
    } catch { toast({ title: 'Erro ao remover', variant: 'destructive' }) }
    finally { setDeleting(null) }
  }

  const currentTipo = activeTab === 'metricas' ? null : activeTab as SequenceTipo
  const currentSeqs = currentTipo ? sequences.filter((s) => s.tipo === currentTipo) : []
  const currentCfg = currentTipo ? TIPO_CONFIG[currentTipo] : null
  const CurrentIcon = currentCfg?.icon ?? BarChart2
  const dialogTipo = editing?.tipo ?? (activeTab === 'metricas' ? 'follow_geral' : activeTab as SequenceTipo)
  const dialogCfg = TIPO_CONFIG[dialogTipo]
  const isHours = dialogCfg?.isHours

  const stepLabel = (step: FollowStep) =>
    isHours
      ? `${Math.abs(step.dia_offset)}h ${step.dia_offset <= 0 ? 'antes' : 'depois'}`
      : `D+${step.dia_offset}`

  return (
    <div className="max-w-5xl mx-auto p-4 md:p-6 pb-8">
      <div className="flex items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Follow-up & Remarketing</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Cadências automáticas de engajamento</p>
        </div>
      </div>

      <div className="flex gap-6">
        {/* Sidebar */}
        <aside className="w-44 shrink-0 space-y-1">
          {SIDEBAR_TABS.map(({ id, label, icon: Icon }) => {
            const count = sequences.filter((s) => s.tipo === id).length
            return (
              <button key={id} onClick={() => setActiveTab(id)}
                className={cn('w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm transition-colors text-left',
                  activeTab === id ? 'bg-primary/10 text-primary font-medium' : 'text-muted-foreground hover:text-foreground hover:bg-muted/50')}>
                <Icon className={cn('w-4 h-4 shrink-0', activeTab === id ? 'text-primary' : 'text-muted-foreground')} />
                <span className="flex-1">{label}</span>
                {count > 0 && <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full min-w-[18px] text-center', activeTab === id ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground')}>{count}</span>}
              </button>
            )
          })}
          <div className="pt-2 border-t border-border mt-2">
            <button onClick={() => setActiveTab('metricas')}
              className={cn('w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm transition-colors text-left',
                activeTab === 'metricas' ? 'bg-primary/10 text-primary font-medium' : 'text-muted-foreground hover:text-foreground hover:bg-muted/50')}>
              <BarChart2 className={cn('w-4 h-4 shrink-0', activeTab === 'metricas' ? 'text-primary' : 'text-muted-foreground')} />
              Métricas
            </button>
          </div>
        </aside>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="rounded-xl border border-border overflow-hidden">
            <div className="flex items-center gap-3 px-5 py-4 bg-muted/20 border-b border-border">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <CurrentIcon className="w-4 h-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm">{activeTab === 'metricas' ? 'Métricas' : currentCfg?.label}</p>
                <p className="text-xs text-muted-foreground">{activeTab === 'metricas' ? 'Últimos 30 dias de disparos' : currentCfg?.desc}</p>
              </div>
              {activeTab !== 'metricas' && (
                <div className="flex items-center gap-2 shrink-0">
                  {currentTipo === 'remarketing' && (
                    <Button onClick={handleFireNow} disabled={firing} variant="outline" size="sm" className="h-8 gap-1.5">
                      {firing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                      Disparar agora
                    </Button>
                  )}
                  <Button onClick={openNew} size="sm" className="h-8 gap-1.5">
                    <Plus className="w-3.5 h-3.5" /> Nova cadência
                  </Button>
                </div>
              )}
            </div>

            <div className="p-5">
              {activeTab === 'metricas' ? (
                <MetricasContent />
              ) : loading ? (
                <div className="flex items-center justify-center h-48"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
              ) : currentSeqs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-14 gap-4">
                  <CurrentIcon className="w-10 h-10 text-muted-foreground/30" />
                  <div className="text-center space-y-1">
                    <p className="text-sm font-medium text-muted-foreground">Nenhuma cadência de {currentCfg?.label}</p>
                    <p className="text-xs text-muted-foreground">{currentCfg?.hint}</p>
                  </div>
                  <Button onClick={openNew} size="sm"><Plus className="w-4 h-4 mr-2" /> Criar primeira cadência</Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {currentSeqs.map((seq) => (
                    <SequenceCard key={seq.id} seq={seq}
                      onToggle={() => handleToggle(seq)} onEdit={() => openEdit(seq)}
                      onDelete={() => handleDelete(seq.id)} deleting={deleting === seq.id} />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[92vh] overflow-hidden flex flex-col p-0 gap-0">
          {/* Dialog header */}
          <DialogHeader className="px-6 py-4 border-b border-border shrink-0">
            <DialogTitle className="flex items-center gap-2">
              {editing ? <Pencil className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
              {editing ? 'Editar cadência' : `Nova cadência — ${dialogCfg?.label}`}
            </DialogTitle>
          </DialogHeader>

          <div className="flex gap-0 flex-1 overflow-hidden min-h-0">
            {/* ── Esquerda: config ── */}
            <div className="flex-1 overflow-y-auto p-5 space-y-5 border-r border-border">
              {/* Nome + ativo */}
              <div className="flex items-end gap-3">
                <div className="flex-1 space-y-1.5">
                  <Label>Nome da cadência *</Label>
                  <Input value={form.nome} onChange={(e) => setForm((p) => ({ ...p, nome: e.target.value }))} placeholder="Ex: Follow 7 dias" className="h-9" />
                </div>
                <div className="flex items-center gap-2 pb-1">
                  <Switch checked={form.ativo} onCheckedChange={(v) => setForm((p) => ({ ...p, ativo: v }))} />
                  <span className="text-sm text-muted-foreground">Ativa</span>
                </div>
              </div>

              {/* Hint */}
              {currentCfg && (
                <div className={cn('flex items-start gap-2.5 p-3 rounded-xl border text-xs', currentCfg.color)}>
                  <Info className="w-3.5 h-3.5 mt-0.5 shrink-0 text-muted-foreground" />
                  <p className="text-muted-foreground">{currentCfg.hint}</p>
                </div>
              )}

              {/* ── Step chips navigator ── */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 flex-wrap">
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
                      <div key={i}
                        onClick={() => setActiveStep(i)}
                        className={cn(
                          'flex items-center gap-1.5 pl-2.5 pr-1.5 py-1.5 rounded-lg border text-xs cursor-pointer transition-all',
                          isActive ? 'border-primary/50 bg-primary/10 text-primary shadow-sm' : 'border-border bg-muted/30 text-muted-foreground hover:bg-muted/50',
                        )}>
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

              {/* ── Active step editor ── */}
              {form.steps[activeStep] && (
                <div className="rounded-xl border border-border bg-muted/10 p-4">
                  <div className="flex items-center gap-2 mb-4 pb-3 border-b border-border">
                    <div className="w-5 h-5 rounded-full bg-primary/15 flex items-center justify-center">
                      <span className="text-[10px] font-bold text-primary">{activeStep + 1}</span>
                    </div>
                    <span className="text-sm font-semibold">Passo {activeStep + 1}</span>
                    <span className="text-xs text-muted-foreground">· {stepLabel(form.steps[activeStep])}</span>
                  </div>
                  <StepEditor
                    step={form.steps[activeStep]}
                    tipo={dialogTipo}
                    onChange={updateStep}
                  />
                </div>
              )}
            </div>

            {/* ── Direita: chat preview ── */}
            <div className="w-[300px] shrink-0 flex flex-col gap-3 p-4 bg-muted/10">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Preview</p>

              {form.steps[activeStep] && <ChatPreview step={form.steps[activeStep]} />}

              {/* Step dots */}
              {form.steps.length > 1 && (
                <div className="flex gap-1.5 items-center justify-center">
                  {form.steps.map((_, i) => (
                    <button key={i} onClick={() => setActiveStep(i)}
                      className={cn('rounded-full transition-all duration-200',
                        activeStep === i ? 'w-4 h-1.5 bg-primary' : 'w-1.5 h-1.5 bg-muted-foreground/30 hover:bg-muted-foreground/50')} />
                  ))}
                </div>
              )}

              {/* Step label */}
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
              {editing ? 'Salvar alterações' : 'Criar cadência'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
