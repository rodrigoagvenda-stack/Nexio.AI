'use client';

import { useState, useEffect, useMemo, useCallback, memo, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useUser } from '@/lib/hooks/useUser';
import { useRouter, useSearchParams } from 'next/navigation';
import { OrbitCard, OrbitCardContent } from '@/components/ui/orbit-card';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Plus, Pencil, Trash2, Search, Flame, Phone, DollarSign, Building2, Download, Filter, Megaphone, UserPlus, MessageCircle, Star, FileText, CheckCircle2, XCircle, Repeat2, LayoutList, LayoutGrid, GitBranch, Clock, CheckCheck, MoreHorizontal, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from '@/components/ui/use-toast';
import { Lead } from '@/types/database.types';
import { SimplePagination } from '@/components/ui/pagination-simple';
import ChargeLeadModal from '@/components/crm/ChargeLeadModal';
import {
  DndContext,
  closestCorners,
  pointerWithin,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  useDroppable,
  DragOverEvent,
  UniqueIdentifier,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';

// 🔗 Fusão Kanban WA → Kanban de leads : estado da conversa vinculada por telefone
interface ConversaState {
  kanban_stage?: string | null;
  current_status?: string | null;
  contagem_nao_lida?: number | null;
  queue_entered_at?: string | null;
  lead_score?: number | null;
  hora_da_ultima_mensagem?: string | null;
  ultima_mensagem_inbound_at?: string | null;
  lead_source?: { headline?: string; utm_campaign?: string; utm_source?: string } | null;
}
type LeadWithConversa = Lead & { _conversa?: ConversaState; _sequenceStats?: { count: number; lastSent: string | null } };

function getConversaBadge(conversa?: ConversaState): { label: string; className: string; Icon: typeof Clock } | null {
  if (!conversa) return null;
  if (conversa.current_status === 'em_atendimento') {
    return { label: 'Atendendo', className: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400', Icon: UserPlus };
  }
  if (conversa.kanban_stage === 'fila' || conversa.current_status === 'livre') {
    return { label: 'Na fila', className: 'bg-amber-500/10 text-amber-600 dark:text-amber-400', Icon: Clock };
  }
  if (conversa.current_status === 'sdr') {
    return { label: 'IA respondendo', className: 'bg-blue-500/10 text-blue-600 dark:text-blue-400', Icon: MessageCircle };
  }
  return null;
}

function fmtCompact(v: number): string {
  if (!v || v <= 0) return '-';
  if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(1).replace('.', ',')}M`;
  if (v >= 1_000) {
    const k = v / 1_000;
    return `R$ ${(k >= 100 ? Math.round(k).toString() : k.toFixed(1).replace('.', ','))}k`;
  }
  return `R$ ${Math.round(v)}`;
}

const photoCache: Record<string, string | null> = {}

const DAY_MS = 86_400_000
/** Depois de tantos dias sem falar com o lead, a etapa aberta vira alerta. */
const STALE_DAYS = 3
const STAGES = ['Triagem', 'Lead novo', 'Em contato', 'Interessado', 'Proposta enviada', 'Fechado', 'Perdido'] as const
const STAGE_DOT: Record<string, string> = {
  'Triagem': 'bg-orange-400', 'Lead novo': 'bg-blue-500', 'Em contato': 'bg-pink-500', 'Interessado': 'bg-green-500',
  'Proposta enviada': 'bg-sky-400', 'Fechado': 'bg-[#96F63C]', 'Perdido': 'bg-red-500', 'Outbound': 'bg-violet-400', 'Remarketing': 'bg-amber-400',
}
const STAGE_CHIP: Record<string, string> = {
  'Triagem': 'bg-orange-500/15 text-orange-700 dark:text-orange-300', 'Lead novo': 'bg-blue-500/15 text-blue-700 dark:text-blue-300',
  'Em contato': 'bg-pink-500/15 text-pink-700 dark:text-pink-300', 'Interessado': 'bg-green-500/15 text-green-700 dark:text-green-300',
  'Proposta enviada': 'bg-sky-500/15 text-sky-700 dark:text-sky-300', 'Fechado': 'bg-[#96F63C]/25 text-[#3a6b0a] dark:text-[#96F63C]',
  'Perdido': 'bg-red-500/15 text-red-700 dark:text-red-300', 'Outbound': 'bg-violet-500/15 text-violet-700 dark:text-violet-300', 'Remarketing': 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
}
/** Faixa "Automações e etiquetas": Outbound e Remarketing são etapas, as outras três são etiquetas. */
const AUTOMATIONS: { id: string; kind: 'status' | 'tag'; dot: string }[] = [
  { id: 'Outbound', kind: 'status', dot: 'bg-violet-400' },
  { id: 'Remarketing', kind: 'status', dot: 'bg-amber-400' },
  { id: 'Follow up', kind: 'tag', dot: 'bg-blue-500' },
  { id: 'No-show', kind: 'tag', dot: 'bg-red-500' },
  { id: 'Promoção', kind: 'tag', dot: 'bg-amber-500' },
]
const OPEN_STAGE = (s: string) => s !== 'Fechado' && s !== 'Perdido'

function originLabel(src?: string | null): string {
  if (!src) return 'Sem origem'
  if (src === 'PEG') return 'Orbit'
  if (src === 'Interno') return 'Cadastro manual'
  return src
}

/** Quem falou por último e quando (a partir da conversa vinculada ao lead). */
function lastContactOf(lead: LeadWithConversa): { at: string; by: 'lead' | 'us' } | null {
  const c = lead._conversa
  if (!c?.hora_da_ultima_mensagem) return null
  const last = +new Date(c.hora_da_ultima_mensagem)
  const inbound = c.ultima_mensagem_inbound_at ? +new Date(c.ultima_mensagem_inbound_at) : 0
  return { at: c.hora_da_ultima_mensagem, by: inbound && inbound >= last - 5000 ? 'lead' : 'us' }
}

function ageShort(iso: string): string {
  const diff = Date.now() - +new Date(iso)
  if (diff < 60_000) return 'agora'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}min`
  if (diff < DAY_MS) return `${Math.floor(diff / 3_600_000)}h`
  return `${Math.floor(diff / DAY_MS)}d`
}

/** Dias parado: desde a última mensagem; sem conversa, desde a última mudança no lead. */
function idleDays(lead: LeadWithConversa): number {
  const ref = lastContactOf(lead)?.at ?? lead.updated_at ?? lead.created_at
  return Math.floor((Date.now() - +new Date(ref)) / DAY_MS)
}

function ContactLine({ lead }: { lead: LeadWithConversa }) {
  if (lead.status === 'Fechado' && lead.closed_at) {
    return (
      <span className="flex items-center gap-1.5 text-xs text-green-700 dark:text-green-400">
        <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
        Fechou em {new Date(lead.closed_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '')}
      </span>
    )
  }
  const lc = lastContactOf(lead)
  if (!lc) return <span className="text-xs text-muted-foreground">Sem conversa</span>
  const stale = OPEN_STAGE(lead.status) && idleDays(lead) >= STALE_DAYS
  const who = lc.by === 'lead' ? 'Lead falou' : 'Nós falamos'
  return (
    <span className={cn('flex items-center gap-1.5 text-xs', stale ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground')}>
      <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', stale ? 'bg-red-500' : lc.by === 'lead' ? 'bg-green-500' : 'bg-muted-foreground/60')} />
      {who} há {ageShort(lc.at)}
    </span>
  )
}

const TAG_STYLE = (color?: string | null) => (color ? { backgroundColor: `${color}22`, color } : undefined)

// 🚀 PERFORMANCE: Componente memoizado para evitar re-renders desnecessários
const SortableLeadCard = memo(function SortableLeadCard({ lead, onEdit, onDelete, onCharge, onOpenConversa, onRemoveTag }: {
  lead: LeadWithConversa; onEdit: () => void; onDelete: () => void; onCharge: () => void; onOpenConversa: () => void
  onRemoveTag: (lead: LeadWithConversa, tagId: number, tagName: string) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: lead.id, data: { type: 'lead', lead } })
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)
  const [longPressed, setLongPressed] = useState(false)
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const longPressTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleTouchStart = () => {
    longPressTimer.current = setTimeout(() => {
      setLongPressed(true)
      longPressTimeout.current = setTimeout(() => setLongPressed(false), 3000)
    }, 500)
  }
  const handleTouchEnd = () => { if (longPressTimer.current) clearTimeout(longPressTimer.current) }

  useEffect(() => {
    if (!lead.whatsapp) return
    if (lead.whatsapp in photoCache) { setPhotoUrl(photoCache[lead.whatsapp]); return }
    fetch(`/api/chat/contact-photo?phone=${encodeURIComponent(lead.whatsapp)}&leadId=${lead.id}`)
      .then((r) => r.json())
      .then((d) => { photoCache[lead.whatsapp!] = d.photo ?? null; setPhotoUrl(d.photo ?? null) })
      .catch(() => {})
  }, [lead.whatsapp])

  const style = { transform: CSS.Transform.toString(transform), transition: transition || 'transform 200ms ease', opacity: isDragging ? 0.5 : 1 }
  const initials = (lead.contact_name || lead.company_name || '??').split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
  const badge = getConversaBadge(lead._conversa)
  const hot = lead.nivel_interesse?.includes('Quente')
  const chip = 'inline-flex h-fit items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold'
  const tags = ((lead.lead_tags as any[]) ?? []).filter((lt) => lt.tags)
  const actionCls = 'h-7 w-7 rounded-md transition-opacity md:opacity-0 md:group-hover:opacity-100 focus-visible:opacity-100'

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners} onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd} onTouchMove={handleTouchEnd}>
      <div
        className="group mb-2.5 flex cursor-pointer flex-col gap-2.5 rounded-xl border border-border bg-card p-3.5 transition-colors hover:border-foreground/25"
        title="Abrir conversa deste lead"
        onClick={() => { if (!isDragging) onOpenConversa() }}
      >
        <div className="flex items-start gap-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-accent text-[11px] font-bold text-[#01573C] dark:text-[#96F63C]">
            {photoUrl ? <img src={photoUrl} alt="" className="h-full w-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} /> : initials}
          </span>
          <div className="min-w-0 flex-1">
            <h4 className="truncate text-[15px] font-semibold leading-5 text-foreground">{lead.contact_name || lead.company_name}</h4>
            {lead.contact_name && lead.company_name && lead.company_name !== lead.contact_name && <p className="truncate text-xs text-muted-foreground">{lead.company_name}</p>}
          </div>
          <div className="flex shrink-0" style={{ pointerEvents: 'auto' }}>
            <Button variant="ghost" size="icon" className={actionCls} style={{ opacity: longPressed ? 1 : undefined }} title="Gerar cobrança" aria-label="Gerar cobrança" onPointerDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); e.preventDefault(); onCharge() }}><DollarSign className="h-3.5 w-3.5" /></Button>
            <Button variant="ghost" size="icon" className={actionCls} style={{ opacity: longPressed ? 1 : undefined }} title="Editar lead" aria-label="Editar lead" onPointerDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); e.preventDefault(); onEdit() }}><Pencil className="h-3.5 w-3.5" /></Button>
            <Button variant="ghost" size="icon" className={cn(actionCls, 'hover:text-destructive')} style={{ opacity: longPressed ? 1 : undefined }} title="Excluir lead" aria-label="Excluir lead" onPointerDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); e.preventDefault(); onDelete() }}><Trash2 className="h-3.5 w-3.5" /></Button>
          </div>
        </div>

        {(lead.nivel_interesse || lead.priority || badge || tags.length > 0) && (
          <div className="flex flex-wrap gap-1.5">
            {lead.nivel_interesse && (
              <span className={cn(chip, hot ? 'bg-orange-500/15 text-orange-700 dark:text-orange-300' : lead.nivel_interesse.includes('Morno') ? 'bg-blue-500/15 text-blue-700 dark:text-blue-300' : 'bg-muted text-muted-foreground')}>
                {hot && <Flame className="h-3 w-3" />}{lead.nivel_interesse.replace(/[^\p{L}\s]/gu, '').trim()}
              </span>
            )}
            {lead.priority && (
              <span className={cn(chip, lead.priority === 'Alta' ? 'bg-red-500/15 text-red-700 dark:text-red-300' : 'bg-muted text-muted-foreground')}>{lead.priority}</span>
            )}
            {badge && <span className={cn(chip, badge.className)}><badge.Icon className="h-3 w-3" />{badge.label}</span>}
            {tags.map((lt: any) => (
              <span key={lt.tag_id} className={cn(chip, 'group/tag')} style={TAG_STYLE(lt.tags.tag_color)}>
                {lt.tags.tag_name}
                <button
                  type="button"
                  aria-label={`Remover etiqueta ${lt.tags.tag_name}`}
                  className="-mr-1 hidden rounded p-0.5 hover:bg-black/10 group-hover/tag:inline-flex"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => { e.stopPropagation(); e.preventDefault(); onRemoveTag(lead, lt.tag_id, lt.tags.tag_name) }}
                ><XCircle className="h-3 w-3" /></button>
              </span>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between gap-2">
          <span className={cn('text-[15px] font-semibold tabular-nums', lead.project_value ? 'text-foreground' : 'text-sm font-normal text-muted-foreground')}>
            {lead.project_value ? `R$ ${Number(lead.project_value).toLocaleString('pt-BR')}` : 'Sem valor'}
          </span>
          <span className="flex min-w-0 items-center gap-2">
            {!!lead._conversa?.contagem_nao_lida && lead._conversa.contagem_nao_lida > 0 && (
              <span className="flex items-center gap-0.5 text-[11px] font-semibold text-[#01573C] dark:text-[#96F63C]"><MessageCircle className="h-3 w-3" />{lead._conversa.contagem_nao_lida}</span>
            )}
            <ContactLine lead={lead} />
          </span>
        </div>
      </div>
    </div>
  )
})

const MobileLeadCard = memo(function MobileLeadCard({ lead, onEdit, onDelete, onCharge, onOpenConversa }: { lead: LeadWithConversa; onEdit: () => void; onDelete: () => void; onCharge: () => void; onOpenConversa: () => void }) {
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!lead.whatsapp) return;
    if (lead.whatsapp in photoCache) { setPhotoUrl(photoCache[lead.whatsapp]); return; }
    fetch(`/api/chat/contact-photo?phone=${encodeURIComponent(lead.whatsapp)}&leadId=${lead.id}`)
      .then(r => r.json())
      .then(d => { photoCache[lead.whatsapp!] = d.photo ?? null; setPhotoUrl(d.photo ?? null); })
      .catch(() => {});
  }, [lead.whatsapp]);

  const getPriorityColor = (priority: string) => {
    const map: Record<string, string> = {
      'Alta': 'bg-red-500/10 text-red-600 dark:text-red-400',
      'Média': 'bg-primary/10 text-primary',
      'Baixa': 'bg-gray-500/10 text-gray-600 dark:text-gray-400',
    };
    return map[priority] || map['Baixa'];
  };

  const getInitials = (name: string) =>
    name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '??';

  return (
    <OrbitCard className="hover:shadow-md transition-shadow cursor-pointer" onClick={onOpenConversa}>
      <OrbitCardContent className="p-3 space-y-2">
        <div className="flex items-start gap-2.5">
          <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden" style={{ backgroundColor: 'rgba(1,87,60,0.18)' }}>
            {photoUrl
              ? <img src={photoUrl} alt={lead.contact_name || lead.company_name} className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
              : <span className="text-[10px] font-bold" style={{ color: '#34B270' }}>{getInitials(lead.contact_name || lead.company_name)}</span>
            }
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="font-semibold text-sm leading-tight truncate">{lead.company_name}</h4>
            {lead.contact_name && <p className="text-xs text-muted-foreground truncate">{lead.contact_name}</p>}
          </div>
          <div className="flex gap-0.5 flex-shrink-0">
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={(e) => { e.stopPropagation(); onEdit(); }}>
              <Pencil className="h-3 w-3" />
            </Button>
            <Button
              variant="ghost" size="icon"
              className="h-6 w-6 text-destructive"
              onClick={(e) => { e.stopPropagation(); onDelete(); }}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        </div>
        <div className="flex flex-wrap gap-1 items-center">
          {lead.priority && (
            <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-medium ${getPriorityColor(lead.priority)}`}>{lead.priority}</span>
          )}
          {lead.nivel_interesse && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-md font-medium bg-blue-500/10 text-blue-600 dark:text-blue-400">{lead.nivel_interesse}</span>
          )}
          {lead.segment && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-md font-medium bg-green-500/10 text-green-600 dark:text-green-400">{lead.segment}</span>
          )}
          {(() => {
            const badge = getConversaBadge(lead._conversa);
            if (!badge) return null;
            const { Icon } = badge;
            return (
              <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-medium flex items-center gap-0.5 ${badge.className}`}>
                <Icon className="h-2.5 w-2.5" />
                {badge.label}
              </span>
            );
          })()}
          {!!lead._conversa?.contagem_nao_lida && lead._conversa.contagem_nao_lida > 0 && (
            <span className="flex items-center gap-0.5 text-[10px] font-semibold text-primary">
              <MessageCircle className="h-2.5 w-2.5" />
              {lead._conversa.contagem_nao_lida}
            </span>
          )}
          {(lead.lead_tags as any[])?.map((lt: any) => {
            const tag = lt.tags;
            if (!tag) return null;
            return (
              <span key={lt.tag_id} className="text-[10px] px-1.5 py-0.5 rounded-md font-medium" style={{ backgroundColor: `${tag.tag_color}22`, color: tag.tag_color }}>
                {tag.tag_name}
              </span>
            );
          })}
          {(() => {
            const src = lead._conversa?.lead_source;
            const label = src?.utm_campaign || src?.headline || src?.utm_source;
            if (!label) return null;
            return (
              <span className="text-[10px] px-1.5 py-0.5 rounded-md font-medium flex items-center gap-0.5 bg-purple-500/10 text-purple-600 dark:text-purple-400 max-w-[110px]" title={label}>
                <Megaphone className="h-2.5 w-2.5 shrink-0" />
                <span className="truncate">{label}</span>
              </span>
            );
          })()}
          {typeof lead._conversa?.lead_score === 'number' && (
            <span className="flex items-center gap-0.5 text-[10px] font-semibold text-muted-foreground" title="Lead score">
              <Flame className="h-2.5 w-2.5" />
              {lead._conversa.lead_score}
            </span>
          )}
          {lead.project_value && lead.project_value > 0 && (
            <span className="text-[10px] text-primary font-medium ml-auto">{fmtCompact(lead.project_value)}</span>
          )}
        </div>
      </OrbitCardContent>
    </OrbitCard>
  );
});

