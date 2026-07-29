'use client'

import { useState, useEffect, useCallback } from 'react'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard, Users, MessageSquare, Bot, Clock,
  BarChart2, CheckCircle2, Wifi, Play, Pause, RotateCcw,
  Sparkles, ChevronRight,
} from 'lucide-react'

// ── Fake QR ───────────────────────────────────────────────────────────────────
const QR_ROWS = [
  [1,1,1,1,1,1,1,0,1,0,1,1,0,1,1,1,1,1,1],
  [1,0,0,0,0,0,1,0,0,1,0,0,1,1,0,0,0,0,1],
  [1,0,1,1,1,0,1,0,1,1,1,0,1,0,1,1,1,0,1],
  [1,0,1,1,1,0,1,0,0,0,0,1,0,1,1,1,1,0,1],
  [1,0,1,1,1,0,1,0,1,0,1,1,0,0,1,1,1,0,1],
  [1,0,0,0,0,0,1,0,0,1,1,0,1,0,0,0,0,0,1],
  [1,1,1,1,1,1,1,0,1,0,1,0,1,1,1,1,1,1,1],
  [0,0,0,0,0,0,0,0,0,1,1,0,0,1,0,0,0,0,0],
  [1,1,0,1,1,0,1,1,0,1,0,1,1,0,1,0,1,1,0],
  [0,1,1,0,0,1,0,0,1,0,0,0,1,1,0,1,0,0,1],
  [1,0,1,1,0,0,1,0,0,1,1,0,0,1,1,0,0,1,0],
  [0,0,0,0,0,0,0,0,1,0,0,1,0,0,1,1,1,0,1],
  [1,1,1,1,1,1,1,0,0,1,1,0,1,0,0,1,0,0,0],
  [1,0,0,0,0,0,1,0,1,0,0,1,0,1,1,0,1,1,0],
  [1,0,1,1,1,0,1,0,0,0,1,1,0,0,1,0,0,0,1],
  [1,0,1,1,1,0,1,0,1,1,0,0,1,1,0,1,1,0,0],
  [1,0,1,1,1,0,1,0,0,1,1,0,0,0,1,0,0,1,1],
  [1,0,0,0,0,0,1,0,1,0,0,1,1,0,0,1,0,1,0],
  [1,1,1,1,1,1,1,0,0,1,0,0,1,1,0,0,1,0,1],
]

function FakeQR({ size = 140 }: { size?: number }) {
  const cell = size / QR_ROWS.length
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {QR_ROWS.flatMap((row, r) =>
        row.map((cell_val, c) =>
          cell_val ? (
            <rect
              key={`${r}-${c}`}
              x={c * cell + 0.5}
              y={r * cell + 0.5}
              width={cell - 1}
              height={cell - 1}
              rx="0.5"
              fill="#111"
            />
          ) : null
        )
      )}
    </svg>
  )
}

// ── Cursor SVG ─────────────────────────────────────────────────────────────────
function FakeCursor({ x, y, clicking }: { x: string; y: string; clicking?: boolean }) {
  return (
    <div
      className="absolute z-40 pointer-events-none transition-all duration-700 ease-in-out"
      style={{ left: x, top: y }}
    >
      {clicking && (
        <div className="absolute -inset-3 rounded-full border-2 border-primary/50 animate-ping" />
      )}
      <svg width="18" height="22" viewBox="0 0 18 22" className="drop-shadow-md">
        <path d="M0 0L0 16L4 12L7 19L10 18L7 11L13 11Z" fill="white" stroke="#1a1a1a" strokeWidth="1.2" strokeLinejoin="round"/>
      </svg>
    </div>
  )
}

// ── Sidebar ────────────────────────────────────────────────────────────────────
const NAV = [
  { id: 'dashboard', label: 'Dashboard', Icon: LayoutDashboard },
  { id: 'crm',       label: 'CRM',       Icon: Users },
  { id: 'atendimento', label: 'Atendimento', Icon: MessageSquare },
  { id: 'sdr',       label: 'Agente SDR', Icon: Bot },
  { id: 'follow',    label: 'Follow-up',  Icon: Clock },
  { id: 'metricas',  label: 'Métricas',   Icon: BarChart2 },
] as const

