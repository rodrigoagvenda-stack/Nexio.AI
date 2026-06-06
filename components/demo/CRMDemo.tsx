'use client'

import { useState, useRef, useEffect, useLayoutEffect } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/utils'
import {
  TrendingUp, PieChart, MessageCircle, UserCog,
  Sparkles, LifeBuoy, Settings, Megaphone,
  UserPlus, Star, FileText, CheckCircle2, XCircle, Repeat2,
  DollarSign, Building2, Plus, Search, LayoutGrid, Table2,
} from 'lucide-react'

function ZaapliIcon({ size = 26 }: { size?: number }) {
  const w = size * (208 / 235)
  return (
    <svg width={w} height={size} viewBox="0 0 208 235" fill="none">
      <path d="M207.65 103.853C207.65 104.953 207.65 106.063 207.59 107.143V107.213C207.562 120.28 205.556 133.267 201.64 145.733C194.543 167.855 181.706 187.699 164.44 203.243C146.982 218.999 125.668 229.859 102.66 234.723V207.653C82.1745 207.423 62.2151 201.137 45.2943 189.587C28.3736 178.037 15.2477 161.74 7.56905 142.747C-0.109597 123.753 -1.99782 102.913 2.14207 82.8485C6.28195 62.7843 16.2649 44.3933 30.8343 29.9904C45.4037 15.5875 63.9083 5.81663 84.0187 1.90763C104.129 -2.00137 124.946 0.126266 143.85 8.02272C162.754 15.9192 178.9 29.2315 190.254 46.2839C201.609 63.3363 207.665 83.3666 207.66 103.853H207.65Z" fill="#369E47"/>
      <path d="M82.5917 152.783C77.2584 152.783 73.3551 151.533 70.8817 149.033C69.6593 147.837 68.6957 146.402 68.0506 144.818C67.4056 143.233 67.0928 141.534 67.1317 139.823C67.2062 136.582 67.9519 133.392 69.3217 130.453C70.8962 126.943 73.1222 123.764 75.8817 121.083L110.712 84.6934H76.5917C75.2672 84.6934 73.9556 84.4324 72.732 83.9252C71.5084 83.418 70.3967 82.6746 69.4605 81.7375C68.5244 80.8005 67.7821 79.6881 67.2761 78.464C66.7702 77.2398 66.5104 75.928 66.5117 74.6034C66.5117 71.7285 67.6538 68.9713 69.6867 66.9384C71.7196 64.9055 74.4768 63.7634 77.3517 63.7634H125.082C130.915 63.7634 135.132 65.0101 137.732 67.5034C138.968 68.6341 139.953 70.011 140.625 71.5456C141.297 73.0801 141.64 74.7383 141.632 76.4134C141.632 81.7468 139.395 86.9001 134.922 91.8734L97.9217 131.873H129.922C132.799 131.873 135.559 133.017 137.594 135.051C139.629 137.086 140.772 139.846 140.772 142.723C140.769 144.054 140.503 145.371 139.989 146.598C139.475 147.825 138.723 148.938 137.777 149.874C136.831 150.809 135.708 151.548 134.475 152.047C133.242 152.546 131.922 152.797 130.592 152.783H82.5917Z" fill="white"/>
    </svg>
  )
}

