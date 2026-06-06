'use client'

import { useState, useRef, useEffect, useLayoutEffect } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/utils'
import {
  TrendingUp, PieChart, MessageCircle, UserCog,
  Sparkles, LifeBuoy, Settings, Megaphone,
  Search, Send, Bot, PauseCircle, MoreVertical, Phone,
  Building2, FileText, StickyNote, Tag, Calendar, Image as ImageIcon,
  CheckCheck, Paperclip, Mic, ChevronDown, ChevronUp, Copy, Check,
} from 'lucide-react'

// ── Zaapply icon ─────────────────────────────────────────────────────────────
function ZaapliIcon({ size = 26 }: { size?: number }) {
  const w = size * (208 / 235)
  return (
    <svg width={w} height={size} viewBox="0 0 208 235" fill="none">
      <path d="M207.65 103.853C207.65 104.953 207.65 106.063 207.59 107.143V107.213C207.562 120.28 205.556 133.267 201.64 145.733C194.543 167.855 181.706 187.699 164.44 203.243C146.982 218.999 125.668 229.859 102.66 234.723V207.653C82.1745 207.423 62.2151 201.137 45.2943 189.587C28.3736 178.037 15.2477 161.74 7.56905 142.747C-0.109597 123.753 -1.99782 102.913 2.14207 82.8485C6.28195 62.7843 16.2649 44.3933 30.8343 29.9904C45.4037 15.5875 63.9083 5.81663 84.0187 1.90763C104.129 -2.00137 124.946 0.126266 143.85 8.02272C162.754 15.9192 178.9 29.2315 190.254 46.2839C201.609 63.3363 207.665 83.3666 207.66 103.853H207.65Z" fill="#369E47"/>
      <path d="M82.5917 152.783C77.2584 152.783 73.3551 151.533 70.8817 149.033C69.6593 147.837 68.6957 146.402 68.0506 144.818C67.4056 143.233 67.0928 141.534 67.1317 139.823C67.2062 136.582 67.9519 133.392 69.3217 130.453C70.8962 126.943 73.1222 123.764 75.8817 121.083L110.712 84.6934H76.5917C75.2672 84.6934 73.9556 84.4324 72.732 83.9252C71.5084 83.418 70.3967 82.6746 69.4605 81.7375C68.5244 80.8005 67.7821 79.6881 67.2761 78.464C66.7702 77.2398 66.5104 75.928 66.5117 74.6034C66.5117 71.7285 67.6538 68.9713 69.6867 66.9384C71.7196 64.9055 74.4768 63.7634 77.3517 63.7634H125.082C130.915 63.7634 135.132 65.0101 137.732 67.5034C138.968 68.6341 139.953 70.011 140.625 71.5456C141.297 73.0801 141.64 74.7383 141.632 76.4134C141.632 81.7468 139.395 86.9001 134.922 91.8734L97.9217 131.873H129.922C132.799 131.873 135.559 133.017 137.594 135.051C139.629 137.086 140.772 139.846 140.772 142.723C140.769 144.054 140.503 145.371 139.989 146.598C139.475 147.825 138.723 148.938 137.777 149.874C136.831 150.809 135.708 151.548 134.475 152.047C133.242 152.546 131.922 152.797 130.592 152.783H82.5917Z" fill="white"/>
    </svg>
  )
}