// Coluna de etapa: recebe cards arrastados e mostra contagem e valor
const DroppableColumn = memo(function DroppableColumn({ id, title, count, totalValue, children, extra }: {
  id: string; title: string; count: number; totalValue?: number; children: React.ReactNode; extra?: React.ReactNode
}) {
  const { setNodeRef, isOver } = useDroppable({ id, data: { type: 'column', status: id.replace('column-', '') } })
  return (
    <div
      ref={setNodeRef}
      className={cn('flex min-w-0 flex-col rounded-2xl border bg-muted/40 p-3 transition-colors', isOver ? 'border-[#1E6B47] bg-accent/60' : 'border-border')}
    >
      <div className="mb-3 flex flex-col gap-0.5 px-1.5">
        <div className="flex items-center gap-2">
          <span className={cn('h-2 w-2 shrink-0 rounded-full', STAGE_DOT[title] ?? 'bg-muted-foreground')} />
          <span className="min-w-0 truncate text-[15px] font-semibold text-foreground">{title}</span>
          <span className="ml-auto rounded-full bg-card px-2 py-0.5 text-xs font-medium tabular-nums text-muted-foreground">{count}</span>
        </div>
        <div className="flex items-center justify-between gap-2 pl-4">
          <span className="text-[13px] tabular-nums text-muted-foreground">{totalValue ? fmtCompact(totalValue) : 'Sem valor'}</span>
          {extra}
        </div>
      </div>
      {children}
    </div>
  )
})

// Cartão da faixa "Automações e etiquetas": filtra ao clicar e recebe cards arrastados
const AutomationTile = memo(function AutomationTile({ id, dot, count, value, active, onClick }: {
  id: string; dot: string; count: number; value: number; active: boolean; onClick: () => void
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `auto-${id}` })
  return (
    <button
      ref={setNodeRef}
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn('flex items-center justify-between gap-3 rounded-xl border px-5 py-4 text-left transition-colors', active || isOver ? 'border-[#1E6B47] bg-accent' : 'border-border bg-card hover:border-foreground/25')}
    >
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="flex items-center gap-2 text-[15px] font-semibold text-foreground"><span className={cn('h-2 w-2 shrink-0 rounded-full', dot)} />{id}</span>
        <span className="pl-4 text-[13px] tabular-nums text-muted-foreground">{value ? fmtCompact(value) : 'R$ 0'}</span>
      </span>
      <span className={cn('text-[28px] font-semibold tabular-nums leading-8', count === 0 && 'font-normal text-muted-foreground')}>{count}</span>
    </button>
  )
})

