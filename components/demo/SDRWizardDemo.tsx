'use client'

import { useState, useRef, useEffect, useLayoutEffect } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/utils'
import {
  TrendingUp, PieChart, MessageCircle, UserCog,
  Sparkles, LifeBuoy, Settings, Megaphone,
  ChevronRight, Check, Bot, BookOpen, AlertCircle,
  User, Target, MessageSquare, ShieldCheck, Clock,
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

// ── Wizard steps ─────────────────────────────────────────────────────────────
const STEPS = [
  { id: 'identidade',   label: 'Identidade',   Icon: User,          short: '1' },
  { id: 'conhecimento', label: 'Conhecimento',  Icon: BookOpen,      short: '2' },
  { id: 'objetivos',    label: 'Objetivos',     Icon: Target,        short: '3' },
  { id: 'objeccoes',    label: 'Objecoes',      Icon: ShieldCheck,   short: '4' },
  { id: 'atendimento',  label: 'Atendimento',   Icon: Clock,         short: '5' },
] as const
type StepId = typeof STEPS[number]['id']

// ── Scenes ─────────────────────────────────────────────────────────────────
type Scene = 'overview' | 'step_identidade' | 'step_conhecimento' | 'step_objetivos' | 'step_objeccoes' | 'done'
const SCENES: Scene[] = ['overview', 'step_identidade', 'step_conhecimento', 'step_objetivos', 'step_objeccoes', 'done']
const SCENE_STEP: Record<Scene, StepId | null> = {
  overview: null,
  step_identidade: 'identidade',
  step_conhecimento: 'conhecimento',
  step_objetivos: 'objetivos',
  step_objeccoes: 'objeccoes',
  done: 'atendimento',
}

const META: Record<Scene, string> = {
  overview:          'Clique em "Configurar" para iniciar o wizard da base de conhecimento',
  step_identidade:   'Identidade: nome do agente, empresa, setor e tom de voz: quanto mais detalhes, mais natural o atendimento',
  step_conhecimento: 'Conhecimento: produtos, precos, diferenciais: DETALHE cada item; respostas vagas aqui = atendimento ruim',
  step_objetivos:    'Objetivos: defina a meta do agente (agendar demo, fechar venda, qualificar lead) e o fluxo ideal',
  step_objeccoes:    'Objecoes: liste as mais comuns e como contornar: esta etapa e crucial para converter leads resistentes',
  done:              'Base de conhecimento preenchida: quanto mais rica, melhor o desempenho do Agente IA',
}

const STEP_CONTENT: Record<StepId, { title: string; fields: { label: string; placeholder: string; filled?: string; tall?: boolean }[] }> = {
  identidade: {
    title: 'Identidade do Agente',
    fields: [
      { label: 'Nome do agente', placeholder: 'Ex: Sofia, Max, Ana...', filled: 'Sofia' },
      { label: 'Nome da empresa', placeholder: 'Ex: TechFlow Solutions', filled: 'TechFlow Solutions' },
      { label: 'Setor / nicho', placeholder: 'Ex: SaaS B2B, clinica, imoveis', filled: 'SaaS B2B - automacao de vendas' },
      { label: 'Tom de voz', placeholder: 'Ex: profissional e direto, descontraido e amigavel', filled: 'Profissional, consultivo e empático. Evitar gírias.' },
    ],
  },
  conhecimento: {
    title: 'Base de Conhecimento',
    fields: [
      { label: 'Produtos / servicos', placeholder: 'Liste cada produto com nome, preco, diferenciais e para quem e ideal...', tall: true,
        filled: 'Plano Starter (R$197/mes): ate 3 atendentes, 1 WhatsApp, CRM basico. Ideal para autonomos e pequenos negocios.\nPlano Pro (R$397/mes): ate 10 atendentes, follow-up ilimitado, API.\nPlano Scale (R$797/mes): ilimitado, suporte dedicado, onboarding.' },
      { label: 'Principais diferenciais', placeholder: 'O que voce tem que a concorrencia nao tem?',
        filled: 'Unico com IA nativa integrada ao WhatsApp sem extensoes. Setup em 10 minutos. Suporte humano em ate 2h.' },
    ],
  },
  objetivos: {
    title: 'Objetivos do Agente',
    fields: [
      { label: 'Meta principal', placeholder: 'O que o agente deve conseguir? Ex: agendar demo, qualificar lead, fechar venda',
        filled: 'Qualificar o lead e agendar uma demo de 30min com o closer.' },
      { label: 'Fluxo ideal de conversa', placeholder: 'Como deve ser a conversa ideal do inicio ao fim?', tall: true,
        filled: '1. Cumprimentar e perguntar o segmento\n2. Apresentar beneficios relevantes ao perfil\n3. Perguntar sobre volume de leads e equipe\n4. Propor a demo: "Posso te mostrar em 30min como funciona?"' },
    ],
  },
  objeccoes: {
    title: 'Objecoes Frequentes',
    fields: [
      { label: 'Objecao: Preco alto', placeholder: 'Como o agente deve responder?',
        filled: '"Entendo! O Starter e R$197/mes: equivale a um atendente trabalhando 24h/dia. Posso mostrar o ROI numa demo rapida?"' },
      { label: 'Objecao: Ja uso outra ferramenta', placeholder: 'Como o agente deve responder?',
        filled: '"Qual voce usa? Muitos clientes migraram do [X] porque nossa IA nativa elimina 3 ferramentas separadas. Posso comparar?"' },
      { label: 'Objecao: Nao tenho tempo agora', placeholder: 'Como o agente deve responder?',
        filled: '"Sem problema! A demo e so 30min e mostro exatamente o que resolve seu gargalo. Quando seria melhor: manha ou tarde?"' },
    ],
  },
  atendimento: {
    title: 'Horario de Atendimento',
    fields: [
      { label: 'Dias e horarios', placeholder: 'Ex: Seg a Sex, 08h-18h', filled: 'Seg a Sex, 08h-18h' },
      { label: 'Mensagem fora do horario', placeholder: 'O que o agente deve dizer fora do horario?',
        filled: 'Oi! Estou fora do horario agora, mas responderei amanha cedo. Posso ja agendar sua demo para [data]?' },
    ],
  },
}

function StepContent({ step, highlight, onNext, isLast }: {
  step: StepId; highlight: boolean; onNext: () => void; isLast?: boolean
}) {
  const content = STEP_CONTENT[step]
  const btnRef = useRef<HTMLButtonElement>(null)

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 overflow-y-auto p-5 space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <p className="text-sm font-semibold text-foreground">{content.title}</p>
          {highlight && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 font-medium">Preencha com detalhes</span>
          )}
        </div>
        {content.fields.map((field, i) => (
          <div key={field.label} className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">{field.label}</label>
            {field.filled ? (
              <div className={cn(
                'w-full px-3 py-2 rounded-xl border border-primary/30 bg-primary/5 text-sm text-foreground leading-relaxed',
                field.tall ? 'min-h-[72px]' : 'min-h-[38px]'
              )}>
                {field.filled.split('\n').map((line, li) => (
                  <span key={li}>{line}{li < (field.filled!.split('\n').length - 1) && <br />}</span>
                ))}
              </div>
            ) : (
              <div className={cn(
                'w-full px-3 py-2 rounded-xl border border-border bg-muted/40 text-sm text-muted-foreground/50',
                field.tall ? 'min-h-[72px]' : 'min-h-[38px]'
              )}>
                {field.placeholder}
              </div>
            )}
          </div>
        ))}
        {highlight && (
          <div className="flex items-start gap-2.5 p-3 rounded-xl bg-amber-500/8 border border-amber-500/25">
            <AlertCircle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
            <p className="text-xs text-amber-700 dark:text-amber-400 leading-relaxed">
              Respostas vagas aqui resultam em atendimento de baixa qualidade. Quanto mais contexto, mais preciso o agente.
            </p>
          </div>
        )}
      </div>
      <div className="border-t border-border px-5 py-3 flex justify-end">
        <Hotspot label={isLast ? 'Salvar configuracoes do agente' : 'Avancar para a proxima etapa'} onClick={onNext} side="top" minW={280}>
          <button ref={btnRef}
            className="flex items-center gap-1.5 px-4 h-9 rounded-xl text-sm font-semibold bg-primary text-primary-foreground">
            {isLast ? 'Salvar' : 'Proximo'}<ChevronRight className="w-4 h-4" />
          </button>
        </Hotspot>
      </div>
    </div>
  )
}

