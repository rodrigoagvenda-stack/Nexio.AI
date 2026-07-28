'use client'

import { useState, useRef, useEffect, useLayoutEffect } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/utils'
import {
  TrendingUp, PieChart, MessageCircle, UserCog,
  Sparkles, LifeBuoy, Settings, Megaphone,
  Zap, MessageSquare, Clock, Plus, Save, CheckCircle2, X,
  PenLine, Play, LayoutTemplate, History, Search, GitBranch,
  Target, XCircle, ToggleRight, ToggleLeft,
} from 'lucide-react'

// ── Shared primitives ─────────────────────────────────────────────────────────
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

// ── FakeNode ──────────────────────────────────────────────────────────────────
const ACCENTS = {
  primary:    { bg: 'bg-primary/10',    icon: 'text-primary',    border: 'border-primary/30'    },
  emerald:    { bg: 'bg-emerald-500/10', icon: 'text-emerald-500', border: 'border-emerald-500/30' },
  amber:      { bg: 'bg-amber-500/10',  icon: 'text-amber-500',  border: 'border-amber-500/30'  },
}

function FakeNode({ accent = 'primary', icon: Icon, label, meta, children, selected, noLeftHandle }: {
  accent?: keyof typeof ACCENTS; icon: React.ElementType; label: string; meta?: string
  children?: React.ReactNode; selected?: boolean; noLeftHandle?: boolean
}) {
  const a = ACCENTS[accent]
  return (
    <div style={{ width: 240 }} className={cn(
      'relative bg-card rounded-xl border transition-all duration-100',
      selected ? 'border-primary/60 shadow-[0_0_0_2px_hsl(var(--primary)/0.2),0_4px_14px_rgba(0,0,0,0.08)]' : 'border-border/25 shadow-[0_1px_3px_rgba(0,0,0,0.07),0_4px_14px_rgba(0,0,0,0.05)]'
    )}>
      {!noLeftHandle && <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-[5px] w-2.5 h-2.5 rounded-full border-2 border-border bg-background z-10" />}
      <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-[5px] w-2.5 h-2.5 rounded-full border-2 border-border bg-background z-10" />
      <div className={cn('flex items-center gap-2 px-3 pt-3 pb-2')}>
        <div className={cn('w-5 h-5 rounded-md flex items-center justify-center', a.bg)}>
          <Icon className={cn('w-3 h-3', a.icon)} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-semibold text-foreground/50 tracking-wide uppercase">{label}</p>
          {meta && <p className="text-[10px] text-muted-foreground/60">{meta}</p>}
        </div>
      </div>
      {children && <div className="px-3 pb-3">{children}</div>}
    </div>
  )
}

function Edge({ x1, y1, x2, y2 }: { x1: number; y1: number; x2: number; y2: number }) {
  const cx = x1 + (x2 - x1) * 0.5
  const d = `M ${x1} ${y1} C ${cx} ${y1}, ${cx} ${y2}, ${x2} ${y2}`
  return (
    <svg style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, width: '100%', height: '100%', pointerEvents: 'none', overflow: 'visible', zIndex: 0 }}>
      <defs><marker id="ar-cd" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto"><circle cx="4" cy="4" r="2.5" fill="hsl(var(--muted-foreground)/0.5)" /></marker></defs>
      <path d={d} fill="none" stroke="hsl(var(--muted-foreground)/0.35)" strokeWidth="1.5" markerEnd="url(#ar-cd)" />
    </svg>
  )
}

// ── Sequence list (starting screen) ──────────────────────────────────────────
const SEQUENCES = [
  { name: 'Boas-vindas', type: 'Follow-up', steps: 3, active: true  },
  { name: 'Anti-Noshow', type: 'Follow-up', steps: 4, active: true  },
  { name: 'Remarketing', type: 'Follow-up', steps: 2, active: false },
]

