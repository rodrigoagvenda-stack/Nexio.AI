'use client';

import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  type Connection,
  type Node,
  type Edge,
  BackgroundVariant,
  Panel,
  Handle,
  Position,
  MarkerType,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useCallback, useState } from 'react';
import { cn } from '@/lib/utils';
import {
  MessageCircle, Zap, Calendar, Clock, Bell, RefreshCw,
  FlaskConical, BarChart2, UserCheck, ArrowLeft, Plus, Trash2,
} from 'lucide-react';
import Link from 'next/link';

// ─── Node types ───────────────────────────────────────────────
type NodeKind = 'start' | 'sdr' | 'schedule' | 'follow' | 'noshow' | 'remarketing' | 'trial' | 'metrics' | 'end' | 'condition';

const KIND_META: Record<NodeKind, { label: string; icon: React.FC<{ className?: string }>; bg: string; border: string; text: string }> = {
  start:       { label: 'Lead entra',    icon: UserCheck,    bg: 'bg-emerald-500/10', border: 'border-emerald-500/40', text: 'text-emerald-600 dark:text-emerald-400' },
  sdr:         { label: 'Agente SDR',    icon: MessageCircle, bg: 'bg-primary/10',    border: 'border-primary/40',    text: 'text-primary' },
  schedule:    { label: 'Agendamento',   icon: Calendar,     bg: 'bg-blue-500/10',   border: 'border-blue-500/40',   text: 'text-blue-600 dark:text-blue-400' },
  follow:      { label: 'Follow-up',     icon: Clock,        bg: 'bg-amber-500/10',  border: 'border-amber-500/40',  text: 'text-amber-600 dark:text-amber-400' },
  noshow:      { label: 'Anti-Noshow',   icon: Bell,         bg: 'bg-orange-500/10', border: 'border-orange-500/40', text: 'text-orange-600 dark:text-orange-400' },
  remarketing: { label: 'Remarketing',   icon: RefreshCw,    bg: 'bg-rose-500/10',   border: 'border-rose-500/40',   text: 'text-rose-600 dark:text-rose-400' },
  trial:       { label: 'Trial SaaS',    icon: FlaskConical, bg: 'bg-violet-500/10', border: 'border-violet-500/40', text: 'text-violet-600 dark:text-violet-400' },
  metrics:     { label: 'Métricas',      icon: BarChart2,    bg: 'bg-sky-500/10',    border: 'border-sky-500/40',    text: 'text-sky-600 dark:text-sky-400' },
  condition:   { label: 'Condição',      icon: Zap,          bg: 'bg-yellow-500/10', border: 'border-yellow-500/30', text: 'text-yellow-600 dark:text-yellow-400' },
  end:         { label: 'Encerrado',     icon: UserCheck,    bg: 'bg-muted',         border: 'border-border',         text: 'text-muted-foreground' },
};

interface FlowNodeData {
  kind: NodeKind;
  label: string;
  subtitle?: string;
  [key: string]: unknown;
}

function FlowNode({ data, selected }: { data: FlowNodeData; selected: boolean }) {
  const meta = KIND_META[data.kind] ?? KIND_META.sdr;
  const Icon = meta.icon;
  return (
    <div
      className={cn(
        'relative rounded-2xl border px-4 py-3 min-w-[160px] max-w-[220px] shadow-sm transition-shadow duration-150',
        meta.bg, meta.border,
        selected && 'ring-2 ring-primary/50 shadow-lg shadow-primary/10'
      )}
    >
      <Handle type="target" position={Position.Left}  className="!w-2.5 !h-2.5 !border-2 !bg-card" />
      <Handle type="source" position={Position.Right} className="!w-2.5 !h-2.5 !border-2 !bg-card" />
      <div className="flex items-center gap-2.5">
        <div className={cn('w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 border', meta.bg, meta.border)}>
          <Icon className={cn('h-4 w-4', meta.text)} />
        </div>
        <div className="min-w-0">
          <p className={cn('text-[11px] font-bold leading-none truncate', meta.text)}>{data.kind.toUpperCase()}</p>
          <p className="text-xs text-foreground font-medium leading-snug mt-0.5 truncate">{data.label}</p>
          {data.subtitle && (
            <p className="text-[10px] text-muted-foreground leading-none mt-0.5 truncate">{data.subtitle}</p>
          )}
        </div>
      </div>
    </div>
  );
}

