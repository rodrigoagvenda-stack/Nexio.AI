'use client'

import { useState, useEffect } from 'react'
import { cn } from '@/lib/utils'
import {
  TrendingUp, PieChart, MessageCircle, UserCog,
  Sparkles, LifeBuoy, Settings, Bot, Brain, Link2, ShoppingBag,
  Megaphone, Loader2, CheckCircle2, Wifi, WifiOff, Save,
  MessageSquare, Calendar, Zap, RotateCcw,
} from 'lucide-react'

// ── Real Zaapply SVG icon (from components/brand/ZaapliIcon.tsx) ───────────────
function ZaapliIcon({ size = 26 }: { size?: number }) {
  const w = size * (208 / 235)
  return (
    <svg width={w} height={size} viewBox="0 0 208 235" fill="none">
      <path
        d="M207.65 103.853C207.65 104.953 207.65 106.063 207.59 107.143V107.213C207.562 120.28 205.556 133.267 201.64 145.733C194.543 167.855 181.706 187.699 164.44 203.243C146.982 218.999 125.668 229.859 102.66 234.723V207.653C82.1745 207.423 62.2151 201.137 45.2943 189.587C28.3736 178.037 15.2477 161.74 7.56905 142.747C-0.109597 123.753 -1.99782 102.913 2.14207 82.8485C6.28195 62.7843 16.2649 44.3933 30.8343 29.9904C45.4037 15.5875 63.9083 5.81663 84.0187 1.90763C104.129 -2.00137 124.946 0.126266 143.85 8.02272C162.754 15.9192 178.9 29.2315 190.254 46.2839C201.609 63.3363 207.665 83.3666 207.66 103.853H207.65Z"
        fill="#369E47"
      />
      <path
        d="M82.5917 152.783C77.2584 152.783 73.3551 151.533 70.8817 149.033C69.6593 147.837 68.6957 146.402 68.0506 144.818C67.4056 143.233 67.0928 141.534 67.1317 139.823C67.2062 136.582 67.9519 133.392 69.3217 130.453C70.8962 126.943 73.1222 123.764 75.8817 121.083L110.712 84.6934H76.5917C75.2672 84.6934 73.9556 84.4324 72.732 83.9252C71.5084 83.418 70.3967 82.6746 69.4605 81.7375C68.5244 80.8005 67.7821 79.6881 67.2761 78.464C66.7702 77.2398 66.5104 75.928 66.5117 74.6034C66.5117 71.7285 67.6538 68.9713 69.6867 66.9384C71.7196 64.9055 74.4768 63.7634 77.3517 63.7634H125.082C130.915 63.7634 135.132 65.0101 137.732 67.5034C138.968 68.6341 139.953 70.011 140.625 71.5456C141.297 73.0801 141.64 74.7383 141.632 76.4134C141.632 81.7468 139.395 86.9001 134.922 91.8734L97.9217 131.873H129.922C132.799 131.873 135.559 133.017 137.594 135.051C139.629 137.086 140.772 139.846 140.772 142.723C140.769 144.054 140.503 145.371 139.989 146.598C139.475 147.825 138.723 148.938 137.777 149.874C136.831 150.809 135.708 151.548 134.475 152.047C133.242 152.546 131.922 152.797 130.592 152.783H82.5917Z"
        fill="white"
      />
    </svg>
  )
}

// ── Fake QR Code (19×19) ───────────────────────────────────────────────────────
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

function FakeQR({ size = 200 }: { size?: number }) {
  const cell = size / QR_ROWS.length
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="block">
      {QR_ROWS.flatMap((row, r) =>
        row.map((v, c) =>
          v ? (
            <rect
              key={`${r}-${c}`}
              x={c * cell + 0.3}
              y={r * cell + 0.3}
              width={cell - 0.6}
              height={cell - 0.6}
              rx="0.4"
              fill="#111"
            />
          ) : null
        )
      )}
    </svg>
  )
}

