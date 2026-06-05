'use client'

import { useState, useRef, useEffect, useLayoutEffect } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/utils'
import {
  TrendingUp, PieChart, MessageCircle, UserCog,
  Sparkles, LifeBuoy, Settings, Megaphone,
  Search, Send, Phone, Building2, CheckCheck,
  MoreVertical, Bot, PauseCircle, Paperclip, Mic,
  Tag, FileText, Clock,
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

// ── Fake avatar ───────────────────────────────────────────────────────────────
function Avatar({ initials, color = 'bg-primary' }: { initials: string; color?: string }) {
  return (
    <div className={cn('w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 text-white text-sm font-semibold', color)}>
      {initials}
    </div>
  )
}

// ── Conversation item ─────────────────────────────────────────────────────────
function ConvItem({ initials, color, name, company, time, lastMsg, unread, active, onClick }: {
  initials: string; color: string; name: string; company: string; time: string
  lastMsg: string; unread?: number; active?: boolean; onClick?: () => void
}) {
  return (
    <button onClick={onClick}
      className={cn(
        'w-full flex items-start gap-3 px-4 py-3 border-b border-border/50 transition-colors text-left',
        active ? 'bg-accent' : 'hover:bg-muted/50'
      )}>
      <Avatar initials={initials} color={color} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-1">
          <span className="text-sm font-semibold text-foreground truncate">{name}</span>
          <span className="text-[11px] text-muted-foreground shrink-0">{time}</span>
        </div>
        <div className="flex items-center justify-between gap-1 mt-0.5">
          <p className="text-xs text-muted-foreground truncate">{lastMsg}</p>
          {unread != null && unread > 0 && (
            <span className="flex-shrink-0 w-5 h-5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center">
              {unread}
            </span>
          )}
        </div>
        <p className="text-[11px] text-muted-foreground/60 truncate mt-0.5 flex items-center gap-1">
          <Building2 className="w-2.5 h-2.5 shrink-0" />{company}
        </p>
      </div>
    </button>
  )
}

// ── Chat bubble ───────────────────────────────────────────────────────────────
function Bubble({ dir, text, time, ai }: { dir: 'in' | 'out'; text: string; time: string; ai?: boolean }) {
  return (
    <div className={cn('flex gap-2 max-w-[75%]', dir === 'out' ? 'ml-auto flex-row-reverse' : '')}>
      {dir === 'in' && <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center flex-shrink-0 mt-auto">
        <span className="text-[11px] font-semibold text-muted-foreground">C</span>
      </div>}
      <div>
        <div className={cn(
          'px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed',
          dir === 'in'
            ? 'bg-muted/60 text-foreground rounded-tl-sm'
            : 'bg-green-500/15 border border-green-500/20 text-foreground rounded-tr-sm'
        )}>
          {text}
        </div>
        <div className={cn('flex items-center gap-1 mt-1 text-[10px] text-muted-foreground/50', dir === 'out' ? 'justify-end' : '')}>
          <span>{time}</span>
          {dir === 'out' && <CheckCheck className="w-3 h-3 text-primary/60" />}
          {ai && dir === 'out' && <Bot className="w-3 h-3 text-primary/60" />}
        </div>
      </div>
    </div>
  )
}

// ── Scenes ────────────────────────────────────────────────────────────────────
type Scene = 'inbox' | 'chat_open' | 'typing' | 'sent' | 'done'
const SCENES: Scene[] = ['inbox', 'chat_open', 'typing', 'sent', 'done']
const META: Record<Scene, string> = {
  inbox:     'Selecione uma conversa para abrir o chat',
  chat_open: 'Visualize o histórico e responda diretamente pelo sistema',
  typing:    'Digite sua mensagem no campo de texto',
  sent:      'Mensagem enviada! O lead recebe diretamente no WhatsApp',
  done:      '✓ Atendimento concluído via Zaapply',
}

const REPLY_MSG = 'Claro, Carlos! Vou verificar isso para você agora mesmo. Qual seria o melhor horário para conversarmos?'

// ── Left column — conversation list ──────────────────────────────────────────
function ConvList({ active, onSelect }: { active: string | null; onSelect: (id: string) => void }) {
  return (
    <div className="flex flex-col border-r border-border" style={{ width: 268 }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border flex-shrink-0">
        <h2 className="text-sm font-semibold text-foreground">Conversas</h2>
        <div className="flex items-center gap-2">
          <button className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center text-muted-foreground">
            <MoreVertical className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
      {/* Search */}
      <div className="px-3 py-2 flex-shrink-0">
        <div className="flex items-center gap-2 h-8 px-3 rounded-lg bg-muted/60 border border-border/50">
          <Search className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-xs text-muted-foreground/60">Buscar conversa…</span>
        </div>
      </div>
      {/* List */}
      <div className="flex-1 overflow-y-auto">
        <ConvItem initials="CM" color="bg-blue-500" name="Carlos Mendes" company="TechFlow Solutions"
          time="09:32" lastMsg="Preciso de uma demo urgente" unread={2}
          active={active === 'carlos'} onClick={() => onSelect('carlos')} />
        <ConvItem initials="AL" color="bg-violet-500" name="Ana Lima" company="Padaria do João"
          time="Ontem" lastMsg="Muito obrigada pela ajuda! 🙏"
          active={active === 'ana'} />
        <ConvItem initials="RF" color="bg-amber-600" name="Roberto Farias" company="Construtora RF"
          time="Seg" lastMsg="Aguardando retorno sobre proposta"
          active={active === 'roberto'} />
        <ConvItem initials="MO" color="bg-rose-500" name="Mariana Oliveira" company="Studio MO"
          time="29/05" lastMsg="Quando começa o trial?"
          active={active === 'mariana'} />
      </div>
    </div>
  )
}

// ── Middle column — chat ──────────────────────────────────────────────────────
function ChatCol({ scene, inputRef, sendRef, advance }: {
  scene: Scene
  inputRef: React.RefObject<HTMLDivElement>
  sendRef: React.RefObject<HTMLButtonElement>
  advance: () => void
}) {
  const showChat    = scene !== 'inbox'
  const showSent    = scene === 'sent' || scene === 'done'
  const showTyping  = scene === 'typing' || scene === 'sent' || scene === 'done'
  const showInput   = scene === 'chat_open' || scene === 'typing' || scene === 'sent' || scene === 'done'

  if (!showChat) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center space-y-2">
          <MessageCircle className="w-12 h-12 text-muted-foreground/20 mx-auto" />
          <p className="text-sm text-muted-foreground">Selecione uma conversa</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col min-w-0">
      {/* Chat header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border flex-shrink-0 bg-card">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-blue-500 flex items-center justify-center text-white text-sm font-semibold">CM</div>
          <div>
            <p className="text-sm font-semibold text-foreground">Carlos Mendes</p>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Phone className="w-3 h-3" />+55 11 9 8765-4321
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-muted text-xs text-muted-foreground border border-border">
            <Bot className="w-3.5 h-3.5" />IA Ativa
          </button>
          <button className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center text-muted-foreground border border-border">
            <MoreVertical className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-background/50">
        {/* Date separator */}
        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-border/50" />
          <span className="text-[11px] text-muted-foreground/60 font-medium px-2">Hoje</span>
          <div className="flex-1 h-px bg-border/50" />
        </div>

        <Bubble dir="in" text="Olá! Gostaria de saber mais sobre o plano da plataforma. Vocês têm suporte para integração com CRM?" time="09:15" />
        <Bubble dir="out" text="Olá Carlos! Temos integração nativa com os principais CRMs do mercado. Posso te enviar a documentação?" time="09:20" ai />
        <Bubble dir="in" text="Perfeito! E como funciona o período de trial?" time="09:28" />
        <Bubble dir="out" text="O trial é de 14 dias com acesso completo a todos os recursos, sem precisar de cartão de crédito." time="09:29" ai />
        <Bubble dir="in" text="Preciso de uma demo urgente para apresentar para minha equipe amanhã." time="09:32" />

        {showSent && (
          <Bubble dir="out" text={REPLY_MSG} time="09:33" />
        )}
      </div>

      {/* Input area */}
      {showInput && (
        <div className="border-t border-border bg-card flex-shrink-0 px-3 py-3">
          <div className="flex items-end gap-2">
            <button className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground flex-shrink-0">
              <Paperclip className="w-4 h-4" />
            </button>
            {scene === 'chat_open' ? (
              <Hotspot label="Clique aqui para digitar sua resposta" onClick={advance} side="top" minW={290}>
                <div ref={inputRef as any}
                  className="flex-1 min-h-[38px] px-3 py-2 rounded-xl border border-border bg-muted/50 text-sm text-muted-foreground/50">
                  Escreva uma mensagem…
                </div>
              </Hotspot>
            ) : (
              <div ref={inputRef}
                className={cn(
                  'flex-1 min-h-[38px] px-3 py-2 rounded-xl border border-border bg-muted/50 text-sm',
                  showTyping ? 'text-foreground' : 'text-muted-foreground/50'
                )}>
                {showTyping ? REPLY_MSG : 'Escreva uma mensagem…'}
              </div>
            )}
            <button className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground flex-shrink-0">
              <Mic className="w-4 h-4" />
            </button>
            {scene === 'typing' ? (
              <Hotspot label="Clique em Enviar para mandar a mensagem" onClick={advance} side="top" minW={280}>
                <button ref={sendRef as any}
                  className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground flex-shrink-0">
                  <Send className="w-4 h-4" />
                </button>
              </Hotspot>
            ) : (
              <button ref={sendRef}
                className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground flex-shrink-0">
                <Send className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Right column — lead info panel ────────────────────────────────────────────
function InfoPanel() {
  return (
    <div className="flex flex-col bg-card border-l border-border flex-shrink-0" style={{ width: 240 }}>
      <div className="px-4 py-3 border-b border-border">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Informações</p>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div className="flex flex-col items-center gap-2 pb-3 border-b border-border/50">
          <div className="w-14 h-14 rounded-full bg-blue-500 flex items-center justify-center text-white text-lg font-bold">CM</div>
          <div className="text-center">
            <p className="text-sm font-semibold text-foreground">Carlos Mendes</p>
            <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
              <Building2 className="w-3 h-3" />TechFlow Solutions
            </p>
          </div>
          <span className="px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 text-[11px] font-medium">
            Em negociação
          </span>
        </div>

        <div className="space-y-2">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Contato</p>
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Phone className="w-3 h-3 shrink-0" /><span>+55 11 9 8765-4321</span>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Tags</p>
          <div className="flex flex-wrap gap-1.5">
            <span className="px-2 py-0.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-[11px]">demo</span>
            <span className="px-2 py-0.5 rounded-full bg-muted border border-border text-muted-foreground text-[11px]">enterprise</span>
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Resumo IA</p>
          <p className="text-xs text-muted-foreground leading-relaxed bg-muted/50 rounded-lg p-2.5">
            Lead interessado em plano enterprise, precisa de demo para equipe. Alta prioridade.
          </p>
        </div>
      </div>
    </div>
  )
}

// ── Full atendimento layout ───────────────────────────────────────────────────
function AtendimentoScreen({ scene, advance }: { scene: Scene; advance: () => void }) {
  const inputRef = useRef<HTMLDivElement>(null)
  const sendRef  = useRef<HTMLButtonElement>(null)

  return (
    <div className="flex h-full">
      {/* Conversations list */}
      <div className="relative">
        {scene === 'inbox' ? (
          <div className="h-full flex flex-col border-r border-border" style={{ width: 268 }}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-border flex-shrink-0">
              <h2 className="text-sm font-semibold text-foreground">Conversas</h2>
              <button className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center text-muted-foreground">
                <MoreVertical className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="px-3 py-2 flex-shrink-0">
              <div className="flex items-center gap-2 h-8 px-3 rounded-lg bg-muted/60 border border-border/50">
                <Search className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-xs text-muted-foreground/60">Buscar conversa…</span>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              <Hotspot label="Clique em Carlos Mendes para abrir o chat" onClick={advance} side="right" minW={290}>
                <ConvItem initials="CM" color="bg-blue-500" name="Carlos Mendes" company="TechFlow Solutions"
                  time="09:32" lastMsg="Preciso de uma demo urgente" unread={2} active />
              </Hotspot>
              <ConvItem initials="AL" color="bg-violet-500" name="Ana Lima" company="Padaria do João"
                time="Ontem" lastMsg="Muito obrigada pela ajuda! 🙏" />
              <ConvItem initials="RF" color="bg-amber-600" name="Roberto Farias" company="Construtora RF"
                time="Seg" lastMsg="Aguardando retorno sobre proposta" />
              <ConvItem initials="MO" color="bg-rose-500" name="Mariana Oliveira" company="Studio MO"
                time="29/05" lastMsg="Quando começa o trial?" />
            </div>
          </div>
        ) : (
          <ConvList active="carlos" onSelect={() => {}} />
        )}
      </div>

      {/* Chat */}
      <ChatCol scene={scene} inputRef={inputRef} sendRef={sendRef} advance={advance} />

      {/* Info panel (visible when chat open) */}
      {scene !== 'inbox' && <InfoPanel />}
    </div>
  )
}

// ── Main export ───────────────────────────────────────────────────────────────
export function AtendimentoDemo() {
  const [scene, setScene] = useState<Scene>('inbox')
  const advance = () => setScene(s => SCENES[Math.min(SCENES.indexOf(s) + 1, SCENES.length - 1)])
  const idx = SCENES.indexOf(scene)

  // Auto-advance from 'sent' to 'done' after message appears
  useEffect(() => {
    if (scene !== 'sent') return
    const t = setTimeout(advance, 1500)
    return () => clearTimeout(t)
  }, [scene]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="rounded-2xl border border-border shadow-xl bg-background" style={{ minWidth: 1080 }}>
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

      <div className="flex" style={{ height: 572 }}>
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
            Recomeçar
          </button>
        )}
      </div>
    </div>
  )
}
