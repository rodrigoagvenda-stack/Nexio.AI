'use client';

import '@xyflow/react/dist/style.css';

import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  Handle,
  Position,
  MarkerType,
  BackgroundVariant,
  type Connection,
  type Node,
  type Edge,
  type NodeProps,
  useReactFlow,
  ReactFlowProvider,
} from '@xyflow/react';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  MessageSquare,
  Clock,
  GitBranch,
  XCircle,
  Zap,
  Plus,
  Save,
  Loader2,
  CheckCircle2,
  X,
  Search,
  PenLine,
  Play,
  Clock3,
  CheckCheck,
  AlertCircle,
  Mic,
  Image as ImageIcon,
  Video,
  FileText,
  Upload,
  Square,
  Globe,
  Star,
  GitMerge,
  History,
  LayoutTemplate,
  CalendarX,
  Megaphone,
  FlaskConical,
  StopCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── API Types ──────────────────────────────────────────────────────────────────

type SequenceTipo = 'follow_geral' | 'anti_noshow' | 'remarketing' | 'trial_saas';

interface FollowStep {
  id: string;
  dia_offset: number;
  horario: string;
  mensagem: string | null;
  tipo_mensagem: string;
  ordem: number;
  condicao: string;
}

interface FollowSequence {
  id: string;
  nome: string;
  tipo: SequenceTipo;
  ativo: boolean;
  follow_steps: FollowStep[];
}

// ─── Node Exec State ────────────────────────────────────────────────────────────

type ExecState = 'idle' | 'running' | 'success' | 'error' | 'skipped';

// ─── Node Data Types ────────────────────────────────────────────────────────────

interface TriggerNodeData extends Record<string, unknown> {
  kind: 'trigger';
  label: string;
  condicao: string;
  _execState?: ExecState;
  _execError?: string;
}

interface MessageNodeData extends Record<string, unknown> {
  kind: 'message';
  label: string;
  dia_offset: number;
  horario: string;
  mensagem: string | null;
  tipo_mensagem: string;
  stepId: string;
  media_url?: string;
  media_name?: string;
  uploading?: boolean;
  _execState?: ExecState;
  _execError?: string;
}

interface WaitNodeData extends Record<string, unknown> {
  kind: 'wait';
  label: string;
  dia_offset: number;
  stepId: string;
  _execState?: ExecState;
  _execError?: string;
}

interface ConditionNodeData extends Record<string, unknown> {
  kind: 'condition';
  label: string;
  condicao: string;
  stepId: string;
  _execState?: ExecState;
  _execError?: string;
}

interface EndNodeData extends Record<string, unknown> {
  kind: 'end';
  label: string;
  stepId: string;
  _execState?: ExecState;
  _execError?: string;
}

interface WebhookNodeData extends Record<string, unknown> {
  kind: 'webhook';
  label: string;
  url: string;
  method: 'POST' | 'GET';
  stepId: string;
  _execState?: ExecState;
  _execError?: string;
}

interface LeadScoreNodeData extends Record<string, unknown> {
  kind: 'lead_score';
  label: string;
  scoreMin: number;
  scoreMax: number;
  stepId: string;
  _execState?: ExecState;
  _execError?: string;
}

interface ABTestNodeData extends Record<string, unknown> {
  kind: 'ab_test';
  label: string;
  variantA: string;
  variantB: string;
  stepId: string;
  _execState?: ExecState;
  _execError?: string;
}

type AutoNodeData =
  | TriggerNodeData
  | MessageNodeData
  | WaitNodeData
  | ConditionNodeData
  | EndNodeData
  | WebhookNodeData
  | LeadScoreNodeData
  | ABTestNodeData;

// ─── Execution Log ──────────────────────────────────────────────────────────────

interface ExecLog {
  id: string;
  lead: string;
  sequence: string;
  step: string;
  status: 'sent' | 'failed' | 'pending';
  ts: string;
}

// ─── Versioning ─────────────────────────────────────────────────────────────────

interface CanvasVersion {
  ts: number;
  nodes: Node<AutoNodeData>[];
  edges: Edge[];
}

function saveVersion(sequenceId: string, nodes: Node<AutoNodeData>[], edges: Edge[]) {
  const key = `canvas-versions-${sequenceId}`;
  let versions: CanvasVersion[] = [];
  try {
    versions = JSON.parse(localStorage.getItem(key) ?? '[]') as CanvasVersion[];
  } catch { /* ignore */ }
  versions.push({ ts: Date.now(), nodes, edges });
  if (versions.length > 5) versions = versions.slice(versions.length - 5);
  localStorage.setItem(key, JSON.stringify(versions));
}

function loadVersions(sequenceId: string): CanvasVersion[] {
  try {
    return JSON.parse(localStorage.getItem(`canvas-versions-${sequenceId}`) ?? '[]') as CanvasVersion[];
  } catch { return []; }
}

function formatVersionLabel(v: CanvasVersion, idx: number, total: number): string {
  const d = new Date(v.ts);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  const time = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const dateStr = isToday ? `hoje ${time}` : d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) + ' ' + time;
  const nodeCount = v.nodes.length;
  return `Versão ${idx + 1 + (5 - total)} — ${dateStr} · ${nodeCount} nós`;
}

// ─── Templates ──────────────────────────────────────────────────────────────────

interface CanvasTemplate {
  id: string;
  name: string;
  desc: string;
  icon: React.ElementType;
  nodes: Node<AutoNodeData>[];
  edges: Edge[];
}

function buildTemplates(): CanvasTemplate[] {
  const edge = (id: string, source: string, target: string): Edge => ({
    id, source, target, ...EDGE_BASE,
  });

  const boasVindas: CanvasTemplate = {
    id: 'boas-vindas',
    name: 'Boas-vindas 7 dias',
    desc: 'Onboarding clássico para novos leads',
    icon: MessageSquare,
    nodes: [
      { id: 'trigger', type: 'triggerNode', position: { x: 0, y: 150 }, data: { kind: 'trigger', label: 'Boas-vindas 7 dias', condicao: 'Início da sequência' } satisfies TriggerNodeData },
      { id: 't-msg1', type: 'messageNode', position: { x: 280, y: 150 }, data: { kind: 'message', label: 'Mensagem', dia_offset: 0, horario: '09:00', mensagem: 'Boas-vindas! Seja bem-vindo(a).', tipo_mensagem: 'texto', stepId: 't-msg1' } satisfies MessageNodeData },
      { id: 't-msg2', type: 'messageNode', position: { x: 560, y: 150 }, data: { kind: 'message', label: 'Mensagem', dia_offset: 2, horario: '09:00', mensagem: 'Oi, tudo bem? Só passando para ver se precisa de ajuda.', tipo_mensagem: 'texto', stepId: 't-msg2' } satisfies MessageNodeData },
      { id: 't-cond', type: 'conditionNode', position: { x: 840, y: 150 }, data: { kind: 'condition', label: 'Condição', condicao: 'Respondeu?', stepId: 't-cond' } satisfies ConditionNodeData },
      { id: 't-end', type: 'endNode', position: { x: 1120, y: 150 }, data: { kind: 'end', label: 'Encerrar sequência', stepId: 't-end' } satisfies EndNodeData },
    ],
    edges: [
      edge('e1', 'trigger', 't-msg1'),
      edge('e2', 't-msg1', 't-msg2'),
      edge('e3', 't-msg2', 't-cond'),
      edge('e4', 't-cond', 't-end'),
    ],
  };

  const remarketing: CanvasTemplate = {
    id: 'remarketing',
    name: 'Remarketing 3 passos',
    desc: 'Reengajamento de leads frios',
    icon: Megaphone,
    nodes: [
      { id: 'trigger', type: 'triggerNode', position: { x: 0, y: 150 }, data: { kind: 'trigger', label: 'Remarketing 3 passos', condicao: 'Início da sequência' } satisfies TriggerNodeData },
      { id: 'r-msg1', type: 'messageNode', position: { x: 280, y: 150 }, data: { kind: 'message', label: 'Mensagem', dia_offset: 0, horario: '09:00', mensagem: 'Temos uma oferta especial para você!', tipo_mensagem: 'texto', stepId: 'r-msg1' } satisfies MessageNodeData },
      { id: 'r-msg2', type: 'messageNode', position: { x: 560, y: 150 }, data: { kind: 'message', label: 'Mensagem', dia_offset: 3, horario: '09:00', mensagem: 'Últimas horas! Não perca essa oportunidade.', tipo_mensagem: 'texto', stepId: 'r-msg2' } satisfies MessageNodeData },
      { id: 'r-end', type: 'endNode', position: { x: 840, y: 150 }, data: { kind: 'end', label: 'Encerrar sequência', stepId: 'r-end' } satisfies EndNodeData },
    ],
    edges: [
      edge('e1', 'trigger', 'r-msg1'),
      edge('e2', 'r-msg1', 'r-msg2'),
      edge('e3', 'r-msg2', 'r-end'),
    ],
  };

  const noshow: CanvasTemplate = {
    id: 'noshow',
    name: 'Anti-Noshow simples',
    desc: 'Redução de no-shows em reuniões',
    icon: CalendarX,
    nodes: [
      { id: 'trigger', type: 'triggerNode', position: { x: 0, y: 150 }, data: { kind: 'trigger', label: 'Anti-Noshow simples', condicao: 'Início da sequência' } satisfies TriggerNodeData },
      { id: 'ns-msg1', type: 'messageNode', position: { x: 280, y: 150 }, data: { kind: 'message', label: 'Mensagem', dia_offset: 0, horario: '09:00', mensagem: 'Lembrete: você tem uma reunião agendada amanhã.', tipo_mensagem: 'texto', stepId: 'ns-msg1' } satisfies MessageNodeData },
      { id: 'ns-msg2', type: 'messageNode', position: { x: 560, y: 150 }, data: { kind: 'message', label: 'Mensagem', dia_offset: 1, horario: '08:00', mensagem: 'Confirmando sua presença para hoje?', tipo_mensagem: 'texto', stepId: 'ns-msg2' } satisfies MessageNodeData },
      { id: 'ns-end', type: 'endNode', position: { x: 840, y: 150 }, data: { kind: 'end', label: 'Encerrar sequência', stepId: 'ns-end' } satisfies EndNodeData },
    ],
    edges: [
      edge('e1', 'trigger', 'ns-msg1'),
      edge('e2', 'ns-msg1', 'ns-msg2'),
      edge('e3', 'ns-msg2', 'ns-end'),
    ],
  };

  return [boasVindas, remarketing, noshow];
}