// ── Hotspot: pulsing ring + tooltip, user clicks to advance ───────────────────
function Hotspot({
  children,
  label,
  onClick,
  side = 'top',
}: {
  children: React.ReactNode
  label: string
  onClick: () => void
  side?: 'top' | 'bottom' | 'right' | 'left'
}) {
  return (
    <div className="relative inline-block cursor-pointer group" onClick={onClick}>
      {/* Pulsing ring */}
      <div className="absolute -inset-1.5 rounded-lg ring-2 ring-primary pointer-events-none z-10 animate-pulse" />

      {/* Tooltip — top */}
      {side === 'top' && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 z-30 pointer-events-none whitespace-nowrap">
          <div className="bg-primary text-primary-foreground text-[11px] font-semibold px-3 py-1.5 rounded-lg shadow-xl">
            {label}
          </div>
          <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-[5px] border-l-transparent border-r-transparent border-t-primary" />
        </div>
      )}

      {/* Tooltip — right */}
      {side === 'right' && (
        <div className="absolute left-full top-1/2 -translate-y-1/2 ml-3 z-30 pointer-events-none whitespace-nowrap">
          <div className="bg-primary text-primary-foreground text-[11px] font-semibold px-3 py-1.5 rounded-lg shadow-xl">
            {label}
          </div>
          <div className="absolute right-full top-1/2 -translate-y-1/2 w-0 h-0 border-t-4 border-b-4 border-r-[5px] border-t-transparent border-b-transparent border-r-primary" />
        </div>
      )}

      {/* Tooltip — bottom */}
      {side === 'bottom' && (
        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-3 z-30 pointer-events-none whitespace-nowrap">
          <div className="bg-primary text-primary-foreground text-[11px] font-semibold px-3 py-1.5 rounded-lg shadow-xl">
            {label}
          </div>
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-b-[5px] border-l-transparent border-r-transparent border-b-primary" />
        </div>
      )}

      {children}
    </div>
  )
}

// ── Real sidebar (exact classes from Sidebar.tsx) ─────────────────────────────
const NAV_SECTIONS = [
  {
    label: 'Principal',
    items: [{ id: 'dashboard', label: 'Dashboard', Icon: TrendingUp }],
  },
  {
    label: 'Ferramentas',
    items: [
      { id: 'crm',         label: 'CRM',         Icon: PieChart },
      { id: 'atendimento', label: 'Atendimento',  Icon: MessageCircle },
      { id: 'automacoes',  label: 'Automações',   Icon: Megaphone },
    ],
  },
  {
    label: 'Gestão',
    items: [{ id: 'membros', label: 'Membros', Icon: UserCog }],
  },
  {
    label: 'Sistema',
    items: [
      { id: 'novidades',     label: 'Novidades',    Icon: Sparkles },
      { id: 'ajuda',         label: 'Ajuda',         Icon: LifeBuoy },
      { id: 'configuracoes', label: 'Configuração',  Icon: Settings },
    ],
  },
] as const

