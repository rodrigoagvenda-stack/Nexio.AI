'use client';

import '@xyflow/react/dist/style.css';

import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  reconnectEdge,
  useNodesState,
  useEdgesState,
  Handle,
  Position,
  MarkerType,
  BackgroundVariant,
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  type Connection,
  type Node,
  type Edge,
  type NodeProps,
  type EdgeProps,
  useReactFlow,
  ReactFlowProvider,
} from '@xyflow/react';
import {
  useCallback,
  useEffect,
  useMemo,
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
  CalendarCheck,
  Megaphone,
  FlaskConical,
  StopCircle,
  MapPin,
  List,
  LayoutList,
  GalleryHorizontal,
  Smile,
  ChevronDown,
  Trash2,
  Link,
  Phone,
  MessageCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';

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
  media_config?: { file?: string; text?: string; docName?: string; [k: string]: any } | null;
}

// Canvas (PT) ↔ uazapi (EN) tipo mapping
const CANVAS_TO_UAZAPI: Record<string, string> = {
  texto: 'text', imagem: 'image', video: 'video',
  audio: 'ptt',  // canvas "áudio" always sends as PTT (voice message)
  documento: 'document',
  localizacao: 'location', lista: 'menu', botoes: 'menu',
  carrossel: 'carousel', sticker: 'sticker',
};
const UAZAPI_TO_CANVAS: Record<string, string> = {
  text: 'texto', image: 'imagem', video: 'video',
  audio: 'audio', ptt: 'audio',  // both map to single canvas "audio" type
  document: 'documento',
  location: 'localizacao', menu: 'lista', carousel: 'carrossel', sticker: 'sticker',
};

interface CanvasConfigEdge {
  sourceIdx: number;   // -1 = trigger, 0..N = index in x-sorted non-trigger nodes
  targetIdx: number;
  sourceHandle?: string;
  targetHandle?: string;
}

interface RemarketingConfig {
  statusFiltros: string[];   // CRM statuses that enter this remarketing flow
  diasInativo: number;       // min days with no reply before including lead
}

interface CanvasConfig {
  positions: { x: number; y: number }[];  // indexed by x-sorted step order
  triggerPos: { x: number; y: number };
  edges: CanvasConfigEdge[];
  remarketing?: RemarketingConfig;
  customLabels?: Record<string, string>; // stepId → customLabel (persisted separately from steps)
}

interface FollowSequence {
  id: string;
  nome: string;
  tipo: SequenceTipo;
  ativo: boolean;
  follow_steps: FollowStep[];
  canvas_config?: CanvasConfig | null;
}

// ─── Node Exec State ────────────────────────────────────────────────────────────

type ExecState = 'idle' | 'running' | 'success' | 'error' | 'skipped';

// ─── Node Data Types ────────────────────────────────────────────────────────────

interface TriggerNodeData extends Record<string, unknown> {
  kind: 'trigger';
  label: string;
  condicao: string;
  customLabel?: string;
  _execState?: ExecState;
  _execError?: string;
  _leadCount?: number;
}

interface MessageNodeData extends Record<string, unknown> {
  kind: 'message';
  label: string;
  dia_offset: number;
  horario: string;
  mensagem: string | null;
  _leadCount?: number;
  tipo_mensagem: string;
  stepId: string;
  customLabel?: string;
  // Blocos: multiple text messages sent sequentially (texto type only)
  blocos?: string[];
  media_url?: string;
  media_name?: string;
  uploading?: boolean;
  // Localização (Google Maps URL + labels)
  location_url?: string;
  location_name?: string;
  location_address?: string;
  // Lista / Botões (newline-separated serialized)
  menu_choices?: string;
  // Carrossel (JSON string)
  carousel_json?: string;
  // Controle de IA: null = sem mudança, true = ativar, false = pausar
  sdr_ativo?: boolean | null;
  // Unidade do dia_offset: 'days' (padrão) ou 'hours'. Para anti_noshow sempre 'hours'.
  offset_unit?: 'days' | 'hours';
  _execState?: ExecState;
  _execError?: string;
}

interface WaitNodeData extends Record<string, unknown> {
  kind: 'wait';
  label: string;
  dia_offset: number;
  stepId: string;
  customLabel?: string;
  _execState?: ExecState;
  _execError?: string;
}

interface ConditionNodeData extends Record<string, unknown> {
  kind: 'condition';
  label: string;
  condicao: string;
  variavel?: string;
  operador?: 'eq' | 'contains' | 'starts_with' | 'not_empty';
  valor?: string;
  stepId: string;
  customLabel?: string;
  _execState?: ExecState;
  _execError?: string;
}

interface EndNodeData extends Record<string, unknown> {
  kind: 'end';
  label: string;
  stepId: string;
  customLabel?: string;
  _execState?: ExecState;
  _execError?: string;
}

interface WebhookNodeData extends Record<string, unknown> {
  kind: 'webhook';
  label: string;
  url: string;
  method: 'POST' | 'GET';
  stepId: string;
  customLabel?: string;
  _execState?: ExecState;
  _execError?: string;
}

interface LeadScoreNodeData extends Record<string, unknown> {
  kind: 'lead_score';
  label: string;
  scoreMin: number;
  scoreMax: number;
  stepId: string;
  customLabel?: string;
  _execState?: ExecState;
  _execError?: string;
}

interface ABTestNodeData extends Record<string, unknown> {
  kind: 'ab_test';
  label: string;
  variantA: string;
  variantB: string;
  stepId: string;
  customLabel?: string;
  _execState?: ExecState;
  _execError?: string;
}

interface SchedulingNodeData extends Record<string, unknown> {
  kind: 'scheduling';
  label: string;
  dia_offset: number;
  horario: string;
  duracao?: number;
  mensagemInicial?: string;
  stepId: string;
  customLabel?: string;
  _execState?: ExecState;
  _execError?: string;
}

interface SwitchCase { value: string; label: string }
interface SwitchNodeData extends Record<string, unknown> {
  kind: 'switch';
  label: string;
  variavel: string;
  cases: SwitchCase[];
  stepId: string;
  customLabel?: string;
  _execState?: ExecState;
  _execError?: string;
}

type AutoNodeData =
  | TriggerNodeData
  | MessageNodeData
  | WaitNodeData
  | ConditionNodeData
  | SwitchNodeData
  | EndNodeData
  | WebhookNodeData
  | LeadScoreNodeData
  | ABTestNodeData
  | SchedulingNodeData;

// ─── Google Maps URL parser ──────────────────────────────────────────────────────

function parseGoogleMapsUrl(url: string): { lat: number; lng: number } | null {
  if (!url) return null;
  const atMatch = url.match(/@(-?\d+\.?\d*),(-?\d+\.?\d*)/);
  if (atMatch) return { lat: parseFloat(atMatch[1]), lng: parseFloat(atMatch[2]) };
  const qMatch = url.match(/[?&]q=(-?\d+\.?\d*),(-?\d+\.?\d*)/);
  if (qMatch) return { lat: parseFloat(qMatch[1]), lng: parseFloat(qMatch[2]) };
  const llMatch = url.match(/[?&]ll=(-?\d+\.?\d*),(-?\d+\.?\d*)/);
  if (llMatch) return { lat: parseFloat(llMatch[1]), lng: parseFloat(llMatch[2]) };
  return null;
}

// ─── Button / Lista serialization ────────────────────────────────────────────────

type ButtonType = 'reply' | 'url' | 'call';
interface ButtonDef { label: string; type: ButtonType; value: string }

function parseButtons(raw: string): ButtonDef[] {
  return (raw || '').split('\n').map(l => l.trim()).filter(Boolean).map(line => {
    const idx = line.indexOf('|');
    if (idx === -1) return { label: line, type: 'reply' as ButtonType, value: '' };
    const label = line.slice(0, idx);
    const val = line.slice(idx + 1);
    if (val.startsWith('https://') || val.startsWith('http://')) return { label, type: 'url' as ButtonType, value: val };
    if (val.startsWith('call:')) return { label, type: 'call' as ButtonType, value: val.slice(5) };
    return { label, type: 'reply' as ButtonType, value: val };
  });
}

function serializeButtons(buttons: ButtonDef[]): string {
  return buttons.map(b => {
    if (b.type === 'url') return `${b.label}|${b.value}`;
    if (b.type === 'call') return `${b.label}|call:${b.value}`;
    return `${b.label}|${b.value || b.label.toLowerCase().replace(/\s+/g, '_')}`;
  }).join('\n');
}

interface ListItem { label: string; id: string; desc: string }
interface ListSection { title: string; items: ListItem[] }

function parseLista(raw: string): ListSection[] {
  const lines = (raw || '').split('\n').map(l => l.trim()).filter(Boolean);
  const sections: ListSection[] = [];
  let current: ListSection | null = null;
  for (const line of lines) {
    if (line.startsWith('[') && line.endsWith(']')) {
      current = { title: line.slice(1, -1), items: [] };
      sections.push(current);
    } else {
      const parts = line.split('|');
      if (!current) { current = { title: '', items: [] }; sections.push(current); }
      current.items.push({ label: parts[0] ?? '', id: parts[1] ?? '', desc: parts[2] ?? '' });
    }
  }
  return sections;
}

function serializeLista(sections: ListSection[]): string {
  return sections.flatMap(s => [
    s.title ? `[${s.title}]` : null,
    ...s.items.map(i => [i.label, i.id, i.desc].join('|').replace(/\|+$/, '')),
  ]).filter((l): l is string => l !== null).join('\n');
}

interface CarouselCard { text: string; image: string; buttons: ButtonDef[] }

function parseCarousel(raw: string): CarouselCard[] {
  try {
    const arr = JSON.parse(raw || '[]');
    if (!Array.isArray(arr)) return [];
    return arr.map((c: any) => ({
      text: c.text ?? '',
      image: c.image ?? '',
      buttons: Array.isArray(c.buttons) ? c.buttons.map((b: any) => {
        if (typeof b === 'string') return parseButtons(b)[0] ?? { label: b, type: 'reply' as ButtonType, value: '' };
        return { label: b.label ?? '', type: (b.type ?? 'reply') as ButtonType, value: b.value ?? '' };
      }) : [],
    }));
  } catch { return []; }
}

function serializeCarousel(cards: CarouselCard[]): string {
  return JSON.stringify(cards.map(c => ({
    text: c.text,
    image: c.image,
    buttons: c.buttons.map(b => {
      if (b.type === 'url') return b.label + '|' + b.value;
      if (b.type === 'call') return b.label + '|call:' + b.value;
      return b.label + '|' + (b.value || b.label.toLowerCase().replace(/\s+/g, '_'));
    }),
  })), null, 2);
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
  type: 'deletable',
  markerEnd: { type: MarkerType.ArrowClosed, width: 12, height: 12, color: 'hsl(var(--border))' },
  style: { stroke: 'hsl(var(--border))', strokeWidth: 1.5 },
} as const;

function handleLabel(handle?: string, step?: FollowStep | null): string | undefined {
  if (!handle) return undefined;
  if (handle === 'sim') return 'Sim';
  if (handle === 'nao') return 'Não';
  if (handle === 'else') return 'else';
  if (handle.startsWith('case-')) {
    const idx = parseInt(handle.replace('case-', ''), 10);
    const mc = step?.media_config as any;
    return mc?.cases?.[idx]?.label || mc?.cases?.[idx]?.value || handle;
  }
  return undefined;
}

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

function stepsToNodes(steps: FollowStep[], sequenceName: string, canvasConfig?: CanvasConfig | null, sequenceTipo?: SequenceTipo): Node<AutoNodeData>[] {
  const nodes: Node<AutoNodeData>[] = [];
  const triggerPos = canvasConfig?.triggerPos ?? { x: 0, y: 150 };
  nodes.push({
    id: 'trigger', type: 'triggerNode', position: triggerPos,
    data: { kind: 'trigger', label: sequenceName, condicao: 'Início da sequência' } satisfies TriggerNodeData,
  });
  const sorted = [...steps].sort((a, b) => a.ordem - b.ordem);
  sorted.forEach((step, idx) => {
    const stored = canvasConfig?.positions?.[idx];
    const x = stored?.x ?? (idx + 1) * 280;
    const y = stored?.y ?? 150;
    const condicaoLower = step.condicao?.toLowerCase() ?? '';
    // Normalize tipo: DB may store EN ('text') or legacy PT ('texto') — map both to canvas PT
    let tipoCanvas = UAZAPI_TO_CANVAS[step.tipo_mensagem] ?? step.tipo_mensagem;
    // Distinguish lista vs botoes by menuType stored in media_config
    if (tipoCanvas === 'lista' && step.media_config?.menuType === 'button') tipoCanvas = 'botoes';
    const isScheduling = step.tipo_mensagem === 'agendamento';
    const isFim = tipoCanvas === 'fim' || step.condicao?.toLowerCase().includes('fim') || step.condicao?.toLowerCase().includes('encerr');
    const isCondition = tipoCanvas === 'condicao' || step.condicao?.toLowerCase().includes('respondeu') || step.condicao?.toLowerCase().includes('condicao');
    const hasMedia = !!step.media_config?.file || !!step.media_config?.latitude || !!step.media_config?.choices || !!step.media_config?.carousel;
    const isWait = tipoCanvas === 'aguardar' || (!hasMedia && step.mensagem === null && !isFim && !isCondition && !isScheduling);

    // Extract media from media_config (stored by nodesToSteps)
    const media_url = step.media_config?.file ?? undefined;
    const media_name = step.media_config?.docName ?? undefined;
    const mensagemDisplay = step.mensagem ?? step.media_config?.text ?? null;
    // Location fields — reconstruct Google Maps URL from stored coordinates
    const location_name = step.media_config?.name as string | undefined;
    const location_address = step.media_config?.address as string | undefined;
    const _lat = step.media_config?.latitude as number | undefined;
    const _lng = step.media_config?.longitude as number | undefined;
    const location_url = (_lat != null && _lng != null && (_lat !== 0 || _lng !== 0))
      ? `https://www.google.com/maps/@${_lat},${_lng},17z`
      : undefined;
    // Menu fields — prefer raw ButtonDef array for roundtrip fidelity, fall back to labels
    const menu_choices = Array.isArray((step.media_config as any)?.buttons)
      ? serializeButtons((step.media_config as any).buttons as ButtonDef[])
      : Array.isArray(step.media_config?.choices)
        ? (step.media_config!.choices as string[]).join('\n')
        : undefined;
    // Carousel
    const carousel_json = Array.isArray(step.media_config?.carousel) ? JSON.stringify(step.media_config!.carousel, null, 2) : undefined;
    // Blocos: array of separate text messages sent sequentially
    const blocos = Array.isArray(step.media_config?.blocos) && (step.media_config!.blocos as string[]).length > 0
      ? (step.media_config!.blocos as string[])
      : undefined;
    // Custom label (stored in canvas_config.customLabels keyed by stepId)
    const customLabel = canvasConfig?.customLabels?.[step.id] ?? undefined;

    if (isFim) nodes.push({ id: step.id, type: 'endNode', position: { x, y }, data: { kind: 'end', label: 'Encerrar sequência', stepId: step.id, customLabel } satisfies EndNodeData });
    else if (step.tipo_mensagem === 'switch') {
      const mc = step.media_config as any ?? {};
      nodes.push({ id: step.id, type: 'switchNode', position: { x, y },
        data: { kind: 'switch', label: 'Switch', variavel: mc.variavel ?? 'resposta_botao', cases: mc.cases ?? [], stepId: step.id, customLabel } satisfies SwitchNodeData });
    }
    else if (isCondition) {
      const mc = step.media_config as any ?? {};
      let variavel = mc.variavel ?? 'resposta_botao';
      let operador: ConditionNodeData['operador'] = mc.operador ?? 'eq';
      let valor = mc.valor ?? '';
      if (!mc.variavel) {
        try { const p = JSON.parse(step.condicao); if (p?.variavel) { variavel = p.variavel; operador = p.operador; valor = p.valor; } } catch {}
      }
      // When variavel is 'custom', restore the custom variable name from media_config.customVariavel
      const condicaoCanvas = variavel === 'custom' ? (mc.customVariavel || step.condicao || '') : (step.condicao || 'Respondeu?');
      nodes.push({ id: step.id, type: 'conditionNode', position: { x, y },
        data: { kind: 'condition', label: 'Condição', condicao: condicaoCanvas, variavel, operador, valor, stepId: step.id, customLabel } satisfies ConditionNodeData });
    }
    else if (isScheduling) {
      const smc = step.media_config as any ?? {};
      nodes.push({ id: step.id, type: 'schedulingNode', position: { x, y },
        data: { kind: 'scheduling', label: 'Agendar Call', dia_offset: step.dia_offset, horario: step.horario ?? '09:00',
          duracao: smc.duracao ?? 60, mensagemInicial: smc.mensagemInicial ?? '', stepId: step.id, customLabel } satisfies SchedulingNodeData });
    }
    else if (step.tipo_mensagem === 'webhook') {
      const wmc = step.media_config as any ?? {};
      const url = wmc.url ?? step.condicao ?? '';
      const method = wmc.method ?? 'POST';
      nodes.push({ id: step.id, type: 'webhookNode', position: { x, y },
        data: { kind: 'webhook', label: 'Webhook', url, method, stepId: step.id, customLabel } satisfies WebhookNodeData });
    }
    else if (step.tipo_mensagem === 'lead_score') {
      const lmc = step.media_config as any ?? {};
      const legacyParts = (step.condicao ?? '').split('-');
      const scoreMin = lmc.scoreMin ?? (parseInt(legacyParts[0] ?? '0') || 0);
      const scoreMax = lmc.scoreMax ?? (parseInt(legacyParts[1] ?? '100') || 100);
      nodes.push({ id: step.id, type: 'leadScoreNode', position: { x, y },
        data: { kind: 'lead_score', label: 'Lead Score', scoreMin, scoreMax, stepId: step.id, customLabel } satisfies LeadScoreNodeData });
    }
    else if (step.tipo_mensagem === 'ab_test') {
      const amc = step.media_config as any ?? {};
      const legacyParts = (step.condicao ?? '').split('|');
      const variantA = amc.variantA ?? legacyParts[0] ?? 'Variante A';
      const variantB = amc.variantB ?? legacyParts[1] ?? 'Variante B';
      nodes.push({ id: step.id, type: 'abTestNode', position: { x, y },
        data: { kind: 'ab_test', label: 'Teste A/B', variantA, variantB, stepId: step.id, customLabel } satisfies ABTestNodeData });
    }
    else if (isWait) nodes.push({ id: step.id, type: 'waitNode', position: { x, y }, data: { kind: 'wait', label: 'Aguardar', dia_offset: step.dia_offset, stepId: step.id, customLabel } satisfies WaitNodeData });
    else {
      const offset_unit: 'days' | 'hours' = (step.media_config as any)?.offset_unit ?? (sequenceTipo === 'anti_noshow' ? 'hours' : 'days');
      nodes.push({ id: step.id, type: 'messageNode', position: { x, y }, data: { kind: 'message', label: 'Mensagem', dia_offset: step.dia_offset, horario: step.horario, mensagem: mensagemDisplay, tipo_mensagem: tipoCanvas, stepId: step.id, media_url, media_name, location_url, location_name, location_address, menu_choices, carousel_json, blocos, customLabel, sdr_ativo: step.sdr_ativo ?? null, offset_unit } satisfies MessageNodeData });
    }
  });
  return nodes;
}

