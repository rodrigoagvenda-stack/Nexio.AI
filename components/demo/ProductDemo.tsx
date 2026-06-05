'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import {
  TrendingUp, PieChart, MessageCircle, UserCog,
  Sparkles, LifeBuoy, Settings, Bot, Brain, Link2,
  Megaphone, Loader2, CheckCircle2, Wifi, Save,
  MessageSquare, Calendar, Zap, RotateCcw, BookOpen,
  ShieldAlert, ChevronDown,
} from 'lucide-react'

// ── Real Zaapply SVG icon ─────────────────────────────────────────────────────
function ZaapliIcon({ size = 26 }: { size?: number }) {
  const w = size * (208 / 235)
  return (
    <svg width={w} height={size} viewBox="0 0 208 235" fill="none">
      <path d="M207.65 103.853C207.65 104.953 207.65 106.063 207.59 107.143V107.213C207.562 120.28 205.556 133.267 201.64 145.733C194.543 167.855 181.706 187.699 164.44 203.243C146.982 218.999 125.668 229.859 102.66 234.723V207.653C82.1745 207.423 62.2151 201.137 45.2943 189.587C28.3736 178.037 15.2477 161.74 7.56905 142.747C-0.109597 123.753 -1.99782 102.913 2.14207 82.8485C6.28195 62.7843 16.2649 44.3933 30.8343 29.9904C45.4037 15.5875 63.9083 5.81663 84.0187 1.90763C104.129 -2.00137 124.946 0.126266 143.85 8.02272C162.754 15.9192 178.9 29.2315 190.254 46.2839C201.609 63.3363 207.665 83.3666 207.66 103.853H207.65Z" fill="#369E47"/>
      <path d="M82.5917 152.783C77.2584 152.783 73.3551 151.533 70.8817 149.033C69.6593 147.837 68.6957 146.402 68.0506 144.818C67.4056 143.233 67.0928 141.534 67.1317 139.823C67.2062 136.582 67.9519 133.392 69.3217 130.453C70.8962 126.943 73.1222 123.764 75.8817 121.083L110.712 84.6934H76.5917C75.2672 84.6934 73.9556 84.4324 72.732 83.9252C71.5084 83.418 70.3967 82.6746 69.4605 81.7375C68.5244 80.8005 67.7821 79.6881 67.2761 78.464C66.7702 77.2398 66.5104 75.928 66.5117 74.6034C66.5117 71.7285 67.6538 68.9713 69.6867 66.9384C71.7196 64.9055 74.4768 63.7634 77.3517 63.7634H125.082C130.915 63.7634 135.132 65.0101 137.732 67.5034C138.968 68.6341 139.953 70.011 140.625 71.5456C141.297 73.0801 141.64 74.7383 141.632 76.4134C141.632 81.7468 139.395 86.9001 134.922 91.8734L97.9217 131.873H129.922C132.799 131.873 135.559 133.017 137.594 135.051C139.629 137.086 140.772 139.846 140.772 142.723C140.769 144.054 140.503 145.371 139.989 146.598C139.475 147.825 138.723 148.938 137.777 149.874C136.831 150.809 135.708 151.548 134.475 152.047C133.242 152.546 131.922 152.797 130.592 152.783H82.5917Z" fill="white"/>
    </svg>
  )
}

// ── Fake QR (19×19) ───────────────────────────────────────────────────────────
const QR = [
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

function FakeQR({ size = 200 }: { size?: number }) {
  const c = size / QR.length
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="block">
      {QR.flatMap((row, r) =>
        row.map((v, col) => v ? (
          <rect key={`${r}-${col}`} x={col*c+.3} y={r*c+.3} width={c-.6} height={c-.6} rx=".4" fill="#111"/>
        ) : null)
      )}
    </svg>
  )
}

