'use client'
import { useState, useRef, useEffect, useLayoutEffect } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard, MessageSquare, Users, Bot, Mail,
  Workflow, Settings, HelpCircle, Plus, Save, Trash2,
  Play, Zap, Clock, AlertTriangle, GitBranch, Webhook,
  MessageCircle, Timer, CheckCircle2, ChevronRight, X,
  MousePointerClick, Move,
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

// ─── Node type definitions ────────────────────────────────────────────────────
const NODE_TYPES = [
  { kind: 'trigger',   label: 'Trigger',    icon: Zap,            bg: 'bg-emerald-500/10', border: 'border-emerald-500/40', text: 'text-emerald-600' },
  { kind: 'mensagem',  label: 'Mensagem',   icon: MessageCircle,  bg: 'bg-primary/10',     border: 'border-primary/40',     text: 'text-primary' },
  { kind: 'aguardar',  label: 'Aguardar',   icon: Timer,          bg: 'bg-blue-500/10',    border: 'border-blue-500/40',    text: 'text-blue-600' },
  { kind: 'condicao',  label: 'Condição',   icon: GitBranch,      bg: 'bg-yellow-500/10',  border: 'border-yellow-500/30',  text: 'text-yellow-600' },
  { kind: 'acao',      label: 'Ação',       icon: Play,           bg: 'bg-violet-500/10',  border: 'border-violet-500/40',  text: 'text-violet-600' },
  { kind: 'webhook',   label: 'Webhook',    icon: Webhook,        bg: 'bg-sky-500/10',     border: 'border-sky-500/40',     text: 'text-sky-600' },
  { kind: 'espera',    label: 'Espera resp.', icon: Clock,        bg: 'bg-amber-500/10',   border: 'border-amber-500/40',   text: 'text-amber-600' },
  { kind: 'fim',       label: 'Fim',        icon: CheckCircle2,   bg: 'bg-muted',          border: 'border-border',         text: 'text-muted-foreground' },
]

// ─── Canvas node component ────────────────────────────────────────────────────
function FlowNode({
  x, y, kind, label, subtitle, selected = false, highlighted = false, noPosition = false,
}: {
  x: number; y: number; kind: string; label: string; subtitle?: string
  selected?: boolean; highlighted?: boolean; noPosition?: boolean
}) {
  const meta = NODE_TYPES.find(t => t.kind === kind) || NODE_TYPES[1]
  const Icon = meta.icon

  return (
    <div
      className={cn(
        noPosition ? 'relative' : 'absolute',
        'rounded-xl border bg-card/90 backdrop-blur-sm overflow-hidden transition-all shadow-sm',
        meta.border,
        selected && 'ring-2 ring-primary/50 shadow-primary/10 shadow-lg',
        highlighted && 'ring-2 ring-primary/70 shadow-primary/20 shadow-lg'
      )}
      style={noPosition ? { width: 172 } : { left: x, top: y, width: 172 }}
    >
      {/* Header */}
      <div className={cn('flex items-center gap-2 px-2.5 py-2 border-b border-border/30', meta.bg)}>
        <div className={cn('w-6 h-6 rounded-lg flex items-center justify-center border flex-shrink-0', meta.bg, meta.border)}>
          <Icon className={cn('w-3.5 h-3.5', meta.text)} />
        </div>
        <div className="min-w-0">
          <p className="text-[10px] font-bold text-muted-foreground/60 uppercase leading-none">{kind}</p>
          <p className="text-[11px] font-semibold text-foreground/90 leading-snug truncate mt-0.5">{label}</p>
        </div>
      </div>
      {/* Body */}
      {subtitle && (
        <div className="px-2.5 py-2">
          <p className="text-[10px] text-muted-foreground leading-snug">{subtitle}</p>
        </div>
      )}
    </div>
  )
}