function stepsToEdges(steps: FollowStep[], canvasConfig?: CanvasConfig | null): Edge[] {
  const sorted = [...steps].sort((a, b) => a.ordem - b.ordem);

  if (canvasConfig?.edges?.length) {
    return canvasConfig.edges
      .map((e, i) => {
        const src = e.sourceIdx === -1 ? 'trigger' : sorted[e.sourceIdx]?.id;
        const tgt = e.targetIdx === -1 ? 'trigger' : sorted[e.targetIdx]?.id;
        const sourceStep = e.sourceIdx === -1 ? null : sorted[e.sourceIdx] ?? null;
        if (!src || !tgt) return null;
        const label = handleLabel(e.sourceHandle, sourceStep);
        return { id: `ec-${i}-${src}-${tgt}`, source: src, target: tgt, sourceHandle: e.sourceHandle, targetHandle: e.targetHandle, label, ...EDGE_BASE };
      })
      .filter(Boolean) as Edge[];
  }

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
    if (d.kind === 'message') {
      const tipoDb = CANVAS_TO_UAZAPI[d.tipo_mensagem] ?? d.tipo_mensagem ?? 'text';
      let media_config: FollowStep['media_config'] = null;

      if (d.tipo_mensagem === 'texto' && d.blocos && d.blocos.length > 0) {
        media_config = { blocos: d.blocos };
      } else if (d.tipo_mensagem === 'localizacao') {
        const coords = parseGoogleMapsUrl(String(d.location_url ?? ''));
        media_config = {
          name: d.location_name ?? '',
          address: d.location_address ?? '',
          latitude: coords?.lat ?? 0,
          longitude: coords?.lng ?? 0,
        };
      } else if (d.tipo_mensagem === 'botoes') {
        const buttons = parseButtons(d.menu_choices ?? '');
        media_config = {
          menuType: 'button',
          choices: buttons.map(b => b.label),   // only labels sent to uazapi
          buttons,                               // full metadata for roundtrip
          text: d.mensagem || undefined,
        };
      } else if (d.tipo_mensagem === 'lista') {
        const sections = parseLista(d.menu_choices ?? '');
        const choices = sections.flatMap(s => s.items.map(i => i.label)).filter(Boolean);
        media_config = { menuType: 'list', choices, sections, text: d.mensagem || undefined };
      } else if (d.tipo_mensagem === 'carrossel') {
        let carousel: unknown[] = [];
        try { carousel = JSON.parse(String(d.carousel_json ?? '[]')); } catch { /* invalid json */ }
        media_config = { carousel, text: d.mensagem || undefined };
      } else if (d.media_url) {
        media_config = { file: d.media_url, text: d.mensagem || undefined, docName: d.media_name || undefined };
      }

      // When using blocos, first block becomes mensagem for backwards compat with executors
      const mensagemFinal = d.blocos && d.blocos.length > 0 ? (d.blocos[0] || null) : (d.mensagem || null);
      const finalMediaConfig = d.offset_unit === 'hours'
        ? { ...(media_config ?? {}), offset_unit: 'hours' }
        : media_config;
      return { id: stepId, dia_offset: d.dia_offset, horario: d.offset_unit === 'hours' ? '00:00' : d.horario, mensagem: mensagemFinal, tipo_mensagem: tipoDb, ordem: idx + 1, condicao: '', media_config: finalMediaConfig,
        sdr_ativo: d.sdr_ativo ?? null };
    }
    if (d.kind === 'wait') return { id: stepId, dia_offset: d.dia_offset, horario: '00:00', mensagem: null, tipo_mensagem: 'aguardar', ordem: idx + 1, condicao: '' };
    if (d.kind === 'condition') {
      const isCustomVar = d.variavel === 'custom';
      return { id: stepId, dia_offset: 0, horario: '00:00', mensagem: null, tipo_mensagem: 'condicao', ordem: idx + 1,
        condicao: null, // null passes the DB CHECK constraint — tipo_mensagem='condicao' já identifica o node
        media_config: {
          variavel: d.variavel ?? 'resposta_botao',
          ...(isCustomVar && { customVariavel: d.condicao || '' }),
          operador: d.operador ?? 'eq',
          valor: d.valor ?? '',
        } };
    }
    if (d.kind === 'switch') {
      return { id: stepId, dia_offset: 0, horario: '00:00', mensagem: null, tipo_mensagem: 'switch', ordem: idx + 1,
        condicao: '',
        media_config: { variavel: d.variavel ?? 'resposta_botao', cases: d.cases ?? [] } };
    }
    if (d.kind === 'webhook') return { id: stepId, dia_offset: 0, horario: '00:00', mensagem: null, tipo_mensagem: 'webhook', ordem: idx + 1, condicao: '', media_config: { url: d.url, method: d.method ?? 'POST' } };
    if (d.kind === 'lead_score') return { id: stepId, dia_offset: 0, horario: '00:00', mensagem: null, tipo_mensagem: 'lead_score', ordem: idx + 1, condicao: '', media_config: { scoreMin: d.scoreMin, scoreMax: d.scoreMax } };
    if (d.kind === 'ab_test') return { id: stepId, dia_offset: 0, horario: '00:00', mensagem: null, tipo_mensagem: 'ab_test', ordem: idx + 1, condicao: '', media_config: { variantA: d.variantA, variantB: d.variantB } };
    if (d.kind === 'scheduling') {
      const sd = d as SchedulingNodeData;
      return { id: stepId, dia_offset: sd.dia_offset ?? 0, horario: sd.horario ?? '09:00', mensagem: null, tipo_mensagem: 'agendamento', ordem: idx + 1, condicao: '',
        media_config: { duracao: sd.duracao ?? 60, ...(sd.mensagemInicial ? { mensagemInicial: sd.mensagemInicial } : {}) } };
    }
    return { id: stepId, dia_offset: 0, horario: '00:00', mensagem: null, tipo_mensagem: 'fim', ordem: idx + 1, condicao: '' };
  });
}

let nodeCounter = 1000;
function newId() { return `new-${++nodeCounter}`; }

// ─── Node Accent System ─────────────────────────────────────────────────────────

const ACCENTS = {
  primary:     { icon: 'text-[hsl(var(--primary))]', dot: 'bg-[hsl(var(--primary))]',  sel: 'ring-[hsl(var(--primary)/0.4)] border-[hsl(var(--primary)/0.25)]'  },
  emerald:     { icon: 'text-emerald-500',            dot: 'bg-emerald-500',             sel: 'ring-emerald-500/35 border-emerald-500/20'                         },
  amber:       { icon: 'text-amber-500',              dot: 'bg-amber-500',               sel: 'ring-amber-500/35 border-amber-500/20'                             },
  violet:      { icon: 'text-violet-500',             dot: 'bg-violet-500',              sel: 'ring-violet-500/35 border-violet-500/20'                           },
  destructive: { icon: 'text-destructive',            dot: 'bg-destructive',             sel: 'ring-destructive/35 border-destructive/20'                         },
  blue:        { icon: 'text-blue-500',               dot: 'bg-blue-500',                sel: 'ring-blue-500/35 border-blue-500/20'                               },
  cyan:        { icon: 'text-cyan-500',               dot: 'bg-cyan-500',                sel: 'ring-cyan-500/35 border-cyan-500/20'                               },
  rose:        { icon: 'text-rose-500',               dot: 'bg-rose-500',                sel: 'ring-rose-500/35 border-rose-500/20'                               },
} as const;
type AccentKey = keyof typeof ACCENTS;

// ─── Node building blocks ───────────────────────────────────────────────────────

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
      <div className="absolute -top-2 -right-2 z-10 group">
        <div className="w-5 h-5 rounded-full bg-destructive flex items-center justify-center cursor-default">
          <X className="w-3 h-3 text-white" />
        </div>
        {error && (
          <div className="absolute right-0 top-6 z-20 w-52 bg-popover text-destructive text-[10px] leading-snug px-2.5 py-2 rounded-lg shadow-xl border border-border pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-150">
            {error}
          </div>
        )}
      </div>
    );
  }
  if (state === 'skipped') {
    return (
      <div className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-muted-foreground/50 flex items-center justify-center z-10">
        <span className="text-[8px] text-white font-bold leading-none">–</span>
      </div>
    );
  }
  return null;
}

function NodeShell({ children, selected, accent = 'primary', header, execState, execError, leadCount }: {
  children: React.ReactNode;
  selected?: boolean;
  accent?: AccentKey;
  header: React.ReactNode;
  execState?: ExecState;
  execError?: string;
  leadCount?: number;
}) {
  const isRunning = execState === 'running';
  const isSuccess = execState === 'success';
  const isError = execState === 'error';
  const isSkipped = execState === 'skipped';
  const acc = ACCENTS[accent];
  return (
    <div className={cn(
      'relative bg-card rounded-xl w-[240px] border transition-all duration-100',
      'shadow-[0_1px_3px_rgba(0,0,0,0.07),0_4px_14px_rgba(0,0,0,0.05)]',
      isSkipped && 'opacity-40',
      isRunning ? 'node-running border-border/30'
        : isSuccess ? 'node-success border-border/30'
        : isError ? 'node-error border-border/30'
        : selected
          ? cn('ring-2', acc.sel, 'shadow-[0_4px_24px_rgba(0,0,0,0.1)]')
          : 'border-border/25 hover:border-border/40 hover:shadow-[0_4px_20px_rgba(0,0,0,0.08)]',
    )}>
      {leadCount != null && leadCount > 0 && (
        <div className="absolute -top-2 -left-2 z-10 flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-primary text-primary-foreground text-[9px] font-bold leading-none shadow-sm">
          <Phone className="w-2 h-2" />{leadCount}
        </div>
      )}
      <div className="px-3.5 pt-2.5 pb-3 flex flex-col gap-0 relative">
        <ExecBadge state={execState} error={execError} />
        {header}
        <div className="mt-2 flex flex-col gap-1.5">{children}</div>
      </div>
    </div>
  );
}

function NodeHeader({ icon: Icon, label, accent = 'primary', meta, nodeId, customLabel }: {
  icon: React.ElementType; label: string; accent?: AccentKey; meta?: string;
  nodeId?: string; customLabel?: string;
}) {
  const { setNodes } = useReactFlow();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const acc = ACCENTS[accent];

  const startEdit = useCallback((e: React.MouseEvent) => {
    if (!nodeId) return;
    e.stopPropagation();
    e.preventDefault();
    setDraft(customLabel ?? '');
    setEditing(true);
    setTimeout(() => { inputRef.current?.focus(); inputRef.current?.select(); }, 10);
  }, [nodeId, customLabel]);

  const commit = useCallback(() => {
    if (!nodeId) return;
    const trimmed = draft.trim();
    setNodes((nds) => nds.map((n) => n.id === nodeId
      ? { ...n, data: { ...n.data, customLabel: trimmed || undefined } }
      : n
    ));
    setEditing(false);
  }, [nodeId, draft, setNodes]);

  return (
    <div className="flex items-center justify-between gap-2 group" onDoubleClick={startEdit}>
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <div className={cn('w-5 h-5 rounded-md flex items-center justify-center shrink-0 bg-muted/60')}>
          <Icon className={cn('w-3 h-3', acc.icon)} />
        </div>
        {editing ? (
          <input
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); commit(); }
              if (e.key === 'Escape') { e.stopPropagation(); setEditing(false); }
            }}
            onClick={(e) => e.stopPropagation()}
            placeholder={label}
            className="text-[11px] font-semibold bg-muted/60 border border-primary/40 rounded px-1.5 py-0.5 outline-none text-foreground w-full min-w-0"
          />
        ) : (
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1">
              <span className="text-[11px] font-semibold text-foreground/50 tracking-wide uppercase leading-none truncate">{label}</span>
              {nodeId && !customLabel && (
                <PenLine className="w-2.5 h-2.5 text-muted-foreground/0 group-hover:text-muted-foreground/30 transition-colors shrink-0 cursor-text" />
              )}
            </div>
            {customLabel && (
              <p className="text-[11px] font-medium text-foreground/80 leading-snug truncate mt-0.5 flex items-center gap-1">
                <span>—</span>
                <span>{customLabel}</span>
                <PenLine className="w-2.5 h-2.5 text-muted-foreground/0 group-hover:text-muted-foreground/40 transition-colors shrink-0 cursor-text" />
              </p>
            )}
          </div>
        )}
      </div>
      {meta && !editing && (
        <span className="text-[10px] text-muted-foreground/40 font-mono shrink-0 bg-muted/40 px-1.5 py-0.5 rounded">{meta}</span>
      )}
    </div>
  );
}