// ── Sentry-style Hotspot ──────────────────────────────────────────────────────
function Hotspot({
  children, label, onClick, side = 'top', minW = 240,
}: {
  children: React.ReactNode
  label: string
  onClick: () => void
  side?: 'top' | 'right' | 'bottom' | 'left'
  minW?: number
}) {
  return (
    <div className="relative inline-block cursor-pointer" onClick={onClick}>
      {/* Glow ring */}
      <div className="absolute -inset-1.5 rounded-lg ring-2 ring-primary shadow-[0_0_12px_2px_rgba(54,158,71,0.3)] pointer-events-none z-10 animate-pulse" />

      {/* Tooltip — top */}
      {side === 'top' && (
        <div className="absolute bottom-[calc(100%+10px)] left-1/2 -translate-x-1/2 z-50 pointer-events-none" style={{ minWidth: minW }}>
          <div className="bg-[#1c1c1e] text-white text-[13px] font-medium px-4 py-2.5 rounded-xl shadow-2xl leading-snug">
            {label}
          </div>
          <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-[7px] border-r-[7px] border-t-[8px] border-l-transparent border-r-transparent border-t-[#1c1c1e]" />
        </div>
      )}

      {/* Tooltip — bottom */}
      {side === 'bottom' && (
        <div className="absolute top-[calc(100%+10px)] left-1/2 -translate-x-1/2 z-50 pointer-events-none" style={{ minWidth: minW }}>
          <div className="bg-[#1c1c1e] text-white text-[13px] font-medium px-4 py-2.5 rounded-xl shadow-2xl leading-snug">
            {label}
          </div>
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-[7px] border-r-[7px] border-b-[8px] border-l-transparent border-r-transparent border-b-[#1c1c1e]" />
        </div>
      )}

      {/* Tooltip — right */}
      {side === 'right' && (
        <div className="absolute left-[calc(100%+10px)] top-1/2 -translate-y-1/2 z-50 pointer-events-none" style={{ minWidth: minW }}>
          <div className="bg-[#1c1c1e] text-white text-[13px] font-medium px-4 py-2.5 rounded-xl shadow-2xl leading-snug">
            {label}
          </div>
          <div className="absolute right-full top-1/2 -translate-y-1/2 w-0 h-0 border-t-[7px] border-b-[7px] border-r-[8px] border-t-transparent border-b-transparent border-r-[#1c1c1e]" />
        </div>
      )}

      {children}
    </div>
  )
}

// ── Main sidebar (exact replica from Sidebar.tsx) ─────────────────────────────
const NAV_SECTIONS = [
  { label: 'Principal',    items: [{ id: 'dashboard', label: 'Dashboard',   Icon: TrendingUp }] },
  { label: 'Ferramentas',  items: [
    { id: 'crm',         label: 'CRM',          Icon: PieChart },
    { id: 'atendimento', label: 'Atendimento',  Icon: MessageCircle },
    { id: 'automacoes',  label: 'Automações',   Icon: Megaphone },
  ]},
  { label: 'Gestão',       items: [{ id: 'membros', label: 'Membros', Icon: UserCog }] },
  { label: 'Sistema',      items: [
    { id: 'novidades',     label: 'Novidades',   Icon: Sparkles },
    { id: 'ajuda',         label: 'Ajuda',        Icon: LifeBuoy },
    { id: 'configuracoes', label: 'Configuração', Icon: Settings },
  ]},
] as const

function FakeSidebar({ active, navHotspot, onNav }: {
  active: string
  navHotspot: string | null
  onNav: (id: string) => void
}) {
  return (
    <aside className="w-56 shrink-0 flex flex-col bg-card border-r border-border h-full overflow-hidden">
      {/* Logo */}
      <div className="flex items-center h-14 border-b border-border/50 px-4 gap-2 flex-shrink-0">
        <ZaapliIcon size={26} />
        <span className="font-extrabold tracking-tight text-[#0d0d0d] dark:text-white leading-none select-none"
          style={{ fontSize: 18, fontFamily: "'Nunito','Poppins',sans-serif", letterSpacing: '-0.01em' }}>
          zaapply
        </span>
      </div>
      {/* Nav */}
      <div className="flex-1 px-3 pt-3 space-y-3 overflow-y-auto">
        {NAV_SECTIONS.map(({ label, items }) => (
          <div key={label}>
            <p className="px-3 mb-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">{label}</p>
            <div className="space-y-0.5">
              {items.map(({ id, label: lbl, Icon }) => {
                const isActive   = active === id
                const isHotspot  = navHotspot === id
                return (
                  <div key={id} className="relative">
                    {isHotspot && (
                      <div className="absolute inset-0 rounded-lg ring-2 ring-primary shadow-[0_0_10px_2px_rgba(54,158,71,0.3)] pointer-events-none z-10 animate-pulse" />
                    )}
                    {isHotspot && (
                      <div className="absolute left-[calc(100%+10px)] top-1/2 -translate-y-1/2 z-50 pointer-events-none" style={{ minWidth: 260 }}>
                        <div className="bg-[#1c1c1e] text-white text-[13px] font-medium px-4 py-2.5 rounded-xl shadow-2xl leading-snug">
                          Agora configure o Agente SDR — clique em Automações
                        </div>
                        <div className="absolute right-full top-1/2 -translate-y-1/2 w-0 h-0 border-t-[7px] border-b-[7px] border-r-[8px] border-t-transparent border-b-transparent border-r-[#1c1c1e]" />
                      </div>
                    )}
                    <button onClick={() => isHotspot && onNav(id)}
                      className={cn(
                        'relative w-full group flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors duration-100 text-left',
                        isActive ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-accent/50',
                        isHotspot && 'cursor-pointer'
                      )}>
                      <Icon className="h-4 w-4 flex-shrink-0" />
                      <span className="text-sm flex-1 text-left">{lbl}</span>
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
      {/* Footer */}
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

// ── Atendimento: WhatsApp QR screen (exact replica) ───────────────────────────
type QRState = 'idle' | 'generating' | 'qr_shown' | 'scanning' | 'connected'

function ScreenAtendimento({ qrState, onGerarQR, onScanQR }: {
  qrState: QRState
  onGerarQR: () => void
  onScanQR: () => void
}) {
  if (qrState === 'connected') {
    return (
      <div className="h-full w-full flex flex-col items-center justify-center bg-[#f0f2f5] dark:bg-background">
        <div className="bg-white dark:bg-card rounded-2xl shadow-sm border border-border p-10 flex flex-col items-center gap-5 mx-4">
          <div className="w-16 h-16 rounded-2xl bg-green-500/10 flex items-center justify-center ring-4 ring-green-500/10">
            <CheckCircle2 className="w-8 h-8 text-green-500" />
          </div>
          <div className="text-center">
            <h2 className="text-xl font-light text-foreground">WhatsApp conectado!</h2>
            <p className="text-sm text-muted-foreground mt-1">+55 11 9 9999-9999 · Instância ativa</p>
          </div>
          <div className="flex items-center gap-1.5 text-sm font-medium text-green-700 dark:text-green-400 bg-green-500/10 border border-green-500/20 px-4 py-2 rounded-full">
            <Wifi className="h-4 w-4" /> Recebendo mensagens
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full w-full flex items-center justify-center bg-[#f0f2f5] dark:bg-background overflow-auto p-4">
      <div className="w-full max-w-2xl">
        <div className="bg-white dark:bg-card rounded-2xl shadow-sm border border-border overflow-hidden">
          <div className="flex">
            {/* Left — instructions */}
            <div className="flex-1 p-8 flex flex-col gap-6">
              <div>
                <h1 className="text-2xl font-light text-foreground mb-1">Use o WhatsApp no computador</h1>
                <p className="text-sm text-muted-foreground">Conecte seu número para começar a atender conversas</p>
              </div>
              <ol className="space-y-4">
                {[
                  'Abra o WhatsApp no seu celular',
                  'Toque em Mais opções → Aparelhos conectados',
                  'Toque em Conectar um aparelho',
                  'Aponte o celular para esta tela para capturar o QR code',
                ].map((step, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span className="w-6 h-6 rounded-full border-2 border-muted-foreground/40 text-xs font-medium text-muted-foreground flex items-center justify-center shrink-0 mt-0.5">
                      {i + 1}
                    </span>
                    <span className="text-sm text-foreground">{step}</span>
                  </li>
                ))}
              </ol>
              <div>
                {qrState === 'idle' && (
                  <Hotspot
                    label="Clique em Gerar novo QR Code para iniciar a conexão"
                    onClick={onGerarQR}
                    side="top"
                    minW={300}
                  >
                    <button className="text-sm text-primary underline underline-offset-4 hover:opacity-70 transition-opacity text-left">
                      Gerar novo QR Code
                    </button>
                  </Hotspot>
                )}
                {(qrState !== 'idle') && (
                  <button disabled className="text-sm text-primary underline underline-offset-4 opacity-40 text-left">
                    {qrState === 'generating' ? 'Gerando QR Code…' : 'Gerar novo QR Code'}
                  </button>
                )}
              </div>
            </div>

            {/* Right — QR area */}
            <div className="flex items-center justify-center p-8 bg-muted/30 border-l border-border min-h-[300px] min-w-[260px]">
              {qrState === 'idle' && (
                <div className="w-[200px] h-[200px] bg-muted rounded-xl" />
              )}
              {qrState === 'generating' && (
                <div className="flex flex-col items-center gap-3">
                  <div className="w-[200px] h-[200px] bg-muted rounded-xl flex items-center justify-center">
                    <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                  </div>
                  <p className="text-xs text-muted-foreground">Gerando QR Code…</p>
                </div>
              )}
              {qrState === 'qr_shown' && (
                <Hotspot
                  label="Clique no QR Code para simular o escaneamento com o celular"
                  onClick={onScanQR}
                  side="top"
                  minW={300}
                >
                  <div className="flex flex-col items-center gap-3">
                    <div className="p-3 bg-white rounded-xl shadow-sm border">
                      <FakeQR size={200} />
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      Aguardando leitura…
                    </div>
                  </div>
                </Hotspot>
              )}
              {qrState === 'scanning' && (
                <div className="flex flex-col items-center gap-3">
                  <div className="p-3 bg-white rounded-xl shadow-sm border">
                    <FakeQR size={200} />
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Aguardando confirmação…
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
        <p className="text-center text-xs text-muted-foreground mt-3">
          🔒 Suas mensagens são protegidas com criptografia de ponta a ponta
        </p>
      </div>
    </div>
  )
}

// ── SDR screen ────────────────────────────────────────────────────────────────
const SDR_TABS = [
  { id: 'geral',        label: 'Geral',         Icon: Settings },
  { id: 'identidade',   label: 'Identidade',    Icon: Bot },
  { id: 'conhecimento', label: 'Conhecimento',  Icon: Brain },
  { id: 'integracoes',  label: 'Integrações',   Icon: Link2 },
] as const

type SdrTab = typeof SDR_TABS[number]['id']
type SdrHotspot =
  | 'tipo_agendamento'
  | 'tab_identidade'
  | 'tab_conhecimento'
  | 'tab_integracoes'
  | 'tab_geral'
  | 'switch_ativo'
  | null

function SdrTabButton({ id, label, Icon, active, hotspot, onClick }: {
  id: string; label: string; Icon: React.FC<{className?:string}>
  active: boolean; hotspot: boolean; onClick: () => void
}) {
  return (
    <div className="relative">
      {hotspot && (
        <div className="absolute inset-0 rounded-xl ring-2 ring-primary shadow-[0_0_10px_2px_rgba(54,158,71,0.25)] pointer-events-none z-10 animate-pulse" />
      )}
      <button onClick={onClick}
        className={cn(
          'w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm transition-colors text-left',
          active ? 'bg-primary/10 text-primary font-medium' : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
        )}>
        <Icon className={cn('w-4 h-4 shrink-0', active ? 'text-primary' : 'text-muted-foreground')} />
        {label}
      </button>
    </div>
  )
}

function FakeInput({ label, value, placeholder }: { label: string; value?: string; placeholder?: string }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      <div className={cn(
        'w-full h-9 px-3 rounded-lg border text-sm flex items-center',
        value ? 'border-input bg-background text-foreground' : 'border-input bg-background text-muted-foreground/50'
      )}>
        {value || placeholder}
      </div>
    </div>
  )
}

function ScreenSDR({ activeTab, selectedTipo, agenteAtivo, hotspot, onHotspot }: {
  activeTab: SdrTab
  selectedTipo: boolean
  agenteAtivo: boolean
  hotspot: SdrHotspot
  onHotspot: () => void
}) {
  return (
    <div className="h-full w-full overflow-auto">
      <div className="max-w-5xl mx-auto p-6 pb-8">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Agente SDR</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Atendimento automático via WhatsApp</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border bg-green-500/10 text-green-700 border-green-500/30 dark:text-green-400">
              <Wifi className="w-3 h-3" /> +55 11 9 9999-9999
            </div>
            <button className="flex items-center gap-1.5 h-8 px-3 rounded-md bg-primary text-primary-foreground text-sm font-medium">
              <Save className="w-3.5 h-3.5" /> Salvar
            </button>
          </div>
        </div>

        <div className="flex gap-6">
          {/* Tab aside */}
          <aside className="w-44 shrink-0 space-y-1">
            <button className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs text-primary bg-primary/5 hover:bg-primary/10 mb-2 border border-primary/20 text-left">
              <Sparkles className="w-3.5 h-3.5 shrink-0" /> Config. Rápida
            </button>
            {SDR_TABS.map(({ id, label, Icon }) => (
              <div key={id} className="relative">
                {hotspot === `tab_${id}` && (
                  <>
                    <div className="absolute inset-0 rounded-xl ring-2 ring-primary shadow-[0_0_10px_2px_rgba(54,158,71,0.25)] pointer-events-none z-10 animate-pulse" />
                    <div className="absolute left-[calc(100%+12px)] top-1/2 -translate-y-1/2 z-50 pointer-events-none" style={{ minWidth: 260 }}>
                      <div className="bg-[#1c1c1e] text-white text-[13px] font-medium px-4 py-2.5 rounded-xl shadow-2xl leading-snug">
                        {id === 'identidade'   && 'Configure a persona do agente — nome, tom de voz e produto'}
                        {id === 'conhecimento' && 'Adicione a base de conhecimento e de objeções'}
                        {id === 'integracoes'  && 'Conecte o Google Calendar para agendar reuniões'}
                        {id === 'geral'        && 'Volte ao Geral para ativar o agente SDR'}
                      </div>
                      <div className="absolute right-full top-1/2 -translate-y-1/2 w-0 h-0 border-t-[7px] border-b-[7px] border-r-[8px] border-t-transparent border-b-transparent border-r-[#1c1c1e]" />
                    </div>
                  </>
                )}
                <button
                  onClick={() => hotspot === `tab_${id}` ? onHotspot() : undefined}
                  className={cn(
                    'w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm transition-colors text-left',
                    activeTab === id ? 'bg-primary/10 text-primary font-medium' : 'text-muted-foreground hover:text-foreground hover:bg-muted/50',
                    hotspot === `tab_${id}` && 'cursor-pointer'
                  )}>
                  <Icon className={cn('w-4 h-4 shrink-0', activeTab === id ? 'text-primary' : 'text-muted-foreground')} />
                  {label}
                </button>
              </div>
            ))}
          </aside>

          {/* Tab content */}
          <div className="flex-1 min-w-0">

            {/* ── Geral ── */}
            {activeTab === 'geral' && (
              <div className="space-y-5">
                {/* Agente ativo */}
                <div className="relative">
                  {hotspot === 'switch_ativo' && (
                    <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-[calc(100%+12px)] z-50 pointer-events-none" style={{ minWidth: 280 }}>
                      <div className="bg-[#1c1c1e] text-white text-[13px] font-medium px-4 py-2.5 rounded-xl shadow-2xl leading-snug">
                        Tudo configurado! Ative o Agente SDR para começar a responder leads automaticamente
                      </div>
                      <div className="absolute right-full top-1/2 -translate-y-1/2 w-0 h-0 border-t-[7px] border-b-[7px] border-r-[8px] border-t-transparent border-b-transparent border-r-[#1c1c1e]" />
                    </div>
                  )}
                  {hotspot === 'switch_ativo' && (
                    <div className="absolute inset-0 rounded-xl ring-2 ring-primary shadow-[0_0_12px_3px_rgba(54,158,71,0.3)] pointer-events-none z-10 animate-pulse" />
                  )}
                  <div
                    onClick={() => hotspot === 'switch_ativo' ? onHotspot() : undefined}
                    className={cn(
                      'flex items-center justify-between gap-4 p-4 rounded-xl border transition-colors',
                      agenteAtivo ? 'bg-primary/5 border-primary/30' : 'bg-muted/30 border-border',
                      hotspot === 'switch_ativo' && 'cursor-pointer'
                    )}>
                    <div className="flex items-center gap-3">
                      <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center shrink-0', agenteAtivo ? 'bg-primary/15' : 'bg-muted')}>
                        <Zap className={cn('w-4 h-4', agenteAtivo ? 'text-primary' : 'text-muted-foreground')} />
                      </div>
                      <div>
                        <p className="text-sm font-medium">Agente ativo</p>
                        <p className="text-xs text-muted-foreground">{agenteAtivo ? 'Respondendo automaticamente' : 'Ative para responder automaticamente'}</p>
                      </div>
                    </div>
                    <div className={cn('relative w-10 h-5 rounded-full transition-colors duration-200 flex-shrink-0', agenteAtivo ? 'bg-primary' : 'bg-muted-foreground/30')}>
                      <div className={cn('absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200', agenteAtivo ? 'translate-x-5' : 'translate-x-0.5')} />
                    </div>
                  </div>
                </div>

                {/* Tipo de agente */}
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-2">Tipo de agente</p>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { value: 'atendimento_venda',              label: 'Atendimento + Venda',  desc: 'Responde dúvidas e conduz para a venda', Icon: MessageSquare },
                      { value: 'atendimento_venda_agendamento',  label: '+ Agendamento',        desc: 'Inclui agendamento via Google Calendar', Icon: Calendar },
                    ].map(({ value, label, desc, Icon: TIcon }) => {
                      const sel = selectedTipo ? value === 'atendimento_venda_agendamento' : value === 'atendimento_venda'
                      const isHotspot = hotspot === 'tipo_agendamento' && value === 'atendimento_venda_agendamento'
                      return (
                        <div key={value} className="relative">
                          {isHotspot && (
                            <div className="absolute inset-0 rounded-xl ring-2 ring-primary shadow-[0_0_12px_3px_rgba(54,158,71,0.3)] pointer-events-none z-10 animate-pulse" />
                          )}
                          {isHotspot && (
                            <div className="absolute bottom-[calc(100%+10px)] left-1/2 -translate-x-1/2 z-50 pointer-events-none" style={{ minWidth: 280 }}>
                              <div className="bg-[#1c1c1e] text-white text-[13px] font-medium px-4 py-2.5 rounded-xl shadow-2xl leading-snug">
                                Selecione "+ Agendamento" para incluir agendamentos via Google Calendar
                              </div>
                              <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-[7px] border-r-[7px] border-t-[8px] border-l-transparent border-r-transparent border-t-[#1c1c1e]" />
                            </div>
                          )}
                          <div
                            onClick={() => isHotspot ? onHotspot() : undefined}
                            className={cn(
                              'p-3 rounded-xl border-2 transition-all text-left',
                              sel ? 'border-primary bg-primary/5' : 'border-border bg-card',
                              isHotspot && 'cursor-pointer'
                            )}>
                            <div className="flex items-center gap-2 mb-1">
                              <TIcon className={cn('w-4 h-4', sel ? 'text-primary' : 'text-muted-foreground')} />
                              <span className={cn('text-sm font-medium', sel ? 'text-primary' : 'text-foreground')}>{label}</span>
                            </div>
                            <p className="text-xs text-muted-foreground">{desc}</p>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Modo inbox */}
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-2">Modo de atendimento</p>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { v: 'suporte', l: 'Suporte', d: 'Inbox compartilhado — qualquer atendente pode pegar' },
                      { v: 'vendas',  l: 'Vendas',  d: 'Distribui automaticamente entre os atendentes (round-robin)' },
                    ].map(({ v, l, d }) => (
                      <div key={v} className={cn('p-3 rounded-xl border text-left', v === 'suporte' ? 'border-primary bg-primary/5' : 'border-border')}>
                        <p className={cn('text-xs font-semibold', v === 'suporte' ? 'text-primary' : 'text-foreground')}>{l}</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">{d}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ── Identidade ── */}
            {activeTab === 'identidade' && (
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Nicho</label>
                  <button className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-input bg-background text-sm text-foreground">
                    <span className="flex items-center gap-2"><MessageSquare className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />SaaS</span>
                    <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
                  </button>
                </div>
                <FakeInput label="Nome do agente" value="Sofia" />
                <FakeInput label="Nome da empresa" value="StartupX" />
                <FakeInput label="Produto / Serviço" value="Plataforma SaaS de vendas com inteligência artificial" />
                <FakeInput label="Tom de voz" value="Profissional e amigável, consultivo" />
                <FakeInput label="Horário de atendimento" value="Seg a Sex, das 8h às 18h" placeholder="Ex: Seg a Sex das 9h às 18h" />
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">O que nunca dizer</label>
                  <div className="w-full min-h-[72px] px-3 py-2 rounded-lg border border-input bg-background text-sm text-muted-foreground/70">
                    Não mencione concorrentes. Não forneça preços sem entender a necessidade.
                  </div>
                </div>
              </div>
            )}

            {/* ── Conhecimento ── */}
            {activeTab === 'conhecimento' && (
              <div className="flex gap-4" style={{ height: 380 }}>
                <div className="w-[340px] shrink-0 overflow-y-auto pr-2 space-y-5">
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <BookOpen className="w-3.5 h-3.5 text-muted-foreground" />
                      <p className="text-sm font-semibold">Base de conhecimento</p>
                    </div>
                    <div className="space-y-2.5">
                      <div className="rounded-xl border border-border bg-card p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-medium">Ativa</p>
                          <div className="relative w-8 h-4 rounded-full bg-primary flex items-center justify-end px-0.5">
                            <div className="w-3 h-3 rounded-full bg-white" />
                          </div>
                        </div>
                        <div className="rounded-lg bg-green-500/8 border border-green-500/15 px-2.5 py-1.5 flex items-center gap-2">
                          <CheckCircle2 className="w-3 h-3 text-green-500 shrink-0" />
                          <p className="text-[10px] text-green-700 dark:text-green-300 font-medium">5 documentos indexados · 142 chunks</p>
                        </div>
                      </div>
                      <div className="rounded-lg border border-dashed border-border/60 bg-muted/30 px-3 py-4 text-center">
                        <p className="text-xs text-muted-foreground">+ Adicionar URL ou documento</p>
                      </div>
                    </div>
                  </div>
                  <div className="border-t border-border/60 pt-4">
                    <div className="flex items-center gap-2 mb-3">
                      <ShieldAlert className="w-3.5 h-3.5 text-muted-foreground" />
                      <p className="text-sm font-semibold">Base de objeções</p>
                    </div>
                    <div className="space-y-2.5">
                      <div className="rounded-xl border border-border bg-card p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-medium">Ativa</p>
                          <div className="relative w-8 h-4 rounded-full bg-primary flex items-center justify-end px-0.5">
                            <div className="w-3 h-3 rounded-full bg-white" />
                          </div>
                        </div>
                        <div className="rounded-lg bg-green-500/8 border border-green-500/15 px-2.5 py-1.5 flex items-center gap-2">
                          <CheckCircle2 className="w-3 h-3 text-green-500 shrink-0" />
                          <p className="text-[10px] text-green-700 dark:text-green-300 font-medium">Configurada · 8 objeções cadastradas</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                {/* Simulator preview */}
                <div className="flex-1 rounded-xl border border-border overflow-hidden flex flex-col">
                  <div className="px-4 py-2.5 border-b border-border bg-muted/30 flex items-center gap-2">
                    <Bot className="w-3.5 h-3.5 text-primary" />
                    <p className="text-xs font-semibold">Simulador de Conversa</p>
                  </div>
                  <div className="flex-1 p-4 space-y-3 bg-muted/10">
                    <div className="flex items-end gap-2">
                      <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0"><Bot className="w-3 h-3 text-primary" /></div>
                      <div className="rounded-2xl rounded-tl-none bg-card border border-border/60 px-3 py-2 text-xs max-w-[75%]">
                        Olá! Sou a Sofia da StartupX. Como posso te ajudar hoje? 😊
                      </div>
                    </div>
                    <div className="flex justify-end">
                      <div className="rounded-2xl rounded-tr-none bg-emerald-600 text-white px-3 py-2 text-xs max-w-[75%]">
                        Quero saber mais sobre os planos
                      </div>
                    </div>
                    <div className="flex items-end gap-2">
                      <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0"><Bot className="w-3 h-3 text-primary" /></div>
                      <div className="rounded-2xl rounded-tl-none bg-card border border-border/60 px-3 py-2 text-xs max-w-[75%]">
                        Claro! Temos 3 planos. Qual o tamanho da sua equipe?
                      </div>
                    </div>
                  </div>
                  <div className="border-t border-border px-3 py-2 flex items-center gap-2">
                    <div className="flex-1 h-8 rounded-lg border border-border bg-background px-3 text-xs text-muted-foreground flex items-center">
                      Digite como um lead…
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ── Integrações ── */}
            {activeTab === 'integracoes' && (
              <div className="space-y-5">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                    <p className="text-sm font-semibold">Google Calendar</p>
                  </div>
                  <p className="text-xs text-muted-foreground mb-3">Calendário usado pelo agente para agendar reuniões automaticamente</p>
                  <div className="space-y-3">
                    <div className="rounded-xl border border-green-500/20 bg-green-500/5 p-4 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center">
                          <Calendar className="w-4 h-4 text-red-500" />
                        </div>
                        <div>
                          <p className="text-sm font-medium">Google Calendar</p>
                          <p className="text-xs text-muted-foreground">contato@startupx.com</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-green-700 dark:text-green-400 font-medium">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Conectado
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-muted-foreground">Calendário selecionado</label>
                      <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-input bg-background text-sm">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full bg-blue-500 shrink-0" />
                          <span>Reuniões Comerciais</span>
                        </div>
                        <ChevronDown className="w-4 h-4 text-muted-foreground" />
                      </div>
                    </div>
                  </div>
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                    <p className="text-sm font-semibold">Título da reunião</p>
                  </div>
                  <p className="text-xs text-muted-foreground mb-2">Use <code className="bg-muted px-1 rounded">{'{'+'nome'+'}'}</code> para incluir o nome do lead.</p>
                  <div className="h-9 px-3 rounded-lg border border-input bg-background text-sm flex items-center text-foreground">
                    Call de vendas — {'{'+'nome'+'}'}
                  </div>
                </div>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  )
}

// ── Done screen ───────────────────────────────────────────────────────────────
function ScreenDone({ onReset }: { onReset: () => void }) {
  return (
    <div className="h-full w-full flex flex-col items-center justify-center gap-6 p-8">
      <div className="flex flex-col items-center gap-5">
        <div className="w-18 h-18 w-[72px] h-[72px] rounded-2xl bg-primary/10 flex items-center justify-center ring-4 ring-primary/10">
          <CheckCircle2 className="w-9 h-9 text-primary" />
        </div>
        <div className="text-center">
          <h2 className="text-2xl font-semibold">Pronto para vender!</h2>
          <p className="text-sm text-muted-foreground mt-1.5">WhatsApp conectado · SDR configurado · Respondendo leads 24/7</p>
        </div>
        <div className="flex flex-col gap-2.5 w-full max-w-xs">
          {['WhatsApp conectado', 'Persona configurada', 'Base de conhecimento ativa', 'Google Calendar integrado', 'Agente SDR ativo'].map((item) => (
            <div key={item} className="flex items-center gap-2.5 text-sm text-green-700 dark:text-green-400">
              <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" /> {item}
            </div>
          ))}
        </div>
      </div>
      <button onClick={onReset} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mt-2">
        <RotateCcw className="w-3.5 h-3.5" /> Ver novamente
      </button>
    </div>
  )
}

// ── Scene state machine ────────────────────────────────────────────────────────
type Scene =
  | 'qr_idle'              // Atendimento, QR idle, hotspot: "Gerar QR"
  | 'qr_shown'             // QR shown, hotspot: QR code
  | 'qr_connected'         // Connected, nav hotspot: Automações
  | 'sdr_tipo'             // SDR Geral, hotspot: + Agendamento card
  | 'sdr_identidade'       // SDR Identidade tab, hotspot: tab Conhecimento
  | 'sdr_conhecimento'     // SDR Conhecimento, hotspot: tab Integrações
  | 'sdr_integracoes'      // SDR Integrações, hotspot: tab Geral
  | 'sdr_ativar'           // SDR Geral, hotspot: switch
  | 'done'

const SCENES: Scene[] = ['qr_idle','qr_shown','qr_connected','sdr_tipo','sdr_identidade','sdr_conhecimento','sdr_integracoes','sdr_ativar','done']

interface SceneMeta { nav: string; url: string; label: string }
const SCENE_META: Record<Scene, SceneMeta> = {
  qr_idle:          { nav: 'atendimento', url: 'atendimento',         label: 'Conectando o WhatsApp' },
  qr_shown:         { nav: 'atendimento', url: 'atendimento',         label: 'Escaneie o QR Code com o celular' },
  qr_connected:     { nav: 'atendimento', url: 'atendimento',         label: 'WhatsApp conectado! Agora configure o Agente SDR' },
  sdr_tipo:         { nav: 'automacoes',  url: 'configuracoes/sdr',   label: 'Escolha o tipo de agente SDR' },
  sdr_identidade:   { nav: 'automacoes',  url: 'configuracoes/sdr',   label: 'Configure a persona: nome, tom de voz e produto' },
  sdr_conhecimento: { nav: 'automacoes',  url: 'configuracoes/sdr',   label: 'Adicione a base de conhecimento e objeções' },
  sdr_integracoes:  { nav: 'automacoes',  url: 'configuracoes/sdr',   label: 'Conecte o Google Calendar para agendamentos' },
  sdr_ativar:       { nav: 'automacoes',  url: 'configuracoes/sdr',   label: 'Tudo configurado! Ative o Agente SDR' },
  done:             { nav: 'automacoes',  url: 'configuracoes/sdr',   label: 'Agente SDR ativo e respondendo leads!' },
}

function getSdrTab(scene: Scene): SdrTab {
  if (scene === 'sdr_identidade')                    return 'identidade'
  if (scene === 'sdr_conhecimento')                  return 'conhecimento'
  if (scene === 'sdr_integracoes')                   return 'integracoes'
  return 'geral'
}

function getSdrHotspot(scene: Scene): SdrHotspot {
  if (scene === 'sdr_tipo')          return 'tipo_agendamento'
  if (scene === 'sdr_identidade')    return 'tab_conhecimento'
  if (scene === 'sdr_conhecimento')  return 'tab_integracoes'
  if (scene === 'sdr_integracoes')   return 'tab_geral'
  if (scene === 'sdr_ativar')        return 'switch_ativo'
  return null
}

// ── Root component ─────────────────────────────────────────────────────────────
export function ProductDemo({ className }: { className?: string }) {
  const [scene, setScene] = useState<Scene>('qr_idle')
  const [qrState, setQRState] = useState<QRState>('idle')
  const [agenteAtivo, setAgenteAtivo] = useState(false)
  const [selectedTipo, setSelectedTipo] = useState(false)

  const meta = SCENE_META[scene]
  const advance = () => setScene(s => {
    const i = SCENES.indexOf(s)
    return SCENES[Math.min(i + 1, SCENES.length - 1)]
  })

  function handleGerarQR() {
    setQRState('generating')
    setTimeout(() => { setQRState('qr_shown'); setScene('qr_shown') }, 1100)
  }
  function handleScanQR() {
    setQRState('scanning')
    setTimeout(() => { setQRState('connected'); setScene('qr_connected') }, 1400)
  }
  function handleNavClick(id: string) {
    if (id === 'automacoes') setScene('sdr_tipo')
  }
  function handleSdrHotspot() {
    if (scene === 'sdr_tipo') { setSelectedTipo(true); advance() }
    else if (scene === 'sdr_ativar') { setAgenteAtivo(true); setTimeout(() => setScene('done'), 400) }
    else advance()
  }
  function handleReset() {
    setScene('qr_idle'); setQRState('idle'); setAgenteAtivo(false); setSelectedTipo(false)
  }

  const isSdrScene = ['sdr_tipo','sdr_identidade','sdr_conhecimento','sdr_integracoes','sdr_ativar'].includes(scene)
  const sceneIdx = SCENES.indexOf(scene)

  return (
    <div className={cn('rounded-2xl border border-border overflow-hidden shadow-xl bg-background', className)}
         style={{ minWidth: 860 }}>
      {/* URL bar */}
      <div className="bg-muted/40 border-b border-border px-4 py-2 flex items-center gap-3 flex-shrink-0">
        <div className="flex gap-1.5 shrink-0">
          <div className="w-3 h-3 rounded-full bg-red-400/60" />
          <div className="w-3 h-3 rounded-full bg-amber-400/60" />
          <div className="w-3 h-3 rounded-full bg-emerald-400/60" />
        </div>
        <div className="flex-1 bg-background/80 border border-border/40 rounded-md px-3 py-1 text-[11px] text-muted-foreground font-mono">
          app.zaapply.com.br/{meta.url}
        </div>
      </div>

      {/* App shell */}
      <div className="flex" style={{ height: 560 }}>
        <FakeSidebar
          active={meta.nav}
          navHotspot={scene === 'qr_connected' ? 'automacoes' : null}
          onNav={handleNavClick}
        />

        {/* Content */}
        <div className="flex-1 min-w-0 relative overflow-hidden">
          <div key={scene} className="absolute inset-0 animate-in fade-in duration-200">
            {(scene === 'qr_idle' || scene === 'qr_shown' || scene === 'qr_connected') && (
              <ScreenAtendimento qrState={qrState} onGerarQR={handleGerarQR} onScanQR={handleScanQR} />
            )}
            {isSdrScene && (
              <ScreenSDR
                activeTab={getSdrTab(scene)}
                selectedTipo={selectedTipo}
                agenteAtivo={agenteAtivo}
                hotspot={getSdrHotspot(scene)}
                onHotspot={handleSdrHotspot}
              />
            )}
            {scene === 'done' && <ScreenDone onReset={handleReset} />}
          </div>
        </div>
      </div>

      {/* Step bar */}
      <div className="border-t border-border bg-muted/20 px-5 py-3 flex items-center gap-4 flex-shrink-0">
        <div className="flex gap-1.5">
          {SCENES.filter(s => s !== 'done').map((s, i) => (
            <div key={s} className={cn(
              'rounded-full transition-all duration-300',
              s === scene ? 'w-5 h-1.5 bg-primary'
                : i < sceneIdx ? 'w-1.5 h-1.5 bg-primary/50'
                : 'w-1.5 h-1.5 bg-muted-foreground/20'
            )} />
          ))}
        </div>
        <p className="text-[12px] text-muted-foreground flex-1">{meta.label}</p>
        {scene === 'done' && (
          <button onClick={handleReset} className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors">
            <RotateCcw className="w-3 h-3" /> Reiniciar
          </button>
        )}
      </div>
    </div>
  )
}