// ─── Helpers ────────────────────────────────────────────────────────────────────

const EDGE_BASE = {
  type: 'smoothstep',
  markerEnd: { type: MarkerType.ArrowClosed, width: 14, height: 14, color: 'hsl(215 16% 47%)' },
  style: { stroke: 'hsl(215 16% 47%)', strokeWidth: 1.5 },
} as const;

function truncate(str: string | null, n: number): string {
  if (!str) return '';
  return str.length > n ? str.slice(0, n) + '…' : str;
}

function getDomain(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url.slice(0, 20);
  }
}

function stepsToNodes(steps: FollowStep[], sequenceName: string): Node<AutoNodeData>[] {
  const nodes: Node<AutoNodeData>[] = [];
  nodes.push({
    id: 'trigger', type: 'triggerNode', position: { x: 0, y: 150 },
    data: { kind: 'trigger', label: sequenceName, condicao: 'Início da sequência' } satisfies TriggerNodeData,
  });
  const sorted = [...steps].sort((a, b) => a.ordem - b.ordem);
  sorted.forEach((step, idx) => {
    const x = (idx + 1) * 280;
    const condicaoLower = step.condicao?.toLowerCase() ?? '';
    const isFim = condicaoLower.includes('fim') || condicaoLower.includes('encerr') || step.tipo_mensagem === 'fim';
    const isCondition = condicaoLower.includes('respondeu') || condicaoLower.includes('condicao') || step.tipo_mensagem === 'condicao';
    const isWait = step.tipo_mensagem === 'aguardar' || (step.mensagem === null && !isFim && !isCondition);

    if (isFim) nodes.push({ id: step.id, type: 'endNode', position: { x, y: 150 }, data: { kind: 'end', label: 'Encerrar sequência', stepId: step.id } satisfies EndNodeData });
    else if (isCondition) nodes.push({ id: step.id, type: 'conditionNode', position: { x, y: 150 }, data: { kind: 'condition', label: 'Condição', condicao: step.condicao || 'Respondeu?', stepId: step.id } satisfies ConditionNodeData });
    else if (isWait) nodes.push({ id: step.id, type: 'waitNode', position: { x, y: 150 }, data: { kind: 'wait', label: 'Aguardar', dia_offset: step.dia_offset, stepId: step.id } satisfies WaitNodeData });
    else nodes.push({ id: step.id, type: 'messageNode', position: { x, y: 150 }, data: { kind: 'message', label: 'Mensagem', dia_offset: step.dia_offset, horario: step.horario, mensagem: step.mensagem, tipo_mensagem: step.tipo_mensagem, stepId: step.id } satisfies MessageNodeData });
  });
  return nodes;
}

function stepsToEdges(steps: FollowStep[]): Edge[] {
  const sorted = [...steps].sort((a, b) => a.ordem - b.ordem);
  const edges: Edge[] = [];
  if (sorted.length > 0) edges.push({ id: `trigger-${sorted[0].id}`, source: 'trigger', target: sorted[0].id, ...EDGE_BASE });
  for (let i = 0; i < sorted.length - 1; i++) {
    edges.push({ id: `e-${sorted[i].id}-${sorted[i + 1].id}`, source: sorted[i].id, target: sorted[i + 1].id, ...EDGE_BASE });
  }
  return edges;
}

function nodesToSteps(nodes: Node<AutoNodeData>[]): FollowStep[] {
  return nodes.filter((n) => n.id !== 'trigger').sort((a, b) => a.position.x - b.position.x).map((node, idx) => {
    const d = node.data;
    const stepId = String(d.stepId ?? '');
    if (d.kind === 'message') return { id: stepId, dia_offset: d.dia_offset, horario: d.horario, mensagem: d.mensagem, tipo_mensagem: d.tipo_mensagem || 'texto', ordem: idx + 1, condicao: '' };
    if (d.kind === 'wait') return { id: stepId, dia_offset: d.dia_offset, horario: '00:00', mensagem: null, tipo_mensagem: 'aguardar', ordem: idx + 1, condicao: '' };
    if (d.kind === 'condition') return { id: stepId, dia_offset: 0, horario: '00:00', mensagem: null, tipo_mensagem: 'condicao', ordem: idx + 1, condicao: d.condicao };
    if (d.kind === 'webhook') return { id: stepId, dia_offset: 0, horario: '00:00', mensagem: null, tipo_mensagem: 'webhook', ordem: idx + 1, condicao: d.url };
    if (d.kind === 'lead_score') return { id: stepId, dia_offset: 0, horario: '00:00', mensagem: null, tipo_mensagem: 'lead_score', ordem: idx + 1, condicao: `${d.scoreMin}-${d.scoreMax}` };
    if (d.kind === 'ab_test') return { id: stepId, dia_offset: 0, horario: '00:00', mensagem: null, tipo_mensagem: 'ab_test', ordem: idx + 1, condicao: `${d.variantA}|${d.variantB}` };
    return { id: stepId, dia_offset: 0, horario: '00:00', mensagem: null, tipo_mensagem: 'fim', ordem: idx + 1, condicao: 'fim' };
  });
}

let nodeCounter = 1000;
function newId() { return `new-${++nodeCounter}`; }

// ─── Node building blocks ───────────────────────────────────────────────────────

function Chip({ children, active }: { children: React.ReactNode; active?: boolean }) {
  return (
    <span className={cn('inline-flex items-center px-3 py-1.5 rounded-xl text-sm transition-colors', active ? 'bg-primary text-primary-foreground font-semibold' : 'bg-muted text-muted-foreground')}>
      {children}
    </span>
  );
}

// Exec state overlay badge
function ExecBadge({ state, error }: { state?: ExecState; error?: string }) {
  if (!state || state === 'idle') return null;
  if (state === 'running') {
    return (
      <div className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-primary flex items-center justify-center z-10">
        <Loader2 className="w-3 h-3 text-primary-foreground animate-spin" />
      </div>
    );
  }
  if (state === 'success') {
    return (
      <div className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center z-10">
        <CheckCircle2 className="w-3 h-3 text-white" />
      </div>
    );
  }
  if (state === 'error') {
    return (
      <div className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-destructive flex items-center justify-center z-10" title={error}>
        <X className="w-3 h-3 text-white" />
      </div>
    );
  }
  if (state === 'skipped') {
    return (
      <div className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-muted-foreground/40 flex items-center justify-center z-10">
        <span className="text-[8px] text-white font-bold leading-none">–</span>
      </div>
    );
  }
  return null;
}

function NodeShell({ children, selected, primaryAccent, redAccent, header, execState, execError }: {
  children: React.ReactNode; selected?: boolean; primaryAccent?: boolean; redAccent?: boolean; header: React.ReactNode;
  execState?: ExecState; execError?: string;
}) {
  const isRunning = execState === 'running';
  const isSuccess = execState === 'success';
  const isError = execState === 'error';
  const isSkipped = execState === 'skipped';
  return (
    <div className={cn(
      'relative bg-card border rounded-2xl min-w-[210px] px-3 pt-2.5 pb-3 flex flex-col gap-2 transition-all duration-150 shadow-sm',
      isSkipped && 'opacity-50',
      isRunning ? 'ring-2 ring-primary border-primary/50 shadow-[0_0_20px_hsl(var(--primary)/0.20)]'
        : isSuccess ? 'ring-2 ring-emerald-500 border-emerald-500/40'
        : isError ? 'ring-2 ring-destructive border-destructive/40'
        : primaryAccent ? 'border-primary/50 shadow-[0_0_20px_hsl(var(--primary)/0.12)]'
        : redAccent ? 'border-destructive/40 shadow-[0_0_16px_hsl(var(--destructive)/0.08)]'
        : selected ? 'border-primary/50 shadow-[0_0_20px_hsl(var(--primary)/0.12)]'
        : 'border-border'
    )}>
      <ExecBadge state={execState} error={execError} />
      {header}
      <div className="flex flex-col gap-1.5">{children}</div>
    </div>
  );
}

function NodeHeader({ icon: Icon, label }: { icon: React.ElementType; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <Icon className="w-3 h-3 text-muted-foreground/50" />
      <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">{label}</span>
    </div>
  );
}

const HANDLE_CLS = '!w-2.5 !h-2.5 !bg-muted !border !border-border !rounded-full';

// ─── Node Components ────────────────────────────────────────────────────────────

