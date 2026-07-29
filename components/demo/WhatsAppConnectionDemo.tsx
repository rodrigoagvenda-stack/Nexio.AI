'use client'

import { useState } from 'react'
import { CheckCircle2, Wifi } from 'lucide-react'
import { cn } from '@/lib/utils'

type Step = 'idle' | 'scanning' | 'connected'

// ── QR Code decorativo (visualmente fiel a um QR real) ─────────────────────
function FakeQR() {
  // Mapa 21×21: 1 = módulo escuro
  const map = [
    [1,1,1,1,1,1,1,0,1,0,1,0,1,1,1,1,1,1,1,0,0],
    [1,0,0,0,0,0,1,0,0,1,0,1,1,0,0,0,0,0,1,0,0],
    [1,0,1,1,1,0,1,0,1,0,1,0,1,0,1,1,1,0,1,0,0],
    [1,0,1,1,1,0,1,0,0,1,0,1,1,0,1,1,1,0,1,0,0],
    [1,0,1,1,1,0,1,0,1,0,1,0,1,0,1,1,1,0,1,0,0],
    [1,0,0,0,0,0,1,0,0,1,0,1,1,0,0,0,0,0,1,0,0],
    [1,1,1,1,1,1,1,0,1,0,1,0,1,1,1,1,1,1,1,0,0],
    [0,0,0,0,0,0,0,0,0,1,0,1,0,0,0,0,0,0,0,0,0],
    [1,0,1,1,0,0,1,0,1,0,1,0,1,0,0,1,1,0,1,1,0],
    [0,1,0,0,1,1,0,1,0,1,0,1,0,1,1,0,0,1,0,0,1],
    [1,0,1,0,1,0,1,0,1,0,0,1,1,0,1,0,1,1,0,1,0],
    [0,1,0,1,0,1,0,0,0,1,0,0,0,1,0,1,0,0,1,0,1],
    [1,1,1,1,1,0,1,0,1,0,1,1,1,0,1,1,1,0,1,0,0],
    [0,0,0,0,0,0,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0],
    [1,1,1,1,1,1,1,0,0,0,1,0,1,0,1,1,0,0,1,0,0],
    [1,0,0,0,0,0,1,0,1,1,0,1,0,1,0,0,1,1,0,1,0],
    [1,0,1,1,1,0,1,0,0,0,1,0,1,0,1,0,0,0,1,0,1],
    [1,0,1,1,1,0,1,0,1,1,0,1,0,1,0,1,1,0,0,1,0],
    [1,0,1,1,1,0,1,0,0,0,1,0,1,0,0,0,1,1,1,0,1],
    [1,0,0,0,0,0,1,0,1,1,0,1,0,1,1,0,0,1,0,1,0],
    [1,1,1,1,1,1,1,0,0,0,1,0,1,0,1,1,0,0,1,0,0],
  ]

  return (
    <div className="grid gap-px" style={{ gridTemplateColumns: `repeat(21, 1fr)` }}>
      {map.flat().map((cell, i) => (
        <div
          key={i}
          className={cn(
            'aspect-square rounded-[1px]',
            cell ? 'bg-gray-900' : 'bg-transparent'
          )}
        />
      ))}
    </div>
  )
}

// ── Tooltip hotspot pulsante ───────────────────────────────────────────────
function Hotspot({ label }: { label: string }) {
  return (
    <div className="absolute -right-3 top-1/2 -translate-y-1/2 flex items-center gap-2 z-10 pointer-events-none">
      <div className="relative flex items-center justify-center">
        <div className="w-4 h-4 rounded-full bg-primary animate-ping opacity-60 absolute" />
        <div className="w-4 h-4 rounded-full bg-primary relative" />
      </div>
      <div className="relative bg-primary text-primary-foreground text-[11px] font-semibold px-3 py-1.5 rounded-lg whitespace-nowrap shadow-lg">
        <div className="absolute -left-1.5 top-1/2 -translate-y-1/2 w-3 h-3 bg-primary rotate-45 rounded-[2px]" />
        {label}
      </div>
    </div>
  )
}