function OverviewScreen({ onStart }: { onStart: () => void }) {
  const btnRef = useRef<HTMLButtonElement>(null)
  return (
    <div className="h-full flex flex-col items-center justify-center p-8 text-center space-y-6">
      <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
        <Bot className="h-8 w-8 text-primary" />
      </div>
      <div className="space-y-2">
        <h3 className="text-lg font-bold">Base de Conhecimento</h3>
        <p className="text-sm text-muted-foreground max-w-xs leading-relaxed">
          Configure o agente em 5 etapas. Esta e a parte mais importante: pule ou deixe vaga e o agente nao ira performar.
        </p>
      </div>
      <div className="grid grid-cols-5 gap-2 w-full max-w-sm">
        {STEPS.map(step => (
          <div key={step.id} className="flex flex-col items-center gap-1">
            <div className="w-8 h-8 rounded-lg bg-muted border border-border flex items-center justify-center">
              <step.Icon className="w-4 h-4 text-muted-foreground" />
            </div>
            <p className="text-[10px] text-muted-foreground text-center leading-tight">{step.label}</p>
          </div>
        ))}
      </div>
      <Hotspot label='Iniciar configuracao da base de conhecimento' onClick={onStart} side="top" minW={300}>
        <button ref={btnRef}
          className="flex items-center gap-2 px-6 h-10 rounded-xl font-semibold text-sm bg-primary text-primary-foreground shadow-lg shadow-primary/20">
          <Bot className="h-4 w-4" />Configurar Agente
        </button>
      </Hotspot>
    </div>
  )
}