function SequenceList({ highlightFirst, onOpen }: { highlightFirst: boolean; onOpen: () => void }) {
  const firstRef = useRef<HTMLDivElement>(null)
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-5 h-14 border-b border-border flex-shrink-0">
        <div className="flex gap-1">
          {['Follow-up', 'Anti-Noshow', 'Remarketing', 'Trial SaaS'].map((t, i) => (
            <button key={t} className={cn(
              'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
              i === 0 ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'
            )}>{t}</button>
          ))}
        </div>
        <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-primary text-primary-foreground">
          <Plus className="w-3.5 h-3.5" />Nova sequencia
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-5 space-y-2">
        {SEQUENCES.map((seq, i) => {
          const isFirst = i === 0
          const row = (
            <div
              ref={isFirst ? firstRef : null}
              className={cn(
                'flex items-center gap-4 p-4 rounded-xl border border-border bg-card hover:shadow-sm transition-all cursor-pointer',
                isFirst && highlightFirst && 'ring-2 ring-primary'
              )}
              onClick={isFirst ? onOpen : undefined}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold">{seq.name}</p>
                  <span className={cn(
                    'text-[10px] px-1.5 py-0.5 rounded font-medium',
                    seq.active ? 'bg-emerald-500/10 text-emerald-600' : 'bg-muted text-muted-foreground'
                  )}>
                    {seq.type}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">{seq.steps} etapas</p>
              </div>
              <div className="flex items-center gap-3">
                {seq.active
                  ? <ToggleRight className="w-8 h-8 text-primary" />
                  : <ToggleLeft className="w-8 h-8 text-muted-foreground/40" />
                }
                <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-border bg-muted/50 text-muted-foreground">
                  <PenLine className="w-3 h-3" />Abrir Canvas
                </button>
              </div>
            </div>
          )
          return isFirst && highlightFirst ? (
            <div key={seq.name} className="relative">
              <div className="absolute inset-0 rounded-xl ring-2 ring-primary shadow-[0_0_12px_2px_rgba(54,158,71,0.3)] pointer-events-none z-10 animate-pulse" />
              {row}
              {firstRef.current && (
                <PortalTooltip anchorRef={firstRef} label='Clique em "Abrir Canvas" para editar o fluxo desta sequencia' side="top" minW={330} />
              )}
            </div>
          ) : <div key={seq.name}>{row}</div>
        })}
      </div>
    </div>
  )
}

// ── Config panel ──────────────────────────────────────────────────────────────
const MSG = 'Ola {nome}! Que otimo ter voce conosco. Posso te ajudar com alguma duvida sobre a plataforma?'