function FakeSidebar({
  active,
  hotspot,
  onNav,
}: {
  active: string
  hotspot: string | null
  onNav: (id: string) => void
}) {
  return (
    <aside className="w-56 shrink-0 flex flex-col bg-card border-r border-border h-full overflow-hidden">
      {/* Logo — exact replica */}
      <div className="flex items-center h-14 border-b border-border/50 px-4 gap-2 flex-shrink-0">
        <ZaapliIcon size={26} />
        <span
          className="font-extrabold tracking-tight text-[#0d0d0d] dark:text-white leading-none select-none"
          style={{ fontSize: 18, fontFamily: "'Nunito', 'Poppins', sans-serif", letterSpacing: '-0.01em' }}
        >
          zaapply
        </span>
      </div>

      {/* Nav sections */}
      <div className="flex-1 px-3 pt-3 space-y-3 overflow-y-auto">
        {NAV_SECTIONS.map(({ label, items }) => (
          <div key={label}>
            <p className="px-3 mb-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">
              {label}
            </p>
            <div className="space-y-0.5">
              {items.map(({ id, label: itemLabel, Icon }) => {
                const isActive = active === id
                const isHotspot = hotspot === id
                return (
                  <div key={id} className="relative">
                    {/* Pulsing ring on the nav item */}
                    {isHotspot && (
                      <div className="absolute inset-0 rounded-lg ring-2 ring-primary/80 pointer-events-none z-10 animate-pulse" />
                    )}
                    {/* Tooltip to the right of sidebar */}
                    {isHotspot && (
                      <div className="absolute left-full top-1/2 -translate-y-1/2 ml-3 z-30 pointer-events-none">
                        <div className="bg-primary text-primary-foreground text-[10px] font-semibold px-2.5 py-1 rounded-lg shadow-xl whitespace-nowrap">
                          Clique aqui
                        </div>
                        <div className="absolute right-full top-1/2 -translate-y-1/2 w-0 h-0 border-t-[4px] border-b-[4px] border-r-[5px] border-t-transparent border-b-transparent border-r-primary" />
                      </div>
                    )}
                    <button
                      onClick={() => isHotspot ? onNav(id) : undefined}
                      className={cn(
                        'relative w-full group flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors duration-100 text-left',
                        isActive
                          ? 'bg-accent text-accent-foreground'
                          : 'text-muted-foreground hover:text-foreground hover:bg-accent/50',
                        isHotspot && 'cursor-pointer'
                      )}
                    >
                      <Icon className="h-4 w-4 flex-shrink-0" />
                      <span className="text-sm flex-1 text-left">{itemLabel}</span>
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Footer company avatar */}
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

// ── Atendimento: WhatsApp connection screen ───────────────────────────────────
type QRState = 'idle' | 'generating' | 'qr_shown' | 'scanning' | 'connected'

function ScreenAtendimento({
  qrState,
  onGerarQR,
  onScanQR,
}: {
  qrState: QRState
  onGerarQR: () => void
  onScanQR: () => void
}) {
  if (qrState === 'connected') {
    return (
      <div className="h-full w-full flex flex-col items-center justify-center bg-[#f0f2f5] dark:bg-background">
        <div className="w-full max-w-2xl mx-4">
          <div className="bg-white dark:bg-card rounded-2xl shadow-sm border border-border overflow-hidden p-8 flex flex-col items-center gap-5">
            <div className="w-14 h-14 rounded-2xl bg-green-500/10 flex items-center justify-center ring-4 ring-green-500/10">
              <CheckCircle2 className="w-7 h-7 text-green-500" />
            </div>
            <div className="text-center">
              <h2 className="text-xl font-light text-foreground">WhatsApp conectado!</h2>
              <p className="text-sm text-muted-foreground mt-1">+55 11 9 9999-9999 · Instância ativa</p>
            </div>
            <div className="flex items-center gap-1.5 text-xs font-medium text-green-700 dark:text-green-400 bg-green-500/10 border border-green-500/20 px-3 py-1.5 rounded-full">
              <Wifi className="h-3 w-3" />
              Recebendo mensagens
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full w-full flex flex-col items-center justify-center bg-[#f0f2f5] dark:bg-background overflow-auto">
      <div className="w-full max-w-2xl mx-4 my-4">
        <div className="bg-white dark:bg-card rounded-2xl shadow-sm border border-border overflow-hidden">
          <div className="flex flex-col md:flex-row">
            {/* Left: instructions */}
            <div className="flex-1 p-6 flex flex-col gap-5">
              <div>
                <h1 className="text-xl font-light text-foreground mb-1">Use o WhatsApp no computador</h1>
                <p className="text-sm text-muted-foreground">Conecte seu número para começar a atender conversas</p>
              </div>
              <ol className="space-y-3">
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

              {/* Gerar QR button — hotspot when idle */}
              {qrState === 'idle' && (
                <Hotspot label="Clique para gerar o QR Code" onClick={onGerarQR} side="bottom">
                  <button className="text-sm text-primary underline underline-offset-4 hover:opacity-70 transition-opacity text-left">
                    Gerar novo QR Code
                  </button>
                </Hotspot>
              )}
              {(qrState === 'generating' || qrState === 'qr_shown' || qrState === 'scanning') && (
                <button disabled className="text-sm text-primary underline underline-offset-4 opacity-40 text-left">
                  {qrState === 'generating' ? 'Gerando QR Code…' : 'Gerar novo QR Code'}
                </button>
              )}
            </div>

            {/* Right: QR area */}
            <div className="flex items-center justify-center p-6 bg-muted/30 border-t md:border-t-0 md:border-l border-border min-h-[240px]">
              {qrState === 'idle' && (
                <div className="w-[180px] h-[180px] bg-muted rounded-xl" />
              )}
              {qrState === 'generating' && (
                <div className="flex flex-col items-center gap-3">
                  <div className="w-[180px] h-[180px] bg-muted rounded-xl flex items-center justify-center">
                    <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                  </div>
                  <p className="text-xs text-muted-foreground">Gerando QR Code…</p>
                </div>
              )}
              {qrState === 'qr_shown' && (
                <Hotspot label="Escaneie com o WhatsApp" onClick={onScanQR} side="top">
                  <div className="flex flex-col items-center gap-3">
                    <div className="p-3 bg-white rounded-xl shadow-sm border">
                      <FakeQR size={180} />
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
                    <FakeQR size={180} />
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

// ── SDR config screen (Geral tab replica) ─────────────────────────────────────
const SDR_TABS = [
  { id: 'geral',       label: 'Geral',        Icon: Settings },
  { id: 'identidade',  label: 'Identidade',   Icon: Bot },
  { id: 'conhecimento',label: 'Conhecimento', Icon: Brain },
  { id: 'integracoes', label: 'Integrações',  Icon: Link2 },
  { id: 'cardapio',    label: 'Cardápio',     Icon: ShoppingBag },
] as const

function ScreenSDR({
  agenteAtivo,
  onToggle,
}: {
  agenteAtivo: boolean
  onToggle: () => void
}) {
  return (
    <div className="h-full w-full overflow-auto">
      <div className="max-w-5xl mx-auto p-4 md:p-6 pb-8">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Agente SDR</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Atendimento automático via WhatsApp</p>
          </div>
          <div className="flex items-center gap-2">
            <div className={cn(
              'flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border',
              'bg-green-500/10 text-green-700 border-green-500/30 dark:text-green-400'
            )}>
              <Wifi className="w-3 h-3" />
              +55 11 9 9999-9999
            </div>
            <button className="flex items-center gap-1.5 h-8 px-3 rounded-md bg-primary text-primary-foreground text-sm font-medium">
              <Save className="w-3.5 h-3.5" />
              Salvar
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex gap-6">
          {/* Tab sidebar */}
          <aside className="w-44 shrink-0 space-y-1">
            <button className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs transition-colors text-left text-primary bg-primary/5 hover:bg-primary/10 mb-2 border border-primary/20">
              <Sparkles className="w-3.5 h-3.5 shrink-0" />
              Config. Rápida
            </button>
            {SDR_TABS.map(({ id, label, Icon: TabIcon }) => (
              <button
                key={id}
                className={cn(
                  'w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm transition-colors text-left',
                  id === 'geral'
                    ? 'bg-primary/10 text-primary font-medium'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                )}
              >
                <TabIcon className={cn('w-4 h-4 shrink-0', id === 'geral' ? 'text-primary' : 'text-muted-foreground')} />
                {label}
              </button>
            ))}
          </aside>

          {/* Geral tab content */}
          <div className="flex-1 space-y-5">
            {/* Agente ativo — hotspot */}
            <Hotspot
              label={agenteAtivo ? 'Agente ativado!' : 'Ative o agente SDR'}
              onClick={onToggle}
              side="top"
            >
              <div className={cn(
                'flex items-center justify-between gap-4 p-4 rounded-xl border transition-colors',
                agenteAtivo
                  ? 'bg-primary/5 border-primary/30'
                  : 'bg-muted/30 border-border'
              )}>
                <div className="flex items-center gap-3">
                  <div className={cn(
                    'w-8 h-8 rounded-lg flex items-center justify-center shrink-0',
                    agenteAtivo ? 'bg-primary/15' : 'bg-muted'
                  )}>
                    <Zap className={cn('w-4 h-4', agenteAtivo ? 'text-primary' : 'text-muted-foreground')} />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Agente ativo</p>
                    <p className="text-xs text-muted-foreground">
                      {agenteAtivo ? 'Respondendo automaticamente' : 'Ative para responder automaticamente'}
                    </p>
                  </div>
                </div>
                {/* Fake switch */}
                <div
                  className={cn(
                    'relative w-10 h-5 rounded-full transition-colors duration-200 flex-shrink-0',
                    agenteAtivo ? 'bg-primary' : 'bg-muted-foreground/30'
                  )}
                >
                  <div className={cn(
                    'absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200',
                    agenteAtivo ? 'translate-x-5' : 'translate-x-0.5'
                  )} />
                </div>
              </div>
            </Hotspot>

            {/* Tipo de agente */}
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">Tipo de agente</p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: 'Atendimento + Venda', desc: 'Responde dúvidas e conduz para a venda', Icon: MessageSquare, selected: true },
                  { label: '+ Agendamento', desc: 'Inclui agendamento via Google Calendar', Icon: Calendar, selected: false },
                ].map(({ label, desc, Icon: TypeIcon, selected }) => (
                  <div key={label} className={cn(
                    'p-3 rounded-xl border-2 cursor-pointer transition-all',
                    selected ? 'border-primary bg-primary/5' : 'border-border bg-card hover:border-border/80'
                  )}>
                    <div className="flex items-center gap-2 mb-1">
                      <TypeIcon className={cn('w-4 h-4', selected ? 'text-primary' : 'text-muted-foreground')} />
                      <span className={cn('text-sm font-medium', selected ? 'text-primary' : 'text-foreground')}>{label}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">{desc}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Modo inbox */}
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">Modo de inbox</p>
              <div className="grid grid-cols-2 gap-2">
                {['Suporte', 'Vendas'].map((modo, i) => (
                  <div key={modo} className={cn(
                    'p-3 rounded-xl border text-sm font-medium text-center cursor-pointer transition-colors',
                    i === 0 ? 'border-primary bg-primary/5 text-primary' : 'border-border text-muted-foreground'
                  )}>
                    {modo}
                  </div>
                ))}
              </div>
            </div>
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
      <div className="flex flex-col items-center gap-4">
        <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center ring-4 ring-primary/10">
          <CheckCircle2 className="w-8 h-8 text-primary" />
        </div>
        <div className="text-center">
          <h2 className="text-xl font-semibold">Pronto para vender!</h2>
          <p className="text-sm text-muted-foreground mt-1">WhatsApp conectado · SDR ativo · Respondendo leads automaticamente</p>
        </div>
        <div className="flex flex-col gap-2 w-full max-w-xs">
          <div className="flex items-center gap-2 text-sm text-green-700 dark:text-green-400">
            <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
            WhatsApp conectado
          </div>
          <div className="flex items-center gap-2 text-sm text-green-700 dark:text-green-400">
            <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
            Agente SDR ativo
          </div>
          <div className="flex items-center gap-2 text-sm text-green-700 dark:text-green-400">
            <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
            Respondendo leads automaticamente
          </div>
        </div>
      </div>
      <button
        onClick={onReset}
        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        <RotateCcw className="w-3.5 h-3.5" />
        Ver novamente
      </button>
    </div>
  )
}

// ── Scene state machine ────────────────────────────────────────────────────────
type Scene =
  | 'qr_idle'       // Atendimento active, hotspot on "Gerar QR Code" button
  | 'qr_scanning'   // QR shown, hotspot on QR code (user clicks = "scan")
  | 'qr_connected'  // Connected state, hotspot on "Automações" nav
  | 'sdr_geral'     // SDR Geral tab, hotspot on agente_ativo switch
  | 'done'          // All done

interface SceneConfig {
  activeNav: string
  hotspotNav: string | null
  url: string
  label: string
}

const SCENE_CONFIG: Record<Scene, SceneConfig> = {
  qr_idle: {
    activeNav: 'atendimento', hotspotNav: null,
    url: 'app.zaapply.com.br/atendimento',
    label: 'Passo 1 de 2 — Conecte o WhatsApp',
  },
  qr_scanning: {
    activeNav: 'atendimento', hotspotNav: null,
    url: 'app.zaapply.com.br/atendimento',
    label: 'Escaneie o QR code com o celular',
  },
  qr_connected: {
    activeNav: 'atendimento', hotspotNav: 'automacoes',
    url: 'app.zaapply.com.br/atendimento',
    label: 'WhatsApp conectado! Agora configure o SDR.',
  },
  sdr_geral: {
    activeNav: 'automacoes', hotspotNav: null,
    url: 'app.zaapply.com.br/configuracoes/sdr',
    label: 'Passo 2 de 2 — Ative o Agente SDR',
  },
  done: {
    activeNav: 'automacoes', hotspotNav: null,
    url: 'app.zaapply.com.br/configuracoes/sdr',
    label: 'Configuração concluída!',
  },
}

// ── Main component ─────────────────────────────────────────────────────────────
export function ProductDemo({ className }: { className?: string }) {
  const [scene, setScene] = useState<Scene>('qr_idle')
  const [qrState, setQRState] = useState<QRState>('idle')
  const [agenteAtivo, setAgenteAtivo] = useState(false)

  const cfg = SCENE_CONFIG[scene]

  function handleGerarQR() {
    setQRState('generating')
    setTimeout(() => {
      setQRState('qr_shown')
      setScene('qr_scanning')
    }, 1200)
  }

  function handleScanQR() {
    setQRState('scanning')
    setTimeout(() => {
      setQRState('connected')
      setScene('qr_connected')
    }, 1500)
  }

  function handleNavClick(id: string) {
    if (id === 'automacoes') {
      setScene('sdr_geral')
    }
  }

  function handleToggleAgente() {
    setAgenteAtivo(true)
    setTimeout(() => setScene('done'), 600)
  }

  function handleReset() {
    setScene('qr_idle')
    setQRState('idle')
    setAgenteAtivo(false)
  }

  return (
    <div className={cn('rounded-2xl border border-border overflow-hidden shadow-xl bg-background', className)}>
      {/* Minimal URL bar */}
      <div className="bg-muted/50 border-b border-border px-4 py-2 flex items-center gap-3">
        <div className="flex gap-1.5 shrink-0">
          <div className="w-2.5 h-2.5 rounded-full bg-red-400/60" />
          <div className="w-2.5 h-2.5 rounded-full bg-amber-400/60" />
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-400/60" />
        </div>
        <div className="flex-1 bg-background/80 border border-border/40 rounded-md px-3 py-1 text-[11px] text-muted-foreground font-mono">
          {cfg.url}
        </div>
      </div>

      {/* App shell */}
      <div className="flex" style={{ height: '460px' }}>
        <FakeSidebar
          active={cfg.activeNav}
          hotspot={cfg.hotspotNav}
          onNav={handleNavClick}
        />

        {/* Content */}
        <div className="flex-1 relative overflow-hidden">
          <div key={scene} className="absolute inset-0 animate-in fade-in duration-200">
            {(scene === 'qr_idle' || scene === 'qr_scanning' || scene === 'qr_connected') && (
              <ScreenAtendimento
                qrState={qrState}
                onGerarQR={handleGerarQR}
                onScanQR={handleScanQR}
              />
            )}
            {scene === 'sdr_geral' && (
              <ScreenSDR agenteAtivo={agenteAtivo} onToggle={handleToggleAgente} />
            )}
            {scene === 'done' && (
              <ScreenDone onReset={handleReset} />
            )}
          </div>
        </div>
      </div>

      {/* Step indicator */}
      <div className="border-t border-border bg-muted/20 px-4 py-2.5 flex items-center gap-3">
        <div className="flex gap-1.5">
          {(['qr_idle', 'qr_scanning', 'qr_connected', 'sdr_geral', 'done'] as Scene[]).map((s, i) => (
            <div
              key={s}
              className={cn(
                'rounded-full transition-all duration-300',
                s === scene
                  ? 'w-5 h-1.5 bg-primary'
                  : (['qr_idle', 'qr_scanning', 'qr_connected', 'sdr_geral', 'done'] as Scene[]).indexOf(s) <
                    (['qr_idle', 'qr_scanning', 'qr_connected', 'sdr_geral', 'done'] as Scene[]).indexOf(scene)
                  ? 'w-1.5 h-1.5 bg-primary/50'
                  : 'w-1.5 h-1.5 bg-muted-foreground/20'
              )}
            />
          ))}
        </div>
        <p className="text-[11px] text-muted-foreground flex-1">{cfg.label}</p>
      </div>
    </div>
  )
}
