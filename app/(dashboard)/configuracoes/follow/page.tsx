'use client'

import { useState, useEffect, useCallback } from 'react'
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
  Phone,
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

type SequenceTipo = 'follow_geral' | 'anti_noshow' | 'remarketing' | 'follow_proposta'
type StepTipo = 'text' | 'image' | 'video' | 'audio' | 'ptt' | 'document' | 'menu' | 'carousel' | 'location'

interface MediaConfig {
  file?: string; text?: string; docName?: string; viewOnce?: boolean
  menuType?: 'button' | 'list' | 'poll'; choices?: string[]; selectableCount?: number
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
  total_enviados: number; total_falhas: number; sequencias_ativas: number
  por_tipo: { tipo: string; label: string; enviados: number; falhas: number }[]
  ultimos: { id: number; tipo: string; lead_name: string; mensagem: string; enviado_em: string; respondeu: boolean }[]
}

// ─── Config ───────────────────────────────────────────────────────────────────

const TIPO_CONFIG: Record<SequenceTipo, {
  label: string; desc: string; hint: string; color: string
  badgeColor: string; icon: React.FC<{ className?: string }>; isHours: boolean
}> = {
  follow_geral:    { label: 'Follow Geral',    desc: 'Leads sem resposta por X dias',         hint: 'Dispara quando o lead fica X dias sem responder.',                                                          color: 'border-blue-500/30 bg-blue-500/5',    badgeColor: 'bg-blue-500/10 text-blue-600 border-blue-500/20 dark:text-blue-400',    icon: Clock,        isHours: false },
  anti_noshow:     { label: 'Anti-Noshow',     desc: 'Antes e depois de calls agendadas',     hint: 'Relativo ao horário da call. Negativo = antes, positivo = depois.',                                         color: 'border-orange-500/30 bg-orange-500/5', badgeColor: 'bg-orange-500/10 text-orange-600 border-orange-500/20 dark:text-orange-400', icon: CalendarClock, isHours: true  },
  follow_proposta: { label: 'Follow Proposta', desc: 'Pós-call realizada sem fechar',         hint: 'Dispara X dias após a call realizada, quando o lead ainda não fechou.',                                      color: 'border-emerald-500/30 bg-emerald-500/5', badgeColor: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:text-emerald-400', icon: FileText,     isHours: false },
  remarketing:     { label: 'Remarketing',     desc: 'Re-engajamento de leads perdidos',      hint: 'Dispara X dias após o último contato com leads de status Perdido.',                                          color: 'border-purple-500/30 bg-purple-500/5', badgeColor: 'bg-purple-500/10 text-purple-600 border-purple-500/20 dark:text-purple-400', icon: Megaphone,    isHours: false },
}

const TIPO_MSG: Record<StepTipo, { label: string; icon: React.FC<{ className?: string }>; color: string }> = {
  text:     { label: 'Texto',      icon: MessageSquare, color: 'text-blue-500' },
  image:    { label: 'Imagem',     icon: Image,         color: 'text-emerald-500' },
  video:    { label: 'Vídeo',      icon: Video,         color: 'text-purple-500' },
  audio:    { label: 'Áudio',      icon: FileAudio,     color: 'text-orange-500' },
  ptt:      { label: 'PTT',        icon: Mic,           color: 'text-rose-500' },
  document: { label: 'Documento',  icon: FileText,      color: 'text-amber-500' },
  menu:     { label: 'Menu',       icon: LayoutList,    color: 'text-sky-500' },
  carousel: { label: 'Carrossel',  icon: Rows3,         color: 'text-violet-500' },
  location: { label: 'Localização', icon: MapPin,       color: 'text-teal-500' },
}

const SIDEBAR_TABS = [
  { id: 'follow_geral'    as SequenceTipo, label: 'Follow Geral',    icon: Clock        },
  { id: 'anti_noshow'     as SequenceTipo, label: 'Anti-Noshow',     icon: CalendarClock },
  { id: 'follow_proposta' as SequenceTipo, label: 'Follow Proposta', icon: FileText     },
  { id: 'remarketing'     as SequenceTipo, label: 'Remarketing',     icon: Megaphone    },
]

const EMPTY_STEP = (): FollowStep => ({
  dia_offset: 1, horario: '09:00', mensagem: '', pool_mensagens: [],
  usar_ia: false, usar_contexto_sdr: false, ordem: 0,
  tipo_mensagem: 'text', media_config: {},
})

// ─── WhatsApp Preview ─────────────────────────────────────────────────────────

function WaPreview({ step }: { step: FollowStep }) {
  const { tipo_mensagem: tipo, mensagem, media_config: media } = step
  const text = mensagem || (tipo === 'text' ? 'Sua mensagem aparecerá aqui…' : '')

  return (
    <div className="rounded-xl overflow-hidden bg-[#0b141a] flex flex-col min-h-[220px]">
      {/* WA header mock */}
      <div className="flex items-center gap-2.5 px-3 py-2.5 bg-[#202c33]">
        <div className="w-7 h-7 rounded-full bg-[#3a4a54] flex items-center justify-center">
          <Phone className="w-3.5 h-3.5 text-[#8696a0]" />
        </div>
        <div>
          <p className="text-[11px] font-medium text-[#e9edef]">Lead</p>
          <p className="text-[10px] text-[#8696a0]">online</p>
        </div>
      </div>

      {/* Messages area */}
      <div className="flex-1 p-3 flex flex-col justify-end gap-1.5">
        {/* Outbound bubble */}
        <div className="flex justify-end">
          <div className="bg-[#005c4b] rounded-xl rounded-tr-sm px-3 py-2 max-w-[88%] space-y-1.5 shadow">

            {tipo === 'image' && (
              <div className="w-full h-28 rounded-lg overflow-hidden bg-[#007a62] flex items-center justify-center">
                {media.file
                  ? <img src={media.file} className="h-full w-full object-cover" alt="" />
                  : <Image className="w-7 h-7 text-[#00a884]/60" />}
              </div>
            )}

            {tipo === 'video' && (
              <div className="w-full h-28 rounded-lg bg-[#007a62] flex items-center justify-center">
                <Video className="w-7 h-7 text-[#00a884]/60" />
                <span className="text-[10px] text-[#cfe9e5] ml-2">Vídeo</span>
              </div>
            )}

            {(tipo === 'audio' || tipo === 'ptt') && (
              <div className="flex items-center gap-2 py-1">
                <div className="w-7 h-7 rounded-full bg-[#00a884] flex items-center justify-center shrink-0">
                  <Mic className="w-3.5 h-3.5 text-white" />
                </div>
                <div className="flex-1 h-1.5 rounded-full bg-[#00a884]/40 overflow-hidden">
                  <div className="h-full w-[60%] bg-[#00a884] rounded-full" />
                </div>
                <span className="text-[10px] text-[#8696a0] shrink-0">0:12</span>
              </div>
            )}

            {tipo === 'document' && (
              <div className="flex items-center gap-2 py-1">
                <div className="w-8 h-8 rounded-lg bg-[#00a884]/30 flex items-center justify-center shrink-0">
                  <FileText className="w-4 h-4 text-[#00a884]" />
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

            {tipo === 'carousel' && (
              <div className="space-y-1.5">
                {text && <p className="text-[12px] text-[#e9edef] leading-relaxed whitespace-pre-wrap">{text}</p>}
                <div className="flex gap-2 overflow-hidden">
                  {(media.carousel ?? [{ text: 'Item 1' }]).slice(0, 2).map((item, i) => (
                    <div key={i} className="min-w-[110px] rounded-lg bg-[#202c33] border border-[#2a3942] overflow-hidden shrink-0">
                      {item.image
                        ? <img src={item.image} className="w-full h-14 object-cover" alt="" />
                        : <div className="w-full h-14 bg-[#2a3942] flex items-center justify-center"><Image className="w-4 h-4 text-[#8696a0]" /></div>}
                      <p className="text-[10px] text-[#e9edef] px-2 py-1.5 truncate">{item.text || `Item ${i + 1}`}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Text for non-menu/carousel types */}
            {tipo !== 'menu' && tipo !== 'carousel' && text && (
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

// ─── Media editor ─────────────────────────────────────────────────────────────

function MediaEditor({ tipo, config, onChange }: { tipo: StepTipo; config: MediaConfig; onChange: (p: Partial<MediaConfig>) => void }) {
  if (tipo === 'text') return null

  if (['image', 'video', 'document', 'audio', 'ptt'].includes(tipo)) {
    return (
      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">URL do arquivo</Label>
          <Input value={config.file ?? ''} onChange={(e) => onChange({ file: e.target.value })} placeholder="https://…" className="h-9 text-sm font-mono" />
        </div>
        {(tipo === 'image' || tipo === 'video') && (
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Legenda (opcional)</Label>
            <Input value={config.text ?? ''} onChange={(e) => onChange({ text: e.target.value })} placeholder="Legenda da mídia…" className="h-9 text-sm" />
          </div>
        )}
        {tipo === 'document' && (
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Nome do arquivo</Label>
            <Input value={config.docName ?? ''} onChange={(e) => onChange({ docName: e.target.value })} placeholder="relatorio.pdf" className="h-9 text-sm" />
          </div>
        )}
        {(tipo === 'image' || tipo === 'video') && (
          <div className="flex items-center gap-3 py-2 px-3 rounded-lg border border-border bg-muted/20">
            <Switch checked={config.viewOnce ?? false} onCheckedChange={(v) => onChange({ viewOnce: v })} />
            <p className="text-sm">Ver uma vez</p>
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

  if (tipo === 'carousel') {
    const items = config.carousel ?? []
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-xs text-muted-foreground">Itens</Label>
          <Button type="button" variant="ghost" size="sm" className="h-6 text-xs px-2" onClick={() => onChange({ carousel: [...items, { text: '', image: '' }] })}>
            <Plus className="w-3 h-3 mr-1" /> Adicionar
          </Button>
        </div>
        {items.map((item, i) => (
          <div key={i} className="rounded-lg border border-border p-3 space-y-2 bg-muted/10">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Item {i + 1}</span>
              <Button type="button" variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:text-destructive" onClick={() => onChange({ carousel: items.filter((_, idx) => idx !== i) })}>
                <Trash2 className="w-3 h-3" />
              </Button>
            </div>
            <Input value={item.image ?? ''} placeholder="URL da imagem" className="h-8 text-sm font-mono" onChange={(e) => { const n = [...items]; n[i] = { ...n[i], image: e.target.value }; onChange({ carousel: n }) }} />
            <Input value={item.text} placeholder="Texto do item…" className="h-8 text-sm" onChange={(e) => { const n = [...items]; n[i] = { ...n[i], text: e.target.value }; onChange({ carousel: n }) }} />
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
          <Input value={config.name ?? ''} onChange={(e) => onChange({ name: e.target.value })} className="h-9 text-sm" placeholder="Escritório" />
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

// ─── Step editor ──────────────────────────────────────────────────────────────

function StepEditor({ step, index, tipo, total, onChange, onRemove, isPreviewStep }: {
  step: FollowStep; index: number; tipo: SequenceTipo; total: number
  onChange: (p: Partial<FollowStep>) => void; onRemove: () => void; isPreviewStep?: boolean
}) {
  const isAntiNoshow = tipo === 'anti_noshow'
  const absHours = Math.abs(step.dia_offset)
  const direction: 'antes' | 'depois' = step.dia_offset <= 0 ? 'antes' : 'depois'
  const needsText = ['text', 'menu', 'carousel'].includes(step.tipo_mensagem)

  return (
    <div className={cn('rounded-xl border bg-background shadow-sm overflow-hidden', isPreviewStep ? 'border-primary/40' : 'border-border')}>
      <div className="flex items-center justify-between px-4 py-2.5 bg-muted/30 border-b border-border">
        <span className="text-sm font-semibold">Passo {index + 1}</span>
        {total > 1 && (
          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={onRemove}>
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        )}
      </div>
      <div className="p-4 space-y-4">
        {/* Timing */}
        <div className="space-y-2">
          <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Quando disparar</Label>
          {isAntiNoshow ? (
            <div className="flex items-center gap-2 flex-wrap">
              <Input type="number" min={0} value={absHours} onChange={(e) => onChange({ dia_offset: direction === 'antes' ? -Math.abs(parseInt(e.target.value) || 0) : Math.abs(parseInt(e.target.value) || 0) })} className="w-20 h-9 text-sm text-center font-mono" />
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
              <Input type="number" min={1} value={step.dia_offset} onChange={(e) => onChange({ dia_offset: parseInt(e.target.value) || 1 })} className="w-20 h-9 text-sm text-center font-mono" />
              <span className="text-sm text-muted-foreground">{step.dia_offset === 1 ? 'dia' : 'dias'} sem resposta, às</span>
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
            <div className="flex items-center gap-3 py-2 px-3 rounded-lg border border-border bg-muted/20">
              <Switch checked={step.usar_ia} onCheckedChange={(v) => onChange({ usar_ia: v })} />
              <div>
                <p className="text-sm font-medium flex items-center gap-1.5"><Sparkles className="w-3.5 h-3.5 text-primary" /> Gerar com IA</p>
                <p className="text-xs text-muted-foreground">A IA cria a mensagem baseada no contexto do lead</p>
              </div>
            </div>
            {step.usar_ia && (
              <div className="flex items-center gap-3 py-2 px-3 ml-4 rounded-lg border border-dashed border-border bg-muted/10">
                <Switch checked={step.usar_contexto_sdr} onCheckedChange={(v) => onChange({ usar_contexto_sdr: v })} />
                <div>
                  <p className="text-sm font-medium flex items-center gap-1.5 text-muted-foreground"><Bot className="w-3.5 h-3.5" /> Usar contexto SDR</p>
                  <p className="text-xs text-muted-foreground">Inclui o prompt do agente para manter o tom</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Texto principal */}
        {!step.usar_ia && needsText && (
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              {step.tipo_mensagem === 'text' ? 'Mensagem' : 'Texto introdutório'}
            </Label>
            <Textarea value={step.mensagem} onChange={(e) => onChange({ mensagem: e.target.value })}
              placeholder="Oi, {nome}! Gostaria de retomar nossa conversa…"
              className="min-h-[80px] text-sm resize-none" />
          </div>
        )}

        {/* Media config */}
        {step.tipo_mensagem !== 'text' && (
          <MediaEditor tipo={step.tipo_mensagem} config={step.media_config}
            onChange={(patch) => onChange({ media_config: { ...step.media_config, ...patch } })} />
        )}
      </div>
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
          { label: 'Enviados',          value: stats.total_enviados,    icon: MessageSquare, color: 'text-blue-600' },
          { label: 'Falhas',            value: stats.total_falhas,      icon: XCircle,       color: 'text-red-500' },
          { label: 'Sequências ativas', value: stats.sequencias_ativas, icon: CheckCircle2,  color: 'text-emerald-600' },
          { label: 'Responderam',       value: stats.ultimos.filter(u => u.respondeu).length, icon: BarChart2, color: 'text-purple-600' },
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
              <div key={log.id} className="flex items-start gap-3 px-4 py-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{log.lead_name}</span>
                    {log.respondeu && <span className="text-xs text-emerald-600 flex items-center gap-0.5"><CheckCircle2 className="w-3 h-3" /> Respondeu</span>}
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
  const [previewStepIdx, setPreviewStepIdx] = useState(0)
  const [form, setForm] = useState<{ nome: string; ativo: boolean; steps: FollowStep[] }>({ nome: '', ativo: true, steps: [EMPTY_STEP()] })

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
    const tipo = activeTab === 'metricas' ? 'follow_geral' : activeTab as SequenceTipo
    setForm({ nome: '', ativo: true, steps: [EMPTY_STEP()] })
    setPreviewStepIdx(0)
    setDialogOpen(true)
  }

  function openEdit(seq: FollowSequence) {
    setEditing(seq)
    setForm({
      nome: seq.nome, ativo: seq.ativo,
      steps: seq.follow_steps.length > 0
        ? seq.follow_steps.map((s) => ({ ...s, mensagem: s.mensagem ?? '', pool_mensagens: s.pool_mensagens ?? [], tipo_mensagem: s.tipo_mensagem ?? 'text', media_config: s.media_config ?? {} }))
        : [EMPTY_STEP()],
    })
    setPreviewStepIdx(0)
    setDialogOpen(true)
  }

  function updateStep(i: number, patch: Partial<FollowStep>) {
    setForm((prev) => ({ ...prev, steps: prev.steps.map((s, idx) => idx === i ? { ...s, ...patch } : s) }))
    setPreviewStepIdx(i)
  }

  function addStep() {
    const tipo = activeTab === 'metricas' ? 'follow_geral' : activeTab as SequenceTipo
    const isHours = TIPO_CONFIG[editing?.tipo ?? tipo]?.isHours
    setForm((prev) => {
      const last = prev.steps[prev.steps.length - 1]
      const nextOffset = isHours ? (last?.dia_offset ?? -24) - 1 : (last?.dia_offset ?? 0) + 1
      const newIdx = prev.steps.length
      setPreviewStepIdx(newIdx)
      return { ...prev, steps: [...prev.steps, { ...EMPTY_STEP(), dia_offset: nextOffset, ordem: newIdx }] }
    })
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

  return (
    <div className="max-w-5xl mx-auto p-4 md:p-6 pb-8">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Follow-up & Remarketing</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Cadências automáticas de engajamento</p>
        </div>
      </div>

      {/* Body */}
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
            {/* Card header */}
            <div className="flex items-center gap-3 px-5 py-4 bg-muted/20 border-b border-border">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <CurrentIcon className="w-4 h-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm">{activeTab === 'metricas' ? 'Métricas' : currentCfg?.label}</p>
                <p className="text-xs text-muted-foreground">{activeTab === 'metricas' ? 'Últimos 30 dias de disparos' : currentCfg?.desc}</p>
              </div>
              {activeTab !== 'metricas' && (
                <Button onClick={openNew} size="sm" className="h-8 gap-1.5 shrink-0">
                  <Plus className="w-3.5 h-3.5" /> Nova cadência
                </Button>
              )}
            </div>

            {/* Card body */}
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

      {/* Dialog criar/editar — duas colunas: config + preview */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {editing ? <Pencil className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
              {editing ? 'Editar cadência' : `Nova cadência — ${TIPO_CONFIG[dialogTipo]?.label}`}
            </DialogTitle>
          </DialogHeader>

          <div className="flex gap-5 flex-1 overflow-hidden min-h-0">
            {/* Esquerda: configuração */}
            <div className="flex-1 overflow-y-auto space-y-4 pr-1">
              {/* Nome + ativo */}
              <div className="flex items-end gap-3">
                <div className="flex-1 space-y-1.5">
                  <Label>Nome *</Label>
                  <Input value={form.nome} onChange={(e) => setForm((p) => ({ ...p, nome: e.target.value }))} placeholder="Ex: Follow 7 dias" />
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

              {/* Passos */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold">Passos</p>
                  <Button variant="outline" size="sm" onClick={addStep} className="h-7 text-xs">
                    <Plus className="w-3.5 h-3.5 mr-1" /> Adicionar passo
                  </Button>
                </div>
                {form.steps.map((step, i) => (
                  <StepEditor key={i} step={step} index={i} tipo={dialogTipo} total={form.steps.length}
                    isPreviewStep={previewStepIdx === i}
                    onChange={(patch) => updateStep(i, patch)}
                    onRemove={() => { setForm((p) => ({ ...p, steps: p.steps.filter((_, idx) => idx !== i) })); setPreviewStepIdx(Math.max(0, i - 1)) }} />
                ))}
              </div>
            </div>

            {/* Direita: preview WhatsApp */}
            <div className="w-56 shrink-0 space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Preview</p>
              <p className="text-[11px] text-muted-foreground">Passo {previewStepIdx + 1}</p>
              {form.steps[previewStepIdx] && <WaPreview step={form.steps[previewStepIdx]} />}
              {form.steps.length > 1 && (
                <div className="flex gap-1 justify-center pt-1">
                  {form.steps.map((_, i) => (
                    <button key={i} onClick={() => setPreviewStepIdx(i)}
                      className={cn('w-1.5 h-1.5 rounded-full transition-all', previewStepIdx === i ? 'bg-primary' : 'bg-muted-foreground/30')} />
                  ))}
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="pt-3 border-t border-border">
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