// ── Componente principal ───────────────────────────────────────────────────
export function WhatsAppConnectionDemo({ className }: { className?: string }) {
  const [step, setStep] = useState<Step>('idle')

  function handleClick() {
    if (step !== 'idle') return
    setStep('scanning')
    setTimeout(() => setStep('connected'), 2200)
  }

  return (
    <div className={cn('rounded-2xl border border-border bg-card overflow-hidden w-full max-w-xs shadow-xl', className)}>

      {/* Barra título */}
      <div className="px-4 py-3 border-b border-border flex items-center gap-2.5">
        <div className="flex gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-red-400/70" />
          <div className="w-2.5 h-2.5 rounded-full bg-amber-400/70" />
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-400/70" />
        </div>
        <span className="text-xs font-medium text-muted-foreground ml-1">Conectar WhatsApp</span>
        <div className={cn(
          'ml-auto w-2 h-2 rounded-full transition-colors',
          step === 'connected' ? 'bg-emerald-500 animate-pulse' : 'bg-muted-foreground/30'
        )} />
      </div>

      {/* Corpo */}
      <div className="p-6">

        {/* ── IDLE ──────────────────────────────────────────────── */}
        {step === 'idle' && (
          <div className="space-y-5">
            <div className="text-center space-y-0.5">
              <p className="text-sm font-semibold text-foreground">Escaneie o QR code</p>
              <p className="text-xs text-muted-foreground">com o WhatsApp do seu número comercial</p>
            </div>

            {/* QR code clicável */}
            <div className="relative flex justify-center">
              <button
                onClick={handleClick}
                className="relative p-4 bg-white rounded-2xl border-2 border-border hover:border-primary/50 hover:shadow-lg transition-all duration-200 cursor-pointer group w-52 h-52"
                aria-label="Simular escaneio do QR code"
              >
                <FakeQR />

                {/* Scan line */}
                <div className="absolute inset-4 pointer-events-none overflow-hidden rounded">
                  <div
                    className="w-full h-0.5 bg-emerald-400 blur-[1px] opacity-80"
                    style={{ animation: 'scanLine 2s ease-in-out infinite' }}
                  />
                </div>

                {/* Hover overlay */}
                <div className="absolute inset-0 rounded-2xl bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <span className="text-[10px] font-medium text-primary bg-primary/10 px-2 py-1 rounded-md">
                    Clique para simular
                  </span>
                </div>
              </button>

              <Hotspot label="Clique e veja como funciona" />
            </div>

            <p className="text-[11px] text-muted-foreground text-center leading-relaxed">
              WhatsApp → <span className="text-foreground font-medium">Aparelhos conectados</span> → Conectar aparelho
            </p>
          </div>
        )}

        {/* ── SCANNING ──────────────────────────────────────────── */}
        {step === 'scanning' && (
          <div className="flex flex-col items-center gap-6 py-6">
            <div className="relative">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
                <Wifi className="h-7 w-7 text-primary" />
              </div>
              <div className="absolute inset-0 rounded-2xl border-2 border-primary/30 animate-ping" />
            </div>
            <div className="text-center space-y-1">
              <p className="text-sm font-semibold">Aguardando confirmação</p>
              <p className="text-xs text-muted-foreground">Confirme no seu celular para continuar</p>
            </div>
            <div className="flex gap-1.5">
              {[0, 1, 2].map(i => (
                <div
                  key={i}
                  className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce"
                  style={{ animationDelay: `${i * 0.15}s` }}
                />
              ))}
            </div>
          </div>
        )}

        {/* ── CONNECTED ─────────────────────────────────────────── */}
        {step === 'connected' && (
          <div className="flex flex-col items-center gap-5 py-4">
            <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 flex items-center justify-center ring-4 ring-emerald-500/10">
              <CheckCircle2 className="h-8 w-8 text-emerald-500" />
            </div>

            <div className="text-center space-y-1">
              <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">WhatsApp conectado!</p>
              <p className="text-xs text-muted-foreground">+55 11 9 9999-9999</p>
            </div>

            <div className="w-full rounded-xl bg-emerald-500/8 border border-emerald-500/20 px-3.5 py-2.5 flex items-center gap-2.5">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
              <p className="text-xs text-emerald-700 dark:text-emerald-300 font-medium">
                Instância ativa · recebendo mensagens
              </p>
            </div>

            <button
              onClick={() => setStep('idle')}
              className="text-[11px] text-muted-foreground hover:text-foreground transition-colors underline-offset-4 hover:underline"
            >
              Reiniciar demo
            </button>
          </div>
        )}
      </div>

      <style jsx>{`
        @keyframes scanLine {
          0%   { transform: translateY(0); opacity: 1; }
          50%  { transform: translateY(160px); opacity: 0.4; }
          100% { transform: translateY(0); opacity: 1; }
        }
      `}</style>
    </div>
  )
}