function Sidebar({ active }: { active: string }) {
  return (
    <div className="w-40 shrink-0 border-r border-border/50 bg-card/80 flex flex-col h-full">
      <div className="px-3 py-3 border-b border-border/50 flex items-center gap-2">
        <div className="w-5 h-5 rounded-md bg-primary flex items-center justify-center shrink-0">
          <span className="text-[9px] font-black text-primary-foreground">Z</span>
        </div>
        <span className="text-[11px] font-bold tracking-tight">Zaapply</span>
      </div>
      <nav className="p-1.5 space-y-0.5 flex-1">
        {NAV.map(({ id, label, Icon }) => (
          <div
            key={id}
            className={cn(
              'flex items-center gap-2 px-2 py-1.5 rounded-md text-[10px] font-medium transition-all',
              active === id
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground/60 hover:text-muted-foreground'
            )}
          >
            <Icon className="w-3 h-3 shrink-0" />
            {label}
          </div>
        ))}
      </nav>
      <div className="p-2 border-t border-border/50">
        <div className="flex items-center gap-2 px-2 py-1.5">
          <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
            <span className="text-[8px] font-bold text-primary">R</span>
          </div>
          <div>
            <p className="text-[9px] font-medium leading-none">Rodrigo</p>
            <p className="text-[8px] text-muted-foreground/60 mt-0.5">Admin</p>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Screens ────────────────────────────────────────────────────────────────────
function ScreenQRIdle() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-4 p-6">
      <div className="text-center space-y-1 mb-2">
        <p className="text-sm font-semibold">Conectar WhatsApp</p>
        <p className="text-[11px] text-muted-foreground">Escaneie o código com o celular para começar</p>
      </div>
      <div className="p-3 bg-white rounded-xl border border-border/40 shadow-sm">
        <FakeQR size={120} />
        <div className="mt-2 flex justify-center">
          <div className="h-0.5 w-24 bg-emerald-400/60 rounded-full" style={{ animation: 'scan 2s ease-in-out infinite' }} />
        </div>
      </div>
      <p className="text-[10px] text-muted-foreground text-center leading-relaxed max-w-[200px]">
        WhatsApp → <strong>Aparelhos conectados</strong> → Conectar aparelho
      </p>
      <style jsx>{`@keyframes scan { 0%,100%{opacity:1;transform:translateY(-30px)} 50%{opacity:.4;transform:translateY(30px)} }`}</style>
    </div>
  )
}

function ScreenQRScanning() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-4 p-6">
      <div className="relative">
        <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
          <Wifi className="w-6 h-6 text-primary" />
        </div>
        <div className="absolute inset-0 rounded-2xl border-2 border-primary/30 animate-ping" />
      </div>
      <div className="text-center space-y-1">
        <p className="text-sm font-semibold">Aguardando confirmação</p>
        <p className="text-[11px] text-muted-foreground">Confirme no celular para continuar</p>
      </div>
      <div className="flex gap-1.5">
        {[0,1,2].map(i => (
          <div key={i} className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: `${i*0.15}s` }} />
        ))}
      </div>
    </div>
  )
}

function ScreenQRConnected() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-4 p-6">
      <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 flex items-center justify-center ring-4 ring-emerald-500/10">
        <CheckCircle2 className="w-7 h-7 text-emerald-500" />
      </div>
      <div className="text-center space-y-1">
        <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">WhatsApp conectado!</p>
        <p className="text-[11px] text-muted-foreground">+55 11 9 9999-9999</p>
      </div>
      <div className="w-full max-w-[220px] rounded-xl bg-emerald-500/8 border border-emerald-500/15 px-3 py-2 flex items-center gap-2">
        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
        <p className="text-[10px] text-emerald-700 dark:text-emerald-300 font-medium">Instância ativa · recebendo mensagens</p>
      </div>
      <div className="flex items-center gap-1.5 text-[10px] text-primary font-medium">
        <span>Próximo: configurar Agente SDR</span>
        <ChevronRight className="w-3 h-3" />
      </div>
    </div>
  )
}