export function SDRWizardDemo() {
  const [scene, setScene] = useState<Scene>('overview')
  const advance = () => setScene(s => SCENES[Math.min(SCENES.indexOf(s) + 1, SCENES.length - 1)])
  const idx = SCENES.indexOf(scene)

  const activeStep = SCENE_STEP[scene]
  const doneSteps: StepId[] = []
  if (idx >= 2) doneSteps.push('identidade')
  if (idx >= 3) doneSteps.push('conhecimento')
  if (idx >= 4) doneSteps.push('objetivos')
  if (idx >= 5) doneSteps.push('objeccoes')

  const isLast = scene === 'step_objeccoes'

  return (
    <div className="w-full rounded-2xl border border-border shadow-xl bg-background">
      <div className="bg-muted/40 border-b border-border px-4 py-2 flex items-center gap-3 rounded-t-2xl">
        <div className="flex gap-1.5">
          <div className="w-3 h-3 rounded-full bg-red-400/60" />
          <div className="w-3 h-3 rounded-full bg-amber-400/60" />
          <div className="w-3 h-3 rounded-full bg-emerald-400/60" />
        </div>
        <div className="flex-1 bg-background/80 border border-border/40 rounded-md px-3 py-1 text-[11px] text-muted-foreground font-mono">
          app.zaapply.com.br/automacoes/agente-sdr/conhecimento
        </div>
      </div>
      <div className="flex" style={{ height: 520 }}>
        <FakeSidebar active="automacoes" />
        {/* SDR sub-tabs */}
        <div className="flex flex-col border-r border-border flex-shrink-0" style={{ width: 160 }}>
          <div className="h-12 border-b border-border flex items-center px-3">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Agente SDR</p>
          </div>
          {[
            { id: 'identidade-tab',  label: 'Identidade',   Icon: User          },
            { id: 'conhecimento-tab',label: 'Conhecimento',  Icon: BookOpen      },
            { id: 'objetivos-tab',   label: 'Objetivos',    Icon: Target        },
            { id: 'objeccoes-tab',   label: 'Objecoes',     Icon: ShieldCheck   },
            { id: 'atendimento-tab', label: 'Atendimento',  Icon: Clock         },
            { id: 'simulador-tab',   label: 'Simulador',    Icon: MessageSquare },
          ].map(tab => {
            const stepId = tab.id.replace('-tab', '') as StepId
            const isDone = doneSteps.includes(stepId)
            const isActive = activeStep === stepId
            return (
              <div key={tab.id} className={cn(
                'flex items-center gap-2 px-3 py-2.5 border-b border-border/30 text-xs transition-colors',
                isActive  ? 'bg-primary/10 text-primary font-medium' :
                isDone    ? 'text-foreground' : 'text-muted-foreground'
              )}>
                {isDone
                  ? <div className="w-4 h-4 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                      <Check className="w-2.5 h-2.5 text-primary-foreground" />
                    </div>
                  : <tab.Icon className="w-4 h-4 shrink-0" />
                }
                <span>{tab.label}</span>
              </div>
            )
          })}
        </div>
        {/* Main area */}
        <div className="flex-1 min-w-0 overflow-hidden">
          {scene === 'overview' && <OverviewScreen onStart={advance} />}
          {scene === 'step_identidade'   && <StepContent step="identidade"   highlight onNext={advance} />}
          {scene === 'step_conhecimento' && <StepContent step="conhecimento" highlight onNext={advance} />}
          {scene === 'step_objetivos'    && <StepContent step="objetivos"    highlight onNext={advance} />}
          {scene === 'step_objeccoes'    && <StepContent step="objeccoes"    highlight onNext={advance} isLast />}
          {scene === 'done'              && <StepContent step="atendimento"  highlight={false} onNext={() => {}} />}
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
          <button onClick={() => setScene('overview')}
            className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2">
            Recomecar
          </button>
        )}
      </div>
    </div>
  )
}
