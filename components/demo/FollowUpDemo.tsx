'use client'

import { useState, useRef, useEffect, useLayoutEffect } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/utils'
import {
  TrendingUp, PieChart, MessageCircle, UserCog,
  Sparkles, LifeBuoy, Settings, Megaphone,
  Zap, MessageSquare, Clock, XCircle, Target, GitBranch,
  Plus, Save, CheckCircle2, X, PenLine, Play,
  LayoutTemplate, History, Search,
} from 'lucide-react'

// ── Real Zaapply SVG icon ────────────────────────────────────────────────────
function ZaapliIcon({ size = 26 }: { size?: number }) {
  const w = size * (208 / 235)
  return (
    <svg width={w} height={size} viewBox="0 0 208 235" fill="none">
      <path d="M207.65 103.853C207.65 104.953 207.65 106.063 207.59 107.143V107.213C207.562 120.28 205.556 133.267 201.64 145.733C194.543 167.855 181.706 187.699 164.44 203.243C146.982 218.999 125.668 229.859 102.66 234.723V207.653C82.1745 207.423 62.2151 201.137 45.2943 189.587C28.3736 178.037 15.2477 161.74 7.56905 142.747C-0.109597 123.753 -1.99782 102.913 2.14207 82.8485C6.28195 62.7843 16.2649 44.3933 30.8343 29.9904C45.4037 15.5875 63.9083 5.81663 84.0187 1.90763C104.129 -2.00137 124.946 0.126266 143.85 8.02272C162.754 15.9192 178.9 29.2315 190.254 46.2839C201.609 63.3363 207.665 83.3666 207.66 103.853H207.65Z" fill="#369E47"/>
      <path d="M82.5917 152.783C77.2584 152.783 73.3551 151.533 70.8817 149.033C69.6593 147.837 68.6957 146.402 68.0506 144.818C67.4056 143.233 67.0928 141.534 67.1317 139.823C67.2062 136.582 67.9519 133.392 69.3217 130.453C70.8962 126.943 73.1222 123.764 75.8817 121.083L110.712 84.6934H76.5917C75.2672 84.6934 73.9556 84.4324 72.732 83.9252C71.5084 83.418 70.3967 82.6746 69.4605 81.7375C68.5244 80.8005 67.7821 79.6881 67.2761 78.464C66.7702 77.2398 66.5104 75.928 66.5117 74.6034C66.5117 71.7285 67.6538 68.9713 69.6867 66.9384C71.7196 64.9055 74.4768 63.7634 77.3517 63.7634H125.082C130.915 63.7634 135.132 65.0101 137.732 67.5034C138.968 68.6341 139.953 70.011 140.625 71.5456C141.297 73.0801 141.64 74.7383 141.632 76.4134C141.632 81.7468 139.395 86.9001 134.922 91.8734L97.9217 131.873H129.922C132.799 131.873 135.559 133.017 137.594 135.051C139.629 137.086 140.772 139.846 140.772 142.723C140.769 144.054 140.503 145.371 139.989 146.598C139.475 147.825 138.723 148.938 137.777 149.874C136.831 150.809 135.708 151.548 134.475 152.047C133.242 152.546 131.922 152.797 130.592 152.783H82.5917Z" fill="white"/>
    </svg>
  )
}