function ScreenSDRPersona() {
  return (
    <div className="flex-1 flex flex-col p-5 gap-4">
      <div>
        <p className="text-xs font-semibold">Agente SDR · Configuração</p>
        <p className="text-[10px] text-muted-foreground mt-0.5">Passo 1 de 3: Persona do agente</p>
        <div className="mt-2 flex gap-1">
          {[1,2,3].map(i => (
            <div key={i} className={cn('h-1 flex-1 rounded-full', i === 1 ? 'bg-primary' : 'bg-muted')} />
          ))}
        </div>
      </div>
      <div className="space-y-3">
        <div className="space-y-1.5">
          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Nome do agente</p>
          <div className="h-8 rounded-lg border border-primary/40 bg-primary/5 px-3 flex items-center">
            <span className="text-[11px] text-foreground">Sofia</span>
            <span className="ml-0.5 w-0.5 h-3 bg-primary animate-pulse" />
          </div>
        </div>
        <div className="space-y-1.5">
          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Tom de voz</p>
          <div className="h-8 rounded-lg border border-border bg-card px-3 flex items-center justify-between">
            <span className="text-[11px] text-foreground">Profissional e amigável</span>
            <ChevronRight className="w-3 h-3 text-muted-foreground/40" />
          </div>
        </div>
        <div className="space-y-1.5">
          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Objetivo principal</p>
          <div className="h-14 rounded-lg border border-border bg-card px-3 py-2">
            <span className="text-[10px] text-muted-foreground leading-relaxed">Qualificar leads, responder dúvidas sobre planos e agendar demo com o time comercial...</span>
          </div>
        </div>
      </div>
      <button className="mt-auto w-full h-8 rounded-lg bg-primary text-primary-foreground text-[11px] font-semibold flex items-center justify-center gap-1.5">
        Continuar <ChevronRight className="w-3 h-3" />
      </button>
    </div>
  )
}

function ScreenSDRKnowledge() {
  return (
    <div className="flex-1 flex flex-col p-5 gap-4">
      <div>
        <p className="text-xs font-semibold">Agente SDR · Configuração</p>
        <p className="text-[10px] text-muted-foreground mt-0.5">Passo 2 de 3: Base de conhecimento</p>
        <div className="mt-2 flex gap-1">
          {[1,2,3].map(i => (
            <div key={i} className={cn('h-1 flex-1 rounded-full', i <= 2 ? 'bg-primary' : 'bg-muted')} />
          ))}
        </div>
      </div>
      <div className="space-y-3">
        <div className="rounded-xl border border-border bg-card p-3 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-medium">Base de produto</p>
            <div className="h-4 w-7 rounded-full bg-primary flex items-center justify-end px-0.5">
              <div className="w-3 h-3 rounded-full bg-white" />
            </div>
          </div>
          <div className="rounded-lg bg-emerald-500/8 border border-emerald-500/15 px-2.5 py-1.5 flex items-center gap-2">
            <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" />
            <p className="text-[10px] text-emerald-700 dark:text-emerald-300 font-medium">Configurada · 24 chunks salvos</p>
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card p-3 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-medium">Base de objeções</p>
            <div className="h-4 w-7 rounded-full bg-muted flex items-center px-0.5">
              <div className="w-3 h-3 rounded-full bg-white border border-border" />
            </div>
          </div>
          <div className="rounded-lg bg-amber-500/8 border border-amber-500/15 px-2.5 py-1.5 flex items-center gap-2">
            <div className="w-3 h-3 rounded-full border border-amber-400 shrink-0" />
            <p className="text-[10px] text-amber-700 font-medium">Não configurada</p>
          </div>
        </div>
      </div>
      <button className="mt-auto w-full h-8 rounded-lg bg-primary text-primary-foreground text-[11px] font-semibold flex items-center justify-center gap-1.5">
        Continuar <ChevronRight className="w-3 h-3" />
      </button>
    </div>
  )
}