const HANDLE_CLS = '!w-2.5 !h-2.5 !bg-background !border !border-border/60 !rounded-full !transition-colors hover:!border-primary/50 hover:!bg-primary/10';

// ─── Node Components ────────────────────────────────────────────────────────────

const BARS = [3, 7, 5, 12, 8, 14, 4, 10, 6, 13, 7, 9, 4, 11, 5];

function TriggerNode({ id, data, selected }: NodeProps) {
  const d = data as TriggerNodeData;
  return (
    <NodeShell selected={selected} accent="primary"
      header={<NodeHeader icon={Zap} label="Gatilho" accent="primary" nodeId={id} customLabel={d.customLabel} />}
      execState={d._execState} execError={d._execError} leadCount={d._leadCount}>
      <Handle type="source" position={Position.Right} className={HANDLE_CLS} />
      <p className="text-sm font-semibold text-foreground/90 leading-snug">{d.label}</p>
      {d.condicao && <p className="text-xs text-muted-foreground/70">{d.condicao}</p>}
    </NodeShell>
  );
}

function MessageNode({ id, data, selected }: NodeProps) {
  const d = data as MessageNodeData;
  const meta = d.offset_unit === 'hours'
    ? `${d.dia_offset}h`
    : `D${d.dia_offset} · ${d.horario}`;

  const docExt = d.media_name
    ? d.media_name.split('.').pop()?.toUpperCase() ?? 'DOC'
    : d.media_url
    ? (d.media_url.split('.').pop()?.split('?')[0]?.toUpperCase() ?? 'DOC')
    : 'DOC';

  // Blocks preview: use blocos[] if set, otherwise fall back to single mensagem
  const hasBlocos = d.blocos && d.blocos.length > 0;

  return (
    <NodeShell selected={selected} accent="emerald"
      header={<NodeHeader icon={MessageSquare} label="Mensagem" accent="emerald" meta={meta} nodeId={id} customLabel={d.customLabel} />}
      execState={d._execState} execError={d._execError} leadCount={d._leadCount}>
      <Handle type="target" position={Position.Left} className={HANDLE_CLS} />
      <Handle type="source" position={Position.Right} className={HANDLE_CLS} />

      {d.uploading && (
        <div className="flex items-center gap-2 py-1">
          {[0, 1, 2].map((i) => (
            <div key={i} className="w-1 rounded-full bg-primary animate-bounce"
              style={{ height: `${6 + i * 4}px`, animationDelay: `${i * 0.12}s` }} />
          ))}
          <span className="text-xs text-muted-foreground">Enviando…</span>
        </div>
      )}

      {!d.uploading && d.tipo_mensagem === 'texto' && (
        hasBlocos ? (
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5">
              <span className="text-[9px] font-bold uppercase tracking-widest text-emerald-500/70">
                {(d.blocos as string[]).length} mensagens
              </span>
            </div>
            <p className="text-xs text-foreground/80 leading-relaxed line-clamp-2 bg-muted/30 rounded-lg px-2.5 py-2">
              {(d.blocos as string[])[0] || <span className="text-muted-foreground/40 italic">Sem conteúdo</span>}
            </p>
          </div>
        ) : d.mensagem
          ? <p className="text-xs text-foreground/80 leading-relaxed line-clamp-3 bg-muted/30 rounded-lg px-2.5 py-2">{d.mensagem}</p>
          : <p className="text-xs text-muted-foreground/50 italic">Sem mensagem</p>
      )}

      {!d.uploading && d.tipo_mensagem === 'imagem' && (
        d.media_url ? (
          <div className="flex items-start gap-2.5">
            <img src={d.media_url} alt="" className="w-12 h-12 rounded-lg object-cover shrink-0 border border-border/30" />
            <div className="min-w-0 flex-1 py-0.5">
              {d.mensagem
                ? <p className="text-xs text-foreground/80 leading-snug line-clamp-2">{d.mensagem}</p>
                : <p className="text-xs text-muted-foreground/50 italic">Sem legenda</p>}
              <p className="text-[10px] text-muted-foreground/40 mt-1">Imagem</p>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 py-1">
            <ImageIcon className="w-3.5 h-3.5 text-emerald-500/60" />
            <span className="text-xs text-muted-foreground/60">Adicionar imagem</span>
          </div>
        )
      )}

      {!d.uploading && d.tipo_mensagem === 'video' && (
        d.media_url ? (
          <div className="flex items-start gap-2.5">
            <div className="w-12 h-12 rounded-lg bg-zinc-800 border border-border/30 flex items-center justify-center shrink-0">
              <Play className="w-4 h-4 text-white/60 ml-0.5" fill="currentColor" />
            </div>
            <div className="min-w-0 flex-1 py-0.5">
              {d.mensagem
                ? <p className="text-xs text-foreground/80 leading-snug line-clamp-2">{d.mensagem}</p>
                : <p className="text-xs text-muted-foreground/50 italic">Sem legenda</p>}
              <p className="text-[10px] text-muted-foreground/40 mt-1">Vídeo</p>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 py-1">
            <Video className="w-3.5 h-3.5 text-violet-500/60" />
            <span className="text-xs text-muted-foreground/60">Adicionar vídeo</span>
          </div>
        )
      )}

      {!d.uploading && (d.tipo_mensagem === 'audio' || d.tipo_mensagem === 'ptt') && (
        d.media_url ? (
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-full bg-rose-500/10 flex items-center justify-center shrink-0">
              <Mic className="w-3.5 h-3.5 text-rose-500" />
            </div>
            <div className="flex items-end gap-px flex-1" style={{ height: 16 }}>
              {BARS.map((h, i) => (
                <div key={i} className="rounded-full bg-rose-500/40 flex-1" style={{ height: `${Math.round(h * 14 / 14)}px` }} />
              ))}
            </div>
            <span className="text-[10px] text-muted-foreground/50 font-mono">Voz</span>
          </div>
        ) : (
          <div className="flex items-center gap-2 py-1">
            <Mic className="w-3.5 h-3.5 text-rose-500/60" />
            <span className="text-xs text-muted-foreground/60">Gravar áudio</span>
          </div>
        )
      )}

      {!d.uploading && d.tipo_mensagem === 'documento' && (
        d.media_url ? (
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
              <FileText className="w-4 h-4 text-amber-500" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs text-foreground/80 truncate font-medium">
                {d.media_name || 'documento.' + docExt.toLowerCase()}
              </p>
              <p className="text-[10px] text-muted-foreground/50">{docExt}</p>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 py-1">
            <FileText className="w-3.5 h-3.5 text-amber-500/60" />
            <span className="text-xs text-muted-foreground/60">Adicionar documento</span>
          </div>
        )
      )}

      {!d.uploading && d.tipo_mensagem === 'localizacao' && (
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
            <MapPin className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="min-w-0 flex-1">
            {d.location_name
              ? <p className="text-xs text-foreground/80 truncate font-medium">{d.location_name as string}</p>
              : <p className="text-xs text-muted-foreground/50 italic">
                  {d.location_url ? 'Local configurado' : 'Local não configurado'}
                </p>}
            {d.location_address && <p className="text-[10px] text-muted-foreground/50 truncate">{d.location_address as string}</p>}
          </div>
        </div>
      )}

      {!d.uploading && d.tipo_mensagem === 'lista' && (
        <div className="space-y-1">
          {d.mensagem && <p className="text-xs text-foreground/80 leading-snug line-clamp-2 bg-muted/30 rounded-lg px-2.5 py-2">{d.mensagem}</p>}
          <div className="flex items-center gap-1.5 mt-0.5">
            <List className="w-3 h-3 text-violet-500/60 shrink-0" />
            <span className="text-[10px] text-muted-foreground/60">
              {d.menu_choices
                ? `${(d.menu_choices as string).split('\n').filter(Boolean).length} itens`
                : 'Lista não configurada'}
            </span>
          </div>
        </div>
      )}

      {!d.uploading && d.tipo_mensagem === 'botoes' && (
        <div className="space-y-1">
          {d.mensagem && <p className="text-xs text-foreground/80 leading-snug line-clamp-2 bg-muted/30 rounded-lg px-2.5 py-2">{d.mensagem}</p>}
          <div className="flex flex-wrap gap-1 mt-0.5">
            {d.menu_choices
              ? (d.menu_choices as string).split('\n').filter(Boolean).slice(0, 3).map((btn, i) => (
                  <span key={i} className="text-[10px] px-2 py-0.5 rounded-full border border-border bg-muted text-muted-foreground">
                    {String(btn).split('|')[0].trim()}
                  </span>
                ))
              : <span className="text-[10px] text-muted-foreground/50 italic">Botões não configurados</span>}
          </div>
        </div>
      )}

      {!d.uploading && d.tipo_mensagem === 'carrossel' && (
        <div className="space-y-1">
          {d.mensagem && <p className="text-xs text-foreground/80 leading-snug line-clamp-1 bg-muted/30 rounded-lg px-2.5 py-2">{d.mensagem}</p>}
          <div className="flex items-center gap-1.5 mt-0.5">
            <GalleryHorizontal className="w-3 h-3 text-cyan-500/60 shrink-0" />
            <span className="text-[10px] text-muted-foreground/60">
              {d.carousel_json
                ? (() => { try { return `${(JSON.parse(d.carousel_json as string) as unknown[]).length} cards`; } catch { return 'Carrossel'; } })()
                : 'Carrossel não configurado'}
            </span>
          </div>
        </div>
      )}

      {!d.uploading && d.tipo_mensagem === 'sticker' && (
        d.media_url ? (
          <div className="flex items-center gap-2.5">
            <img src={d.media_url as string} alt="sticker" className="w-12 h-12 rounded-lg object-contain shrink-0 border border-border/30 bg-muted/30" />
            <span className="text-[10px] text-muted-foreground/50">Sticker</span>
          </div>
        ) : (
          <div className="flex items-center gap-2 py-1">
            <Smile className="w-3.5 h-3.5 text-primary/60" />
            <span className="text-xs text-muted-foreground/60">Adicionar sticker</span>
          </div>
        )
      )}

    </NodeShell>
  );
}

function WaitNode({ id, data, selected }: NodeProps) {
  const d = data as WaitNodeData;
  return (
    <NodeShell selected={selected} accent="amber"
      header={<NodeHeader icon={Clock} label="Aguardar" accent="amber" nodeId={id} customLabel={d.customLabel} />}
      execState={d._execState} execError={d._execError}>
      <Handle type="target" position={Position.Left} className={HANDLE_CLS} />
      <Handle type="source" position={Position.Right} className={HANDLE_CLS} />
      <p className="text-sm font-semibold text-foreground/90">{d.dia_offset} dia{d.dia_offset !== 1 ? 's' : ''}</p>
      <p className="text-xs text-muted-foreground/60">antes da próxima mensagem</p>
    </NodeShell>
  );
}

function ConditionNode({ id, data, selected }: NodeProps) {
  const d = data as ConditionNodeData;
  const opLabel: Record<string, string> = { eq: '==', contains: 'contém', starts_with: 'começa', not_empty: '≠ vazio' };
  const condExpr = d.variavel && d.valor != null
    ? `${d.variavel} ${opLabel[d.operador ?? 'eq'] ?? '=='} "${d.valor}"`
    : (d.condicao || 'Respondeu?');
  return (
    <NodeShell selected={selected} accent="violet"
      header={<NodeHeader icon={GitBranch} label="Condição" accent="violet" nodeId={id} customLabel={d.customLabel} />}
      execState={d._execState} execError={d._execError}>
      <Handle type="target" position={Position.Left} className={HANDLE_CLS} />
      <Handle id="sim" type="source" position={Position.Top} style={{ left: '75%' }} className="!w-2.5 !h-2.5 !bg-primary/60 !border !border-primary/40 !rounded-full" />
      <Handle id="nao" type="source" position={Position.Bottom} style={{ left: '75%' }} className="!w-2.5 !h-2.5 !bg-destructive/50 !border !border-destructive/30 !rounded-full" />
      <p className="text-xs font-mono text-foreground/80 bg-muted/60 rounded px-1.5 py-0.5 truncate">{condExpr}</p>
      <div className="flex gap-2 mt-0.5">
        <span className="text-[10px] text-emerald-500 font-medium">↑ Sim</span>
        <span className="text-[10px] text-destructive/70 font-medium">↓ Não</span>
      </div>
    </NodeShell>
  );
}

function EndNode({ id, data, selected }: NodeProps) {
  const d = data as EndNodeData;
  return (
    <NodeShell selected={selected} accent="destructive"
      header={<NodeHeader icon={XCircle} label="Fim" accent="destructive" nodeId={id} customLabel={d.customLabel} />}
      execState={d._execState} execError={d._execError}>
      <Handle type="target" position={Position.Left} className={HANDLE_CLS} />
      <p className="text-xs text-muted-foreground/60">Encerrar sequência</p>
    </NodeShell>
  );
}

function WebhookNode({ id, data, selected }: NodeProps) {
  const d = data as WebhookNodeData;
  const domain = d.url ? getDomain(d.url) : null;
  return (
    <NodeShell selected={selected} accent="blue"
      header={<NodeHeader icon={Globe} label="Webhook" accent="blue" meta={d.method} nodeId={id} customLabel={d.customLabel} />}
      execState={d._execState} execError={d._execError}>
      <Handle type="target" position={Position.Left} className={HANDLE_CLS} />
      <Handle type="source" position={Position.Right} className={HANDLE_CLS} />
      {domain
        ? <p className="text-xs text-foreground/80 font-mono truncate">{truncate(domain, 24)}</p>
        : <p className="text-xs text-muted-foreground/50 italic">URL não configurada</p>}
    </NodeShell>
  );
}

function LeadScoreNode({ id, data, selected }: NodeProps) {
  const d = data as LeadScoreNodeData;
  return (
    <NodeShell selected={selected} accent="amber"
      header={<NodeHeader icon={Star} label="Lead Score" accent="amber" nodeId={id} customLabel={d.customLabel} />}
      execState={d._execState} execError={d._execError}>
      <Handle type="target" position={Position.Left} className={HANDLE_CLS} />
      <Handle id="source-top" type="source" position={Position.Top} style={{ left: '75%' }} className="!w-2.5 !h-2.5 !bg-amber-500/60 !border !border-amber-500/40 !rounded-full" />
      <Handle id="source-bottom" type="source" position={Position.Bottom} style={{ left: '75%' }} className="!w-2.5 !h-2.5 !bg-border !border !border-border/60 !rounded-full" />
      <p className="text-sm font-semibold text-foreground/90">{d.scoreMin}–{d.scoreMax} pontos</p>
      <div className="flex gap-3 mt-0.5">
        <span className="text-[10px] text-amber-500 font-medium">↑ Acima</span>
        <span className="text-[10px] text-muted-foreground/60 font-medium">↓ Abaixo</span>
      </div>
    </NodeShell>
  );
}