function FakeConfigPanel({ msgText, msgRef, onMsgClick }: {
  msgText: string; msgRef?: React.RefObject<HTMLDivElement | null>; onMsgClick?: () => void
}) {
  return (
    <div className="w-72 bg-card border-l border-border h-full flex flex-col flex-shrink-0">
      <div className="flex items-center justify-between px-4 h-12 border-b border-border flex-shrink-0">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Configurar</span>
        <button className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
      </div>
      <div className="p-4 flex flex-col gap-4 overflow-y-auto flex-1">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Quando disparar</label>
          <div className="flex rounded-xl border border-border overflow-hidden">
            <div className="flex-1 py-1.5 text-xs font-medium bg-primary text-primary-foreground text-center">Dias</div>
            <div className="flex-1 py-1.5 text-xs font-medium text-muted-foreground text-center">Horas</div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Dia</label>
            <div className="w-full h-9 px-3 rounded-xl border border-border bg-muted text-sm text-foreground flex items-center font-mono">0</div>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Horario</label>
            <div className="w-full h-9 px-3 rounded-xl border border-border bg-muted text-sm text-foreground flex items-center gap-0.5 font-mono">09<span className="text-muted-foreground font-bold">:</span>00</div>
          </div>
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Mensagem</label>
          <div ref={msgRef} onClick={onMsgClick}
            className={cn(
              'w-full min-h-[80px] px-3 py-2.5 rounded-xl border border-border bg-muted text-sm leading-relaxed transition-all',
              msgText ? 'text-foreground' : 'text-muted-foreground/50 italic',
              onMsgClick && 'ring-2 ring-primary shadow-[0_0_10px_2px_rgba(54,158,71,0.3)] cursor-pointer animate-pulse'
            )}>
            {msgText || 'Digite a mensagem que sera enviada ao lead'}
          </div>
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Controle da IA</label>
          <div className="w-full h-9 px-3 rounded-xl border border-border bg-muted text-sm text-foreground flex items-center justify-between">
            <span>Sem mudanca</span><span className="text-muted-foreground/40 text-xs">&#9662;</span>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Top bar ───────────────────────────────────────────────────────────────────
function CanvasTopBar({ saved, saveRef, onSave, highlightSave }: {
  saved?: boolean; saveRef?: React.RefObject<HTMLButtonElement | null>; onSave?: () => void; highlightSave?: boolean
}) {
  return (
    <div className="flex items-center justify-between px-4 h-12 border-b border-border bg-card flex-shrink-0">
      <div className="flex items-center gap-1">
        {['Editor', 'Execucoes'].map((t, i) => (
          <button key={t} className={cn('px-3 py-1 rounded-lg text-xs font-medium',
            i === 0 ? 'bg-muted text-foreground' : 'text-muted-foreground hover:bg-muted')}>{t}</button>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <button className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs text-muted-foreground border border-border hover:bg-muted">
          <LayoutTemplate className="w-3.5 h-3.5" />Templates
        </button>
        <button className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs text-muted-foreground border border-border hover:bg-muted">
          <History className="w-3.5 h-3.5" />Versoes
        </button>
        <div className="relative">
          {highlightSave && (
            <div className="absolute -inset-1 rounded-lg ring-2 ring-primary shadow-[0_0_10px_2px_rgba(54,158,71,0.3)] animate-pulse pointer-events-none" />
          )}
          <button ref={saveRef} onClick={onSave}
            className={cn('relative flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold border transition-all',
              saved ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600' : 'bg-primary text-primary-foreground border-primary hover:bg-primary/90'
            )}>
            {saved ? <><CheckCircle2 className="w-3.5 h-3.5" />Salvo</> : <><Save className="w-3.5 h-3.5" />Salvar</>}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Palette ───────────────────────────────────────────────────────────────────
const PALETTE_ITEMS = [
  { kind: 'message',   label: 'Mensagem',  desc: 'Envia uma mensagem ao lead',    Icon: MessageSquare, bg: 'bg-emerald-500/10', ic: 'text-emerald-500' },
  { kind: 'wait',      label: 'Aguardar',  desc: 'Pausa o fluxo por X dias',      Icon: Clock,          bg: 'bg-amber-500/10',   ic: 'text-amber-500'   },
  { kind: 'condition', label: 'Condicao',  desc: 'Bifurca com base em variavel',   Icon: GitBranch,      bg: 'bg-violet-500/10',  ic: 'text-violet-500'  },
  { kind: 'goal',      label: 'Meta',      desc: 'Marca lead como convertido',     Icon: Target,         bg: 'bg-emerald-500/10', ic: 'text-emerald-500' },
  { kind: 'end',       label: 'Fim',       desc: 'Encerra a sequencia',            Icon: XCircle,        bg: 'bg-red-500/10',     ic: 'text-red-500'     },
] as const

function FakePalette({ onSelectMessage }: { onSelectMessage: () => void }) {
  const highlightRef = useRef<HTMLButtonElement>(null)
  return (
    <div className="absolute right-16 top-1/2 -translate-y-1/2 z-20 w-64 bg-card border border-border rounded-2xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-right-2 duration-150">
      <div className="px-4 py-3 border-b border-border space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">O que acontece a seguir?</p>
          <button className="text-muted-foreground hover:text-foreground"><X className="w-3.5 h-3.5" /></button>
        </div>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <div className="w-full h-8 pl-8 pr-3 text-sm bg-muted rounded-lg text-muted-foreground/60">Buscar no</div>
        </div>
      </div>
      <div className="p-2 space-y-0.5">
        {PALETTE_ITEMS.map(({ kind, label, desc, Icon, bg, ic }) => {
          const isMsg = kind === 'message'
          return (
            <div key={kind} className="relative">
              {isMsg && <div className="absolute inset-0 rounded-xl ring-2 ring-primary shadow-[0_0_10px_2px_rgba(54,158,71,0.3)] pointer-events-none z-10 animate-pulse" />}
              <button
                ref={isMsg ? highlightRef : null}
                onClick={isMsg ? onSelectMessage : undefined}
                className={cn('w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm text-left transition-colors',
                  isMsg ? 'bg-muted cursor-pointer' : 'hover:bg-muted'
                )}>
                <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center shrink-0', bg)}>
                  <Icon className={cn('w-4 h-4', ic)} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-foreground">{label}</p>
                  <p className="text-xs text-muted-foreground truncate">{desc}</p>
                </div>
              </button>
            </div>
          )
        })}
      </div>
      <PortalTooltip anchorRef={highlightRef} label="Clique em Mensagem para adicionar ao fluxo" side="left" minW={290} />
    </div>
  )
}

// ── Scenes ────────────────────────────────────────────────────────────────────
type Scene = 'seq_list' | 'canvas_empty' | 'palette_open' | 'node_added' | 'node_config' | 'saved' | 'done'
const SCENES: Scene[] = ['seq_list', 'canvas_empty', 'palette_open', 'node_added', 'node_config', 'saved', 'done']
const META: Record<Scene, string> = {
  seq_list:     'Clique em "Abrir Canvas" para editar o fluxo da sequencia',
  canvas_empty: 'Canvas aberto — clique em "+" para adicionar o primeiro no',
  palette_open: 'Selecione o tipo de no que deseja adicionar ao fluxo',
  node_added:   'No adicionado — clique nele para configurar a mensagem',
  node_config:  'Painel de configuracao aberto — clique no campo Mensagem',
  saved:        'Mensagem configurada — clique em Salvar para finalizar',
  done:         'Fluxo salvo com sucesso',
}

function CanvasScreen({ scene, advance }: { scene: Scene; advance: () => void }) {
  const saveRef = useRef<HTMLButtonElement>(null)
  const msgRef  = useRef<HTMLDivElement>(null)
  const addRef  = useRef<HTMLButtonElement>(null)

  const showCanvas  = scene !== 'seq_list'
  const hasConfig   = scene === 'node_config' || scene === 'saved' || scene === 'done'
  const showMsg     = scene === 'saved' || scene === 'done'
  const showMsgNode = scene === 'node_added' || hasConfig

  const trigX = hasConfig ? 22 : 80,  trigY = hasConfig ? 190 : 200
  const msgX  = hasConfig ? 285 : 400, msgY = hasConfig ? 190 : 200
  const trigRX = trigX + 245, trigCY = trigY + 44
  const msgLX  = msgX  - 5,   msgCY  = msgY  + 55

  if (!showCanvas) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between px-5 h-12 border-b border-border bg-card flex-shrink-0">
          <h2 className="text-sm font-semibold">Automacoes</h2>
        </div>
        <SequenceList highlightFirst={scene === 'seq_list'} onOpen={advance} />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <CanvasTopBar
        saved={scene === 'done'}
        saveRef={saveRef}
        onSave={scene === 'saved' ? advance : undefined}
        highlightSave={scene === 'saved'}
      />
      {scene === 'saved' && (
        <PortalTooltip anchorRef={saveRef} label="Clique em Salvar para finalizar o fluxo" side="top" minW={270} />
      )}
      <div className="flex min-h-0 flex-1">
        <div className="relative overflow-hidden bg-background dark:bg-[#0e0e0e] flex-1"
          style={{
            backgroundImage: 'radial-gradient(circle, hsl(var(--muted-foreground)/0.18) 1px, transparent 1px)',
            backgroundSize: '20px 20px',
          }}>
          {showMsgNode && <Edge x1={trigRX} y1={trigCY} x2={msgLX} y2={msgCY} />}

          {/* Trigger */}
          <div style={{ position: 'absolute', left: trigX, top: trigY, zIndex: 1 }}>
            <FakeNode accent="primary" icon={Zap} label="Gatilho" noLeftHandle>
              <p className="text-sm font-semibold text-foreground/90 leading-snug">Boas-vindas</p>
              <p className="text-xs text-muted-foreground/70">Novo lead criado</p>
            </FakeNode>
          </div>

          {/* Message node */}
          {showMsgNode && (
            <div style={{ position: 'absolute', left: msgX, top: msgY, zIndex: hasConfig ? 2 : 1 }}>
              {scene === 'node_added' ? (
                <Hotspot label="Clique no no para configurar a mensagem" onClick={advance} side="top" minW={290}>
                  <FakeNode accent="emerald" icon={MessageSquare} label="Mensagem" meta="D0 · 09:00">
                    <p className="text-xs text-muted-foreground/50 italic">Sem mensagem configurada</p>
                  </FakeNode>
                </Hotspot>
              ) : (
                <FakeNode accent="emerald" icon={MessageSquare} label="Mensagem" meta="D0 · 09:00"
                  selected={hasConfig && !showMsg}>
                  {showMsg
                    ? <p className="text-xs text-foreground/80 leading-relaxed line-clamp-3 bg-muted/30 rounded-lg px-2.5 py-2">{MSG}</p>
                    : <p className="text-xs text-muted-foreground/50 italic">Sem mensagem configurada</p>
                  }
                </FakeNode>
              )}
            </div>
          )}

          {/* Palette */}
          {scene === 'palette_open' && <FakePalette onSelectMessage={advance} />}

          {/* "+" button */}
          <div className="absolute right-3 top-1/2 -translate-y-1/2 z-10">
            {scene === 'canvas_empty' ? (
              <Hotspot label='Clique em "+" para adicionar o primeiro no ao fluxo' onClick={advance} side="left" minW={310}>
                <button ref={addRef as any}
                  className="w-10 h-10 rounded-xl bg-card border border-border flex items-center justify-center shadow-md text-muted-foreground">
                  <Plus className="w-5 h-5" />
                </button>
              </Hotspot>
            ) : (
              <button className="w-10 h-10 rounded-xl bg-card border border-border flex items-center justify-center shadow-md text-muted-foreground">
                <Plus className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>

        {/* Config panel */}
        {hasConfig && (
          <div className="relative">
            {scene === 'node_config' ? (
              <>
                <FakeConfigPanel msgText="" msgRef={msgRef} onMsgClick={advance} />
                <PortalTooltip anchorRef={msgRef} label="Clique aqui e configure a mensagem de boas-vindas" side="left" minW={290} />
              </>
            ) : (
              <FakeConfigPanel msgText={MSG} msgRef={msgRef} />
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export function CanvasDemo() {
  const [scene, setScene] = useState<Scene>('seq_list')
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
          app.zaapply.com.br/automacoes
        </div>
      </div>
      <div className="flex" style={{ height: 520 }}>
        <FakeSidebar active="automacoes" />
        <div className="flex-1 min-w-0 overflow-hidden">
          <div key={scene} className="h-full animate-in fade-in duration-150">
            <CanvasScreen scene={scene} advance={advance} />
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
          <button onClick={() => setScene('seq_list')}
            className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2">
            Recomecar
          </button>
        )}
      </div>
    </div>
  )
}
