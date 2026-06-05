'use client'
import { useState, useRef, useEffect, useLayoutEffect } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard, MessageSquare, Users, Bot, Mail,
  Workflow, Settings, HelpCircle, Plus, Clock, CheckCheck,
  Play, Pause, MoreHorizontal, ChevronRight, X, Zap, AlertTriangle,
  Send, Image, FileText, ToggleLeft, ToggleRight, ArrowRight,
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
            active === id ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted/60'
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

// ─── Existing sequences ───────────────────────────────────────────────────────
const EXISTING_SEQS = [
  {
    name: 'Anti-Noshow — Reunião',
    type: 'anti_noshow',
    typeLabel: 'Anti-Noshow',
    typeColor: 'text-orange-600 bg-orange-500/10 border-orange-500/30',
    steps: 3,
    active: true,
    sent: 142,
  },
  {
    name: 'Remarketing — Sem Resposta',
    type: 'remarketing',
    typeLabel: 'Remarketing',
    typeColor: 'text-rose-600 bg-rose-500/10 border-rose-500/30',
    steps: 5,
    active: true,
    sent: 88,
  },
]

const TYPE_OPTIONS = [
  { value: 'follow',      label: 'Follow-up',   color: 'text-amber-600', desc: 'Nutrição e acompanhamento de leads' },
  { value: 'remarketing', label: 'Remarketing',  color: 'text-rose-600',  desc: 'Recuperação de leads sem resposta' },
  { value: 'anti_noshow', label: 'Anti-Noshow',  color: 'text-orange-600',desc: 'Confirmação e lembretes de reunião' },
  { value: 'trial_saas',  label: 'Trial SaaS',   color: 'text-violet-600',desc: 'Onboarding de trials automático' },
]

// ─── Scene types ──────────────────────────────────────────────────────────────
type Scene = 'list' | 'modal_name' | 'modal_type' | 'steps_empty' | 'step_form' | 'step_added' | 'done'
const SCENES: Scene[] = ['list', 'modal_name', 'modal_type', 'steps_empty', 'step_form', 'step_added', 'done']

const SCENE_META: Record<Scene, { label: string; url: string }> = {
  list:        { label: 'Clique em "+ Nova Sequência" para criar um novo follow-up automático', url: 'automacoes/follow-up' },
  modal_name:  { label: 'Clique no campo Nome e escreva o nome da sequência', url: 'automacoes/follow-up' },
  modal_type:  { label: 'Escolha o tipo "Follow-up" e clique em Criar', url: 'automacoes/follow-up' },
  steps_empty: { label: 'Sequência criada! Clique em "+ Adicionar Etapa" para criar o primeiro passo', url: 'automacoes/follow-up' },
  step_form:   { label: 'Configure a mensagem e o intervalo de envio — depois clique em Salvar Etapa', url: 'automacoes/follow-up' },
  step_added:  { label: 'Etapa salva! Clique no toggle para ativar a sequência', url: 'automacoes/follow-up' },
  done:        { label: 'Sequência ativa! O Zaapply vai enviar as mensagens automaticamente no tempo certo', url: 'automacoes/follow-up' },
}

