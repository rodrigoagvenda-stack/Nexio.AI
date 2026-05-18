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
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── API Types ──────────────────────────────────────────────────────────────────

type SequenceTipo = 'follow_geral' | 'anti_noshow' | 'remarketing';

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

// ─── Node Data Types ────────────────────────────────────────────────────────────

interface TriggerNodeData extends Record<string, unknown> {
  kind: 'trigger';
  label: string;
  condicao: string;
}

interface MessageNodeData extends Record<string, unknown> {
  kind: 'message';
  label: string;
  dia_offset: number;
  horario: string;
  mensagem: string | null;
  tipo_mensagem: string;
  stepId: string;
}

interface WaitNodeData extends Record<string, unknown> {
  kind: 'wait';
  label: string;
  dia_offset: number;
  stepId: string;
}

interface ConditionNodeData extends Record<string, unknown> {
  kind: 'condition';
  label: string;
  condicao: string;
  stepId: string;
}

interface EndNodeData extends Record<string, unknown> {
  kind: 'end';
  label: string;
  stepId: string;
}

type AutoNodeData =
  | TriggerNodeData
  | MessageNodeData
  | WaitNodeData
  | ConditionNodeData
  | EndNodeData;

// ─── Mock execution log ─────────────────────────────────────────────────────────

interface ExecLog {
  id: string;
  lead: string;
  sequence: string;
  step: string;
  status: 'sent' | 'failed' | 'pending';
  ts: string;
}

// ─── Helpers ────────────────────────────────────────────────────────────────────

const EDGE_BASE = {
  type: 'smoothstep',
  markerEnd: {
    type: MarkerType.ArrowClosed,
    width: 14,
    height: 14,
    color: 'hsl(215 16% 47%)',
  },
  style: { stroke: 'hsl(215 16% 47%)', strokeWidth: 1.5 },
} as const;

function truncate(str: string | null, n: number): string {
  if (!str) return '';
  return str.length > n ? str.slice(0, n) + '…' : str;
}

function stepsToNodes(steps: FollowStep[], sequenceName: string): Node<AutoNodeData>[] {
  const nodes: Node<AutoNodeData>[] = [];

  nodes.push({
    id: 'trigger',
    type: 'triggerNode',
    position: { x: 0, y: 150 },
    data: {
      kind: 'trigger',
      label: sequenceName,
      condicao: 'Início da sequência',
    } satisfies TriggerNodeData,
  });

  const sorted = [...steps].sort((a, b) => a.ordem - b.ordem);
  sorted.forEach((step, idx) => {
    const x = (idx + 1) * 280;
    const y = 150;

    const condicaoLower = step.condicao?.toLowerCase() ?? '';
    const isFim =
      condicaoLower.includes('fim') ||
      condicaoLower.includes('encerr') ||
      step.tipo_mensagem === 'fim';
    const isCondition =
      condicaoLower.includes('respondeu') ||
      condicaoLower.includes('condicao') ||
      step.tipo_mensagem === 'condicao';
    const isWait =
      step.tipo_mensagem === 'aguardar' ||
      (step.mensagem === null && !isFim && !isCondition);

    if (isFim) {
      nodes.push({
        id: step.id,
        type: 'endNode',
        position: { x, y },
        data: { kind: 'end', label: 'Encerrar sequência', stepId: step.id } satisfies EndNodeData,
      });
    } else if (isCondition) {
      nodes.push({
        id: step.id,
        type: 'conditionNode',
        position: { x, y },
        data: { kind: 'condition', label: 'Condição', condicao: step.condicao || 'Respondeu?', stepId: step.id } satisfies ConditionNodeData,
      });
    } else if (isWait) {
      nodes.push({
        id: step.id,
        type: 'waitNode',
        position: { x, y },
        data: { kind: 'wait', label: 'Aguardar', dia_offset: step.dia_offset, stepId: step.id } satisfies WaitNodeData,
      });
    } else {
      nodes.push({
        id: step.id,
        type: 'messageNode',
        position: { x, y },
        data: {
          kind: 'message',
          label: 'Mensagem',
          dia_offset: step.dia_offset,
          horario: step.horario,
          mensagem: step.mensagem,
          tipo_mensagem: step.tipo_mensagem,
          stepId: step.id,
        } satisfies MessageNodeData,
      });
    }
  });

  return nodes;
}

