'use client'
import { useState, useRef, useEffect, useLayoutEffect } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard, MessageSquare, Users, Bot, Mail,
  Workflow, Settings, HelpCircle, Send, Paperclip,
  Search, Building2, CheckCheck, Circle, ChevronDown,
} from 'lucide-react'

// ─── PortalTooltip ────────────────────────────────────────────────────────────
type TooltipSide = 'top' | 'right' | 'bottom' | 'left'

function PortalTooltip({ anchorRef, label, side, minW = 240 }: {
  anchorRef: React.RefObject<HTMLElement | null>
  label: string; side: TooltipSide; minW?: number
}) {
  const [mounted, setMounted] = useState(false)
  const [style, setStyle]     = useState<React.CSSProperties | null>(null)
  useEffect(() => { setMounted(true) }, [])
  useLayoutEffect(() => {
    const el = anchorRef.current
    if (!el) return
    const r   = el.getBoundingClientRect()
    const gap = 12
    let s: React.CSSProperties
    if      (side === 'top')    s = { bottom: window.innerHeight - r.top + gap, left: r.left + r.width / 2, transform: 'translateX(-50%)' }
    else if (side === 'bottom') s = { top: r.bottom + gap,                       left: r.left + r.width / 2, transform: 'translateX(-50%)' }
    else if (side === 'right')  s = { top: r.top + r.height / 2,                left: r.right + gap,         transform: 'translateY(-50%)' }
    else                        s = { top: r.top + r.height / 2,                right: window.innerWidth - r.left + gap, transform: 'translateY(-50%)' }
    setStyle(s)
  }, [label, side])
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

// ─── Hotspot ──────────────────────────────────────────────────────────────────
function Hotspot({ children, label, onClick, side = 'top', minW = 240 }: {
  children: React.ReactNode; label: string; onClick: () => void
  side?: TooltipSide; minW?: number
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

// ─── ZaapliIcon ───────────────────────────────────────────────────────────────
function ZaapliIcon({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M50 5 L95 85 L5 85 Z" fill="#369E47" />
      <path d="M35 60 L50 33 L65 60 Z" fill="white" />
    </svg>
  )
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────
const NAV = [
  { id: 'dashboard',   label: 'Dashboard',   icon: LayoutDashboard },
  { id: 'atendimento', label: 'Atendimento', icon: MessageSquare },
  { id: 'crm',         label: 'CRM',         icon: Users },
  { id: 'sdr',         label: 'Agente SDR',  icon: Bot },
  { id: 'followup',    label: 'Follow-up',   icon: Mail },
  { id: 'canvas',      label: 'Canvas',      icon: Workflow },
]

function FakeSidebar({ active }: { active: string }) {
  return (
    <div className="w-16 flex flex-col items-center py-4 gap-1 border-r border-border/50 bg-card flex-shrink-0">
      <div className="mb-3"><ZaapliIcon size={28} /></div>
      {NAV.map(({ id, label, icon: Icon }) => (
        <div
          key={id}
          title={label}
          className={cn(
            'w-10 h-10 rounded-xl flex items-center justify-center transition-colors',
            active === id
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:bg-muted/60'
          )}
        >
          <Icon className="w-5 h-5" />
        </div>
      ))}
      <div className="mt-auto flex flex-col items-center gap-2">
        <Settings className="w-4 h-4 text-muted-foreground" />
        <HelpCircle className="w-4 h-4 text-muted-foreground" />
      </div>
    </div>
  )
}

// ─── Avatar helper ────────────────────────────────────────────────────────────
function Avatar({ name, size = 36, color }: { name: string; size?: number; color?: string }) {
  const initials = name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
  return (
    <div
      className="rounded-full flex items-center justify-center text-white font-semibold flex-shrink-0"
      style={{ width: size, height: size, fontSize: size * 0.38, backgroundColor: color || '#369E47' }}
    >
      {initials}
    </div>
  )
}

// ─── Fake data ────────────────────────────────────────────────────────────────
const CONVS = [
  {
    id: 1,
    name: 'Carlos Mendes',
    company: 'TechFlow Ltda',
    last: 'Quero saber mais sobre os planos e preços',
    time: '09:32',
    unread: 2,
    color: '#2563eb',
  },
  {
    id: 2,
    name: 'Ana Lima',
    company: 'Padaria do João',
    last: 'Quando vocês abrem amanhã?',
    time: 'Ontem',
    unread: 0,
    color: '#7c3aed',
  },
  {
    id: 3,
    name: 'Roberto Farias',
    company: 'Construtora RF',
    last: 'Ok, muito obrigado pelo suporte!',
    time: 'Seg',
    unread: 0,
    color: '#b45309',
  },
]

const MESSAGES_INITIAL = [
  { id: 1, dir: 'in',  text: 'Oi, vi o anúncio de vocês e gostei muito do sistema!',          time: '09:28' },
  { id: 2, dir: 'in',  text: 'Quero saber mais sobre os planos e preços do Zaapply.',         time: '09:32' },
]

// ─── Scene types ──────────────────────────────────────────────────────────────
type Scene = 'inbox' | 'chat' | 'typing' | 'sent' | 'done'
const SCENES: Scene[] = ['inbox', 'chat', 'typing', 'sent', 'done']

const SCENE_META: Record<Scene, { label: string; url: string }> = {
  inbox:  { label: 'Nova mensagem recebida — clique na conversa para abrir o chat', url: 'atendimento' },
  chat:   { label: 'Chat aberto — clique no campo de mensagem para responder', url: 'atendimento' },
  typing: { label: 'Mensagem pronta — clique em Enviar', url: 'atendimento' },
  sent:   { label: 'Mensagem enviada! Clique em "Agente ativo" para pausar o SDR', url: 'atendimento' },
  done:   { label: 'Agente pausado — você assumiu o atendimento humano', url: 'atendimento' },
}

// ─── Inbox screen ─────────────────────────────────────────────────────────────
function InboxScreen({ onNext }: { onNext: () => void }) {
  return (
    <div className="absolute inset-0 flex bg-card">
      {/* Conv list */}
      <div className="w-72 flex flex-col border-r border-border/50 flex-shrink-0">
        {/* Header */}
        <div className="px-4 pt-4 pb-3 border-b border-border/40 space-y-2.5">
          <div className="flex items-center justify-between">
            <p className="font-semibold text-sm">Atendimento</p>
            <div className="flex items-center gap-1 text-[11px] text-muted-foreground border border-border/60 rounded-lg px-2 py-1">
              Minhas <ChevronDown className="w-3 h-3 ml-0.5" />
            </div>
          </div>
          <div className="flex items-center gap-2 bg-muted/60 border border-border/40 rounded-lg px-3 py-1.5">
            <Search className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Buscar conversa...</span>
          </div>
        </div>
        {/* List */}
        <div className="flex-1 overflow-y-auto py-2 px-2 space-y-1">
          {CONVS.map((c) => (
            <div key={c.id} className="relative">
              {c.id === 1 && (
                <Hotspot
                  label="Nova mensagem de Carlos — clique para abrir a conversa"
                  onClick={onNext}
                  side="right"
                  minW={280}
                >
                  <ConvCard conv={c} active />
                </Hotspot>
              )}
              {c.id !== 1 && <ConvCard conv={c} />}
            </div>
          ))}
        </div>
      </div>

      {/* Empty state */}
      <div className="flex-1 flex flex-col items-center justify-center gap-3 text-muted-foreground">
        <MessageSquare className="w-12 h-12 opacity-20" />
        <p className="text-sm">Selecione uma conversa</p>
      </div>
    </div>
  )
}

function ConvCard({ conv, active }: { conv: typeof CONVS[number]; active?: boolean }) {
  return (
    <div className={cn(
      'w-full text-left px-3 py-2.5 rounded-lg transition-colors',
      active ? 'bg-primary/5 border border-primary/20' : 'hover:bg-muted/50'
    )}>
      <div className="flex items-start gap-3">
        <div className="relative">
          <Avatar name={conv.name} size={36} color={conv.color} />
          {conv.unread > 0 && (
            <div className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
              {conv.unread}
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-1 mb-0.5">
            <p className={cn('text-sm truncate', conv.unread ? 'font-semibold' : 'font-medium')}>{conv.name}</p>
            <span className="text-[10px] text-muted-foreground flex-shrink-0">{conv.time}</span>
          </div>
          <div className="flex items-center gap-1 mb-1">
            <Building2 className="w-3 h-3 text-muted-foreground flex-shrink-0" />
            <p className="text-xs text-muted-foreground truncate">{conv.company}</p>
          </div>
          <p className={cn('text-xs truncate', conv.unread ? 'text-foreground/80' : 'text-muted-foreground')}>{conv.last}</p>
        </div>
      </div>
    </div>
  )
}

// ─── Chat screen ──────────────────────────────────────────────────────────────
function ChatScreen({ phase, onNext }: { phase: 'open' | 'typing' | 'sent' | 'done'; onNext?: () => void }) {
  const inputRef   = useRef<HTMLDivElement>(null)
  const sendRef    = useRef<HTMLDivElement>(null)
  const agentRef   = useRef<HTMLDivElement>(null)
  const conv       = CONVS[0]

  const typedText = 'Olá Carlos! Que bom que gostou 😊 Nosso plano Starter é R$397/mês com tudo incluso. Posso te enviar mais detalhes ou agendar uma demo?'
  const messages  = phase === 'sent' || phase === 'done'
    ? [...MESSAGES_INITIAL, { id: 3, dir: 'out', text: typedText, time: '09:35' }]
    : MESSAGES_INITIAL

  return (
    <div className="absolute inset-0 flex bg-card">
      {/* Conv list (mini, without hotspot) */}
      <div className="w-72 flex flex-col border-r border-border/50 flex-shrink-0">
        <div className="px-4 pt-4 pb-3 border-b border-border/40 space-y-2.5">
          <div className="flex items-center justify-between">
            <p className="font-semibold text-sm">Atendimento</p>
            <div className="flex items-center gap-1 text-[11px] text-muted-foreground border border-border/60 rounded-lg px-2 py-1">
              Minhas <ChevronDown className="w-3 h-3 ml-0.5" />
            </div>
          </div>
          <div className="flex items-center gap-2 bg-muted/60 border border-border/40 rounded-lg px-3 py-1.5">
            <Search className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Buscar conversa...</span>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto py-2 px-2 space-y-1">
          {CONVS.map((c) => (
            <div key={c.id} className={cn(
              'px-3 py-2.5 rounded-lg',
              c.id === 1 ? 'bg-primary/5 border border-primary/20' : 'opacity-50'
            )}>
              <div className="flex items-start gap-3">
                <div className="relative">
                  <Avatar name={c.name} size={36} color={c.color} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{c.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{c.last}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Chat area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Chat header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border/50 flex-shrink-0">
          <Avatar name={conv.name} size={36} color={conv.color} />
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm">{conv.name}</p>
            <p className="text-xs text-muted-foreground">{conv.company}</p>
          </div>
          {/* Agente ativo button */}
          {phase === 'sent' && onNext && (
            <Hotspot
              label="Clique aqui para pausar o Agente IA e assumir o atendimento manualmente"
              onClick={onNext}
              side="bottom"
              minW={300}
            >
              <div ref={agentRef} className="flex items-center gap-1.5 text-xs font-medium border border-emerald-500/50 text-emerald-600 rounded-lg px-3 py-1.5 bg-emerald-500/5">
                <Bot className="w-3.5 h-3.5" />
                Agente ativo
              </div>
            </Hotspot>
          )}
          {phase !== 'sent' && (
            <div className="flex items-center gap-1.5 text-xs font-medium border border-emerald-500/50 text-emerald-600 rounded-lg px-3 py-1.5 bg-emerald-500/5">
              <Bot className="w-3.5 h-3.5" />
              {phase === 'done' ? 'Agente pausado' : 'Agente ativo'}
            </div>
          )}
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-3 bg-[#0e1117]">
          {/* Date separator */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-border/20" />
            <span className="text-[11px] text-muted-foreground bg-muted/30 rounded-full px-3 py-0.5">Hoje</span>
            <div className="flex-1 h-px bg-border/20" />
          </div>
          {messages.map((m) => (
            <div key={m.id} className={cn('flex gap-2', m.dir === 'out' ? 'justify-end' : 'justify-start')}>
              {m.dir === 'in' && <Avatar name={conv.name} size={28} color={conv.color} />}
              <div className={cn(
                'max-w-[60%] rounded-2xl px-3.5 py-2.5',
                m.dir === 'out'
                  ? 'bg-green-500/20 border border-green-500/20 rounded-tr-sm'
                  : 'bg-muted rounded-tl-sm'
              )}>
                <p className="text-sm leading-snug">{m.text}</p>
                <div className="flex items-center gap-1 justify-end mt-1">
                  <span className="text-[10px] text-muted-foreground">{m.time}</span>
                  {m.dir === 'out' && <CheckCheck className="w-3 h-3 text-primary" />}
                </div>
              </div>
            </div>
          ))}
          {phase === 'done' && (
            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-border/20" />
              <span className="text-[11px] text-muted-foreground bg-muted/30 rounded-full px-3 py-0.5 flex items-center gap-1.5">
                <Bot className="w-3 h-3" /> Agente pausado — atendimento humano
              </span>
              <div className="flex-1 h-px bg-border/20" />
            </div>
          )}
        </div>

        {/* Input area */}
        <div className="border-t border-border/50 flex-shrink-0">
          <div className="flex items-center gap-2 p-3">
            <div className="text-muted-foreground p-2">
              <Paperclip className="w-4 h-4" />
            </div>

            {/* Input field with hotspot */}
            {phase === 'open' && onNext && (
              <Hotspot
                label="Clique aqui para digitar sua resposta ao Carlos"
                onClick={onNext}
                side="top"
                minW={280}
              >
                <div ref={inputRef} className="flex-1 bg-muted/50 border border-border/60 rounded-xl px-4 py-2.5 text-sm text-muted-foreground cursor-pointer" style={{ minWidth: 380 }}>
                  Digite uma mensagem...
                </div>
              </Hotspot>
            )}

            {phase === 'typing' && (
              <div className="flex-1 bg-muted/50 border border-border/60 rounded-xl px-4 py-2.5 text-sm flex-shrink min-w-0" style={{ minWidth: 380 }}>
                <span>{typedText}</span>
                <span className="inline-block w-0.5 h-4 bg-primary align-middle ml-0.5 animate-pulse" />
              </div>
            )}

            {(phase === 'sent' || phase === 'done') && (
              <div className="flex-1 bg-muted/50 border border-border/60 rounded-xl px-4 py-2.5 text-sm text-muted-foreground" style={{ minWidth: 380 }}>
                Digite uma mensagem...
              </div>
            )}

            {/* Send button */}
            {phase === 'typing' && onNext && (
              <Hotspot
                label="Clique em Enviar para mandar a mensagem"
                onClick={onNext}
                side="top"
                minW={240}
              >
                <div ref={sendRef} className="rounded-xl p-2.5 cursor-pointer" style={{ backgroundColor: '#005c4b' }}>
                  <Send className="w-4 h-4 text-white" />
                </div>
              </Hotspot>
            )}

            {phase !== 'typing' && (
              <div className="rounded-xl p-2.5" style={{ backgroundColor: '#005c4b' }}>
                <Send className="w-4 h-4 text-white" />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────
export function AtendimentoDemo({ className }: { className?: string }) {
  const [scene, setScene] = useState<Scene>('inbox')
  const advance = () => setScene(s => SCENES[Math.min(SCENES.indexOf(s) + 1, SCENES.length - 1)])
  const sceneIdx = SCENES.indexOf(scene)
  const meta = SCENE_META[scene]

  return (
    <div
      className={cn('rounded-2xl border border-border shadow-xl bg-background overflow-hidden', className)}
      style={{ minWidth: 1080 }}
    >
      {/* URL bar */}
      <div className="bg-muted/40 border-b border-border px-4 py-2 flex items-center gap-3 rounded-t-2xl">
        <div className="flex gap-1.5">
          <div className="w-3 h-3 rounded-full bg-red-400/60" />
          <div className="w-3 h-3 rounded-full bg-amber-400/60" />
          <div className="w-3 h-3 rounded-full bg-emerald-400/60" />
        </div>
        <div className="flex-1 bg-background/80 border border-border/40 rounded-md px-3 py-1 text-[11px] text-muted-foreground font-mono">
          app.zaapply.com.br/{meta.url}
        </div>
      </div>

      {/* App shell */}
      <div className="flex" style={{ height: 580 }}>
        <FakeSidebar active="atendimento" />
        <div className="flex-1 min-w-0 relative overflow-hidden">
          <div key={scene} className="absolute inset-0 animate-in fade-in duration-200">
            {scene === 'inbox'  && <InboxScreen onNext={advance} />}
            {scene === 'chat'   && <ChatScreen phase="open"   onNext={advance} />}
            {scene === 'typing' && <ChatScreen phase="typing" onNext={advance} />}
            {scene === 'sent'   && <ChatScreen phase="sent"   onNext={advance} />}
            {scene === 'done'   && <ChatScreen phase="done" />}
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="border-t border-border bg-muted/20 px-5 py-3 flex items-center gap-4 rounded-b-2xl">
        <div className="flex gap-1.5 items-center">
          {SCENES.filter(s => s !== 'done').map((s, i) => (
            <div
              key={s}
              className={cn(
                'rounded-full transition-all duration-300',
                s === scene        ? 'w-5 h-1.5 bg-primary'
                  : i < sceneIdx  ? 'w-1.5 h-1.5 bg-primary/50'
                                  : 'w-1.5 h-1.5 bg-muted-foreground/20'
              )}
            />
          ))}
        </div>
        <p className="text-[12px] text-muted-foreground flex-1">{meta.label}</p>
        {scene === 'done' && (
          <button
            onClick={() => setScene('inbox')}
            className="text-[11px] text-muted-foreground hover:text-foreground border border-border/60 rounded-lg px-3 py-1 transition-colors"
          >
            Reiniciar
          </button>
        )}
      </div>
    </div>
  )
}