// ── PortalTooltip ─────────────────────────────────────────────────────────────
type TooltipSide = 'top' | 'right' | 'bottom' | 'left'
function PortalTooltip({ anchorRef, label, side, minW = 240 }: {
  anchorRef: React.RefObject<HTMLElement | null>; label: string; side: TooltipSide; minW?: number
}) {
  const [mounted, setMounted] = useState(false)
  const [style, setStyle] = useState<React.CSSProperties | null>(null)
  useEffect(() => { setMounted(true) }, [])
  useLayoutEffect(() => {
    const el = anchorRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const gap = 12
    let s: React.CSSProperties
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

// ── FakeSidebar ───────────────────────────────────────────────────────────────
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
                <Icon className="w-4 h-4 shrink-0" />
                <span>{label}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Conversation item ─────────────────────────────────────────────────────────
function ConvItem({ initials, color, name, company, time, lastMsg, unread = 0, active = false, onClick }: {
  initials: string; color: string; name: string; company: string; time: string
  lastMsg: string; unread?: number; active?: boolean; onClick?: () => void
}) {
  return (
    <div onClick={onClick} className={cn(
      'flex items-start gap-3 px-4 py-3 cursor-pointer border-b border-border/30 transition-colors',
      active ? 'bg-primary/8' : 'hover:bg-muted/40'
    )}>
      <div className={cn('w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-semibold shrink-0', color)}>
        {initials}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-1">
          <span className={cn('text-sm truncate', unread > 0 ? 'font-semibold' : 'font-medium')}>{name}</span>
          <span className="text-[10px] text-muted-foreground shrink-0">{time}</span>
        </div>
        <div className="flex items-center justify-between gap-1 mt-0.5">
          <p className="text-xs text-muted-foreground truncate">{company}</p>
          {unread > 0 && (
            <span className="w-4 h-4 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center shrink-0">{unread}</span>
          )}
        </div>
        <p className="text-xs text-muted-foreground/60 truncate mt-0.5">{lastMsg}</p>
      </div>
    </div>
  )
}

// ── Chat bubble ───────────────────────────────────────────────────────────────
function Bubble({ dir, text, time, ai }: { dir: 'in' | 'out'; text: string; time: string; ai?: boolean }) {
  const isOut = dir === 'out'
  return (
    <div className={cn('flex', isOut ? 'justify-end' : 'justify-start')}>
      <div className={cn(
        'relative max-w-[75%] px-3 py-2 shadow-sm',
        isOut ? 'bg-[#dcf8c6] dark:bg-[#005c4b] rounded-2xl rounded-tr-none' : 'bg-white dark:bg-[#1f2c34] rounded-2xl rounded-tl-none'
      )}>
        {isOut && <div className="absolute top-0 right-[-7px] w-0 h-0 border-t-[8px] border-t-[#dcf8c6] dark:border-t-[#005c4b] border-l-[8px] border-l-transparent" />}
        {!isOut && <div className="absolute top-0 left-[-7px] w-0 h-0 border-t-[8px] border-t-white dark:border-t-[#1f2c34] border-r-[8px] border-r-transparent" />}
        {ai && <p className="text-[10px] font-semibold text-primary mb-1">Agente IA</p>}
        <p className="text-[13.5px] leading-[1.4] text-[#111] dark:text-[#e9edef] break-words">{text}</p>
        <div className="flex items-center justify-end gap-1 mt-0.5">
          <span className="text-[10px] text-[#667781] dark:text-[#8696a0]">{time}</span>
          {isOut && <CheckCheck className="w-3 h-3 text-[#53bdeb]" />}
        </div>
      </div>
    </div>
  )
}

// ── Info panel (right column) ─────────────────────────────────────────────────
const SDR_RESUMO = `Lead altamente interessado. Perguntou sobre integração com CRM e período de trial. Demonstrou urgência para apresentar para a equipe. Perfil: decisor técnico, empresa de médio porte (TechFlow Solutions). Próximo passo: enviar proposta personalizada com foco em integrações.`

function InfoPanel({ showResumo, highlightResumo, onResumoClick }: {
  showResumo: boolean; highlightResumo: boolean; onResumoClick?: () => void
}) {
  const resumoRef = useRef<HTMLButtonElement>(null)
  return (
    <div className="flex flex-col bg-card border-l border-border flex-shrink-0" style={{ width: 264 }}>
      <div className="flex items-center justify-between px-4 h-12 border-b border-border flex-shrink-0">
        <span className="text-sm font-semibold">Informacoes do Lead</span>
      </div>
      {/* Tabs */}
      <div className="flex border-b border-border overflow-x-auto flex-shrink-0">
        {['Dados', 'Notas', 'Tags', 'Agenda', 'Midia'].map((tab, i) => (
          <button key={tab} className={cn(
            'px-3 py-2 text-xs whitespace-nowrap border-b-2 transition-colors',
            i === 0 ? 'border-primary text-primary font-medium' : 'border-transparent text-muted-foreground'
          )}>{tab}</button>
        ))}
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* SDR Resumo */}
        <div className="space-y-2 relative">
          {highlightResumo && (
            <div className="absolute inset-0 -m-1 rounded-xl ring-2 ring-primary shadow-[0_0_12px_2px_rgba(54,158,71,0.3)] pointer-events-none z-10 animate-pulse" />
          )}
          <button
            ref={resumoRef}
            onClick={onResumoClick}
            className={cn(
              'w-full flex items-center justify-between p-3 rounded-lg transition-colors border',
              highlightResumo
                ? 'bg-primary/20 border-primary/40 cursor-pointer'
                : 'bg-primary/10 hover:bg-primary/20 border-primary/20'
            )}
          >
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary" />
              <span className="text-sm font-semibold text-primary">nexio.ai resumo</span>
              <span className="text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded font-medium">IA</span>
            </div>
            {showResumo ? <ChevronUp className="h-4 w-4 text-primary" /> : <ChevronDown className="h-4 w-4 text-primary" />}
          </button>
          {highlightResumo && (
            <PortalTooltip anchorRef={resumoRef} label="Resumo da conversa gerado automaticamente pelo agente IA" side="left" minW={280} />
          )}
          {showResumo && (
            <div className="bg-gradient-to-br from-primary/5 to-primary/10 rounded-lg p-3 border border-primary/20 space-y-3">
              <p className="text-sm text-foreground leading-relaxed">{SDR_RESUMO}</p>
              <div className="flex items-center justify-between pt-2 border-t border-primary/20">
                <p className="text-xs text-muted-foreground italic">Gerado automaticamente</p>
                <button className="flex items-center gap-1 h-7 px-2 text-xs text-muted-foreground hover:text-foreground rounded">
                  <Copy className="h-3 w-3" />Copiar
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Contact block */}
        <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-2">
          <div className="flex items-start gap-2">
            <Building2 className="h-4 w-4 text-primary mt-0.5 shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate">TechFlow Solutions</p>
              <p className="text-xs text-muted-foreground truncate">Carlos Mendes</p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Phone className="h-3.5 w-3.5 shrink-0" />
            <span>+55 11 9 8765-4321</span>
          </div>
        </div>

        {/* Pipeline */}
        <div className="space-y-2">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Pipeline</p>
          <div className="space-y-2">
            <div className="h-8 px-3 rounded-xl border border-border bg-muted text-xs text-foreground flex items-center justify-between">
              <span>Interessado</span><span className="text-muted-foreground/40 text-xs">▾</span>
            </div>
            <div className="h-8 px-3 rounded-xl border border-border bg-muted text-xs text-foreground flex items-center justify-between">
              <span>Quente</span><span className="text-muted-foreground/40 text-xs">▾</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Scenes ────────────────────────────────────────────────────────────────────
type Scene = 'inbox' | 'agent_paused' | 'resumo_expanded' | 'typing' | 'sent' | 'done'
const SCENES: Scene[] = ['inbox', 'agent_paused', 'resumo_expanded', 'typing', 'sent', 'done']
const META: Record<Scene, string> = {
  inbox:           'Clique em "Agente ativo" para controlar o Agente IA nesta conversa',
  agent_paused:    'Agente pausado — veja o resumo gerado pela IA sobre este lead',
  resumo_expanded: 'Resumo gerado automaticamente — clique no campo de mensagem para responder manualmente',
  typing:          'Mensagem digitada — clique em Enviar para responder ao lead',
  sent:            'Mensagem enviada diretamente pelo WhatsApp',
  done:            'Atendimento concluido — toggle e resumo sao os pontos-chave do chat',
}

const REPLY = 'Entendido Carlos! Vou preparar uma proposta com foco nas integrações CRM. Posso te enviar ainda hoje?'

function AtendimentoScreen({ scene, advance }: { scene: Scene; advance: () => void }) {
  const agentBtnRef = useRef<HTMLButtonElement>(null)
  const inputRef    = useRef<HTMLDivElement>(null)
  const sendRef     = useRef<HTMLButtonElement>(null)

  const agentePausado  = scene !== 'inbox'
  const showResumo     = scene === 'resumo_expanded' || scene === 'typing' || scene === 'sent' || scene === 'done'
  const showSent       = scene === 'sent' || scene === 'done'
  const showInput      = scene !== 'inbox' && scene !== 'agent_paused'
  const highlightResumo = scene === 'agent_paused'

  // auto-advance from sent to done
  useEffect(() => {
    if (scene !== 'sent') return
    const t = setTimeout(advance, 1500)
    return () => clearTimeout(t)
  }, [scene]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="flex h-full">
      {/* Conversations list */}
      <div className="flex flex-col border-r border-border flex-shrink-0" style={{ width: 268 }}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-border flex-shrink-0">
          <h2 className="text-sm font-semibold">Conversas</h2>
          <button className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center text-muted-foreground">
            <MoreVertical className="w-3.5 h-3.5" />
          </button>
        </div>
        <div className="px-3 py-2 flex-shrink-0">
          <div className="flex items-center gap-2 h-8 px-3 rounded-lg bg-muted/60 border border-border/50">
            <Search className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-xs text-muted-foreground/60">Buscar conversa</span>
          </div>
        </div>
        <div className="flex border-b border-border flex-shrink-0">
          {['Minhas', 'Livres', 'Todas'].map((t, i) => (
            <button key={t} className={cn(
              'flex-1 py-1.5 text-xs font-medium border-b-2 transition-colors',
              i === 0 ? 'border-primary text-primary' : 'border-transparent text-muted-foreground'
            )}>{t}</button>
          ))}
        </div>
        <div className="flex-1 overflow-y-auto">
          <ConvItem initials="CM" color="bg-blue-500" name="Carlos Mendes" company="TechFlow Solutions"
            time="09:32" lastMsg="Preciso de uma demo urgente" unread={2} active />
          <ConvItem initials="AL" color="bg-violet-500" name="Ana Lima" company="Padaria do Joao"
            time="Ontem" lastMsg="Muito obrigada pela ajuda!" />
          <ConvItem initials="RF" color="bg-amber-600" name="Roberto Farias" company="Construtora RF"
            time="Seg" lastMsg="Aguardando retorno sobre proposta" />
          <ConvItem initials="MO" color="bg-rose-500" name="Mariana Oliveira" company="Studio MO"
            time="29/05" lastMsg="Quando comeca o trial?" />
        </div>
      </div>

      {/* Chat column */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Chat header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border flex-shrink-0 bg-card">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-blue-500 flex items-center justify-center text-white text-sm font-semibold">CM</div>
            <div>
              <p className="text-sm font-semibold">Carlos Mendes</p>
              <p className="text-xs text-muted-foreground">TechFlow Solutions</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Agent toggle button */}
            {scene === 'inbox' ? (
              <Hotspot label='Clique para pausar o Agente IA nesta conversa' onClick={advance} side="bottom" minW={310}>
                <button ref={agentBtnRef}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-emerald-500/50 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 transition-colors">
                  <Bot className="h-4 w-4" />Agente ativo
                </button>
              </Hotspot>
            ) : (
              <button className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors',
                agentePausado
                  ? 'border-amber-500/50 text-amber-600 dark:text-amber-400 bg-amber-500/5'
                  : 'border-emerald-500/50 text-emerald-600 dark:text-emerald-400'
              )}>
                {agentePausado
                  ? <><PauseCircle className="h-4 w-4" />Agente pausado</>
                  : <><Bot className="h-4 w-4" />Agente ativo</>
                }
              </button>
            )}
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3"
          style={{ background: 'hsl(var(--background)/0.5)' }}>
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-border/50" />
            <span className="text-[11px] text-muted-foreground/60 font-medium px-2">Hoje</span>
            <div className="flex-1 h-px bg-border/50" />
          </div>
          <Bubble dir="in"  text="Ola! Gostaria de saber mais sobre o plano da plataforma. Voces tem suporte para integracao com CRM?" time="09:15" />
          <Bubble dir="out" text="Ola Carlos! Temos integracao nativa com os principais CRMs do mercado. Posso te enviar a documentacao?" time="09:20" ai />
          <Bubble dir="in"  text="Perfeito! E como funciona o periodo de trial?" time="09:28" />
          <Bubble dir="out" text="O trial e de 14 dias com acesso completo a todos os recursos, sem precisar de cartao de credito." time="09:29" ai />
          <Bubble dir="in"  text="Preciso de uma demo urgente para apresentar para minha equipe amanha." time="09:32" />
          {showSent && <Bubble dir="out" text={REPLY} time="09:33" />}
        </div>

        {/* Input bar */}
        {showInput && (
          <div className="border-t border-border bg-card flex-shrink-0 px-3 py-3">
            <div className="flex items-end gap-2">
              <button className="w-8 h-8 flex items-center justify-center text-muted-foreground">
                <Paperclip className="w-4 h-4" />
              </button>
              {scene === 'resumo_expanded' ? (
                <Hotspot label="Clique para digitar sua resposta manual" onClick={advance} side="top" minW={280}>
                  <div ref={inputRef as any}
                    className="flex-1 min-h-[38px] px-3 py-2 rounded-xl border border-border bg-muted/50 text-sm text-muted-foreground/50">
                    Escreva uma mensagem
                  </div>
                </Hotspot>
              ) : (
                <div ref={inputRef}
                  className={cn('flex-1 min-h-[38px] px-3 py-2 rounded-xl border border-border bg-muted/50 text-sm',
                    scene === 'typing' || scene === 'sent' || scene === 'done' ? 'text-foreground' : 'text-muted-foreground/50'
                  )}>
                  {scene === 'typing' || scene === 'sent' || scene === 'done' ? REPLY : 'Escreva uma mensagem'}
                </div>
              )}
              <button className="w-8 h-8 flex items-center justify-center text-muted-foreground"><Mic className="w-4 h-4" /></button>
              {scene === 'typing' ? (
                <Hotspot label="Clique em Enviar para responder ao lead" onClick={advance} side="top" minW={260}>
                  <button ref={sendRef as any}
                    className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground">
                    <Send className="w-4 h-4" />
                  </button>
                </Hotspot>
              ) : (
                <button ref={sendRef}
                  className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground">
                  <Send className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Info panel */}
      <InfoPanel
        showResumo={showResumo}
        highlightResumo={highlightResumo}
        onResumoClick={highlightResumo ? advance : undefined}
      />
    </div>
  )
}

// ── Main export ───────────────────────────────────────────────────────────────
export function AtendimentoDemo() {
  const [scene, setScene] = useState<Scene>('inbox')
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
          app.zaapply.com.br/atendimento
        </div>
      </div>

      <div className="flex" style={{ height: 520 }}>
        <FakeSidebar active="atendimento" />
        <div className="flex-1 min-w-0 overflow-hidden">
          <div key={scene} className="h-full animate-in fade-in duration-150">
            <AtendimentoScreen scene={scene} advance={advance} />
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
          <button onClick={() => setScene('inbox')}
            className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2">
            Recomecar
          </button>
        )}
      </div>
    </div>
  )
}