function ABTestNode({ id, data, selected }: NodeProps) {
  const d = data as ABTestNodeData;
  return (
    <NodeShell selected={selected} accent="cyan"
      header={<NodeHeader icon={GitMerge} label="Teste A/B" accent="cyan" meta="50/50" nodeId={id} customLabel={d.customLabel} />}
      execState={d._execState} execError={d._execError}>
      <Handle type="target" position={Position.Left} className={HANDLE_CLS} />
      <Handle id="source-top" type="source" position={Position.Top} style={{ left: '75%' }} className="!w-2.5 !h-2.5 !bg-violet-500/60 !border !border-violet-500/40 !rounded-full" />
      <Handle id="source-bottom" type="source" position={Position.Bottom} style={{ left: '75%' }} className="!w-2.5 !h-2.5 !bg-cyan-500/60 !border !border-cyan-500/40 !rounded-full" />
      <div className="flex flex-col gap-1">
        <p className="text-xs text-foreground/80"><span className="text-violet-500 font-medium">A</span> · {truncate(d.variantA, 18) || 'Variante A'}</p>
        <p className="text-xs text-foreground/80"><span className="text-cyan-500 font-medium">B</span> · {truncate(d.variantB, 18) || 'Variante B'}</p>
      </div>
    </NodeShell>
  );
}

// Each case row is ~26px tall; header ~40px + 8px padding top = 48px offset
const SWITCH_ROW_H = 26;
const SWITCH_HEADER_OFFSET = 50;

function SwitchNode({ id, data, selected }: NodeProps) {
  const d = data as SwitchNodeData;
  const cases = d.cases ?? [];
  const COLORS = ['!bg-emerald-500/60 !border-emerald-500/40', '!bg-sky-500/60 !border-sky-500/40', '!bg-violet-500/60 !border-violet-500/40', '!bg-amber-500/60 !border-amber-500/40', '!bg-rose-500/60 !border-rose-500/40'];
  return (
    <NodeShell selected={selected} accent="violet"
      header={<NodeHeader icon={GitMerge} label="Switch" accent="violet" meta={`${cases.length} saídas`} nodeId={id} customLabel={d.customLabel} />}
      execState={d._execState} execError={d._execError}>
      <Handle type="target" position={Position.Left} className={HANDLE_CLS} />
      <p className="text-[10px] text-muted-foreground/60 font-mono mb-1">{d.variavel || 'resposta_botao'}</p>
      <div className="flex flex-col gap-0.5">
        {cases.map((c, i) => (
          <div key={i} className="relative flex items-center gap-2 pr-3">
            <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', i === 0 ? 'bg-emerald-500' : i === 1 ? 'bg-sky-500' : i === 2 ? 'bg-violet-500' : i === 3 ? 'bg-amber-500' : 'bg-rose-500')} />
            <span className="text-xs text-foreground/80 truncate max-w-[130px]">{c.label || c.value}</span>
            <Handle
              id={`case-${i}`}
              type="source"
              position={Position.Right}
              style={{ right: -12, top: '50%', transform: 'translateY(-50%)', position: 'absolute' }}
              className={cn('!w-2.5 !h-2.5 !rounded-full !border', COLORS[i % COLORS.length])}
            />
          </div>
        ))}
        <div className="relative flex items-center gap-2 mt-0.5 opacity-50 pr-3">
          <span className="w-1.5 h-1.5 rounded-full shrink-0 bg-muted-foreground/60" />
          <span className="text-[10px] text-muted-foreground italic">else</span>
          <Handle id="else" type="source" position={Position.Right}
            style={{ right: -12, top: '50%', transform: 'translateY(-50%)', position: 'absolute' }}
            className="!w-2.5 !h-2.5 !rounded-full !border !bg-muted-foreground/40 !border-border" />
        </div>
      </div>
    </NodeShell>
  );
}

// ─── Deletable Edge ─────────────────────────────────────────────────────────────