function TriggerNode({ data, selected }: NodeProps) {
  const d = data as TriggerNodeData;
  return (
    <NodeShell selected={selected} primaryAccent header={<NodeHeader icon={Zap} label="Gatilho" />} execState={d._execState} execError={d._execError}>
      <Handle type="source" position={Position.Right} className={HANDLE_CLS} />
      <Chip active>{d.label}</Chip>
      <Chip>{d.condicao}</Chip>
    </NodeShell>
  );
}

function MessageNode({ data, selected }: NodeProps) {
  const d = data as MessageNodeData;

  const BARS = [3, 7, 5, 12, 8, 14, 4, 10, 6, 13, 7, 9, 4, 11, 5];

  const docExt = d.media_name
    ? d.media_name.split('.').pop()?.toUpperCase() ?? 'DOC'
    : d.media_url
    ? (d.media_url.split('.').pop()?.split('?')[0]?.toUpperCase() ?? 'DOC')
    : 'DOC';

  return (
    <NodeShell selected={selected} header={<NodeHeader icon={MessageSquare} label="Mensagem" />} execState={d._execState} execError={d._execError}>
      <Handle type="target" position={Position.Left} className={HANDLE_CLS} />
      <Handle type="source" position={Position.Right} className={HANDLE_CLS} />

      <div className="flex gap-1.5 flex-wrap">
        <Chip active={selected}>Dia {d.dia_offset}</Chip>
        <Chip>{d.horario}</Chip>
      </div>

      {d.uploading && (
        <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-muted/60 border border-border/40">
          <div className="flex gap-0.5 items-end shrink-0">
            {[0, 1, 2].map((i) => (
              <div key={i} className="w-1 rounded-full bg-primary animate-bounce"
                style={{ height: `${6 + i * 4}px`, animationDelay: `${i * 0.12}s` }} />
            ))}
          </div>
          <span className="text-xs text-muted-foreground">Enviando arquivo…</span>
        </div>
      )}

      {!d.uploading && d.tipo_mensagem === 'texto' && d.mensagem && (
        <div className="px-3 py-2 rounded-xl bg-muted border border-border/40">
          <p className="text-xs text-foreground/80 leading-relaxed line-clamp-3">{d.mensagem}</p>
        </div>
      )}
      {!d.uploading && d.tipo_mensagem === 'texto' && !d.mensagem && (
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs bg-muted/60 text-muted-foreground border border-dashed border-border">
          <MessageSquare className="w-3 h-3" />Sem mensagem
        </span>
      )}

      {!d.uploading && d.tipo_mensagem === 'imagem' && (
        d.media_url ? (
          <div className="rounded-xl overflow-hidden border border-border/50 relative">
            <img src={d.media_url} alt="" className="w-full object-cover" style={{ height: 88 }} />
            <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
            <span className="absolute bottom-1.5 left-1.5 text-[10px] bg-black/50 text-white px-1.5 py-0.5 rounded font-medium backdrop-blur-sm">
              Imagem
            </span>
            {d.mensagem && (
              <span className="absolute bottom-1.5 right-1.5 text-[10px] bg-black/50 text-white px-1.5 py-0.5 rounded backdrop-blur-sm max-w-[100px] truncate">
                {d.mensagem}
              </span>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-muted/60 border border-dashed border-border text-xs text-muted-foreground">
            <ImageIcon className="w-3.5 h-3.5 text-emerald-500" />Adicionar imagem
          </div>
        )
      )}

      {!d.uploading && d.tipo_mensagem === 'video' && (
        d.media_url ? (
          <div className="rounded-xl overflow-hidden border border-border/50 bg-black/80 relative flex items-center justify-center" style={{ height: 88 }}>
            <div className="w-9 h-9 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
              <Play className="w-4 h-4 text-white ml-0.5" fill="white" />
            </div>
            <span className="absolute bottom-1.5 left-1.5 text-[10px] bg-black/50 text-white px-1.5 py-0.5 rounded font-medium backdrop-blur-sm">
              Vídeo
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-muted/60 border border-dashed border-border text-xs text-muted-foreground">
            <Video className="w-3.5 h-3.5 text-purple-500" />Adicionar vídeo
          </div>
        )
      )}

      {!d.uploading && (d.tipo_mensagem === 'audio' || d.tipo_mensagem === 'ptt') && (
        d.media_url ? (
          <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-muted border border-border/50">
            <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <Mic className="w-3.5 h-3.5 text-primary" />
            </div>
            <div className="flex items-end gap-px flex-1 h-5">
              {BARS.map((h, i) => (
                <div key={i} className="rounded-full bg-primary/50 flex-1" style={{ height: `${h}px` }} />
              ))}
            </div>
            <span className="text-[10px] text-muted-foreground shrink-0 font-mono">0:08</span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-muted/60 border border-dashed border-border text-xs text-muted-foreground">
            <Mic className="w-3.5 h-3.5 text-rose-500" />Gravar áudio
          </div>
        )
      )}

      {!d.uploading && d.tipo_mensagem === 'documento' && (
        d.media_url ? (
          <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-muted border border-border/50">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 flex-col gap-0">
              <FileText className="w-4 h-4 text-primary" />
              <span className="text-[8px] font-bold text-primary/70 leading-none">{docExt}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-foreground truncate">
                {d.media_name || 'documento.' + docExt.toLowerCase()}
              </p>
              <p className="text-[10px] text-muted-foreground">{docExt} · Documento</p>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-muted/60 border border-dashed border-border text-xs text-muted-foreground">
            <FileText className="w-3.5 h-3.5 text-amber-500" />Adicionar documento
          </div>
        )
      )}
    </NodeShell>
  );
}

function WaitNode({ data, selected }: NodeProps) {
  const d = data as WaitNodeData;
  return (
    <NodeShell selected={selected} header={<NodeHeader icon={Clock} label="Aguardar" />} execState={d._execState} execError={d._execError}>
      <Handle type="target" position={Position.Left} className={HANDLE_CLS} />
      <Handle type="source" position={Position.Right} className={HANDLE_CLS} />
      <Chip active={selected}>Aguardar {d.dia_offset} dia{d.dia_offset !== 1 ? 's' : ''}</Chip>
    </NodeShell>
  );
}

function ConditionNode({ data, selected }: NodeProps) {
  const d = data as ConditionNodeData;
  return (
    <NodeShell selected={selected} header={<NodeHeader icon={GitBranch} label="Condição" />} execState={d._execState} execError={d._execError}>
      <Handle type="target" position={Position.Left} className={HANDLE_CLS} />
      <Handle id="sim" type="source" position={Position.Top} style={{ left: '75%' }} className="!w-2.5 !h-2.5 !bg-primary/60 !border !border-primary/40 !rounded-full" />
      <Handle id="nao" type="source" position={Position.Bottom} style={{ left: '75%' }} className="!w-2.5 !h-2.5 !bg-destructive/60 !border !border-destructive/40 !rounded-full" />
      <Chip active={selected}>{d.condicao || 'Respondeu?'}</Chip>
      <div className="flex gap-1.5">
        <span className="text-[10px] text-primary/70 px-2 py-0.5 rounded bg-primary/10">↑ Sim</span>
        <span className="text-[10px] text-destructive/70 px-2 py-0.5 rounded bg-destructive/10">↓ Não</span>
      </div>
    </NodeShell>
  );
}

function EndNode({ data, selected }: NodeProps) {
  const d = data as EndNodeData;
  return (
    <NodeShell selected={selected} redAccent header={<NodeHeader icon={XCircle} label="Fim" />} execState={d._execState} execError={d._execError}>
      <Handle type="target" position={Position.Left} className={HANDLE_CLS} />
      <Chip>Encerrar sequência</Chip>
    </NodeShell>
  );
}

function WebhookNode({ data, selected }: NodeProps) {
  const d = data as WebhookNodeData;
  const domain = d.url ? getDomain(d.url) : 'URL não configurada';
  return (
    <NodeShell selected={selected} header={<NodeHeader icon={Globe} label="Webhook" />} execState={d._execState} execError={d._execError}>
      <Handle type="target" position={Position.Left} className={HANDLE_CLS} />
      <Handle type="source" position={Position.Right} className={HANDLE_CLS} />
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wide',
          d.method === 'POST' ? 'bg-primary/10 text-primary' : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400')}>
          {d.method}
        </span>
        <span className="text-xs text-muted-foreground truncate max-w-[130px]">{truncate(domain, 20)}</span>
      </div>
    </NodeShell>
  );
}

function LeadScoreNode({ data, selected }: NodeProps) {
  const d = data as LeadScoreNodeData;
  return (
    <NodeShell selected={selected} header={<NodeHeader icon={Star} label="Lead Score" />} execState={d._execState} execError={d._execError}>
      <Handle type="target" position={Position.Left} className={HANDLE_CLS} />
      <Handle id="source-top" type="source" position={Position.Top} style={{ left: '75%' }} className="!w-2.5 !h-2.5 !bg-amber-500/60 !border !border-amber-500/40 !rounded-full" />
      <Handle id="source-bottom" type="source" position={Position.Bottom} style={{ left: '75%' }} className="!w-2.5 !h-2.5 !bg-muted !border !border-border !rounded-full" />
      <Chip active={selected}>Score {d.scoreMin}–{d.scoreMax}</Chip>
      <div className="flex gap-1.5">
        <span className="text-[10px] text-amber-500/80 px-2 py-0.5 rounded bg-amber-500/10">↑ Acima</span>
        <span className="text-[10px] text-muted-foreground px-2 py-0.5 rounded bg-muted">↓ Abaixo</span>
      </div>
    </NodeShell>
  );
}

function ABTestNode({ data, selected }: NodeProps) {
  const d = data as ABTestNodeData;
  return (
    <NodeShell selected={selected} header={<NodeHeader icon={GitMerge} label="Teste A/B" />} execState={d._execState} execError={d._execError}>
      <Handle type="target" position={Position.Left} className={HANDLE_CLS} />
      <Handle id="source-top" type="source" position={Position.Top} style={{ left: '75%' }} className="!w-2.5 !h-2.5 !bg-violet-500/60 !border !border-violet-500/40 !rounded-full" />
      <Handle id="source-bottom" type="source" position={Position.Bottom} style={{ left: '75%' }} className="!w-2.5 !h-2.5 !bg-cyan-500/60 !border !border-cyan-500/40 !rounded-full" />
      <Chip active={selected}>A/B 50% / 50%</Chip>
      <div className="flex gap-1.5">
        <span className="text-[10px] text-violet-500/80 px-2 py-0.5 rounded bg-violet-500/10">↑ A: {truncate(d.variantA, 8) || 'Variante A'}</span>
        <span className="text-[10px] text-cyan-600/80 dark:text-cyan-400/80 px-2 py-0.5 rounded bg-cyan-500/10">↓ B: {truncate(d.variantB, 8) || 'Variante B'}</span>
      </div>
    </NodeShell>
  );
}

const nodeTypes = {
  triggerNode: TriggerNode,
  messageNode: MessageNode,
  waitNode: WaitNode,
  conditionNode: ConditionNode,
  endNode: EndNode,
  webhookNode: WebhookNode,
  leadScoreNode: LeadScoreNode,
  abTestNode: ABTestNode,
};

// ─── Upload components ──────────────────────────────────────────────────────────

function UploadZone({ accept, label, current, onUploadStart, onUpload }: {
  accept: string; label: string; current?: string;
  onUploadStart?: () => void;
  onUpload: (url: string, name?: string) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  async function handleFile(file: File) {
    setUploading(true);
    onUploadStart?.();
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/follow/upload', { method: 'POST', body: fd });
      const data = await res.json();
      if (res.ok) onUpload(data.url, data.name ?? file.name);
    } finally { setUploading(false); }
  }

  function openPicker() {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = accept;
    input.onchange = (e) => { const f = (e.target as HTMLInputElement).files?.[0]; if (f) handleFile(f); };
    input.click();
  }

  return (
    <div
      onClick={!uploading ? openPicker : undefined}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f && !uploading) handleFile(f); }}
      className={cn('border-2 border-dashed rounded-xl p-4 text-center transition-all select-none',
        !uploading && 'cursor-pointer',
        dragOver ? 'border-primary bg-primary/5 scale-[1.01]' : 'border-border hover:border-primary/40 hover:bg-muted/30',
        uploading && 'opacity-60 pointer-events-none')}
    >
      {uploading ? (
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          <span className="text-xs text-muted-foreground">Enviando…</span>
        </div>
      ) : current ? (
        <div className="flex items-center gap-2 justify-center py-1">
          <CheckCircle2 className="w-4 h-4 text-primary" />
          <span className="text-xs text-primary font-medium">Arquivo enviado · clique para trocar</span>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-1.5 py-1">
          <Upload className="w-5 h-5 text-muted-foreground/40" />
          <span className="text-xs font-medium text-muted-foreground">{label}</span>
          <span className="text-[10px] text-muted-foreground/60">Clique ou arraste aqui</span>
        </div>
      )}
    </div>
  );
}

