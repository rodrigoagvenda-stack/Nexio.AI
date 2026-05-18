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
  Panel,
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
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── API Types ─────────────────────────────────────────────────────────────────

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

// ─── Node Data Types ───────────────────────────────────────────────────────────

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

// ─── Helpers ───────────────────────────────────────────────────────────────────

const EDGE_BASE = {
  type: 'smoothstep',
  markerEnd: {
    type: MarkerType.ArrowClosed,
    width: 14,
    height: 14,
    color: '#333',
  },
  style: { stroke: '#333', strokeWidth: 1.5 },
} as const;

function truncate(str: string | null, n: number): string {
  if (!str) return '';
  return str.length > n ? str.slice(0, n) + '…' : str;
}

function stepsToNodes(steps: FollowStep[], sequenceName: string): Node<AutoNodeData>[] {
  const nodes: Node<AutoNodeData>[] = [];

  // Trigger node
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

    // Detect what kind of node to make from condicao/tipo_mensagem
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
        data: {
          kind: 'end',
          label: 'Encerrar sequência',
          stepId: step.id,
        } satisfies EndNodeData,
      });
    } else if (isCondition) {
      nodes.push({
        id: step.id,
        type: 'conditionNode',
        position: { x, y },
        data: {
          kind: 'condition',
          label: 'Condição',
          condicao: step.condicao || 'Respondeu?',
          stepId: step.id,
        } satisfies ConditionNodeData,
      });
    } else if (isWait) {
      nodes.push({
        id: step.id,
        type: 'waitNode',
        position: { x, y },
        data: {
          kind: 'wait',
          label: 'Aguardar',
          dia_offset: step.dia_offset,
          stepId: step.id,
        } satisfies WaitNodeData,
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
    edges.push({
      id: `trigger-${sorted[0].id}`,
      source: 'trigger',
      target: sorted[0].id,
      ...EDGE_BASE,
    });
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
      return {
        id: stepId,
        dia_offset: d.dia_offset,
        horario: d.horario,
        mensagem: d.mensagem,
        tipo_mensagem: d.tipo_mensagem || 'texto',
        ordem: idx + 1,
        condicao: '',
      };
    } else if (d.kind === 'wait') {
      return {
        id: stepId,
        dia_offset: d.dia_offset,
        horario: '00:00',
        mensagem: null,
        tipo_mensagem: 'aguardar',
        ordem: idx + 1,
        condicao: '',
      };
    } else if (d.kind === 'condition') {
      return {
        id: stepId,
        dia_offset: 0,
        horario: '00:00',
        mensagem: null,
        tipo_mensagem: 'condicao',
        ordem: idx + 1,
        condicao: d.condicao,
      };
    } else {
      // end
      return {
        id: stepId,
        dia_offset: 0,
        horario: '00:00',
        mensagem: null,
        tipo_mensagem: 'fim',
        ordem: idx + 1,
        condicao: 'fim',
      };
    }
  });
}

let nodeCounter = 1000;
function newId() {
  return `new-${++nodeCounter}`;
}

// ─── Node Components ───────────────────────────────────────────────────────────

function Chip({ children, active }: { children: React.ReactNode; active?: boolean }) {
  return (
    <span
      className={cn(
        'inline-flex items-center px-3 py-1.5 rounded-xl text-sm transition-colors',
        active
          ? 'bg-[#b5ff47] text-black font-semibold'
          : 'bg-white/[0.05] text-white/70'
      )}
    >
      {children}
    </span>
  );
}

function NodeShell({
  children,
  selected,
  limeAccent,
  redAccent,
  header,
}: {
  children: React.ReactNode;
  selected?: boolean;
  limeAccent?: boolean;
  redAccent?: boolean;
  header: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        'bg-[#1a1a1a] border rounded-2xl min-w-[210px] px-3 pt-2.5 pb-3 flex flex-col gap-2 transition-all duration-150',
        limeAccent
          ? 'border-[#b5ff47]/50 shadow-[0_0_20px_rgba(181,255,71,0.1)]'
          : redAccent
          ? 'border-red-500/40 shadow-[0_0_16px_rgba(239,68,68,0.08)]'
          : selected
          ? 'border-[#b5ff47]/50 shadow-[0_0_20px_rgba(181,255,71,0.1)]'
          : 'border-white/[0.08]'
      )}
    >
      {header}
      <div className="flex flex-col gap-1.5">{children}</div>
    </div>
  );
}

function NodeHeader({ icon: Icon, label }: { icon: React.ElementType; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <Icon className="w-3 h-3 text-white/30" />
      <span className="text-[10px] font-bold uppercase tracking-widest text-white/40">
        {label}
      </span>
    </div>
  );
}