function DeletableEdge({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, style, markerEnd, label }: EdgeProps) {
  const { setEdges } = useReactFlow();
  const [edgePath, labelX, labelY] = getBezierPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition });

  return (
    <>
      <BaseEdge id={id} path={edgePath} style={style} markerEnd={markerEnd} />
      <EdgeLabelRenderer>
        <div
          style={{ transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`, position: 'absolute', pointerEvents: 'all' }}
          className="nodrag nopan flex items-center gap-1 group"
        >
          {label && (
            <span className="text-[10px] text-muted-foreground bg-card border border-border rounded-md px-1.5 py-0.5 leading-none shadow-sm">
              {String(label)}
            </span>
          )}
          <button
            onClick={() => setEdges((eds) => eds.filter((e) => e.id !== id))}
            title="Remover conexão"
            className="w-4 h-4 rounded-full bg-card border border-border flex items-center justify-center text-muted-foreground hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30 transition-colors opacity-0 group-hover:opacity-100 shadow-sm"
          >
            <X className="w-2.5 h-2.5" />
          </button>
        </div>
      </EdgeLabelRenderer>
    </>
  );
}

function SchedulingNode({ id, data, selected }: NodeProps) {
  const d = data as SchedulingNodeData;
  return (
    <NodeShell selected={selected} execState={d._execState} execError={d._execError}>
      <Handle type="target" position={Position.Left} />
      <NodeHeader icon={CalendarCheck} label="AGENDAR CALL" accent="emerald" nodeId={id} customLabel={d.customLabel} />
      <div className="px-3 pb-3 space-y-1">
        <p className="text-[10px] text-muted-foreground/60 font-medium">
          {d.duracao ?? 60} min · dia {d.dia_offset ?? 0} às {d.horario ?? '09:00'}
        </p>
        {d.mensagemInicial && (
          <p className="text-xs line-clamp-2 bg-muted/30 rounded-lg px-2.5 py-2 text-foreground/80">{d.mensagemInicial}</p>
        )}
        {!d.mensagemInicial && (
          <p className="text-[10px] text-muted-foreground/40 italic">Mensagem padrão do agente</p>
        )}
      </div>
      <Handle type="source" position={Position.Right} />
    </NodeShell>
  );
}

const nodeTypes = {
  triggerNode: TriggerNode,
  messageNode: MessageNode,
  waitNode: WaitNode,
  conditionNode: ConditionNode,
  switchNode: SwitchNode,
  endNode: EndNode,
  webhookNode: WebhookNode,
  leadScoreNode: LeadScoreNode,
  abTestNode: ABTestNode,
  schedulingNode: SchedulingNode,
};

const edgeTypes = {
  deletable: DeletableEdge,
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
  { value: 'texto',       label: 'Texto',        desc: 'Mensagem de texto',          icon: MessageSquare },
  { value: 'imagem',      label: 'Imagem',       desc: 'Foto com legenda',           icon: ImageIcon },
  { value: 'video',       label: 'Vídeo',        desc: 'Vídeo com legenda',          icon: Video },
  { value: 'audio',       label: 'Áudio',        desc: 'Mensagem de voz (PTT)',      icon: Mic },
  { value: 'documento',   label: 'Documento',    desc: 'PDF, Word, planilha…',       icon: FileText },
  { value: 'localizacao', label: 'Localização',  desc: 'Ponto no mapa',             icon: MapPin },
  { value: 'lista',       label: 'Lista',        desc: 'Menu com seções e itens',    icon: List },
  { value: 'botoes',      label: 'Botões',       desc: 'Botões de resposta rápida',  icon: LayoutList },
  { value: 'carrossel',   label: 'Carrossel',    desc: 'Cards com imagem e botões',  icon: GalleryHorizontal },
  { value: 'sticker',     label: 'Sticker',      desc: 'Figurinha para WhatsApp',    icon: Smile },
] as const;

// ─── Tipo selector dropdown ─────────────────────────────────────────────────────

function TipoSelector({ value, onChange, onClear }: { value: string; onChange: (v: string) => void; onClear: () => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = TIPO_OPTIONS.find(o => o.value === value);
  const Icon = current?.icon ?? MessageSquare;

  useEffect(() => {
    function close(e: MouseEvent) {
      if (ref.current && e.target instanceof Element && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="field-input flex items-center gap-2 text-left cursor-pointer"
      >
        <Icon className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
        <span className="flex-1 text-foreground text-sm">{current?.label ?? value}</span>
        <ChevronDown className={cn('w-3.5 h-3.5 text-muted-foreground transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="absolute top-full left-0 right-0 mt-1.5 z-50 bg-card border border-border rounded-xl shadow-2xl overflow-hidden">
          {TIPO_OPTIONS.map(opt => {
            const Ic = opt.icon;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => { onChange(opt.value); onClear(); setOpen(false); }}
                className={cn(
                  'w-full flex items-center gap-2.5 px-3 py-2.5 text-left transition-colors hover:bg-muted',
                  opt.value === value && 'bg-primary/10'
                )}
              >
                <div className={cn('w-7 h-7 rounded-lg flex items-center justify-center shrink-0',
                  opt.value === value ? 'bg-primary/20' : 'bg-muted/60')}>
                  <Ic className={cn('w-3.5 h-3.5', opt.value === value ? 'text-primary' : 'text-muted-foreground')} />
                </div>
                <div className="min-w-0">
                  <p className={cn('text-sm font-medium leading-tight', opt.value === value ? 'text-primary' : 'text-foreground')}>{opt.label}</p>
                  <p className="text-[10px] text-muted-foreground leading-tight">{opt.desc}</p>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Botões builder ─────────────────────────────────────────────────────────────

function BotoesBuilder({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [buttons, setButtons] = useState<ButtonDef[]>(() => parseButtons(value));

  useEffect(() => { onChange(serializeButtons(buttons)); }, [buttons]); // eslint-disable-line react-hooks/exhaustive-deps

  function add() { setButtons(b => [...b, { label: '', type: 'reply', value: '' }]); }
  function remove(i: number) { setButtons(b => b.filter((_, idx) => idx !== i)); }
  function update(i: number, patch: Partial<ButtonDef>) {
    setButtons(b => b.map((btn, idx) => idx === i ? { ...btn, ...patch } : btn));
  }

  const TYPE_LABELS: Record<ButtonType, string> = { reply: 'Resposta', url: 'Link', call: 'Ligação' };
  const TYPE_ICONS: Record<ButtonType, React.ElementType> = { reply: MessageCircle, url: Link, call: Phone };

  return (
    <div className="flex flex-col gap-2">
      {buttons.length === 0 && (
        <p className="text-xs text-muted-foreground/60 italic text-center py-2">Nenhum botão. Clique em + para adicionar.</p>
      )}
      {buttons.map((btn, i) => {
        const TypeIcon = TYPE_ICONS[btn.type];
        return (
          <div key={i} className="bg-muted/40 border border-border rounded-xl p-3 flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={btn.label}
                onChange={e => update(i, { label: e.target.value })}
                placeholder="Rótulo do botão"
                className="field-input flex-1 text-sm"
              />
              <button type="button" onClick={() => remove(i)}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors shrink-0">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="flex gap-1.5">
              {(['reply', 'url', 'call'] as ButtonType[]).map(t => {
                const TIc = TYPE_ICONS[t];
                return (
                  <button key={t} type="button"
                    onClick={() => update(i, { type: t, value: '' })}
                    className={cn('flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-[11px] font-medium border transition-colors',
                      btn.type === t ? 'bg-primary/10 border-primary/30 text-primary' : 'border-border bg-muted/40 text-muted-foreground hover:bg-muted')}>
                    <TIc className="w-3 h-3" /> {TYPE_LABELS[t]}
                  </button>
                );
              })}
            </div>
            {btn.type !== 'reply' && (
              <input
                type="text"
                value={btn.value}
                onChange={e => update(i, { value: e.target.value })}
                placeholder={btn.type === 'url' ? 'https://exemplo.com' : '+5511999999999'}
                className="field-input text-sm font-mono"
              />
            )}
            {btn.type === 'reply' && (
              <input
                type="text"
                value={btn.value}
                onChange={e => update(i, { value: e.target.value })}
                placeholder="ID da resposta (ex: agendar)"
                className="field-input text-sm font-mono"
              />
            )}
          </div>
        );
      })}
      {buttons.length < 3 && (
        <button type="button" onClick={add}
          className="flex items-center justify-center gap-1.5 py-2 rounded-xl border border-dashed border-border text-xs text-muted-foreground hover:border-primary/40 hover:text-primary transition-colors">
          <Plus className="w-3.5 h-3.5" /> Adicionar botão
        </button>
      )}
    </div>
  );
}

// ─── Lista builder ──────────────────────────────────────────────────────────────

function ListaBuilder({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [sections, setSections] = useState<ListSection[]>(() => {
    const parsed = parseLista(value);
    return parsed.length > 0 ? parsed : [{ title: '', items: [{ label: '', id: '', desc: '' }] }];
  });

  useEffect(() => { onChange(serializeLista(sections)); }, [sections]); // eslint-disable-line react-hooks/exhaustive-deps

  function addSection() { setSections(s => [...s, { title: '', items: [] }]); }
  function removeSection(si: number) { setSections(s => s.filter((_, i) => i !== si)); }
  function updateSection(si: number, title: string) { setSections(s => s.map((sec, i) => i === si ? { ...sec, title } : sec)); }
  function addItem(si: number) { setSections(s => s.map((sec, i) => i === si ? { ...sec, items: [...sec.items, { label: '', id: '', desc: '' }] } : sec)); }
  function removeItem(si: number, ii: number) { setSections(s => s.map((sec, i) => i === si ? { ...sec, items: sec.items.filter((_, j) => j !== ii) } : sec)); }
  function updateItem(si: number, ii: number, patch: Partial<ListItem>) {
    setSections(s => s.map((sec, i) => i === si ? { ...sec, items: sec.items.map((it, j) => j === ii ? { ...it, ...patch } : it) } : sec));
  }

  return (
    <div className="flex flex-col gap-3">
      {sections.map((sec, si) => (
        <div key={si} className="border border-border rounded-xl overflow-hidden">
          <div className="flex items-center gap-2 px-3 py-2 bg-muted/40 border-b border-border">
            <input type="text" value={sec.title} onChange={e => updateSection(si, e.target.value)}
              placeholder="Nome da seção (opcional)"
              className="flex-1 bg-transparent text-xs font-semibold text-foreground outline-none placeholder:text-muted-foreground/50" />
            {sections.length > 1 && (
              <button type="button" onClick={() => removeSection(si)}
                className="w-5 h-5 flex items-center justify-center text-muted-foreground hover:text-destructive transition-colors">
                <Trash2 className="w-3 h-3" />
              </button>
            )}
          </div>
          <div className="p-2 flex flex-col gap-1.5">
            {sec.items.map((item, ii) => (
              <div key={ii} className="flex items-start gap-1.5">
                <div className="flex-1 flex flex-col gap-1">
                  <input type="text" value={item.label} onChange={e => updateItem(si, ii, { label: e.target.value })}
                    placeholder="Nome do item" className="field-input text-xs py-1.5" />
                  <div className="flex gap-1">
                    <input type="text" value={item.id} onChange={e => updateItem(si, ii, { id: e.target.value })}
                      placeholder="ID" className="field-input text-xs py-1.5 flex-1 font-mono" />
                    <input type="text" value={item.desc} onChange={e => updateItem(si, ii, { desc: e.target.value })}
                      placeholder="Descrição" className="field-input text-xs py-1.5 flex-1" />
                  </div>
                </div>
                <button type="button" onClick={() => removeItem(si, ii)}
                  className="w-6 h-6 mt-1 flex items-center justify-center text-muted-foreground hover:text-destructive transition-colors shrink-0">
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
            <button type="button" onClick={() => addItem(si)}
              className="flex items-center gap-1 py-1 text-[11px] text-muted-foreground hover:text-primary transition-colors">
              <Plus className="w-3 h-3" /> Adicionar item
            </button>
          </div>
        </div>
      ))}
      <button type="button" onClick={addSection}
        className="flex items-center justify-center gap-1.5 py-2 rounded-xl border border-dashed border-border text-xs text-muted-foreground hover:border-primary/40 hover:text-primary transition-colors">
        <Plus className="w-3.5 h-3.5" /> Adicionar seção
      </button>
    </div>
  );
}

// ─── Carrossel builder ──────────────────────────────────────────────────────────

function CarrosselBuilder({ value, onChange, sequenceId }: { value: string; onChange: (v: string) => void; sequenceId?: string }) {
  const [cards, setCards] = useState<CarouselCard[]>(() => {
    const parsed = parseCarousel(value);
    return parsed.length > 0 ? parsed : [{ text: '', image: '', buttons: [] }];
  });

  useEffect(() => { onChange(serializeCarousel(cards)); }, [cards]); // eslint-disable-line react-hooks/exhaustive-deps

  function addCard() { setCards(c => [...c, { text: '', image: '', buttons: [] }]); }
  function removeCard(i: number) { setCards(c => c.filter((_, idx) => idx !== i)); }
  function updateCard(i: number, patch: Partial<CarouselCard>) { setCards(c => c.map((card, idx) => idx === i ? { ...card, ...patch } : card)); }

  return (
    <div className="flex flex-col gap-3">
      {cards.map((card, i) => (
        <div key={i} className="border border-border rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 bg-muted/40 border-b border-border">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Card {i + 1}</span>
            {cards.length > 1 && (
              <button type="button" onClick={() => removeCard(i)}
                className="text-muted-foreground hover:text-destructive transition-colors">
                <Trash2 className="w-3 h-3" />
              </button>
            )}
          </div>
          <div className="p-3 flex flex-col gap-2.5">
            <UploadZone accept="image/*" label="Imagem do card" current={card.image || undefined}
              onUpload={url => updateCard(i, { image: url })} />
            {card.image && (
              <img src={card.image} alt="" className="w-full h-24 object-cover rounded-lg border border-border" />
            )}
            <textarea rows={2} value={card.text} onChange={e => updateCard(i, { text: e.target.value })}
              placeholder="Texto do card…" className="field-input resize-none text-sm" />
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 mb-1.5">Botões do card</p>
              <BotoesBuilder value={serializeButtons(card.buttons)} onChange={v => updateCard(i, { buttons: parseButtons(v) })} />
            </div>
          </div>
        </div>
      ))}
      <button type="button" onClick={addCard}
        className="flex items-center justify-center gap-1.5 py-2 rounded-xl border border-dashed border-border text-xs text-muted-foreground hover:border-primary/40 hover:text-primary transition-colors">
        <Plus className="w-3.5 h-3.5" /> Adicionar card
      </button>
    </div>
  );
}

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));

// ─── ConditionConfig / SwitchConfig ─────────────────────────────────────────

interface ConditionConfigProps {
  d: ConditionNodeData;
  nodeId: string;
  allNodes: Node<AutoNodeData>[];
  allEdges: Edge[];
  onUpdate: (id: string, patch: Partial<AutoNodeData>) => void;
}

function ConditionConfig({ d, nodeId, allNodes, allEdges, onUpdate }: ConditionConfigProps) {
  const upstreamChoices = useMemo(() => {
    const incomingIds = allEdges.filter(e => e.target === nodeId).map(e => e.source);
    const choices: string[] = [];
    for (const id of incomingIds) {
      const n = allNodes.find(n => n.id === id);
      if (n?.data.kind === 'message') {
        const mc = (n.data as MessageNodeData).menu_choices ?? '';
        mc.split('\n').filter(Boolean).forEach(line => {
          const label = line.split('|')[0].trim();
          if (label) choices.push(label);
        });
      }
    }
    return choices;
  }, [allNodes, allEdges, nodeId]);

  const variavel = d.variavel ?? 'resposta_botao';
  const operador = d.operador ?? 'eq';
  const valor = d.valor ?? '';
  const inUpstream = upstreamChoices.includes(valor);

  return (
    <>
      <div className="flex flex-col gap-1.5">
        <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">Variável</label>
        <select value={variavel} onChange={(e) => onUpdate(nodeId, { variavel: e.target.value })} className="field-input">
          <option value="resposta_botao">Resposta do botão</option>
          <option value="ultima_resposta">Última resposta</option>
          <option value="custom">Personalizada</option>
        </select>
      </div>
      {variavel === 'custom' && (
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">Nome da variável</label>
          <input type="text" value={d.condicao ?? ''} onChange={(e) => onUpdate(nodeId, { condicao: e.target.value })}
            placeholder="ex: lead.stage" className="field-input" />
        </div>
      )}
      <div className="flex flex-col gap-1.5">
        <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">Operador</label>
        <select value={operador} onChange={(e) => onUpdate(nodeId, { operador: e.target.value as ConditionNodeData['operador'] })} className="field-input">
          <option value="eq">igual a (=)</option>
          <option value="contains">contém</option>
          <option value="starts_with">começa com</option>
          <option value="not_empty">não está vazio</option>
        </select>
      </div>
      {operador !== 'not_empty' && (
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">Valor</label>
          {upstreamChoices.length > 0 ? (
            <>
              <select value={inUpstream ? valor : '__custom'}
                onChange={(e) => onUpdate(nodeId, { valor: e.target.value === '__custom' ? '' : e.target.value })}
                className="field-input">
                {upstreamChoices.map(c => <option key={c} value={c}>{c}</option>)}
                <option value="__custom">Personalizado…</option>
              </select>
              {!inUpstream && (
                <input type="text" value={valor} onChange={(e) => onUpdate(nodeId, { valor: e.target.value })}
                  placeholder="Valor personalizado" className="field-input" />
              )}
            </>
          ) : (
            <input type="text" value={valor} onChange={(e) => onUpdate(nodeId, { valor: e.target.value })}
              placeholder="Valor esperado" className="field-input" />
          )}
        </div>
      )}
      <p className="text-[10px] text-muted-foreground/60 leading-snug">
        Saída <strong>Sim</strong> se a condição for verdadeira, <strong>Não</strong> caso contrário.
      </p>
    </>
  );
}

interface SwitchConfigProps {
  d: SwitchNodeData;
  nodeId: string;
  allNodes: Node<AutoNodeData>[];
  allEdges: Edge[];
  onUpdate: (id: string, patch: Partial<AutoNodeData>) => void;
}

function SwitchConfig({ d, nodeId, allNodes, allEdges, onUpdate }: SwitchConfigProps) {
  const upstreamChoices = useMemo(() => {
    const incomingIds = allEdges.filter(e => e.target === nodeId).map(e => e.source);
    const choices: string[] = [];
    for (const id of incomingIds) {
      const n = allNodes.find(n => n.id === id);
      if (n?.data.kind === 'message') {
        const mc = (n.data as MessageNodeData).menu_choices ?? '';
        mc.split('\n').filter(Boolean).forEach(line => {
          const label = line.split('|')[0].trim();
          if (label) choices.push(label);
        });
      }
    }
    return choices;
  }, [allNodes, allEdges, nodeId]);

  const cases = d.cases ?? [];
  const CASE_COLORS = ['text-emerald-500', 'text-sky-500', 'text-violet-500', 'text-amber-500', 'text-rose-500'];

  function updateCase(i: number, patch: Partial<SwitchCase>) {
    onUpdate(nodeId, { cases: cases.map((c, idx) => idx === i ? { ...c, ...patch } : c) });
  }

  return (
    <>
      <div className="flex flex-col gap-1.5">
        <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">Variável</label>
        <select value={d.variavel ?? 'resposta_botao'} onChange={(e) => onUpdate(nodeId, { variavel: e.target.value })} className="field-input">
          <option value="resposta_botao">Resposta do botão</option>
          <option value="ultima_resposta">Última resposta</option>
        </select>
      </div>
      <div className="flex flex-col gap-2">
        <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">Casos</label>
        {cases.map((c, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <span className={`text-[10px] font-bold w-4 shrink-0 ${CASE_COLORS[i % CASE_COLORS.length]}`}>{i + 1}</span>
            {upstreamChoices.length > 0 ? (
              <select value={upstreamChoices.includes(c.value) ? c.value : '__custom'}
                onChange={(e) => updateCase(i, { value: e.target.value === '__custom' ? '' : e.target.value })}
                className="field-input flex-1 text-xs">
                {upstreamChoices.map(ch => <option key={ch} value={ch}>{ch}</option>)}
                <option value="__custom">Personalizado…</option>
              </select>
            ) : (
              <input type="text" value={c.value} onChange={(e) => updateCase(i, { value: e.target.value })}
                placeholder="valor" className="field-input flex-1 text-xs" />
            )}
            <input type="text" value={c.label} onChange={(e) => updateCase(i, { label: e.target.value })}
              placeholder="rótulo" className="field-input flex-1 text-xs" />
            <button type="button" onClick={() => onUpdate(nodeId, { cases: cases.filter((_, idx) => idx !== i) })}
              className="text-muted-foreground hover:text-destructive transition-colors shrink-0">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
        {cases.length < 5 && (
          <button type="button"
            onClick={() => onUpdate(nodeId, { cases: [...cases, { value: '', label: `Caso ${cases.length + 1}` }] })}
            className="flex items-center justify-center gap-1.5 py-1.5 rounded-lg border border-dashed border-border text-xs text-muted-foreground hover:border-primary/40 hover:text-primary transition-colors">
            <Plus className="w-3 h-3" /> Adicionar caso
          </button>
        )}
      </div>
      <p className="text-[10px] text-muted-foreground/60 leading-snug">
        Caso nenhum valor corresponda, o fluxo segue pela saída <strong>else</strong>.
      </p>
    </>
  );
}

const REMARKETING_STATUS_OPTIONS = [
  'Lead novo', 'Triagem', 'Proposta enviada', 'Aguardando retorno',
  'Sem resposta', 'Remarketing', 'Perdido', 'Cliente',
];

// ─── Variáveis disponíveis para inserção ─────────────────────────────────────────

const TEMPLATE_VARS = [
  { label: 'nome',     value: '{nome}'     },
  { label: 'empresa',  value: '{empresa}'  },
  { label: 'telefone', value: '{telefone}' },
  { label: 'email',    value: '{email}'    },
  { label: 'produto',  value: '{produto}'  },
];

function insertVariable(
  textarea: HTMLTextAreaElement,
  variable: string,
  currentValue: string,
  onChange: (v: string) => void,
) {
  const start = textarea.selectionStart ?? currentValue.length;
  const end = textarea.selectionEnd ?? start;
  const next = currentValue.slice(0, start) + variable + currentValue.slice(end);
  onChange(next);
  requestAnimationFrame(() => {
    textarea.focus();
    textarea.setSelectionRange(start + variable.length, start + variable.length);
  });
}

// ─── Blocos Editor ───────────────────────────────────────────────────────────────

function BlocosEditor({ blocos, mensagem, onChange }: {
  blocos?: string[];
  mensagem?: string | null;
  onChange: (blocos: string[]) => void;
}) {
  const current = blocos && blocos.length > 0 ? blocos : (mensagem ? [mensagem] : ['']);
  const [focusedIdx, setFocusedIdx] = useState(0);
  const textareaRefs = useRef<(HTMLTextAreaElement | null)[]>([]);

  const update = (idx: number, val: string) => {
    const next = [...current];
    next[idx] = val;
    onChange(next);
  };

  const add = () => { onChange([...current, '']); setFocusedIdx(current.length); };

  const remove = (idx: number) => {
    if (current.length <= 1) { onChange(['']); return; }
    const next = current.filter((_, i) => i !== idx);
    onChange(next);
    setFocusedIdx(Math.min(focusedIdx, next.length - 1));
  };

  const handleInsertVar = (v: string) => {
    const textarea = textareaRefs.current[focusedIdx];
    if (!textarea) {
      const next = [...current];
      next[focusedIdx] = (next[focusedIdx] || '') + v;
      onChange(next);
      return;
    }
    insertVariable(textarea, v, current[focusedIdx] ?? '', (val) => update(focusedIdx, val));
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">
          Blocos de mensagem
        </label>
        <span className="text-[10px] text-muted-foreground/40">{current.length} bloco{current.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Chips de variáveis */}
      <div className="flex flex-col gap-1.5">
        <span className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground/40">Inserir variável</span>
        <div className="flex flex-wrap gap-1">
          {TEMPLATE_VARS.map((v) => (
            <button
              key={v.value}
              type="button"
              onClick={() => handleInsertVar(v.value)}
              className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-colors"
            >
              {v.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        {current.map((bloco, idx) => (
          <div key={idx}>
            <div className="flex items-start gap-1.5">
              <div className="pt-2 shrink-0">
                <span className="w-5 h-5 rounded-md bg-muted/60 flex items-center justify-center text-[9px] font-bold text-muted-foreground/50">{idx + 1}</span>
              </div>
              <textarea
                ref={(el) => { textareaRefs.current[idx] = el; }}
                rows={3}
                value={bloco}
                onChange={(e) => update(idx, e.target.value)}
                onFocus={() => setFocusedIdx(idx)}
                placeholder={`Mensagem ${idx + 1}…`}
                className="field-input resize-none flex-1 text-xs"
              />
              <button
                onClick={() => remove(idx)}
                className="pt-1.5 text-muted-foreground/30 hover:text-destructive transition-colors shrink-0"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
            {idx < current.length - 1 && (
              <div className="flex items-center gap-1 pl-6 mt-1 mb-0.5">
                <div className="w-px h-3 bg-border/40 ml-2" />
                <span className="text-[9px] text-muted-foreground/30 font-mono">envia e aguarda 1s</span>
              </div>
            )}
          </div>
        ))}
      </div>

      <button
        onClick={add}
        className="flex items-center gap-1.5 text-[11px] text-primary font-medium hover:underline underline-offset-2"
      >
        <Plus className="w-3 h-3" />
        Adicionar bloco
      </button>
    </div>
  );
}

interface ConfigPanelProps {
  node: Node<AutoNodeData> | null;
  onClose: () => void;
  onUpdate: (id: string, patch: Partial<AutoNodeData>) => void;
  onDelete: (id: string) => void;
  nodes?: Node<AutoNodeData>[];
  edges?: Edge[];
  sequenceTipo?: SequenceTipo;
  remarketingCfg?: RemarketingConfig;
  onRemarketingChange?: (cfg: RemarketingConfig) => void;
}

function ConfigPanel({ node, onClose, onUpdate, onDelete, nodes: allNodes = [], edges: allEdges = [], sequenceTipo, remarketingCfg, onRemarketingChange }: ConfigPanelProps) {
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

        {/* ── Nome do node (todos os tipos, exceto trigger) ── */}
        {d.kind !== 'trigger' && (
          <Field label="Nome do node">
            <input
              type="text"
              value={(d.customLabel as string) ?? ''}
              onChange={(e) => onUpdate(node.id, { customLabel: e.target.value || undefined })}
              placeholder={`Ex: ${d.kind === 'message' ? 'Sequência 1' : d.kind === 'wait' ? 'Aguardar 2 dias' : 'Meu nó'}`}
              className="field-input"
            />
          </Field>
        )}

        {/* ── Message node ── */}
        {d.kind === 'message' && (
          <>
            {/* Offset — anti_noshow: sempre horas (relativo à call). Outros: toggle Dias/Horas */}
            {sequenceTipo === 'anti_noshow' ? (
              <Field label="Horas (relativo à call)">
                <input
                  type="number"
                  step={0.25}
                  value={d.dia_offset}
                  onChange={(e) => onUpdate(node.id, { dia_offset: Number(e.target.value), offset_unit: 'hours' })}
                  className="field-input"
                  placeholder="-24 = 24h antes"
                />
                <p className="text-[10px] text-muted-foreground/60 mt-1 leading-snug">
                  Negativo = antes da call. Ex: -24 = 24h antes · -2 = 2h · 0.083 ≈ 5min depois
                </p>
              </Field>
            ) : (
              <>
                <Field label="Quando disparar">
                  <div className="flex rounded-xl border border-border overflow-hidden">
                    <button
                      type="button"
                      onClick={() => onUpdate(node.id, { offset_unit: 'days' })}
                      className={cn('flex-1 py-1.5 text-xs font-medium transition-colors',
                        (d.offset_unit ?? 'days') === 'days'
                          ? 'bg-primary text-primary-foreground'
                          : 'text-muted-foreground hover:text-foreground')}
                    >
                      Dias
                    </button>
                    <button
                      type="button"
                      onClick={() => onUpdate(node.id, { offset_unit: 'hours' })}
                      className={cn('flex-1 py-1.5 text-xs font-medium transition-colors',
                        d.offset_unit === 'hours'
                          ? 'bg-primary text-primary-foreground'
                          : 'text-muted-foreground hover:text-foreground')}
                    >
                      Horas
                    </button>
                  </div>
                </Field>

                {(d.offset_unit ?? 'days') === 'days' ? (
                  <>
                    <Field label="Dia">
                      <input type="number" min={0} value={d.dia_offset}
                        onChange={(e) => onUpdate(node.id, { dia_offset: Number(e.target.value) })}
                        className="field-input" />
                    </Field>
                    <Field label="Horário">
                      <div className="flex items-center gap-2">
                        <select
                          value={hh}
                          onChange={(e) => onUpdate(node.id, { horario: `${e.target.value}:${mm.padStart(2, '0')}` })}
                          className="field-input flex-1 text-center font-mono"
                        >
                          {HOURS.map((h) => <option key={h} value={h}>{h}</option>)}
                        </select>
                        <span className="text-muted-foreground font-bold text-lg">:</span>
                        <input
                          type="number"
                          min={0}
                          max={59}
                          value={Number(mm)}
                          onChange={(e) => {
                            const val = Math.max(0, Math.min(59, Number(e.target.value)));
                            onUpdate(node.id, { horario: `${hh}:${String(val).padStart(2, '0')}` });
                          }}
                          className="field-input flex-1 text-center font-mono"
                        />
                      </div>
                    </Field>
                  </>
                ) : (
                  <Field label="Horas após o início">
                    <input
                      type="number"
                      min={0}
                      step={0.5}
                      value={d.dia_offset}
                      onChange={(e) => onUpdate(node.id, { dia_offset: Number(e.target.value) })}
                      className="field-input"
                      placeholder="Ex: 2 = 2h · 0.5 = 30min"
                    />
                    <p className="text-[10px] text-muted-foreground/60 mt-1 leading-snug">
                      Ex: 1 = 1 hora · 0.5 = 30 min · 48 = 2 dias
                    </p>
                  </Field>
                )}
              </>
            )}

            <Field label="Controle da IA">
              <select
                value={d.sdr_ativo === null || d.sdr_ativo === undefined ? 'null' : String(d.sdr_ativo)}
                onChange={(e) => {
                  const v = e.target.value;
                  onUpdate(node.id, { sdr_ativo: v === 'null' ? null : v === 'true' });
                }}
                className="field-input"
              >
                <option value="null">Sem mudança</option>
                <option value="false">Pausar IA após este node</option>
                <option value="true">Ativar IA após este node</option>
              </select>
              <p className="text-[10px] text-muted-foreground/60 leading-snug mt-1">
                {(d.sdr_ativo === false) && 'Se o lead responder, o SDR não assume — a IA fica pausada.'}
                {(d.sdr_ativo === true) && 'O SDR volta a responder automaticamente após este step.'}
              </p>
            </Field>

            <Field label="Tipo de mensagem">
              <TipoSelector
                value={d.tipo_mensagem}
                onChange={(v) => onUpdate(node.id, { tipo_mensagem: v })}
                onClear={() => onUpdate(node.id, { media_url: undefined, media_name: undefined, mensagem: null, menu_choices: undefined, carousel_json: undefined, location_url: undefined, location_name: undefined, location_address: undefined, uploading: false })}
              />
            </Field>

            {d.tipo_mensagem === 'texto' && (
              <BlocosEditor
                blocos={d.blocos as string[] | undefined}
                mensagem={d.mensagem as string | null | undefined}
                onChange={(blocos) => onUpdate(node.id, {
                  blocos: blocos.length > 0 ? blocos : undefined,
                  mensagem: blocos.length > 0 ? blocos[0] : (d.mensagem ?? null),
                })}
              />
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

            {d.tipo_mensagem === 'localizacao' && (
              <>
                <Field label="URL do Google Maps">
                  <input type="url" value={d.location_url ?? ''}
                    onChange={(e) => onUpdate(node.id, { location_url: e.target.value })}
                    placeholder="https://maps.app.goo.gl/..." className="field-input" />
                  {d.location_url && !parseGoogleMapsUrl(String(d.location_url)) && (
                    <p className="text-[10px] text-amber-500 mt-1">URL sem coordenadas detectáveis. Use um link completo como maps.google.com/@lat,lng</p>
                  )}
                  {d.location_url && parseGoogleMapsUrl(String(d.location_url)) && (
                    <p className="text-[10px] text-emerald-500 mt-1">
                      ✓ Coordenadas detectadas: {parseGoogleMapsUrl(String(d.location_url))!.lat.toFixed(4)}, {parseGoogleMapsUrl(String(d.location_url))!.lng.toFixed(4)}
                    </p>
                  )}
                </Field>
                <Field label="Nome do local">
                  <input type="text" value={d.location_name ?? ''}
                    onChange={(e) => onUpdate(node.id, { location_name: e.target.value })}
                    placeholder="Ex: MASP" className="field-input" />
                </Field>
                <Field label="Endereço (opcional)">
                  <input type="text" value={d.location_address ?? ''}
                    onChange={(e) => onUpdate(node.id, { location_address: e.target.value })}
                    placeholder="Av. Paulista, 1578" className="field-input" />
                </Field>
              </>
            )}

            {d.tipo_mensagem === 'lista' && (
              <>
                <Field label="Texto principal">
                  <textarea rows={2} value={d.mensagem ?? ''}
                    onChange={(e) => onUpdate(node.id, { mensagem: e.target.value })}
                    placeholder="Escolha uma opção:" className="field-input resize-none" />
                </Field>
                <Field label="Itens da lista">
                  <ListaBuilder value={d.menu_choices ?? ''} onChange={(v) => onUpdate(node.id, { menu_choices: v })} />
                </Field>
              </>
            )}

            {d.tipo_mensagem === 'botoes' && (
              <>
                <Field label="Texto principal">
                  <textarea rows={2} value={d.mensagem ?? ''}
                    onChange={(e) => onUpdate(node.id, { mensagem: e.target.value })}
                    placeholder="Como posso ajudar?" className="field-input resize-none" />
                </Field>
                <Field label="Botões">
                  <BotoesBuilder value={d.menu_choices ?? ''} onChange={(v) => onUpdate(node.id, { menu_choices: v })} />
                </Field>
              </>
            )}

            {d.tipo_mensagem === 'carrossel' && (
              <>
                <Field label="Texto principal">
                  <textarea rows={2} value={d.mensagem ?? ''}
                    onChange={(e) => onUpdate(node.id, { mensagem: e.target.value })}
                    placeholder="Veja nossos produtos:" className="field-input resize-none" />
                </Field>
                <Field label="Cards">
                  <CarrosselBuilder value={d.carousel_json ?? ''} onChange={(v) => onUpdate(node.id, { carousel_json: v })} />
                </Field>
              </>
            )}

            {d.tipo_mensagem === 'sticker' && (
              <Field label="Arquivo do sticker">
                <UploadZone accept="image/*,image/webp" label="Enviar sticker" current={d.media_url as string | undefined}
                  onUploadStart={() => onUpdate(node.id, { uploading: true })}
                  onUpload={(url) => onUpdate(node.id, { media_url: url, uploading: false })} />
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
          <ConditionConfig
            d={d as ConditionNodeData}
            nodeId={node.id}
            allNodes={allNodes}
            allEdges={allEdges}
            onUpdate={onUpdate}
          />
        )}

        {/* ── Switch node ── */}
        {d.kind === 'switch' && (
          <SwitchConfig
            d={d as SwitchNodeData}
            nodeId={node.id}
            allNodes={allNodes}
            allEdges={allEdges}
            onUpdate={onUpdate}
          />
        )}

        {/* ── Scheduling node ── */}
        {d.kind === 'scheduling' && (
          <>
            <Field label="Dia do fluxo">
              <input type="number" min={0} value={(d as SchedulingNodeData).dia_offset ?? 0}
                onChange={(e) => onUpdate(node.id, { dia_offset: Number(e.target.value) })}
                className="field-input" />
            </Field>
            <Field label="Horário">
              <input type="time" value={(d as SchedulingNodeData).horario ?? '09:00'}
                onChange={(e) => onUpdate(node.id, { horario: e.target.value })}
                className="field-input" />
            </Field>
            <Field label="Duração da call">
              <select value={(d as SchedulingNodeData).duracao ?? 60}
                onChange={(e) => onUpdate(node.id, { duracao: Number(e.target.value) })}
                className="field-input">
                <option value={30}>30 minutos</option>
                <option value={60}>60 minutos</option>
                <option value={90}>90 minutos</option>
              </select>
            </Field>
            <Field label="Mensagem inicial (opcional)">
              <textarea value={(d as SchedulingNodeData).mensagemInicial ?? ''}
                onChange={(e) => onUpdate(node.id, { mensagemInicial: e.target.value })}
                placeholder={`Oi {nome}! Que tal agendarmos uma call? Que dia e horário funciona pra você? 😊`}
                className="field-input min-h-[80px] resize-none" />
            </Field>
            <p className="text-[10px] text-muted-foreground/60 leading-snug">
              O agente de agendamento assume a conversa e agenda via Google Calendar. O fluxo encerra aqui.
            </p>
          </>
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

            {/* Remarketing-specific entry criteria */}
            {sequenceTipo === 'remarketing' && remarketingCfg && onRemarketingChange && (
              <>
                <div className="h-px bg-border/60 -mx-4" />
                <div className="space-y-3">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Critérios de entrada</p>

                  <Field label="Status do lead">
                    <div className="flex flex-wrap gap-1.5 pt-0.5">
                      {REMARKETING_STATUS_OPTIONS.map((s) => {
                        const active = remarketingCfg.statusFiltros.includes(s);
                        return (
                          <button
                            key={s}
                            type="button"
                            onClick={() => {
                              const next = active
                                ? remarketingCfg.statusFiltros.filter((x) => x !== s)
                                : [...remarketingCfg.statusFiltros, s];
                              if (next.length > 0) onRemarketingChange({ ...remarketingCfg, statusFiltros: next });
                            }}
                            className={`px-2 py-0.5 rounded-full text-[10px] font-medium border transition-colors ${
                              active
                                ? 'bg-primary/15 border-primary/40 text-primary'
                                : 'bg-muted/50 border-border text-muted-foreground hover:border-primary/30'
                            }`}
                          >
                            {s}
                          </button>
                        );
                      })}
                    </div>
                  </Field>

                  <Field label="Mín. dias inativo">
                    <input
                      type="number"
                      min={0}
                      value={remarketingCfg.diasInativo}
                      onChange={(e) => onRemarketingChange({ ...remarketingCfg, diasInativo: Math.max(0, Number(e.target.value)) })}
                      className="field-input"
                    />
                  </Field>
                </div>
              </>
            )}
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

type PaletteKind = 'message' | 'wait' | 'condition' | 'switch' | 'end' | 'webhook' | 'lead_score' | 'ab_test' | 'scheduling';

interface PaletteItem {
  label: string; desc: string; kind: PaletteKind;
  icon: React.ElementType; bgClass: string; iconClass: string;
}

const PALETTE_ITEMS: PaletteItem[] = [
  { label: 'Mensagem', desc: 'Enviar texto, áudio ou mídia', kind: 'message', icon: MessageSquare, bgClass: 'bg-emerald-500/10', iconClass: 'text-emerald-500' },
  { label: 'Aguardar', desc: 'Pausa entre mensagens', kind: 'wait', icon: Clock, bgClass: 'bg-amber-500/10', iconClass: 'text-amber-500' },
  { label: 'Condição', desc: 'Se/senão por variável', kind: 'condition', icon: GitBranch, bgClass: 'bg-violet-500/10', iconClass: 'text-violet-500' },
  { label: 'Switch', desc: 'N saídas por valor (botões)', kind: 'switch', icon: GitMerge, bgClass: 'bg-sky-500/10', iconClass: 'text-sky-500' },
  { label: 'Encerrar', desc: 'Finalizar a sequência', kind: 'end', icon: XCircle, bgClass: 'bg-destructive/10', iconClass: 'text-destructive' },
  { label: 'Webhook', desc: 'Chamar URL externa', kind: 'webhook', icon: Globe, bgClass: 'bg-sky-500/10', iconClass: 'text-sky-500' },
  { label: 'Lead Score', desc: 'Filtrar por pontuação do lead', kind: 'lead_score', icon: Star, bgClass: 'bg-amber-500/10', iconClass: 'text-amber-500' },
  { label: 'Teste A/B', desc: 'Dividir tráfego entre variantes', kind: 'ab_test', icon: GitMerge, bgClass: 'bg-violet-500/10', iconClass: 'text-violet-500' },
  { label: 'Agendar Call', desc: 'Agente ativa agendamento via Google Calendar', kind: 'scheduling', icon: CalendarCheck, bgClass: 'bg-emerald-500/10', iconClass: 'text-emerald-500' },
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

interface ExecLogReal {
  id: string;
  lead: string;
  telefone: string | null;
  step: string;
  status: 'sent' | 'failed' | 'skipped';
  ts: string | null;
}

function ExecutionsView({ sequenceId, tipo }: { sequenceId: string | null; tipo: SequenceTipo }) {
  const label: Record<SequenceTipo, string> = { follow_geral: 'Follow-up', anti_noshow: 'Anti-Noshow', remarketing: 'Remarketing', trial_saas: 'Trial SaaS' };
  const [executions, setExecutions] = useState<ExecLogReal[]>([]);
  const [loadingExec, setLoadingExec] = useState(false);
  const [execError, setExecError] = useState<string | null>(null);

  useEffect(() => {
    if (!sequenceId) { setExecutions([]); return; }
    setLoadingExec(true);
    setExecError(null);
    fetch(`/api/follow/sequences/${sequenceId}/logs`)
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json() as { logs: ExecLogReal[] };
        setExecutions(json.logs ?? []);
      })
      .catch((err) => { setExecError(err instanceof Error ? err.message : 'Erro ao carregar'); })
      .finally(() => setLoadingExec(false));
  }, [sequenceId]);

  function formatTs(ts: string | null): string {
    if (!ts) return '—';
    try {
      const d = new Date(ts);
      const now = new Date();
      const isToday = d.toDateString() === now.toDateString();
      const time = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      return isToday ? `hoje, ${time}` : d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) + ' ' + time;
    } catch { return ts; }
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-2xl mx-auto p-6 space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-foreground">Execuções recentes</p>
          <span className="text-xs text-muted-foreground">{label[tipo]}</span>
        </div>

        {loadingExec ? (
          <div className="flex items-center justify-center py-20 gap-3">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Carregando execuções…</span>
          </div>
        ) : execError ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <AlertCircle className="w-8 h-8 text-destructive/50" />
            <p className="text-sm text-destructive">{execError}</p>
          </div>
        ) : !sequenceId ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <Clock3 className="w-10 h-10 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">Selecione uma sequência para ver execuções</p>
          </div>
        ) : executions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <Clock3 className="w-10 h-10 text-muted-foreground/30" />
            <div className="text-center">
              <p className="text-sm font-medium text-muted-foreground">Nenhuma execução registrada</p>
              <p className="text-xs text-muted-foreground/70">As execuções aparecerão aqui após os primeiros disparos</p>
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
                  {exec.telefone && (
                    <p className="text-[10px] text-muted-foreground/60 truncate font-mono">{exec.telefone}</p>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full border uppercase tracking-wide',
                    exec.status === 'sent' ? 'bg-primary/10 text-primary border-primary/20'
                      : exec.status === 'failed' ? 'bg-destructive/10 text-destructive border-destructive/20'
                      : 'bg-muted text-muted-foreground border-border')}>
                    {exec.status === 'sent' ? 'Enviado' : exec.status === 'failed' ? 'Falhou' : 'Pulado'}
                  </span>
                  <p className="text-[10px] text-muted-foreground mt-1">{formatTs(exec.ts)}</p>
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

// ─── Noshow Cron Test Modal ──────────────────────────────────────────────────────

function NoshowCronTestModal({ onClose }: { onClose: () => void }) {
  const [phone, setPhone] = useState(() => {
    try { return localStorage.getItem(PHONE_LS_KEY) ?? ''; } catch { return ''; }
  });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; disparados?: number; pulados?: number; error?: string } | null>(null);

  function handlePhoneChange(raw: string) {
    const digits = raw.replace(/\D/g, '').slice(0, 13);
    setPhone(digits);
    try { localStorage.setItem(PHONE_LS_KEY, digits); } catch {}
  }

  function formatDisplay(digits: string) {
    const d = digits.startsWith('55') ? digits.slice(2) : digits;
    if (d.length <= 2) return d;
    if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
    if (d.length <= 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
    return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7, 11)}`;
  }

  async function handleDispatch() {
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch('/api/cron/antnoshow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${(window as any).__CRON_SECRET__ ?? ''}` },
        body: JSON.stringify({ phone: phone || undefined }),
      });
      const json = await res.json();
      setResult(json);
    } catch (e: any) {
      setResult({ ok: false, error: e.message });
    } finally {
      setLoading(false);
    }
  }

  const canSend = phone.replace(/\D/g, '').length >= 10 || phone === '';

  return (
    <ModalOverlay onClose={onClose}>
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-80 p-5 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-foreground">Disparar Anti-Noshow agora</p>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
        </div>
        <p className="text-xs text-muted-foreground -mt-2 leading-relaxed">
          Aciona o motor de anti-noshow ignorando a janela de tempo. Útil para testes — filtre por número ou deixe vazio para todos os leads com call agendada.
        </p>
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">Filtrar por número (opcional)</label>
          <div className="flex items-center gap-0 rounded-xl border border-border overflow-hidden bg-muted focus-within:ring-2 focus-within:ring-primary/40">
            <div className="flex items-center gap-1.5 px-3 py-2.5 border-r border-border bg-muted/60 shrink-0">
              <span className="text-base leading-none">🇧🇷</span>
              <span className="text-xs font-medium text-muted-foreground">+55</span>
            </div>
            <input
              type="tel"
              inputMode="numeric"
              value={formatDisplay(phone.startsWith('55') ? phone.slice(2) : phone)}
              onChange={(e) => handlePhoneChange('55' + e.target.value.replace(/\D/g, ''))}
              placeholder="(11) 99999-9999 — opcional"
              className="flex-1 bg-transparent px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 outline-none"
            />
          </div>
        </div>
        {result && (
          <div className={cn('px-3 py-2.5 rounded-xl text-xs leading-relaxed border',
            result.ok
              ? 'bg-primary/10 border-primary/20 text-primary'
              : 'bg-destructive/10 border-destructive/20 text-destructive')}>
            {result.ok
              ? `✓ Concluído — ${result.disparados ?? 0} disparados · ${result.pulados ?? 0} pulados`
              : `✗ Erro: ${result.error}`}
          </div>
        )}
        <button
          onClick={handleDispatch}
          disabled={loading}
          className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2">
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
          {loading ? 'Disparando…' : 'Disparar agora'}
        </button>
      </div>
    </ModalOverlay>
  );
}