function AudioRecorder({ current, onUploadStart, onUpload }: {
  current?: string; onUploadStart?: () => void; onUpload: (url: string) => void;
}) {
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [uploading, setUploading] = useState(false);
  const mrRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function start() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      chunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.onstop = async () => {
        setUploading(true); onUploadStart?.();
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        const file = new File([blob], `audio-${Date.now()}.webm`, { type: 'audio/webm' });
        const fd = new FormData(); fd.append('file', file);
        try {
          const res = await fetch('/api/follow/upload', { method: 'POST', body: fd });
          const data = await res.json();
          if (res.ok) onUpload(data.url);
        } finally { setUploading(false); stream.getTracks().forEach((t) => t.stop()); }
      };
      mr.start(); mrRef.current = mr; setRecording(true); setSeconds(0);
      timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    } catch { /* permission denied */ }
  }

  function stop() { mrRef.current?.stop(); if (timerRef.current) clearInterval(timerRef.current); setRecording(false); }

  const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  return (
    <div className="space-y-2">
      {recording ? (
        <div className="flex items-center gap-3 p-3 rounded-xl border border-destructive/30 bg-destructive/5">
          <div className="w-2 h-2 rounded-full bg-destructive animate-pulse shrink-0" />
          <span className="font-mono text-sm text-destructive flex-1">{fmt(seconds)}</span>
          <button onClick={stop} className="flex items-center gap-1.5 text-xs text-destructive border border-destructive/30 px-2.5 py-1 rounded-lg hover:bg-destructive/10 transition-colors">
            <Square className="w-3 h-3" /> Parar
          </button>
        </div>
      ) : uploading ? (
        <div className="flex items-center gap-2 p-3 rounded-xl border border-border bg-muted/20">
          <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
          <span className="text-xs text-muted-foreground">Enviando áudio…</span>
        </div>
      ) : (
        <button onClick={start} className="w-full flex items-center justify-center gap-2 h-10 rounded-xl border border-border bg-muted hover:bg-accent transition-colors text-sm text-muted-foreground hover:text-foreground">
          <Mic className="w-4 h-4 text-rose-500" />
          {current ? 'Regravar áudio' : 'Gravar áudio'}
        </button>
      )}
      {current && !recording && !uploading && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/10 border border-primary/20">
          <CheckCircle2 className="w-3.5 h-3.5 text-primary shrink-0" />
          <span className="text-xs text-primary font-medium">Áudio gravado com sucesso</span>
        </div>
      )}
    </div>
  );
}

// ─── Config Panel ───────────────────────────────────────────────────────────────

const TIPO_OPTIONS = [
  { value: 'texto',     label: 'Texto',    icon: MessageSquare },
  { value: 'imagem',    label: 'Imagem',   icon: ImageIcon },
  { value: 'video',     label: 'Vídeo',    icon: Video },
  { value: 'audio',     label: 'Áudio',    icon: Mic },
  { value: 'ptt',       label: 'PTT',      icon: Mic },
  { value: 'documento', label: 'Doc',      icon: FileText },
] as const;

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
const MINUTES = ['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55'];

interface ConfigPanelProps {
  node: Node<AutoNodeData> | null;
  onClose: () => void;
  onUpdate: (id: string, patch: Partial<AutoNodeData>) => void;
  onDelete: (id: string) => void;
}