// ── PortalTooltip ────────────────────────────────────────────────────────────
type TooltipSide = 'top' | 'right' | 'bottom' | 'left'
function PortalTooltip({ anchorRef, label, side, minW = 240 }: {
  anchorRef: React.RefObject<HTMLElement | null>; label: string; side: TooltipSide; minW?: number
}) {
  const [mounted, setMounted] = useState(false)
  const [style, setStyle]     = useState<React.CSSProperties | null>(null)
  useEffect(() => { setMounted(true) }, [])
  useLayoutEffect(() => {
    const el = anchorRef.current
    if (!el) return
    const r = el.getBoundingClientRect(), gap = 12
    let s: React.CSSProperties
    if      (side === 'top')    s = { bottom: window.innerHeight - r.top + gap, left: r.left + r.width / 2, transform: 'translateX(-50%)' }
    else if (side === 'bottom') s = { top: r.bottom + gap,                       left: r.left + r.width / 2, transform: 'translateX(-50%)' }
    else if (side === 'right')  s = { top: r.top + r.height / 2,                left: r.right + gap,         transform: 'translateY(-50%)' }
    else                        s = { top: r.top + r.height / 2,                right: window.innerWidth - r.left + gap, transform: 'translateY(-50%)' }
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

// ── Hotspot ──────────────────────────────────────────────────────────────────
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

// ── FakeSidebar (exact copy from ProductDemo) ────────────────────────────────
const NAV_SECTIONS = [
  { label: 'Principal',   items: [{ id: 'dashboard',    label: 'Dashboard',    Icon: TrendingUp  }] },
  { label: 'Ferramentas', items: [
    { id: 'crm',           label: 'CRM',          Icon: PieChart      },
    { id: 'atendimento',   label: 'Atendimento',  Icon: MessageCircle },
    { id: 'automacoes',    label: 'Automações',   Icon: Megaphone     },
  ]},
  { label: 'Gestão',      items: [{ id: 'membros', label: 'Membros', Icon: UserCog }] },
  { label: 'Sistema',     items: [
    { id: 'novidades',     label: 'Novidades',    Icon: Sparkles  },
    { id: 'ajuda',         label: 'Ajuda',        Icon: LifeBuoy  },
    { id: 'configuracoes', label: 'Configuração', Icon: Settings  },
  ]},
] as const

function FakeSidebar({ active }: { active: string }) {
  return (
    <aside className="w-56 shrink-0 flex flex-col bg-card border-r border-border h-full">
      <div className="flex items-center h-14 border-b border-border/50 px-4 gap-2 flex-shrink-0">
        <ZaapliIcon size={26} />
        <span className="font-extrabold tracking-tight text-[#0d0d0d] dark:text-white leading-none select-none"
          style={{ fontSize: 18, fontFamily: "'Nunito','Poppins',sans-serif", letterSpacing: '-0.01em' }}>
          zaapply
        </span>
      </div>
      <div className="flex-1 px-3 pt-3 space-y-3">
        {NAV_SECTIONS.map(({ label, items }) => (
          <div key={label}>
            <p className="px-3 mb-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">{label}</p>
            <div className="space-y-0.5">
              {items.map(({ id, label: lbl, Icon }) => (
                <button key={id}
                  className={cn('relative w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors duration-100 text-left',
                    active === id ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-accent/50')}>
                  <Icon className="h-4 w-4 flex-shrink-0" />
                  <span className="text-sm flex-1 text-left">{lbl}</span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="p-3 border-t border-border/50 flex-shrink-0">
        <div className="flex items-center gap-3 px-2 py-2 rounded-xl bg-accent/30">
          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center">
            <span className="text-white text-xs font-bold">R</span>
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground truncate">Minha Empresa</p>
            <p className="text-xs text-muted-foreground truncate">contato@empresa.com</p>
          </div>
        </div>
      </div>
    </aside>
  )
}

// ── Canvas node (matches NodeShell + NodeHeader from AutomationCanvas) ────────
type AccentKey = 'primary' | 'emerald' | 'amber' | 'violet' | 'destructive'

const ICON_CLS: Record<AccentKey, string> = {
  primary:     'text-[hsl(var(--primary))]',
  emerald:     'text-emerald-500',
  amber:       'text-amber-500',
  violet:      'text-violet-500',
  destructive: 'text-destructive',
}
const RING_CLS: Record<AccentKey, string> = {
  primary:     'ring-[hsl(var(--primary)/0.4)] border-[hsl(var(--primary)/0.25)]',
  emerald:     'ring-emerald-500/35 border-emerald-500/20',
  amber:       'ring-amber-500/35 border-amber-500/20',
  violet:      'ring-violet-500/35 border-violet-500/20',
  destructive: 'ring-destructive/35 border-destructive/20',
}

function FakeNode({ accent = 'primary', icon: Icon, label, meta, children, selected, noLeftHandle }: {
  accent?: AccentKey; icon: React.ElementType; label: string; meta?: string
  children?: React.ReactNode; selected?: boolean; noLeftHandle?: boolean
}) {
  return (
    <div style={{ width: 240 }}
      className={cn(
        'relative bg-card rounded-xl border transition-all duration-100',
        'shadow-[0_1px_3px_rgba(0,0,0,0.07),0_4px_14px_rgba(0,0,0,0.05)]',
        selected
          ? cn('ring-2', RING_CLS[accent], 'shadow-[0_4px_24px_rgba(0,0,0,0.1)]')
          : 'border-border/25 hover:border-border/40'
      )}>
      {!noLeftHandle && (
        <div className="absolute -left-[5px] top-1/2 -translate-y-1/2 w-2.5 h-2.5 bg-card border border-border/60 rounded-full z-10" />
      )}
      <div className="absolute -right-[5px] top-1/2 -translate-y-1/2 w-2.5 h-2.5 bg-card border border-border/60 rounded-full z-10" />
      <div className="px-3.5 pt-2.5 pb-3 flex flex-col gap-0">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <div className="w-5 h-5 rounded-md bg-muted/60 flex items-center justify-center shrink-0">
              <Icon className={cn('w-3 h-3', ICON_CLS[accent])} />
            </div>
            <span className="text-[11px] font-semibold text-foreground/50 tracking-wide uppercase leading-none">{label}</span>
          </div>
          {meta && <span className="text-[10px] text-muted-foreground/40 font-mono bg-muted/40 px-1.5 py-0.5 rounded shrink-0">{meta}</span>}
        </div>
        <div className="mt-2 flex flex-col gap-1.5">{children}</div>
      </div>
    </div>
  )
}

// ── SVG bezier edge ───────────────────────────────────────────────────────────
function Edge({ x1, y1, x2, y2 }: { x1: number; y1: number; x2: number; y2: number }) {
  const cx = x1 + (x2 - x1) * 0.5
  const d  = `M ${x1} ${y1} C ${cx} ${y1}, ${cx} ${y2}, ${x2} ${y2}`
  return (
    <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', overflow: 'visible', zIndex: 0 }}>
      <defs>
        <marker id="ar-fu" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
          <path d="M0,0 L0,6 L7,3 z" fill="hsl(var(--muted-foreground)/0.4)" />
        </marker>
      </defs>
      <path d={d} fill="none" stroke="hsl(var(--muted-foreground)/0.3)" strokeWidth="1.5" markerEnd="url(#ar-fu)" />
    </svg>
  )
}

// ── Canvas top bar ────────────────────────────────────────────────────────────
function CanvasTopBar({ saved, saveRef, onSave, highlightSave }: {
  saved?: boolean; saveRef?: React.RefObject<HTMLButtonElement>; onSave?: () => void; highlightSave?: boolean
}) {
  return (
    <div className="flex items-center justify-between px-4 bg-card border-b border-border flex-shrink-0 gap-4" style={{ height: 48 }}>
      <div className="flex items-center gap-3">
        <div className="flex items-center bg-muted rounded-lg p-0.5">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-background text-foreground shadow-sm">
            <PenLine className="w-3 h-3" />Editor
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium text-muted-foreground">
            <Play className="w-3 h-3" />Execuções
          </div>
        </div>
        <div className="w-px h-5 bg-border" />
        <div className="flex items-center gap-1">
          {['Follow-up', 'Anti-Noshow', 'Remarketing', 'Trial SaaS'].map((tab, i) => (
            <button key={tab}
              className={cn('px-3 py-1 rounded-lg text-sm font-medium',
                i === 0 ? 'bg-muted text-foreground' : 'text-muted-foreground')}>
              {tab}
            </button>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium border border-border bg-muted text-muted-foreground">
          <LayoutTemplate className="w-3.5 h-3.5" />Templates
        </button>
        <button className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium border border-border bg-muted text-muted-foreground">
          <History className="w-3.5 h-3.5" />Versões
        </button>
        <div className="w-px h-5 bg-border" />
        <button className="flex items-center gap-2 px-3 py-1 rounded-lg text-xs font-medium border bg-muted border-border text-muted-foreground">
          <span className="w-2 h-2 rounded-full bg-muted-foreground/40" />Inativo
        </button>
        <div className="relative">
          {highlightSave && (
            <div className="absolute -inset-1 rounded-lg ring-2 ring-primary shadow-[0_0_10px_2px_rgba(54,158,71,0.3)] animate-pulse pointer-events-none" />
          )}
          <button ref={saveRef} onClick={onSave}
            className={cn('relative flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold border transition-all',
              saved ? 'bg-primary/10 border-primary/30 text-primary' : 'bg-muted border-border text-foreground hover:bg-accent')}>
            {saved ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
            {saved ? 'Salvo!' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Palette panel (floating, matches PalettePanel) ────────────────────────────
const PALETTE = [
  { kind: 'message',   label: 'Mensagem',   desc: 'Envia uma mensagem de texto, imagem, vídeo ou áudio.', Icon: MessageSquare, bg: 'bg-emerald-500/10', ic: 'text-emerald-500' },
  { kind: 'wait',      label: 'Aguardar',   desc: 'Aguarda X dias antes de passar para o próximo passo.', Icon: Clock,          bg: 'bg-amber-500/10',   ic: 'text-amber-500'   },
  { kind: 'condition', label: 'Condição',   desc: 'Ramifica o fluxo com base em uma condição do lead.',  Icon: GitBranch,      bg: 'bg-violet-500/10',  ic: 'text-violet-500'  },
  { kind: 'goal',      label: 'Meta',       desc: 'Marca o lead como convertido e registra no CRM.',     Icon: Target,         bg: 'bg-emerald-500/10', ic: 'text-emerald-500' },
  { kind: 'end',       label: 'Fim',        desc: 'Encerra a sequência para o lead.',                    Icon: XCircle,        bg: 'bg-red-500/10',     ic: 'text-red-500'     },
] as const

function FakePalette({ highlightKind, onSelect }: { highlightKind?: string; onSelect: (kind: string) => void }) {
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
          <div className="w-full h-8 pl-8 pr-3 text-sm bg-muted rounded-lg text-muted-foreground/60">Buscar nó…</div>
        </div>
      </div>
      <div className="p-2 space-y-0.5">
        {PALETTE.map(({ kind, label, desc, Icon, bg, ic }) => {
          const isHighlight = highlightKind === kind
          return (
            <div key={kind} className="relative">
              {isHighlight && (
                <div className="absolute inset-0 rounded-xl ring-2 ring-primary shadow-[0_0_10px_2px_rgba(54,158,71,0.3)] pointer-events-none z-10 animate-pulse" />
              )}
              <button
                ref={isHighlight ? highlightRef : null}
                onClick={() => isHighlight ? onSelect(kind) : undefined}
                className={cn(
                  'w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm text-left transition-colors',
                  isHighlight ? 'bg-muted cursor-pointer' : 'hover:bg-muted'
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
      {highlightKind && (
        <PortalTooltip anchorRef={highlightRef} label="Clique em Mensagem para adicionar ao fluxo" side="left" minW={300} />
      )}
    </div>
  )
}

// ── Config panel ──────────────────────────────────────────────────────────────
function FakeConfigPanel({ msgText, msgRef, onMsgClick }: {
  msgText: string; msgRef?: React.RefObject<HTMLDivElement>; onMsgClick?: () => void
}) {
  return (
    <div className="w-72 bg-card border-l border-border h-full flex flex-col flex-shrink-0">
      <div className="flex items-center justify-between px-4 h-12 border-b border-border flex-shrink-0">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Configurar</span>
        <button className="text-muted-foreground"><X className="w-4 h-4" /></button>
      </div>
      <div className="p-4 flex flex-col gap-5 overflow-y-auto flex-1">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Nome do node</label>
          <div className="w-full h-9 px-3 rounded-xl border border-border bg-muted text-sm text-muted-foreground/50 flex items-center">Ex: Boas-vindas</div>
        </div>
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
            <label className="text-xs font-medium text-muted-foreground">Horário</label>
            <div className="w-full h-9 px-3 rounded-xl border border-border bg-muted text-sm text-foreground flex items-center gap-0.5 font-mono">
              09<span className="text-muted-foreground font-bold">:</span>00
            </div>
          </div>
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Mensagem</label>
          <div ref={msgRef}
            onClick={onMsgClick}
            className={cn(
              'w-full min-h-[80px] px-3 py-2.5 rounded-xl border border-border bg-muted text-sm leading-relaxed transition-all',
              msgText ? 'text-foreground' : 'text-muted-foreground/50 italic',
              onMsgClick && 'ring-2 ring-primary shadow-[0_0_10px_2px_rgba(54,158,71,0.3)] cursor-pointer animate-pulse'
            )}>
            {msgText || 'Digite a mensagem de boas-vindas…'}
          </div>
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Controle da IA</label>
          <div className="w-full h-9 px-3 rounded-xl border border-border bg-muted text-sm text-foreground flex items-center justify-between">
            <span>Sem mudança</span><span className="text-muted-foreground/40 text-xs">▾</span>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Scenes ────────────────────────────────────────────────────────────────────
type Scene = 'canvas_empty' | 'palette_open' | 'node_added' | 'node_config' | 'saved' | 'done'
const SCENES: Scene[] = ['canvas_empty', 'palette_open', 'node_added', 'node_config', 'saved', 'done']
const META: Record<Scene, string> = {
  canvas_empty: 'Clique em "+" para adicionar o primeiro passo da sequência',
  palette_open: 'Selecione o tipo de nó que deseja adicionar',
  node_added:   'Nó adicionado! Clique nele para configurar a mensagem',
  node_config:  'Configure a mensagem de boas-vindas para o lead',
  saved:        'Mensagem configurada — clique em Salvar para concluir',
  done:         '✓ Sequência de follow-up criada com sucesso!',
}

const MSG = 'Olá {nome}, seja bem-vindo! Estou aqui para te ajudar com qualquer dúvida sobre a nossa solução. 😊'

// ── Add node button with ref for hotspot ──────────────────────────────────────
function AddBtn({ btnRef, onClick }: { btnRef: React.RefObject<HTMLButtonElement>; onClick: () => void }) {
  return (
    <button ref={btnRef} onClick={onClick}
      className="w-10 h-10 rounded-xl bg-card border border-border flex items-center justify-center shadow-md text-muted-foreground">
      <Plus className="w-5 h-5" />
    </button>
  )
}

function FollowScreen({ scene, advance }: { scene: Scene; advance: () => void }) {
  const saveRef  = useRef<HTMLButtonElement>(null)
  const addRef   = useRef<HTMLButtonElement>(null)
  const msgRef   = useRef<HTMLDivElement>(null)

  const hasConfig = scene === 'node_config' || scene === 'saved' || scene === 'done'
  const showMsg   = scene === 'saved' || scene === 'done'

  // node positions
  const trigX = hasConfig ? 22  : 200, trigY = hasConfig ? 180 : 215
  const msgX  = hasConfig ? 285 : 510, msgY  = hasConfig ? 180 : 215

  // Handle centers
  const trigRX = trigX + 245, trigCY = trigY + 44
  const msgLX  = msgX  - 5,   msgCY  = msgY  + 55

  return (
    <div className="flex flex-col h-full">
      {/* Top bar */}
      <CanvasTopBar
        saved={scene === 'done'}
        saveRef={saveRef}
        onSave={scene === 'saved' ? advance : undefined}
        highlightSave={scene === 'saved'}
      />
      {scene === 'saved' && (
        <PortalTooltip anchorRef={saveRef} label="Clique em Salvar para finalizar a sequência" side="top" minW={290} />
      )}

      <div className="flex min-h-0 flex-1">
        {/* Canvas */}
        <div className="relative overflow-hidden bg-background dark:bg-[#0e0e0e] flex-1"
          style={{
            backgroundImage: 'radial-gradient(circle, hsl(var(--muted-foreground)/0.18) 1px, transparent 1px)',
            backgroundSize: '20px 20px',
          }}>

          {/* Edge Trigger → Message */}
          {(scene === 'node_added' || hasConfig) && (
            <Edge x1={trigRX} y1={trigCY} x2={msgLX} y2={msgCY} />
          )}

          {/* Trigger node — always visible */}
          <div style={{ position: 'absolute', left: trigX, top: trigY, zIndex: 1 }}>
            <FakeNode accent="primary" icon={Zap} label="Gatilho" noLeftHandle>
              <p className="text-sm font-semibold text-foreground/90 leading-snug">Sequência de Boas-vindas</p>
              <p className="text-xs text-muted-foreground/70">Novo lead criado</p>
            </FakeNode>
          </div>

          {/* Message node — visible from node_added onward */}
          {(scene === 'node_added' || hasConfig) && (
            <div style={{ position: 'absolute', left: msgX, top: msgY, zIndex: hasConfig ? 2 : 1 }}>
              {scene === 'node_added' ? (
                <Hotspot label="Clique no nó para configurar a mensagem" onClick={advance} side="top" minW={310}>
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

          {/* Palette (scene: palette_open) */}
          {scene === 'palette_open' && (
            <FakePalette highlightKind="message" onSelect={advance} />
          )}

          {/* "+" floating button */}
          <div className="absolute right-3 top-1/2 -translate-y-1/2 z-10">
            {scene === 'canvas_empty' ? (
              <Hotspot label='Clique em "+" para adicionar um nó à sequência' onClick={advance} side="left" minW={320}>
                <AddBtn btnRef={addRef} onClick={advance} />
              </Hotspot>
            ) : (
              <AddBtn btnRef={addRef} onClick={() => {}} />
            )}
          </div>
        </div>

        {/* Config panel */}
        {hasConfig && (
          <div className="relative">
            {scene === 'node_config' ? (
              <>
                <FakeConfigPanel msgText="" msgRef={msgRef} onMsgClick={advance} />
                <PortalTooltip anchorRef={msgRef} label="Digite a mensagem de boas-vindas para o lead" side="left" minW={290} />
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

// ── Main export ───────────────────────────────────────────────────────────────
export function FollowUpDemo() {
  const [scene, setScene] = useState<Scene>('canvas_empty')
  const advance = () => setScene(s => SCENES[Math.min(SCENES.indexOf(s) + 1, SCENES.length - 1)])
  const idx = SCENES.indexOf(scene)

  return (
    <div className="rounded-2xl border border-border shadow-xl bg-background" style={{ minWidth: 1080 }}>
      <div className="bg-muted/40 border-b border-border px-4 py-2 flex items-center gap-3 rounded-t-2xl">
        <div className="flex gap-1.5">
          <div className="w-3 h-3 rounded-full bg-red-400/60" />
          <div className="w-3 h-3 rounded-full bg-amber-400/60" />
          <div className="w-3 h-3 rounded-full bg-emerald-400/60" />
        </div>
        <div className="flex-1 bg-background/80 border border-border/40 rounded-md px-3 py-1 text-[11px] text-muted-foreground font-mono">
          app.zaapply.com.br/configuracoes/follow
        </div>
      </div>

      <div className="flex" style={{ height: 572 }}>
        <FakeSidebar active="configuracoes" />
        <div className="flex-1 min-w-0 overflow-hidden">
          <div key={scene} className="h-full animate-in fade-in duration-150">
            <FollowScreen scene={scene} advance={advance} />
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
          <button onClick={() => setScene('canvas_empty')}
            className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2">
            Recomeçar
          </button>
        )}
      </div>
    </div>
  )
}
