'use client'

import { useState, useRef, useEffect, useLayoutEffect } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/utils'
import {
  TrendingUp, PieChart, MessageCircle, UserCog,
  Sparkles, LifeBuoy, Settings, Megaphone,
  ChevronRight, Bot, Send, CheckCheck,
  Smartphone, Zap, BarChart2, ThumbsUp, ThumbsDown,
  AlertCircle, CheckCircle2, ToggleLeft, ToggleRight, Play,
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

// ── Bubble ────────────────────────────────────────────────────────────────────
function Bubble({ dir, text, time, typing, ai }: { dir: 'in'|'out'; text?: string; time?: string; typing?: boolean; ai?: boolean }) {
  const isOut = dir === 'out'
  return (
    <div className={cn('flex', isOut ? 'justify-end' : 'justify-start')}>
      <div className={cn(
        'relative max-w-[85%] px-3 py-2 shadow-sm',
        isOut
          ? 'bg-[#dcf8c6] dark:bg-[#005c4b] rounded-2xl rounded-tr-none'
          : 'bg-white dark:bg-[#1f2c34] rounded-2xl rounded-tl-none'
      )}>
        {isOut && <div className="absolute top-0 right-[-7px] w-0 h-0 border-t-[8px] border-t-[#dcf8c6] dark:border-t-[#005c4b] border-l-[8px] border-l-transparent" />}
        {!isOut && <div className="absolute top-0 left-[-7px] w-0 h-0 border-t-[8px] border-t-white dark:border-t-[#1f2c34] border-r-[8px] border-r-transparent" />}
        {ai && <p className="text-[10px] font-semibold text-primary mb-1">Agente IA</p>}
        {typing ? (
          <div className="flex items-center gap-1 py-0.5">
            {[0,1,2].map(i => (
              <span key={i} className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: `${i*150}ms` }} />
            ))}
          </div>
        ) : (
          <p className="text-[13px] leading-[1.4] text-[#111] dark:text-[#e9edef] break-words">{text}</p>
        )}
        {time && (
          <div className="flex items-center justify-end gap-1 mt-0.5">
            <span className="text-[10px] text-[#667781] dark:text-[#8696a0]">{time}</span>
            {isOut && <CheckCheck className="w-3 h-3 text-[#53bdeb]" />}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Scenes ────────────────────────────────────────────────────────────────────
type Scene = 'start' | 'mode_select' | 'lead_msg' | 'agent_typing' | 'agent_replied' | 'evaluation' | 'done'
const SCENES: Scene[] = ['start', 'mode_select', 'lead_msg', 'agent_typing', 'agent_replied', 'evaluation', 'done']
const META: Record<Scene, string> = {
  start:         'Clique em "Iniciar simulacao" para testar seu prompt antes de ativar com leads reais',
  mode_select:   'Escolha o modo: Basico (perguntas prontas) ou Avancado (voce digita como o lead)',
  lead_msg:      'Modo Avancado: voce simula o lead. Escreva uma mensagem como se fosse seu cliente',
  agent_typing:  'Agente processando a mensagem com base na sua configuracao...',
  agent_replied: 'Resposta gerada: avalie se esta alinhada com seu produto e tom de voz',
  evaluation:    'Avaliador analisa a qualidade da resposta e sugere melhorias no prompt',
  done:          'Simulacao concluida: ajuste o prompt conforme sugestoes e teste novamente',
}

export function SimuladorDemo() {
  const [scene, setScene] = useState<Scene>('start')
  const advance = () => setScene(s => SCENES[Math.min(SCENES.indexOf(s) + 1, SCENES.length - 1)])
  const idx = SCENES.indexOf(scene)

  // auto-advance agent_typing → agent_replied
  useEffect(() => {
    if (scene !== 'agent_typing') return
    const t = setTimeout(advance, 1200)
    return () => clearTimeout(t)
  }, [scene]) // eslint-disable-line react-hooks/exhaustive-deps

  const startRef = useRef<HTMLButtonElement>(null)
  const modeRef  = useRef<HTMLButtonElement>(null)
  const sendRef  = useRef<HTMLButtonElement>(null)

  const showChat    = idx >= 2
  const showTyping  = scene === 'agent_typing'
  const showReply   = idx >= 4
  const showEval    = scene === 'evaluation' || scene === 'done'

  return (
    <div className="w-full rounded-2xl border border-border shadow-xl bg-background">
      <div className="bg-muted/40 border-b border-border px-4 py-2 flex items-center gap-3 rounded-t-2xl">
        <div className="flex gap-1.5">
          <div className="w-3 h-3 rounded-full bg-red-400/60" />
          <div className="w-3 h-3 rounded-full bg-amber-400/60" />
          <div className="w-3 h-3 rounded-full bg-emerald-400/60" />
        </div>
        <div className="flex-1 bg-background/80 border border-border/40 rounded-md px-3 py-1 text-[11px] text-muted-foreground font-mono">
          app.zaapply.com.br/automacoes/agente-sdr/simulador
        </div>
      </div>

      <div className="flex" style={{ height: 520 }}>
        <FakeSidebar active="automacoes" />

        {/* SDR sub-nav */}
        <div className="flex flex-col border-r border-border flex-shrink-0" style={{ width: 148 }}>
          <div className="h-12 border-b border-border flex items-center px-3">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Agente SDR</p>
          </div>
          {[
            { id: 'identidade',   label: 'Identidade',  icon: Bot },
            { id: 'conhecimento', label: 'Conhecimento',icon: Sparkles },
            { id: 'simulador',    label: 'Simulador',   icon: Zap },
          ].map(t => (
            <div key={t.id} className={cn(
              'flex items-center gap-2 px-3 py-2.5 border-b border-border/30 text-xs transition-colors',
              t.id === 'simulador' ? 'bg-primary/10 text-primary font-medium' : 'text-muted-foreground'
            )}>
              <t.icon className="w-4 h-4 shrink-0" /><span>{t.label}</span>
            </div>
          ))}
        </div>

        {/* Main area: dual panel */}
        <div className="flex-1 min-w-0 overflow-hidden flex flex-col">

          {/* Mode bar */}
          <div className="flex items-center justify-between px-5 h-12 border-b border-border bg-card flex-shrink-0">
            <div className="flex items-center gap-3">
              <div className="flex rounded-lg border border-border bg-muted p-0.5">
                <button className={cn('px-3 py-1 rounded-md text-xs font-medium transition-all',
                  idx <= 1 || idx >= 2 ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground'
                )}>Basico</button>
                <button className={cn('px-3 py-1 rounded-md text-xs font-medium transition-all',
                  idx >= 2 ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground'
                )}>Avancado</button>
              </div>
              {idx >= 2 && (
                <span className="text-[11px] text-muted-foreground">Simulando como: <strong className="text-foreground">Lead B2B</strong></span>
              )}
            </div>
            {scene === 'start' ? (
              <Hotspot label='Iniciar simulacao para testar o prompt do agente' onClick={advance} side="bottom" minW={300}>
                <button ref={startRef}
                  className="flex items-center gap-1.5 px-3 h-8 rounded-lg text-xs font-semibold bg-primary text-primary-foreground">
                  <Play className="w-3.5 h-3.5" />Iniciar simulacao
                </button>
              </Hotspot>
            ) : (
              <button className="flex items-center gap-1.5 px-3 h-8 rounded-lg text-xs font-semibold bg-primary text-primary-foreground opacity-70">
                <Play className="w-3.5 h-3.5" />Simulando...
              </button>
            )}
          </div>

          {scene === 'start' && (
            <div className="flex-1 flex flex-col items-center justify-center gap-5 p-8 text-center">
              <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                <Zap className="h-7 w-7 text-primary" />
              </div>
              <div className="space-y-2">
                <h3 className="text-base font-bold">Simulador de Prompt</h3>
                <p className="text-sm text-muted-foreground max-w-xs leading-relaxed">
                  Teste como o agente responderia a um lead real antes de ativar. Identifique gaps no prompt sem arriscar leads reais.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3 text-left max-w-sm w-full">
                {[
                  { icon: Smartphone, label: 'Modo Basico', desc: 'Perguntas pré-definidas comuns' },
                  { icon: MessageCircle, label: 'Modo Avancado', desc: 'Voce simula o lead livremente' },
                ].map(m => (
                  <div key={m.label} className="p-3 rounded-xl border border-border bg-muted/30">
                    <m.icon className="h-4 w-4 text-primary mb-1.5" />
                    <p className="text-xs font-semibold mb-0.5">{m.label}</p>
                    <p className="text-[11px] text-muted-foreground">{m.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {scene === 'mode_select' && (
            <div className="flex-1 flex flex-col items-center justify-center gap-5 p-8 text-center">
              <p className="text-sm font-semibold">Selecione o modo de simulacao</p>
              <div className="flex gap-3 flex-wrap justify-center">
                <button className="flex items-center gap-2 px-5 h-10 rounded-xl border border-border bg-muted text-sm font-medium text-muted-foreground">
                  <Smartphone className="h-4 w-4" />Basico
                </button>
                <Hotspot label='Modo Avancado: voce digita as mensagens como se fosse o lead' onClick={advance} side="top" minW={320}>
                  <button ref={modeRef}
                    className="flex items-center gap-2 px-5 h-10 rounded-xl border-2 border-primary bg-primary/5 text-sm font-semibold text-primary shadow-sm">
                    <MessageCircle className="h-4 w-4" />Avancado
                  </button>
                </Hotspot>
              </div>
              <p className="text-xs text-muted-foreground max-w-xs">No modo Avancado voce escreve como o lead: ideal para testar objecoes e cenarios especificos</p>
            </div>
          )}

          {showChat && (
            <div className="flex flex-1 min-h-0 overflow-hidden">
              {/* Lead side */}
              <div className="flex-1 flex flex-col border-r border-border min-w-0">
                <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border bg-muted/30 flex-shrink-0">
                  <Smartphone className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-xs font-semibold text-muted-foreground">Perspectiva do Lead</span>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-3"
                  style={{ background: 'hsl(var(--background)/0.5)' }}>
                  <Bubble dir="in" text="Ola! Vi que voces tem automacao com WhatsApp. Quanto custa?" time="10:14" />
                  {showReply && <Bubble dir="out" text="Ola! Temos planos a partir de R$197/mes com acesso completo ao CRM e Agente IA integrado. Qual o tamanho da sua equipe de vendas?" time="10:14" ai />}
                  {showTyping && <Bubble dir="out" typing />}
                </div>
                <div className="border-t border-border bg-card px-3 py-2.5 flex-shrink-0">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-9 px-3 rounded-xl border border-border bg-muted/50 flex items-center text-xs text-muted-foreground/60">
                      {scene === 'lead_msg' ? (
                        <Hotspot label='Clique para enviar a mensagem do lead' onClick={advance} side="top" minW={280}>
                          <div className="text-foreground text-xs">Quanto custa? Eu ja uso outra ferramenta...</div>
                        </Hotspot>
                      ) : (
                        <span>Escreva como se fosse o lead...</span>
                      )}
                    </div>
                    {scene === 'lead_msg' ? (
                      <Hotspot label='Enviar mensagem do lead' onClick={advance} side="top" minW={220}>
                        <button ref={sendRef}
                          className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground">
                          <Send className="w-3.5 h-3.5" />
                        </button>
                      </Hotspot>
                    ) : (
                      <button className="w-8 h-8 rounded-lg bg-primary/30 flex items-center justify-center text-primary-foreground/50">
                        <Send className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Evaluation panel */}
              <div className="flex flex-col flex-shrink-0" style={{ width: 260 }}>
                <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border bg-muted/30 flex-shrink-0">
                  <BarChart2 className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-xs font-semibold text-muted-foreground">Avaliacao do Prompt</span>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {!showEval ? (
                    <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
                      <BarChart2 className="h-8 w-8 text-muted-foreground/20" />
                      <p className="text-xs text-muted-foreground">A avaliacao aparece apos o agente responder</p>
                    </div>
                  ) : (
                    <>
                      {/* Score */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-semibold">Pontuacao geral</p>
                          <span className="text-sm font-bold text-primary">82/100</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                          <div className="h-full rounded-full bg-primary transition-all duration-700" style={{ width: '82%' }} />
                        </div>
                      </div>

                      {/* Positives */}
                      <div className="space-y-1.5">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Pontos fortes</p>
                        {[
                          'Preco informado com clareza',
                          'Pergunta qualificadora ao final',
                          'Tom profissional e direto',
                        ].map(p => (
                          <div key={p} className="flex items-start gap-2">
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 mt-0.5 shrink-0" />
                            <p className="text-[11px] text-foreground leading-snug">{p}</p>
                          </div>
                        ))}
                      </div>

                      {/* Improvements */}
                      <div className="space-y-1.5">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Sugestoes</p>
                        {[
                          'Mencionar diferencial vs concorrente',
                          'Propor proxima etapa (demo)',
                        ].map(s => (
                          <div key={s} className="flex items-start gap-2">
                            <AlertCircle className="h-3.5 w-3.5 text-amber-500 mt-0.5 shrink-0" />
                            <p className="text-[11px] text-foreground leading-snug">{s}</p>
                          </div>
                        ))}
                      </div>

                      {/* Feedback */}
                      <div className="pt-2 border-t border-border">
                        <p className="text-[10px] text-muted-foreground mb-2">Esta avaliacao foi util?</p>
                        <div className="flex gap-2">
                          <button onClick={advance}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/5 text-emerald-600 text-xs font-medium">
                            <ThumbsUp className="h-3 w-3" />Sim
                          </button>
                          <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-muted text-muted-foreground text-xs font-medium">
                            <ThumbsDown className="h-3 w-3" />Nao
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}
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
          <button onClick={() => setScene('start')}
            className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2">
            Recomecar
          </button>
        )}
      </div>
    </div>
  )
}
