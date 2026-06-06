'use client'

import { useState, useRef, useEffect, useLayoutEffect } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/utils'
import {
  TrendingUp, PieChart, MessageCircle, UserCog,
  Sparkles, LifeBuoy, Settings, Megaphone,
  ToggleLeft, ToggleRight, ChevronRight, Plus,
  Play, Zap, GitBranch, Timer, Send, ArrowRight,
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
  { label: 'Principal',   items: [{ id: 'dashboard',    label: 'Dashboard',   Icon: TrendingUp  }] },
  { label: 'Ferramentas', items: [
    { id: 'crm',          label: 'CRM',         Icon: PieChart      },
    { id: 'atendimento',  label: 'Atendimento', Icon: MessageCircle },
    { id: 'automacoes',   label: 'Automacoes',  Icon: Megaphone     },
  ]},
  { label: 'Gestao',      items: [{ id: 'membros', label: 'Membros', Icon: UserCog }] },
  { label: 'Sistema',     items: [
    { id: 'novidades',    label: 'Novidades',   Icon: Sparkles  },
    { id: 'ajuda',        label: 'Ajuda',       Icon: LifeBuoy  },
    { id: 'configuracoes',label: 'Configuracao',Icon: Settings  },
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
                {id === 'automacoes' && <ChevronRight className="w-3 h-3 ml-auto" />}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Node card (HTML-based, not SVG) ──────────────────────────────────────────
function CanvasNode({ Icon, iconColor, label, sub, highlighted, onClick }: {
  Icon: React.ElementType; iconColor: string; label: string; sub: string
  highlighted?: boolean; onClick?: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  return (
    <div className="relative">
      {highlighted && (
        <>
          <div ref={ref} className="absolute inset-0 rounded-xl ring-2 ring-primary shadow-[0_0_16px_2px_rgba(54,158,71,0.25)] pointer-events-none z-20 animate-pulse" />
          <PortalTooltip anchorRef={ref as React.RefObject<HTMLElement | null>} label={`${label}: ${sub}`} side="bottom" minW={240} />
        </>
      )}
      <div
        onClick={onClick}
        className={cn(
          'flex items-center gap-2.5 px-3 py-2.5 rounded-xl border bg-card shadow-sm transition-all duration-200',
          highlighted ? 'border-primary cursor-pointer hover:shadow-md' : 'border-border/60',
          onClick ? 'cursor-pointer' : ''
        )}
        style={{ width: 200 }}
      >
        <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0',
          highlighted ? 'bg-primary/15' : 'bg-muted'
        )}>
          <Icon className={cn('w-4 h-4', iconColor)} />
        </div>
        <div className="min-w-0">
          <p className="text-[11px] font-semibold text-foreground">{label}</p>
          <p className="text-[10px] text-muted-foreground truncate">{sub}</p>
        </div>
      </div>
    </div>
  )
}

function Connector({ label }: { label?: string }) {
  return (
    <div className="flex flex-col items-center flex-shrink-0 mx-1">
      <div className="w-px h-3 bg-border" />
      {label && <span className="text-[9px] text-muted-foreground/60 px-1">{label}</span>}
      <div className="w-px h-3 bg-border" />
      <div className="w-0 h-0 border-l-[5px] border-r-[5px] border-t-[6px] border-l-transparent border-r-transparent border-t-muted-foreground/40" />
    </div>
  )
}

function HConnector({ branches = false }: { branches?: boolean }) {
  if (!branches) {
    return (
      <div className="flex items-center mx-1">
        <div className="h-px w-6 bg-border" />
        <div className="w-0 h-0 border-t-[5px] border-b-[5px] border-l-[6px] border-t-transparent border-b-transparent border-l-muted-foreground/40" />
      </div>
    )
  }
  return (
    <div className="flex flex-col items-center justify-center mx-2 gap-8">
      <div className="flex items-center gap-1">
        <div className="h-px w-4 bg-emerald-500/50" />
        <span className="text-[9px] text-emerald-600 font-medium">Sim</span>
        <div className="w-0 h-0 border-t-[4px] border-b-[4px] border-l-[5px] border-t-transparent border-b-transparent border-l-emerald-500/50" />
      </div>
      <div className="flex items-center gap-1">
        <div className="h-px w-4 bg-muted-foreground/30" />
        <span className="text-[9px] text-muted-foreground/60 font-medium">Nao</span>
        <div className="w-0 h-0 border-t-[4px] border-b-[4px] border-l-[5px] border-t-transparent border-b-transparent border-l-muted-foreground/30" />
      </div>
    </div>
  )
}

// ── Scenes ────────────────────────────────────────────────────────────────────
type Scene = 'seq_list' | 'canvas_view' | 'highlight_trigger' | 'highlight_delay' | 'highlight_cond' | 'done'
const SCENES: Scene[] = ['seq_list', 'canvas_view', 'highlight_trigger', 'highlight_delay', 'highlight_cond', 'done']
const META: Record<Scene, string> = {
  seq_list:          'Clique em "Abrir Canvas" para entrar no editor visual do fluxo Trial SaaS',
  canvas_view:       'Canvas do Trial — 5 nodes conectados. Clique no Gatilho para entender o inicio do fluxo',
  highlight_trigger: 'Gatilho: acionado pelo webhook quando o lead preenche o formulario de cadastro. Clique no Intervalo',
  highlight_delay:   'Intervalo de 3 dias: o fluxo aguarda antes de verificar se o lead respondeu. Clique na Condicao',
  highlight_cond:    'Condicao bifurca: lead respondeu = lembrete amigavel | nao respondeu = reengajamento urgente',
  done:              'Fluxo completo — Trial automatizado do webhook de cadastro ate conversao ou reengajamento',
}

const SEQ_ROWS = [
  { name: 'Boas-vindas Trial',    steps: 5, active: true  },
  { name: 'Lembrete 7 dias',      steps: 3, active: true  },
  { name: 'Conversao urgente',    steps: 2, active: false },
]

function SequenceList({ onOpen }: { onOpen: () => void }) {
  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between px-5 h-14 border-b border-border bg-card flex-shrink-0">
        <h2 className="text-sm font-semibold">Trial SaaS</h2>
        <button className="flex items-center gap-1.5 px-3 h-8 rounded-lg text-xs font-semibold bg-primary text-primary-foreground">
          <Plus className="w-3.5 h-3.5" />Nova sequencia
        </button>
      </div>
      <div className="flex border-b border-border flex-shrink-0 bg-card px-5">
        {['Sequencias', 'Configuracoes', 'Metricas'].map((t, i) => (
          <button key={t} className={cn('py-2.5 mr-5 text-xs font-medium border-b-2',
            i === 0 ? 'border-primary text-primary' : 'border-transparent text-muted-foreground'
          )}>{t}</button>
        ))}
      </div>
      <div className="flex-1 overflow-y-auto p-5">
        <div className="space-y-2">
          {SEQ_ROWS.map((seq, i) => {
            const isFirst = i === 0
            return (
              <div key={seq.name} className={cn(
                'flex items-center gap-4 p-4 rounded-xl border bg-card',
                isFirst ? 'border-primary/30 shadow-sm' : 'border-border/50'
              )}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-sm font-semibold truncate">{seq.name}</p>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-medium">Trial SaaS</span>
                  </div>
                  <p className="text-xs text-muted-foreground">{seq.steps} etapas</p>
                </div>
                <div className="flex items-center gap-3">
                  {seq.active
                    ? <ToggleRight className="h-5 w-5 text-primary" />
                    : <ToggleLeft className="h-5 w-5 text-muted-foreground/40" />
                  }
                  {isFirst ? (
                    <Hotspot label='Abrir o canvas visual deste fluxo Trial SaaS' onClick={onOpen} side="left" minW={260}>
                      <button className="flex items-center gap-1.5 px-3 h-8 rounded-lg text-xs font-medium border border-border bg-muted">
                        <Play className="w-3 h-3" />Abrir Canvas
                      </button>
                    </Hotspot>
                  ) : (
                    <button className="flex items-center gap-1.5 px-3 h-8 rounded-lg text-xs font-medium border border-border bg-muted text-muted-foreground">
                      <Play className="w-3 h-3" />Abrir Canvas
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function CanvasView({ scene, advance }: { scene: Scene; advance: () => void }) {
  const hl = (id: string) => {
    const map: Record<Scene, string> = {
      seq_list: '', canvas_view: 'trigger',
      highlight_trigger: 'delay', highlight_delay: 'cond',
      highlight_cond: '', done: '',
    }
    return map[scene] === id
  }
  const isClickable = (id: string) => hl(id)

  const triggerClickable = scene === 'canvas_view'
  const triggerHL = scene === 'highlight_trigger' || scene === 'canvas_view'

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between px-5 h-12 border-b border-border bg-card flex-shrink-0">
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground text-xs">Trial SaaS</span>
          <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/50" />
          <span className="font-semibold">Boas-vindas Trial</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 font-medium ml-1">Ativo</span>
        </div>
        {scene === 'highlight_cond' ? (
          <Hotspot label='Salvar o fluxo configurado' onClick={advance} side="bottom" minW={200}>
            <button className="flex items-center gap-1.5 px-3 h-7 rounded-lg text-xs font-semibold bg-primary text-primary-foreground">Salvar</button>
          </Hotspot>
        ) : (
          <button className="flex items-center gap-1.5 px-3 h-7 rounded-lg text-xs font-semibold bg-primary text-primary-foreground">Salvar</button>
        )}
      </div>
      <div className="flex-1 overflow-auto bg-[radial-gradient(hsl(var(--border)/40)_1px,transparent_1px)] bg-[size:20px_20px]">
        <div className="flex items-center justify-center h-full px-8" style={{ minWidth: 820 }}>
          {/* Row 1: Trigger → branches */}
          <div className="flex flex-col items-center gap-4">
            {/* Top: trigger + msg1 */}
            <div className="flex items-center gap-0">
              {triggerClickable ? (
                <Hotspot label='Gatilho: inicio do fluxo Trial (webhook do formulario)' onClick={advance} side="top" minW={300}>
                  <CanvasNode Icon={Zap} iconColor="text-amber-500" label="Gatilho" sub="Trial ativo recebido" highlighted={triggerHL} />
                </Hotspot>
              ) : (
                <CanvasNode Icon={Zap} iconColor="text-amber-500" label="Gatilho" sub="Trial ativo recebido" highlighted={triggerHL && !triggerClickable} />
              )}
              <HConnector />
              <CanvasNode Icon={Send} iconColor="text-blue-500" label="Mensagem" sub="Boas-vindas ao trial" />
            </div>

            <div className="flex items-start gap-0">
              {/* Trigger → Delay */}
              <div className="flex flex-col items-center mt-[54px]">
                <Connector />
              </div>

              {/* Delay node */}
              <div className="flex flex-col items-center gap-0 mt-0">
                <div className="h-[54px]" /> {/* spacer */}
                {isClickable('delay') ? (
                  <Hotspot label='Intervalo: aguarda 3 dias antes de verificar resposta' onClick={advance} side="top" minW={300}>
                    <CanvasNode Icon={Timer} iconColor="text-violet-500" label="Intervalo" sub="3 dias" highlighted />
                  </Hotspot>
                ) : (
                  <CanvasNode Icon={Timer} iconColor="text-violet-500" label="Intervalo" sub="3 dias" highlighted={scene === 'highlight_delay'} />
                )}
              </div>

              <div className="mt-[54px]">
                <HConnector />
              </div>

              {/* Condition */}
              <div className="flex flex-col items-center gap-0 mt-[54px]">
                {isClickable('cond') ? (
                  <Hotspot label='Condicao: bifurca entre lead engajado e lead frio' onClick={advance} side="top" minW={300}>
                    <CanvasNode Icon={GitBranch} iconColor="text-pink-500" label="Condicao" sub="Lead respondeu?" highlighted />
                  </Hotspot>
                ) : (
                  <CanvasNode Icon={GitBranch} iconColor="text-pink-500" label="Condicao" sub="Lead respondeu?" highlighted={scene === 'highlight_cond'} />
                )}
              </div>

              <HConnector branches />

              {/* Two outcome nodes */}
              <div className="flex flex-col gap-3 mt-[54px]">
                <CanvasNode Icon={Send} iconColor="text-blue-500" label="Mensagem" sub="Lembrete amigavel" />
                <CanvasNode Icon={Send} iconColor="text-orange-500" label="Mensagem" sub="Reengajamento urgente" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export function TrialSaasDemo() {
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
          app.zaapply.com.br/automacoes/trial-saas
        </div>
      </div>
      <div className="flex" style={{ height: 520 }}>
        <FakeSidebar active="automacoes" />
        <div className="flex-1 min-w-0 overflow-hidden">
          {scene === 'seq_list'
            ? <SequenceList onOpen={advance} />
            : <CanvasView scene={scene} advance={advance} />
          }
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