// ─── SVG edge path ────────────────────────────────────────────────────────────
function Edge({ x1, y1, x2, y2, dashed }: { x1: number; y1: number; x2: number; y2: number; dashed?: boolean }) {
  const cx = (x2 - x1) / 2
  const d  = `M${x1},${y1} C${x1 + cx},${y1} ${x2 - cx},${y2} ${x2},${y2}`
  return (
    <path
      d={d}
      stroke="#444"
      strokeWidth={1.5}
      fill="none"
      strokeDasharray={dashed ? '5 3' : undefined}
      markerEnd="url(#arrow-canvas)"
    />
  )
}

// ─── Node picker panel ────────────────────────────────────────────────────────
function NodePicker({ onSelect }: { onSelect: () => void }) {
  return (
    <div className="absolute right-0 top-0 bottom-0 w-56 border-l border-border/60 bg-card z-20 flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
        <p className="text-xs font-semibold">Adicionar Node</p>
        <X className="w-4 h-4 text-muted-foreground cursor-pointer" />
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
        {NODE_TYPES.map((t) => {
          const Icon = t.icon
          const isMensagem = t.kind === 'mensagem'
          return isMensagem ? (
            <Hotspot
              key={t.kind}
              label="Clique em Mensagem para adicionar um node que envia texto ao lead"
              onClick={onSelect}
              side="left"
              minW={280}
            >
              <div className={cn(
                'flex items-center gap-2.5 px-3 py-2.5 rounded-xl border cursor-pointer transition-colors w-full',
                'border-primary/40 bg-primary/5'
              )}>
                <div className={cn('w-7 h-7 rounded-lg flex items-center justify-center border flex-shrink-0', t.bg, t.border)}>
                  <Icon className={cn('w-3.5 h-3.5', t.text)} />
                </div>
                <div>
                  <p className="text-xs font-semibold">{t.label}</p>
                  <p className="text-[10px] text-muted-foreground">Enviar mensagem de texto</p>
                </div>
              </div>
            </Hotspot>
          ) : (
            <div
              key={t.kind}
              className={cn(
                'flex items-center gap-2.5 px-3 py-2.5 rounded-xl border cursor-pointer transition-colors',
                'border-border/60 hover:bg-muted/40'
              )}
            >
              <div className={cn('w-7 h-7 rounded-lg flex items-center justify-center border flex-shrink-0', t.bg, t.border)}>
                <Icon className={cn('w-3.5 h-3.5', t.text)} />
              </div>
              <div>
                <p className="text-xs font-semibold">{t.label}</p>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Node config panel ────────────────────────────────────────────────────────
function NodeConfigPanel({ onSave }: { onSave: () => void }) {
  return (
    <div className="absolute right-0 top-0 bottom-0 w-64 border-l border-border/60 bg-card z-20 flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
        <p className="text-xs font-semibold">Configurar Node</p>
        <X className="w-4 h-4 text-muted-foreground cursor-pointer" />
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div className="space-y-2">
          <label className="text-[11px] font-medium text-muted-foreground">Tipo de mensagem</label>
          <div className="flex gap-2">
            <div className="border border-primary/40 bg-primary/5 text-primary rounded-lg px-3 py-1.5 text-xs font-medium cursor-pointer">Texto</div>
            <div className="border border-border/60 rounded-lg px-3 py-1.5 text-xs font-medium text-muted-foreground cursor-pointer">Imagem</div>
            <div className="border border-border/60 rounded-lg px-3 py-1.5 text-xs font-medium text-muted-foreground cursor-pointer">Botões</div>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-[11px] font-medium text-muted-foreground">Mensagem</label>
          <div className="border border-border/60 rounded-xl p-3 bg-muted/20 text-xs min-h-[90px] text-foreground/80 leading-relaxed">
            Oi {'{{nome}}'}! 😊 Segue o resumo da nossa reunião de hoje e os próximos passos que combinamos. Qualquer dúvida é só falar!
            <span className="inline-block w-0.5 h-3.5 bg-primary align-middle ml-0.5 animate-pulse" />
          </div>
          <p className="text-[10px] text-muted-foreground">Use {'{{nome}}'}, {'{{empresa}}'} para personalizar</p>
        </div>

        <div className="space-y-2">
          <label className="text-[11px] font-medium text-muted-foreground">Agente SDR após envio</label>
          <div className="flex gap-2">
            <div className="border border-border/60 rounded-lg px-3 py-1.5 text-xs font-medium text-muted-foreground cursor-pointer">Manter</div>
            <div className="border border-emerald-500/40 bg-emerald-500/5 text-emerald-600 rounded-lg px-3 py-1.5 text-xs font-medium cursor-pointer">Ativar</div>
            <div className="border border-border/60 rounded-lg px-3 py-1.5 text-xs font-medium text-muted-foreground cursor-pointer">Pausar</div>
          </div>
        </div>
      </div>
      <div className="px-4 py-3 border-t border-border/50 flex justify-end">
        <Hotspot
          label="Clique em Salvar para registrar a configuração deste node"
          onClick={onSave}
          side="top"
          minW={280}
        >
          <button className="text-xs font-medium bg-primary text-primary-foreground px-4 py-2 rounded-xl">
            Salvar Node
          </button>
        </Hotspot>
      </div>
    </div>
  )
}

// ─── Canvas screen ────────────────────────────────────────────────────────────
function CanvasScreen({
  scene, onNext,
}: {
  scene: Scene; onNext?: () => void
}) {
  const showNewNode   = scene === 'node_placed' || scene === 'node_config' || scene === 'connected' || scene === 'done'
  const showPicker    = scene === 'picker_open'
  const showConfig    = scene === 'node_config'
  const showConnected = scene === 'connected' || scene === 'done'
  const showSaveOk    = scene === 'done'

  return (
    <div className="absolute inset-0 flex flex-col bg-[#0d0d0d]">
      {/* Canvas toolbar */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border/40 bg-card/80 backdrop-blur-sm z-10 flex-shrink-0">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <Workflow className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-medium">Pós-Reunião — 3 dias</span>
          <span className="text-[11px] text-muted-foreground border border-amber-500/30 text-amber-600 bg-amber-500/10 rounded-full px-2 py-0.5">Follow-up</span>
        </div>
        <div className="flex items-center gap-2">
          {/* Add node button */}
          {scene === 'canvas_view' && onNext ? (
            <Hotspot
              label="Clique aqui para abrir o painel e adicionar um novo node ao fluxo"
              onClick={onNext}
              side="bottom"
              minW={300}
            >
              <button className="flex items-center gap-1.5 text-xs font-medium border border-border/60 rounded-xl px-3 py-2 text-muted-foreground hover:bg-muted/40">
                <Plus className="w-3.5 h-3.5" /> Adicionar Node
              </button>
            </Hotspot>
          ) : (
            <button className="flex items-center gap-1.5 text-xs font-medium border border-border/60 rounded-xl px-3 py-2 text-muted-foreground">
              <Plus className="w-3.5 h-3.5" /> Adicionar Node
            </button>
          )}

          {/* Save button */}
          {scene === 'connected' && onNext ? (
            <Hotspot
              label="Fluxo montado! Clique em Salvar para ativar e salvar no banco de dados"
              onClick={onNext}
              side="bottom"
              minW={320}
            >
              <button className="flex items-center gap-1.5 text-xs font-semibold bg-primary text-primary-foreground rounded-xl px-3 py-2">
                <Save className="w-3.5 h-3.5" /> Salvar Fluxo
              </button>
            </Hotspot>
          ) : (
            <button className={cn(
              'flex items-center gap-1.5 text-xs font-semibold rounded-xl px-3 py-2',
              showSaveOk ? 'bg-emerald-600 text-white' : 'bg-primary text-primary-foreground'
            )}>
              {showSaveOk ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
              {showSaveOk ? 'Salvo!' : 'Salvar Fluxo'}
            </button>
          )}
        </div>
      </div>

      {/* Canvas area */}
      <div className="flex-1 relative overflow-hidden">
        {/* Dot background */}
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: 'radial-gradient(circle, #2a2a2a 1px, transparent 1px)',
            backgroundSize: '24px 24px',
          }}
        />

        {/* SVG edges */}
        <svg className="absolute inset-0 pointer-events-none" style={{ width: '100%', height: '100%' }}>
          <defs>
            <marker id="arrow-canvas" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
              <path d="M0,0 L0,6 L8,3 Z" fill="#555" />
            </marker>
          </defs>
          {/* Trigger → Mensagem D0 */}
          <Edge x1={212} y1={240} x2={240} y2={240} />
          {/* Mensagem D0 → Aguardar */}
          <Edge x1={412} y1={240} x2={440} y2={240} />
          {/* Aguardar → new node (appears in connected scene) */}
          {showConnected && <Edge x1={612} y1={240} x2={640} y2={240} />}
        </svg>

        {/* Existing nodes */}
        <FlowNode x={40}  y={210} kind="trigger"  label="Lead entra"     subtitle="Reunião agendada" />
        <FlowNode x={240} y={210} kind="mensagem"  label="Pós-reunião D0" subtitle="Resumo + próximos passos" />
        <FlowNode x={440} y={210} kind="aguardar"  label="Aguardar 1 dia" />

        {/* New node — appears when placed */}
        {showNewNode && (
          <div style={{ position: 'absolute', left: 640, top: 210 }}>
            {scene === 'node_placed' && onNext ? (
              <Hotspot
                label="Node adicionado! Clique nele para configurar a mensagem que será enviada"
                onClick={onNext}
                side="bottom"
                minW={320}
              >
                <FlowNode x={0} y={0} kind="mensagem" label="Nova mensagem" highlighted noPosition />
              </Hotspot>
            ) : (
              <FlowNode
                x={0} y={0}
                kind="mensagem"
                label={showConnected ? 'Follow D+2' : 'Nova mensagem'}
                subtitle={showConnected ? 'Ainda conseguimos conversar?' : undefined}
                selected={scene === 'node_config'}
              />
            )}
          </div>
        )}
      </div>

      {/* Node picker overlay */}
      {showPicker && <NodePicker onSelect={onNext!} />}

      {/* Node config overlay */}
      {showConfig && <NodeConfigPanel onSave={onNext!} />}
    </div>
  )
}

// ─── Scene types ──────────────────────────────────────────────────────────────
type Scene = 'canvas_view' | 'picker_open' | 'node_placed' | 'node_config' | 'connected' | 'done'
const SCENES: Scene[] = ['canvas_view', 'picker_open', 'node_placed', 'node_config', 'connected', 'done']

const SCENE_META: Record<Scene, { label: string; url: string }> = {
  canvas_view: { label: 'Este é o Canvas — clique em "Adicionar Node" para expandir o fluxo', url: 'automacoes/follow-up/canvas' },
  picker_open: { label: 'Painel aberto — clique em "Mensagem" para adicionar um node de texto ao fluxo', url: 'automacoes/follow-up/canvas' },
  node_placed: { label: 'Node colocado no canvas — clique nele para configurar a mensagem', url: 'automacoes/follow-up/canvas' },
  node_config: { label: 'Painel de configuração — escreva a mensagem e clique em Salvar Node', url: 'automacoes/follow-up/canvas' },
  connected:   { label: 'Node configurado e conectado ao fluxo — clique em Salvar Fluxo para finalizar', url: 'automacoes/follow-up/canvas' },
  done:        { label: 'Fluxo salvo! As mensagens serão enviadas automaticamente nos intervalos definidos', url: 'automacoes/follow-up/canvas' },
}

// ─── Main component ───────────────────────────────────────────────────────────
export function CanvasDemo({ className }: { className?: string }) {
  const [scene, setScene] = useState<Scene>('canvas_view')
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
        <FakeSidebar active="canvas" />
        <div className="flex-1 min-w-0 relative overflow-hidden">
          <div key={scene} className="absolute inset-0 animate-in fade-in duration-200">
            <CanvasScreen scene={scene} onNext={scene !== 'done' ? advance : undefined} />
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
            onClick={() => setScene('canvas_view')}
            className="text-[11px] text-muted-foreground hover:text-foreground border border-border/60 rounded-lg px-3 py-1 transition-colors"
          >
            Reiniciar
          </button>
        )}
      </div>
    </div>
  )
}