export default function CRMPage() {
  const router = useRouter();
  const { authUser, user, company, loading: userLoading } = useUser();
  const [leads, setLeads] = useState<LeadWithConversa[]>([]);
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 🔥 FIX: Pega viewMode direto da URL usando useSearchParams (reativo)
  const viewMode = useMemo(() => {
    const view = searchParams.get('view');
    return view === 'kanban' ? 'kanban' : 'table';
  }, [searchParams]);
  const [hasFetched, setHasFetched] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [deletingLead, setDeletingLead] = useState<Lead | null>(null);
  const [chargingLead, setChargingLead] = useState<Lead | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [originFilter, setOriginFilter] = useState('Todas');
  const [tagFilter, setTagFilter] = useState('Todas');
  const [priorityFilter, setPriorityFilter] = useState('Todas');
  const [staleFilter, setStaleFilter] = useState(0);
  const [autoFilter, setAutoFilter] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [sortDesc, setSortDesc] = useState(true);
  const [activeDragId, setActiveDragId] = useState<number | null>(null);
  const [overId, setOverId] = useState<string | number | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(50);
  const [selectedLeads, setSelectedLeads] = useState<Set<string>>(new Set());
  const [deletingMultipleLeads, setDeletingMultipleLeads] = useState(false);

  // Etiquetas de sistema (Follow up / No-show / Promoção) : ids resolvidos uma
  // vez, usados pra montar/desmontar as colunas de sequência no Kanban e pra
  // saber qual tagId mandar pro /api/tags/assign quando arrasta um card.
  const SEQ_TAG_NAMES = ['Follow up', 'No-show', 'Promoção'] as const;
  type SeqTagName = typeof SEQ_TAG_NAMES[number];
  const [systemTags, setSystemTags] = useState<{ followUpId: number | null; noShowId: number | null; promocaoId: number | null }>({ followUpId: null, noShowId: null, promocaoId: null });
  // Aviso de "já recebeu essa sequência inteira antes" : id do lead pendente
  // de confirmação antes de arrastar pra Follow up/No-show/Promoção de novo.
  const [pendingTagDrop, setPendingTagDrop] = useState<{ leadId: number; tagName: SeqTagName; tagId: number } | null>(null);

  // Stepper state
  const [currentStep, setCurrentStep] = useState(0);

  // Form state
  const [formData, setFormData] = useState({
    company_name: '',
    contact_name: '',
    segment: '',
    website_or_instagram: '',
    whatsapp: '',
    email: '',
    priority: 'Média',
    status: 'Lead novo',
    nivel_interesse: 'Quente 🔥',
    import_source: 'Interno',
    project_value: 0,
    notes: '',
    cargo: '',
  });

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Helper: registrar log via API (service client, bypassa RLS)
  const logActivity = (payload: { user_id?: string; company_id: number; action: string; description: string; metadata?: object }) => {
    fetch('/api/activity-logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).catch(() => {}); // fire-and-forget, nunca bloqueia o fluxo principal
  };


  useEffect(() => {
    if (!userLoading && !hasFetched) {
      if (!user) {
        // Usuário não está logado - redireciona para login
        router.push('/login');
        return;
      }

      if (user?.company_id) {
        fetchLeads();
        setHasFetched(true);
      } else if (user && !user.company_id) {
        setError('Usuário não configurado. Verifique o banco de dados.');
        setLoading(false);
        setHasFetched(true);
      }
    }
  }, [userLoading, user, hasFetched, router]);

  async function fetchLeads() {
    try {
      const supabase = createClient();
      // Achado ao vivo (Rodrigo, 2026-09-16) : ordenar por created_at com
      // limit(100) fazia lead reativado/movido de status (ex: marcado
      // "Remarketing" manualmente) sumir do Kanban inteiro sempre que a
      // empresa já tinha 100+ leads criados DEPOIS dele -- não é filtro por
      // coluna, o lead nunca chegava a ser buscado. Ordena por updated_at
      // (toda mudança de status/campo atualiza esse campo) e sobe o teto,
      // mesmo padrão de limit(500) já usado no Kanban de conversas.
      let query = supabase
        .from('leads')
        .select('*, lead_tags(tag_id, tags(id, tag_name, tag_color))')
        .eq('company_id', user?.company_id)
        .order('updated_at', { ascending: false, nullsFirst: false })
        .limit(500);

      // Closer puro só vê seus próprios leads atribuídos
      if (user?.role === 'closer') {
        query = query.eq('user_id', user.user_id);
      }

      const { data, error } = await query;

      if (error) throw error;

      // 🔗 Fusão Kanban WA : busca estado da conversa vinculada a cada lead pelo telefone
      const phones = Array.from(new Set((data ?? []).map((l: any) => l.whatsapp).filter(Boolean))) as string[];
      let convByPhone: Record<string, ConversaState> = {};
      if (phones.length > 0) {
        const { data: convs } = await supabase
          .from('conversas_do_whatsapp')
          .select('numero_de_telefone, kanban_stage, current_status, contagem_nao_lida, queue_entered_at, lead_score, lead_source, hora_da_ultima_mensagem, ultima_mensagem_inbound_at')
          .eq('company_id', user?.company_id)
          .in('numero_de_telefone', phones);
        for (const c of (convs ?? [])) {
          convByPhone[c.numero_de_telefone] = c;
        }
      }

      // Etiquetas de sistema (ids) : resolvidos aqui, usados pelo drag-drop
      // pra saber qual tagId atribuir quando o card cai em Follow up/No-show/Promoção.
      const { data: sysTags } = await supabase
        .from('tags')
        .select('id, tag_name')
        .eq('company_id', user?.company_id)
        .in('tag_name', ['Follow up', 'No-show', 'Promoção']);
      setSystemTags({
        followUpId: sysTags?.find((t: { id: number; tag_name: string }) => t.tag_name === 'Follow up')?.id ?? null,
        noShowId: sysTags?.find((t: { id: number; tag_name: string }) => t.tag_name === 'No-show')?.id ?? null,
        promocaoId: sysTags?.find((t: { id: number; tag_name: string }) => t.tag_name === 'Promoção')?.id ?? null,
      });

      // Contador de mensagens de reengajamento + data do último envio, pra
      // mostrar no card do Kanban (padrão HubSpot/Salesforce de mostrar
      // histórico de campanha direto no card, sem precisar abrir o lead).
      const leadIds = (data ?? []).map((l: any) => l.id);
      let statsByLead: Record<number, { count: number; lastSent: string | null }> = {};
      if (leadIds.length > 0) {
        const { data: execs } = await supabase
          .from('follow_executions')
          .select('lead_id, disparado_em')
          .eq('status', 'sent')
          .in('lead_id', leadIds);
        for (const ex of (execs ?? [])) {
          const cur = statsByLead[ex.lead_id] ?? { count: 0, lastSent: null };
          cur.count++;
          if (!cur.lastSent || ex.disparado_em > cur.lastSent) cur.lastSent = ex.disparado_em;
          statsByLead[ex.lead_id] = cur;
        }
      }

      setLeads((data ?? []).map((l: any) => ({
        ...l,
        _conversa: l.whatsapp ? convByPhone[l.whatsapp] : undefined,
        _sequenceStats: statsByLead[l.id],
      })));
    } catch (error) {
      console.error('Error fetching leads:', error);
      toast({ title: 'Erro ao carregar leads', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }

  // 🚀 PERFORMANCE: Memoizar handlers para evitar re-renders
  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveDragId(event.active.id as number);
    setOverId(null);
  }, []);

  // 🚀 PERFORMANCE: Remover handleDragOver - causava 100+ re-renders/segundo!
  // const handleDragOver = (event: DragOverEvent) => {
  //   const { over } = event;
  //   setOverId(over?.id ?? null);
  // };

  const SEQ_TAG_COLORS: Record<SeqTagName, string> = { 'Follow up': '#3b82f6', 'No-show': '#ef4444', 'Promoção': '#f59e0b' };

  // Aplica de fato a etiqueta de sequência : chamado direto (sem aviso) ou
  // depois de confirmar o dialog de "já recebeu essa sequência antes".
  const performTagDrop = useCallback(async (lead: LeadWithConversa, tagName: SeqTagName, tagId: number) => {
    const outrasTagNames = SEQ_TAG_NAMES.filter((t) => t !== tagName);
    // Otimista : atualiza UI antes da resposta do servidor (mesmo padrão do
    // resto do arquivo), removendo a etiqueta concorrente e status
    // Remarketing localmente pra refletir a exclusão mútua na hora.
    setLeads(prev => prev.map(l => {
      if (l.id !== lead.id) return l;
      const keptTags = ((l.lead_tags as any[]) ?? []).filter((lt) => !outrasTagNames.includes(lt.tags?.tag_name));
      const alreadyHas = keptTags.some((lt) => lt.tags?.tag_name === tagName);
      const newTags = alreadyHas ? keptTags : [...keptTags, { tag_id: tagId, tags: { id: tagId, tag_name: tagName, tag_color: SEQ_TAG_COLORS[tagName] } }];
      return { ...l, lead_tags: newTags, status: l.status === 'Remarketing' ? 'Em contato' : l.status } as LeadWithConversa;
    }));

    try {
      const res = await fetch('/api/tags/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadId: lead.id, tagId }),
      });
      const resData = await res.json().catch(() => ({}));
      if (!res.ok && resData?.message !== 'Tag já está atribuída a este lead') {
        throw new Error(resData?.message || `HTTP ${res.status}`);
      }
      if (user && company) {
        logActivity({
          user_id: user.auth_user_id,
          company_id: company.id,
          action: 'lead_tag_sequence',
          description: `Moveu lead "${lead.company_name}" para "${tagName}"`,
          metadata: { lead_id: lead.id, tag_name: tagName, lead_name: lead.company_name, contact_name: lead.contact_name },
        });
      }
      toast({ title: 'Lead movido!', description: `Movido para "${tagName}"` });
    } catch {
      toast({ title: 'Erro ao atualizar lead', variant: 'destructive' });
      fetchLeads();
    }
  }, [user, company]);

  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    setOverId(null);
    const { active, over } = event;
    setActiveDragId(null);
    if (!over) return;

    const lead = leads.find(l => l.id === active.id || String(l.id) === String(active.id));
    if (!lead) return;

    // Onde o card caiu: coluna de etapa, cartão da faixa (etapa Outbound/Remarketing ou etiqueta) ou outro card
    const overKey = String(over.id);
    let targetStatus: string | null = null;
    let targetTag: SeqTagName | null = null;
    if (overKey.startsWith('column-')) {
      targetStatus = overKey.replace('column-', '');
    } else if (overKey.startsWith('auto-')) {
      const name = overKey.replace('auto-', '');
      if ((SEQ_TAG_NAMES as readonly string[]).includes(name)) targetTag = name as SeqTagName;
      else targetStatus = name;
    } else {
      const targetLead = leads.find(l => String(l.id) === overKey);
      if (targetLead) targetStatus = targetLead.status;
    }

    // Etiqueta (Follow up / No-show / Promoção): o lead continua na etapa dele, só ganha a etiqueta,
    // que é o que dispara a sequência. A exclusão mútua entre elas é garantida no servidor.
    if (targetTag) {
      const SEQ_TAG_IDS: Record<SeqTagName, number | null> = { 'Follow up': systemTags.followUpId, 'No-show': systemTags.noShowId, 'Promoção': systemTags.promocaoId };
      const SEQ_TAG_EVENTO: Record<SeqTagName, string> = { 'Follow up': 'tag_follow_up', 'No-show': 'tag_no_show', 'Promoção': 'tag_promocao' };
      const tagId = SEQ_TAG_IDS[targetTag];
      if (!tagId) {
        toast({ title: 'Etiqueta de sistema não encontrada', description: 'Recarregue a página e tente de novo.', variant: 'destructive' });
        return;
      }
      const alreadyTagged = ((lead.lead_tags as any[]) ?? []).some((lt) => lt.tags?.tag_name === targetTag);
      if (alreadyTagged) return;

      // Aviso de "já recebeu essa sequência antes" antes de disparar tudo de novo do zero
      try {
        const supabase = createClient();
        const { data: seqRows } = await supabase
          .from('follow_sequences')
          .select('id')
          .eq('company_id', user?.company_id)
          .eq('tipo', 'follow_geral')
          .contains('canvas_config', { eventoEntrada: SEQ_TAG_EVENTO[targetTag] });
        const seqIds = (seqRows ?? []).map((s: any) => s.id);
        if (seqIds.length) {
          const { count } = await supabase
            .from('follow_executions')
            .select('id', { count: 'exact', head: true })
            .eq('lead_id', lead.id)
            .eq('status', 'sent')
            .in('sequence_id', seqIds);
          if (count && count > 0) {
            setPendingTagDrop({ leadId: lead.id, tagName: targetTag, tagId });
            return;
          }
        }
      } catch {
        // Falha na checagem não deve bloquear o arrastar: segue sem aviso.
      }
      await performTagDrop(lead, targetTag, tagId);
      return;
    }

    if (!targetStatus || targetStatus === lead.status) return;
    const newStatus = targetStatus as Lead['status'];
    const oldStatus = lead.status;

    // Update otimista (atualiza a tela na hora)
    setLeads(prevLeads => prevLeads.map(l =>
      (l.id === active.id || String(l.id) === String(active.id)) ? { ...l, status: newStatus! } : l
    ));

    // Persistir via API (trata a restrição única de outbound_campaigns)
    try {
      const res = await fetch(`/api/leads/${lead.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId: user?.company_id, field: 'status', value: newStatus }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || `HTTP ${res.status}`);
      }

      if (user && company) {
        logActivity({
          user_id: user.auth_user_id,
          company_id: company.id,
          action: 'lead_status_change',
          description: `Moveu lead "${lead.company_name}" para "${newStatus}"`,
          metadata: { lead_id: lead.id, old_status: oldStatus, new_status: newStatus, lead_name: lead.company_name, contact_name: lead.contact_name },
        });
      }
      toast({ title: 'Lead movido!', description: `Movido para "${newStatus}"` });
      router.refresh(); // invalida cache do Next.js → dashboard refetch ao voltar
    } catch {
      toast({ title: 'Erro ao atualizar lead', variant: 'destructive' });
      fetchLeads();
    }
  }, [leads, user, company, router, performTagDrop, systemTags]);

  // Tirar uma etiqueta (o ×  no chip do card): o lead não sai da etapa
  const handleRemoveTag = useCallback(async (lead: LeadWithConversa, tagId: number, tagName: string) => {
    setLeads(prev => prev.map(l => l.id === lead.id ? ({ ...l, lead_tags: ((l.lead_tags as any[]) ?? []).filter((lt) => lt.tag_id !== tagId) } as LeadWithConversa) : l));
    try {
      const res = await fetch('/api/tags/unassign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadId: lead.id, tagId, companyId: user?.company_id }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      toast({ title: 'Etiqueta removida', description: `"${tagName}" saiu de ${lead.contact_name || lead.company_name}` });
    } catch {
      toast({ title: 'Não foi possível remover a etiqueta', variant: 'destructive' });
      fetchLeads();
    }
  }, [user]);

  // Botão "Promover"/"Voltar todos" no header da coluna : move em lote todo
  // mundo de um status pra outro, mesmo endpoint por lead que o drag-and-drop
  // já usa (sem endpoint de bulk dedicado, lista de coluna nunca é grande o
  // suficiente pra precisar disso).
  const handleBulkStatusChange = useCallback(async (fromStatus: string, toStatus: Lead['status']) => {
    const toMove = leads.filter((l) => l.status === fromStatus);
    if (!toMove.length) return;

    setLeads((prev) => prev.map((l) => (l.status === fromStatus ? { ...l, status: toStatus } : l)));

    const results = await Promise.allSettled(
      toMove.map((lead) =>
        fetch(`/api/leads/${lead.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ companyId: user?.company_id, field: 'status', value: toStatus }),
        }).then((res) => { if (!res.ok) throw new Error(`HTTP ${res.status}`); })
      )
    );

    const failed = results.filter((r) => r.status === 'rejected').length;
    if (failed > 0) {
      toast({ title: `${failed} lead(s) não puderam ser movidos`, variant: 'destructive' });
      fetchLeads();
    } else {
      if (user && company) {
        logActivity({
          user_id: user.auth_user_id,
          company_id: company.id,
          action: 'lead_status_change',
          description: `Moveu ${toMove.length} lead(s) de "${fromStatus}" para "${toStatus}"`,
          metadata: { count: toMove.length, from_status: fromStatus, to_status: toStatus },
        });
      }
      toast({ title: `${toMove.length} lead(s) movido(s) para "${toStatus}"` });
      router.refresh();
    }
  }, [leads, user, company, router]);

  const handleOpenModal = useCallback((lead?: Lead) => {
    if (lead) {
      setEditingLead(lead);
      setFormData({
        company_name: lead.company_name || '',
        contact_name: lead.contact_name || '',
        segment: lead.segment || '',
        website_or_instagram: lead.website_or_instagram || '',
        whatsapp: lead.whatsapp || '',
        email: lead.email || '',
        priority: lead.priority || 'Média',
        status: lead.status || 'Lead novo',
        nivel_interesse: lead.nivel_interesse || 'Quente 🔥',
        import_source: lead.import_source || 'Interno',
        project_value: lead.project_value || 0,
        notes: lead.notes || '',
        cargo: lead.cargo || '',
      });
    } else {
      setEditingLead(null);
      setFormData({
        company_name: '',
        contact_name: '',
        segment: '',
        website_or_instagram: '',
        whatsapp: '',
        email: '',
        priority: 'Média',
        status: 'Lead novo',
        nivel_interesse: 'Quente 🔥',
        import_source: 'Interno',
        project_value: 0,
        notes: '',
        cargo: '',
      });
    }
    setCurrentStep(0); // Reset stepper to first step
    setShowModal(true);
  }, []);

  const handleSaveLead = useCallback(async () => {
    // Validar campos obrigatórios
    if (!formData.company_name.trim()) {
      toast({ title: 'Campo obrigatório', description: 'Nome da empresa é obrigatório', variant: 'destructive' });
      setCurrentStep(0);
      return;
    }
    if (!formData.segment) {
      toast({ title: 'Campo obrigatório', description: 'Segmento é obrigatório', variant: 'destructive' });
      setCurrentStep(0);
      return;
    }
    if (!formData.nivel_interesse) {
      toast({ title: 'Campo obrigatório', description: 'Nível de interesse é obrigatório', variant: 'destructive' });
      setCurrentStep(2);
      return;
    }
    if (!formData.import_source) {
      toast({ title: 'Campo obrigatório', description: 'Fonte de importação é obrigatória', variant: 'destructive' });
      setCurrentStep(2);
      return;
    }

    try {
      const supabase = createClient();

      // Verificar se temos os dados necessários
      if (!user?.company_id) {
        toast({ title: 'Erro de autenticação', description: 'company_id não encontrado. Faça login novamente.', variant: 'destructive' });
        return;
      }

      // Remover cargo do objeto pois a coluna não existe no banco
      const { cargo, ...formDataWithoutCargo } = formData;
      const leadData = {
        ...formDataWithoutCargo,
        company_id: user.company_id,
        user_id: authUser?.id,
      };


      if (editingLead) {
        // Update
        const { error } = await supabase
          .from('leads')
          .update(leadData)
          .eq('id', editingLead.id);

        if (error) throw error;

        // Criar log de atividade (fire-and-forget via API: bypassa RLS)
        if (user && company) {
          logActivity({
            user_id: user.auth_user_id,
            company_id: company.id,
            action: 'lead_update',
            description: `Atualizou informações do lead "${formData.company_name}"`,
            metadata: {
              lead_id: editingLead.id,
              lead_name: formData.company_name,
            },
          });
        }

        toast({
          title: 'Lead atualizado!',
          description: `Lead "${formData.company_name}" foi atualizado com sucesso.`,
        });
      } else {
        // Insert
        const { data: newLead, error } = await supabase
          .from('leads')
          .insert([leadData])
          .select()
          .single();

        if (error) throw error;

        // Criar log de atividade (fire-and-forget via API: bypassa RLS)
        if (user && company && newLead) {
          logActivity({
            user_id: user.auth_user_id,
            company_id: company.id,
            action: 'lead_created',
            description: `Criou novo lead "${formData.company_name}"`,
            metadata: {
              lead_id: newLead.id,
              lead_name: formData.company_name,
              segment: formData.segment,
            },
          });
        }

        toast({
          title: 'Lead criado!',
          description: `Lead "${formData.company_name}" foi adicionado com sucesso.`,
        });
      }

      setShowModal(false);
      fetchLeads();
    } catch (error: any) {
      console.error('Error saving lead:', error);
      toast({
        title: 'Erro ao salvar lead',
        description: error.message || 'Ocorreu um erro ao tentar salvar o lead.',
        variant: 'destructive',
      });
    }
  }, [formData, editingLead, user, company, authUser]);

  const handleDeleteLead = useCallback(async () => {
    if (!deletingLead) return;

    try {
      const supabase = createClient();
      const leadName = deletingLead.company_name;
      const leadId = deletingLead.id;

      const { error } = await supabase
        .from('leads')
        .delete()
        .eq('id', leadId);

      if (error) throw error;

      // Criar log de atividade (fire-and-forget via API: bypassa RLS)
      if (user && company) {
        logActivity({
          user_id: user.auth_user_id,
          company_id: company.id,
          action: 'lead_deleted',
          description: `Deletou lead "${leadName}"`,
          metadata: {
            lead_id: leadId,
            lead_name: leadName,
          },
        });
      }

      toast({ title: 'Lead deletado!', description: `Lead "${leadName}" foi removido com sucesso.` });
      setDeletingLead(null);
      fetchLeads();
    } catch (error) {
      console.error('Error deleting lead:', error);
      toast({ title: 'Erro ao deletar lead', variant: 'destructive' });
    }
  }, [deletingLead, user, company]);

  const handleToggleSelectLead = useCallback((leadId: string) => {
    setSelectedLeads((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(leadId)) {
        newSet.delete(leadId);
      } else {
        newSet.add(leadId);
      }
      return newSet;
    });
  }, []);

  const handleToggleSelectAll = () => {
    if (selectedLeads.size === paginatedLeads.length) {
      setSelectedLeads(new Set());
    } else {
      setSelectedLeads(new Set(paginatedLeads.map((l) => String(l.id))));
    }
  };

  const handleDeleteMultipleLeads = useCallback(async () => {
    if (selectedLeads.size === 0) return;

    try {
      const supabase = createClient();
      const { error } = await supabase
        .from('leads')
        .delete()
        .in('id', Array.from(selectedLeads).map(id => parseInt(id)));

      if (error) throw error;
      toast({ title: 'Leads deletados!', description: `${selectedLeads.size} leads foram removidos com sucesso.` });
      setSelectedLeads(new Set());
      setDeletingMultipleLeads(false);
      fetchLeads();
    } catch (error) {
      console.error('Error deleting multiple leads:', error);
      toast({ title: 'Erro ao deletar leads', variant: 'destructive' });
    }
  }, [selectedLeads]);

  const exportToCSV = () => {
    try {
      // Cabeçalhos do CSV
      const headers = [
        'Nome da Empresa',
        'Nome do Contato',
        'Segmento',
        'Status',
        'Website/Instagram',
        'WhatsApp',
        'Email',
        'Prioridade',
        'Nível de Interesse',
        'Valor do Projeto',
        'Fonte de Importação',
        'Observações',
        'Data de Criação'
      ];

      // Converter leads para linhas CSV
      const rows = filteredLeads.map(lead => [
        lead.company_name || '',
        lead.contact_name || '',
        lead.segment || '',
        lead.status || '',
        lead.website_or_instagram || '',
        lead.whatsapp || '',
        lead.email || '',
        lead.priority || '',
        lead.nivel_interesse || '',
        lead.project_value ? `R$ ${lead.project_value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '',
        lead.import_source || '',
        lead.notes || '',
        lead.created_at ? new Date(lead.created_at).toLocaleDateString('pt-BR') : ''
      ]);

      // Escapar vírgulas e aspas nos valores
      const escapeCsvValue = (value: string) => {
        if (value.includes(',') || value.includes('"') || value.includes('\n')) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value;
      };

      // Montar CSV
      const csvContent = [
        headers.map(escapeCsvValue).join(','),
        ...rows.map(row => row.map(escapeCsvValue).join(','))
      ].join('\n');

      // Criar blob e fazer download
      const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);

      link.setAttribute('href', url);
      link.setAttribute('download', `leads_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast({ title: 'Exportação concluída!', description: `${filteredLeads.length} leads foram exportados com sucesso.` });
    } catch (error) {
      console.error('Error exporting CSV:', error);
      toast({ title: 'Erro ao exportar CSV', variant: 'destructive' });
    }
  };

  const tagNamesOf = (lead: LeadWithConversa) => new Set(((lead.lead_tags as any[]) ?? []).map((lt) => lt.tags?.tag_name as string));

  // Opções dos filtros, tiradas dos próprios leads
  const originOptions = useMemo(() => Array.from(new Set(leads.map((l) => l.import_source || 'Sem origem'))).sort(), [leads]);
  const tagOptions = useMemo(() => {
    const names = new Set<string>();
    leads.forEach((l) => ((l.lead_tags as any[]) ?? []).forEach((lt) => lt.tags?.tag_name && names.add(lt.tags.tag_name)));
    return Array.from(names).sort();
  }, [leads]);

  // Tudo que filtra, menos o clique na faixa de automações (a faixa conta em cima disto)
  const baseFiltered = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return leads.filter((lead) => {
      const matchesSearch = !q
        || lead.company_name?.toLowerCase().includes(q)
        || lead.contact_name?.toLowerCase().includes(q)
        || lead.email?.toLowerCase().includes(q)
        || (lead.whatsapp ?? '').includes(q.replace(/\D/g, '') || '\u0000');
      const matchesOrigin = originFilter === 'Todas' || (lead.import_source || 'Sem origem') === originFilter;
      const matchesTag = tagFilter === 'Todas' || tagNamesOf(lead).has(tagFilter);
      const matchesPriority = priorityFilter === 'Todas' || lead.priority === priorityFilter;
      const matchesStale = staleFilter === 0 || (OPEN_STAGE(lead.status) && idleDays(lead) >= staleFilter);
      return matchesSearch && matchesOrigin && matchesTag && matchesPriority && matchesStale;
    });
  }, [leads, searchTerm, originFilter, tagFilter, priorityFilter, staleFilter]);

  const autoDef = AUTOMATIONS.find((a) => a.id === autoFilter) ?? null;
  const filteredLeads = useMemo(() => {
    if (!autoDef) return baseFiltered;
    return baseFiltered.filter((l) => (autoDef.kind === 'status' ? l.status === autoDef.id : tagNamesOf(l).has(autoDef.id)));
  }, [baseFiltered, autoDef]);

  // Contagem e valor de cada cartão da faixa
  const automationStats = useMemo(() => AUTOMATIONS.map((a) => {
    const list = baseFiltered.filter((l) => (a.kind === 'status' ? l.status === a.id : tagNamesOf(l).has(a.id)));
    return { ...a, count: list.length, value: list.reduce((s, l) => s + (l.project_value || 0), 0) };
  }), [baseFiltered]);

  // Colunas do funil. Filtrando por Outbound ou Remarketing (que são etapas fora das 7), a coluna aparece primeiro
  const boardStages: string[] = autoDef?.kind === 'status' ? [autoDef.id, ...STAGES] : [...STAGES];
  const leadsByStage = useMemo(() => {
    const map = new Map<string, LeadWithConversa[]>();
    const value = new Map<string, number>();
    filteredLeads.forEach((lead) => {
      map.set(lead.status, [...(map.get(lead.status) ?? []), lead]);
      value.set(lead.status, (value.get(lead.status) ?? 0) + (lead.project_value || 0));
    });
    return { map, value };
  }, [filteredLeads]);
  const stageLeadCount = filteredLeads.filter((l) => (STAGES as readonly string[]).includes(l.status)).length;

  const totalPipelineValue = useMemo(() =>
    leads.filter(l => l.status !== 'Fechado' && l.status !== 'Perdido').reduce((sum, l) => sum + (l.project_value || 0), 0),
    [leads]
  );
  const closedCount = useMemo(() => leads.filter(l => l.status === 'Fechado').length, [leads]);

  // Planilha: ordenada pelo último contato
  const sortedLeads = useMemo(() => {
    const t = (l: LeadWithConversa) => { const at = lastContactOf(l)?.at; return at ? +new Date(at) : -1; };
    return [...filteredLeads].sort((a, b) => (sortDesc ? t(b) - t(a) : t(a) - t(b)));
  }, [filteredLeads, sortDesc]);

  // Paginação
  const totalPages = Math.max(1, Math.ceil(sortedLeads.length / itemsPerPage));
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedLeads = sortedLeads.slice(startIndex, startIndex + itemsPerPage);

  // Volta para a primeira página quando os filtros mudam
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, originFilter, tagFilter, priorityFilter, staleFilter, autoFilter, itemsPerPage]);

  const anyFilter = !!searchTerm || originFilter !== 'Todas' || tagFilter !== 'Todas' || priorityFilter !== 'Todas' || staleFilter !== 0 || !!autoFilter;
  const clearFilters = () => { setSearchTerm(''); setOriginFilter('Todas'); setTagFilter('Todas'); setPriorityFilter('Todas'); setStaleFilter(0); setAutoFilter(null); };

  const getStatusBadgeColor = (status: string) => STAGE_CHIP[status] ?? 'bg-muted text-muted-foreground';

  const getPriorityBadgeColor = (priority: string) => {
    switch (priority) {
      case 'Alta': return 'bg-red-500/15 text-red-700 dark:text-red-300';
      case 'Média': return 'bg-primary/15 text-primary';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col gap-4">
        <div className="h-14 bg-muted/50 animate-pulse rounded-xl" />
        <div className="h-10 bg-muted/30 animate-pulse rounded-xl" />
        <div className="flex gap-4 overflow-hidden">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="w-[320px] flex-shrink-0 space-y-3">
              <div className="h-7 bg-muted/50 animate-pulse rounded-lg" />
              {[...Array(3)].map((_, j) => (
                <div key={j} className="h-[88px] bg-muted/30 animate-pulse rounded-xl" />
              ))}
            </div>
          ))}
        </div>
      </div>
    );
  }


  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">CRM</h1>
          <p className="text-muted-foreground mt-1">Gerencie seus leads e oportunidades</p>
        </div>
        <OrbitCard className="border-red-500">
          <OrbitCardContent className="p-6">
            <div className="text-center space-y-4">
              <p className="text-red-500 font-semibold">❌ {error}</p>
            </div>
          </OrbitCardContent>
        </OrbitCard>
      </div>
    );
  }

  const activeLead = activeDragId ? leads.find(l => l.id === activeDragId) : null;
  const VISIBLE_PER_COLUMN = 4;
  const pillTrigger = 'h-11 w-auto gap-2 rounded-full border-border bg-card px-4 text-sm shadow-none';
  const openConversa = (lead: LeadWithConversa) => router.push(`/atendimento?phone=${encodeURIComponent(lead.whatsapp || '')}`);
  const fmtPhone = (p?: string | null) => {
    const d = (p ?? '').replace(/\D/g, '');
    if (d.length === 13) return `+${d.slice(0, 2)} ${d.slice(2, 4)} ${d.slice(4, 9)}-${d.slice(9)}`;
    if (d.length === 12) return `+${d.slice(0, 2)} ${d.slice(2, 4)} ${d.slice(4, 8)}-${d.slice(8)}`;
    return p || '-';
  };

  return (
    <div className="flex flex-col gap-5">
      {/* Page Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <h1 className="text-[26px] font-semibold leading-8 tracking-tight text-foreground">CRM</h1>
          <p className="text-[15px] text-muted-foreground">
            {leads.length > 0
              ? `${leads.length} leads · ${fmtCompact(totalPipelineValue)} em pipeline · ${closedCount} fechado${closedCount !== 1 ? 's' : ''}`
              : 'Gerencie seus leads e oportunidades'}
          </p>
        </div>
        <div role="tablist" aria-label="Visualização" className="flex shrink-0 items-center rounded-full bg-muted p-1">
          {([['table', 'Planilha', LayoutList], ['kanban', 'Kanban', LayoutGrid]] as const).map(([id, label, Icon]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={viewMode === id}
              onClick={() => router.push(`?view=${id}`)}
              className={cn('flex items-center gap-2 rounded-full px-4 py-2 text-sm transition-colors', viewMode === id ? 'bg-[#0F3D2B] font-semibold text-white' : 'font-medium text-muted-foreground hover:text-foreground')}
            >
              <Icon className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Filtros à esquerda, ações à direita */}
      <div className="flex flex-wrap items-center gap-2.5">
        <label className="flex h-11 min-w-[200px] max-w-xs flex-1 items-center gap-2.5 rounded-full border border-border bg-card px-4">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar nome, telefone ou empresa"
            aria-label="Buscar lead"
            className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
          />
        </label>
        <Select value={originFilter} onValueChange={setOriginFilter}>
          <SelectTrigger className={pillTrigger} aria-label="Origem"><span className="text-muted-foreground">Origem:</span><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="Todas">todas</SelectItem>{originOptions.map((o) => <SelectItem key={o} value={o}>{originLabel(o === 'Sem origem' ? null : o)}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={tagFilter} onValueChange={setTagFilter}>
          <SelectTrigger className={pillTrigger} aria-label="Etiqueta"><span className="text-muted-foreground">Etiqueta:</span><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="Todas">todas</SelectItem>{tagOptions.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={priorityFilter} onValueChange={setPriorityFilter}>
          <SelectTrigger className={pillTrigger} aria-label="Prioridade"><span className="text-muted-foreground">Prioridade:</span><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="Todas">todas</SelectItem><SelectItem value="Alta">Alta</SelectItem><SelectItem value="Média">Média</SelectItem><SelectItem value="Baixa">Baixa</SelectItem></SelectContent>
        </Select>
        <Select value={String(staleFilter)} onValueChange={(v) => setStaleFilter(Number(v))}>
          <SelectTrigger className={pillTrigger} aria-label="Parado há"><span className="text-muted-foreground">Parado há:</span><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="0">qualquer</SelectItem>
            {[3, 7, 14, 30].map((d) => <SelectItem key={d} value={String(d)}>{d}+ dias</SelectItem>)}
          </SelectContent>
        </Select>
        {anyFilter && (
          <button type="button" className="px-1 text-sm text-muted-foreground transition-colors hover:text-foreground" onClick={clearFilters}>Limpar</button>
        )}

        <div className="flex-1" />

        {selectedLeads.size > 0 && viewMode === 'table' && (
          <Button variant="destructive" onClick={() => setDeletingMultipleLeads(true)} className="h-11 gap-1.5 px-5">
            <Trash2 className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Excluir {selectedLeads.size}</span>
          </Button>
        )}
        <Button variant="secondary" onClick={exportToCSV} disabled={filteredLeads.length === 0} className="h-11 gap-2 px-5">
          <Download className="h-4 w-4" />
          <span className="hidden sm:inline">Exportar</span>
        </Button>
        <Button onClick={() => handleOpenModal()} className="h-11 gap-2 px-5">
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">Novo Lead</span>
        </Button>
      </div>

      {/* Content */}
      {leads.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-[14px] border border-dashed border-border px-8 py-20 text-center">
          <h2 className="text-lg font-semibold text-foreground">Nenhum lead ainda</h2>
          <p className="max-w-sm text-[15px] text-muted-foreground">Cadastre o primeiro lead ou busque empresas no Orbit para começar o funil.</p>
          <Button className="mt-1 h-11 px-6" onClick={() => handleOpenModal()}>Novo Lead</Button>
        </div>
      ) : viewMode === 'kanban' ? (
        <>
          <DndContext sensors={sensors} collisionDetection={pointerWithin} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
            <div className="hidden flex-col gap-4 md:flex">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-[13px] font-semibold tracking-[0.12em] text-muted-foreground">FUNIL DE VENDA</h2>
                <p className="text-[13px] text-muted-foreground">{stageLeadCount} leads nas 7 etapas. Etiquetas aparecem no card, o lead não sai da etapa.</p>
              </div>
              <div className="overflow-x-auto pb-2">
                <div className="grid items-start gap-4" style={{ gridAutoFlow: 'column', gridAutoColumns: 'minmax(230px, 1fr)' }}>
                  {boardStages.map((stage) => {
                    const stageLeads = leadsByStage.map.get(stage) ?? [];
                    const isOpen = expanded.has(stage);
                    const shown = isOpen ? stageLeads : stageLeads.slice(0, VISIBLE_PER_COLUMN);
                    const hidden = stageLeads.length - shown.length;
                    return (
                      <DroppableColumn
                        key={stage}
                        id={`column-${stage}`}
                        title={stage}
                        count={stageLeads.length}
                        totalValue={leadsByStage.value.get(stage)}
                        extra={
                          stage === 'Triagem' && stageLeads.length > 0 ? (
                            <button type="button" onClick={() => handleBulkStatusChange('Triagem', 'Outbound')} title="Mover todos da Triagem para Outbound" className="rounded-md bg-orange-500/15 px-2 py-0.5 text-xs font-medium text-orange-700 hover:bg-orange-500/25 dark:text-orange-300"><Megaphone className="mr-1 inline h-3 w-3" />Promover</button>
                          ) : stage === 'Outbound' && stageLeads.length > 0 ? (
                            <button type="button" onClick={() => handleBulkStatusChange('Outbound', 'Triagem')} title="Voltar todos para a Triagem" className="rounded-md bg-orange-500/15 px-2 py-0.5 text-xs font-medium text-orange-700 hover:bg-orange-500/25 dark:text-orange-300">Voltar</button>
                          ) : undefined
                        }
                      >
                        <SortableContext items={shown.map((l) => l.id)} strategy={verticalListSortingStrategy}>
                          {shown.length === 0 ? (
                            <p className="rounded-xl border border-dashed border-border px-3 py-8 text-center text-xs text-muted-foreground">Sem leads</p>
                          ) : shown.map((lead) => (
                            <SortableLeadCard
                              key={lead.id}
                              lead={lead}
                              onEdit={() => handleOpenModal(lead)}
                              onDelete={() => setDeletingLead(lead)}
                              onCharge={() => setChargingLead(lead)}
                              onOpenConversa={() => openConversa(lead)}
                              onRemoveTag={handleRemoveTag}
                            />
                          ))}
                        </SortableContext>
                        {(hidden > 0 || (isOpen && stageLeads.length > VISIBLE_PER_COLUMN)) && (
                          <button
                            type="button"
                            onClick={() => setExpanded((prev) => { const n = new Set(prev); if (n.has(stage)) n.delete(stage); else n.add(stage); return n; })}
                            className="mt-0.5 rounded-xl border border-dashed border-border py-2.5 text-sm text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground"
                          >
                            {hidden > 0 ? `Ver mais ${hidden}` : 'Ver menos'}
                          </button>
                        )}
                      </DroppableColumn>
                    );
                  })}
                </div>
              </div>

              <div className="mt-2 flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-[13px] font-semibold tracking-[0.12em] text-muted-foreground">AUTOMAÇÕES E ETIQUETAS</h2>
                <p className="text-[13px] text-muted-foreground">
                  Clique para ver só esses leads, ou arraste um card até aqui.{automationStats.find((a) => a.id === 'Follow up')?.count ? ` Os ${automationStats.find((a) => a.id === 'Follow up')!.count} do Follow up continuam nas etapas acima.` : ''}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
                {automationStats.map((a) => (
                  <AutomationTile key={a.id} id={a.id} dot={a.dot} count={a.count} value={a.value} active={autoFilter === a.id} onClick={() => setAutoFilter((cur) => (cur === a.id ? null : a.id))} />
                ))}
              </div>
            </div>

            <DragOverlay>
              {activeLead ? (
                <div className="w-[260px] rotate-1 cursor-grabbing rounded-xl border border-[#1E6B47] bg-card p-3.5 shadow-2xl">
                  <p className="truncate text-[15px] font-semibold text-foreground">{activeLead.contact_name || activeLead.company_name}</p>
                  <p className="mt-1 text-sm tabular-nums text-muted-foreground">{activeLead.project_value ? `R$ ${Number(activeLead.project_value).toLocaleString('pt-BR')}` : 'Sem valor'}</p>
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>

          {/* Celular: uma coluna por tela, rolagem vertical em cada uma */}
          <div className="-mx-3 flex snap-x snap-mandatory gap-3 overflow-x-auto px-3 pb-3 md:hidden" style={{ scrollbarWidth: 'none', height: 'calc(100dvh - 300px)' }}>
            {boardStages.map((stage) => {
              const colLeads = leadsByStage.map.get(stage) ?? [];
              return (
                <div key={stage} className="flex w-[85vw] flex-shrink-0 snap-center flex-col gap-2 rounded-2xl border border-border bg-muted/40 p-2.5">
                  <div className="flex flex-shrink-0 items-center gap-2 px-1 py-1">
                    <span className={cn('h-2 w-2 rounded-full', STAGE_DOT[stage] ?? 'bg-muted-foreground')} />
                    <span className="text-[15px] font-semibold text-foreground">{stage}</span>
                    <span className="rounded-full bg-card px-2 py-0.5 text-xs text-muted-foreground">{colLeads.length}</span>
                  </div>
                  <div className="flex-1 space-y-2 overflow-y-auto pb-1" style={{ scrollbarWidth: 'none' }}>
                    {colLeads.length === 0 ? (
                      <div className="flex items-center justify-center rounded-xl border border-dashed border-border py-10 text-sm text-muted-foreground">Sem leads</div>
                    ) : colLeads.map((lead) => (
                      <MobileLeadCard key={lead.id} lead={lead} onEdit={() => handleOpenModal(lead)} onDelete={() => setDeletingLead(lead)} onCharge={() => setChargingLead(lead)} onOpenConversa={() => openConversa(lead)} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      ) : (
        <>
          {/* Planilha (desktop) */}
          <div className="hidden overflow-hidden rounded-[14px] border border-border bg-card md:block">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1080px] border-collapse">
                <thead>
                  <tr className="text-left text-xs font-medium tracking-[0.08em] text-muted-foreground">
                    <th className="w-12 px-4 py-4">
                      <Checkbox
                        aria-label="Selecionar todos desta página"
                        checked={selectedLeads.size === paginatedLeads.length && paginatedLeads.length > 0}
                        onCheckedChange={handleToggleSelectAll}
                      />
                    </th>
                    <th className="px-3 py-4 font-medium">LEAD</th>
                    <th className="px-3 py-4 font-medium">ETAPA</th>
                    <th className="px-3 py-4 font-medium">SEGMENTO</th>
                    <th className="px-3 py-4 font-medium">INTERESSE</th>
                    <th className="px-3 py-4 font-medium">VALOR</th>
                    <th className="px-3 py-4 font-medium">ORIGEM</th>
                    <th className="px-3 py-4 font-medium">
                      <button type="button" onClick={() => setSortDesc((d) => !d)} className="flex items-center gap-1 font-medium text-foreground" aria-label="Ordenar por último contato">
                        ÚLTIMO CONTATO <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', !sortDesc && 'rotate-180')} />
                      </button>
                    </th>
                    <th className="px-3 py-4 font-medium">ENTRADA</th>
                    <th className="px-3 py-4 font-medium">AÇÕES</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedLeads.length === 0 && (
                    <tr><td colSpan={10} className="py-16 text-center text-[15px] text-muted-foreground">Nenhum lead com esses filtros.</td></tr>
                  )}
                  {paginatedLeads.map((lead) => {
                    const hot = lead.nivel_interesse?.includes('Quente');
                    return (
                      <tr key={lead.id} className="border-t border-border transition-colors hover:bg-muted/60">
                        <td className="px-4 py-3.5">
                          <Checkbox aria-label={`Selecionar ${lead.company_name}`} checked={selectedLeads.has(String(lead.id))} onCheckedChange={() => handleToggleSelectLead(String(lead.id))} />
                        </td>
                        <td className="px-3 py-3.5">
                          <div className="flex items-center gap-3">
                            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-[11px] font-bold text-[#01573C] dark:text-[#96F63C]">
                              {(lead.contact_name || lead.company_name || '??').split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)}
                            </span>
                            <div className="min-w-0">
                              <p className="truncate text-[15px] font-semibold leading-5 text-foreground">{lead.contact_name || lead.company_name}</p>
                              <p className="truncate text-xs tabular-nums text-muted-foreground">{lead.contact_name && lead.company_name ? `${lead.company_name} · ` : ''}{fmtPhone(lead.whatsapp)}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-3.5"><span className={cn('inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1 text-[13px] font-semibold', getStatusBadgeColor(lead.status || ''))}><span className={cn('h-1.5 w-1.5 rounded-full', STAGE_DOT[lead.status] ?? 'bg-muted-foreground')} />{lead.status}</span></td>
                        <td className={cn('px-3 py-3.5 text-[15px]', lead.segment ? 'text-foreground' : 'text-muted-foreground')}>{lead.segment || 'Sem segmento'}</td>
                        <td className="px-3 py-3.5">
                          <div className="flex flex-wrap gap-1.5">
                            {lead.nivel_interesse ? (
                              <span className={cn('inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold', hot ? 'bg-orange-500/15 text-orange-700 dark:text-orange-300' : lead.nivel_interesse.includes('Morno') ? 'bg-blue-500/15 text-blue-700 dark:text-blue-300' : 'bg-muted text-muted-foreground')}>
                                {hot && <Flame className="h-3 w-3" />}{lead.nivel_interesse.replace(/[^\p{L}\s]/gu, '').trim()}
                              </span>
                            ) : <span className="text-muted-foreground">-</span>}
                            {lead.priority && <span className={cn('rounded-md px-2 py-0.5 text-[11px] font-semibold', getPriorityBadgeColor(lead.priority))}>{lead.priority}</span>}
                          </div>
                        </td>
                        <td className={cn('px-3 py-3.5 text-[15px] tabular-nums', lead.project_value ? 'font-semibold text-foreground' : 'text-muted-foreground')}>{lead.project_value ? `R$ ${Number(lead.project_value).toLocaleString('pt-BR')}` : 'Sem valor'}</td>
                        <td className="px-3 py-3.5 text-[15px] text-muted-foreground">{originLabel(lead.import_source)}</td>
                        <td className="px-3 py-3.5"><ContactLine lead={lead} /></td>
                        <td className="whitespace-nowrap px-3 py-3.5 text-[15px] text-muted-foreground">{new Date(lead.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '')}</td>
                        <td className="px-3 py-3.5">
                          <div className="flex items-center gap-1">
                            <Button variant="ghost" size="icon" className="h-8 w-8" title="Abrir conversa" aria-label="Abrir conversa" onClick={() => openConversa(lead)} disabled={!lead.whatsapp}><MessageCircle className="h-4 w-4" /></Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8" title="Gerar cobrança" aria-label="Gerar cobrança" onClick={() => setChargingLead(lead)}><DollarSign className="h-4 w-4" /></Button>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Mais ações"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => handleOpenModal(lead)}><Pencil className="mr-2 h-3.5 w-3.5" />Editar</DropdownMenuItem>
                                <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setDeletingLead(lead)}><Trash2 className="mr-2 h-3.5 w-3.5" />Excluir</DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-5 py-3.5">
              <p className="text-sm text-muted-foreground">
                {sortedLeads.length === 0 ? 'Nenhum lead' : `Mostrando ${startIndex + 1} a ${Math.min(startIndex + itemsPerPage, sortedLeads.length)} de ${sortedLeads.length} leads.`}
              </p>
              <div className="flex items-center gap-3">
                <Select value={String(itemsPerPage)} onValueChange={(v) => setItemsPerPage(Number(v))}>
                  <SelectTrigger className="h-9 w-auto gap-2 rounded-full border-border bg-muted px-4 text-sm shadow-none" aria-label="Leads por página"><SelectValue /></SelectTrigger>
                  <SelectContent>{[10, 25, 50, 100].map((n) => <SelectItem key={n} value={String(n)}>{n} por página</SelectItem>)}</SelectContent>
                </Select>
                {totalPages > 1 && (
                  <div className="flex items-center gap-1" role="navigation" aria-label="Páginas">
                    {Array.from({ length: totalPages }, (_, i) => i + 1)
                      .filter((p) => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
                      .map((p, i, arr) => (
                        <span key={p} className="flex items-center gap-1">
                          {i > 0 && p - arr[i - 1] > 1 && <span className="px-1 text-muted-foreground">…</span>}
                          <button
                            type="button"
                            aria-current={p === currentPage ? 'page' : undefined}
                            onClick={() => setCurrentPage(p)}
                            className={cn('h-9 min-w-9 rounded-full px-3 text-sm tabular-nums transition-colors', p === currentPage ? 'bg-[#0F3D2B] font-semibold text-white' : 'text-muted-foreground hover:bg-muted hover:text-foreground')}
                          >{p}</button>
                        </span>
                      ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Planilha (celular): cartões */}
          <div className="space-y-4 md:hidden">
            <div className="grid gap-3">
              {paginatedLeads.map((lead) => (
                <div key={lead.id} className="space-y-3 rounded-xl border border-border bg-card p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <h3 className="text-base font-semibold">{lead.contact_name || lead.company_name}</h3>
                      {lead.contact_name && <p className="text-sm text-muted-foreground">{lead.company_name}</p>}
                    </div>
                    {lead.priority && <span className={cn('rounded-full px-2.5 py-1 text-xs font-semibold', getPriorityBadgeColor(lead.priority))}>{lead.priority}</span>}
                  </div>
                  <div className="space-y-1.5 text-sm text-muted-foreground">
                    {lead.segment && <div className="flex items-center gap-2"><Building2 className="h-4 w-4" /><span>{lead.segment}</span></div>}
                    {lead.whatsapp && <div className="flex items-center gap-2"><Phone className="h-4 w-4" /><span>{fmtPhone(lead.whatsapp)}</span></div>}
                  </div>
                  <div className="flex items-center justify-between border-t border-border pt-3">
                    <span className={cn('rounded-full px-3 py-1 text-xs font-semibold', getStatusBadgeColor(lead.status || ''))}>{lead.status}</span>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm" aria-label="Editar" onClick={() => handleOpenModal(lead)}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="sm" className="text-destructive" aria-label="Excluir" onClick={() => setDeletingLead(lead)}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {sortedLeads.length > itemsPerPage && (
              <SimplePagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} totalItems={sortedLeads.length} itemsPerPage={itemsPerPage} />
            )}
          </div>
        </>
      )}

      {/* Modal Adicionar/Editar Lead */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto p-0 gap-0 border-border/50 bg-background">
          {/* Header minimalista */}
          <div className="px-6 py-5 border-b border-border/50">
            <DialogTitle className="text-lg font-medium">
              {editingLead ? 'Editar Lead' : 'Novo Lead'}
            </DialogTitle>
            <p className="text-sm text-muted-foreground mt-1">
              {currentStep === 0 && 'Informações da empresa'}
              {currentStep === 1 && 'Dados de contato'}
              {currentStep === 2 && 'Detalhes e observações'}
            </p>
          </div>

          {/* Stepper */}
          <div className="px-6 pt-5 pb-2">
            <div className="flex items-start">
              {['Empresa', 'Contato', 'Detalhes'].map((label, i) => (
                <div key={i} className="flex items-start flex-1 last:flex-none">
                  <div className="flex flex-col items-center gap-2 flex-shrink-0">
                    <div
                      className={cn(
                        "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-200",
                        i <= currentStep
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground border border-border"
                      )}
                      style={i === currentStep ? { boxShadow: '0 0 0 5px color-mix(in srgb, var(--primary) 18%, transparent)' } : undefined}
                    >
                      {i < currentStep ? <CheckCircle2 className="w-3.5 h-3.5" /> : i + 1}
                    </div>
                    <span className={cn("text-[11px] font-semibold", i <= currentStep ? "text-primary" : "text-muted-foreground")}>
                      {label}
                    </span>
                  </div>
                  {i < 2 && (
                    <div
                      className={cn("flex-1 h-[2px] mx-2 mt-4 rounded-full transition-colors", i < currentStep ? "bg-primary" : "bg-border")}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Form content */}
          <div className="px-6 py-6">
            {/* Step 1: Informações Básicas */}
            {currentStep === 0 && (
              <div className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="company_name" className="text-sm font-medium">
                    Nome da Empresa <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="company_name"
                    value={formData.company_name}
                    onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                    placeholder="Digite o nome da empresa"
                    className="h-11"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="segment" className="text-sm font-medium">
                    Segmento <span className="text-destructive">*</span>
                  </Label>
                  <Select value={formData.segment} onValueChange={(value) => setFormData({ ...formData, segment: value })}>
                    <SelectTrigger className="h-11">
                      <SelectValue placeholder="Selecione o segmento" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="E-commerce">E-commerce</SelectItem>
                      <SelectItem value="Saúde/Medicina">Saúde/Medicina</SelectItem>
                      <SelectItem value="Educação">Educação</SelectItem>
                      <SelectItem value="Alimentação">Alimentação</SelectItem>
                      <SelectItem value="Beleza/Estética">Beleza/Estética</SelectItem>
                      <SelectItem value="Imobiliária">Imobiliária</SelectItem>
                      <SelectItem value="Advocacia">Advocacia</SelectItem>
                      <SelectItem value="Consultoria">Consultoria</SelectItem>
                      <SelectItem value="Tecnologia">Tecnologia</SelectItem>
                      <SelectItem value="Moda/Fashion">Moda/Fashion</SelectItem>
                      <SelectItem value="Arquitetura">Arquitetura</SelectItem>
                      <SelectItem value="Auto Escola">Auto Escola</SelectItem>
                      <SelectItem value="Restaurante">Restaurante</SelectItem>
                      <SelectItem value="Academia">Academia</SelectItem>
                      <SelectItem value="Farmácia">Farmácia</SelectItem>
                      <SelectItem value="Padaria">Padaria</SelectItem>
                      <SelectItem value="Supermercado">Supermercado</SelectItem>
                      <SelectItem value="Floricultural">Floricultural</SelectItem>
                      <SelectItem value="Hotel/Pousada">Hotel/Pousada</SelectItem>
                      <SelectItem value="Oficina Mecânica">Oficina Mecânica</SelectItem>
                      <SelectItem value="Pet Shop">Pet Shop</SelectItem>
                      <SelectItem value="Outros">Outros</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="website" className="text-sm font-medium">Site ou Instagram</Label>
                  <Input
                    id="website"
                    value={formData.website_or_instagram}
                    onChange={(e) => setFormData({ ...formData, website_or_instagram: e.target.value })}
                    placeholder="https://... ou @usuario"
                    className="h-11"
                  />
                </div>
              </div>
            )}

            {/* Step 2: Contato */}
            {currentStep === 1 && (
              <div className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="contact_name" className="text-sm font-medium">Nome do Contato</Label>
                  <Input
                    id="contact_name"
                    value={formData.contact_name}
                    onChange={(e) => setFormData({ ...formData, contact_name: e.target.value })}
                    placeholder="Nome da pessoa de contato"
                    className="h-11"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="whatsapp" className="text-sm font-medium">WhatsApp</Label>
                  <Input
                    id="whatsapp"
                    value={formData.whatsapp}
                    onChange={(e) => {
                      // Remove tudo que não é dígito
                      let digits = e.target.value.replace(/\D/g, '');
                      // Adiciona 55 se não começar com 55
                      if (digits.length > 0 && !digits.startsWith('55')) {
                        digits = '55' + digits;
                      }
                      // Limita a 13 dígitos (55 + DDD + 9 dígitos)
                      digits = digits.slice(0, 13);
                      setFormData({ ...formData, whatsapp: digits });
                    }}
                    placeholder="55981680532"
                    maxLength={13}
                    className="h-11"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-sm font-medium">E-mail</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="email@empresa.com"
                    className="h-11"
                  />
                </div>
              </div>
            )}

            {/* Step 3: Detalhes */}
            {currentStep === 2 && (
              <div className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="status" className="text-sm font-medium">Estágio</Label>
                  <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value })}>
                    <SelectTrigger className="h-11">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Lead novo">Lead novo</SelectItem>
                      <SelectItem value="Em contato">Em contato</SelectItem>
                      <SelectItem value="Interessado">Interessado</SelectItem>
                      <SelectItem value="Proposta enviada">Proposta enviada</SelectItem>
                      <SelectItem value="Fechado">Fechado</SelectItem>
                      <SelectItem value="Perdido">Perdido</SelectItem>
                      <SelectItem value="Remarketing">Remarketing</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="priority" className="text-sm font-medium">Prioridade</Label>
                    <Select value={formData.priority} onValueChange={(value) => setFormData({ ...formData, priority: value })}>
                      <SelectTrigger className="h-11">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Alta">Alta</SelectItem>
                        <SelectItem value="Média">Média</SelectItem>
                        <SelectItem value="Baixa">Baixa</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="nivel_interesse" className="text-sm font-medium">Interesse</Label>
                    <Select value={formData.nivel_interesse} onValueChange={(value) => setFormData({ ...formData, nivel_interesse: value })}>
                      <SelectTrigger className="h-11">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Quente 🔥">Quente 🔥</SelectItem>
                        <SelectItem value="Morno 🌡️">Morno 🌡️</SelectItem>
                        <SelectItem value="Frio ❄️">Frio ❄️</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="import_source" className="text-sm font-medium">Fonte</Label>
                    <Select value={formData.import_source} onValueChange={(value) => setFormData({ ...formData, import_source: value })}>
                      <SelectTrigger className="h-11">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="PEG">PEG</SelectItem>
                        <SelectItem value="Linkedin">Linkedin</SelectItem>
                        <SelectItem value="Interno">Interno</SelectItem>
                        <SelectItem value="Meta Ads">Meta Ads</SelectItem>
                        <SelectItem value="Google Ads">Google Ads</SelectItem>
                        <SelectItem value="Site/Landing Page">Site/Landing Page</SelectItem>
                        <SelectItem value="Indicação">Indicação</SelectItem>
                        <SelectItem value="WhatsApp">WhatsApp</SelectItem>
                        <SelectItem value="TikTok Ads">TikTok Ads</SelectItem>
                        <SelectItem value="E-mail Marketing">E-mail Marketing</SelectItem>
                        <SelectItem value="Evento/Feira">Evento/Feira</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="project_value" className="text-sm font-medium">Valor do Projeto</Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">R$</span>
                      <Input
                        id="project_value"
                        type="text"
                        value={formData.project_value > 0 ? formData.project_value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : ''}
                        onChange={(e) => {
                          // Remove tudo que não é número
                          const rawValue = e.target.value.replace(/\D/g, '');
                          // Converte para número (considerando os 2 últimos dígitos como centavos)
                          const numericValue = rawValue ? parseInt(rawValue, 10) / 100 : 0;
                          setFormData({ ...formData, project_value: numericValue });
                        }}
                        placeholder="0,00"
                        className="h-11 pl-10"
                      />
                    </div>
                  </div>
                </div>
                {editingLead?.status !== 'Triagem' && (
                  <div className="space-y-2">
                    <Label htmlFor="notes" className="text-sm font-medium">Observações</Label>
                    <textarea
                      id="notes"
                      className="w-full min-h-[80px] px-3 py-2.5 rounded-xl border border-input bg-background text-sm text-foreground resize-none focus:outline-none focus:ring-2 focus:ring-primary/40 placeholder:text-muted-foreground"
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      placeholder="Adicione observações sobre este lead..."
                    />
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Mini-timeline de sequências: só ao editar lead existente */}
          {editingLead && <LeadSequenceTimeline leadId={editingLead.id} />}

          {/* Footer minimalista */}
          <div className="px-6 py-4 border-t border-border/50 flex items-center justify-between">
            <Button
              variant="ghost"
              onClick={() => currentStep > 0 ? setCurrentStep(currentStep - 1) : setShowModal(false)}
              className="text-muted-foreground"
            >
              {currentStep > 0 ? 'Voltar' : 'Cancelar'}
            </Button>
            {currentStep < 2 ? (
              <Button
                onClick={() => {
                  if (currentStep === 0) {
                    if (!formData.company_name.trim()) {
                      toast({ title: 'Campo obrigatório', description: 'Nome da empresa é obrigatório', variant: 'destructive' });
                      return;
                    }
                    if (!formData.segment) {
                      toast({ title: 'Campo obrigatório', description: 'Segmento é obrigatório', variant: 'destructive' });
                      return;
                    }
                  }
                  setCurrentStep(currentStep + 1);
                }}
              >
                Continuar
              </Button>
            ) : (
              <Button onClick={handleSaveLead}>
                {editingLead ? 'Salvar' : 'Adicionar Lead'}
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de cobrança */}
      {chargingLead && (
        <ChargeLeadModal
          lead={chargingLead}
          onClose={() => setChargingLead(null)}
        />
      )}

      {/* Alert Dialog para Delete */}
      <AlertDialog open={!!deletingLead} onOpenChange={() => setDeletingLead(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deletar Lead</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja deletar o lead <strong>"{deletingLead?.company_name}"</strong>?
              {deletingLead?.contact_name && (
                <span> (Contato: {deletingLead.contact_name})</span>
              )}
              <br /><br />
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteLead}
              className="bg-red-500 hover:bg-red-600"
            >
              Deletar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Aviso : lead já recebeu essa sequência de reengajamento antes */}
      <AlertDialog open={!!pendingTagDrop} onOpenChange={(open) => { if (!open) setPendingTagDrop(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Esse lead já recebeu essa sequência antes</AlertDialogTitle>
            <AlertDialogDescription>
              Esse lead já teve pelo menos uma mensagem enviada por essa mesma sequência de "{pendingTagDrop?.tagName}" em algum
              momento. Mover ele de novo pra essa coluna vai rodar a sequência inteira outra vez, do início. Quer continuar mesmo assim?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (!pendingTagDrop) return;
                const lead = leads.find((l) => l.id === pendingTagDrop.leadId);
                const { tagName, tagId } = pendingTagDrop;
                setPendingTagDrop(null);
                if (lead) await performTagDrop(lead, tagName, tagId);
              }}
            >
              Mover mesmo assim
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Alert Dialog para Delete Múltiplo */}
      <AlertDialog open={deletingMultipleLeads} onOpenChange={() => setDeletingMultipleLeads(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deletar Múltiplos Leads</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja deletar <strong>{selectedLeads.size} leads selecionados</strong>?
              <br /><br />
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteMultipleLeads}
              className="bg-red-500 hover:bg-red-600"
            >
              Deletar Todos
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}

// ─── LeadSequenceTimeline ────────────────────────────────────────────────────

interface TimelineStep {
  stepId: string
  diaOffset: number
  horario: string
  tipoMensagem: string
  ordem: number
  disparado: boolean
  disparadoEm: string | null
  status: string | null
}

interface TimelineSequence {
  sequenceId: string
  sequenceName: string
  sequenceTipo: string
  sequenceAtivo: boolean
  steps: TimelineStep[]
}

const TIPO_LABEL: Record<string, string> = {
  follow_geral: 'Follow-up',
  anti_noshow: 'Anti-noshow',
  remarketing: 'Remarketing',
  trial_saas: 'Trial',
}

const TIPO_COLOR: Record<string, string> = {
  follow_geral: 'bg-blue-500/15 text-blue-600 dark:text-blue-400',
  anti_noshow: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
  remarketing: 'bg-violet-500/15 text-violet-600 dark:text-violet-400',
  trial_saas: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
}

function LeadSequenceTimeline({ leadId }: { leadId: number }) {
  const [data, setData] = useState<TimelineSequence[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/follow/lead-timeline?lead_id=${leadId}`)
      .then((r) => r.json())
      .then((j) => setData(j.timeline ?? []))
      .catch(() => setData([]))
      .finally(() => setLoading(false))
  }, [leadId])

  if (loading) {
    return (
      <div className="px-6 py-3 border-t border-border/40">
        <div className="h-3 w-32 bg-muted animate-pulse rounded" />
      </div>
    )
  }

  if (data.length === 0) return null

  return (
    <div className="px-6 py-5 border-t border-border/40 space-y-4">
      <div className="flex items-center gap-1.5 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
        <GitBranch className="h-3 w-3" />
        Sequências ativas
      </div>

      <div className="space-y-4">
        {data.map((seq) => {
          const sent = seq.steps.filter((s) => s.disparado).length
          const total = seq.steps.length
          return (
            <div key={seq.sequenceId} className="rounded-xl p-3 space-y-3 bg-muted border border-border/50">
              {/* Header da sequência */}
              <div className="flex items-center gap-2.5">
                <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full', TIPO_COLOR[seq.sequenceTipo] ?? 'bg-muted text-muted-foreground')}>
                  {TIPO_LABEL[seq.sequenceTipo] ?? seq.sequenceTipo}
                </span>
                <span className="text-xs font-medium text-foreground truncate flex-1">{seq.sequenceName}</span>
                <span className="text-[10px] font-medium shrink-0" style={{ color: '#666' }}>{sent}/{total} enviados</span>
              </div>

              {/* Steps rail */}
              <div className="flex items-center gap-1.5 pl-0.5">
                {seq.steps.map((step, idx) => (
                  <div key={step.stepId} className="flex items-center gap-1.5">
                    <div
                      title={step.disparado
                        ? `Dia ${step.diaOffset} · ${step.horario} · ${step.disparadoEm ? new Date(step.disparadoEm).toLocaleDateString('pt-BR') : 'enviado'}`
                        : `Dia ${step.diaOffset} · ${step.horario} · pendente`}
                      className={cn(
                        'w-6 h-6 rounded-full flex items-center justify-center shrink-0 transition-colors',
                        step.disparado
                          ? step.status === 'failed'
                            ? 'bg-red-500/20 text-red-400'
                            : 'bg-emerald-500/20 text-emerald-400'
                          : 'bg-muted-foreground/10 text-muted-foreground'
                      )}
                      style={!step.disparado ? undefined : undefined}
                    >
                      {step.disparado
                        ? step.status === 'failed'
                          ? <XCircle className="h-3 w-3" />
                          : <CheckCheck className="h-3 w-3" />
                        : <Clock className="h-3 w-3" />}
                    </div>
                    {idx < seq.steps.length - 1 && (
                      <div className="h-px w-4 shrink-0 rounded-full" style={{ backgroundColor: step.disparado ? 'rgba(52,178,112,0.35)' : '#242424' }} />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