function stepsToEdges(steps: FollowStep[]): Edge[] {
  const sorted = [...steps].sort((a, b) => a.ordem - b.ordem);
  const edges: Edge[] = [];

  if (sorted.length > 0) {
    edges.push({ id: `trigger-${sorted[0].id}`, source: 'trigger', target: sorted[0].id, ...EDGE_BASE });
  }

  for (let i = 0; i < sorted.length - 1; i++) {
    edges.push({
      id: `e-${sorted[i].id}-${sorted[i + 1].id}`,
      source: sorted[i].id,
      target: sorted[i + 1].id,
      ...EDGE_BASE,
    });
  }

  return edges;
}

function nodesToSteps(nodes: Node<AutoNodeData>[]): FollowStep[] {
  const stepNodes = nodes
    .filter((n) => n.id !== 'trigger')
    .sort((a, b) => a.position.x - b.position.x);

  return stepNodes.map((node, idx) => {
    const d = node.data;
    const stepId = String(d.stepId ?? '');
    if (d.kind === 'message') {
      return { id: stepId, dia_offset: d.dia_offset, horario: d.horario, mensagem: d.mensagem, tipo_mensagem: d.tipo_mensagem || 'texto', ordem: idx + 1, condicao: '' };
    } else if (d.kind === 'wait') {
      return { id: stepId, dia_offset: d.dia_offset, horario: '00:00', mensagem: null, tipo_mensagem: 'aguardar', ordem: idx + 1, condicao: '' };
    } else if (d.kind === 'condition') {
      return { id: stepId, dia_offset: 0, horario: '00:00', mensagem: null, tipo_mensagem: 'condicao', ordem: idx + 1, condicao: d.condicao };
    } else {
      return { id: stepId, dia_offset: 0, horario: '00:00', mensagem: null, tipo_mensagem: 'fim', ordem: idx + 1, condicao: 'fim' };
    }
  });
}

let nodeCounter = 1000;
function newId() { return `new-${++nodeCounter}`; }

// ─── Node Components ────────────────────────────────────────────────────────────

function Chip({ children, active }: { children: React.ReactNode; active?: boolean }) {
  return (
    <span className={cn(
      'inline-flex items-center px-3 py-1.5 rounded-xl text-sm transition-colors',
      active ? 'bg-primary text-primary-foreground font-semibold' : 'bg-muted text-muted-foreground'
    )}>
      {children}
    </span>
  );
}