function ScreenSDRActive() {
  return (
    <div className="flex-1 flex flex-col p-5 gap-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold">Agente SDR</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">Sofia · Ativo</p>
        </div>
        <div className="flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-2.5 py-1">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">Ativo</span>
        </div>
      </div>

      <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 flex flex-col items-center gap-3">
        <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center">
          <Sparkles className="w-6 h-6 text-emerald-500" />
        </div>
        <div className="text-center">
          <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">Agente configurado!</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">Respondendo leads automaticamente</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {[
          { label: 'Leads atendidos', value: '0' },
          { label: 'Taxa de resposta', value: '—' },
          { label: 'Agendamentos', value: '0' },
          { label: 'Em andamento', value: '0' },
        ].map(({ label, value }) => (
          <div key={label} className="rounded-lg border border-border bg-card p-2.5 text-center">
            <p className="text-sm font-bold">{value}</p>
            <p className="text-[9px] text-muted-foreground mt-0.5">{label}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Step config ────────────────────────────────────────────────────────────────
interface StepDef {
  id: string
  label: string
  sublabel: string
  duration: number
  nav: string
  screen: 'qr_idle' | 'qr_scanning' | 'qr_connected' | 'sdr_persona' | 'sdr_knowledge' | 'sdr_active'
  cursor: { x: string; y: string }
  clicking?: boolean
}

const STEPS: StepDef[] = [
  {
    id: 'nav_atendimento',
    label: 'Passo 1',
    sublabel: 'Acessando Atendimento...',
    duration: 1600,
    nav: 'atendimento',
    screen: 'qr_idle',
    cursor: { x: '13%', y: '36%' },
    clicking: true,
  },
  {
    id: 'qr_idle',
    label: 'Passo 1',
    sublabel: 'Escaneie o QR code com o WhatsApp',
    duration: 2500,
    nav: 'atendimento',
    screen: 'qr_idle',
    cursor: { x: '55%', y: '52%' },
  },
  {
    id: 'qr_scanning',
    label: 'Passo 1',
    sublabel: 'Aguardando confirmação no celular...',
    duration: 2200,
    nav: 'atendimento',
    screen: 'qr_scanning',
    cursor: { x: '55%', y: '48%' },
  },
  {
    id: 'qr_connected',
    label: 'Passo 1 ✓',
    sublabel: 'WhatsApp conectado com sucesso!',
    duration: 2500,
    nav: 'atendimento',
    screen: 'qr_connected',
    cursor: { x: '55%', y: '44%' },
  },
  {
    id: 'nav_sdr',
    label: 'Passo 2',
    sublabel: 'Acessando Agente SDR...',
    duration: 1600,
    nav: 'sdr',
    screen: 'sdr_persona',
    cursor: { x: '13%', y: '42%' },
    clicking: true,
  },
  {
    id: 'sdr_persona',
    label: 'Passo 2',
    sublabel: 'Configurando a persona do agente',
    duration: 3000,
    nav: 'sdr',
    screen: 'sdr_persona',
    cursor: { x: '64%', y: '50%' },
  },
  {
    id: 'sdr_knowledge',
    label: 'Passo 2',
    sublabel: 'Adicionando base de conhecimento',
    duration: 3000,
    nav: 'sdr',
    screen: 'sdr_knowledge',
    cursor: { x: '64%', y: '57%' },
  },
  {
    id: 'sdr_active',
    label: 'Passo 2 ✓',
    sublabel: 'Agente SDR ativo e respondendo leads!',
    duration: 3500,
    nav: 'sdr',
    screen: 'sdr_active',
    cursor: { x: '64%', y: '38%' },
  },
]

const SCREEN_MAP = {
  qr_idle: <ScreenQRIdle />,
  qr_scanning: <ScreenQRScanning />,
  qr_connected: <ScreenQRConnected />,
  sdr_persona: <ScreenSDRPersona />,
  sdr_knowledge: <ScreenSDRKnowledge />,
  sdr_active: <ScreenSDRActive />,
}

// ── Main component ─────────────────────────────────────────────────────────────
export function SetupFlowDemo({ className }: { className?: string }) {
  const [idx, setIdx] = useState(0)
  const [playing, setPlaying] = useState(true)

  const step = STEPS[idx]
  const total = STEPS.length

  const next = useCallback(() => setIdx(i => (i + 1) % total), [total])
  const prev = useCallback(() => setIdx(i => (i - 1 + total) % total), [total])
  const reset = useCallback(() => { setIdx(0); setPlaying(true) }, [])

  useEffect(() => {
    if (!playing) return
    const t = setTimeout(next, step.duration)
    return () => clearTimeout(t)
  }, [idx, playing, next, step.duration])

  return (
    <div className={cn('rounded-2xl border border-border overflow-hidden shadow-2xl bg-background', className)}>

      {/* Browser chrome */}
      <div className="bg-muted/60 border-b border-border px-4 py-2.5 flex items-center gap-3">
        <div className="flex gap-1.5 shrink-0">
          <div className="w-3 h-3 rounded-full bg-red-400/70" />
          <div className="w-3 h-3 rounded-full bg-amber-400/70" />
          <div className="w-3 h-3 rounded-full bg-emerald-400/70" />
        </div>
        <div className="flex-1 bg-background/80 rounded-md px-3 py-1 text-[11px] text-muted-foreground font-mono border border-border/40">
          app.zaapply.com.br/{step.nav === 'atendimento' ? 'atendimento' : 'configuracoes/sdr'}
        </div>
        <button
          onClick={() => setPlaying(p => !p)}
          className="shrink-0 text-muted-foreground hover:text-foreground transition-colors p-1 rounded-md hover:bg-muted"
        >
          {playing
            ? <Pause className="w-3.5 h-3.5" />
            : <Play className="w-3.5 h-3.5" />
          }
        </button>
      </div>

      {/* App shell */}
      <div className="relative flex" style={{ height: '360px' }}>
        <Sidebar active={step.nav} />

        {/* Content area */}
        <div className="flex-1 relative overflow-hidden bg-background">
          <div
            key={step.screen}
            className="absolute inset-0 flex flex-col animate-in fade-in duration-300"
          >
            {SCREEN_MAP[step.screen]}
          </div>
        </div>

        {/* Floating cursor */}
        <FakeCursor x={step.cursor.x} y={step.cursor.y} clicking={step.clicking} />
      </div>

      {/* Controls */}
      <div className="border-t border-border bg-muted/30 px-4 py-3 flex items-center gap-4">
        {/* Progress dots */}
        <div className="flex gap-1.5 shrink-0">
          {STEPS.map((_, i) => (
            <button
              key={i}
              onClick={() => { setIdx(i); setPlaying(false) }}
              className={cn(
                'rounded-full transition-all duration-300',
                i === idx
                  ? 'w-5 h-1.5 bg-primary'
                  : i < idx
                  ? 'w-1.5 h-1.5 bg-primary/40'
                  : 'w-1.5 h-1.5 bg-muted-foreground/20'
              )}
            />
          ))}
        </div>

        {/* Label */}
        <div className="flex-1 min-w-0">
          <span className="text-[10px] font-semibold text-primary mr-1.5">{step.label}</span>
          <span className="text-[11px] text-muted-foreground truncate">{step.sublabel}</span>
        </div>

        {/* Buttons */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={prev}
            className="h-6 px-2 rounded-md border border-border text-[10px] text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            ←
          </button>
          <button
            onClick={next}
            className="h-6 px-2 rounded-md border border-border text-[10px] text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            →
          </button>
          <button
            onClick={reset}
            className="h-6 px-2 rounded-md border border-border text-[10px] text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <RotateCcw className="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  )
}