type TooltipSide = 'top' | 'right' | 'bottom' | 'left'
function PortalTooltip({ anchorRef, label, side, minW = 240 }: {
  anchorRef: React.RefObject<HTMLElement | null>; label: string; side: TooltipSide; minW?: number
}) {
  const [mounted, setMounted] = useState(false)
  const [style, setStyle] = useState<React.CSSProperties | null>(null)
  useEffect(() => { setMounted(true) }, [])
  useLayoutEffect(() => {
    const el = anchorRef.current; if (!el) return
    const r = el.getBoundingClientRect(); const gap = 12; let s: React.CSSProperties
    if (side === 'top')         s = { bottom: window.innerHeight - r.top + gap, left: r.left + r.width / 2, transform: 'translateX(-50%)' }
    else if (side === 'bottom') s = { top: r.bottom + gap,                      left: r.left + r.width / 2, transform: 'translateX(-50%)' }
    else if (side === 'right')  s = { top: r.top + r.height / 2,               left: r.right + gap,         transform: 'translateY(-50%)' }
    else                        s = { top: r.top + r.height / 2,               right: window.innerWidth - r.left + gap, transform: 'translateY(-50%)' }
    setStyle(s)
  }, [label, side]) // eslint-disable-line react-hooks/exhaustive-deps
  if (!mounted || !style) return null
  return createPortal(
    <div className="fixed z-[9999] pointer-events-none" style={{ ...style, minWidth: minW }}>
      <div className="bg-[#1c1c1e] text-white text-[13px] font-medium px-4 py-2.5 rounded-xl shadow-2xl leading-snug">{label}</div>
      {side === 'top'    && <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-[7px] border-r-[7px] border-t-[8px] border-l-transparent border-r-transparent border-t-[#1c1c1e]" />}
      {side === 'bottom' && <div className="absolute bottom-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-[7px] border-r-[7px] border-b-[8px] border-l-transparent border-r-transparent border-b-[#1c1c1e]" />}
      {side === 'right'  && <div className="absolute right-full top-1/2 -translate-y-1/2 w-0 h-0 border-t-[7px] border-b-[7px] border-r-[8px] border-t-transparent border-b-transparent border-r-[#1c1c1e]" />}
      {side === 'left'   && <div className="absolute left-full top-1/2 -translate-y-1/2 w-0 h-0 border-t-[7px] border-b-[7px] border-l-[8px] border-t-transparent border-b-transparent border-l-[#1c1c1e]" />}
    </div>,
    document.body
  )
}

function Hotspot({ children, label, onClick, side = 'top', minW = 240 }: {
  children: React.ReactNode; label: string; onClick: () => void; side?: TooltipSide; minW?: number
}) {
  const ref = useRef<HTMLDivElement>(null)
  return (
    <div ref={ref} className="relative inline-block cursor-pointer" onClick={onClick}>
      <div className="absolute -inset-1.5 rounded-lg ring-2 ring-primary shadow-[0_0_12px_2px_rgba(54,158,71,0.3)] pointer-events-none z-10 animate-pulse" />
      <PortalTooltip anchorRef={ref} label={label} side={side} minW={minW} />
      {children}
    </div>
  )
}

const NAV_SECTIONS = [
  { label: 'Principal',   items: [{ id: 'dashboard',      label: 'Dashboard',    Icon: TrendingUp  }] },
  { label: 'Ferramentas', items: [
    { id: 'crm',           label: 'CRM',          Icon: PieChart      },
    { id: 'atendimento',   label: 'Atendimento',  Icon: MessageCircle },
    { id: 'automacoes',    label: 'Automacoes',   Icon: Megaphone     },
  ]},
  { label: 'Gestao',      items: [{ id: 'membros', label: 'Membros', Icon: UserCog }] },
  { label: 'Sistema',     items: [
    { id: 'novidades',     label: 'Novidades',    Icon: Sparkles  },
    { id: 'ajuda',         label: 'Ajuda',        Icon: LifeBuoy  },
    { id: 'configuracoes', label: 'Configuracao', Icon: Settings  },
  ]},
] as const

function FakeSidebar({ active }: { active: string }) {
  return (
    <div className="w-56 flex-shrink-0 bg-card border-r border-border flex flex-col h-full">
      <div className="h-14 flex items-center px-4 border-b border-border gap-2.5 flex-shrink-0">
        <ZaapliIcon size={24} />
        <span className="text-sm font-bold tracking-tight">zaapply</span>
      </div>
      <div className="flex-1 overflow-y-auto py-3 space-y-4 px-2">
        {NAV_SECTIONS.map(sec => (
          <div key={sec.label}>
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50 px-2 mb-1">{sec.label}</p>
            {sec.items.map(({ id, label, Icon }) => (
              <div key={id} className={cn(
                'flex items-center gap-2.5 px-2 py-1.5 rounded-lg text-sm transition-colors',
                id === active ? 'bg-primary/10 text-primary font-medium' : 'text-muted-foreground hover:bg-muted'
              )}>
                <Icon className="w-4 h-4 shrink-0" /><span>{label}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Kanban data ───────────────────────────────────────────────────────────────
type ColumnId = 'Lead novo' | 'Em contato' | 'Interessado' | 'Proposta enviada' | 'Fechado' | 'Perdido' | 'Remarketing'

const COLUMNS: { id: ColumnId; Icon: React.ElementType; color: string; badge: string }[] = [
  { id: 'Lead novo',       Icon: UserPlus,     color: 'text-blue-500',   badge: 'bg-blue-500/10 text-blue-700'    },
  { id: 'Em contato',      Icon: MessageCircle,color: 'text-pink-500',   badge: 'bg-pink-500/10 text-pink-700'    },
  { id: 'Interessado',     Icon: Star,         color: 'text-green-500',  badge: 'bg-green-500/10 text-green-700'  },
  { id: 'Proposta enviada',Icon: FileText,     color: 'text-cyan-500',   badge: 'bg-cyan-500/10 text-cyan-700'    },
  { id: 'Fechado',         Icon: CheckCircle2, color: 'text-green-500',  badge: 'bg-green-500/10 text-green-700'  },
  { id: 'Perdido',         Icon: XCircle,      color: 'text-red-500',    badge: 'bg-red-500/10 text-red-700'      },
  { id: 'Remarketing',     Icon: Repeat2,      color: 'text-yellow-500', badge: 'bg-yellow-500/10 text-yellow-700'},
]

interface FakeLead { id: string; name: string; company: string; value: string; priority: 'Alta' | 'Media' | 'Baixa'; initials: string; color: string }

const INITIAL_LEADS: Record<ColumnId, FakeLead[]> = {
  'Lead novo':        [
    { id: 'l1', name: 'Carlos Mendes',   company: 'TechFlow Solutions', value: 'R$ 2.400',  priority: 'Alta',  initials: 'CM', color: 'bg-blue-500'   },
    { id: 'l2', name: 'Mariana Oliveira',company: 'Studio MO',          value: 'R$ 890',    priority: 'Media', initials: 'MO', color: 'bg-rose-500'   },
  ],
  'Em contato':       [
    { id: 'l3', name: 'Roberto Farias',  company: 'Construtora RF',     value: 'R$ 5.800',  priority: 'Alta',  initials: 'RF', color: 'bg-amber-600'  },
  ],
  'Interessado':      [
    { id: 'l4', name: 'Ana Lima',        company: 'Padaria do Joao',    value: 'R$ 1.200',  priority: 'Baixa', initials: 'AL', color: 'bg-violet-500' },
    { id: 'l5', name: 'Paulo Souza',     company: 'Agencia PS',         value: 'R$ 3.600',  priority: 'Alta',  initials: 'PS', color: 'bg-teal-500'   },
  ],
  'Proposta enviada': [
    { id: 'l6', name: 'Julia Costa',     company: 'Clinica JC',         value: 'R$ 4.200',  priority: 'Media', initials: 'JC', color: 'bg-pink-500'   },
  ],
  'Fechado':          [
    { id: 'l7', name: 'Diego Alves',     company: 'Software DA',        value: 'R$ 8.900',  priority: 'Alta',  initials: 'DA', color: 'bg-indigo-500' },
  ],
  'Perdido':          [],
  'Remarketing':      [],
}

function PriorityBadge({ p }: { p: 'Alta' | 'Media' | 'Baixa' }) {
  return (
    <span className={cn('text-[10px] px-1.5 py-0.5 rounded font-medium',
      p === 'Alta'  ? 'bg-red-500/10 text-red-600 dark:text-red-400' :
      p === 'Media' ? 'bg-primary/10 text-primary' :
                     'bg-muted text-muted-foreground'
    )}>{p}</span>
  )
}

function LeadCard({ lead, highlighted, dragging, onClick }: {
  lead: FakeLead; highlighted?: boolean; dragging?: boolean; onClick?: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  return (
    <div ref={ref}
      onClick={onClick}
      className={cn(
        'relative bg-card rounded-xl border p-3 space-y-2 transition-all duration-200 cursor-pointer',
        dragging  ? 'border-primary shadow-[0_8px_30px_rgba(0,0,0,0.2)] scale-105 rotate-1 opacity-90 z-30' :
        highlighted ? 'border-primary/50 shadow-md' : 'border-border/50 hover:shadow-sm',
      )}>
      {highlighted && !dragging && (
        <div className="absolute inset-0 rounded-xl ring-2 ring-primary shadow-[0_0_12px_2px_rgba(54,158,71,0.3)] pointer-events-none z-10 animate-pulse" />
      )}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className={cn('w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-bold shrink-0', lead.color)}>
            {lead.initials}
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold line-clamp-1">{lead.name}</p>
            <p className="text-[10px] text-muted-foreground truncate">{lead.company}</p>
          </div>
        </div>
        <PriorityBadge p={lead.priority} />
      </div>
      <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
        <DollarSign className="w-3 h-3" />
        <span>{lead.value}</span>
      </div>
    </div>
  )
}

// ── Scenes ────────────────────────────────────────────────────────────────────
type Scene = 'kanban_view' | 'card_grabbed' | 'card_dropping' | 'card_dropped' | 'done'
const SCENES: Scene[] = ['kanban_view', 'card_grabbed', 'card_dropping', 'card_dropped', 'done']
const META: Record<Scene, string> = {
  kanban_view:   'Clique em um card para "arrastar" o lead para outro estagio',
  card_grabbed:  'Card selecionado — clique na coluna "Em contato" para mover o lead',
  card_dropping: 'Movendo para "Em contato"...',
  card_dropped:  'Lead movido para "Em contato" — o funil atualiza em tempo real',
  done:          'Kanban atualizado — arraste leads entre estagios para gerenciar o funil',
}

function KanbanBoard({ scene, advance }: { scene: Scene; advance: () => void }) {
  const [leads, setLeads] = useState(INITIAL_LEADS)
  const emContaRef = useRef<HTMLDivElement>(null)

  // When card_dropped, move the lead
  useEffect(() => {
    if (scene !== 'card_dropping') return
    const t = setTimeout(() => {
      setLeads(prev => {
        const card = prev['Lead novo'][0]
        return {
          ...prev,
          'Lead novo':   prev['Lead novo'].slice(1),
          'Em contato':  [card, ...prev['Em contato']],
        }
      })
      advance()
    }, 800)
    return () => clearTimeout(t)
  }, [scene]) // eslint-disable-line react-hooks/exhaustive-deps

  const draggingCard = scene === 'card_grabbed' || scene === 'card_dropping'
  const draggedLead  = leads['Lead novo'][0]

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-5 h-14 border-b border-border bg-card flex-shrink-0">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-semibold">CRM</h2>
          <div className="flex rounded-lg border border-border bg-muted p-0.5">
            <button className="flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-background text-foreground shadow-sm">
              <LayoutGrid className="w-3.5 h-3.5" />Kanban
            </button>
            <button className="flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium text-muted-foreground">
              <Table2 className="w-3.5 h-3.5" />Tabela
            </button>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 h-8 px-3 rounded-lg border border-border bg-muted/50">
            <Search className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-xs text-muted-foreground/60">Buscar lead</span>
          </div>
          <button className="flex items-center gap-1.5 px-3 h-8 rounded-lg text-xs font-semibold bg-primary text-primary-foreground">
            <Plus className="w-3.5 h-3.5" />Novo lead
          </button>
        </div>
      </div>

      {/* Kanban columns */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden">
        <div className="flex gap-3 p-4 h-full" style={{ minWidth: 1100 }}>
          {COLUMNS.map(col => {
            const colLeads = leads[col.id]
            const isEmContato = col.id === 'Em contato'
            const isLeadNovo  = col.id === 'Lead novo'
            const isDropTarget = scene === 'card_grabbed' && isEmContato

            return (
              <div key={col.id} className="flex flex-col flex-shrink-0" style={{ width: 152 }}>
                {/* Column header */}
                <div className="mb-2 flex items-center gap-1.5">
                  <col.Icon className={cn('h-4 w-4', col.color)} />
                  <span className="font-medium text-xs text-foreground">{col.id}</span>
                  <span className="text-[10px] font-medium text-muted-foreground bg-accent px-1.5 py-0.5 rounded-full tabular-nums">
                    {colLeads.length + (isLeadNovo && draggingCard ? -1 : isEmContato && draggingCard ? 1 : 0) > 0
                      ? colLeads.length + (isLeadNovo && draggingCard ? -1 : isEmContato && draggingCard ? 1 : 0)
                      : colLeads.length
                    }
                  </span>
                </div>

                {/* Drop zone */}
                <div
                  ref={isEmContato ? emContaRef : null}
                  onClick={isDropTarget ? advance : undefined}
                  className={cn(
                    'flex-1 rounded-xl px-1 space-y-2 py-1 transition-all duration-200 overflow-y-auto',
                    isDropTarget ? 'bg-primary/5 ring-2 ring-inset ring-primary/30 cursor-pointer' : 'bg-transparent'
                  )}>
                  {colLeads.map((lead, i) => {
                    const isFirst = isLeadNovo && i === 0
                    const shouldHide = isFirst && (scene === 'card_grabbed' || scene === 'card_dropping')

                    if (shouldHide) return null

                    return isFirst && scene === 'kanban_view' ? (
                      <Hotspot key={lead.id}
                        label="Clique no card para seleciona-lo e arrastar para outro estagio"
                        onClick={advance} side="bottom" minW={300}>
                        <LeadCard lead={lead} />
                      </Hotspot>
                    ) : (
                      <LeadCard key={lead.id} lead={lead}
                        highlighted={isEmContato && scene === 'card_dropped' && i === 0} />
                    )
                  })}

                  {/* Dragging ghost in Em contato */}
                  {isDropTarget && draggedLead && (
                    <div className="border-2 border-dashed border-primary/40 rounded-xl p-3 h-20 flex items-center justify-center">
                      <p className="text-xs text-primary/60 font-medium">Soltar aqui</p>
                    </div>
                  )}

                  {colLeads.length === 0 && !isDropTarget && (
                    <div className="flex items-center justify-center py-8 border border-dashed border-border/40 rounded-lg mx-0.5">
                      <p className="text-[10px] text-muted-foreground/40">Sem leads</p>
                    </div>
                  )}
                </div>

                {isDropTarget && (
                  <PortalTooltip anchorRef={emContaRef} label='Clique aqui para mover o lead para "Em contato"' side="bottom" minW={280} />
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Floating dragging card */}
      {draggingCard && draggedLead && (
        <div className="fixed z-50 pointer-events-none" style={{ top: '30%', left: '34%', transform: 'rotate(2deg)' }}>
          <LeadCard lead={draggedLead} dragging />
        </div>
      )}
    </div>
  )
}

export function CRMDemo() {
  const [scene, setScene] = useState<Scene>('kanban_view')
  const advance = () => setScene(s => SCENES[Math.min(SCENES.indexOf(s) + 1, SCENES.length - 1)])
  const idx = SCENES.indexOf(scene)

  return (
    <div className="w-full rounded-2xl border border-border shadow-xl bg-background">
      <div className="bg-muted/40 border-b border-border px-4 py-2 flex items-center gap-3 rounded-t-2xl">
        <div className="flex gap-1.5">
          <div className="w-3 h-3 rounded-full bg-red-400/60" />
          <div className="w-3 h-3 rounded-full bg-amber-400/60" />
          <div className="w-3 h-3 rounded-full bg-emerald-400/60" />
        </div>
        <div className="flex-1 bg-background/80 border border-border/40 rounded-md px-3 py-1 text-[11px] text-muted-foreground font-mono">
          app.zaapply.com.br/crm
        </div>
      </div>
      <div className="flex" style={{ height: 520 }}>
        <FakeSidebar active="crm" />
        <div className="flex-1 min-w-0 overflow-hidden">
          <div key={scene === 'card_dropping' ? 'dropping' : scene} className="h-full">
            <KanbanBoard scene={scene} advance={advance} />
          </div>
        </div>
      </div>
      <div className="border-t border-border bg-muted/20 px-5 py-3 flex items-center gap-4 rounded-b-2xl">
        <div className="flex gap-1.5">
          {SCENES.filter(s => s !== 'done').map((s, i) => (
            <div key={s} className={cn('rounded-full transition-all duration-300',
              s === scene   ? 'w-5 h-1.5 bg-primary'
                : i < idx  ? 'w-1.5 h-1.5 bg-primary/50'
                           : 'w-1.5 h-1.5 bg-muted-foreground/20'
            )} />
          ))}
        </div>
        <p className="text-[12px] text-muted-foreground flex-1">{META[scene]}</p>
        {scene === 'done' && (
          <button onClick={() => setScene('kanban_view')}
            className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2">
            Recomecar
          </button>
        )}
      </div>
    </div>
  )
}