const nodeTypes = { flowNode: FlowNode };

// ─── Default nodes ─────────────────────────────────────────────
const defaultNodes: Node<FlowNodeData>[] = [
  { id: '1', type: 'flowNode', position: { x: 60,  y: 200 }, data: { kind: 'start',       label: 'Lead qualificado',       subtitle: 'WhatsApp / formulário' } },
  { id: '2', type: 'flowNode', position: { x: 300, y: 200 }, data: { kind: 'sdr',         label: 'Qualificação SDR',        subtitle: 'IA responde + agenda' } },
  { id: '3', type: 'flowNode', position: { x: 540, y: 100 }, data: { kind: 'schedule',    label: 'Reunião agendada',        subtitle: 'Google Calendar' } },
  { id: '4', type: 'flowNode', position: { x: 540, y: 300 }, data: { kind: 'remarketing', label: 'Sem resposta',            subtitle: 'Sequência 3 dias' } },
  { id: '5', type: 'flowNode', position: { x: 780, y: 40  }, data: { kind: 'follow',      label: 'Follow-up pré-reunião',  subtitle: 'D-1, D-2 confirmações' } },
  { id: '6', type: 'flowNode', position: { x: 780, y: 160 }, data: { kind: 'noshow',      label: 'Anti-Noshow',            subtitle: 'Lembrete 2h antes' } },
  { id: '7', type: 'flowNode', position: { x: 1020, y: 100 }, data: { kind: 'trial',      label: 'Trial SaaS',             subtitle: 'Onboarding automático' } },
  { id: '8', type: 'flowNode', position: { x: 1020, y: 260 }, data: { kind: 'end',        label: 'Perdido / Nurturing',    subtitle: 'Sai do fluxo ativo' } },
  { id: '9', type: 'flowNode', position: { x: 1260, y: 100 }, data: { kind: 'metrics',    label: 'Métricas',               subtitle: 'Dashboard em tempo real' } },
];

const edgeBase = { type: 'smoothstep', markerEnd: { type: MarkerType.ArrowClosed, width: 14, height: 14 }, style: { strokeWidth: 1.5 } };

const defaultEdges: Edge[] = [
  { id: 'e1-2',  source: '1', target: '2', ...edgeBase },
  { id: 'e2-3',  source: '2', target: '3', ...edgeBase, label: 'Agendou',   labelStyle: { fontSize: 10 }, style: { ...edgeBase.style, stroke: '#15803d' } },
  { id: 'e2-4',  source: '2', target: '4', ...edgeBase, label: 'Sem resposta', labelStyle: { fontSize: 10 }, style: { ...edgeBase.style, stroke: '#f43f5e' } },
  { id: 'e3-5',  source: '3', target: '5', ...edgeBase },
  { id: 'e3-6',  source: '3', target: '6', ...edgeBase },
  { id: 'e5-7',  source: '5', target: '7', ...edgeBase, label: 'Compareceu', labelStyle: { fontSize: 10 } },
  { id: 'e6-8',  source: '6', target: '8', ...edgeBase, label: 'Noshow',     labelStyle: { fontSize: 10 }, style: { ...edgeBase.style, stroke: '#f97316' } },
  { id: 'e7-9',  source: '7', target: '9', ...edgeBase },
];

// ─── Palette ───────────────────────────────────────────────────
const PALETTE: NodeKind[] = ['sdr', 'schedule', 'follow', 'noshow', 'remarketing', 'trial', 'metrics', 'condition', 'end'];

let nodeIdCounter = defaultNodes.length + 1;