function NodeShell({
  children, selected, primaryAccent, redAccent, header,
}: {
  children: React.ReactNode;
  selected?: boolean;
  primaryAccent?: boolean;
  redAccent?: boolean;
  header: React.ReactNode;
}) {
  return (
    <div className={cn(
      'bg-card border rounded-2xl min-w-[210px] px-3 pt-2.5 pb-3 flex flex-col gap-2 transition-all duration-150 shadow-sm',
      primaryAccent
        ? 'border-primary/50 shadow-[0_0_20px_hsl(var(--primary)/0.12)]'
        : redAccent
        ? 'border-destructive/40 shadow-[0_0_16px_hsl(var(--destructive)/0.08)]'
        : selected
        ? 'border-primary/50 shadow-[0_0_20px_hsl(var(--primary)/0.12)]'
        : 'border-border'
    )}>
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

function TriggerNode({ data, selected }: NodeProps) {
  const d = data as TriggerNodeData;
  return (
    <NodeShell selected={selected} primaryAccent header={<NodeHeader icon={Zap} label="Gatilho" />}>
      <Handle type="source" position={Position.Right} className={HANDLE_CLS} />
      <Chip active>{d.label}</Chip>
      <Chip>{d.condicao}</Chip>
    </NodeShell>
  );
}

function MessageNode({ data, selected }: NodeProps) {
  const d = data as MessageNodeData;
  return (
    <NodeShell selected={selected} header={<NodeHeader icon={MessageSquare} label="Mensagem" />}>
      <Handle type="target" position={Position.Left} className={HANDLE_CLS} />
      <Handle type="source" position={Position.Right} className={HANDLE_CLS} />
      <Chip active={selected}>Dia {d.dia_offset}</Chip>
      <Chip>{d.horario}</Chip>
      {d.mensagem && <Chip>{truncate(d.mensagem, 40)}</Chip>}
    </NodeShell>
  );
}

function WaitNode({ data, selected }: NodeProps) {
  const d = data as WaitNodeData;
  return (
    <NodeShell selected={selected} header={<NodeHeader icon={Clock} label="Aguardar" />}>
      <Handle type="target" position={Position.Left} className={HANDLE_CLS} />
      <Handle type="source" position={Position.Right} className={HANDLE_CLS} />
      <Chip active={selected}>Aguardar {d.dia_offset} dia{d.dia_offset !== 1 ? 's' : ''}</Chip>
    </NodeShell>
  );
}

function ConditionNode({ data, selected }: NodeProps) {
  const d = data as ConditionNodeData;
  return (
    <NodeShell selected={selected} header={<NodeHeader icon={GitBranch} label="Condição" />}>
      <Handle type="target" position={Position.Left} className={HANDLE_CLS} />
      <Handle id="sim" type="source" position={Position.Top} style={{ left: '75%' }}
        className="!w-2.5 !h-2.5 !bg-primary/60 !border !border-primary/40 !rounded-full" />
      <Handle id="nao" type="source" position={Position.Bottom} style={{ left: '75%' }}
        className="!w-2.5 !h-2.5 !bg-destructive/60 !border !border-destructive/40 !rounded-full" />
      <Chip active={selected}>{d.condicao || 'Respondeu?'}</Chip>
      <div className="flex gap-1.5">
        <span className="text-[10px] text-primary/70 px-2 py-0.5 rounded bg-primary/10">↑ Sim</span>
        <span className="text-[10px] text-destructive/70 px-2 py-0.5 rounded bg-destructive/10">↓ Não</span>
      </div>
    </NodeShell>
  );
}

function EndNode({ data: _data, selected }: NodeProps) {
  return (
    <NodeShell selected={selected} redAccent header={<NodeHeader icon={XCircle} label="Fim" />}>
      <Handle type="target" position={Position.Left} className={HANDLE_CLS} />
      <Chip>Encerrar sequência</Chip>
    </NodeShell>
  );
}

const nodeTypes = {
  triggerNode: TriggerNode,
  messageNode: MessageNode,
  waitNode: WaitNode,
  conditionNode: ConditionNode,
  endNode: EndNode,
};

// ─── Config Panel ────────────────────────────────────────────────────────────────

interface ConfigPanelProps {
  node: Node<AutoNodeData> | null;
  onClose: () => void;
  onUpdate: (id: string, patch: Partial<AutoNodeData>) => void;
  onDelete: (id: string) => void;
}

function ConfigPanel({ node, onClose, onUpdate, onDelete }: ConfigPanelProps) {
  if (!node) return null;
  const d = node.data;

  return (
    <div className="w-64 bg-card border-l border-border h-full flex flex-col overflow-y-auto">
      <div className="flex items-center justify-between px-4 h-12 border-b border-border flex-shrink-0">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Configurar</span>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="p-4 flex flex-col gap-4">
        {d.kind === 'message' && (
          <>
            <Field label="Dia offset">
              <input type="number" min={0} value={d.dia_offset}
                onChange={(e) => onUpdate(node.id, { dia_offset: Number(e.target.value) })}
                className="field-input" />
            </Field>
            <Field label="Horário">
              <input type="time" value={d.horario}
                onChange={(e) => onUpdate(node.id, { horario: e.target.value })}
                className="field-input" />
            </Field>
            <Field label="Tipo de mensagem">
              <select value={d.tipo_mensagem}
                onChange={(e) => onUpdate(node.id, { tipo_mensagem: e.target.value })}
                className="field-input">
                <option value="texto">Texto</option>
                <option value="imagem">Imagem</option>
                <option value="audio">Áudio</option>
                <option value="template">Template</option>
              </select>
            </Field>
            <Field label="Mensagem">
              <textarea rows={4} value={d.mensagem ?? ''}
                onChange={(e) => onUpdate(node.id, { mensagem: e.target.value })}
                placeholder="Digite a mensagem..."
                className="field-input resize-none" />
            </Field>
          </>
        )}

        {d.kind === 'wait' && (
          <Field label="Aguardar (dias)">
            <input type="number" min={1} value={d.dia_offset}
              onChange={(e) => onUpdate(node.id, { dia_offset: Number(e.target.value) })}
              className="field-input" />
          </Field>
        )}

        {d.kind === 'condition' && (
          <Field label="Condição">
            <input type="text" value={d.condicao}
              onChange={(e) => onUpdate(node.id, { condicao: e.target.value })}
              placeholder="ex: Respondeu?"
              className="field-input" />
          </Field>
        )}

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

        {d.kind !== 'trigger' && (
          <button
            onClick={() => { onDelete(node.id); onClose(); }}
            className="mt-2 w-full py-2 rounded-xl bg-destructive/10 text-destructive text-sm font-medium hover:bg-destructive/20 transition-colors border border-destructive/20"
          >
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

// ─── Palette Items ───────────────────────────────────────────────────────────────

interface PaletteItem {
  label: string;
  desc: string;
  kind: 'message' | 'wait' | 'condition' | 'end';
  icon: React.ElementType;
  bgClass: string;
  iconClass: string;
}

const PALETTE_ITEMS: PaletteItem[] = [
  {
    label: 'Mensagem',
    desc: 'Enviar texto, áudio ou mídia',
    kind: 'message',
    icon: MessageSquare,
    bgClass: 'bg-primary/10',
    iconClass: 'text-primary',
  },
  {
    label: 'Aguardar',
    desc: 'Pausa entre mensagens',
    kind: 'wait',
    icon: Clock,
    bgClass: 'bg-amber-500/10',
    iconClass: 'text-amber-500',
  },
  {
    label: 'Condição',
    desc: 'Ramificar por resposta do lead',
    kind: 'condition',
    icon: GitBranch,
    bgClass: 'bg-violet-500/10',
    iconClass: 'text-violet-500',
  },
  {
    label: 'Encerrar',
    desc: 'Finalizar a sequência',
    kind: 'end',
    icon: XCircle,
    bgClass: 'bg-destructive/10',
    iconClass: 'text-destructive',
  },
];

// ─── Floating palette panel (n8n style) ─────────────────────────────────────────

function PalettePanel({
  onAdd,
  onClose,
}: {
  onAdd: (kind: PaletteItem['kind']) => void;
  onClose: () => void;
}) {
  const [search, setSearch] = useState('');
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      const target = e.target;
      if (panelRef.current && target instanceof Element && !panelRef.current.contains(target)) {
        onClose();
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [onClose]);

  const filtered = PALETTE_ITEMS.filter(
    (item) => !search || item.label.toLowerCase().includes(search.toLowerCase()) || item.desc.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div
      ref={panelRef}
      className="absolute right-16 top-1/2 -translate-y-1/2 z-20 w-64 bg-card border border-border rounded-2xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-right-2 duration-150"
    >
      {/* Header */}
      <div className="px-4 py-3 border-b border-border space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
            O que acontece a seguir?
          </p>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <input
            autoFocus
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar nó..."
            className="w-full h-8 pl-8 pr-3 text-sm bg-muted rounded-lg outline-none text-foreground placeholder:text-muted-foreground"
          />
        </div>
      </div>

      {/* Items */}
      <div className="p-2 space-y-0.5">
        {filtered.length === 0 ? (
          <p className="text-center text-xs text-muted-foreground py-4">Nenhum resultado</p>
        ) : (
          filtered.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.kind}
                onClick={() => { onAdd(item.kind); onClose(); }}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm hover:bg-muted transition-colors text-left"
              >
                <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center shrink-0', item.bgClass)}>
                  <Icon className={cn('w-4 h-4', item.iconClass)} />
                </div>
                <div className="min-w-0">
                  <p className="font-medium text-foreground">{item.label}</p>
                  <p className="text-xs text-muted-foreground truncate">{item.desc}</p>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

// ─── Executions view ─────────────────────────────────────────────────────────────

const MOCK_EXECUTIONS: ExecLog[] = [
  { id: '1', lead: 'João Silva', sequence: 'Follow-up Geral', step: 'Mensagem — Dia 1', status: 'sent', ts: '18 mai, 14:32' },
  { id: '2', lead: 'Maria Costa', sequence: 'Anti-Noshow', step: 'Mensagem — Dia 0', status: 'sent', ts: '18 mai, 13:10' },
  { id: '3', lead: 'Carlos Mendes', sequence: 'Remarketing', step: 'Mensagem — Dia 3', status: 'failed', ts: '18 mai, 11:55' },
  { id: '4', lead: 'Ana Ferreira', sequence: 'Follow-up Geral', step: 'Aguardar — Dia 2', status: 'pending', ts: '18 mai, 09:00' },
];

function ExecutionsView({ tipo }: { tipo: SequenceTipo }) {
  const label: Record<SequenceTipo, string> = {
    follow_geral: 'Follow-up',
    anti_noshow: 'Anti-Noshow',
    remarketing: 'Remarketing',
  };

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
            <div className="text-center space-y-1">
              <p className="text-sm font-medium text-muted-foreground">Nenhuma execução registrada</p>
              <p className="text-xs text-muted-foreground/70">As execuções aparecerão aqui em tempo real</p>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {executions.map((exec) => (
              <div key={exec.id} className="flex items-center gap-3 p-3.5 rounded-xl border border-border bg-card">
                <div className={cn(
                  'w-8 h-8 rounded-lg flex items-center justify-center shrink-0',
                  exec.status === 'sent' ? 'bg-primary/10'
                  : exec.status === 'failed' ? 'bg-destructive/10'
                  : 'bg-muted'
                )}>
                  {exec.status === 'sent' ? <CheckCheck className="w-4 h-4 text-primary" />
                    : exec.status === 'failed' ? <AlertCircle className="w-4 h-4 text-destructive" />
                    : <Clock3 className="w-4 h-4 text-muted-foreground" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{exec.lead}</p>
                  <p className="text-xs text-muted-foreground truncate">{exec.step}</p>
                </div>
                <div className="text-right shrink-0">
                  <span className={cn(
                    'text-[10px] font-semibold px-2 py-0.5 rounded-full border uppercase tracking-wide',
                    exec.status === 'sent' ? 'bg-primary/10 text-primary border-primary/20'
                    : exec.status === 'failed' ? 'bg-destructive/10 text-destructive border-destructive/20'
                    : 'bg-muted text-muted-foreground border-border'
                  )}>
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
];

// ─── Inner canvas ────────────────────────────────────────────────────────────────

function CanvasInner() {
  const { screenToFlowPosition } = useReactFlow();

  const [mode, setMode] = useState<'editor' | 'execucoes'>('editor');
  const [activeTipo, setActiveTipo] = useState<SequenceTipo>('follow_geral');
  const [sequences, setSequences] = useState<FollowSequence[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveOk, setSaveOk] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);

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
      } catch (err) {
        console.error('[AutomationCanvas] fetch error', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  useEffect(() => {
    if (!currentSeq) { setNodes([]); setEdges([]); return; }
    setNodes(stepsToNodes(currentSeq.follow_steps, currentSeq.nome));
    setEdges(stepsToEdges(currentSeq.follow_steps));
    setSelectedNodeId(null);
  }, [currentSeq?.id, activeTipo]); // eslint-disable-line react-hooks/exhaustive-deps

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge({ ...params, ...EDGE_BASE }, eds)),
    [setEdges]
  );

  function addPaletteNode(kind: PaletteItem['kind']) {
    const id = newId();
    const center = screenToFlowPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 });

    let data: AutoNodeData;
    if (kind === 'message') {
      data = { kind: 'message', label: 'Mensagem', dia_offset: 1, horario: '09:00', mensagem: '', tipo_mensagem: 'texto', stepId: id } satisfies MessageNodeData;
    } else if (kind === 'wait') {
      data = { kind: 'wait', label: 'Aguardar', dia_offset: 1, stepId: id } satisfies WaitNodeData;
    } else if (kind === 'condition') {
      data = { kind: 'condition', label: 'Condição', condicao: 'Respondeu?', stepId: id } satisfies ConditionNodeData;
    } else {
      data = { kind: 'end', label: 'Encerrar', stepId: id } satisfies EndNodeData;
    }

    const newNode: Node<AutoNodeData> = {
      id,
      type: kind === 'message' ? 'messageNode' : kind === 'wait' ? 'waitNode' : kind === 'condition' ? 'conditionNode' : 'endNode',
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
      const res = await fetch(`/api/follow/sequences/${currentSeq.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ativo: nextAtivo }),
      });
      if (!res.ok) throw new Error('patch failed');
      setSequences((seqs) => seqs.map((s) => s.id === currentSeq.id ? { ...s, ativo: nextAtivo } : s));
    } catch (err) {
      console.error('[AutomationCanvas] toggle ativo error', err);
    }
  }

  async function createSequence() {
    const labels: Record<SequenceTipo, string> = { follow_geral: 'Follow-up Geral', anti_noshow: 'Anti-Noshow', remarketing: 'Remarketing' };
    try {
      setLoading(true);
      const res = await fetch('/api/follow/sequences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome: labels[activeTipo], tipo: activeTipo, ativo: false, steps: [] }),
      });
      if (!res.ok) throw new Error('post failed');
      const json = (await res.json()) as { sequence?: FollowSequence; sequences?: FollowSequence[] };
      if (json.sequence) setSequences((seqs) => [...seqs, json.sequence!]);
      else if (json.sequences) setSequences(json.sequences);
    } catch (err) {
      console.error('[AutomationCanvas] create sequence error', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    if (!currentSeq) return;
    setSaving(true);
    try {
      const steps = nodesToSteps(nodes);
      const triggerNode = nodes.find((n) => n.id === 'trigger');
      const nome = (triggerNode?.data as TriggerNodeData | undefined)?.label ?? currentSeq.nome;

      const res = await fetch(`/api/follow/sequences/${currentSeq.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome, tipo: currentSeq.tipo, ativo: currentSeq.ativo, steps }),
      });
      if (!res.ok) throw new Error('save failed');
      setSaveOk(true);
      setTimeout(() => setSaveOk(false), 2000);
    } catch (err) {
      console.error('[AutomationCanvas] save error', err);
    } finally {
      setSaving(false);
    }
  }

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full bg-background">

      {/* Top bar */}
      <div className="flex items-center justify-between px-4 h-12 bg-card border-b border-border flex-shrink-0 gap-4">
        {/* Left: mode switcher + sequence tabs */}
        <div className="flex items-center gap-3">
          {/* Editor / Execuções pills */}
          <div className="flex items-center bg-muted rounded-lg p-0.5">
            <button
              onClick={() => setMode('editor')}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all',
                mode === 'editor' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <PenLine className="w-3 h-3" />
              Editor
            </button>
            <button
              onClick={() => setMode('execucoes')}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all',
                mode === 'execucoes' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Play className="w-3 h-3" />
              Execuções
            </button>
          </div>

          {/* Sequence tabs */}
          <div className="w-px h-5 bg-border" />
          <div className="flex items-center gap-1">
            {SEQ_TABS.map((tab) => (
              <button
                key={tab.tipo}
                onClick={() => setActiveTipo(tab.tipo)}
                className={cn(
                  'px-3 py-1 rounded-lg text-sm font-medium transition-colors',
                  activeTipo === tab.tipo ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Right controls */}
        {mode === 'editor' && currentSeq && (
          <div className="flex items-center gap-3">
            <button
              onClick={toggleAtivo}
              className={cn(
                'flex items-center gap-2 px-3 py-1 rounded-lg text-xs font-medium transition-colors border',
                currentSeq.ativo
                  ? 'bg-primary/10 border-primary/30 text-primary'
                  : 'bg-muted border-border text-muted-foreground'
              )}
            >
              <span className={cn('w-2 h-2 rounded-full', currentSeq.ativo ? 'bg-primary' : 'bg-muted-foreground/40')} />
              {currentSeq.ativo ? 'Ativo' : 'Inativo'}
            </button>

            <button
              onClick={handleSave}
              disabled={saving}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-all border',
                saveOk
                  ? 'bg-primary/10 border-primary/30 text-primary'
                  : 'bg-muted border-border text-foreground hover:bg-accent'
              )}
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                : saveOk ? <CheckCircle2 className="w-3.5 h-3.5" />
                : <Save className="w-3.5 h-3.5" />}
              {saveOk ? 'Salvo!' : 'Salvar'}
            </button>
          </div>
        )}
      </div>

      {/* Body */}
      {mode === 'execucoes' ? (
        <ExecutionsView tipo={activeTipo} />
      ) : (
        <div className="flex flex-1 min-h-0">
          {/* Canvas area */}
          <div className="flex-1 relative min-w-0">
            {loading ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="w-6 h-6 text-muted-foreground animate-spin" />
              </div>
            ) : !currentSeq ? (
              <div className="flex flex-col items-center justify-center h-full gap-4">
                <p className="text-muted-foreground text-sm">Nenhuma sequência encontrada para esta aba.</p>
                <button
                  onClick={createSequence}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary/10 border border-primary/30 text-primary text-sm font-semibold hover:bg-primary/20 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Criar sequência
                </button>
              </div>
            ) : (
              <>
                <ReactFlow
                  nodes={nodes}
                  edges={edges}
                  onNodesChange={onNodesChange}
                  onEdgesChange={onEdgesChange}
                  onConnect={onConnect}
                  nodeTypes={nodeTypes}
                  onNodeClick={(_, node) => setSelectedNodeId(node.id)}
                  onPaneClick={() => { setSelectedNodeId(null); setPaletteOpen(false); }}
                  fitView
                  fitViewOptions={{ padding: 0.2 }}
                  minZoom={0.3}
                  maxZoom={1.5}
                  className="!bg-background dark:!bg-[#0e0e0e]"
                >
                  <Background
                    variant={BackgroundVariant.Dots}
                    gap={20}
                    size={1}
                    className="!opacity-[0.4] dark:!opacity-100"
                    color="hsl(var(--muted-foreground) / 0.2)"
                  />
                  <Controls className="[&>button]:bg-card [&>button]:border-border [&>button]:text-muted-foreground [&>button:hover]:bg-muted [&>button:hover]:text-foreground" />
                  <MiniMap
                    nodeColor="hsl(var(--card))"
                    maskColor="hsl(var(--background) / 0.6)"
                    style={{
                      background: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                    }}
                  />
                </ReactFlow>

                {/* Right-edge button strip */}
                <div className="absolute right-3 top-1/2 -translate-y-1/2 z-10 flex flex-col gap-2">
                  <button
                    onClick={() => setPaletteOpen((v) => !v)}
                    title="Adicionar nó"
                    className={cn(
                      'w-10 h-10 rounded-xl bg-card border flex items-center justify-center shadow-md transition-all',
                      paletteOpen ? 'border-primary/50 text-primary bg-primary/10' : 'border-border text-muted-foreground hover:border-primary/40 hover:text-primary'
                    )}
                  >
                    <Plus className="w-5 h-5" />
                  </button>
                </div>

                {/* Floating palette panel */}
                {paletteOpen && (
                  <PalettePanel
                    onAdd={(kind) => { addPaletteNode(kind); setPaletteOpen(false); }}
                    onClose={() => setPaletteOpen(false)}
                  />
                )}
              </>
            )}
          </div>

          {/* Config panel */}
          {selectedNode && (
            <ConfigPanel
              node={selectedNode}
              onClose={() => setSelectedNodeId(null)}
              onUpdate={handleUpdateNode}
              onDelete={handleDeleteNode}
            />
          )}
        </div>
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
        }
        .field-input:focus {
          border-color: hsl(var(--primary) / 0.5);
        }
        .field-input option {
          background: hsl(var(--card));
          color: hsl(var(--foreground));
        }
      `}</style>
    </div>
  );
}

// ─── Public export ───────────────────────────────────────────────────────────────

export default function AutomationCanvas() {
  return (
    <ReactFlowProvider>
      <CanvasInner />
    </ReactFlowProvider>
  );
}