// Trigger Node
function TriggerNode({ data, selected }: NodeProps) {
  const d = data as TriggerNodeData;
  return (
    <NodeShell
      selected={selected}
      limeAccent
      header={<NodeHeader icon={Zap} label="Gatilho" />}
    >
      <Handle
        type="source"
        position={Position.Right}
        className="!w-2.5 !h-2.5 !bg-[#333] !border !border-white/20 !rounded-full"
      />
      <Chip active>{d.label}</Chip>
      <Chip>{d.condicao}</Chip>
    </NodeShell>
  );
}

// Message Node
function MessageNode({ data, selected }: NodeProps) {
  const d = data as MessageNodeData;
  return (
    <NodeShell
      selected={selected}
      header={<NodeHeader icon={MessageSquare} label="Mensagem" />}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!w-2.5 !h-2.5 !bg-[#333] !border !border-white/20 !rounded-full"
      />
      <Handle
        type="source"
        position={Position.Right}
        className="!w-2.5 !h-2.5 !bg-[#333] !border !border-white/20 !rounded-full"
      />
      <Chip active={selected}>Dia {d.dia_offset}</Chip>
      <Chip>{d.horario}</Chip>
      {d.mensagem && <Chip>{truncate(d.mensagem, 40)}</Chip>}
    </NodeShell>
  );
}

// Wait Node
function WaitNode({ data, selected }: NodeProps) {
  const d = data as WaitNodeData;
  return (
    <NodeShell
      selected={selected}
      header={<NodeHeader icon={Clock} label="Aguardar" />}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!w-2.5 !h-2.5 !bg-[#333] !border !border-white/20 !rounded-full"
      />
      <Handle
        type="source"
        position={Position.Right}
        className="!w-2.5 !h-2.5 !bg-[#333] !border !border-white/20 !rounded-full"
      />
      <Chip active={selected}>Aguardar {d.dia_offset} dia{d.dia_offset !== 1 ? 's' : ''}</Chip>
    </NodeShell>
  );
}

// Condition Node
function ConditionNode({ data, selected }: NodeProps) {
  const d = data as ConditionNodeData;
  return (
    <NodeShell
      selected={selected}
      header={<NodeHeader icon={GitBranch} label="Condição" />}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!w-2.5 !h-2.5 !bg-[#333] !border !border-white/20 !rounded-full"
      />
      {/* Source top = Sim */}
      <Handle
        id="sim"
        type="source"
        position={Position.Top}
        style={{ left: '75%' }}
        className="!w-2.5 !h-2.5 !bg-[#b5ff47]/60 !border !border-[#b5ff47]/40 !rounded-full"
      />
      {/* Source bottom = Não */}
      <Handle
        id="nao"
        type="source"
        position={Position.Bottom}
        style={{ left: '75%' }}
        className="!w-2.5 !h-2.5 !bg-red-400/60 !border !border-red-400/40 !rounded-full"
      />
      <Chip active={selected}>{d.condicao || 'Respondeu?'}</Chip>
      <div className="flex gap-1.5">
        <span className="text-[10px] text-[#b5ff47]/70 px-2 py-0.5 rounded bg-[#b5ff47]/10">
          ↑ Sim
        </span>
        <span className="text-[10px] text-red-400/70 px-2 py-0.5 rounded bg-red-400/10">
          ↓ Não
        </span>
      </div>
    </NodeShell>
  );
}

// End Node
function EndNode({ data, selected }: NodeProps) {
  return (
    <NodeShell
      selected={selected}
      redAccent
      header={<NodeHeader icon={XCircle} label="Fim" />}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!w-2.5 !h-2.5 !bg-[#333] !border !border-white/20 !rounded-full"
      />
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

// ─── Config Panel ──────────────────────────────────────────────────────────────

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
    <div className="w-64 bg-[#111] border-l border-white/[0.06] h-full flex flex-col overflow-y-auto">
      <div className="flex items-center justify-between px-4 h-12 border-b border-white/[0.06] flex-shrink-0">
        <span className="text-xs font-semibold text-white/60 uppercase tracking-widest">
          Configurar
        </span>
        <button
          onClick={onClose}
          className="text-white/30 hover:text-white/70 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="p-4 flex flex-col gap-4">
        {/* Message node fields */}
        {d.kind === 'message' && (
          <>
            <Field label="Dia offset">
              <input
                type="number"
                min={0}
                value={d.dia_offset}
                onChange={(e) =>
                  onUpdate(node.id, { dia_offset: Number(e.target.value) })
                }
                className="field-input"
              />
            </Field>
            <Field label="Horário">
              <input
                type="time"
                value={d.horario}
                onChange={(e) => onUpdate(node.id, { horario: e.target.value })}
                className="field-input"
              />
            </Field>
            <Field label="Tipo de mensagem">
              <select
                value={d.tipo_mensagem}
                onChange={(e) => onUpdate(node.id, { tipo_mensagem: e.target.value })}
                className="field-input"
              >
                <option value="texto">Texto</option>
                <option value="imagem">Imagem</option>
                <option value="audio">Áudio</option>
                <option value="template">Template</option>
              </select>
            </Field>
            <Field label="Mensagem">
              <textarea
                rows={4}
                value={d.mensagem ?? ''}
                onChange={(e) => onUpdate(node.id, { mensagem: e.target.value })}
                placeholder="Digite a mensagem..."
                className="field-input resize-none"
              />
            </Field>
          </>
        )}

        {/* Wait node fields */}
        {d.kind === 'wait' && (
          <Field label="Aguardar (dias)">
            <input
              type="number"
              min={1}
              value={d.dia_offset}
              onChange={(e) =>
                onUpdate(node.id, { dia_offset: Number(e.target.value) })
              }
              className="field-input"
            />
          </Field>
        )}

        {/* Condition node fields */}
        {d.kind === 'condition' && (
          <Field label="Condição">
            <input
              type="text"
              value={d.condicao}
              onChange={(e) => onUpdate(node.id, { condicao: e.target.value })}
              placeholder="ex: Respondeu?"
              className="field-input"
            />
          </Field>
        )}

        {/* Trigger node fields */}
        {d.kind === 'trigger' && (
          <>
            <Field label="Nome da sequência">
              <input
                type="text"
                value={d.label}
                onChange={(e) => onUpdate(node.id, { label: e.target.value })}
                className="field-input"
              />
            </Field>
            <Field label="Condição de início">
              <input
                type="text"
                value={d.condicao}
                onChange={(e) => onUpdate(node.id, { condicao: e.target.value })}
                className="field-input"
              />
            </Field>
          </>
        )}

        {/* Delete button (not for trigger) */}
        {d.kind !== 'trigger' && (
          <button
            onClick={() => {
              onDelete(node.id);
              onClose();
            }}
            className="mt-2 w-full py-2 rounded-xl bg-red-500/10 text-red-400 text-sm font-medium hover:bg-red-500/20 transition-colors border border-red-500/20"
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
      <label className="text-[10px] font-bold uppercase tracking-widest text-white/40">
        {label}
      </label>
      {children}
    </div>
  );
}

// ─── Palette ───────────────────────────────────────────────────────────────────

interface PaletteItem {
  label: string;
  kind: 'message' | 'wait' | 'condition' | 'end';
  icon: React.ElementType;
}

const PALETTE_ITEMS: PaletteItem[] = [
  { label: 'Mensagem', kind: 'message', icon: MessageSquare },
  { label: 'Aguardar', kind: 'wait', icon: Clock },
  { label: 'Condição', kind: 'condition', icon: GitBranch },
  { label: 'Fim', kind: 'end', icon: XCircle },
];

// ─── Tab definitions ───────────────────────────────────────────────────────────

const TABS: { label: string; tipo: SequenceTipo }[] = [
  { label: 'Follow-up', tipo: 'follow_geral' },
  { label: 'Anti-Noshow', tipo: 'anti_noshow' },
  { label: 'Remarketing', tipo: 'remarketing' },
];

// ─── Inner canvas (needs useReactFlow) ────────────────────────────────────────

function CanvasInner() {
  const { screenToFlowPosition } = useReactFlow();

  const [activeTipo, setActiveTipo] = useState<SequenceTipo>('follow_geral');
  const [sequences, setSequences] = useState<FollowSequence[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveOk, setSaveOk] = useState(false);

  // Current sequence for the active tab
  const currentSeq = sequences.find((s) => s.tipo === activeTipo) ?? null;

  const [nodes, setNodes, onNodesChange] = useNodesState<Node<AutoNodeData>>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  const selectedNode = nodes.find((n) => n.id === selectedNodeId) ?? null;

  // Fetch sequences on mount
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

  // Rebuild nodes/edges when tab or sequences change
  useEffect(() => {
    if (!currentSeq) {
      setNodes([]);
      setEdges([]);
      return;
    }
    setNodes(stepsToNodes(currentSeq.follow_steps, currentSeq.nome));
    setEdges(stepsToEdges(currentSeq.follow_steps));
    setSelectedNodeId(null);
  }, [currentSeq?.id, activeTipo]); // eslint-disable-line react-hooks/exhaustive-deps

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge({ ...params, ...EDGE_BASE }, eds)),
    [setEdges]
  );

  // Add a node from palette
  function addPaletteNode(kind: PaletteItem['kind']) {
    const id = newId();
    const center = screenToFlowPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 });

    let data: AutoNodeData;
    if (kind === 'message') {
      data = {
        kind: 'message',
        label: 'Mensagem',
        dia_offset: 1,
        horario: '09:00',
        mensagem: '',
        tipo_mensagem: 'texto',
        stepId: id,
      } satisfies MessageNodeData;
    } else if (kind === 'wait') {
      data = {
        kind: 'wait',
        label: 'Aguardar',
        dia_offset: 1,
        stepId: id,
      } satisfies WaitNodeData;
    } else if (kind === 'condition') {
      data = {
        kind: 'condition',
        label: 'Condição',
        condicao: 'Respondeu?',
        stepId: id,
      } satisfies ConditionNodeData;
    } else {
      data = {
        kind: 'end',
        label: 'Encerrar',
        stepId: id,
      } satisfies EndNodeData;
    }

    const newNode: Node<AutoNodeData> = {
      id,
      type:
        kind === 'message'
          ? 'messageNode'
          : kind === 'wait'
          ? 'waitNode'
          : kind === 'condition'
          ? 'conditionNode'
          : 'endNode',
      position: { x: center.x - 105, y: center.y - 60 },
      data,
    };

    setNodes((nds) => [...nds, newNode]);
  }

  // Update node data from config panel
  function handleUpdateNode(id: string, patch: Partial<AutoNodeData>) {
    setNodes((nds) =>
      nds.map((n) =>
        n.id === id ? { ...n, data: { ...n.data, ...patch } as AutoNodeData } : n
      )
    );
  }

  // Delete a node
  function handleDeleteNode(id: string) {
    setNodes((nds) => nds.filter((n) => n.id !== id));
    setEdges((eds) => eds.filter((e) => e.source !== id && e.target !== id));
  }

  // Toggle ativo
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
      setSequences((seqs) =>
        seqs.map((s) => (s.id === currentSeq.id ? { ...s, ativo: nextAtivo } : s))
      );
    } catch (err) {
      console.error('[AutomationCanvas] toggle ativo error', err);
    }
  }

  // Create a new sequence for this tipo
  async function createSequence() {
    const labels: Record<SequenceTipo, string> = {
      follow_geral: 'Follow-up Geral',
      anti_noshow: 'Anti-Noshow',
      remarketing: 'Remarketing',
    };
    try {
      setLoading(true);
      const res = await fetch('/api/follow/sequences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome: labels[activeTipo],
          tipo: activeTipo,
          ativo: false,
          steps: [],
        }),
      });
      if (!res.ok) throw new Error('post failed');
      const json = (await res.json()) as { sequence?: FollowSequence; sequences?: FollowSequence[] };
      // Accept either a single sequence or a refreshed list
      if (json.sequence) {
        setSequences((seqs) => [...seqs, json.sequence!]);
      } else if (json.sequences) {
        setSequences(json.sequences);
      }
    } catch (err) {
      console.error('[AutomationCanvas] create sequence error', err);
    } finally {
      setLoading(false);
    }
  }

  // Save canvas → patch sequence
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
        body: JSON.stringify({
          nome,
          tipo: currentSeq.tipo,
          ativo: currentSeq.ativo,
          steps,
        }),
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

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full bg-[#0e0e0e]">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 h-12 bg-[#111] border-b border-white/[0.06] flex-shrink-0 gap-4">
        {/* Tabs */}
        <div className="flex items-center gap-1">
          {TABS.map((tab) => (
            <button
              key={tab.tipo}
              onClick={() => setActiveTipo(tab.tipo)}
              className={cn(
                'px-3 py-1 rounded-lg text-sm font-medium transition-colors',
                activeTipo === tab.tipo
                  ? 'bg-white/[0.08] text-white'
                  : 'text-white/40 hover:text-white/70'
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Right controls */}
        <div className="flex items-center gap-3">
          {currentSeq && (
            <>
              {/* Ativo toggle */}
              <button
                onClick={toggleAtivo}
                className={cn(
                  'flex items-center gap-2 px-3 py-1 rounded-lg text-xs font-medium transition-colors border',
                  currentSeq.ativo
                    ? 'bg-[#b5ff47]/10 border-[#b5ff47]/30 text-[#b5ff47]'
                    : 'bg-white/[0.04] border-white/[0.08] text-white/40'
                )}
              >
                <span
                  className={cn(
                    'w-2 h-2 rounded-full',
                    currentSeq.ativo ? 'bg-[#b5ff47]' : 'bg-white/20'
                  )}
                />
                {currentSeq.ativo ? 'Ativo' : 'Inativo'}
              </button>

              {/* Save button */}
              <button
                onClick={handleSave}
                disabled={saving}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-all border',
                  saveOk
                    ? 'bg-[#b5ff47]/20 border-[#b5ff47]/40 text-[#b5ff47]'
                    : 'bg-white/[0.06] border-white/[0.1] text-white/80 hover:bg-white/[0.10]'
                )}
              >
                {saving ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : saveOk ? (
                  <CheckCircle2 className="w-3.5 h-3.5" />
                ) : (
                  <Save className="w-3.5 h-3.5" />
                )}
                {saveOk ? 'Salvo!' : 'Salvar'}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 min-h-0">
        {/* Palette */}
        <div className="w-44 bg-[#111] border-r border-white/[0.06] flex flex-col py-4 px-3 gap-2 flex-shrink-0">
          <p className="text-[10px] font-bold uppercase tracking-widest text-white/30 mb-1 px-1">
            Paleta
          </p>
          {PALETTE_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.kind}
                onClick={() => addPaletteNode(item.kind)}
                disabled={!currentSeq}
                className={cn(
                  'flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-white/60 bg-white/[0.04] border border-white/[0.06]',
                  'hover:bg-white/[0.08] hover:text-white/90 transition-colors disabled:opacity-30 disabled:cursor-not-allowed'
                )}
              >
                <Icon className="w-3.5 h-3.5 flex-shrink-0" />
                <span>+ {item.label}</span>
              </button>
            );
          })}
        </div>

        {/* Canvas */}
        <div className="flex-1 relative min-w-0">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="w-6 h-6 text-[#b5ff47]/50 animate-spin" />
            </div>
          ) : !currentSeq ? (
            <div className="flex flex-col items-center justify-center h-full gap-4">
              <p className="text-white/30 text-sm">Nenhuma sequência encontrada para esta aba.</p>
              <button
                onClick={createSequence}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#b5ff47]/10 border border-[#b5ff47]/30 text-[#b5ff47] text-sm font-semibold hover:bg-[#b5ff47]/20 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Criar sequência
              </button>
            </div>
          ) : (
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              nodeTypes={nodeTypes}
              onNodeClick={(_, node) => setSelectedNodeId(node.id)}
              onPaneClick={() => setSelectedNodeId(null)}
              fitView
              fitViewOptions={{ padding: 0.2 }}
              minZoom={0.3}
              maxZoom={1.5}
              className="bg-[#0e0e0e]"
            >
              <Background
                variant={BackgroundVariant.Dots}
                gap={20}
                size={1}
                color="rgba(255,255,255,0.06)"
              />
              <Controls
                className="[&>button]:bg-[#1a1a1a] [&>button]:border-white/[0.08] [&>button]:text-white/50 [&>button:hover]:bg-white/[0.08] [&>button:hover]:text-white"
              />
              <MiniMap
                nodeColor="#1a1a1a"
                maskColor="rgba(0,0,0,0.6)"
                style={{ background: '#111', border: '1px solid rgba(255,255,255,0.06)' }}
              />
              <Panel position="top-right">
                {/* intentionally empty – using our own top bar */}
              </Panel>
            </ReactFlow>
          )}
        </div>

        {/* Config panel slide-in */}
        {selectedNode && (
          <ConfigPanel
            node={selectedNode}
            onClose={() => setSelectedNodeId(null)}
            onUpdate={handleUpdateNode}
            onDelete={handleDeleteNode}
          />
        )}
      </div>

      {/* Inline styles for field inputs */}
      <style>{`
        .field-input {
          width: 100%;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 0.75rem;
          color: rgba(255,255,255,0.8);
          font-size: 0.8125rem;
          padding: 0.5rem 0.75rem;
          outline: none;
          transition: border-color 0.15s;
        }
        .field-input:focus {
          border-color: rgba(181,255,71,0.35);
        }
        .field-input option {
          background: #1a1a1a;
          color: rgba(255,255,255,0.8);
        }
      `}</style>
    </div>
  );
}

// ─── Public component (wraps with ReactFlowProvider) ──────────────────────────

export default function AutomationCanvas() {
  return (
    <ReactFlowProvider>
      <CanvasInner />
    </ReactFlowProvider>
  );
}