interface TestRunModalProps {
  onStart: (phone: string) => void;
  onClose: () => void;
}

const PHONE_LS_KEY = 'nexio_canvas_test_phone';

function TestRunModal({ onStart, onClose }: TestRunModalProps) {
  const [phone, setPhone] = useState(() => {
    try { return localStorage.getItem(PHONE_LS_KEY) ?? ''; } catch { return ''; }
  });

  function handlePhoneChange(raw: string) {
    const digits = raw.replace(/\D/g, '').slice(0, 13);
    setPhone(digits);
    try { localStorage.setItem(PHONE_LS_KEY, digits); } catch {}
  }

  function formatDisplay(digits: string) {
    if (!digits) return '';
    const d = digits.startsWith('55') ? digits.slice(2) : digits;
    if (d.length <= 2) return d;
    if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
    if (d.length <= 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
    return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7, 11)}`;
  }

  const canSend = phone.replace(/\D/g, '').length >= 10;

  return (
    <ModalOverlay onClose={onClose}>
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-80 p-5 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-foreground">Executar teste real</p>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
        </div>
        <p className="text-xs text-muted-foreground -mt-2 leading-relaxed">
          Envia as mensagens de verdade via WhatsApp. Em nós de condição/switch, aguarda a resposta real do lead para seguir o caminho correto.
        </p>
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">Número de teste</label>
          <div className="flex items-center gap-0 rounded-xl border border-border overflow-hidden bg-muted focus-within:ring-2 focus-within:ring-primary/40">
            <div className="flex items-center gap-1.5 px-3 py-2.5 border-r border-border bg-muted/60 shrink-0">
              <span className="text-base leading-none">🇧🇷</span>
              <span className="text-xs font-medium text-muted-foreground">+55</span>
            </div>
            <input
              type="tel"
              inputMode="numeric"
              value={formatDisplay(phone.startsWith('55') ? phone.slice(2) : phone)}
              onChange={(e) => handlePhoneChange('55' + e.target.value.replace(/\D/g, ''))}
              placeholder="(11) 99999-9999"
              autoFocus
              className="flex-1 bg-transparent px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 outline-none" />
          </div>
        </div>
        <button
          onClick={() => { if (canSend) { onStart(phone); onClose(); } }}
          disabled={!canSend}
          className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2">
          <Play className="w-3.5 h-3.5" />Disparar teste
        </button>
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
  const [saveError, setSaveError] = useState<string | null>(null);
  const [nodeExecError, setNodeExecError] = useState<{ name: string; msg: string } | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);

  // Versioning
  const [versionsOpen, setVersionsOpen] = useState(false);
  const [versions, setVersions] = useState<CanvasVersion[]>([]);

  // Templates
  const [templatesOpen, setTemplatesOpen] = useState(false);

  // Test run
  const [testModalOpen, setTestModalOpen] = useState(false);
  const [noshowCronTestOpen, setNoshowCronTestOpen] = useState(false);
  const [testRunning, setTestRunning] = useState(false);
  const [testWaitingReply, setTestWaitingReply] = useState(false);
  const abortTestRef = useRef(false);

  // Conflict
  const conflictCount = sequences.filter((s) => s.ativo).length;

  const currentSeq = sequences.find((s) => s.tipo === activeTipo) ?? null;

  // Remarketing entry config (persisted in canvas_config.remarketing)
  const [remarketingCfg, setRemarketingCfg] = useState<RemarketingConfig>({
    statusFiltros: ['Remarketing'],
    diasInativo: 3,
  });

  useEffect(() => {
    if (activeTipo === 'remarketing') {
      const saved = currentSeq?.canvas_config?.remarketing;
      setRemarketingCfg(saved ?? { statusFiltros: ['Remarketing'], diasInativo: 3 });
    }
  }, [currentSeq?.id, activeTipo]); // eslint-disable-line react-hooks/exhaustive-deps

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
    setNodes(stepsToNodes(currentSeq.follow_steps, currentSeq.nome, currentSeq.canvas_config, currentSeq.tipo));
    setEdges(stepsToEdges(currentSeq.follow_steps, currentSeq.canvas_config));
    setSelectedNodeId(null);
    setVersions(loadVersions(currentSeq.id));
  }, [currentSeq?.id, activeTipo]); // eslint-disable-line react-hooks/exhaustive-deps

  const onConnect = useCallback(
    (params: Connection) => {
      const sourceNode = nodes.find((n) => n.id === params.source);
      let label: string | undefined;
      if (sourceNode?.data.kind === 'condition') {
        label = params.sourceHandle === 'sim' ? 'Sim' : params.sourceHandle === 'nao' ? 'Não' : undefined;
      } else if (sourceNode?.data.kind === 'switch') {
        const sd = sourceNode.data as SwitchNodeData;
        if (params.sourceHandle?.startsWith('case-')) {
          const idx = parseInt(params.sourceHandle.replace('case-', ''), 10);
          label = sd.cases[idx]?.label || sd.cases[idx]?.value;
        } else if (params.sourceHandle === 'else') {
          label = 'else';
        }
      }
      setEdges((eds) => addEdge({ ...params, ...EDGE_BASE, label }, eds));
    },
    [setEdges, nodes]
  );

  const edgeReconnectSuccessful = useRef(false);
  const onReconnectStart = useCallback(() => { edgeReconnectSuccessful.current = false; }, []);
  const onReconnect = useCallback(
    (oldEdge: Edge, newConnection: Connection) => {
      edgeReconnectSuccessful.current = true;
      setEdges((eds) => reconnectEdge(oldEdge, newConnection, eds));
    },
    [setEdges]
  );
  const onReconnectEnd = useCallback(
    (_: MouseEvent | TouchEvent, edge: Edge) => {
      if (!edgeReconnectSuccessful.current) {
        setEdges((eds) => eds.filter((e) => e.id !== edge.id));
      }
    },
    [setEdges]
  );

  function addPaletteNode(kind: PaletteKind) {
    const id = newId();
    const center = screenToFlowPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
    let data: AutoNodeData;
    if (kind === 'message') data = { kind: 'message', label: 'Mensagem', dia_offset: 1, horario: '09:00', mensagem: '', tipo_mensagem: 'texto', stepId: id } satisfies MessageNodeData;
    else if (kind === 'wait') data = { kind: 'wait', label: 'Aguardar', dia_offset: 1, stepId: id } satisfies WaitNodeData;
    else if (kind === 'condition') data = { kind: 'condition', label: 'Condição', condicao: 'Respondeu?', variavel: 'resposta_botao', operador: 'eq', valor: '', stepId: id } satisfies ConditionNodeData;
    else if (kind === 'switch') data = { kind: 'switch', label: 'Switch', variavel: 'resposta_botao', cases: [{ value: '', label: 'Caso 1' }], stepId: id } satisfies SwitchNodeData;
    else if (kind === 'webhook') data = { kind: 'webhook', label: 'Webhook', url: '', method: 'POST', stepId: id } satisfies WebhookNodeData;
    else if (kind === 'lead_score') data = { kind: 'lead_score', label: 'Lead Score', scoreMin: 60, scoreMax: 100, stepId: id } satisfies LeadScoreNodeData;
    else if (kind === 'ab_test') data = { kind: 'ab_test', label: 'Teste A/B', variantA: 'Variante A', variantB: 'Variante B', stepId: id } satisfies ABTestNodeData;
    else if (kind === 'scheduling') data = { kind: 'scheduling', label: 'Agendar Call', dia_offset: 0, horario: '09:00', duracao: 60, mensagemInicial: '', stepId: id } satisfies SchedulingNodeData;
    else data = { kind: 'end', label: 'Encerrar', stepId: id } satisfies EndNodeData;

    const typeMap: Record<PaletteKind, string> = {
      message: 'messageNode', wait: 'waitNode', condition: 'conditionNode', switch: 'switchNode', end: 'endNode',
      webhook: 'webhookNode', lead_score: 'leadScoreNode', ab_test: 'abTestNode', scheduling: 'schedulingNode',
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
    setSaveError(null);
    try {
      saveVersion(currentSeq.id, nodes, edges);
      setVersions(loadVersions(currentSeq.id));

      const steps = nodesToSteps(nodes);
      const triggerNode = nodes.find((n) => n.id === 'trigger');
      const nome = (triggerNode?.data as TriggerNodeData | undefined)?.label ?? currentSeq.nome;

      // Build canvas_config: positions + edges indexed by x-sorted order so they survive UUID rotation
      const nonTrigger = [...nodes.filter((n) => n.id !== 'trigger')].sort((a, b) => a.position.x - b.position.x);
      const idToIdx: Record<string, number> = {};
      nonTrigger.forEach((n, i) => { idToIdx[n.id] = i; });
      // Collect custom labels from all nodes (keyed by stepId)
      const customLabels: Record<string, string> = {};
      nodes.forEach((n) => {
        const cl = (n.data as any).customLabel as string | undefined;
        const sid = (n.data as any).stepId as string | undefined;
        if (cl && sid) customLabels[sid] = cl;
      });

      const canvas_config: CanvasConfig = {
        triggerPos: triggerNode?.position ?? { x: 0, y: 150 },
        positions: nonTrigger.map((n) => ({ x: n.position.x, y: n.position.y })),
        edges: edges
          .map((e) => ({
            sourceIdx: e.source === 'trigger' ? -1 : idToIdx[e.source],
            targetIdx: e.target === 'trigger' ? -1 : idToIdx[e.target],
            sourceHandle: (e.sourceHandle ?? undefined) as string | undefined,
            targetHandle: (e.targetHandle ?? undefined) as string | undefined,
          }))
          .filter((e) => e.sourceIdx !== undefined && e.targetIdx !== undefined) as CanvasConfigEdge[],
        ...(currentSeq.tipo === 'remarketing' ? { remarketing: remarketingCfg } : {}),
        ...(Object.keys(customLabels).length > 0 ? { customLabels } : {}),
      };

      const res = await fetch(`/api/follow/sequences/${currentSeq.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome, tipo: currentSeq.tipo, ativo: currentSeq.ativo, steps, canvas_config }),
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error((errJson as any).error ?? `HTTP ${res.status}`);
      }
      const saved = (await res.json()) as { sequence?: FollowSequence };

      // Update sequences state with new nome, follow_steps, and canvas_config.
      // useEffect depends on currentSeq?.id (not reference), so this does NOT re-render canvas.
      const savedSteps2 = saved.sequence?.follow_steps ?? null;
      setSequences((seqs) => seqs.map((s) => s.id === currentSeq.id
        ? { ...s, nome, canvas_config, ...(savedSteps2 ? { follow_steps: savedSteps2 } : {}) }
        : s
      ));

      // Patch data.stepId in nodes with real DB UUIDs (matching by x-position order = ordem order).
      const savedSteps = [...(saved.sequence?.follow_steps ?? [])].sort((a, b) => a.ordem - b.ordem);
      if (savedSteps.length > 0) {
        setNodes((nds) => {
          const nt = [...nds.filter((n) => n.id !== 'trigger')].sort((a, b) => a.position.x - b.position.x);
          return nds.map((n) => {
            if (n.id === 'trigger') return n;
            const idx = nt.findIndex((nn) => nn.id === n.id);
            const realStep = savedSteps[idx];
            if (!realStep) return n;
            return { ...n, data: { ...n.data, stepId: realStep.id } as AutoNodeData };
          });
        });
      }

      setSaveOk(true);
      setTimeout(() => setSaveOk(false), 2500);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro desconhecido ao salvar';
      console.error('[AutomationCanvas] save', err);
      setSaveError(msg);
    } finally { setSaving(false); }
  }

  // ─── Lead count badges ────────────────────────────────────────────────────────

  useEffect(() => {
    if (!currentSeq) return;
    let cancelled = false;
    async function fetchCounts() {
      try {
        const res = await fetch(`/api/follow/sequences/${currentSeq!.id}/node-counts`);
        if (!res.ok || cancelled) return;
        const { counts } = await res.json() as { counts: Record<string, number> };
        setNodes((nds) => nds.map((n) => {
          const count = counts[String((n.data as any).stepId)] ?? 0;
          return count === (n.data as any)._leadCount ? n : { ...n, data: { ...n.data, _leadCount: count } as AutoNodeData };
        }));
      } catch {}
    }
    fetchCounts();
    const interval = setInterval(fetchCounts, 30_000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [currentSeq?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Keyboard shortcuts ───────────────────────────────────────────────────────

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement).tagName.toLowerCase();
      if (['input', 'textarea', 'select'].includes(tag)) return;

      // Delete / Backspace → remove selected node
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedNodeId && selectedNodeId !== 'trigger') {
        e.preventDefault();
        handleDeleteNode(selectedNodeId);
        setSelectedNodeId(null);
        return;
      }

      // Ctrl+D / Cmd+D → duplicate selected node
      if ((e.key === 'd' || e.key === 'D') && (e.ctrlKey || e.metaKey) && selectedNodeId) {
        e.preventDefault();
        const node = nodes.find((n) => n.id === selectedNodeId);
        if (!node) return;
        const newNodeId = newId();
        const duplicated: Node<AutoNodeData> = {
          ...node,
          id: newNodeId,
          position: { x: node.position.x + 40, y: node.position.y + 40 },
          data: { ...node.data, stepId: newNodeId } as AutoNodeData,
          selected: false,
        };
        setNodes((nds) => [...nds, duplicated]);
        setSelectedNodeId(newNodeId);
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selectedNodeId, nodes]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Test execution ────────────────────────────────────────────────────────────

  function setNodeExecState(nodeId: string, state: ExecState, error?: string) {
    setNodes((nds) => nds.map((n) => n.id === nodeId ? { ...n, data: { ...n.data, _execState: state, _execError: error } as AutoNodeData } : n));
  }

  function clearAllExecStates() {
    setNodes((nds) => nds.map((n) => ({ ...n, data: { ...n.data, _execState: undefined, _execError: undefined } as AutoNodeData })));
  }

  function evaluateCondition(d: ConditionNodeData, reply: string): 'sim' | 'nao' {
    const val = (d.valor ?? '').toLowerCase().trim();
    const r = reply.toLowerCase().trim();
    if (d.operador === 'not_empty') return r ? 'sim' : 'nao';
    if (d.operador === 'eq') return r === val ? 'sim' : 'nao';
    if (d.operador === 'contains') return r.includes(val) ? 'sim' : 'nao';
    if (d.operador === 'starts_with') return r.startsWith(val) ? 'sim' : 'nao';
    return 'nao';
  }

  function evaluateSwitch(d: SwitchNodeData, reply: string): string {
    const r = reply.toLowerCase().trim();
    const idx = d.cases.findIndex((c) =>
      c.value.toLowerCase().trim() === r || c.label.toLowerCase().trim() === r
    );
    return idx >= 0 ? `case-${idx}` : 'else';
  }

  // baselineCount: número de mensagens inbound no momento anterior ao envio — detecta nova resposta por contagem
  async function waitForLeadReply(conversaId: string, timeoutMs = 120_000, baselineCount?: number): Promise<string> {
    let knownCount = baselineCount ?? -1;
    if (baselineCount === undefined) {
      // Fallback: captura baseline agora
      try {
        const initRes = await fetch(`/api/follow/conversa-latest-reply?conversaId=${conversaId}`);
        const initJ = await initRes.json();
        knownCount = initJ.count ?? 0;
      } catch {
        knownCount = 0;
      }
    }

    const deadline = Date.now() + timeoutMs;

    return new Promise((resolve, reject) => {
      const interval = setInterval(async () => {
        if (abortTestRef.current) {
          clearInterval(interval);
          reject(new Error('Teste cancelado'));
          return;
        }
        if (Date.now() > deadline) {
          clearInterval(interval);
          reject(new Error(
            `Timeout: nenhuma resposta recebida em 2 minutos.\n` +
            `Verifique se o lead respondeu à mensagem anterior. ` +
            `Se clicou num botão antes do teste chegar neste node, reinicie o teste e responda após ver "Aguardando resposta...".`
          ));
          return;
        }
        try {
          const res = await fetch(`/api/follow/conversa-latest-reply?conversaId=${conversaId}&baselineCount=${knownCount}`);
          const j = await res.json();
          if (j.text != null) {
            clearInterval(interval);
            resolve(String(j.text));
          }
        } catch {}
      }, 2000);
    });
  }

  async function runTest(phone: string) {
    if (!currentSeq) return;
    abortTestRef.current = false;
    setTestRunning(true);
    setTestWaitingReply(false);
    setNodeExecError(null);

    // Find conversation for this phone (needed for reply polling)
    let conversaId: string | null = null;
    try {
      const r = await fetch(`/api/follow/conversa-for-phone?phone=${encodeURIComponent(phone)}`);
      const j = await r.json();
      conversaId = j.conversaId ?? null;
    } catch {}

    // Build adjacency map
    const edgeMap: Record<string, { targetId: string; sourceHandle?: string }[]> = {};
    edges.forEach((e) => {
      if (!edgeMap[e.source]) edgeMap[e.source] = [];
      edgeMap[e.source].push({ targetId: e.target, sourceHandle: e.sourceHandle ?? undefined });
    });
    const nodeMap: Record<string, Node<AutoNodeData>> = {};
    nodes.forEach((n) => { nodeMap[n.id] = n; });

    let currentId: string | null = 'trigger';
    const visited = new Set<string>();
    // Baseline capturado ANTES de cada mensagem enviada — condition node usa para detectar respostas chegadas durante o envio
    let replyBaselineCount: number | undefined = undefined;

    while (currentId && !abortTestRef.current) {
      if (visited.has(currentId)) break;
      visited.add(currentId);

      const node = nodeMap[currentId];
      if (!node) break;

      const d = node.data;
      setNodeExecState(node.id, 'running');
      await new Promise((r) => setTimeout(r, 400));
      if (abortTestRef.current) { setNodeExecState(node.id, 'idle'); break; }

      let chosenHandle: string | undefined;

      try {
        if (d.kind === 'trigger') {
          setNodeExecState(node.id, 'success');
        } else if (d.kind === 'wait') {
          setNodeExecState(node.id, 'skipped');
        } else if (d.kind === 'end') {
          setNodeExecState(node.id, 'success');
          break;
        } else if (d.kind === 'message') {
          if (String(d.stepId ?? '').startsWith('new-')) {
            throw new Error('Salve a sequência antes de executar o teste');
          }
          // Captura baseline ANTES do envio — garante que respostas rápidas (botões) sejam detectadas pela condição seguinte
          if (conversaId) {
            try {
              const bRes = await fetch(`/api/follow/conversa-latest-reply?conversaId=${conversaId}`);
              const bJson = await bRes.json();
              replyBaselineCount = bJson.count ?? 0;
            } catch {
              replyBaselineCount = 0;
            }
          }
          const res = await fetch(`/api/follow/sequences/${currentSeq.id}/send-test`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ stepId: d.stepId, phone }),
          });
          if (!res.ok) {
            const errJson = await res.json().catch(() => ({}));
            throw new Error((errJson as any).error ?? `HTTP ${res.status}`);
          }
          setNodeExecState(node.id, 'success');
        } else if (d.kind === 'condition') {
          if (!conversaId) throw new Error('Nenhuma conversa encontrada para este número. O lead precisa ter conversado antes.');
          setTestWaitingReply(true);
          const reply = await waitForLeadReply(conversaId, 120_000, replyBaselineCount);
          replyBaselineCount = undefined; // consumido
          setTestWaitingReply(false);
          if (abortTestRef.current) break;
          const result = evaluateCondition(d as ConditionNodeData, reply);
          setNodeExecState(node.id, result === 'sim' ? 'success' : 'skipped', result === 'nao' ? `Resposta "${reply}" não satisfaz a condição` : undefined);
          chosenHandle = result;
        } else if (d.kind === 'switch') {
          if (!conversaId) throw new Error('Nenhuma conversa encontrada para este número. O lead precisa ter conversado antes.');
          setTestWaitingReply(true);
          const reply = await waitForLeadReply(conversaId, 120_000, replyBaselineCount);
          replyBaselineCount = undefined; // consumido
          setTestWaitingReply(false);
          if (abortTestRef.current) break;
          chosenHandle = evaluateSwitch(d as SwitchNodeData, reply);
          setNodeExecState(node.id, 'success');
        } else if (d.kind === 'webhook') {
          await fetch(d.url, { method: d.method }).catch(() => {});
          setNodeExecState(node.id, 'success');
        } else if (d.kind === 'ab_test') {
          const variant = Math.random() < 0.5 ? 'A' : 'B';
          setNodeExecState(node.id, 'success', `Variante ${variant} selecionada`);
          chosenHandle = variant.toLowerCase();
        } else if (d.kind === 'scheduling') {
          const sd = d as SchedulingNodeData;
          if (sd.mensagemInicial && conversaId) {
            setNodeExecState(node.id, 'running', 'Enviando mensagem inicial…');
            const r = await fetch(`/api/follow/sequences/${currentSeq!.id}/send-test`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ stepId: sd.stepId, phone, dryRun: false }),
            });
            if (!r.ok) {
              const e = await r.json().catch(() => ({}));
              throw new Error(e.error ?? `send-test ${r.status}`);
            }
          }
          setNodeExecState(node.id, 'success', 'Agente de agendamento ativado — SDR assume a conversa');
          break; // real executor hands off to SDR; test stops here
        } else if (d.kind === 'lead_score') {
          setNodeExecState(node.id, 'success');
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Erro desconhecido';
        const nodeName = (node.data.label as string | undefined) ?? node.id;
        setNodeExecState(node.id, 'error', msg);
        setNodeExecError({ name: String(nodeName), msg });
        setTestWaitingReply(false);
        break;
      }

      const outgoing = edgeMap[node.id] ?? [];
      const hasHandles = outgoing.some((e) => e.sourceHandle);
      const next = chosenHandle
        ? (hasHandles
            ? outgoing.find((e) => e.sourceHandle === chosenHandle)
            : chosenHandle === 'nao' ? outgoing[outgoing.length - 1] : outgoing[0])
        : outgoing[0];
      currentId = next?.targetId ?? null;
    }

    setTestRunning(false);
    setTestWaitingReply(false);
  }

  function stopTest() {
    abortTestRef.current = true;
    setTestRunning(false);
    setTestWaitingReply(false);
    setNodeExecError(null);
    clearAllExecStates();
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

            {/* Anti-noshow force trigger */}
            {activeTipo === 'anti_noshow' && (
              <button onClick={() => setNoshowCronTestOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium transition-colors border border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20">
                <Zap className="w-3.5 h-3.5" />Disparar agora
              </button>
            )}

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

      {/* Save error banner */}
      {saveError && (
        <div className="flex items-center gap-3 px-4 py-2 bg-destructive/10 border-b border-destructive/20 flex-shrink-0">
          <AlertCircle className="w-4 h-4 text-destructive shrink-0" />
          <span className="text-xs text-destructive flex-1">Erro ao salvar: {saveError}</span>
          <button onClick={() => setSaveError(null)} className="text-destructive/60 hover:text-destructive transition-colors"><X className="w-3.5 h-3.5" /></button>
        </div>
      )}

      {/* Waiting for lead reply banner */}
      {testWaitingReply && (
        <div className="flex items-center gap-3 px-4 py-2 bg-primary/10 border-b border-primary/20 flex-shrink-0">
          <Loader2 className="w-4 h-4 text-primary animate-spin shrink-0" />
          <span className="text-xs text-primary flex-1 font-medium">Aguardando resposta do lead… (timeout: 2 min)</span>
          <button onClick={stopTest} className="text-primary/60 hover:text-primary transition-colors text-xs">Cancelar</button>
        </div>
      )}

      {/* Node exec error banner */}
      {nodeExecError && (
        <div className="flex items-center gap-3 px-4 py-2 bg-destructive/10 border-b border-destructive/20 flex-shrink-0">
          <AlertCircle className="w-4 h-4 text-destructive shrink-0" />
          <span className="text-xs text-destructive flex-1">Erro no nó <strong>{nodeExecError.name}</strong>: {nodeExecError.msg}</span>
          <button onClick={() => setNodeExecError(null)} className="text-destructive/60 hover:text-destructive transition-colors"><X className="w-3.5 h-3.5" /></button>
        </div>
      )}

      {/* Body */}
      <div className="flex min-h-0" style={{ flex: 1 }}>
        {mode === 'execucoes' ? (
          <ExecutionsView sequenceId={currentSeq?.id ?? null} tipo={activeTipo} />
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
                    nodeTypes={nodeTypes} edgeTypes={edgeTypes}
                    onNodeClick={(_, node) => setSelectedNodeId(node.id)}
                    onPaneClick={() => { setSelectedNodeId(null); setPaletteOpen(false); }}
                    fitView fitViewOptions={{ padding: 0.2 }} minZoom={0.3} maxZoom={1.5}
                    edgesUpdatable
                    reconnectRadius={12}
                    onReconnect={onReconnect}
                    onReconnectStart={onReconnectStart}
                    onReconnectEnd={onReconnectEnd}
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
                onUpdate={handleUpdateNode} onDelete={handleDeleteNode}
                nodes={nodes} edges={edges}
                sequenceTipo={activeTipo}
                remarketingCfg={remarketingCfg}
                onRemarketingChange={setRemarketingCfg} />
            )}
          </>
        )}
      </div>

      {/* Modals */}
      {testModalOpen && (
        <TestRunModal
          onStart={(phone) => { setTestModalOpen(false); runTest(phone); }}
          onClose={() => setTestModalOpen(false)}
        />
      )}

      {noshowCronTestOpen && (
        <NoshowCronTestModal onClose={() => setNoshowCronTestOpen(false)} />
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