export default function FlowMapEditor() {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node<FlowNodeData>>(defaultNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(defaultEdges);
  const [selectedNodes, setSelectedNodes] = useState<string[]>([]);

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge({ ...params, ...edgeBase }, eds)),
    [setEdges]
  );

  const addNode = useCallback((kind: NodeKind) => {
    const meta = KIND_META[kind];
    const id = String(++nodeIdCounter);
    setNodes((nds) => [
      ...nds,
      {
        id,
        type: 'flowNode',
        position: { x: 200 + Math.random() * 400, y: 100 + Math.random() * 300 },
        data: { kind, label: meta.label },
      },
    ]);
  }, [setNodes]);

  const deleteSelected = useCallback(() => {
    setNodes((nds) => nds.filter((n) => !selectedNodes.includes(n.id)));
    setEdges((eds) => eds.filter((e) => !selectedNodes.includes(e.source) && !selectedNodes.includes(e.target)));
    setSelectedNodes([]);
  }, [selectedNodes, setNodes, setEdges]);

  return (
    <div className="w-full h-full flex flex-col bg-background">
      {/* Topbar */}
      <div className="flex items-center justify-between px-4 h-12 border-b border-border bg-card flex-shrink-0">
        <div className="flex items-center gap-3">
          <Link
            href="/configuracoes/fluxos"
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Fluxos
          </Link>
          <span className="text-border">|</span>
          <p className="text-sm font-semibold text-foreground">Mapa de automação</p>
        </div>
        <div className="flex items-center gap-2">
          {selectedNodes.length > 0 && (
            <button
              onClick={deleteSelected}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-destructive/10 text-destructive border border-destructive/20 hover:bg-destructive/20 transition-colors"
            >
              <Trash2 className="h-3 w-3" />
              Remover ({selectedNodes.length})
            </button>
          )}
          <p className="text-xs text-muted-foreground">Clique e arraste para conectar nós</p>
        </div>
      </div>

      <div className="flex flex-1 min-h-0">
        {/* Left palette */}
        <div className="w-44 flex-shrink-0 border-r border-border bg-card p-3 flex flex-col gap-1 overflow-y-auto">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60 px-1 mb-1">Adicionar nó</p>
          {PALETTE.map((kind) => {
            const meta = KIND_META[kind];
            const Icon = meta.icon;
            return (
              <button
                key={kind}
                onClick={() => addNode(kind)}
                className={cn(
                  'flex items-center gap-2 px-2.5 py-2 rounded-xl border text-left transition-colors hover:shadow-sm',
                  meta.bg, meta.border
                )}
              >
                <Icon className={cn('h-3.5 w-3.5 flex-shrink-0', meta.text)} />
                <span className="text-xs font-medium text-foreground truncate">{meta.label}</span>
                <Plus className="h-3 w-3 ml-auto text-muted-foreground/50" />
              </button>
            );
          })}
        </div>

        {/* Canvas */}
        <div className="flex-1 min-w-0">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            nodeTypes={nodeTypes}
            onSelectionChange={({ nodes: sel }) => setSelectedNodes(sel.map((n) => n.id))}
            fitView
            fitViewOptions={{ padding: 0.2 }}
            proOptions={{ hideAttribution: true }}
            deleteKeyCode="Delete"
            className="bg-background"
          >
            <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="hsl(var(--border))" />
            <Controls className="!bg-card !border-border [&>button]:!bg-card [&>button]:!text-foreground [&>button:hover]:!bg-accent" />
            <MiniMap
              nodeColor={(n) => {
                const d = n.data as FlowNodeData;
                const meta = KIND_META[d?.kind ?? 'sdr'];
                return meta.border.replace('border-', '').replace('/40', '').replace('/30', '');
              }}
              className="!bg-card !border-border"
              maskColor="hsl(var(--background) / 0.7)"
            />
            <Panel position="bottom-center">
              <p className="text-[10px] text-muted-foreground/50 bg-card/80 px-3 py-1 rounded-full border border-border backdrop-blur">
                Arraste para mover · Ctrl+scroll para zoom · Delete para remover selecionados
              </p>
            </Panel>
          </ReactFlow>
        </div>
      </div>
    </div>
  );
}