function ConfigPanel({ node, onClose, onUpdate, onDelete }: ConfigPanelProps) {
  if (!node) return null;
  const d = node.data;

  const [hh, mm] = d.kind === 'message' ? (d.horario || '09:00').split(':') : ['09', '00'];

  return (
    <div className="w-72 bg-card border-l border-border h-full flex flex-col overflow-y-auto">
      <div className="flex items-center justify-between px-4 h-12 border-b border-border flex-shrink-0">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Configurar</span>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="p-4 flex flex-col gap-5 overflow-y-auto flex-1">

        {/* ── Message node ── */}
        {d.kind === 'message' && (
          <>
            <Field label="Dia offset">
              <input type="number" min={0} value={d.dia_offset}
                onChange={(e) => onUpdate(node.id, { dia_offset: Number(e.target.value) })}
                className="field-input" />
            </Field>

            <Field label="Horário">
              <div className="flex items-center gap-2">
                <select
                  value={hh}
                  onChange={(e) => onUpdate(node.id, { horario: `${e.target.value}:${mm}` })}
                  className="field-input flex-1 text-center font-mono"
                >
                  {HOURS.map((h) => <option key={h} value={h}>{h}</option>)}
                </select>
                <span className="text-muted-foreground font-bold text-lg">:</span>
                <select
                  value={MINUTES.includes(mm) ? mm : '00'}
                  onChange={(e) => onUpdate(node.id, { horario: `${hh}:${e.target.value}` })}
                  className="field-input flex-1 text-center font-mono"
                >
                  {MINUTES.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
            </Field>

            <Field label="Tipo de mensagem">
              <div className="grid grid-cols-3 gap-1.5">
                {TIPO_OPTIONS.map(({ value, label, icon: Icon }) => (
                  <button key={value}
                    onClick={() => onUpdate(node.id, { tipo_mensagem: value, media_url: undefined, uploading: false })}
                    className={cn('flex flex-col items-center gap-1 px-2 py-2 rounded-xl border text-xs transition-all',
                      d.tipo_mensagem === value ? 'border-primary/50 bg-primary/10 text-primary' : 'border-border bg-muted text-muted-foreground hover:bg-accent hover:text-foreground')}
                  >
                    <Icon className="w-4 h-4" />
                    {label}
                  </button>
                ))}
              </div>
            </Field>

            {d.tipo_mensagem === 'texto' && (
              <Field label="Mensagem">
                <textarea rows={4} value={d.mensagem ?? ''}
                  onChange={(e) => onUpdate(node.id, { mensagem: e.target.value })}
                  placeholder="Digite a mensagem aqui..."
                  className="field-input resize-none" />
              </Field>
            )}

            {d.tipo_mensagem === 'imagem' && (
              <>
                <Field label="Arquivo">
                  <UploadZone accept="image/*" label="Enviar imagem" current={d.media_url}
                    onUploadStart={() => onUpdate(node.id, { uploading: true })}
                    onUpload={(url) => onUpdate(node.id, { media_url: url, uploading: false })} />
                </Field>
                {d.media_url && (
                  <div className="rounded-xl overflow-hidden border border-border">
                    <img src={d.media_url} alt="preview" className="w-full h-32 object-cover" />
                  </div>
                )}
                <Field label="Legenda (opcional)">
                  <input type="text" value={d.mensagem ?? ''}
                    onChange={(e) => onUpdate(node.id, { mensagem: e.target.value })}
                    placeholder="Legenda da imagem…" className="field-input" />
                </Field>
              </>
            )}

            {d.tipo_mensagem === 'video' && (
              <>
                <Field label="Arquivo">
                  <UploadZone accept="video/*" label="Enviar vídeo" current={d.media_url}
                    onUploadStart={() => onUpdate(node.id, { uploading: true })}
                    onUpload={(url) => onUpdate(node.id, { media_url: url, uploading: false })} />
                </Field>
                <Field label="Legenda (opcional)">
                  <input type="text" value={d.mensagem ?? ''}
                    onChange={(e) => onUpdate(node.id, { mensagem: e.target.value })}
                    placeholder="Legenda do vídeo…" className="field-input" />
                </Field>
              </>
            )}

            {(d.tipo_mensagem === 'audio' || d.tipo_mensagem === 'ptt') && (
              <Field label="Áudio">
                <AudioRecorder current={d.media_url}
                  onUploadStart={() => onUpdate(node.id, { uploading: true })}
                  onUpload={(url) => onUpdate(node.id, { media_url: url, uploading: false })} />
                <div className="relative my-1">
                  <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border" /></div>
                  <div className="relative flex justify-center"><span className="bg-card px-2 text-[10px] text-muted-foreground">ou enviar arquivo</span></div>
                </div>
                <UploadZone accept="audio/*" label="Enviar arquivo de áudio" current={undefined}
                  onUploadStart={() => onUpdate(node.id, { uploading: true })}
                  onUpload={(url) => onUpdate(node.id, { media_url: url, uploading: false })} />
              </Field>
            )}

            {d.tipo_mensagem === 'documento' && (
              <Field label="Documento">
                <UploadZone accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.csv,.txt,.zip" label="Enviar documento" current={d.media_url}
                  onUploadStart={() => onUpdate(node.id, { uploading: true })}
                  onUpload={(url, name) => onUpdate(node.id, { media_url: url, media_name: name, uploading: false })} />
              </Field>
            )}
          </>
        )}

        {/* ── Wait node ── */}
        {d.kind === 'wait' && (
          <Field label="Aguardar (dias)">
            <input type="number" min={1} value={d.dia_offset}
              onChange={(e) => onUpdate(node.id, { dia_offset: Number(e.target.value) })}
              className="field-input" />
          </Field>
        )}

        {/* ── Condition node ── */}
        {d.kind === 'condition' && (
          <Field label="Condição">
            <input type="text" value={d.condicao}
              onChange={(e) => onUpdate(node.id, { condicao: e.target.value })}
              placeholder="ex: Respondeu?" className="field-input" />
          </Field>
        )}

        {/* ── Trigger node ── */}
        {d.kind === 'trigger' && (
          <>
            <Field label="Nome da sequência">
              <input type="text" value={d.label}
                onChange={(e) => onUpdate(node.id, { label: e.target.value })}
                className="field-input" />
            </Field>
            <Field label="Condição de início">
              <input type="text" value={d.condicao}
                onChange={(e) => onUpdate(node.id, { condicao: e.target.value })}
                className="field-input" />
            </Field>
          </>
        )}

        {/* ── Webhook node ── */}
        {d.kind === 'webhook' && (
          <>
            <Field label="URL">
              <input type="url" value={d.url}
                onChange={(e) => onUpdate(node.id, { url: e.target.value })}
                placeholder="https://hooks.exemplo.com/..." className="field-input" />
            </Field>
            <Field label="Método">
              <select value={d.method}
                onChange={(e) => onUpdate(node.id, { method: e.target.value as 'POST' | 'GET' })}
                className="field-input">
                <option value="POST">POST</option>
                <option value="GET">GET</option>
              </select>
            </Field>
          </>
        )}

        {/* ── Lead Score node ── */}
        {d.kind === 'lead_score' && (
          <>
            <Field label="Score mínimo">
              <input type="number" min={0} max={100} value={d.scoreMin}
                onChange={(e) => onUpdate(node.id, { scoreMin: Number(e.target.value) })}
                className="field-input" />
            </Field>
            <Field label="Score máximo">
              <input type="number" min={0} max={100} value={d.scoreMax}
                onChange={(e) => onUpdate(node.id, { scoreMax: Number(e.target.value) })}
                className="field-input" />
            </Field>
          </>
        )}

        {/* ── A/B Test node ── */}
        {d.kind === 'ab_test' && (
          <>
            <Field label="Variante A">
              <input type="text" value={d.variantA}
                onChange={(e) => onUpdate(node.id, { variantA: e.target.value })}
                placeholder="Nome da variante A" className="field-input" />
            </Field>
            <Field label="Variante B">
              <input type="text" value={d.variantB}
                onChange={(e) => onUpdate(node.id, { variantB: e.target.value })}
                placeholder="Nome da variante B" className="field-input" />
            </Field>
          </>
        )}

        {d.kind !== 'trigger' && (
          <button onClick={() => { onDelete(node.id); onClose(); }}
            className="mt-auto w-full py-2 rounded-xl bg-destructive/10 text-destructive text-sm font-medium hover:bg-destructive/20 transition-colors border border-destructive/20">
            Remover nó
          </button>
        )}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">{label}</label>
      {children}
    </div>
  );
}

// ─── Palette ────────────────────────────────────────────────────────────────────

type PaletteKind = 'message' | 'wait' | 'condition' | 'end' | 'webhook' | 'lead_score' | 'ab_test';

interface PaletteItem {
  label: string; desc: string; kind: PaletteKind;
  icon: React.ElementType; bgClass: string; iconClass: string;
}

const PALETTE_ITEMS: PaletteItem[] = [
  { label: 'Mensagem', desc: 'Enviar texto, áudio ou mídia', kind: 'message', icon: MessageSquare, bgClass: 'bg-primary/10', iconClass: 'text-primary' },
  { label: 'Aguardar', desc: 'Pausa entre mensagens', kind: 'wait', icon: Clock, bgClass: 'bg-amber-500/10', iconClass: 'text-amber-500' },
  { label: 'Condição', desc: 'Ramificar por resposta', kind: 'condition', icon: GitBranch, bgClass: 'bg-violet-500/10', iconClass: 'text-violet-500' },
  { label: 'Encerrar', desc: 'Finalizar a sequência', kind: 'end', icon: XCircle, bgClass: 'bg-destructive/10', iconClass: 'text-destructive' },
  { label: 'Webhook', desc: 'Chamar URL externa', kind: 'webhook', icon: Globe, bgClass: 'bg-sky-500/10', iconClass: 'text-sky-500' },
  { label: 'Lead Score', desc: 'Filtrar por pontuação do lead', kind: 'lead_score', icon: Star, bgClass: 'bg-amber-500/10', iconClass: 'text-amber-500' },
  { label: 'Teste A/B', desc: 'Dividir tráfego entre variantes', kind: 'ab_test', icon: GitMerge, bgClass: 'bg-violet-500/10', iconClass: 'text-violet-500' },
];

function PalettePanel({ onAdd, onClose }: { onAdd: (kind: PaletteKind) => void; onClose: () => void }) {
  const [search, setSearch] = useState('');
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      const target = e.target;
      if (panelRef.current && target instanceof Element && !panelRef.current.contains(target)) onClose();
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [onClose]);

  const filtered = PALETTE_ITEMS.filter(
    (item) => !search || item.label.toLowerCase().includes(search.toLowerCase()) || item.desc.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div ref={panelRef} className="absolute right-16 top-1/2 -translate-y-1/2 z-20 w-64 bg-card border border-border rounded-2xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-right-2 duration-150">
      <div className="px-4 py-3 border-b border-border space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">O que acontece a seguir?</p>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors"><X className="w-3.5 h-3.5" /></button>
        </div>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <input autoFocus value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar nó…"
            className="w-full h-8 pl-8 pr-3 text-sm bg-muted rounded-lg outline-none text-foreground placeholder:text-muted-foreground" />
        </div>
      </div>
      <div className="p-2 space-y-0.5">
        {filtered.length === 0 ? (
          <p className="text-center text-xs text-muted-foreground py-4">Nenhum resultado</p>
        ) : filtered.map((item) => {
          const Icon = item.icon;
          return (
            <button key={item.kind} onClick={() => { onAdd(item.kind); onClose(); }}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm hover:bg-muted transition-colors text-left">
              <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center shrink-0', item.bgClass)}>
                <Icon className={cn('w-4 h-4', item.iconClass)} />
              </div>
              <div className="min-w-0">
                <p className="font-medium text-foreground">{item.label}</p>
                <p className="text-xs text-muted-foreground truncate">{item.desc}</p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Executions view ────────────────────────────────────────────────────────────

const MOCK_EXECUTIONS: ExecLog[] = [
  { id: '1', lead: 'João Silva', sequence: 'Follow-up Geral', step: 'Mensagem — Dia 1', status: 'sent', ts: 'hoje, 14:32' },
  { id: '2', lead: 'Maria Costa', sequence: 'Anti-Noshow', step: 'Mensagem — Dia 0', status: 'sent', ts: 'hoje, 13:10' },
  { id: '3', lead: 'Carlos Mendes', sequence: 'Remarketing', step: 'Mensagem — Dia 3', status: 'failed', ts: 'hoje, 11:55' },
  { id: '4', lead: 'Ana Ferreira', sequence: 'Follow-up Geral', step: 'Aguardar — Dia 2', status: 'pending', ts: 'hoje, 09:00' },
];

function ExecutionsView({ tipo }: { tipo: SequenceTipo }) {
  const label: Record<SequenceTipo, string> = { follow_geral: 'Follow-up', anti_noshow: 'Anti-Noshow', remarketing: 'Remarketing', trial_saas: 'Trial SaaS' };
  const executions = MOCK_EXECUTIONS.filter((e) => e.sequence.toLowerCase().includes(label[tipo].toLowerCase()));

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-2xl mx-auto p-6 space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-foreground">Execuções recentes</p>
          <span className="text-xs text-muted-foreground">{label[tipo]}</span>
        </div>
        {executions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <Clock3 className="w-10 h-10 text-muted-foreground/30" />
            <div className="text-center">
              <p className="text-sm font-medium text-muted-foreground">Nenhuma execução registrada</p>
              <p className="text-xs text-muted-foreground/70">As execuções aparecerão aqui em tempo real</p>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {executions.map((exec) => (
              <div key={exec.id} className="flex items-center gap-3 p-3.5 rounded-xl border border-border bg-card">
                <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center shrink-0',
                  exec.status === 'sent' ? 'bg-primary/10' : exec.status === 'failed' ? 'bg-destructive/10' : 'bg-muted')}>
                  {exec.status === 'sent' ? <CheckCheck className="w-4 h-4 text-primary" />
                    : exec.status === 'failed' ? <AlertCircle className="w-4 h-4 text-destructive" />
                    : <Clock3 className="w-4 h-4 text-muted-foreground" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{exec.lead}</p>
                  <p className="text-xs text-muted-foreground truncate">{exec.step}</p>
                </div>
                <div className="text-right shrink-0">
                  <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full border uppercase tracking-wide',
                    exec.status === 'sent' ? 'bg-primary/10 text-primary border-primary/20'
                      : exec.status === 'failed' ? 'bg-destructive/10 text-destructive border-destructive/20'
                      : 'bg-muted text-muted-foreground border-border')}>
                    {exec.status === 'sent' ? 'Enviado' : exec.status === 'failed' ? 'Falhou' : 'Pendente'}
                  </span>
                  <p className="text-[10px] text-muted-foreground mt-1">{exec.ts}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Sequence tabs ───────────────────────────────────────────────────────────────

const SEQ_TABS: { label: string; tipo: SequenceTipo }[] = [
  { label: 'Follow-up', tipo: 'follow_geral' },
  { label: 'Anti-Noshow', tipo: 'anti_noshow' },
  { label: 'Remarketing', tipo: 'remarketing' },
  { label: 'Trial SaaS', tipo: 'trial_saas' },
];

// ─── Modals ──────────────────────────────────────────────────────────────────────

interface ModalOverlayProps {
  onClose?: () => void;
  children: React.ReactNode;
}

function ModalOverlay({ children, onClose }: ModalOverlayProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

// ─── Test Run Modal ──────────────────────────────────────────────────────────────

interface TestRunModalProps {
  onStart: (phone: string, dryRun: boolean) => void;
  onClose: () => void;
}

function TestRunModal({ onStart, onClose }: TestRunModalProps) {
  const [phone, setPhone] = useState('');
  const [dryRun, setDryRun] = useState(false);

  return (
    <ModalOverlay onClose={onClose}>
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-80 p-5 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-foreground">Executar teste</p>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
        </div>
        <Field label="Número de teste">
          <input type="text" value={phone} onChange={(e) => setPhone(e.target.value)}
            placeholder="5511999999999" className="field-input" />
        </Field>
        <div className="rounded-xl border border-border overflow-hidden">
          <button
            type="button"
            onClick={() => setDryRun(false)}
            className={cn('w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm transition-colors', !dryRun ? 'bg-primary text-primary-foreground font-medium' : 'text-muted-foreground hover:bg-muted/50')}>
            <Play className="w-3.5 h-3.5 shrink-0" />
            <div className="text-left">
              <div className="font-medium leading-tight">Enviar de verdade</div>
              <div className={cn('text-xs leading-tight', !dryRun ? 'text-primary-foreground/70' : 'text-muted-foreground/70')}>Dispara a mensagem pro número informado</div>
            </div>
          </button>
          <div className="border-t border-border" />
          <button
            type="button"
            onClick={() => setDryRun(true)}
            className={cn('w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm transition-colors', dryRun ? 'bg-primary text-primary-foreground font-medium' : 'text-muted-foreground hover:bg-muted/50')}>
            <FlaskConical className="w-3.5 h-3.5 shrink-0" />
            <div className="text-left">
              <div className="font-medium leading-tight">Só simular</div>
              <div className={cn('text-xs leading-tight', dryRun ? 'text-primary-foreground/70' : 'text-muted-foreground/70')}>Visualiza o fluxo sem enviar nada</div>
            </div>
          </button>
        </div>
        <button
          onClick={() => { if (phone.trim()) { onStart(phone.trim(), dryRun); onClose(); } }}
          disabled={!phone.trim()}
          className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed">
          {dryRun ? 'Simular fluxo' : 'Disparar teste'}
        </button>
      </div>
    </ModalOverlay>
  );
}

// ─── Condition Choice Modal ──────────────────────────────────────────────────────

interface ConditionChoiceModalProps {
  nodeId: string;
  condicao: string;
  onChoose: (nodeId: string, choice: 'sim' | 'nao') => void;
}

function ConditionChoiceModal({ nodeId, condicao, onChoose }: ConditionChoiceModalProps) {
  return (
    <ModalOverlay>
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-80 p-5 flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <p className="text-sm font-semibold text-foreground">Qual caminho?</p>
          <p className="text-xs text-muted-foreground">Condição: {condicao}</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => onChoose(nodeId, 'sim')}
            className="flex-1 py-2.5 rounded-xl bg-primary/10 border border-primary/30 text-primary text-sm font-semibold hover:bg-primary/20 transition-colors">
            ↑ Sim
          </button>
          <button
            onClick={() => onChoose(nodeId, 'nao')}
            className="flex-1 py-2.5 rounded-xl bg-destructive/10 border border-destructive/30 text-destructive text-sm font-semibold hover:bg-destructive/20 transition-colors">
            ↓ Não
          </button>
        </div>
      </div>
    </ModalOverlay>
  );
}

// ─── Templates Modal ─────────────────────────────────────────────────────────────

interface TemplatesModalProps {
  onUse: (template: CanvasTemplate) => void;
  onClose: () => void;
}

function TemplatesModal({ onUse, onClose }: TemplatesModalProps) {
  const templates = buildTemplates();
  return (
    <ModalOverlay onClose={onClose}>
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-[520px] max-h-[80vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border flex-shrink-0">
          <p className="text-sm font-semibold text-foreground">Templates</p>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-4 grid gap-3 overflow-y-auto">
          {templates.map((tpl) => {
            const Icon = tpl.icon;
            return (
              <div key={tpl.id} className="flex items-start gap-4 p-4 rounded-xl border border-border bg-muted/30 hover:bg-muted/60 transition-colors">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <Icon className="w-6 h-6 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-foreground">{tpl.name}</p>
                    <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-muted text-muted-foreground border border-border">
                      {tpl.nodes.length} nós
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{tpl.desc}</p>
                </div>
                <button
                  onClick={() => onUse(tpl)}
                  className="flex-shrink-0 px-3 py-1.5 rounded-lg bg-primary/10 border border-primary/30 text-primary text-xs font-semibold hover:bg-primary/20 transition-colors">
                  Usar template
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </ModalOverlay>
  );
}

// ─── Versions Dropdown ───────────────────────────────────────────────────────────

interface VersionsDropdownProps {
  versions: CanvasVersion[];
  onRestore: (v: CanvasVersion) => void;
  onClose: () => void;
}

function VersionsDropdown({ versions, onRestore, onClose }: VersionsDropdownProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && e.target instanceof Element && !ref.current.contains(e.target)) onClose();
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [onClose]);

  return (
    <div ref={ref} className="absolute right-0 top-full mt-1 z-30 w-72 bg-card border border-border rounded-xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150">
      <div className="px-3 py-2 border-b border-border">
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Versões salvas</p>
      </div>
      {versions.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-6">Nenhuma versão salva ainda</p>
      ) : (
        <div className="p-1 space-y-0.5">
          {[...versions].reverse().map((v, i) => (
            <button key={v.ts}
              onClick={() => { onRestore(v); onClose(); }}
              className="w-full text-left px-3 py-2 rounded-lg text-xs text-foreground hover:bg-muted transition-colors">
              {formatVersionLabel(v, versions.length - 1 - i, versions.length)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Canvas inner ────────────────────────────────────────────────────────────────

function CanvasInner() {
  const { screenToFlowPosition } = useReactFlow();

  const [mode, setMode] = useState<'editor' | 'execucoes'>('editor');
  const [activeTipo, setActiveTipo] = useState<SequenceTipo>('follow_geral');
  const [sequences, setSequences] = useState<FollowSequence[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveOk, setSaveOk] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);

  // Versioning
  const [versionsOpen, setVersionsOpen] = useState(false);
  const [versions, setVersions] = useState<CanvasVersion[]>([]);

  // Templates
  const [templatesOpen, setTemplatesOpen] = useState(false);

  // Test run
  const [testModalOpen, setTestModalOpen] = useState(false);
  const [testRunning, setTestRunning] = useState(false);
  const [conditionChoiceState, setConditionChoiceState] = useState<{ nodeId: string; condicao: string; resolve: (choice: 'sim' | 'nao') => void } | null>(null);
  const abortTestRef = useRef(false);

  // Conflict
  const conflictCount = sequences.filter((s) => s.ativo).length;

  const currentSeq = sequences.find((s) => s.tipo === activeTipo) ?? null;

  const [nodes, setNodes, onNodesChange] = useNodesState<Node<AutoNodeData>>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const selectedNode = nodes.find((n) => n.id === selectedNodeId) ?? null;

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/follow/sequences');
        if (!res.ok) throw new Error('fetch failed');
        const json = (await res.json()) as { sequences: FollowSequence[] };
        setSequences(json.sequences ?? []);
      } catch (err) { console.error('[AutomationCanvas]', err); }
      finally { setLoading(false); }
    }
    load();
  }, []);

  useEffect(() => {
    if (!currentSeq) { setNodes([]); setEdges([]); return; }
    setNodes(stepsToNodes(currentSeq.follow_steps, currentSeq.nome));
    setEdges(stepsToEdges(currentSeq.follow_steps));
    setSelectedNodeId(null);
    setVersions(loadVersions(currentSeq.id));
  }, [currentSeq?.id, activeTipo]); // eslint-disable-line react-hooks/exhaustive-deps

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge({ ...params, ...EDGE_BASE }, eds)),
    [setEdges]
  );

  function addPaletteNode(kind: PaletteKind) {
    const id = newId();
    const center = screenToFlowPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
    let data: AutoNodeData;
    if (kind === 'message') data = { kind: 'message', label: 'Mensagem', dia_offset: 1, horario: '09:00', mensagem: '', tipo_mensagem: 'texto', stepId: id } satisfies MessageNodeData;
    else if (kind === 'wait') data = { kind: 'wait', label: 'Aguardar', dia_offset: 1, stepId: id } satisfies WaitNodeData;
    else if (kind === 'condition') data = { kind: 'condition', label: 'Condição', condicao: 'Respondeu?', stepId: id } satisfies ConditionNodeData;
    else if (kind === 'webhook') data = { kind: 'webhook', label: 'Webhook', url: '', method: 'POST', stepId: id } satisfies WebhookNodeData;
    else if (kind === 'lead_score') data = { kind: 'lead_score', label: 'Lead Score', scoreMin: 60, scoreMax: 100, stepId: id } satisfies LeadScoreNodeData;
    else if (kind === 'ab_test') data = { kind: 'ab_test', label: 'Teste A/B', variantA: 'Variante A', variantB: 'Variante B', stepId: id } satisfies ABTestNodeData;
    else data = { kind: 'end', label: 'Encerrar', stepId: id } satisfies EndNodeData;

    const typeMap: Record<PaletteKind, string> = {
      message: 'messageNode', wait: 'waitNode', condition: 'conditionNode', end: 'endNode',
      webhook: 'webhookNode', lead_score: 'leadScoreNode', ab_test: 'abTestNode',
    };

    const newNode: Node<AutoNodeData> = {
      id,
      type: typeMap[kind],
      position: { x: center.x - 105, y: center.y - 60 },
      data,
    };
    setNodes((nds) => [...nds, newNode]);
  }

  function handleUpdateNode(id: string, patch: Partial<AutoNodeData>) {
    setNodes((nds) => nds.map((n) => n.id === id ? { ...n, data: { ...n.data, ...patch } as AutoNodeData } : n));
  }

  function handleDeleteNode(id: string) {
    setNodes((nds) => nds.filter((n) => n.id !== id));
    setEdges((eds) => eds.filter((e) => (e as Edge).source !== id && (e as Edge).target !== id));
  }

  async function toggleAtivo() {
    if (!currentSeq) return;
    const nextAtivo = !currentSeq.ativo;
    try {
      const res = await fetch(`/api/follow/sequences/${currentSeq.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ativo: nextAtivo }) });
      if (!res.ok) throw new Error('patch failed');
      setSequences((seqs) => seqs.map((s) => s.id === currentSeq.id ? { ...s, ativo: nextAtivo } : s));
    } catch (err) { console.error('[AutomationCanvas] toggle', err); }
  }

  async function createSequence() {
    const labels: Record<SequenceTipo, string> = { follow_geral: 'Follow-up Geral', anti_noshow: 'Anti-Noshow', remarketing: 'Remarketing', trial_saas: 'Trial SaaS' };
    try {
      setLoading(true);
      const res = await fetch('/api/follow/sequences', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nome: labels[activeTipo], tipo: activeTipo, ativo: false, steps: [] }) });
      if (!res.ok) throw new Error('post failed');
      const json = (await res.json()) as { sequence?: FollowSequence; sequences?: FollowSequence[] };
      if (json.sequence) setSequences((seqs) => [...seqs, json.sequence!]);
      else if (json.sequences) setSequences(json.sequences);
    } catch (err) { console.error('[AutomationCanvas] create', err); }
    finally { setLoading(false); }
  }

  async function handleSave() {
    if (!currentSeq) return;
    setSaving(true);
    try {
      // Save version before persisting
      saveVersion(currentSeq.id, nodes, edges);
      setVersions(loadVersions(currentSeq.id));

      const steps = nodesToSteps(nodes);
      const triggerNode = nodes.find((n) => n.id === 'trigger');
      const nome = (triggerNode?.data as TriggerNodeData | undefined)?.label ?? currentSeq.nome;
      const res = await fetch(`/api/follow/sequences/${currentSeq.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nome, tipo: currentSeq.tipo, ativo: currentSeq.ativo, steps }) });
      if (!res.ok) throw new Error('save failed');
      setSaveOk(true);
      setTimeout(() => setSaveOk(false), 2000);
    } catch (err) { console.error('[AutomationCanvas] save', err); }
    finally { setSaving(false); }
  }

  // ─── Test execution ────────────────────────────────────────────────────────────

  function setNodeExecState(nodeId: string, state: ExecState, error?: string) {
    setNodes((nds) => nds.map((n) => n.id === nodeId ? { ...n, data: { ...n.data, _execState: state, _execError: error } as AutoNodeData } : n));
  }

  function clearAllExecStates() {
    setNodes((nds) => nds.map((n) => ({ ...n, data: { ...n.data, _execState: undefined, _execError: undefined } as AutoNodeData })));
  }

  async function waitForConditionChoice(nodeId: string, condicao: string): Promise<'sim' | 'nao'> {
    return new Promise((resolve) => {
      setConditionChoiceState({ nodeId, condicao, resolve });
    });
  }

  async function runTest(phone: string, dryRun: boolean) {
    if (!currentSeq) return;
    abortTestRef.current = false;
    setTestRunning(true);

    // Order nodes: trigger first, then by x position
    const ordered = [
      ...nodes.filter((n) => n.id === 'trigger'),
      ...nodes.filter((n) => n.id !== 'trigger').sort((a, b) => a.position.x - b.position.x),
    ];

    for (const node of ordered) {
      if (abortTestRef.current) break;

      const d = node.data;
      setNodeExecState(node.id, 'running');
      await new Promise((r) => setTimeout(r, 600));

      if (abortTestRef.current) { setNodeExecState(node.id, 'idle'); break; }

      try {
        if (d.kind === 'trigger') {
          setNodeExecState(node.id, 'success');
        } else if (d.kind === 'wait') {
          setNodeExecState(node.id, 'skipped');
        } else if (d.kind === 'end') {
          setNodeExecState(node.id, 'success');
        } else if (d.kind === 'message') {
          if (!dryRun) {
            const res = await fetch(`/api/follow/sequences/${currentSeq.id}/send-test`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ stepId: d.stepId, phone }),
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
          }
          setNodeExecState(node.id, 'success');
        } else if (d.kind === 'condition') {
          // Pause and ask user
          setNodeExecState(node.id, 'running');
          const choice = await waitForConditionChoice(node.id, d.condicao);
          setConditionChoiceState(null);
          setNodeExecState(node.id, choice === 'sim' ? 'success' : 'skipped');
        } else if (d.kind === 'webhook') {
          if (!dryRun) {
            await fetch(d.url, { method: d.method });
          }
          setNodeExecState(node.id, 'success');
        } else if (d.kind === 'ab_test') {
          const variant = Math.random() < 0.5 ? 'A' : 'B';
          setNodeExecState(node.id, 'success', `Variante ${variant} selecionada`);
        } else if (d.kind === 'lead_score') {
          // Always passes in simulation
          setNodeExecState(node.id, 'success');
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Erro desconhecido';
        setNodeExecState(node.id, 'error', msg);
        break;
      }
    }

    setTestRunning(false);
  }

  function stopTest() {
    abortTestRef.current = true;
    setConditionChoiceState(null);
    setTestRunning(false);
  }

  function useTemplate(template: CanvasTemplate) {
    if (!window.confirm('Isso vai substituir o canvas atual. Continuar?')) return;
    setNodes(template.nodes);
    setEdges(template.edges);
    setSelectedNodeId(null);
    setTemplatesOpen(false);
  }

  function restoreVersion(v: CanvasVersion) {
    setNodes(v.nodes);
    setEdges(v.edges);
    setSelectedNodeId(null);
  }

  return (
    <div className="flex flex-col bg-background" style={{ height: '100%' }}>
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 bg-card border-b border-border flex-shrink-0 gap-4" style={{ height: 48 }}>
        <div className="flex items-center gap-3">
          {/* Editor / Execuções */}
          <div className="flex items-center bg-muted rounded-lg p-0.5">
            <button onClick={() => setMode('editor')}
              className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all',
                mode === 'editor' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}>
              <PenLine className="w-3 h-3" />Editor
            </button>
            <button onClick={() => setMode('execucoes')}
              className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all',
                mode === 'execucoes' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}>
              <Play className="w-3 h-3" />Execuções
            </button>
          </div>
          <div className="w-px h-5 bg-border" />
          {/* Sequence tabs */}
          <div className="flex items-center gap-1">
            {SEQ_TABS.map((tab) => (
              <button key={tab.tipo} onClick={() => setActiveTipo(tab.tipo)}
                className={cn('px-3 py-1 rounded-lg text-sm font-medium transition-colors',
                  activeTipo === tab.tipo ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground')}>
                {tab.label}
              </button>
            ))}
          </div>

          {/* Conflict badge */}
          {conflictCount >= 2 && (
            <div className="relative group">
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 text-xs font-semibold cursor-default">
                <AlertCircle className="w-3.5 h-3.5" />
                {conflictCount} sequências ativas
              </div>
              <div className="absolute left-0 top-full mt-1.5 z-30 w-64 bg-card border border-border rounded-xl shadow-xl p-3 text-xs text-muted-foreground leading-relaxed opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity duration-150">
                Leads podem receber mensagens de múltiplas sequências simultaneamente. Considere ativar apenas uma por vez ou configurar regras de exclusão.
              </div>
            </div>
          )}
        </div>

        {/* Right controls */}
        {mode === 'editor' && currentSeq && (
          <div className="flex items-center gap-2">
            {/* Templates */}
            <button onClick={() => setTemplatesOpen(true)}
              title="Templates"
              className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium transition-colors border border-border bg-muted text-muted-foreground hover:bg-accent hover:text-foreground">
              <LayoutTemplate className="w-3.5 h-3.5" />Templates
            </button>

            {/* Versions */}
            <div className="relative">
              <button onClick={() => setVersionsOpen((v) => !v)}
                title="Versões"
                className={cn('flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium transition-colors border',
                  versionsOpen ? 'border-primary/40 bg-primary/10 text-primary' : 'border-border bg-muted text-muted-foreground hover:bg-accent hover:text-foreground')}>
                <History className="w-3.5 h-3.5" />Versões
              </button>
              {versionsOpen && (
                <VersionsDropdown versions={versions} onRestore={restoreVersion} onClose={() => setVersionsOpen(false)} />
              )}
            </div>

            {/* Test run */}
            {testRunning ? (
              <button onClick={stopTest}
                className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium transition-colors border border-destructive/40 bg-destructive/10 text-destructive hover:bg-destructive/20">
                <StopCircle className="w-3.5 h-3.5" />Parar
              </button>
            ) : (
              <button onClick={() => setTestModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium transition-colors border border-border bg-muted text-muted-foreground hover:bg-accent hover:text-foreground">
                <FlaskConical className="w-3.5 h-3.5" />Executar teste
              </button>
            )}

            <div className="w-px h-5 bg-border" />

            <button onClick={toggleAtivo}
              className={cn('flex items-center gap-2 px-3 py-1 rounded-lg text-xs font-medium transition-colors border',
                currentSeq.ativo ? 'bg-primary/10 border-primary/30 text-primary' : 'bg-muted border-border text-muted-foreground')}>
              <span className={cn('w-2 h-2 rounded-full', currentSeq.ativo ? 'bg-primary' : 'bg-muted-foreground/40')} />
              {currentSeq.ativo ? 'Ativo' : 'Inativo'}
            </button>
            <button onClick={handleSave} disabled={saving}
              className={cn('flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-all border',
                saveOk ? 'bg-primary/10 border-primary/30 text-primary' : 'bg-muted border-border text-foreground hover:bg-accent')}>
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : saveOk ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
              {saveOk ? 'Salvo!' : 'Salvar'}
            </button>
          </div>
        )}
      </div>

      {/* Body */}
      <div className="flex min-h-0" style={{ flex: 1 }}>
        {mode === 'execucoes' ? (
          <ExecutionsView tipo={activeTipo} />
        ) : (
          <>
            {/* Canvas */}
            <div className="relative overflow-hidden" style={{ flex: 1 }}>
              {loading ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="w-6 h-6 text-muted-foreground animate-spin" />
                </div>
              ) : !currentSeq ? (
                <div className="flex flex-col items-center justify-center h-full gap-4">
                  <p className="text-muted-foreground text-sm">Nenhuma sequência encontrada para esta aba.</p>
                  <button onClick={createSequence}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary/10 border border-primary/30 text-primary text-sm font-semibold hover:bg-primary/20 transition-colors">
                    <Plus className="w-4 h-4" />Criar sequência
                  </button>
                </div>
              ) : (
                <>
                  <ReactFlow
                    nodes={nodes} edges={edges}
                    onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onConnect={onConnect}
                    nodeTypes={nodeTypes}
                    onNodeClick={(_, node) => setSelectedNodeId(node.id)}
                    onPaneClick={() => { setSelectedNodeId(null); setPaletteOpen(false); }}
                    fitView fitViewOptions={{ padding: 0.2 }} minZoom={0.3} maxZoom={1.5}
                    style={{ width: '100%', height: '100%' }}
                    className="!bg-background dark:!bg-[#0e0e0e]"
                  >
                    <Background variant={BackgroundVariant.Dots} gap={20} size={1}
                      color="hsl(var(--muted-foreground) / 0.2)"
                      className="!opacity-40 dark:!opacity-100" />
                    <Controls className="[&>button]:bg-card [&>button]:border-border [&>button]:text-muted-foreground [&>button:hover]:bg-muted [&>button:hover]:text-foreground" />
                    <MiniMap nodeColor="hsl(var(--card))" maskColor="hsl(var(--background) / 0.6)"
                      style={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }} />
                  </ReactFlow>

                  {/* Right-edge strip */}
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 z-10 flex flex-col gap-2">
                    <button onClick={() => setPaletteOpen((v) => !v)} title="Adicionar nó"
                      className={cn('w-10 h-10 rounded-xl bg-card border flex items-center justify-center shadow-md transition-all',
                        paletteOpen ? 'border-primary/50 text-primary bg-primary/10' : 'border-border text-muted-foreground hover:border-primary/40 hover:text-primary')}>
                      <Plus className="w-5 h-5" />
                    </button>
                  </div>

                  {paletteOpen && (
                    <PalettePanel onAdd={(kind) => { addPaletteNode(kind); setPaletteOpen(false); }} onClose={() => setPaletteOpen(false)} />
                  )}
                </>
              )}
            </div>

            {/* Config panel */}
            {selectedNode && (
              <ConfigPanel node={selectedNode} onClose={() => setSelectedNodeId(null)}
                onUpdate={handleUpdateNode} onDelete={handleDeleteNode} />
            )}
          </>
        )}
      </div>

      {/* Modals */}
      {testModalOpen && (
        <TestRunModal
          onStart={(phone, dryRun) => { setTestModalOpen(false); runTest(phone, dryRun); }}
          onClose={() => setTestModalOpen(false)}
        />
      )}

      {conditionChoiceState && (
        <ConditionChoiceModal
          nodeId={conditionChoiceState.nodeId}
          condicao={conditionChoiceState.condicao}
          onChoose={(nodeId, choice) => {
            conditionChoiceState.resolve(choice);
            void nodeId;
          }}
        />
      )}

      {templatesOpen && (
        <TemplatesModal
          onUse={useTemplate}
          onClose={() => setTemplatesOpen(false)}
        />
      )}

      {/* Field input styles */}
      <style>{`
        .field-input {
          width: 100%;
          background: hsl(var(--muted));
          border: 1px solid hsl(var(--border));
          border-radius: 0.75rem;
          color: hsl(var(--foreground));
          font-size: 0.8125rem;
          padding: 0.5rem 0.75rem;
          outline: none;
          transition: border-color 0.15s;
          appearance: none;
          -webkit-appearance: none;
        }
        .field-input:focus { border-color: hsl(var(--primary) / 0.5); }
        .field-input option { background: hsl(var(--card)); color: hsl(var(--foreground)); }
        select.field-input {
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23888' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E");
          background-repeat: no-repeat;
          background-position: right 0.6rem center;
          padding-right: 2rem;
          cursor: pointer;
        }
      `}</style>
    </div>
  );
}

// ─── Export ─────────────────────────────────────────────────────────────────────

export default function AutomationCanvas() {
  return (
    <ReactFlowProvider>
      <CanvasInner />
    </ReactFlowProvider>
  );
}