// ─── Sequence list screen ─────────────────────────────────────────────────────
function SequenceListScreen({ onNext }: { onNext: () => void }) {
  return (
    <div className="absolute inset-0 flex flex-col bg-background">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border/50">
        <div>
          <h1 className="font-semibold text-base">Follow-up</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Sequências automáticas de mensagens via WhatsApp</p>
        </div>
        <Hotspot
          label="Clique aqui para criar uma nova sequência de follow-up automático"
          onClick={onNext}
          side="bottom"
          minW={300}
        >
          <button className="flex items-center gap-2 bg-primary text-primary-foreground text-sm font-medium px-4 py-2 rounded-xl">
            <Plus className="w-4 h-4" /> Nova Sequência
          </button>
        </Hotspot>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto p-6 space-y-3">
        {EXISTING_SEQS.map((seq) => (
          <div key={seq.name} className="border border-border/60 rounded-xl p-4 bg-card flex items-center gap-4 hover:bg-muted/20 transition-colors">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <p className="font-medium text-sm">{seq.name}</p>
                <span className={cn('text-[11px] font-medium border rounded-full px-2 py-0.5', seq.typeColor)}>
                  {seq.typeLabel}
                </span>
                {seq.active && (
                  <span className="text-[11px] font-medium border border-emerald-500/30 text-emerald-600 bg-emerald-500/10 rounded-full px-2 py-0.5">
                    Ativa
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground">{seq.steps} etapas · {seq.sent} enviadas</p>
            </div>
            <div className="flex items-center gap-2">
              <button className="text-muted-foreground hover:text-foreground p-2 rounded-lg hover:bg-muted/60">
                <MoreHorizontal className="w-4 h-4" />
              </button>
              <button className="text-muted-foreground hover:text-foreground p-2 rounded-lg hover:bg-muted/60">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Modal screen ─────────────────────────────────────────────────────────────
function ModalScreen({ phase, onNext }: { phase: 'name' | 'type'; onNext: () => void }) {
  const nameRef = useRef<HTMLDivElement>(null)
  const criarRef = useRef<HTMLDivElement>(null)
  const selectedType = 'follow'

  return (
    <div className="absolute inset-0 flex flex-col bg-background">
      {/* Background dimmed */}
      <div className="absolute inset-0 bg-black/30 z-10" />

      {/* Header (behind) */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border/50">
        <div>
          <h1 className="font-semibold text-base">Follow-up</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Sequências automáticas de mensagens via WhatsApp</p>
        </div>
        <div className="flex items-center gap-2 bg-primary text-primary-foreground text-sm font-medium px-4 py-2 rounded-xl opacity-50">
          <Plus className="w-4 h-4" /> Nova Sequência
        </div>
      </div>

      {/* Modal */}
      <div className="absolute inset-0 z-20 flex items-center justify-center p-8">
        <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md">
          {/* Modal header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-border/50">
            <h2 className="font-semibold text-sm">Nova Sequência</h2>
            <X className="w-4 h-4 text-muted-foreground cursor-pointer" />
          </div>

          {/* Modal body */}
          <div className="px-6 py-5 space-y-5">
            {/* Name field */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">Nome da sequência</label>
              {phase === 'name' ? (
                <Hotspot
                  label="Clique no campo e escreva o nome da sua sequência"
                  onClick={onNext}
                  side="bottom"
                  minW={280}
                >
                  <div ref={nameRef} className="w-full border border-border/60 rounded-xl px-4 py-2.5 text-sm text-muted-foreground bg-muted/20 cursor-pointer">
                    Ex: Pós-reunião — 3 dias
                  </div>
                </Hotspot>
              ) : (
                <div className="w-full border border-primary/40 rounded-xl px-4 py-2.5 text-sm bg-muted/20">
                  Pós-Reunião — 3 dias
                </div>
              )}
            </div>

            {/* Type field */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">Tipo</label>
              <div className="grid grid-cols-2 gap-2">
                {TYPE_OPTIONS.map((t) => (
                  <div
                    key={t.value}
                    className={cn(
                      'border rounded-xl px-3 py-2.5 cursor-pointer transition-colors',
                      phase === 'type' && t.value === selectedType
                        ? 'border-primary bg-primary/5'
                        : 'border-border/60 bg-muted/20'
                    )}
                  >
                    <p className={cn('text-xs font-medium', phase === 'type' && t.value === selectedType ? 'text-primary' : t.color)}>
                      {t.label}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{t.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Modal footer */}
          <div className="px-6 py-4 border-t border-border/50 flex gap-3 justify-end">
            <button className="text-sm text-muted-foreground px-4 py-2 rounded-xl border border-border/60">
              Cancelar
            </button>
            {phase === 'type' ? (
              <Hotspot
                label="Clique em Criar para criar a sequência e configurar as etapas"
                onClick={onNext}
                side="top"
                minW={280}
              >
                <button ref={criarRef as any} className="text-sm font-medium bg-primary text-primary-foreground px-4 py-2 rounded-xl">
                  Criar sequência
                </button>
              </Hotspot>
            ) : (
              <button className="text-sm font-medium bg-primary text-primary-foreground px-4 py-2 rounded-xl opacity-50 cursor-not-allowed">
                Criar sequência
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Steps screen ─────────────────────────────────────────────────────────────
function StepsScreen({ phase, onNext }: {
  phase: 'empty' | 'form' | 'added' | 'done'
  onNext?: () => void
}) {
  const addRef    = useRef<HTMLDivElement>(null)
  const saveRef   = useRef<HTMLDivElement>(null)
  const toggleRef = useRef<HTMLDivElement>(null)

  const savedStep = {
    order: 1,
    delay: '1 dia',
    type: 'texto',
    text: 'Oi {{nome}}! Tudo bem? 😊 Passando pra saber se ainda tem interesse no Zaapply. Me diz um horário que funcione pra você!',
  }

  const isActive = phase === 'done'

  return (
    <div className="absolute inset-0 flex flex-col bg-background">
      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-4 border-b border-border/50">
        <ChevronRight className="w-4 h-4 text-muted-foreground rotate-180" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="font-semibold text-sm">Pós-Reunião — 3 dias</h1>
            <span className="text-[11px] font-medium border border-amber-500/30 text-amber-600 bg-amber-500/10 rounded-full px-2 py-0.5">
              Follow-up
            </span>
            {isActive && (
              <span className="text-[11px] font-medium border border-emerald-500/30 text-emerald-600 bg-emerald-500/10 rounded-full px-2 py-0.5">
                Ativa
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {phase === 'added' || phase === 'done' ? '1 etapa' : '0 etapas'} · Criada agora
          </p>
        </div>
        {/* Toggle ativar */}
        {phase === 'added' && onNext && (
          <Hotspot
            label="Clique para ativar a sequência — o Zaapply começa a enviar automaticamente!"
            onClick={onNext}
            side="bottom"
            minW={320}
          >
            <div ref={toggleRef} className="flex items-center gap-2 border border-border/60 rounded-xl px-3 py-2 cursor-pointer">
              <ToggleLeft className="w-5 h-5 text-muted-foreground" />
              <span className="text-xs font-medium text-muted-foreground">Desativada</span>
            </div>
          </Hotspot>
        )}
        {phase === 'done' && (
          <div className="flex items-center gap-2 border border-emerald-500/40 rounded-xl px-3 py-2 bg-emerald-500/5">
            <ToggleRight className="w-5 h-5 text-emerald-600" />
            <span className="text-xs font-medium text-emerald-600">Ativa</span>
          </div>
        )}
        {phase === 'empty' && (
          <div className="flex items-center gap-2 border border-border/60 rounded-xl px-3 py-2 opacity-50">
            <ToggleLeft className="w-5 h-5 text-muted-foreground" />
            <span className="text-xs font-medium text-muted-foreground">Desativada</span>
          </div>
        )}
        {phase === 'form' && (
          <div className="flex items-center gap-2 border border-border/60 rounded-xl px-3 py-2 opacity-50">
            <ToggleLeft className="w-5 h-5 text-muted-foreground" />
            <span className="text-xs font-medium text-muted-foreground">Desativada</span>
          </div>
        )}
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-6">
        {/* Empty state */}
        {phase === 'empty' && (
          <div className="h-full flex flex-col items-center justify-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-muted/40 border border-border/60 flex items-center justify-center">
              <Mail className="w-7 h-7 text-muted-foreground/40" />
            </div>
            <div className="text-center">
              <p className="font-medium text-sm">Nenhuma etapa ainda</p>
              <p className="text-xs text-muted-foreground mt-1">Adicione etapas para construir a sequência de mensagens</p>
            </div>
            <Hotspot
              label="Clique aqui para adicionar a primeira mensagem da sequência"
              onClick={onNext!}
              side="top"
              minW={300}
            >
              <button ref={addRef as any} className="flex items-center gap-2 bg-primary text-primary-foreground text-sm font-medium px-4 py-2.5 rounded-xl">
                <Plus className="w-4 h-4" /> Adicionar Etapa
              </button>
            </Hotspot>
          </div>
        )}

        {/* Step form */}
        {phase === 'form' && (
          <div className="max-w-xl mx-auto space-y-5">
            <p className="font-semibold text-sm">Etapa 1</p>

            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">Enviar após</label>
              <div className="flex gap-2">
                <div className="w-24 border border-border/60 rounded-xl px-3 py-2.5 text-sm bg-muted/20 text-center font-medium">1</div>
                <div className="flex-1 border border-border/60 rounded-xl px-3 py-2.5 text-sm bg-muted/20">Dia(s)</div>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">Tipo de mensagem</label>
              <div className="flex gap-2">
                {[
                  { icon: MessageSquare, label: 'Texto', active: true },
                  { icon: Image,         label: 'Imagem', active: false },
                  { icon: FileText,      label: 'Documento', active: false },
                ].map(({ icon: Icon, label, active }) => (
                  <div
                    key={label}
                    className={cn(
                      'flex items-center gap-1.5 border rounded-xl px-3 py-2 text-xs font-medium cursor-pointer',
                      active ? 'border-primary bg-primary/5 text-primary' : 'border-border/60 text-muted-foreground'
                    )}
                  >
                    <Icon className="w-3.5 h-3.5" /> {label}
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">Mensagem</label>
              <div className="border border-border/60 rounded-xl p-3 bg-muted/20 text-sm min-h-[100px]">
                Oi {'{{nome}}'}! Tudo bem? 😊 Passando pra saber se ainda tem interesse no Zaapply. Me diz um horário que funcione pra você!
                <span className="inline-block w-0.5 h-4 bg-primary align-middle ml-0.5 animate-pulse" />
              </div>
              <p className="text-[10px] text-muted-foreground">Use {'{{nome}}'}, {'{{empresa}}'} para personalizar</p>
            </div>

            <div className="flex justify-end gap-3">
              <button className="text-sm text-muted-foreground px-4 py-2 rounded-xl border border-border/60">
                Cancelar
              </button>
              <Hotspot
                label="Clique em Salvar para registrar esta etapa na sequência"
                onClick={onNext!}
                side="top"
                minW={280}
              >
                <button ref={saveRef as any} className="text-sm font-medium bg-primary text-primary-foreground px-5 py-2 rounded-xl">
                  Salvar Etapa
                </button>
              </Hotspot>
            </div>
          </div>
        )}

        {/* Steps added */}
        {(phase === 'added' || phase === 'done') && (
          <div className="space-y-3">
            {/* Step card */}
            <div className="border border-border/60 rounded-xl bg-card overflow-hidden">
              <div className="flex items-center gap-3 px-4 py-3 border-b border-border/40 bg-muted/10">
                <div className="w-6 h-6 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center">
                  <span className="text-[11px] font-bold text-amber-600">1</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-muted-foreground/60 uppercase">Etapa 1</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Enviar após 1 dia</p>
                </div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <MessageSquare className="w-3.5 h-3.5" /> Texto
                </div>
              </div>
              <div className="px-4 py-3">
                <p className="text-xs text-foreground/80 leading-relaxed bg-muted/30 rounded-lg px-3 py-2.5">
                  {savedStep.text}
                </p>
              </div>
            </div>

            {/* Add more button */}
            <button className="w-full border border-dashed border-border/60 rounded-xl py-3 flex items-center justify-center gap-2 text-xs text-muted-foreground hover:bg-muted/20 transition-colors">
              <Plus className="w-3.5 h-3.5" /> Adicionar outra etapa
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────
export function FollowUpDemo({ className }: { className?: string }) {
  const [scene, setScene] = useState<Scene>('list')
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
        <FakeSidebar active="followup" />
        <div className="flex-1 min-w-0 relative overflow-hidden">
          <div key={scene} className="absolute inset-0 animate-in fade-in duration-200">
            {scene === 'list'        && <SequenceListScreen onNext={advance} />}
            {scene === 'modal_name'  && <ModalScreen phase="name" onNext={advance} />}
            {scene === 'modal_type'  && <ModalScreen phase="type" onNext={advance} />}
            {scene === 'steps_empty' && <StepsScreen phase="empty" onNext={advance} />}
            {scene === 'step_form'   && <StepsScreen phase="form"  onNext={advance} />}
            {scene === 'step_added'  && <StepsScreen phase="added" onNext={advance} />}
            {scene === 'done'        && <StepsScreen phase="done" />}
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
            onClick={() => setScene('list')}
            className="text-[11px] text-muted-foreground hover:text-foreground border border-border/60 rounded-lg px-3 py-1 transition-colors"
          >
            Reiniciar
          </button>
        )}
      </div>
    </div>
  )
}
