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
  BackgroundVariant,
  BaseEdge,
  EdgeLabelRenderer,
  getSmoothStepPath,
  useNodeId,
  useStore,
  type Connection,
  type Node,
  type Edge,
  type NodeChange,
  type NodeProps,
  type EdgeProps,
  useReactFlow,
  ReactFlowProvider,
} from '@xyflow/react';
import {
  createContext,
  useCallback,
  useContext,
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
  Target,
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
  ChevronUp,
  Trash2,
  Link,
  Phone,
  MessageCircle,
  Bell,
  GitCompare,
  Layers,
  Radio,
  ShieldCheck,
  TrendingUp,
  BarChart2,
  ShieldAlert,
  Library,
  TestTube2,
  CreditCard,
  Banknote,
  Hourglass,
  Copy,
  Calendar,
  MoreHorizontal,
  Minus,
  Maximize,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

// ─── API Types ──────────────────────────────────────────────────────────────────

type SequenceTipo = 'follow_geral' | 'anti_noshow' | 'remarketing' | 'trial_saas' | 'pagamento';

interface FollowStep {
  id: string;
  dia_offset: number;
  horario: string;
  mensagem: string | null;
  tipo_mensagem: string;
  ordem: number;
  condicao: string | null;
  media_config?: { file?: string; text?: string; docName?: string; [k: string]: any } | null;
  sdr_ativo?: boolean | null;
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
  sourceIdx: number;   // -1 = primary trigger, -2..-N = extraTriggers[idx-2], 0..N = non-trigger nodes (x-sorted)
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
  nodeComments?: Record<string, string>; // stepId → comment annotation
  expira_em_dias?: number;              // auto-expire sequence after N days (0 = never)
  eventoEntrada?: 'novo_lead' | 'mudanca_status' | 'webhook' | 'preco_informado' | 'formulario_preenchido' | 'call_realizada' | 'tag_follow_up' | 'tag_no_show' | 'tag_promocao' | 'mercadopago' | 'kiwify' | 'mp_kiwify' | 'asaas_pago' | 'asaas_boleto_gerado' | 'asaas_boleto_vencido'; // entry event type
  extraTriggers?: Array<{ id: string; platform: 'mercadopago' | 'kiwify' | 'asaas'; eventoEntrada?: string; position: { x: number; y: number } }>;
  noDefaultTrigger?: boolean; // primary trigger was deleted by user
}

interface FollowSequence {
  id: string;
  nome: string;
  tipo: SequenceTipo;
  ativo: boolean;
  staging?: boolean;
  aprovacao_pendente?: boolean;
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
  expira_em_dias?: number;
  eventoEntrada?: 'novo_lead' | 'mudanca_status' | 'webhook' | 'preco_informado' | 'formulario_preenchido' | 'call_realizada' | 'tag_follow_up' | 'tag_no_show' | 'tag_promocao' | 'mercadopago' | 'kiwify' | 'mp_kiwify' | 'asaas_pago' | 'asaas_boleto_gerado' | 'asaas_boleto_vencido';
  platform?: 'mercadopago' | 'kiwify' | 'asaas'; // per-trigger platform (pagamento tipo only)
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
  _sentCount?: number;
  _failedCount?: number;
  _dlqCount?: number;
  tipo_mensagem: string;
  stepId: string;
  customLabel?: string;
  // Blocos: multiple text messages sent sequentially (texto type only)
  blocos?: string[];
  media_url?: string;
  media_name?: string;
  uploading?: boolean;
  transcribing?: boolean;
  // Localização (Google Maps URL + labels)
  location_url?: string;
  location_name?: string;
  location_address?: string;
  // Lista / Botões (newline-separated serialized) : uazapi, autoria livre
  menu_choices?: string;
  // Carrossel (JSON string) : uazapi, autoria livre
  carousel_json?: string;
  // Canal Meta : lista/botões/carrossel exigem Template HSM aprovado
  // (Meta não tem lista/botões/carrossel livres, ver TemplateSelector)
  metaTemplateId?: string;
  metaTemplateBodyParams?: string[];
  // Controle de IA: null = sem mudança, true = ativar, false = pausar
  sdr_ativo?: boolean | null;
  // Unidade do dia_offset: 'days' (padrão) ou 'hours'. Para anti_noshow sempre 'hours'.
  offset_unit?: 'days' | 'hours' | 'minutes';
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

interface GoalNodeData extends Record<string, unknown> {
  kind: 'goal';
  label: string;
  marcarStatus?: string;
  stepId: string;
  customLabel?: string;
  _execState?: ExecState;
  _execError?: string;
}

interface SentimentNodeData extends Record<string, unknown> {
  kind: 'sentiment';
  label: string;
  stepId: string;
  customLabel?: string;
  comment?: string;
  _execState?: ExecState;
  _execError?: string;
}

interface SubFlowNodeData extends Record<string, unknown> {
  kind: 'sub_flow';
  label: string;
  subSequenceId: string;
  subSequenceName?: string;
  stepId: string;
  customLabel?: string;
  comment?: string;
  _execState?: ExecState;
  _execError?: string;
}

interface WaitEventNodeData extends Record<string, unknown> {
  kind: 'wait_event';
  label: string;
  event: 'reply' | 'keyword';
  pattern?: string;
  stepId: string;
  customLabel?: string;
  comment?: string;
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
  blocos?: string[];
  stepId: string;
  customLabel?: string;
  _execState?: ExecState;
  _execError?: string;
}

interface PostConditionNodeData extends Record<string, unknown> {
  kind: 'post_condition';
  label: string;
  mensagem: string | null;
  tipo_mensagem: string;
  stepId: string;
  customLabel?: string;
  blocos?: string[];
  _execState?: ExecState;
  _execError?: string;
  _leadCount?: number;
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

interface GerarCobrancaNodeData extends Record<string, unknown> {
  kind: 'gerar_cobranca';
  label: string;
  billingType: 'PIX' | 'BOLETO' | 'CREDIT_CARD' | 'UNDEFINED';
  value?: number;       // fixed amount (0 = dynamic from lead.project_value)
  description?: string;
  daysUntilDue: number; // days from now for due date
  sendWhatsapp: boolean;
  stepId: string;
  customLabel?: string;
  _execState?: ExecState;
  _execError?: string;
}

interface AguardarPagamentoNodeData extends Record<string, unknown> {
  kind: 'aguardar_pagamento';
  label: string;
  timeoutDays: number;  // days to wait before going to "vencido" branch
  stepId: string;
  customLabel?: string;
  _execState?: ExecState;
  _execError?: string;
}

type AutoNodeData =
  | TriggerNodeData
  | MessageNodeData
  | WaitNodeData
  | WaitEventNodeData
  | SubFlowNodeData
  | ConditionNodeData
  | SwitchNodeData
  | EndNodeData
  | GoalNodeData
  | SentimentNodeData
  | WebhookNodeData
  | LeadScoreNodeData
  | ABTestNodeData
  | SchedulingNodeData
  | PostConditionNodeData
  | GerarCobrancaNodeData
  | AguardarPagamentoNodeData;

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
  return `Versão ${idx + 1 + (5 - total)}: ${dateStr} · ${nodeCount} nós`;
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
  style: { stroke: 'var(--zp-edge, #3A3A3A)', strokeWidth: 2 },
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

function derivePlatformFromEvento(eventoEntrada?: string): 'mercadopago' | 'kiwify' | 'asaas' | undefined {
  if (!eventoEntrada) return undefined;
  if (eventoEntrada.startsWith('asaas')) return 'asaas';
  if (eventoEntrada === 'mercadopago' || eventoEntrada === 'kiwify') return eventoEntrada;
  return undefined;
}

function stepsToNodes(steps: FollowStep[] | undefined | null, sequenceName: string, canvasConfig?: CanvasConfig | null, sequenceTipo?: SequenceTipo): Node<AutoNodeData>[] {
  const nodes: Node<AutoNodeData>[] = [];
  // Primary trigger: skip if user explicitly deleted it
  if (!canvasConfig?.noDefaultTrigger) {
    const triggerPos = canvasConfig?.triggerPos ?? { x: 0, y: 192 };
    nodes.push({
      id: 'trigger', type: 'triggerNode', position: triggerPos,
      data: { kind: 'trigger', label: sequenceName, condicao: 'Início da sequência',
        expira_em_dias: canvasConfig?.expira_em_dias ?? 0,
        eventoEntrada: canvasConfig?.eventoEntrada,
        platform: sequenceTipo === 'pagamento' ? derivePlatformFromEvento(canvasConfig?.eventoEntrada) : undefined,
      } satisfies TriggerNodeData,
    });
  }
  // For pagamento tipo: add extra trigger nodes (each with its own independent flow)
  if (sequenceTipo === 'pagamento' && canvasConfig?.extraTriggers) {
    for (const et of canvasConfig.extraTriggers) {
      nodes.push({
        id: et.id, type: 'triggerNode', position: et.position,
        data: { kind: 'trigger', label: sequenceName, condicao: 'Início da sequência',
          platform: et.platform,
          eventoEntrada: et.eventoEntrada as TriggerNodeData['eventoEntrada'],
        } satisfies TriggerNodeData,
      });
    }
  }
  const sorted = [...(steps ?? [])].sort((a, b) => a.ordem - b.ordem);
  sorted.forEach((step, idx) => {
    const stored = canvasConfig?.positions?.[idx];
    const x = stored?.x ?? 312 + idx * 320;
    const y = stored?.y ?? 150;
    const condicaoLower = step.condicao?.toLowerCase() ?? '';
    // Normalize tipo: DB may store EN ('text') or legacy PT ('texto'): map both to canvas PT
    let tipoCanvas = UAZAPI_TO_CANVAS[step.tipo_mensagem] ?? step.tipo_mensagem;
    // Distinguish lista vs botoes by menuType stored in media_config
    if (tipoCanvas === 'lista' && step.media_config?.menuType === 'button') tipoCanvas = 'botoes';
    const isScheduling = step.tipo_mensagem === 'agendamento';
    const isPostCondition = step.tipo_mensagem === 'pos_condicao';
    const isFim = tipoCanvas === 'fim' || step.condicao?.toLowerCase().includes('fim') || step.condicao?.toLowerCase().includes('encerr');
    const isCondition = tipoCanvas === 'condicao' || step.condicao?.toLowerCase().includes('respondeu') || step.condicao?.toLowerCase().includes('condicao');
    const hasMedia = !!step.media_config?.file || !!step.media_config?.latitude || !!step.media_config?.choices || !!step.media_config?.carousel || !!(step.media_config as any)?.metaTemplateId;
    const isWait = tipoCanvas === 'aguardar' || (!hasMedia && step.mensagem === null && !isFim && !isCondition && !isScheduling && !isPostCondition);

    // Extract media from media_config (stored by nodesToSteps)
    const media_url = step.media_config?.file ?? undefined;
    const media_name = step.media_config?.docName ?? undefined;
    const mensagemDisplay = step.mensagem ?? step.media_config?.text ?? null;
    // Location fields: reconstruct Google Maps URL from stored coordinates
    const location_name = step.media_config?.name as string | undefined;
    const location_address = step.media_config?.address as string | undefined;
    const _lat = step.media_config?.latitude as number | undefined;
    const _lng = step.media_config?.longitude as number | undefined;
    const location_url = (_lat != null && _lng != null && (_lat !== 0 || _lng !== 0))
      ? `https://www.google.com/maps/@${_lat},${_lng},17z`
      : undefined;
    // Menu fields: prefer raw ButtonDef array for roundtrip fidelity, fall back to labels
    const menu_choices = Array.isArray((step.media_config as any)?.buttons)
      ? serializeButtons((step.media_config as any).buttons as ButtonDef[])
      : Array.isArray(step.media_config?.choices)
        ? (step.media_config!.choices as string[]).join('\n')
        : undefined;
    // Carousel
    const carousel_json = Array.isArray(step.media_config?.carousel) ? JSON.stringify(step.media_config!.carousel, null, 2) : undefined;
    // Canal Meta : referência ao Template HSM escolhido (lista/botões/carrossel)
    const metaTemplateId = (step.media_config as any)?.metaTemplateId as string | undefined;
    const metaTemplateBodyParams = (step.media_config as any)?.metaTemplateBodyParams as string[] | undefined;
    // Blocos: array of separate text messages sent sequentially
    const blocos = Array.isArray(step.media_config?.blocos) && (step.media_config!.blocos as string[]).length > 0
      ? (step.media_config!.blocos as string[])
      : undefined;
    // Custom label and comment (stored in canvas_config, keyed by stepId)
    const customLabel = canvasConfig?.customLabels?.[step.id] ?? undefined;
    const comment = canvasConfig?.nodeComments?.[step.id] ?? undefined;

    if (step.tipo_mensagem === 'wait_event') {
      const wmc = step.media_config as any ?? {};
      nodes.push({ id: step.id, type: 'waitEventNode', position: { x, y },
        data: { kind: 'wait_event', label: 'Aguardar Evento', event: wmc.event ?? 'reply', pattern: wmc.pattern ?? '', stepId: step.id, customLabel, comment } satisfies WaitEventNodeData });
    }
    else if (step.tipo_mensagem === 'sub_flow') {
      const smc = step.media_config as any ?? {};
      nodes.push({ id: step.id, type: 'subFlowNode', position: { x, y },
        data: { kind: 'sub_flow', label: 'Sub-fluxo', subSequenceId: smc.subSequenceId ?? '', subSequenceName: smc.subSequenceName ?? '', stepId: step.id, customLabel, comment } satisfies SubFlowNodeData });
    }
    else if (step.tipo_mensagem === 'goal') {
      nodes.push({ id: step.id, type: 'goalNode', position: { x, y },
        data: { kind: 'goal', label: 'Meta', marcarStatus: step.condicao || 'Convertido', stepId: step.id, customLabel, comment } satisfies GoalNodeData });
    }
    else if (step.tipo_mensagem === 'sentiment') {
      nodes.push({ id: step.id, type: 'sentimentNode', position: { x, y },
        data: { kind: 'sentiment', label: 'Sentimento', stepId: step.id, customLabel, comment } satisfies SentimentNodeData });
    }
    else if (isFim) nodes.push({ id: step.id, type: 'endNode', position: { x, y }, data: { kind: 'end', label: 'Encerrar sequência', stepId: step.id, customLabel } satisfies EndNodeData });
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
        try { const p = JSON.parse(step.condicao ?? ''); if (p?.variavel) { variavel = p.variavel; operador = p.operador; valor = p.valor; } } catch {}
      }
      // When variavel is 'custom', restore the custom variable name from media_config.customVariavel
      const condicaoCanvas = variavel === 'custom' ? (mc.customVariavel || step.condicao || '') : (step.condicao || 'Respondeu?');
      nodes.push({ id: step.id, type: 'conditionNode', position: { x, y },
        data: { kind: 'condition', label: 'Condição', condicao: condicaoCanvas, variavel, operador, valor, stepId: step.id, customLabel } satisfies ConditionNodeData });
    }
    else if (isScheduling) {
      const smc = step.media_config as any ?? {};
      const schedBlocos = Array.isArray(smc.blocos) && smc.blocos.length > 0 ? smc.blocos as string[] : undefined;
      nodes.push({ id: step.id, type: 'schedulingNode', position: { x, y },
        data: { kind: 'scheduling', label: 'Agendar Call', dia_offset: step.dia_offset, horario: step.horario ?? '09:00',
          duracao: smc.duracao ?? 60, mensagemInicial: smc.mensagemInicial ?? '', blocos: schedBlocos, stepId: step.id, customLabel } satisfies SchedulingNodeData });
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
    else if (isPostCondition) {
      const pcBlocos = Array.isArray(step.media_config?.blocos) && (step.media_config!.blocos as string[]).length > 0
        ? (step.media_config!.blocos as string[])
        : undefined;
      nodes.push({ id: step.id, type: 'postConditionNode', position: { x, y },
        data: { kind: 'post_condition', label: 'Pós-Condição', mensagem: mensagemDisplay, tipo_mensagem: 'texto', blocos: pcBlocos, stepId: step.id, customLabel } satisfies PostConditionNodeData });
    }
    else if (step.tipo_mensagem === 'gerar_cobranca') {
      const gc = step.media_config as any ?? {};
      nodes.push({ id: step.id, type: 'gerarCobrancaNode', position: { x, y },
        data: { kind: 'gerar_cobranca', label: 'Gerar Cobrança', billingType: gc.billingType ?? 'PIX', value: gc.value ?? 0, description: gc.description ?? '', daysUntilDue: gc.daysUntilDue ?? 3, sendWhatsapp: gc.sendWhatsapp ?? true, stepId: step.id, customLabel } satisfies GerarCobrancaNodeData });
    }
    else if (step.tipo_mensagem === 'aguardar_pagamento') {
      const ap = step.media_config as any ?? {};
      nodes.push({ id: step.id, type: 'aguardarPagamentoNode', position: { x, y },
        data: { kind: 'aguardar_pagamento', label: 'Aguardar Pagamento', timeoutDays: ap.timeoutDays ?? 7, stepId: step.id, customLabel } satisfies AguardarPagamentoNodeData });
    }
    else if (isWait) nodes.push({ id: step.id, type: 'waitNode', position: { x, y }, data: { kind: 'wait', label: 'Aguardar', dia_offset: step.dia_offset, stepId: step.id, customLabel } satisfies WaitNodeData });
    else {
      // anti_noshow sempre usa AntiNoshowOffsetPicker, que só trabalha em
      // minutos (ver onChange dele) : default correto é 'minutes', não
      // 'hours' (achado ao vivo, 2026-09-04, causava reinterpretação errada
      // de dia_offset em minuto pra dia_offset em hora depois de recarregar).
      const offset_unit: 'days' | 'hours' | 'minutes' = (step.media_config as any)?.offset_unit ?? (sequenceTipo === 'anti_noshow' ? 'minutes' : 'days');
      nodes.push({ id: step.id, type: 'messageNode', position: { x, y }, data: { kind: 'message', label: 'Mensagem', dia_offset: step.dia_offset, horario: step.horario, mensagem: mensagemDisplay, tipo_mensagem: tipoCanvas, stepId: step.id, media_url, media_name, location_url, location_name, location_address, menu_choices, carousel_json, metaTemplateId, metaTemplateBodyParams, blocos, customLabel, sdr_ativo: step.sdr_ativo ?? null, offset_unit } satisfies MessageNodeData });
    }
  });
  return nodes;
}

function stepsToEdges(steps: FollowStep[] | undefined | null, canvasConfig?: CanvasConfig | null): Edge[] {
  const sorted = [...(steps ?? [])].sort((a, b) => a.ordem - b.ordem);

  function idxToNodeId(idx: number): string | undefined {
    if (idx === -1) return 'trigger';
    if (idx < -1) return canvasConfig?.extraTriggers?.[Math.abs(idx) - 2]?.id;
    return sorted[idx]?.id;
  }

  if (canvasConfig?.edges?.length) {
    return canvasConfig.edges
      .map((e, i) => {
        const src = idxToNodeId(e.sourceIdx);
        const tgt = idxToNodeId(e.targetIdx);
        const sourceStep = e.sourceIdx >= 0 ? sorted[e.sourceIdx] ?? null : null;
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
  return nodes.filter((n) => n.data.kind !== 'trigger').sort((a, b) => a.position.x - b.position.x).map((node, idx) => {
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
      } else if (d.tipo_mensagem === 'botoes' && d.metaTemplateId) {
        media_config = { menuType: 'button', metaTemplateId: d.metaTemplateId, metaTemplateBodyParams: d.metaTemplateBodyParams };
      } else if (d.tipo_mensagem === 'botoes') {
        const buttons = parseButtons(d.menu_choices ?? '');
        media_config = {
          menuType: 'button',
          choices: buttons.map(b => b.label),   // only labels sent to uazapi
          buttons,                               // full metadata for roundtrip
          text: d.mensagem || undefined,
        };
      } else if (d.tipo_mensagem === 'lista' && d.metaTemplateId) {
        media_config = { menuType: 'list', metaTemplateId: d.metaTemplateId, metaTemplateBodyParams: d.metaTemplateBodyParams };
      } else if (d.tipo_mensagem === 'lista') {
        const sections = parseLista(d.menu_choices ?? '');
        const choices = sections.flatMap(s => s.items.map(i => i.label)).filter(Boolean);
        media_config = { menuType: 'list', choices, sections, text: d.mensagem || undefined };
      } else if (d.tipo_mensagem === 'carrossel' && d.metaTemplateId) {
        media_config = { metaTemplateId: d.metaTemplateId, metaTemplateBodyParams: d.metaTemplateBodyParams };
      } else if (d.tipo_mensagem === 'carrossel') {
        let carousel: unknown[] = [];
        try { carousel = JSON.parse(String(d.carousel_json ?? '[]')); } catch { /* invalid json */ }
        media_config = { carousel, text: d.mensagem || undefined };
      } else if (d.media_url) {
        media_config = { file: d.media_url, text: d.mensagem || undefined, docName: d.media_name || undefined };
      }

      // When using blocos, first block becomes mensagem for backwards compat with executors
      const mensagemFinal = d.blocos && d.blocos.length > 0 ? (d.blocos[0] || null) : (d.mensagem || null);
      // Achado ao vivo (2026-09-04) : só persistia offset_unit quando era
      // 'hours' exatamente, então 'minutes' (o que o AntiNoshowOffsetPicker
      // sempre usa) era descartado no salvamento — ao recarregar, o loader
      // não achava a tag e caía no default errado ('hours'), reinterpretando
      // minutos como se fossem horas. Persiste qualquer unit não-default agora.
      const finalMediaConfig = (d.offset_unit === 'hours' || d.offset_unit === 'minutes')
        ? { ...(media_config ?? {}), offset_unit: d.offset_unit }
        : media_config;
      return { id: stepId, dia_offset: d.dia_offset, horario: d.offset_unit === 'hours' ? '00:00' : d.horario, mensagem: mensagemFinal, tipo_mensagem: tipoDb, ordem: idx + 1, condicao: '', media_config: finalMediaConfig,
        sdr_ativo: d.sdr_ativo ?? null };
    }
    if (d.kind === 'wait') return { id: stepId, dia_offset: d.dia_offset, horario: '00:00', mensagem: null, tipo_mensagem: 'aguardar', ordem: idx + 1, condicao: '' };
    if (d.kind === 'condition') {
      const isCustomVar = d.variavel === 'custom';
      return { id: stepId, dia_offset: 0, horario: '00:00', mensagem: null, tipo_mensagem: 'condicao', ordem: idx + 1,
        condicao: null, // null passes the DB CHECK constraint: tipo_mensagem='condicao' já identifica o node
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
      const primeiroBloco = sd.blocos && sd.blocos.length > 0 ? sd.blocos[0] : (sd.mensagemInicial || undefined);
      return { id: stepId, dia_offset: sd.dia_offset ?? 0, horario: sd.horario ?? '09:00', mensagem: null, tipo_mensagem: 'agendamento', ordem: idx + 1, condicao: '',
        media_config: {
          duracao: sd.duracao ?? 60,
          ...(primeiroBloco ? { mensagemInicial: primeiroBloco } : {}),
          ...(sd.blocos && sd.blocos.length > 1 ? { blocos: sd.blocos } : {}),
        } };
    }
    if (d.kind === 'post_condition') {
      const pd = d as PostConditionNodeData;
      const mensagemFinal = pd.blocos && pd.blocos.length > 0 ? (pd.blocos[0] || null) : (pd.mensagem || null);
      return { id: stepId, dia_offset: 0, horario: '00:00', mensagem: mensagemFinal, tipo_mensagem: 'pos_condicao' as any, ordem: idx + 1, condicao: '',
        media_config: pd.blocos && pd.blocos.length > 0 ? { blocos: pd.blocos } : null };
    }
    if (d.kind === 'goal') {
      const gd = d as GoalNodeData;
      return { id: stepId, dia_offset: 0, horario: '00:00', mensagem: null, tipo_mensagem: 'goal', ordem: idx + 1, condicao: gd.marcarStatus || 'Convertido' };
    }
    if (d.kind === 'sentiment') {
      return { id: stepId, dia_offset: 0, horario: '00:00', mensagem: null, tipo_mensagem: 'sentiment', ordem: idx + 1, condicao: '' };
    }
    if (d.kind === 'wait_event') {
      const wd = d as WaitEventNodeData;
      return { id: stepId, dia_offset: 0, horario: '00:00', mensagem: null, tipo_mensagem: 'wait_event' as any, ordem: idx + 1, condicao: '',
        media_config: { event: wd.event ?? 'reply', ...(wd.pattern ? { pattern: wd.pattern } : {}) } };
    }
    if (d.kind === 'sub_flow') {
      const sd = d as SubFlowNodeData;
      return { id: stepId, dia_offset: 0, horario: '00:00', mensagem: null, tipo_mensagem: 'sub_flow' as any, ordem: idx + 1, condicao: '',
        media_config: { subSequenceId: sd.subSequenceId, subSequenceName: sd.subSequenceName ?? '' } };
    }
    if (d.kind === 'gerar_cobranca') {
      const gc = d as GerarCobrancaNodeData;
      return { id: stepId, dia_offset: 0, horario: '00:00', mensagem: null, tipo_mensagem: 'gerar_cobranca' as any, ordem: idx + 1, condicao: '',
        media_config: { billingType: gc.billingType, value: gc.value ?? 0, description: gc.description ?? '', daysUntilDue: gc.daysUntilDue ?? 3, sendWhatsapp: gc.sendWhatsapp ?? true } };
    }
    if (d.kind === 'aguardar_pagamento') {
      const ap = d as AguardarPagamentoNodeData;
      return { id: stepId, dia_offset: 0, horario: '00:00', mensagem: null, tipo_mensagem: 'aguardar_pagamento' as any, ordem: idx + 1, condicao: '',
        media_config: { timeoutDays: ap.timeoutDays ?? 7 } };
    }
    return { id: stepId, dia_offset: 0, horario: '00:00', mensagem: null, tipo_mensagem: 'fim', ordem: idx + 1, condicao: '' };
  });
}

let nodeCounter = 1000;
function newId() { return `new-${++nodeCounter}`; }

// ─── Node Accent System ─────────────────────────────────────────────────────────

const ACCENTS = {
  primary:     { icon: 'text-[#01573C] dark:text-[#96F63C]', box: 'bg-[#01573C]/10 dark:bg-[#96F63C]/[0.14]' },
  emerald:     { icon: 'text-[#01573C] dark:text-[#96F63C]', box: 'bg-[#01573C]/10 dark:bg-[#96F63C]/[0.14]' },
  amber:       { icon: 'text-[#B7791F] dark:text-[#F5B544]', box: 'bg-[#F5B544]/20 dark:bg-[#F5B544]/[0.14]' },
  violet:      { icon: 'text-violet-600 dark:text-[#A5A3F5]', box: 'bg-violet-500/10 dark:bg-[#A5A3F5]/[0.14]' },
  destructive: { icon: 'text-destructive',                    box: 'bg-destructive/10' },
  blue:        { icon: 'text-blue-600 dark:text-[#60A5FA]',   box: 'bg-blue-500/10 dark:bg-[#60A5FA]/[0.14]' },
  cyan:        { icon: 'text-cyan-600 dark:text-[#67E8F9]',   box: 'bg-cyan-500/10 dark:bg-[#67E8F9]/[0.14]' },
  rose:        { icon: 'text-rose-600 dark:text-[#FB7185]',   box: 'bg-rose-500/10 dark:bg-[#FB7185]/[0.14]' },
} as const;
type AccentKey = keyof typeof ACCENTS;

// Ações do cartão selecionado (testar, duplicar, excluir): o canvas fornece, o cartão só chama
interface CanvasActions { testNode: (id: string) => void; duplicateNode: (id: string) => void; deleteNode: (id: string) => void; openPalette: () => void }
const CanvasActionsCtx = createContext<CanvasActions | null>(null);
const TESTABLE_KINDS = ['message', 'post_condition', 'scheduling'];

function NodeToolbar({ id }: { id: string }) {
  const actions = useContext(CanvasActionsCtx);
  const kind = useStore((s) => (s.nodeLookup.get(id)?.data as { kind?: string } | undefined)?.kind);
  if (!actions) return null;
  const btn = 'flex h-6 w-6 items-center justify-center rounded-md text-foreground transition-colors hover:bg-muted';
  return (
    <div className="nodrag nopan absolute -top-[52px] left-1/2 z-20 flex h-[38px] -translate-x-1/2 items-center justify-around gap-1 rounded-full border border-border bg-card px-3 shadow-lg dark:border-[#2E2E2E] dark:bg-[#1A1A1A]">
      {kind && TESTABLE_KINDS.includes(kind) && (
        <button type="button" title="Testar este passo" aria-label="Testar este passo" onClick={(e) => { e.stopPropagation(); actions.testNode(id); }} className={btn}><Play className="h-4 w-4" fill="currentColor" /></button>
      )}
      <button type="button" title="Duplicar" aria-label="Duplicar passo" onClick={(e) => { e.stopPropagation(); actions.duplicateNode(id); }} className={btn}><Copy className="h-4 w-4" /></button>
      {kind !== 'trigger' && (
        <button type="button" title="Excluir" aria-label="Excluir passo" onClick={(e) => { e.stopPropagation(); actions.deleteNode(id); }} className={cn(btn, 'text-destructive hover:bg-destructive/10')}><Trash2 className="h-4 w-4" /></button>
      )}
    </div>
  );
}

// ─── Node building blocks ───────────────────────────────────────────────────────

// Exec state overlay badge: n8n style
function ExecBadge({ state, error }: { state?: ExecState; error?: string }) {
  if (!state || state === 'idle') return null;
  if (state === 'running') {
    return (
      <div className="absolute -top-3 -right-3 w-7 h-7 rounded-full bg-primary shadow-lg flex items-center justify-center z-10"
        style={{ boxShadow: '0 0 0 2px #01573C40, 0 2px 8px rgba(1,87,60,0.5)' }}>
        <Loader2 className="w-4 h-4 text-white animate-spin" />
      </div>
    );
  }
  if (state === 'success') {
    return (
      <div className="absolute -top-3 -right-3 w-7 h-7 rounded-full bg-emerald-500 shadow-lg flex items-center justify-center z-10"
        style={{ boxShadow: '0 0 0 2px #10b98140, 0 2px 8px rgba(16,185,129,0.4)' }}>
        <CheckCircle2 className="w-4 h-4 text-white" />
      </div>
    );
  }
  if (state === 'error') {
    return (
      <div className="absolute -top-3 -right-3 z-10 group">
        <div className="w-7 h-7 rounded-full bg-destructive shadow-lg flex items-center justify-center cursor-default"
          style={{ boxShadow: '0 0 0 2px #ef444440, 0 2px 8px rgba(239,68,68,0.4)' }}>
          <X className="w-4 h-4 text-white" />
        </div>
        {error && (
          <div className="absolute right-0 top-8 z-20 w-56 bg-popover text-destructive text-[10px] leading-snug px-2.5 py-2 rounded-lg shadow-xl border border-border pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-150">
            {error}
          </div>
        )}
      </div>
    );
  }
  if (state === 'skipped') {
    return (
      <div className="absolute -top-3 -right-3 w-7 h-7 rounded-full bg-muted-foreground/60 shadow-md flex items-center justify-center z-10">
        <span className="text-[11px] text-white font-bold leading-none">⏭</span>
      </div>
    );
  }
  return null;
}

function NodeShell({ children, selected, accent = 'primary', header, execState, execError, leadCount, dlqCount, comment, compact, fixedH, minH }: {
  children: React.ReactNode;
  selected?: boolean;
  accent?: AccentKey;
  header?: React.ReactNode;
  execState?: ExecState;
  execError?: string;
  leadCount?: number;
  dlqCount?: number;
  comment?: string;
  compact?: boolean;
  fixedH?: boolean;
  minH?: number;
}) {
  const nodeId = useNodeId();
  const isRunning = execState === 'running';
  const isSuccess = execState === 'success';
  const isError = execState === 'error';
  const isSkipped = execState === 'skipped';
  const hasDlq = (dlqCount ?? 0) > 0;
  void accent;
  void leadCount;
  return (
    <div style={minH ? { minHeight: minH } : undefined} className={cn(
      'relative rounded-2xl border-[1.5px] bg-card transition-all duration-100 dark:bg-[#141414]',
      compact ? 'h-[84px] w-[200px] px-4' : 'w-[208px] p-4',
      fixedH && 'h-[168px]',
      isSkipped && 'opacity-40',
      isRunning ? 'node-running border-border'
        : isSuccess ? 'node-success border-border'
        : isError ? 'node-error border-border'
        : hasDlq ? 'border-destructive/40 ring-1 ring-destructive/20'
        : selected
          ? 'border-[#01573C] shadow-[0_0_0_4px_rgba(1,87,60,0.12)] dark:border-[#96F63C] dark:shadow-[0_0_0_4px_rgba(150,246,60,0.10)]'
          : 'border-border hover:border-muted-foreground/40 dark:border-[#2E2E2E] dark:hover:border-[#3E3E3E]',
    )}>
      {selected && nodeId && <NodeToolbar id={nodeId} />}
      {hasDlq && (
        <div className="absolute -top-2 -right-2 z-10 px-1.5 py-0.5 rounded-full bg-destructive text-destructive-foreground text-[9px] font-bold leading-none shadow-sm">
          DLQ {dlqCount}
        </div>
      )}
      <ExecBadge state={execState} error={execError} />
      <div className={cn('flex flex-col gap-3', (compact || fixedH) && 'h-full', compact && 'justify-center')}>
        {header}
        {children && <div className={cn('flex flex-col gap-1.5', fixedH && 'min-h-0 flex-1')}>{children}</div>}
        {comment && (
          <div className="flex items-start gap-1.5 border-t border-border pt-2">
            <MessageSquare className="mt-px h-2.5 w-2.5 shrink-0 text-amber-500/70" />
            <span className="line-clamp-2 text-[10px] leading-snug text-muted-foreground">{comment}</span>
          </div>
        )}
      </div>
    </div>
  );
}

function NodeHeader({ icon: Icon, label, accent = 'primary', meta, nodeId, customLabel, index, sublabel, large }: {
  icon: React.ElementType; label: string; accent?: AccentKey; meta?: string;
  nodeId?: string; customLabel?: string; index?: number; sublabel?: string; large?: boolean;
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

  const title = customLabel || (index ? `${label} ${index}` : label);

  return (
    <div className={cn('flex items-center', large ? 'gap-3' : 'gap-2.5')} onDoubleClick={startEdit}>
      <div className={cn('flex shrink-0 items-center justify-center', large ? 'h-11 w-11 rounded-xl' : 'h-[34px] w-[34px] rounded-[10px]', acc.box)}>
        <Icon className={cn(large ? 'h-[22px] w-[22px]' : 'h-[18px] w-[18px]', acc.icon)} />
      </div>
      <div className="min-w-0 flex-1">
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
            placeholder={title}
            className="w-full min-w-0 rounded-md border border-[#01573C]/40 bg-muted px-1.5 py-0.5 text-sm font-semibold text-foreground outline-none dark:border-[#96F63C]/40"
          />
        ) : (
          <>
            {sublabel && <p className="truncate text-xs leading-4 text-muted-foreground">{sublabel}</p>}
            <p className={cn('text-sm font-semibold leading-[18px] text-foreground', large ? 'line-clamp-2' : 'truncate')}>{title}</p>
            {meta && <p className="truncate text-xs leading-4 text-muted-foreground">{meta}</p>}
          </>
        )}
      </div>
    </div>
  );
}

const HANDLE_CLS = '!h-3 !w-3 !rounded-full !border-2 !border-[#B5BDB8] !bg-background dark:!border-[#7A7A7A] dark:!bg-[#0B0B0B] !transition-colors hover:!border-[#01573C] dark:hover:!border-[#96F63C]';

// ─── Node Components ────────────────────────────────────────────────────────────

const BARS = [3, 7, 5, 12, 8, 14, 4, 10, 6, 13, 7, 9, 4, 11, 5];

const PAYMENT_PLATFORM_LABELS: Record<string, { label: string; color: string }> = {
  mercadopago: { label: 'Mercado Pago', color: 'text-[#009EE3]' },
  kiwify:      { label: 'Kiwify',       color: 'text-[#2db56f]' },
  asaas:       { label: 'Asaas',        color: 'text-[#00AEEF]' },
};

const ASAAS_EVENT_LABELS: Record<string, string> = {
  asaas_pago:            'Pagamento confirmado',
  asaas_boleto_gerado:   'Boleto gerado',
  asaas_boleto_vencido:  'Boleto vencido',
};

const TRIGGER_TITLES: Record<string, string> = {
  novo_lead: 'Novo lead',
  mudanca_status: 'Mudança de status',
  webhook: 'Webhook',
  preco_informado: 'Preço informado',
  formulario_preenchido: 'Formulário preenchido',
  call_realizada: 'Call realizada',
  tag_follow_up: 'Etiqueta Follow up',
  tag_no_show: 'Etiqueta No-show',
  tag_promocao: 'Etiqueta Promoção',
};

const MESSAGE_TYPE_LABELS: Record<string, string> = {
  texto: 'Texto', audio: 'Áudio', ptt: 'Áudio', imagem: 'Imagem', video: 'Vídeo', documento: 'Documento',
  localizacao: 'Localização', lista: 'Lista', botoes: 'Botões', carrossel: 'Carrossel', sticker: 'Sticker',
};

const PREVIEW_BOX = 'min-h-0 flex-1 overflow-hidden rounded-[10px] bg-muted px-3 py-2 text-[13px] leading-[145%] text-foreground dark:bg-[#1E1E1E]';

function TriggerNode({ id, data, selected }: NodeProps) {
  const d = data as TriggerNodeData;
  const platformInfo = d.platform ? PAYMENT_PLATFORM_LABELS[d.platform] : null;
  const asaasEventLabel = d.platform === 'asaas' && d.eventoEntrada ? ASAAS_EVENT_LABELS[d.eventoEntrada] : null;
  const title = (d.eventoEntrada && TRIGGER_TITLES[d.eventoEntrada]) || d.label;
  return (
    <NodeShell selected={selected} accent="amber" compact
      header={<NodeHeader icon={Zap} label={title} sublabel="Gatilho" accent="amber" nodeId={id} customLabel={d.customLabel} large />}
      execState={d._execState} execError={d._execError} leadCount={d._leadCount}>
      <Handle type="source" position={Position.Right} className={HANDLE_CLS} />
      {platformInfo ? (
        <>
          <p className={`text-xs font-medium ${platformInfo.color}`}>{platformInfo.label}</p>
          {asaasEventLabel && <p className="text-xs text-muted-foreground">{asaasEventLabel}</p>}
        </>
      ) : null}
    </NodeShell>
  );
}

function MessageNode({ id, data, selected }: NodeProps) {
  const d = data as MessageNodeData & { _msgIndex?: number };
  const typeLabel = MESSAGE_TYPE_LABELS[d.tipo_mensagem] ?? 'Mensagem';
  const when = (d.offset_unit === 'hours' || d.offset_unit === 'minutes')
    ? formatHorasOffset(offsetToMins(d.dia_offset, d.offset_unit))
    : `Dia ${d.dia_offset}`;
  const meta = `${when} · ${typeLabel}`;

  const docExt = d.media_name
    ? d.media_name.split('.').pop()?.toUpperCase() ?? 'DOC'
    : d.media_url
    ? (d.media_url.split('.').pop()?.split('?')[0]?.toUpperCase() ?? 'DOC')
    : 'DOC';

  // Blocks preview: use blocos[] if set, otherwise fall back to single mensagem
  const hasBlocos = d.blocos && d.blocos.length > 0;

  const failedCount = d._failedCount ?? 0;
  const dlqCount = d._dlqCount ?? 0;
  const showFunnel = (failedCount + dlqCount) > 0;
  const hint = 'flex items-center gap-2 py-1 text-xs text-muted-foreground';

  return (
    <NodeShell selected={selected} accent="emerald" fixedH
      header={<NodeHeader icon={(d.tipo_mensagem === 'audio' || d.tipo_mensagem === 'ptt') ? Mic : MessageSquare} label="Mensagem" index={d._msgIndex} accent="emerald" meta={meta} nodeId={id} customLabel={d.customLabel} />}
      execState={d._execState} execError={d._execError} leadCount={d._leadCount} dlqCount={dlqCount}
      comment={(d as any).comment as string | undefined}>
      <Handle type="target" position={Position.Left} className={HANDLE_CLS} />
      <Handle type="source" position={Position.Right} className={HANDLE_CLS} />

      {d.uploading && (
        <div className={cn(PREVIEW_BOX, 'flex items-center gap-2')}>
          {[0, 1, 2].map((i) => (
            <div key={i} className="w-1 rounded-full bg-[#01573C] dark:bg-[#96F63C] animate-bounce"
              style={{ height: `${6 + i * 4}px`, animationDelay: `${i * 0.12}s` }} />
          ))}
          <span className="text-xs text-muted-foreground">Enviando…</span>
        </div>
      )}

      {!d.uploading && d.tipo_mensagem === 'texto' && (
        hasBlocos ? (
          <div className={cn(PREVIEW_BOX, 'space-y-1.5')}>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{(d.blocos as string[]).length} mensagens</p>
            <p className="line-clamp-3">{(d.blocos as string[])[0] || <span className="italic text-muted-foreground">Sem conteúdo</span>}</p>
          </div>
        ) : d.mensagem
          ? <p className={cn(PREVIEW_BOX, 'line-clamp-4')}>{d.mensagem}</p>
          : <p className={cn(PREVIEW_BOX, 'italic text-muted-foreground')}>Sem mensagem</p>
      )}

      {!d.uploading && d.tipo_mensagem === 'imagem' && (
        d.media_url ? (
          <div className={cn(PREVIEW_BOX, 'flex items-start gap-2.5')}>
            <img src={d.media_url} alt="" className="h-12 w-12 shrink-0 rounded-lg border border-border object-cover" />
            <p className="line-clamp-3 min-w-0 flex-1 text-xs">{d.mensagem || <span className="italic text-muted-foreground">Sem legenda</span>}</p>
          </div>
        ) : (
          <div className={cn(PREVIEW_BOX, hint)}><ImageIcon className="h-3.5 w-3.5" />Adicionar imagem</div>
        )
      )}

      {!d.uploading && d.tipo_mensagem === 'video' && (
        d.media_url ? (
          <div className={cn(PREVIEW_BOX, 'flex items-start gap-2.5')}>
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-border bg-zinc-800">
              <Play className="ml-0.5 h-4 w-4 text-white/70" fill="currentColor" />
            </div>
            <p className="line-clamp-3 min-w-0 flex-1 text-xs">{d.mensagem || <span className="italic text-muted-foreground">Sem legenda</span>}</p>
          </div>
        ) : (
          <div className={cn(PREVIEW_BOX, hint)}><Video className="h-3.5 w-3.5" />Adicionar vídeo</div>
        )
      )}

      {!d.uploading && (d.tipo_mensagem === 'audio' || d.tipo_mensagem === 'ptt') && (
        d.media_url ? (
          d.mensagem ? (
            <p className={cn(PREVIEW_BOX, 'line-clamp-4')}>{d.mensagem}</p>
          ) : (
            <div className={cn(PREVIEW_BOX, 'flex items-center gap-2.5')}>
              <div className="flex flex-1 items-end gap-px" style={{ height: 16 }}>
                {BARS.map((h, i) => (
                  <div key={i} className="flex-1 rounded-full bg-[#01573C]/50 dark:bg-[#96F63C]/50" style={{ height: `${h}px` }} />
                ))}
              </div>
              <span className="font-mono text-[10px] text-muted-foreground">Voz</span>
            </div>
          )
        ) : (
          <div className={cn(PREVIEW_BOX, hint)}><Mic className="h-3.5 w-3.5" />Gravar áudio</div>
        )
      )}

      {!d.uploading && d.tipo_mensagem === 'documento' && (
        d.media_url ? (
          <div className={cn(PREVIEW_BOX, 'flex items-center gap-2.5')}>
            <FileText className="h-4 w-4 shrink-0 text-amber-500" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium">{d.media_name || 'documento.' + docExt.toLowerCase()}</p>
              <p className="text-[10px] text-muted-foreground">{docExt}</p>
            </div>
          </div>
        ) : (
          <div className={cn(PREVIEW_BOX, hint)}><FileText className="h-3.5 w-3.5" />Adicionar documento</div>
        )
      )}

      {!d.uploading && d.tipo_mensagem === 'localizacao' && (
        <div className={cn(PREVIEW_BOX, 'flex items-center gap-2.5')}>
          <MapPin className="h-4 w-4 shrink-0 text-[#01573C] dark:text-[#96F63C]" />
          <div className="min-w-0 flex-1">
            {d.location_name
              ? <p className="truncate text-xs font-medium">{d.location_name as string}</p>
              : <p className="text-xs italic text-muted-foreground">{d.location_url ? 'Local configurado' : 'Local não configurado'}</p>}
            {d.location_address && <p className="truncate text-[10px] text-muted-foreground">{d.location_address as string}</p>}
          </div>
        </div>
      )}

      {!d.uploading && d.tipo_mensagem === 'lista' && (
        <div className={cn(PREVIEW_BOX, 'space-y-1.5')}>
          {d.mensagem && <p className="line-clamp-2 text-xs">{d.mensagem}</p>}
          <div className="flex items-center gap-1.5">
            <List className="h-3 w-3 shrink-0 text-muted-foreground" />
            <span className="text-[10px] text-muted-foreground">
              {d.metaTemplateId
                ? 'Template HSM selecionado'
                : d.menu_choices
                  ? `${(d.menu_choices as string).split('\n').filter(Boolean).length} itens`
                  : 'Lista não configurada'}
            </span>
          </div>
        </div>
      )}

      {!d.uploading && d.tipo_mensagem === 'botoes' && (
        <div className={cn(PREVIEW_BOX, 'space-y-1.5')}>
          {d.mensagem && <p className="line-clamp-2 text-xs">{d.mensagem}</p>}
          <div className="flex flex-wrap gap-1">
            {d.metaTemplateId
              ? <span className="rounded-full border border-[#01573C]/30 bg-[#01573C]/10 px-2 py-0.5 text-[10px] text-[#01573C] dark:border-[#96F63C]/30 dark:bg-[#96F63C]/10 dark:text-[#96F63C]">Template HSM selecionado</span>
              : d.menu_choices
                ? (d.menu_choices as string).split('\n').filter(Boolean).slice(0, 3).map((btn, i) => (
                    <span key={i} className="rounded-full border border-border px-2 py-0.5 text-[10px] text-muted-foreground">
                      {String(btn).split('|')[0].trim()}
                    </span>
                  ))
                : <span className="text-[10px] italic text-muted-foreground">Botões não configurados</span>}
          </div>
        </div>
      )}

      {!d.uploading && d.tipo_mensagem === 'carrossel' && (
        <div className={cn(PREVIEW_BOX, 'space-y-1.5')}>
          {d.mensagem && <p className="line-clamp-1 text-xs">{d.mensagem}</p>}
          <div className="flex items-center gap-1.5">
            <GalleryHorizontal className="h-3 w-3 shrink-0 text-muted-foreground" />
            <span className="text-[10px] text-muted-foreground">
              {d.metaTemplateId
                ? 'Template HSM selecionado'
                : d.carousel_json
                  ? (() => { try { return `${(JSON.parse(d.carousel_json as string) as unknown[]).length} cards`; } catch { return 'Carrossel'; } })()
                  : 'Carrossel não configurado'}
            </span>
          </div>
        </div>
      )}

      {!d.uploading && d.tipo_mensagem === 'sticker' && (
        d.media_url ? (
          <div className={cn(PREVIEW_BOX, 'flex items-center gap-2.5')}>
            <img src={d.media_url as string} alt="sticker" className="h-12 w-12 shrink-0 rounded-lg border border-border bg-muted object-contain" />
            <span className="text-[10px] text-muted-foreground">Sticker</span>
          </div>
        ) : (
          <div className={cn(PREVIEW_BOX, hint)}><Smile className="h-3.5 w-3.5" />Adicionar sticker</div>
        )
      )}

      {showFunnel && (
        <div className="flex items-center gap-2 border-t border-border pt-1.5">
          {failedCount > 0 && <span className="text-[10px] font-semibold text-amber-500">⚠{failedCount}</span>}
          {dlqCount > 0 && <span className="text-[10px] font-bold text-destructive">DLQ·{dlqCount}</span>}
        </div>
      )}

    </NodeShell>
  );
}

const BRANCH_TONES = {
  green: { text: 'text-[#16A34A] dark:text-[#5FD98A]', handle: '!h-3 !w-3 !rounded-full !border-2 !border-card !bg-[#16A34A] dark:!border-[#0B0B0B] dark:!bg-[#5FD98A]' },
  red: { text: 'text-[#DC2626] dark:text-[#F0736D]', handle: '!h-3 !w-3 !rounded-full !border-2 !border-card !bg-[#DC2626] dark:!border-[#0B0B0B] dark:!bg-[#F0736D]' },
  gray: { text: 'text-muted-foreground', handle: HANDLE_CLS },
} as const;

// Saídas de um passo que decide: rótulo à direita e ponto de ligação alinhado a ele
function BranchOutputs({ rows, first }: { rows: { id: string; label: string; tone: keyof typeof BRANCH_TONES }[]; first: number }) {
  return (
    <>
      {rows.map((r, i) => {
        const top = first + i * 36;
        return (
          <span key={r.id} className="contents">
            <span style={{ top }} className={cn('pointer-events-none absolute right-4 -translate-y-1/2 text-[13px] font-semibold leading-4', BRANCH_TONES[r.tone].text)}>{r.label}</span>
            <Handle id={r.id} type="source" position={Position.Right} style={{ top }} className={BRANCH_TONES[r.tone].handle} />
          </span>
        );
      })}
    </>
  );
}

function WaitNode({ id, data, selected }: NodeProps) {
  const d = data as WaitNodeData;
  return (
    <NodeShell selected={selected} accent="amber"
      header={<NodeHeader icon={Clock} label="Aguardar" meta={`${d.dia_offset} ${d.dia_offset === 1 ? 'dia' : 'dias'} antes da próxima`} accent="amber" nodeId={id} customLabel={d.customLabel} />}
      execState={d._execState} execError={d._execError} comment={(d as any).comment as string | undefined}>
      <Handle type="target" position={Position.Left} className={HANDLE_CLS} />
      <Handle type="source" position={Position.Right} className={HANDLE_CLS} />
    </NodeShell>
  );
}

function ConditionNode({ id, data, selected }: NodeProps) {
  const d = data as ConditionNodeData;
  const opLabel: Record<string, string> = { eq: '==', contains: 'contém', starts_with: 'começa', not_empty: '≠ vazio' };
  const condExpr = d.variavel && d.valor != null && d.valor !== ''
    ? `${d.variavel} ${opLabel[d.operador ?? 'eq'] ?? '=='} "${d.valor}"`
    : (d.condicao || 'Respondeu?');
  return (
    <NodeShell selected={selected} accent="violet" minH={128}
      header={<NodeHeader icon={GitBranch} label="Condição" meta={condExpr} accent="violet" nodeId={id} customLabel={d.customLabel} />}
      execState={d._execState} execError={d._execError} comment={(d as any).comment as string | undefined}>
      <Handle type="target" position={Position.Left} className={HANDLE_CLS} />
      <BranchOutputs first={61} rows={[{ id: 'sim', label: 'Sim', tone: 'green' }, { id: 'nao', label: 'Não', tone: 'red' }]} />
    </NodeShell>
  );
}

function EndNode({ id, data, selected }: NodeProps) {
  const d = data as EndNodeData;
  return (
    <NodeShell selected={selected} accent="destructive"
      header={<NodeHeader icon={XCircle} label="Encerrar" meta="Fim para este lead" accent="destructive" nodeId={id} customLabel={d.customLabel} />}
      execState={d._execState} execError={d._execError}>
      <Handle type="target" position={Position.Left} className={HANDLE_CLS} />
    </NodeShell>
  );
}

function GoalNode({ id, data, selected }: NodeProps) {
  const d = data as GoalNodeData;
  return (
    <NodeShell selected={selected} accent="emerald"
      header={<NodeHeader icon={Target} label="Meta" meta={d.marcarStatus ? `Marca como ${d.marcarStatus}` : 'Marca como Convertido'} accent="emerald" nodeId={id} customLabel={d.customLabel} />}
      execState={d._execState} execError={d._execError} comment={(d as any).comment as string | undefined}>
      <Handle type="target" position={Position.Left} className={HANDLE_CLS} />
    </NodeShell>
  );
}

function SentimentNode({ id, data, selected }: NodeProps) {
  const d = data as SentimentNodeData;
  return (
    <NodeShell selected={selected} accent="violet" minH={168}
      header={<NodeHeader icon={Smile} label="Sentimento" meta="Lê o tom da resposta" accent="violet" nodeId={id} customLabel={d.customLabel} />}
      execState={d._execState} execError={d._execError} comment={(d as any).comment as string | undefined}>
      <Handle type="target" position={Position.Left} className={HANDLE_CLS} />
      <BranchOutputs first={69} rows={[{ id: 'positivo', label: 'Positivo', tone: 'green' }, { id: 'neutro', label: 'Neutro', tone: 'gray' }, { id: 'negativo', label: 'Negativo', tone: 'red' }]} />
    </NodeShell>
  );
}

function WaitEventNode({ id, data, selected }: NodeProps) {
  const d = data as WaitEventNodeData;
  return (
    <NodeShell selected={selected} accent="cyan"
      header={<NodeHeader icon={Bell} label="Aguardar Evento" accent="cyan" nodeId={id} customLabel={d.customLabel} />}
      execState={d._execState} execError={d._execError} comment={d.comment}>
      <Handle type="target" position={Position.Left} className={HANDLE_CLS} />
      <Handle type="source" position={Position.Right} className={HANDLE_CLS} />
      <p className="text-xs leading-snug">
        {d.event === 'keyword' && d.pattern
          ? <><span className="font-semibold text-cyan-500">"{d.pattern}"</span><span className="text-foreground/70"> na resposta</span></>
          : <span className="text-muted-foreground/70">Qualquer resposta do lead</span>}
      </p>
      <p className="text-[10px] text-muted-foreground/60 mt-0.5">Aguarda antes de continuar o fluxo</p>
    </NodeShell>
  );
}

function SubFlowNode({ id, data, selected }: NodeProps) {
  const d = data as SubFlowNodeData;
  return (
    <NodeShell selected={selected} accent="blue"
      header={<NodeHeader icon={Layers} label="Sub-fluxo" accent="blue" nodeId={id} customLabel={d.customLabel} />}
      execState={d._execState} execError={d._execError} comment={d.comment}>
      <Handle type="target" position={Position.Left} className={HANDLE_CLS} />
      <Handle type="source" position={Position.Right} className={HANDLE_CLS} />
      {d.subSequenceName
        ? <p className="text-xs font-semibold text-blue-500 leading-snug">{d.subSequenceName}</p>
        : <p className="text-xs text-muted-foreground/50 italic">Selecionar sequência…</p>}
      <p className="text-[10px] text-muted-foreground/60 mt-0.5">Enrola lead na sub-sequência</p>
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

function pluralDias(n: number) { return `${n} ${n === 1 ? 'dia' : 'dias'}`; }

// Tempo de espera entre dois passos: sai da diferença entre o "quando enviar" de cada um
function delayLabel(src: { kind?: string; dia_offset?: number; offset_unit?: string } | undefined, tgt: { kind?: string; dia_offset?: number; offset_unit?: string } | undefined): string | undefined {
  if (!src || !tgt || tgt.kind !== 'message') return undefined;
  if (src.kind !== 'trigger' && src.kind !== 'message') return undefined;
  const timed = (x: { offset_unit?: string }) => x.offset_unit === 'hours' || x.offset_unit === 'minutes';
  if (timed(tgt) || (src.kind === 'message' && timed(src))) {
    const toMins = (x: { kind?: string; dia_offset?: number; offset_unit?: string }) => x.kind === 'trigger' ? 0 : (timed(x) ? offsetToMins(x.dia_offset ?? 0, x.offset_unit) : (x.dia_offset ?? 0) * 1440);
    const diff = toMins(tgt) - toMins(src);
    if (src.kind === 'trigger' && tgt.offset_unit === 'minutes') return formatHorasOffset(diff);
    if (diff <= 0) return src.kind === 'trigger' ? 'Agora' : 'Em seguida';
    const h = Math.floor(diff / 60); const m = diff % 60;
    if (h >= 24 && h % 24 === 0 && m === 0) return pluralDias(h / 24);
    return h === 0 ? `${m}min` : m === 0 ? `${h}h` : `${h}h ${m}min`;
  }
  const diff = (tgt.dia_offset ?? 0) - (src.kind === 'trigger' ? 0 : (src.dia_offset ?? 0));
  if (diff <= 0) return src.kind === 'trigger' ? 'Agora' : 'Mesmo dia';
  return pluralDias(diff);
}

function DeletableEdge({ id, source, target, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, style, label, sourceHandleId }: EdgeProps) {
  const { setEdges } = useReactFlow();
  const srcData = useStore((s) => s.nodeLookup.get(source)?.data as { kind?: string; dia_offset?: number; offset_unit?: string } | undefined);
  const tgtData = useStore((s) => s.nodeLookup.get(target)?.data as { kind?: string; dia_offset?: number; offset_unit?: string } | undefined);
  const [edgePath, labelX, labelY] = getSmoothStepPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition, borderRadius: 14 });
  const delay = label ? undefined : delayLabel(srcData, tgtData);
  const branchHandle = sourceHandleId === 'sim' || sourceHandleId === 'nao' || sourceHandleId === 'positivo' || sourceHandleId === 'negativo' || sourceHandleId === 'neutro';
  const text = label && !branchHandle ? String(label) : delay;
  const tone = sourceHandleId === 'sim' || sourceHandleId === 'positivo' ? 'var(--zp-green, #5FD98A)' : sourceHandleId === 'nao' || sourceHandleId === 'negativo' ? 'var(--zp-red, #F0736D)' : undefined;

  return (
    <>
      <BaseEdge id={id} path={edgePath} style={tone ? { ...style, stroke: tone } : style} />
      <EdgeLabelRenderer>
        <div
          style={{ transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`, position: 'absolute', pointerEvents: 'all' }}
          className="nodrag nopan group flex items-center gap-1"
        >
          {text && (
            <span className="flex h-[26px] items-center gap-[5px] rounded-full border border-border bg-card px-3 text-xs font-medium leading-4 text-foreground/80 dark:border-[#2E2E2E] dark:bg-[#141414] dark:text-[#D0D0D0]">
              {delay && <Clock className="h-3 w-3 text-muted-foreground" strokeWidth={2.2} />}
              {text}
            </span>
          )}
          <button
            onClick={() => setEdges((eds) => eds.filter((e) => e.id !== id))}
            title="Remover conexão"
            aria-label="Remover conexão"
            className="flex h-4 w-4 items-center justify-center rounded-full border border-border bg-card text-muted-foreground opacity-0 shadow-sm transition-colors hover:border-destructive/30 hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
          >
            <X className="h-2.5 w-2.5" />
          </button>
        </div>
      </EdgeLabelRenderer>
    </>
  );
}

function SchedulingNode({ id, data, selected }: NodeProps) {
  const d = data as SchedulingNodeData;
  const hasBlocos = d.blocos && (d.blocos as string[]).length > 0;
  const firstText = hasBlocos ? (d.blocos as string[])[0] : d.mensagemInicial;
  return (
    <NodeShell selected={selected} accent="emerald"
      header={<NodeHeader icon={Calendar} label="Agendar call" meta="Marca a reunião" accent="emerald" nodeId={id} customLabel={d.customLabel} />}
      execState={d._execState} execError={d._execError} comment={(d as any).comment as string | undefined}>
      <Handle type="target" position={Position.Left} className={HANDLE_CLS} />
      <Handle type="source" position={Position.Right} className={HANDLE_CLS} />
      {firstText ? (
        <p className="line-clamp-3 rounded-[10px] bg-muted px-3 py-2.5 text-[13px] leading-[145%] text-foreground dark:bg-[#1E1E1E]">{truncate(firstText, 120)}</p>
      ) : null}
    </NodeShell>
  );
}

function PostConditionNode({ id, data, selected }: NodeProps) {
  const d = data as PostConditionNodeData;
  const hasBlocos = d.blocos && (d.blocos as string[]).length > 0;
  const firstText = hasBlocos ? (d.blocos as string[])[0] : d.mensagem;
  return (
    <NodeShell selected={selected} accent="amber"
      header={<NodeHeader icon={Zap} label="Pós-condição" meta={hasBlocos ? `${(d.blocos as string[]).length} mensagens · por interação` : 'Só segue com interação'} accent="amber" nodeId={id} customLabel={d.customLabel} />}
      execState={d._execState} execError={d._execError} comment={(d as any).comment as string | undefined}>
      <Handle type="target" position={Position.Left} className={HANDLE_CLS} />
      <Handle type="source" position={Position.Right} className={HANDLE_CLS} />
      {firstText ? (
        <p className="line-clamp-3 rounded-[10px] bg-muted px-3 py-2.5 text-[13px] leading-[145%] text-foreground dark:bg-[#1E1E1E]">{truncate(firstText, 120)}</p>
      ) : null}
    </NodeShell>
  );
}

function GerarCobrancaNode({ id, data, selected }: NodeProps) {
  const d = data as GerarCobrancaNodeData;
  const billingLabels = { PIX: 'PIX', BOLETO: 'Boleto', CREDIT_CARD: 'Cartão', UNDEFINED: 'Qualquer' };
  return (
    <NodeShell selected={selected} accent="emerald"
      header={<NodeHeader icon={CreditCard} label="Gerar Cobrança" accent="emerald" meta={billingLabels[d.billingType] ?? 'PIX'} nodeId={id} customLabel={d.customLabel} />}
      execState={d._execState} execError={d._execError}>
      <Handle type="target" position={Position.Left} className={HANDLE_CLS} />
      <Handle type="source" position={Position.Right} className={HANDLE_CLS} />
      <div className="flex flex-col gap-1">
        {d.value ? (
          <p className="text-sm font-semibold text-foreground/90">R$ {d.value.toFixed(2).replace('.', ',')}</p>
        ) : (
          <p className="text-xs text-muted-foreground/60 italic">Valor do lead</p>
        )}
        <p className="text-xs text-muted-foreground/70">Vence em {d.daysUntilDue ?? 3}d {d.sendWhatsapp ? '· Envia WA' : ''}</p>
      </div>
    </NodeShell>
  );
}

function AguardarPagamentoNode({ id, data, selected }: NodeProps) {
  const d = data as AguardarPagamentoNodeData;
  return (
    <NodeShell selected={selected} accent="amber"
      header={<NodeHeader icon={Hourglass} label="Aguardar Pagamento" accent="amber" nodeId={id} customLabel={d.customLabel} />}
      execState={d._execState} execError={d._execError}>
      <Handle type="target" position={Position.Left} className={HANDLE_CLS} />
      <Handle id="pago" type="source" position={Position.Top} style={{ left: '75%' }} className="!w-2.5 !h-2.5 !bg-emerald-500/60 !border !border-emerald-500/40 !rounded-full" />
      <Handle id="vencido" type="source" position={Position.Bottom} style={{ left: '75%' }} className="!w-2.5 !h-2.5 !bg-destructive/60 !border !border-destructive/40 !rounded-full" />
      <div className="flex flex-col gap-0.5">
        <p className="text-xs text-foreground/80">Timeout: {d.timeoutDays ?? 7} dias</p>
        <div className="flex gap-3 mt-0.5">
          <span className="text-[10px] text-emerald-500 font-medium">↑ Pago</span>
          <span className="text-[10px] text-destructive/70 font-medium">↓ Vencido</span>
        </div>
      </div>
    </NodeShell>
  );
}

const ADD_NODE_ID = '__add__';
// Passos que não têm uma única saída para continuar a sequência
const NO_CHAIN_KINDS = ['condition', 'switch', 'ab_test', 'sentiment', 'lead_score', 'aguardar_pagamento', 'end', 'goal', 'scheduling'];

function useIsDark() {
  const [dark, setDark] = useState(true);
  useEffect(() => {
    const el = document.documentElement;
    const sync = () => setDark(el.classList.contains('dark'));
    sync();
    const obs = new MutationObserver(sync);
    obs.observe(el, { attributes: true, attributeFilter: ['class'] });
    return () => obs.disconnect();
  }, []);
  return dark;
}

function AddStepNode() {
  const actions = useContext(CanvasActionsCtx);
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); actions?.openPalette(); }}
      aria-label="Adicionar passo"
      title="Adicionar passo"
      className="nodrag nopan relative flex h-8 w-8 items-center justify-center rounded-lg border-[1.5px] border-dashed border-[#B5BDB8] bg-card text-muted-foreground transition-colors hover:border-[#01573C] hover:text-[#01573C] dark:border-[#4A4A4A] dark:bg-[#141414] dark:hover:border-[#96F63C] dark:hover:text-[#96F63C]"
    >
      <Plus className="h-4 w-4" strokeWidth={2.4} />
      <Handle type="target" position={Position.Left} className="!pointer-events-none !h-0 !min-h-0 !w-0 !min-w-0 !border-0 !bg-transparent" />
    </button>
  );
}

const nodeTypes = {
  addNode: AddStepNode,
  triggerNode: TriggerNode,
  messageNode: MessageNode,
  waitNode: WaitNode,
  waitEventNode: WaitEventNode,
  subFlowNode: SubFlowNode,
  conditionNode: ConditionNode,
  switchNode: SwitchNode,
  endNode: EndNode,
  goalNode: GoalNode,
  sentimentNode: SentimentNode,
  webhookNode: WebhookNode,
  leadScoreNode: LeadScoreNode,
  abTestNode: ABTestNode,
  schedulingNode: SchedulingNode,
  postConditionNode: PostConditionNode,
  gerarCobrancaNode: GerarCobrancaNode,
  aguardarPagamentoNode: AguardarPagamentoNode,
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

const TIPO_PRIMARY = ['texto', 'audio', 'imagem', 'video', 'documento'];

function TipoSelector({ value, onChange, onClear }: { value: string; onChange: (v: string) => void; onClear: () => void }) {
  const active = value === 'ptt' ? 'audio' : value;
  const [more, setMore] = useState(() => !TIPO_PRIMARY.includes(active));
  const primary = TIPO_PRIMARY.map((v) => TIPO_OPTIONS.find((o) => o.value === v)!);
  const others = TIPO_OPTIONS.filter((o) => !TIPO_PRIMARY.includes(o.value));
  const showOthers = more || !TIPO_PRIMARY.includes(active);
  const chip = (isActive: boolean) => cn(
    'rounded-full px-3.5 py-1.5 text-[13px] transition-colors',
    isActive ? 'bg-[#0F3D2B] font-semibold text-white' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
  );

  return (
    <div className="flex flex-wrap items-center gap-x-1 gap-y-2">
      {[...primary, ...(showOthers ? others : [])].map((opt) => (
        <button
          key={opt.value}
          type="button"
          aria-pressed={active === opt.value}
          onClick={() => { if (active !== opt.value) { onChange(opt.value); onClear(); } }}
          className={chip(active === opt.value)}
        >
          {opt.label}
        </button>
      ))}
      {!showOthers && (
        <button type="button" onClick={() => setMore(true)} className={chip(false)}>Mais</button>
      )}
      {showOthers && TIPO_PRIMARY.includes(active) && (
        <button type="button" onClick={() => setMore(false)} className={chip(false)}>Menos</button>
      )}
    </div>
  );
}

// ─── Seletor de Template HSM (canal Meta) ────────────────────────────────────────
// Meta não tem lista/botões/carrossel livres : esses tipos exigem um Template
// HSM já aprovado pela Meta. Sem seletor pronto reaproveitável no projeto — a
// tela de gestão (TemplatesHSMContent) é CRUD, não picker — construído aqui.

interface HsmTemplateOption {
  id: string;
  name: string;
  language: string;
  body: string;
  kind: 'simple' | 'buttons' | 'carousel';
  status: 'pendente' | 'aprovado' | 'rejeitado';
}

function extractBodyParamCount(body: string): number {
  const matches = body.match(/\{\{(\d+)\}\}/g) ?? [];
  const nums = matches.map((m) => parseInt(m.replace(/[{}]/g, ''), 10));
  return nums.length > 0 ? Math.max(...nums) : 0;
}

function TemplateSelector({
  nodeType, templateId, bodyParams, onSelect, onParamsChange,
}: {
  nodeType: 'lista' | 'botoes' | 'carrossel';
  templateId?: string;
  bodyParams?: string[];
  onSelect: (id: string | undefined) => void;
  onParamsChange: (params: string[]) => void;
}) {
  const [templates, setTemplates] = useState<HsmTemplateOption[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/hsm-templates')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d?.data) setTemplates(d.data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // lista e botões usam o mesmo tipo de template : Meta não tem componente
  // de "lista" (seções/itens) em template, só BUTTONS e CAROUSEL
  const wantedKind: HsmTemplateOption['kind'] = nodeType === 'carrossel' ? 'carousel' : 'buttons';
  const options = templates.filter((t) => t.kind === wantedKind && t.status === 'aprovado');
  const selected = templates.find((t) => t.id === templateId);
  const paramCount = selected ? extractBodyParamCount(selected.body) : 0;

  if (loading) {
    return <div className="flex items-center gap-2 text-xs text-muted-foreground py-2"><Loader2 className="w-3.5 h-3.5 animate-spin" />Carregando templates…</div>;
  }

  if (options.length === 0) {
    return (
      <div className="p-3 rounded-lg border border-amber-500/30 bg-amber-500/5 text-xs text-amber-600 dark:text-amber-400 space-y-1">
        <p className="font-medium">Nenhum template {wantedKind === 'carousel' ? 'de carrossel' : 'de botões'} aprovado ainda.</p>
        <p className="text-[11px] opacity-80">Crie e submeta em Configurações → Templates HSM. No canal Meta, {nodeType} só funciona com um template aprovado.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <select
        value={templateId ?? ''}
        onChange={(e) => onSelect(e.target.value || undefined)}
        className="field-input"
      >
        <option value="">Selecione um template…</option>
        {options.map((t) => (
          <option key={t.id} value={t.id}>{t.name}</option>
        ))}
      </select>
      {selected && (
        <div className="p-2.5 rounded-lg bg-muted/40 border border-border text-xs text-muted-foreground line-clamp-3">
          {selected.body}
        </div>
      )}
      {selected && paramCount > 0 && (
        <div className="space-y-1.5">
          <p className="text-[11px] font-medium text-muted-foreground">Variáveis do template</p>
          {Array.from({ length: paramCount }, (_, i) => (
            <input
              key={i}
              type="text"
              value={bodyParams?.[i] ?? ''}
              onChange={(e) => {
                const next = [...(bodyParams ?? [])];
                next[i] = e.target.value;
                onParamsChange(next);
              }}
              placeholder={`{{${i + 1}}}`}
              className="field-input"
            />
          ))}
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
        <Select value={variavel} onValueChange={(v) => onUpdate(nodeId, { variavel: v })}>
          <SelectTrigger className="h-[42px] rounded-xl border-border bg-muted text-sm dark:border-[#2A2A2A] dark:bg-[#181818]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="resposta_botao">Resposta do botão</SelectItem>
            <SelectItem value="ultima_resposta">Última resposta</SelectItem>
            <SelectItem value="custom">Personalizada</SelectItem>
          </SelectContent>
        </Select>
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
        <Select value={operador} onValueChange={(v) => onUpdate(nodeId, { operador: v as ConditionNodeData['operador'] })}>
          <SelectTrigger className="h-[42px] rounded-xl border-border bg-muted text-sm dark:border-[#2A2A2A] dark:bg-[#181818]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="eq">igual a (=)</SelectItem>
            <SelectItem value="contains">contém</SelectItem>
            <SelectItem value="starts_with">começa com</SelectItem>
            <SelectItem value="not_empty">não está vazio</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {operador !== 'not_empty' && (
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">Valor</label>
          {upstreamChoices.length > 0 ? (
            <>
              <Select value={inUpstream ? valor : '__custom'} onValueChange={(v) => onUpdate(nodeId, { valor: v === '__custom' ? '' : v })}>
                <SelectTrigger className="h-[42px] rounded-xl border-border bg-muted text-sm dark:border-[#2A2A2A] dark:bg-[#181818]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {upstreamChoices.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  <SelectItem value="__custom">Personalizado…</SelectItem>
                </SelectContent>
              </Select>
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
        <Select value={d.variavel ?? 'resposta_botao'} onValueChange={(v) => onUpdate(nodeId, { variavel: v })}>
          <SelectTrigger className="h-[42px] rounded-xl border-border bg-muted text-sm dark:border-[#2A2A2A] dark:bg-[#181818]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="resposta_botao">Resposta do botão</SelectItem>
            <SelectItem value="ultima_resposta">Última resposta</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-2">
        <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">Casos</label>
        {cases.map((c, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <span className={`text-[10px] font-bold w-4 shrink-0 ${CASE_COLORS[i % CASE_COLORS.length]}`}>{i + 1}</span>
            {upstreamChoices.length > 0 ? (
              <Select value={upstreamChoices.includes(c.value) ? c.value : '__custom'} onValueChange={(v) => updateCase(i, { value: v === '__custom' ? '' : v })}>
                <SelectTrigger className="h-8 text-xs rounded-lg border-border bg-muted dark:border-[#2A2A2A] dark:bg-[#181818] flex-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {upstreamChoices.map(ch => <SelectItem key={ch} value={ch}>{ch}</SelectItem>)}
                  <SelectItem value="__custom">Personalizado…</SelectItem>
                </SelectContent>
              </Select>
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
  { label: 'nome',         value: '{nome}'         },
  { label: 'empresa',      value: '{empresa}'      },
  { label: 'telefone',     value: '{telefone}'     },
  { label: 'email',        value: '{email}'        },
  { label: 'produto',      value: '{produto}'      },
  { label: 'hora_reuniao', value: '{hora_reuniao}' },
  { label: 'link_meet',    value: '{link_meet}'    },
  { label: 'data_call',    value: '{data_call}'    },
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
  sequences?: FollowSequence[];
  currentSeqId?: string;
  whatsappProvider?: 'uazapi' | 'meta';
  nodeIndex?: number;
  onTest?: () => void;
}

function TrialWebhookField() {
  const [url, setUrl] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  useEffect(() => {
    fetch('/api/trial/config').then(r => r.json()).then(d => {
      if (d.webhookUrl) setUrl(d.webhookUrl)
    }).catch(() => {})
  }, [])

  if (!url) return null

  function copy() {
    navigator.clipboard.writeText(url!)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <>
      <div className="h-px bg-border/60 -mx-4" />
      <div className="space-y-2">
        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">URL do Webhook</p>
        <p className="text-[10px] text-muted-foreground/70 leading-snug">Cole esta URL no seu formulário de cadastro.</p>
        <div className="flex items-center gap-1.5">
          <input readOnly value={url} className="field-input font-mono text-[10px] truncate flex-1" />
          <button
            type="button"
            onClick={copy}
            className="shrink-0 h-8 w-8 flex items-center justify-center rounded-lg border border-border hover:bg-muted/40 transition-colors"
          >
            {copied
              ? <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              : <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
            }
          </button>
        </div>
      </div>
    </>
  )
}

function SequenceWebhookField({ sequenceId }: { sequenceId?: string }) {
  const [companyId, setCompanyId] = useState<number | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    fetch('/api/automacoes/company-id').then(r => r.json()).then(d => {
      if (d.companyId) setCompanyId(d.companyId)
    }).catch(() => {})
  }, [])

  if (!sequenceId) {
    return (
      <>
        <div className="h-px bg-border/60 -mx-4" />
        <p className="text-[10px] text-muted-foreground/70 leading-snug">Salve a sequência primeiro pra gerar a URL do webhook.</p>
      </>
    )
  }
  if (!companyId) return null

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : ''
  const url = `${baseUrl}/api/webhooks/sequence/${companyId}/${sequenceId}`

  function copy() {
    navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <>
      <div className="h-px bg-border/60 -mx-4" />
      <div className="space-y-2">
        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">URL do Webhook</p>
        <p className="text-[10px] text-muted-foreground/70 leading-snug">Cole esta URL onde quiser disparar esta sequência (ex: campo "Webhook" do Briefing). Precisa enviar POST com <code>{'{ lead_id }'}</code>.</p>
        <div className="flex items-center gap-1.5">
          <input readOnly value={url} className="field-input font-mono text-[10px] truncate flex-1" />
          <button
            type="button"
            onClick={copy}
            className="shrink-0 h-8 w-8 flex items-center justify-center rounded-lg border border-border hover:bg-muted/40 transition-colors"
          >
            {copied
              ? <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              : <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
            }
          </button>
        </div>
      </div>
    </>
  )
}

function PaymentWebhookField({ platform }: { platform?: 'mercadopago' | 'kiwify' | 'asaas' }) {
  const [integrations, setIntegrations] = useState<{ platform: string }[]>([])
  const [companyId, setCompanyId] = useState<number | null>(null)
  const [copied, setCopied] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/payment-integrations')
      .then(r => r.json())
      .then(d => { setIntegrations(d.integrations ?? []); setCompanyId(d.companyId ?? null) })
      .catch(() => {})
  }, [])

  // If a specific platform is selected for this trigger, show only that one
  const filtered = platform ? integrations.filter(i => i.platform === platform) : integrations
  const missing = platform
    ? (integrations.find(i => i.platform === platform) ? [] : [platform])
    : (['mercadopago', 'kiwify', 'asaas'] as const).filter(p => !integrations.find(i => i.platform === p))

  if (!integrations.length) return (
    <>
      <div className="h-px bg-border/60 -mx-4" />
      <p className="text-[10px] text-muted-foreground/70 leading-snug">
        Configure integrações de pagamento em <strong>Configurações → Integrações</strong> para ativar o gatilho.
      </p>
    </>
  )

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : ''

  function copy(platform: string) {
    const url = `${baseUrl}/api/webhooks/payment/${companyId}/${platform}`
    navigator.clipboard.writeText(url)
    setCopied(platform)
    setTimeout(() => setCopied(null), 2000)
  }

  return (
    <>
      <div className="h-px bg-border/60 -mx-4" />
      <div className="space-y-2">
        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">URLs dos Webhooks</p>
        <p className="text-[10px] text-muted-foreground/70 leading-snug">Cole cada URL no painel da respectiva plataforma.</p>
        {filtered.map(({ platform: p }) => {
          const url = `${baseUrl}/api/webhooks/payment/${companyId}/${p}`
          const label = p === 'mercadopago' ? 'Mercado Pago' : p === 'kiwify' ? 'Kiwify' : p === 'asaas' ? 'Asaas' : p
          return (
            <div key={p} className="space-y-1">
              <p className="text-[10px] font-medium text-muted-foreground">{label}</p>
              <div className="flex items-center gap-1.5">
                <input readOnly value={url} className="field-input font-mono text-[10px] truncate flex-1" />
                <button
                  type="button"
                  onClick={() => copy(p)}
                  className="shrink-0 h-8 w-8 flex items-center justify-center rounded-lg border border-border hover:bg-muted/40 transition-colors"
                >
                  {copied === p
                    ? <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                    : <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
                  }
                </button>
              </div>
            </div>
          )
        })}
        {missing.length > 0 && (
          <p className="text-[10px] text-amber-500/80 leading-snug">
            {missing.map(p => p === 'mercadopago' ? 'Mercado Pago' : p === 'kiwify' ? 'Kiwify' : 'Asaas').join(' e ')} não configurado em Integrações.
          </p>
        )}
      </div>
    </>
  )
}

const KIND_VISUAL: Record<string, { icon: React.ElementType; accent: AccentKey; title: string }> = {
  trigger: { icon: Zap, accent: 'amber', title: 'Gatilho' },
  message: { icon: MessageSquare, accent: 'emerald', title: 'Mensagem' },
  wait: { icon: Clock, accent: 'amber', title: 'Aguardar' },
  wait_event: { icon: Bell, accent: 'amber', title: 'Aguardar evento' },
  post_condition: { icon: Zap, accent: 'amber', title: 'Pós-condição' },
  scheduling: { icon: Calendar, accent: 'emerald', title: 'Agendar call' },
  condition: { icon: GitBranch, accent: 'violet', title: 'Condição' },
  switch: { icon: GitBranch, accent: 'violet', title: 'Switch' },
  sentiment: { icon: Smile, accent: 'violet', title: 'Sentimento' },
  sub_flow: { icon: Layers, accent: 'blue', title: 'Sub-fluxo' },
  goal: { icon: Target, accent: 'emerald', title: 'Meta' },
  end: { icon: XCircle, accent: 'destructive', title: 'Encerrar' },
  webhook: { icon: Globe, accent: 'blue', title: 'Webhook' },
  lead_score: { icon: Star, accent: 'amber', title: 'Lead score' },
  ab_test: { icon: GitMerge, accent: 'violet', title: 'Teste A/B' },
  gerar_cobranca: { icon: CreditCard, accent: 'emerald', title: 'Gerar cobrança' },
  aguardar_pagamento: { icon: Hourglass, accent: 'amber', title: 'Aguardar pagamento' },
};

function ConfigPanel({ node, onClose, onUpdate, onDelete, nodes: allNodes = [], edges: allEdges = [], sequenceTipo, remarketingCfg, onRemarketingChange, sequences = [], currentSeqId, whatsappProvider = 'uazapi', nodeIndex, onTest }: ConfigPanelProps) {
  if (!node) return null;
  const d = node.data;
  const visual = KIND_VISUAL[d.kind as string] ?? KIND_VISUAL.end;
  const HeaderIcon = d.kind === 'message' && (d.tipo_mensagem === 'audio' || d.tipo_mensagem === 'ptt') ? Mic : visual.icon;
  const panelTitle = (d.customLabel as string | undefined) || (d.kind === 'message' && nodeIndex ? `${visual.title} ${nodeIndex}` : visual.title);

  const horarioValue = d.kind === 'message' ? (d.horario || '09:00').slice(0, 5) : '09:00';

  // Achado ao vivo (Rodrigo, 2026-09-18) : node de áudio nunca teve campo de
  // texto -- mensagem que sobrava de um node antigo (outro tipo) virava lixo
  // órfão, e o SDR usava esse texto como se fosse o que o áudio realmente diz.
  // Transcreve automaticamente no upload (uma vez só, não por envio) e limpa
  // a mensagem/transcrição antiga assim que um NOVO arquivo é enviado, pra
  // nunca ficar com transcrição de um áudio que não é mais esse.
  async function handleAudioUpload(url: string) {
    onUpdate(node!.id, { media_url: url, uploading: false, mensagem: undefined, transcribing: true });
    try {
      const res = await fetch('/api/follow/transcribe-audio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();
      onUpdate(node!.id, { mensagem: data.success ? data.text : '', transcribing: false });
    } catch {
      onUpdate(node!.id, { transcribing: false });
    }
  }

  return (
    <aside className="absolute right-0 top-0 z-20 flex h-full w-[400px] max-w-full flex-col border-l border-border bg-card shadow-[-12px_0_32px_rgba(0,0,0,0.25)] dark:border-[#2A2A2A] dark:bg-[#111111] animate-in slide-in-from-right-4 duration-150">
      <div className="flex flex-shrink-0 items-center justify-between gap-3 border-b border-border px-[22px] py-[22px] dark:border-[#1F1F1F]">
        <div className="flex min-w-0 items-center gap-3">
          <div className={cn('flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-[10px]', ACCENTS[visual.accent].box)}>
            <HeaderIcon className={cn('h-[18px] w-[18px]', ACCENTS[visual.accent].icon)} />
          </div>
          <div className="min-w-0">
            <h3 className="truncate text-lg font-semibold leading-[22px] text-foreground">{panelTitle}</h3>
            <p className="text-[13px] leading-4 text-muted-foreground">Configurar passo</p>
          </div>
        </div>
        <button onClick={onClose} aria-label="Fechar" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-foreground/80 transition-colors hover:bg-accent dark:bg-[#1A1A1A]">
          <X className="h-3.5 w-3.5" strokeWidth={2.4} />
        </button>
      </div>

      <div className="flex flex-1 flex-col gap-5 overflow-y-auto p-[22px]">

        {/* ── Message node ── */}
        {d.kind === 'message' && (
          <>
            {/* Offset: anti_noshow: sempre horas (relativo à call). Outros: toggle Dias/Horas */}
            {sequenceTipo === 'anti_noshow' ? (
              <Field label="Tempo relativo à call">
                <AntiNoshowOffsetPicker
                  value={offsetToMins(d.dia_offset, d.offset_unit)}
                  onChange={(mins) => onUpdate(node.id, { dia_offset: mins, offset_unit: 'minutes' })}
                />
              </Field>
            ) : (
              <>
                <Field label="Quando enviar">
                  <div className="inline-flex w-fit rounded-full bg-muted p-[3px] dark:bg-[#181818]">
                    <button
                      type="button"
                      onClick={() => onUpdate(node.id, { offset_unit: 'days' })}
                      className={cn('rounded-full px-4 py-1.5 text-[13px] transition-colors',
                        (d.offset_unit ?? 'days') === 'days'
                          ? 'bg-[#0F3D2B] font-semibold text-white'
                          : 'font-medium text-muted-foreground hover:text-foreground')}
                    >
                      Dias
                    </button>
                    <button
                      type="button"
                      onClick={() => onUpdate(node.id, { offset_unit: 'hours' })}
                      className={cn('rounded-full px-4 py-1.5 text-[13px] transition-colors',
                        d.offset_unit === 'hours'
                          ? 'bg-[#0F3D2B] font-semibold text-white'
                          : 'font-medium text-muted-foreground hover:text-foreground')}
                    >
                      Horas
                    </button>
                  </div>
                </Field>

                {(d.offset_unit ?? 'days') === 'days' ? (
                  <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)] gap-3">
                    <Field label="Dia">
                      <input type="number" min={0} value={d.dia_offset}
                        onChange={(e) => onUpdate(node.id, { dia_offset: Number(e.target.value) })}
                        className="field-input" />
                    </Field>
                    <Field label="Horário">
                      <div className="flex items-center gap-1">
                        <Select value={horarioValue.slice(0, 2)} onValueChange={(v) => onUpdate(node.id, { horario: `${v}:${horarioValue.slice(3, 5)}` })}>
                          <SelectTrigger className="h-[42px] flex-1 justify-center rounded-xl border-border bg-muted font-mono text-sm dark:border-[#2A2A2A] dark:bg-[#181818] [&>svg]:hidden"><SelectValue /></SelectTrigger>
                          <SelectContent>{Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0')).map(h => <SelectItem key={h} value={h}>{h}</SelectItem>)}</SelectContent>
                        </Select>
                        <span className="text-muted-foreground font-bold">:</span>
                        <Select value={horarioValue.slice(3, 5)} onValueChange={(v) => onUpdate(node.id, { horario: `${horarioValue.slice(0, 2)}:${v}` })}>
                          <SelectTrigger className="h-[42px] flex-1 justify-center rounded-xl border-border bg-muted font-mono text-sm dark:border-[#2A2A2A] dark:bg-[#181818] [&>svg]:hidden"><SelectValue /></SelectTrigger>
                          <SelectContent>{['00','05','10','15','20','25','30','35','40','45','50','55'].map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                    </Field>
                  </div>
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
              <Select
                value={d.sdr_ativo === null || d.sdr_ativo === undefined ? 'null' : String(d.sdr_ativo)}
                onValueChange={(v) => onUpdate(node.id, { sdr_ativo: v === 'null' ? null : v === 'true' })}
              >
                <SelectTrigger className="h-[42px] rounded-xl border-border bg-muted text-sm dark:border-[#2A2A2A] dark:bg-[#181818]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="null">Sem mudança</SelectItem>
                  <SelectItem value="false">Pausar IA após este node</SelectItem>
                  <SelectItem value="true">Ativar IA após este node</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-[10px] text-muted-foreground/60 leading-snug mt-1">
                {(d.sdr_ativo === false) && 'Se o lead responder, o SDR não assume: a IA fica pausada.'}
                {(d.sdr_ativo === true) && 'O SDR volta a responder automaticamente após este step.'}
              </p>
            </Field>

            <Field label="Tipo de mensagem">
              <TipoSelector
                value={d.tipo_mensagem}
                onChange={(v) => onUpdate(node.id, { tipo_mensagem: v })}
                onClear={() => onUpdate(node.id, { media_url: undefined, media_name: undefined, mensagem: null, menu_choices: undefined, carousel_json: undefined, metaTemplateId: undefined, metaTemplateBodyParams: undefined, location_url: undefined, location_name: undefined, location_address: undefined, uploading: false })}
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
                  onUploadStart={() => onUpdate(node.id, { uploading: true, mensagem: undefined })}
                  onUpload={handleAudioUpload} />
                <div className="relative my-1">
                  <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border" /></div>
                  <div className="relative flex justify-center"><span className="bg-card px-2 text-[10px] text-muted-foreground">ou enviar arquivo</span></div>
                </div>
                <UploadZone accept="audio/*" label="Enviar arquivo de áudio" current={undefined}
                  onUploadStart={() => onUpdate(node.id, { uploading: true, mensagem: undefined })}
                  onUpload={handleAudioUpload} />
                {d.media_url && (
                  <div className="mt-2">
                    <p className="text-[10px] text-muted-foreground mb-1">
                      Transcrição {d.transcribing ? '(transcrevendo…)' : '(editável)'}
                    </p>
                    <textarea
                      value={d.transcribing ? '' : ((d.mensagem as string) ?? '')}
                      onChange={(e) => onUpdate(node.id, { mensagem: e.target.value })}
                      disabled={!!d.transcribing}
                      placeholder={d.transcribing ? 'Transcrevendo automaticamente…' : 'O que é dito no áudio (usado pelo SDR pra entender o histórico)'}
                      className="field-input min-h-16 resize-y text-xs"
                    />
                    <p className="text-[9px] text-muted-foreground/60 mt-0.5 leading-snug">
                      Transcrito automaticamente quando o áudio é enviado. Trocar o arquivo apaga essa transcrição e gera outra. É o único registro que o SDR tem do que já foi dito nesse áudio -- mantenha fiel ao que é falado.
                    </p>
                  </div>
                )}
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

            {d.tipo_mensagem === 'lista' && whatsappProvider === 'meta' && (
              <Field label="Template HSM aprovado (Meta não tem lista livre)">
                <TemplateSelector
                  nodeType="lista"
                  templateId={d.metaTemplateId}
                  bodyParams={d.metaTemplateBodyParams}
                  onSelect={(id) => onUpdate(node.id, { metaTemplateId: id })}
                  onParamsChange={(params) => onUpdate(node.id, { metaTemplateBodyParams: params })}
                />
              </Field>
            )}
            {d.tipo_mensagem === 'lista' && whatsappProvider !== 'meta' && (
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

            {d.tipo_mensagem === 'botoes' && whatsappProvider === 'meta' && (
              <Field label="Template HSM aprovado (botões fixos no Meta)">
                <TemplateSelector
                  nodeType="botoes"
                  templateId={d.metaTemplateId}
                  bodyParams={d.metaTemplateBodyParams}
                  onSelect={(id) => onUpdate(node.id, { metaTemplateId: id })}
                  onParamsChange={(params) => onUpdate(node.id, { metaTemplateBodyParams: params })}
                />
              </Field>
            )}
            {d.tipo_mensagem === 'botoes' && whatsappProvider !== 'meta' && (
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

            {d.tipo_mensagem === 'carrossel' && whatsappProvider === 'meta' && (
              <Field label="Template HSM de carrossel aprovado">
                <TemplateSelector
                  nodeType="carrossel"
                  templateId={d.metaTemplateId}
                  bodyParams={d.metaTemplateBodyParams}
                  onSelect={(id) => onUpdate(node.id, { metaTemplateId: id })}
                  onParamsChange={(params) => onUpdate(node.id, { metaTemplateBodyParams: params })}
                />
              </Field>
            )}
            {d.tipo_mensagem === 'carrossel' && whatsappProvider !== 'meta' && (
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
              <div className="flex items-center gap-1">
                {(() => { const hv = ((d as SchedulingNodeData).horario ?? '09:00').slice(0, 5); return (<>
                  <Select value={hv.slice(0, 2)} onValueChange={(v) => onUpdate(node.id, { horario: `${v}:${hv.slice(3, 5)}` })}>
                    <SelectTrigger className="h-[42px] flex-1 justify-center rounded-xl border-border bg-muted font-mono text-sm dark:border-[#2A2A2A] dark:bg-[#181818] [&>svg]:hidden"><SelectValue /></SelectTrigger>
                    <SelectContent>{Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0')).map(h => <SelectItem key={h} value={h}>{h}</SelectItem>)}</SelectContent>
                  </Select>
                  <span className="text-muted-foreground font-bold">:</span>
                  <Select value={hv.slice(3, 5)} onValueChange={(v) => onUpdate(node.id, { horario: `${hv.slice(0, 2)}:${v}` })}>
                    <SelectTrigger className="h-[42px] flex-1 justify-center rounded-xl border-border bg-muted font-mono text-sm dark:border-[#2A2A2A] dark:bg-[#181818] [&>svg]:hidden"><SelectValue /></SelectTrigger>
                    <SelectContent>{['00','05','10','15','20','25','30','35','40','45','50','55'].map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                  </Select>
                </>); })()}
              </div>
            </Field>
            <Field label="Duração da call">
              <Select value={String((d as SchedulingNodeData).duracao ?? 60)} onValueChange={(v) => onUpdate(node.id, { duracao: Number(v) })}>
                <SelectTrigger className="h-[42px] rounded-xl border-border bg-muted text-sm dark:border-[#2A2A2A] dark:bg-[#181818]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="30">30 minutos</SelectItem>
                  <SelectItem value="60">60 minutos</SelectItem>
                  <SelectItem value="90">90 minutos</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <BlocosEditor
              blocos={(d as SchedulingNodeData).blocos as string[] | undefined}
              mensagem={(d as SchedulingNodeData).mensagemInicial ?? null}
              onChange={(blocos) => onUpdate(node.id, {
                blocos: blocos.length > 0 ? blocos : undefined,
                mensagemInicial: blocos.length > 0 ? blocos[0] : ((d as SchedulingNodeData).mensagemInicial ?? ''),
              })}
            />
            <p className="text-[10px] text-muted-foreground/60 leading-snug">
              O agente de agendamento assume a conversa e agenda via Google Calendar. O fluxo encerra aqui.
            </p>
          </>
        )}

        {/* ── Post-Condition node ── */}
        {d.kind === 'post_condition' && (
          <>
            <div className="flex items-center gap-1.5 px-1 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20 mb-1">
              <Zap className="w-3.5 h-3.5 text-amber-500 shrink-0" />
              <p className="text-[11px] text-amber-600 dark:text-amber-400 leading-snug">
                Dispara somente quando o lead interagir com o botão. Sem horário fixo.
              </p>
            </div>
            <BlocosEditor
              blocos={(d as PostConditionNodeData).blocos as string[] | undefined}
              mensagem={(d as PostConditionNodeData).mensagem as string | null | undefined}
              onChange={(blocos) => onUpdate(node.id, {
                blocos: blocos.length > 0 ? blocos : undefined,
                mensagem: blocos.length > 0 ? blocos[0] : ((d as PostConditionNodeData).mensagem ?? null),
              })}
            />
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
            <Field label="Expirar após (dias)">
              <input type="number" min={0}
                value={(d as TriggerNodeData).expira_em_dias ?? 0}
                onChange={(e) => onUpdate(node.id, { expira_em_dias: Math.max(0, Number(e.target.value)) })}
                className="field-input" />
              <p className="text-[10px] text-muted-foreground/60 mt-1 leading-snug">
                0 = nunca expira. Se definido, leads que entraram há mais dias são ignorados.
              </p>
            </Field>
            {sequenceTipo !== 'pagamento' && (
              <Field label="Entrada automática por evento">
                <Select value={(d as TriggerNodeData).eventoEntrada ?? 'none'} onValueChange={(v) => onUpdate(node.id, { eventoEntrada: v === 'none' ? undefined : (v as TriggerNodeData['eventoEntrada']) })}>
                  <SelectTrigger className="h-[42px] rounded-xl border-border bg-muted text-sm dark:border-[#2A2A2A] dark:bg-[#181818]"><SelectValue placeholder="Manual / cron padrão" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Manual / cron padrão</SelectItem>
                    <SelectItem value="novo_lead">Novo lead criado</SelectItem>
                    <SelectItem value="mudanca_status">Mudança de status</SelectItem>
                    <SelectItem value="webhook">Evento de webhook</SelectItem>
                    <SelectItem value="preco_informado">Preço informado pelo SDR</SelectItem>
                    <SelectItem value="formulario_preenchido">Formulário (briefing) preenchido</SelectItem>
                    <SelectItem value="call_realizada">Teve a call e não fechou</SelectItem>
                    <SelectItem value="tag_follow_up">Etiqueta "Follow up" (Kanban)</SelectItem>
                    <SelectItem value="tag_no_show">Etiqueta "No-show" (Kanban)</SelectItem>
                    <SelectItem value="tag_promocao">Etiqueta "Promoção" (Kanban)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-[10px] text-muted-foreground/60 mt-1 leading-snug">
                  Define quando leads entram automaticamente nesta sequência. "Preço informado", "Formulário preenchido",
                  "Teve a call e não fechou", "Follow up", "No-show" e "Promoção" usam a data desse evento como referência
                  pros dias de espera de cada mensagem (ex: 1º dia = 1 dia depois do evento). Leads que já tiveram a call saem
                  automaticamente do reengajamento genérico e passam a usar essa sequência dedicada. As etiquetas "Follow up",
                  "No-show" e "Promoção" são aplicadas manualmente arrastando o card no Kanban (não por status de venda) e
                  saem sozinhas assim que o lead responder de novo.
                </p>
              </Field>
            )}

            {/* Trial SaaS: webhook URL (receptor próprio, /api/trial/webhook) */}
            {sequenceTipo === 'trial_saas' && <TrialWebhookField />}

            {/* Sequência normal com gatilho de webhook : URL genérica desta sequência,
                pra colar em qualquer origem externa (ex: campo "Webhook" do Briefing) */}
            {sequenceTipo !== 'trial_saas' && sequenceTipo !== 'pagamento' && (d as TriggerNodeData).eventoEntrada === 'webhook' && (
              <SequenceWebhookField sequenceId={currentSeqId} />
            )}

            {/* Pagamento: plataforma por trigger + webhook */}
            {sequenceTipo === 'pagamento' && (
              <>
                <Field label="Plataforma deste gatilho">
                  <Select
                    value={(d as TriggerNodeData).platform ?? ''}
                    onValueChange={(v) => {
                      const plat = (v as TriggerNodeData['platform']) || undefined;
                      // For Asaas: default eventoEntrada to asaas_pago; for others: eventoEntrada = platform
                      const evento = plat === 'asaas' ? 'asaas_pago' : (plat ?? undefined);
                      onUpdate(node.id, { platform: plat, eventoEntrada: evento as TriggerNodeData['eventoEntrada'] });
                    }}
                  >
                    <SelectTrigger className="h-[42px] rounded-xl border-border bg-muted text-sm dark:border-[#2A2A2A] dark:bg-[#181818]">
                      <SelectValue placeholder="Selecionar plataforma..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="mercadopago">Mercado Pago</SelectItem>
                      <SelectItem value="kiwify">Kiwify</SelectItem>
                      <SelectItem value="asaas">Asaas</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                {(d as TriggerNodeData).platform === 'asaas' && (
                  <Field label="Evento Asaas">
                    <Select
                      value={(d as TriggerNodeData).eventoEntrada ?? 'asaas_pago'}
                      onValueChange={(v) => onUpdate(node.id, { eventoEntrada: v as TriggerNodeData['eventoEntrada'] })}
                    >
                      <SelectTrigger className="h-[42px] rounded-xl border-border bg-muted text-sm dark:border-[#2A2A2A] dark:bg-[#181818]"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="asaas_pago">Pagamento confirmado</SelectItem>
                        <SelectItem value="asaas_boleto_gerado">Boleto gerado</SelectItem>
                        <SelectItem value="asaas_boleto_vencido">Boleto vencido</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                )}
                <PaymentWebhookField platform={(d as TriggerNodeData).platform} />
                {(() => {
                  const triggerCount = allNodes.filter((n) => n.data.kind === 'trigger').length;
                  const canDelete = triggerCount > 1;
                  return (
                    <div className="space-y-1">
                      <button
                        type="button"
                        onClick={() => canDelete && onDelete(node.id)}
                        disabled={!canDelete}
                        className={cn(
                          'flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-medium transition-colors w-full justify-center',
                          canDelete
                            ? 'border-destructive/40 text-destructive hover:bg-destructive/10 cursor-pointer'
                            : 'border-border/40 text-muted-foreground/40 cursor-not-allowed'
                        )}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Remover este gatilho
                      </button>
                      {!canDelete && (
                        <p className="text-[10px] text-muted-foreground/50 text-center leading-snug">
                          Adicione outro gatilho antes de remover este.
                        </p>
                      )}
                    </div>
                  );
                })()}
              </>
            )}

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

                  <Field label="Mín. dias inativo" hint={remarketingCfg.diasInativo > 0 ? `leads recentes bloqueados por ${remarketingCfg.diasInativo}d` : 'dispara imediatamente'}>
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
              <Select value={d.method ?? 'POST'} onValueChange={(v) => onUpdate(node.id, { method: v as 'POST' | 'GET' })}>
                <SelectTrigger className="h-[42px] rounded-xl border-border bg-muted text-sm dark:border-[#2A2A2A] dark:bg-[#181818]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="POST">POST</SelectItem>
                  <SelectItem value="GET">GET</SelectItem>
                </SelectContent>
              </Select>
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

        {/* ── Sub-flow node ── */}
        {d.kind === 'sub_flow' && (
          <>
            <Field label="Sequência de destino">
              <Select
                value={(d as SubFlowNodeData).subSequenceId ?? ''}
                onValueChange={(v) => {
                  const chosen = sequences.find((s) => s.id === v);
                  onUpdate(node.id, { subSequenceId: v, subSequenceName: chosen?.nome ?? '' } as any);
                }}
              >
                <SelectTrigger className="h-[42px] rounded-xl border-border bg-muted text-sm dark:border-[#2A2A2A] dark:bg-[#181818]"><SelectValue placeholder="Selecionar sequência…" /></SelectTrigger>
                <SelectContent>
                  {sequences.filter((s) => s.id !== currentSeqId).map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.nome} ({s.tipo})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[10px] text-muted-foreground/60 mt-1 leading-snug">
                O lead será enrolado nessa sequência ao chegar neste nó.
              </p>
            </Field>
          </>
        )}

        {/* ── Goal node ── */}
        {d.kind === 'goal' && (
          <Field label="Marcar lead como">
            <input type="text"
              value={(d as GoalNodeData).marcarStatus ?? 'Convertido'}
              onChange={(e) => onUpdate(node.id, { marcarStatus: e.target.value || 'Convertido' })}
              placeholder="Ex: Convertido, Cliente, Fechado, Perdido..."
              className="field-input" />
            <p className="text-[10px] text-muted-foreground/60 mt-1 leading-snug">
              Atualiza o status do lead no CRM ao atingir esta meta. Use "Perdido" depois de um nó de condição que detecte
              recusa explícita do lead, pra tirar ele automaticamente da sequência de reengajamento.
            </p>
          </Field>
        )}

        {/* ── WaitEvent node ── */}
        {d.kind === 'wait_event' && (
          <>
            <Field label="Tipo de evento">
              <Select
                value={(d as WaitEventNodeData).event ?? 'reply'}
                onValueChange={(v) => onUpdate(node.id, { event: v as 'reply' | 'keyword' })}
              >
                <SelectTrigger className="h-[42px] rounded-xl border-border bg-muted text-sm dark:border-[#2A2A2A] dark:bg-[#181818]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="reply">Qualquer resposta</SelectItem>
                  <SelectItem value="keyword">Palavra-chave específica</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-[10px] text-muted-foreground/60 mt-1 leading-snug">
                O fluxo avança quando o lead enviar uma mensagem que satisfaça o critério.
              </p>
            </Field>
            {(d as WaitEventNodeData).event === 'keyword' && (
              <Field label="Palavra-chave">
                <input
                  type="text"
                  value={(d as WaitEventNodeData).pattern ?? ''}
                  onChange={(e) => onUpdate(node.id, { pattern: e.target.value })}
                  placeholder="Ex: SIM, confirmo, quero..."
                  className="field-input"
                />
                <p className="text-[10px] text-muted-foreground/60 mt-1 leading-snug">
                  A resposta do lead deve conter este texto (sem diferenciar maiúsculas).
                </p>
              </Field>
            )}
          </>
        )}

        {d.kind === 'gerar_cobranca' && (
          <>
            <Field label="Tipo de cobrança">
              <Select value={(d as GerarCobrancaNodeData).billingType ?? 'PIX'} onValueChange={(v) => onUpdate(node.id, { billingType: v })}>
                <SelectTrigger className="h-[42px] rounded-xl border-border bg-muted text-sm dark:border-[#2A2A2A] dark:bg-[#181818]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="PIX">PIX</SelectItem>
                  <SelectItem value="BOLETO">Boleto bancário</SelectItem>
                  <SelectItem value="CREDIT_CARD">Cartão de crédito</SelectItem>
                  <SelectItem value="UNDEFINED">Qualquer (escolha do cliente)</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Valor (R$)" hint="0 = usa o valor do projeto do lead">
              <input type="number" min="0" step="0.01" placeholder="0.00 (do lead)"
                value={(d as GerarCobrancaNodeData).value ?? 0}
                onChange={(e) => onUpdate(node.id, { value: Number(e.target.value) || 0 })}
                className="field-input" />
            </Field>
            <Field label="Vence em (dias)">
              <input type="number" min="1" max="30" placeholder="3"
                value={(d as GerarCobrancaNodeData).daysUntilDue ?? 3}
                onChange={(e) => onUpdate(node.id, { daysUntilDue: Number(e.target.value) || 3 })}
                className="field-input" />
            </Field>
            <Field label="Descrição (opcional)">
              <input type="text" placeholder="Ex: Consultoria: pacote básico"
                value={(d as GerarCobrancaNodeData).description ?? ''}
                onChange={(e) => onUpdate(node.id, { description: e.target.value })}
                className="field-input" />
            </Field>
            <label className="flex items-center gap-2.5 cursor-pointer select-none px-1">
              <input type="checkbox" checked={(d as GerarCobrancaNodeData).sendWhatsapp ?? true}
                onChange={(e) => onUpdate(node.id, { sendWhatsapp: e.target.checked })}
                className="rounded border-border" />
              <span className="text-sm text-muted-foreground">Enviar link via WhatsApp ao lead</span>
            </label>
          </>
        )}

        {d.kind === 'aguardar_pagamento' && (
          <Field label="Timeout (dias)" hint="Após esse período sem pagamento, segue pelo caminho Vencido">
            <input type="number" min="1" max="30" placeholder="7"
              value={(d as AguardarPagamentoNodeData).timeoutDays ?? 7}
              onChange={(e) => onUpdate(node.id, { timeoutDays: Number(e.target.value) || 7 })}
              className="field-input" />
          </Field>
        )}

        {d.kind !== 'trigger' && (
          <Field label="Nome do passo" hint="opcional">
            <input
              type="text"
              value={(d.customLabel as string) ?? ''}
              onChange={(e) => onUpdate(node.id, { customLabel: e.target.value || undefined })}
              placeholder={d.kind === 'message' && nodeIndex ? `Mensagem ${nodeIndex}` : visual.title}
              className="field-input"
            />
          </Field>
        )}

        {/* ── Anotações (todos os nós exceto trigger) ── */}
        {d.kind !== 'trigger' && (
          <Field label="Anotações">
            <textarea
              value={(d as any).comment ?? ''}
              onChange={(e) => onUpdate(node.id, { comment: e.target.value || undefined } as any)}
              placeholder="Notas internas sobre este nó…"
              className="field-input resize-none min-h-[60px] text-xs"
            />
          </Field>
        )}

      </div>

      {(d.kind !== 'trigger' || onTest) && (
        <div className="flex flex-shrink-0 items-center justify-between gap-3 border-t border-border px-[22px] py-4 dark:border-[#1F1F1F]">
          {d.kind !== 'trigger' ? (
            <button type="button" onClick={() => { onDelete(node.id); onClose(); }} className="flex items-center gap-2 rounded-full px-1 py-2 text-sm font-semibold text-destructive transition-colors hover:opacity-80">
              <Trash2 className="h-4 w-4" />Excluir passo
            </button>
          ) : <span />}
          {onTest && (
            <button type="button" onClick={onTest} className="flex h-10 items-center justify-center rounded-full bg-[#141414] px-5 text-sm font-semibold text-white shadow-[inset_0_1px_0_#FFFFFF14,0_3px_0_#000000] transition-transform active:translate-y-px">
              Testar passo
            </button>
          )}
        </div>
      )}
    </aside>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <label className="text-sm font-semibold text-foreground">{label}</label>
        {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

// ─── Palette ────────────────────────────────────────────────────────────────────

type PaletteKind = 'message' | 'wait' | 'wait_event' | 'sub_flow' | 'condition' | 'switch' | 'end' | 'goal' | 'sentiment' | 'webhook' | 'lead_score' | 'ab_test' | 'scheduling' | 'post_condition' | 'gerar_cobranca' | 'aguardar_pagamento';

interface PaletteItem {
  label: string; desc: string; kind: PaletteKind; group: string;
  icon: React.ElementType; accent: AccentKey;
}

const PALETTE_ITEMS: PaletteItem[] = [
  { group: 'Enviar', label: 'Mensagem', desc: 'Texto, áudio, imagem, vídeo, botões ou lista', kind: 'message', icon: MessageSquare, accent: 'emerald' },
  { group: 'Enviar', label: 'Agendar call', desc: 'O agente oferece horários e marca a reunião', kind: 'scheduling', icon: Calendar, accent: 'emerald' },
  { group: 'Esperar', label: 'Aguardar', desc: 'Espera um tempo antes do próximo passo', kind: 'wait', icon: Clock, accent: 'amber' },
  { group: 'Esperar', label: 'Aguardar evento', desc: 'Espera o lead responder, clicar ou dizer algo', kind: 'wait_event', icon: Bell, accent: 'amber' },
  { group: 'Esperar', label: 'Pós-condição', desc: 'Só segue se o lead interagir de verdade', kind: 'post_condition', icon: Zap, accent: 'amber' },
  { group: 'Decidir', label: 'Condição', desc: 'Se ou senão, por etiqueta, campo ou etapa', kind: 'condition', icon: GitBranch, accent: 'violet' },
  { group: 'Decidir', label: 'Sentimento', desc: 'A IA lê o tom da resposta e escolhe o caminho', kind: 'sentiment', icon: Smile, accent: 'violet' },
  { group: 'Fluxo', label: 'Sub-fluxo', desc: 'Coloca o lead em outra sequência', kind: 'sub_flow', icon: Layers, accent: 'blue' },
  { group: 'Fluxo', label: 'Meta', desc: 'Marca o lead como convertido no CRM', kind: 'goal', icon: Target, accent: 'emerald' },
  { group: 'Fluxo', label: 'Encerrar', desc: 'Para de enviar mensagens deste fluxo ao lead', kind: 'end', icon: XCircle, accent: 'destructive' },
  { group: 'Cobrança', label: 'Gerar cobrança', desc: 'Cria boleto, PIX ou link de pagamento no Asaas', kind: 'gerar_cobranca', icon: CreditCard, accent: 'emerald' },
  { group: 'Cobrança', label: 'Aguardar pagamento', desc: 'Espera a confirmação e separa pago de vencido', kind: 'aguardar_pagamento', icon: Hourglass, accent: 'amber' },
];

function PalettePanel({ onAdd, onClose, after }: { onAdd: (kind: PaletteKind) => void; onClose: () => void; after?: string }) {
  const [search, setSearch] = useState('');

  const q = search.trim().toLowerCase();
  const filtered = PALETTE_ITEMS.filter((item) => !q || item.label.toLowerCase().includes(q) || item.desc.toLowerCase().includes(q));
  const groups = Array.from(new Set(filtered.map((i) => i.group)));

  return (
    <aside className="absolute right-0 top-0 z-20 flex h-full w-[420px] max-w-full flex-col overflow-hidden border-l border-border bg-card shadow-[-12px_0_32px_rgba(0,0,0,0.25)] dark:border-[#2A2A2A] dark:bg-[#111111] animate-in slide-in-from-right-4 duration-150">
      <div className="flex flex-col gap-3.5 px-[22px] pb-3.5 pt-[22px]">
        <div className="flex items-start justify-between">
          <div className="flex flex-col gap-1">
            <h3 className="text-lg font-semibold leading-[22px] text-foreground">Adicionar passo</h3>
            {after && <p className="text-[13px] leading-4 text-muted-foreground">Entra depois da {after}</p>}
          </div>
          <button type="button" onClick={onClose} aria-label="Fechar" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-foreground/80 transition-colors hover:bg-accent dark:bg-[#1A1A1A]"><X className="h-3.5 w-3.5" strokeWidth={2.4} /></button>
        </div>
        <div className="flex h-[42px] items-center gap-2.5 rounded-xl border border-border bg-muted px-3.5 dark:border-[#2A2A2A] dark:bg-[#181818]">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <input autoFocus value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar passo" aria-label="Buscar passo" className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground" />
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-4">
        {filtered.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Nenhum passo encontrado.</p>
        ) : groups.map((g, gi) => (
          <div key={g} className="flex flex-col gap-0.5">
            <p className={cn('px-2.5 pb-1.5 text-[12.5px] font-semibold leading-4 text-muted-foreground', gi === 0 ? 'pt-2' : 'pt-3.5')}>{g}</p>
            {filtered.filter((i) => i.group === g).map((item) => {
              const Icon = item.icon;
              const acc = ACCENTS[item.accent];
              return (
                <button
                  key={item.kind}
                  type="button"
                  onClick={() => { onAdd(item.kind); onClose(); }}
                  className="flex items-center gap-3 rounded-xl p-2.5 text-left transition-colors hover:bg-[#E4F1E9] dark:hover:bg-[#17231C]"
                >
                  <div className={cn('flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-[10px]', acc.box)}>
                    <Icon className={cn('h-[18px] w-[18px]', acc.icon)} />
                  </div>
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <p className="text-sm font-semibold leading-[18px] text-foreground">{item.label}</p>
                    <p className="text-[12.5px] leading-4 text-muted-foreground">{item.desc}</p>
                  </div>
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </aside>
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

interface ConversionRow {
  lead_id: number
  lead_name: string
  lead_status: string
  whatsapp: string | null
  goal_label: string
  goal_ordem: number
  converted_at: string
}

function ExecutionsView({ sequenceId, nodes = [] }: { sequenceId: string | null; tipo?: SequenceTipo; nodes?: Node<AutoNodeData>[] }) {
  const [tab, setTab] = useState<'execucoes' | 'conversoes'>('execucoes');
  const [filter, setFilter] = useState<'all' | 'sent' | 'failed' | 'skipped'>('all');
  const [visible, setVisible] = useState(8);
  const [executions, setExecutions] = useState<ExecLogReal[]>([]);
  const [loadingExec, setLoadingExec] = useState(false);
  const [execError, setExecError] = useState<string | null>(null);
  const [conversions, setConversions] = useState<ConversionRow[]>([]);
  const [convTotal, setConvTotal] = useState(0);
  const [convRate, setConvRate] = useState(0);
  const [loadingConv, setLoadingConv] = useState(false);

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

  useEffect(() => {
    if (!sequenceId || tab !== 'conversoes') return;
    setLoadingConv(true);
    fetch(`/api/follow/sequences/${sequenceId}/conversions`)
      .then(async (res) => {
        const json = await res.json();
        setConversions(json.conversions ?? []);
        setConvTotal(json.total ?? 0);
        setConvRate(json.rate ?? 0);
      })
      .catch(() => {})
      .finally(() => setLoadingConv(false));
  }, [sequenceId, tab]);

  useEffect(() => { setVisible(8); }, [filter, tab, sequenceId]);

  const fmtWhen = (ts: string | null) => {
    if (!ts) return '';
    const d = new Date(ts);
    return `${d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
  };

  const since = Date.now() - 30 * 86_400_000;
  const recent = executions.filter((e) => !e.ts || new Date(e.ts).getTime() >= since);
  const counts = { all: recent.length, sent: recent.filter((e) => e.status === 'sent').length, failed: recent.filter((e) => e.status === 'failed').length, skipped: recent.filter((e) => e.status === 'skipped').length };
  const rows = recent.filter((e) => filter === 'all' || e.status === filter);

  // Faixa do fluxo com quantos leads receberam cada passo
  const chain = nodes.filter((n) => n.data.kind === 'trigger' || n.data.kind === 'message').sort((a, b) => a.position.x - b.position.x);
  const msgIndex = new Map(chain.filter((n) => n.data.kind === 'message').map((n, i) => [n.id, i + 1]));

  const chip = (active: boolean) => cn('rounded-full px-3.5 py-1.5 text-[13px] transition-colors', active ? 'bg-[#0F3D2B] font-semibold text-white' : 'text-muted-foreground hover:text-foreground');
  const statusChip: Record<string, string> = {
    sent: 'bg-[#01573C]/10 text-[#01573C] dark:bg-[#96F63C]/[0.14] dark:text-[#96F63C]',
    failed: 'bg-destructive/10 text-destructive',
    skipped: 'bg-muted text-muted-foreground',
  };
  const statusLabel: Record<string, string> = { sent: 'Enviado', failed: 'Falhou', skipped: 'Pulado' };

  return (
    <div className="flex flex-col">
      {chain.length > 0 && (
        <div className="relative overflow-x-auto border-b border-border bg-[#FAFCFA] dark:border-[#1C1C1C] dark:bg-[#0A0A0A]" style={{ backgroundImage: 'radial-gradient(circle, var(--zp-dot, #2A2A2A) 1.2px, transparent 1.4px)', backgroundSize: '24px 24px' }}>
          <div className="flex min-w-max items-center px-12 py-14">
            {chain.map((n, i) => {
              const d = n.data as unknown as MessageNodeData & { label?: string; eventoEntrada?: string };
              const isTrigger = n.data.kind === 'trigger';
              const prev = i > 0 ? (chain[i - 1].data as { kind?: string; dia_offset?: number; offset_unit?: string }) : undefined;
              const pill = i > 0 ? delayLabel(prev, d as { kind?: string; dia_offset?: number; offset_unit?: string }) : undefined;
              const sent = d._sentCount ?? 0;
              return (
                <div key={n.id} className="flex items-center">
                  {i > 0 && (
                    <div className="flex items-center">
                      <span className="h-0.5 w-7 bg-[var(--zp-edge,#3A3A3A)]" />
                      {pill && (
                        <span className="flex h-[26px] items-center gap-[5px] rounded-full border border-border bg-card px-3 text-xs font-medium text-foreground/80 dark:border-[#2E2E2E] dark:bg-[#141414] dark:text-[#D0D0D0]"><Clock className="h-3 w-3 text-muted-foreground" strokeWidth={2.2} />{pill}</span>
                      )}
                      <span className="h-0.5 w-7 bg-[var(--zp-edge,#3A3A3A)]" />
                    </div>
                  )}
                  {isTrigger ? (
                    <div className="flex h-[84px] w-[200px] items-center gap-3 rounded-2xl border-[1.5px] border-border bg-card px-4 dark:border-[#2E2E2E] dark:bg-[#141414]">
                      <span className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-xl', ACCENTS.amber.box)}><Zap className={cn('h-[22px] w-[22px]', ACCENTS.amber.icon)} /></span>
                      <span className="min-w-0"><span className="block text-xs leading-4 text-muted-foreground">Gatilho</span><span className="line-clamp-2 text-sm font-semibold leading-[18px] text-foreground">{(d.eventoEntrada && TRIGGER_TITLES[d.eventoEntrada]) || d.label}</span></span>
                    </div>
                  ) : (
                    <div className="flex h-[128px] w-[208px] flex-col justify-between rounded-2xl border-[1.5px] border-border bg-card p-4 dark:border-[#2E2E2E] dark:bg-[#141414]">
                      <div className="flex items-center gap-2.5">
                        <span className={cn('flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[10px]', ACCENTS.emerald.box)}>
                          {(d.tipo_mensagem === 'audio' || d.tipo_mensagem === 'ptt') ? <Mic className={cn('h-[18px] w-[18px]', ACCENTS.emerald.icon)} /> : <MessageSquare className={cn('h-[18px] w-[18px]', ACCENTS.emerald.icon)} />}
                        </span>
                        <span className="min-w-0"><span className="block truncate text-sm font-semibold leading-[18px] text-foreground">{d.customLabel || `Mensagem ${msgIndex.get(n.id)}`}</span><span className="block truncate text-xs leading-4 text-muted-foreground">{(d.offset_unit === 'hours' || d.offset_unit === 'minutes') ? formatHorasOffset(offsetToMins(d.dia_offset, d.offset_unit)) : `Dia ${d.dia_offset}`} · {MESSAGE_TYPE_LABELS[d.tipo_mensagem] ?? 'Mensagem'}</span></span>
                      </div>
                      <p className="flex items-baseline gap-2"><span className="text-[32px] font-semibold leading-10 tracking-tight text-foreground">{sent}</span><span className="text-sm text-muted-foreground">{sent === 1 ? 'lead recebeu' : 'leads receberam'}</span></p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-5">
        <div className="flex items-center gap-4">
          <div className="flex items-center rounded-full bg-muted p-[3px] dark:bg-[#141414]">
            <button type="button" onClick={() => setTab('execucoes')} className={chip(tab === 'execucoes')}>Disparos</button>
            <button type="button" onClick={() => setTab('conversoes')} className={chip(tab === 'conversoes')}>Conversões</button>
          </div>
          <span className="text-sm text-muted-foreground">Últimos 30 dias</span>
        </div>
        {tab === 'execucoes' && (
          <div className="flex items-center gap-1.5">
            {([['all', 'Todos'], ['sent', 'Enviados'], ['failed', 'Falharam'], ['skipped', 'Pulados']] as const).map(([k, l]) => (
              <button key={k} type="button" aria-pressed={filter === k} onClick={() => setFilter(k)} className={chip(filter === k)}>{l} {counts[k]}</button>
            ))}
          </div>
        )}
      </div>

      {tab === 'execucoes' && (
        !sequenceId ? (
          <p className="px-6 py-16 text-center text-sm text-muted-foreground">Selecione uma sequência para ver os disparos.</p>
        ) : loadingExec ? (
          <div className="flex items-center justify-center gap-3 py-16"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /><span className="text-sm text-muted-foreground">Carregando disparos…</span></div>
        ) : execError ? (
          <p className="px-6 py-16 text-center text-sm text-destructive">Não foi possível carregar os disparos ({execError}).</p>
        ) : rows.length === 0 ? (
          <div className="px-6 py-16 text-center"><p className="text-sm font-medium text-foreground">Nenhum disparo {filter === 'all' ? 'nos últimos 30 dias' : 'com esse filtro'}</p><p className="mt-1 text-sm text-muted-foreground">Os disparos aparecem aqui assim que a sequência começar a enviar.</p></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse">
              <thead>
                <tr className="border-y border-border text-left text-[13px] text-muted-foreground dark:border-[#1C1C1C]">
                  <th className="px-6 py-3 font-normal">Quando</th><th className="py-3 font-normal">Lead</th><th className="py-3 font-normal">Passo</th><th className="px-6 py-3 text-right font-normal">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, visible).map((e) => (
                  <tr key={e.id} className="border-b border-border last:border-b-0 dark:border-[#1C1C1C]">
                    <td className="whitespace-nowrap px-6 py-4 text-sm tabular-nums text-muted-foreground">{fmtWhen(e.ts)}</td>
                    <td className="py-4 text-[15px] font-semibold text-foreground">{e.lead}</td>
                    <td className="py-4 text-sm text-muted-foreground">{e.step}</td>
                    <td className="px-6 py-4 text-right"><span className={cn('rounded-full px-3 py-1 text-xs font-semibold', statusChip[e.status])}>{statusLabel[e.status] ?? e.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {rows.length > visible && (
              <button type="button" onClick={() => setVisible((v) => v + 20)} className="block w-full border-t border-border py-4 text-center text-sm font-semibold text-[#01573C] hover:underline dark:border-[#1C1C1C] dark:text-[#96F63C]">Ver mais</button>
            )}
          </div>
        )
      )}

      {tab === 'conversoes' && (
        <div className="px-6 pb-6">
          {loadingConv ? (
            <div className="flex items-center justify-center gap-3 py-16"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /><span className="text-sm text-muted-foreground">Carregando conversões…</span></div>
          ) : (
            <>
              <div className="mb-4 grid max-w-md grid-cols-2 gap-3">
                <div className="rounded-[14px] border border-border bg-card p-4"><p className="mb-1 text-xs text-muted-foreground">Leads convertidos</p><p className="text-2xl font-semibold text-foreground">{convTotal}</p></div>
                <div className="rounded-[14px] border border-border bg-card p-4"><p className="mb-1 text-xs text-muted-foreground">Taxa de conversão</p><p className="text-2xl font-semibold text-[#01573C] dark:text-[#96F63C]">{convRate}%</p></div>
              </div>
              {conversions.length === 0 ? (
                <div className="py-12 text-center"><p className="text-sm font-medium text-foreground">Nenhuma conversão registrada</p><p className="mt-1 text-sm text-muted-foreground">Adicione um passo Meta ao fluxo para acompanhar as conversões.</p></div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[560px] border-collapse">
                    <thead><tr className="border-y border-border text-left text-[13px] text-muted-foreground dark:border-[#1C1C1C]"><th className="py-3 font-normal">Quando</th><th className="py-3 font-normal">Lead</th><th className="py-3 font-normal">Meta</th><th className="py-3 text-right font-normal">Situação</th></tr></thead>
                    <tbody>
                      {conversions.slice(0, visible).map((c, i) => (
                        <tr key={`${c.lead_id}-${i}`} className="border-b border-border last:border-b-0 dark:border-[#1C1C1C]">
                          <td className="whitespace-nowrap py-4 text-sm tabular-nums text-muted-foreground">{fmtWhen(c.converted_at)}</td>
                          <td className="py-4 text-[15px] font-semibold text-foreground">{c.lead_name}</td>
                          <td className="py-4 text-sm text-muted-foreground">{c.goal_label}</td>
                          <td className="py-4 text-right"><span className="rounded-full bg-[#01573C]/10 px-3 py-1 text-xs font-semibold text-[#01573C] dark:bg-[#96F63C]/[0.14] dark:text-[#96F63C]">{c.lead_status}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {conversions.length > visible && <button type="button" onClick={() => setVisible((v) => v + 20)} className="block w-full border-t border-border py-4 text-center text-sm font-semibold text-[#01573C] hover:underline dark:border-[#1C1C1C] dark:text-[#96F63C]">Ver mais</button>}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Sequence tabs ───────────────────────────────────────────────────────────────

const SEQ_TABS: { label: string; tipo: SequenceTipo }[] = [
  { label: 'Follow-up', tipo: 'follow_geral' },
  { label: 'Anti-Noshow', tipo: 'anti_noshow' },
  { label: 'Remarketing', tipo: 'remarketing' },
  { label: 'Trial SaaS', tipo: 'trial_saas' },
  { label: 'Pagamento', tipo: 'pagamento' },
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

function ApprovalModal({ sequenceName, onConfirm, onClose }: { sequenceName: string; onConfirm: () => void; onClose: () => void }) {
  const [notes, setNotes] = useState('');
  return (
    <ModalOverlay onClose={onClose}>
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-96 p-5 flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-5 h-5 text-primary" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">Ativar sequência</p>
            <p className="text-xs text-muted-foreground">{sequenceName}</p>
          </div>
          <button onClick={onClose} className="ml-auto text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed -mt-1">
          Ao ativar, esta sequência começará a disparar mensagens automaticamente para leads qualificados. Revise o canvas antes de confirmar.
        </p>
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">Motivo / notas (opcional)</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Ex: Ativando para campanha de outubro…"
            className="field-input resize-none min-h-[60px] text-xs"
          />
        </div>
        <div className="flex gap-2">
          <button onClick={onClose}
            className="flex-1 py-2 rounded-xl border border-border text-sm text-muted-foreground hover:bg-muted transition-colors">
            Cancelar
          </button>
          <button onClick={onConfirm}
            className="flex-1 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity flex items-center justify-center gap-2">
            <ShieldCheck className="w-3.5 h-3.5" />Confirmar ativação
          </button>
        </div>
      </div>
    </ModalOverlay>
  );
}

const NOSHOW_DISPATCH_PHASES = [
  'Conectando à instância WhatsApp…',
  'Buscando leads com call agendada…',
  'Verificando nodes do canvas…',
  'Disparando mensagens…',
] as const;

const REMARKETING_DISPATCH_PHASES = [
  'Conectando à instância WhatsApp…',
  'Buscando leads no remarketing…',
  'Verificando nodes do canvas…',
  'Disparando mensagens…',
] as const;

// ─── Helpers anti-noshow offset ──────────────────────────────────────────────

/** value em minutos totais (inteiro). Negativo = antes da call. */
function formatHorasOffset(totalMins: number): string {
  if (totalMins === 0) return 'Na call'
  const abs = Math.abs(totalMins)
  const h = Math.floor(abs / 60)
  const m = abs % 60
  const suffix = totalMins < 0 ? 'antes' : 'pós'
  if (h === 0) return `${m}min ${suffix}`
  if (m === 0) return `${h}h ${suffix}`
  return `${h}h ${m}min ${suffix}`
}

/** Converte dia_offset para minutos independente da unit armazenada */
function offsetToMins(value: number, unit?: string): number {
  if (unit === 'minutes') return value
  // legacy: unit === 'hours' ou indefinido → valor em horas (pode ser decimal)
  return Math.round(value * 60)
}

const NOSHOW_PRESETS_ANTES = [
  { label: '5min',  mins: -5 },
  { label: '10min', mins: -10 },
  { label: '15min', mins: -15 },
  { label: '30min', mins: -30 },
  { label: '1h',    mins: -60 },
  { label: '2h',    mins: -120 },
  { label: '4h',    mins: -240 },
  { label: '24h',   mins: -1440 },
] as const

const NOSHOW_PRESETS_APOS = [
  { label: '5min',  mins: 5 },
  { label: '10min', mins: 10 },
  { label: '15min', mins: 15 },
  { label: '30min', mins: 30 },
  { label: '1h',    mins: 60 },
] as const

/** value e onChange sempre em minutos inteiros */
function AntiNoshowOffsetPicker({ value, onChange }: { value: number; onChange: (mins: number) => void }) {
  const isAfter = value > 0
  const presets = isAfter ? NOSHOW_PRESETS_APOS : NOSHOW_PRESETS_ANTES
  const isCustom = value !== 0 && !presets.some((p) => p.mins === value)

  return (
    <div className="flex flex-col gap-2.5">
      {/* Antes / Após */}
      <div className="flex rounded-xl border border-border overflow-hidden">
        <button type="button" onClick={() => onChange(-15)}
          className={cn('flex-1 py-1.5 text-xs font-semibold transition-colors',
            !isAfter ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground')}>
          Antes da call
        </button>
        <button type="button" onClick={() => onChange(5)}
          className={cn('flex-1 py-1.5 text-xs font-semibold transition-colors',
            isAfter ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground')}>
          Após a call
        </button>
      </div>

      {/* Presets */}
      <div className="flex flex-wrap gap-1.5">
        {presets.map((p) => (
          <button key={p.mins} type="button" onClick={() => onChange(p.mins)}
            className={cn(
              'px-3 py-1.5 rounded-lg text-xs font-medium border transition-all',
              value === p.mins
                ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                : 'bg-muted/50 border-border text-muted-foreground hover:text-foreground hover:border-primary/40',
            )}>
            {p.label}
          </button>
        ))}
      </div>

      {/* Resumo */}
      <p className={cn('text-[11px] text-center font-medium', isCustom ? 'text-amber-500' : 'text-primary/70')}>
        {isCustom ? `${formatHorasOffset(value)} (valor personalizado)` : formatHorasOffset(value)}
      </p>
    </div>
  )
}

function NoshowCronTestModal({ onClose }: { onClose: () => void }) {
  const [loading, setLoading] = useState(false);
  const [phase, setPhase] = useState(0);
  const [result, setResult] = useState<{ ok: boolean; disparados?: number; error?: string } | null>(null);

  useEffect(() => {
    if (!loading) return;
    setPhase(0);
    const iv = setInterval(() => setPhase((p) => Math.min(p + 1, NOSHOW_DISPATCH_PHASES.length - 1)), 1400);
    return () => clearInterval(iv);
  }, [loading]);

  async function handleDispatch() {
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch('/api/follow/antnoshow/force', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const json = await res.json();
      setResult(json);
    } catch (e: any) {
      setResult({ ok: false, error: e.message });
    } finally {
      setLoading(false);
    }
  }

  return (
    <ModalOverlay onClose={onClose}>
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-80 p-5 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-foreground">Disparar Anti-Noshow agora</p>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
        </div>
        <p className="text-xs text-muted-foreground -mt-2 leading-relaxed">
          Usa 100% os nodes do canvas. Ignora janela de tempo e dispara imediatamente para leads com call agendada.
        </p>

        {loading && (
          <div className="flex flex-col gap-1.5">
            {NOSHOW_DISPATCH_PHASES.map((label, i) => (
              <div key={i} className={cn(
                'flex items-center gap-2.5 px-3 py-2 rounded-lg border transition-all duration-300',
                i < phase ? 'bg-primary/8 border-primary/20 opacity-60' :
                i === phase ? 'bg-primary/10 border-primary/30' :
                'bg-muted/40 border-transparent opacity-30',
              )}>
                {i < phase
                  ? <CheckCircle2 className="w-3.5 h-3.5 text-primary shrink-0" />
                  : i === phase
                    ? <Loader2 className="w-3.5 h-3.5 text-primary animate-spin shrink-0" />
                    : <div className="w-3.5 h-3.5 rounded-full border border-muted-foreground/30 shrink-0" />}
                <span className={cn('text-xs', i <= phase ? 'text-foreground' : 'text-muted-foreground/40')}>{label}</span>
              </div>
            ))}
          </div>
        )}

        {result && !loading && (
          <div className={cn('flex flex-col gap-1.5')}>
            {result.error ? (
              <div className="px-3 py-2.5 rounded-xl text-xs leading-relaxed border bg-destructive/10 border-destructive/20 text-destructive">
                ✗ Erro: {result.error}
              </div>
            ) : (
              <>
                {NOSHOW_DISPATCH_PHASES.map((label, i) => (
                  <div key={i} className="flex items-center gap-2.5 px-3 py-2 rounded-lg border bg-primary/8 border-primary/20 opacity-70">
                    <CheckCircle2 className="w-3.5 h-3.5 text-primary shrink-0" />
                    <span className="text-xs text-foreground">{label}</span>
                  </div>
                ))}
                <div className="px-3 py-2.5 rounded-xl text-xs font-semibold border bg-primary/10 border-primary/30 text-primary mt-1">
                  ✓ Concluído: {result.disparados ?? 0} {result.disparados === 1 ? 'node disparado' : 'nodes disparados'}
                </div>
              </>
            )}
          </div>
        )}

        {!loading && !result && (
          <button
            onClick={handleDispatch}
            className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity flex items-center justify-center gap-2">
            <Zap className="w-3.5 h-3.5" />
            Disparar agora
          </button>
        )}
        {!loading && result && (
          <button
            onClick={() => { setResult(null); setPhase(0); }}
            className="w-full py-2 rounded-xl text-xs text-muted-foreground hover:text-foreground border border-border bg-muted/50 transition-colors">
            Disparar novamente
          </button>
        )}
      </div>
    </ModalOverlay>
  );
}

function RemarketingTestModal({ onClose }: { onClose: () => void }) {
  const [loading, setLoading] = useState(false);
  const [phase, setPhase] = useState(0);
  const [result, setResult] = useState<{ ok: boolean; sent?: number; error?: string } | null>(null);

  useEffect(() => {
    if (!loading) return;
    setPhase(0);
    const iv = setInterval(() => setPhase((p) => Math.min(p + 1, REMARKETING_DISPATCH_PHASES.length - 1)), 1400);
    return () => clearInterval(iv);
  }, [loading]);

  async function handleDispatch() {
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch('/api/follow/run-remarketing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ force: true }),
      });
      const json = await res.json();
      setResult(json);
    } catch (e: any) {
      setResult({ ok: false, error: e.message });
    } finally {
      setLoading(false);
    }
  }

  return (
    <ModalOverlay onClose={onClose}>
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-80 p-5 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-foreground">Disparar Remarketing agora</p>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
        </div>
        <p className="text-xs text-muted-foreground -mt-2 leading-relaxed">
          Dispara para todos os leads no status configurado. Ignora filtro de horário e dias de inatividade.
        </p>

        {loading && (
          <div className="flex flex-col gap-1.5">
            {REMARKETING_DISPATCH_PHASES.map((label, i) => (
              <div key={i} className={cn(
                'flex items-center gap-2.5 px-3 py-2 rounded-lg border transition-all duration-300',
                i < phase ? 'bg-primary/8 border-primary/20 opacity-60' :
                i === phase ? 'bg-primary/10 border-primary/30' :
                'bg-muted/40 border-transparent opacity-30',
              )}>
                {i < phase
                  ? <CheckCircle2 className="w-3.5 h-3.5 text-primary shrink-0" />
                  : i === phase
                    ? <Loader2 className="w-3.5 h-3.5 text-primary animate-spin shrink-0" />
                    : <div className="w-3.5 h-3.5 rounded-full border border-muted-foreground/30 shrink-0" />}
                <span className={cn('text-xs', i <= phase ? 'text-foreground' : 'text-muted-foreground/40')}>{label}</span>
              </div>
            ))}
          </div>
        )}

        {result && !loading && (
          <div className="flex flex-col gap-1.5">
            {result.error ? (
              <div className="px-3 py-2.5 rounded-xl text-xs leading-relaxed border bg-destructive/10 border-destructive/20 text-destructive">
                ✗ Erro: {result.error}
              </div>
            ) : (
              <>
                {REMARKETING_DISPATCH_PHASES.map((label, i) => (
                  <div key={i} className="flex items-center gap-2.5 px-3 py-2 rounded-lg border bg-primary/8 border-primary/20 opacity-70">
                    <CheckCircle2 className="w-3.5 h-3.5 text-primary shrink-0" />
                    <span className="text-xs text-foreground">{label}</span>
                  </div>
                ))}
                <div className="px-3 py-2.5 rounded-xl text-xs font-semibold border bg-primary/10 border-primary/30 text-primary mt-1">
                  ✓ Concluído: {result.sent ?? 0} {result.sent === 1 ? 'mensagem enviada' : 'mensagens enviadas'}
                </div>
              </>
            )}
          </div>
        )}

        {!loading && !result && (
          <button
            onClick={handleDispatch}
            className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity flex items-center justify-center gap-2">
            <Zap className="w-3.5 h-3.5" />
            Disparar agora
          </button>
        )}
        {!loading && result && (
          <button
            onClick={() => { setResult(null); setPhase(0); }}
            className="w-full py-2 rounded-xl text-xs text-muted-foreground hover:text-foreground border border-border bg-muted/50 transition-colors">
            Disparar novamente
          </button>
        )}
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

// ─── Version Diff Modal ──────────────────────────────────────────────────────────

function VersionDiffModal({ versions, onClose }: { versions: CanvasVersion[]; onClose: () => void }) {
  const [v1Idx, setV1Idx] = useState(Math.max(0, versions.length - 2));
  const [v2Idx, setV2Idx] = useState(Math.max(0, versions.length - 1));

  if (versions.length < 2) {
    return (
      <ModalOverlay onClose={onClose}>
        <div className="bg-card border border-border rounded-2xl shadow-2xl w-96 p-5 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">Comparar versões</p>
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
          </div>
          <p className="text-sm text-muted-foreground text-center py-6">Salve pelo menos 2 versões para comparar.</p>
        </div>
      </ModalOverlay>
    );
  }

  const v1 = versions[v1Idx];
  const v2 = versions[v2Idx];
  const v1Map = new Map(v1.nodes.map((n) => [n.id, n]));
  const v2Map = new Map(v2.nodes.map((n) => [n.id, n]));

  const added = v2.nodes.filter((n) => !v1Map.has(n.id));
  const removed = v1.nodes.filter((n) => !v2Map.has(n.id));
  const modified = v2.nodes.filter((n) => {
    const old = v1Map.get(n.id);
    if (!old) return false;
    return JSON.stringify(old.data) !== JSON.stringify(n.data) ||
      Math.abs(old.position.x - n.position.x) > 5 ||
      Math.abs(old.position.y - n.position.y) > 5;
  });

  const nodeLabel = (n: Node<AutoNodeData>) => {
    const d = n.data as any;
    return d.customLabel || d.label || d.kind || n.type || n.id;
  };
  const nodeType = (n: Node<AutoNodeData>) => String(n.type ?? '').replace('Node', '');

  const unchanged = v2.nodes.length - added.length - modified.length;

  return (
    <ModalOverlay onClose={onClose}>
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-[520px] max-h-[80vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border flex-shrink-0">
          <div className="flex items-center gap-2">
            <GitCompare className="w-4 h-4 text-muted-foreground" />
            <p className="text-sm font-semibold">Comparar versões</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-4 flex flex-col gap-4 overflow-y-auto flex-1">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">Versão anterior</label>
              <Select value={String(v1Idx)} onValueChange={(v) => setV1Idx(Number(v))}>
                <SelectTrigger className="h-[42px] rounded-xl border-border bg-muted text-sm dark:border-[#2A2A2A] dark:bg-[#181818]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {versions.map((v, i) => (
                    <SelectItem key={v.ts} value={String(i)}>{formatVersionLabel(v, i, versions.length)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">Versão nova</label>
              <Select value={String(v2Idx)} onValueChange={(v) => setV2Idx(Number(v))}>
                <SelectTrigger className="h-[42px] rounded-xl border-border bg-muted text-sm dark:border-[#2A2A2A] dark:bg-[#181818]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {versions.map((v, i) => (
                    <SelectItem key={v.ts} value={String(i)}>{formatVersionLabel(v, i, versions.length)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {v1Idx === v2Idx ? (
            <p className="text-sm text-muted-foreground text-center py-4">Selecione versões diferentes para comparar.</p>
          ) : added.length === 0 && removed.length === 0 && modified.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-6">
              <CheckCircle2 className="w-6 h-6 text-emerald-500" />
              <p className="text-sm text-muted-foreground">Nenhuma diferença: {unchanged} nós idênticos.</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-3 text-xs text-muted-foreground pb-1 border-b border-border">
                {added.length > 0 && <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold">+{added.length} adicionados</span>}
                {removed.length > 0 && <span className="flex items-center gap-1 text-destructive font-semibold">–{removed.length} removidos</span>}
                {modified.length > 0 && <span className="flex items-center gap-1 text-amber-500 font-semibold">~{modified.length} modificados</span>}
                {unchanged > 0 && <span className="text-muted-foreground/60">{unchanged} sem mudança</span>}
              </div>
              {added.length > 0 && (
                <div className="space-y-1">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-500 mb-1">Adicionados</p>
                  {added.map((n) => (
                    <div key={n.id} className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-emerald-500/8 border border-emerald-500/20">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                      <span className="text-xs font-medium text-foreground/80">{nodeLabel(n)}</span>
                      <span className="ml-auto text-[10px] text-muted-foreground font-mono">{nodeType(n)}</span>
                    </div>
                  ))}
                </div>
              )}
              {removed.length > 0 && (
                <div className="space-y-1">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-destructive mb-1">Removidos</p>
                  {removed.map((n) => (
                    <div key={n.id} className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-destructive/8 border border-destructive/20">
                      <span className="w-1.5 h-1.5 rounded-full bg-destructive shrink-0" />
                      <span className="text-xs font-medium text-foreground/80">{nodeLabel(n)}</span>
                      <span className="ml-auto text-[10px] text-muted-foreground font-mono">{nodeType(n)}</span>
                    </div>
                  ))}
                </div>
              )}
              {modified.length > 0 && (
                <div className="space-y-1">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-amber-500 mb-1">Modificados</p>
                  {modified.map((n) => (
                    <div key={n.id} className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-amber-500/8 border border-amber-500/20">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                      <span className="text-xs font-medium text-foreground/80">{nodeLabel(n)}</span>
                      <span className="ml-auto text-[10px] text-muted-foreground font-mono">{nodeType(n)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
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
  // Canal WhatsApp da empresa : Meta não tem lista/botões/carrossel livres,
  // esses tipos passam a exigir um Template HSM aprovado (ver TemplateSelector)
  const [whatsappProvider, setWhatsappProvider] = useState<'uazapi' | 'meta'>('uazapi');
  useEffect(() => {
    fetch('/api/sdr/config')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d?.config?.whatsapp_provider) setWhatsappProvider(d.config.whatsapp_provider); })
      .catch(() => {});
  }, []);
  const [activeTipo, setActiveTipo] = useState<SequenceTipo>('follow_geral');
  const [activeSeqId, setActiveSeqId] = useState<string | null>(null);
  const [sequences, setSequences] = useState<FollowSequence[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveOk, setSaveOk] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [nodeExecError, setNodeExecError] = useState<{ name: string; msg: string } | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [newFlowName, setNewFlowName] = useState('');
  const [newFlowModalOpen, setNewFlowModalOpen] = useState(false);

  const [seqDropdownOpen, setSeqDropdownOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [summary, setSummary] = useState<{ sent30: number; leads30: number } | null>(null);
  const [stepTestId, setStepTestId] = useState<string | null>(null);
  const [addSize, setAddSize] = useState<{ width: number; height: number } | null>(null);
  const [newFlowTipo, setNewFlowTipo] = useState<SequenceTipo>('follow_geral');

  // Versioning
  const [versionsOpen, setVersionsOpen] = useState(false);
  const [diffOpen, setDiffOpen] = useState(false);
  const [versions, setVersions] = useState<CanvasVersion[]>([]);

  // Staging + Approval
  const [stagingLoading, setStagingLoading] = useState(false);
  const [approvalModalOpen, setApprovalModalOpen] = useState(false);

  // Templates
  const [templatesOpen, setTemplatesOpen] = useState(false);

  // Test run
  const [testModalOpen, setTestModalOpen] = useState(false);
  const [noshowCronTestOpen, setNoshowCronTestOpen] = useState(false);
  const [remarketingTestOpen, setRemarketingTestOpen] = useState(false);
  const [testRunning, setTestRunning] = useState(false);
  const [testWaitingReply, setTestWaitingReply] = useState(false);
  const abortTestRef = useRef(false);

  // Conflict
  const conflictCount = sequences.filter((s) => s.ativo).length;

  const seqsInCategory = sequences.filter((s) => s.tipo === activeTipo);
  const currentSeq = sequences.find((s) => s.id === activeSeqId) ?? null;

  // Remarketing entry config (persisted in canvas_config.remarketing)
  const [remarketingCfg, setRemarketingCfg] = useState<RemarketingConfig>({
    statusFiltros: ['Remarketing'],
    diasInativo: 0,
  });

  useEffect(() => {
    if (activeTipo === 'remarketing') {
      const saved = currentSeq?.canvas_config?.remarketing;
      setRemarketingCfg(saved ?? { statusFiltros: ['Remarketing'], diasInativo: 0 });
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
        const seqs = json.sequences ?? [];
        setSequences(seqs);
        // Auto-select first sequence in active category
        const first = seqs.find((s) => s.tipo === activeTipo);
        if (first) setActiveSeqId(first.id);
      } catch (err) { console.error('[AutomationCanvas]', err); }
      finally { setLoading(false); }
    }
    load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-select first sequence when category changes
  useEffect(() => {
    setActiveSeqId((cur) => {
      const curSeq = sequences.find((s) => s.id === cur);
      if (curSeq && curSeq.tipo === activeTipo) return cur;
      return sequences.find((s) => s.tipo === activeTipo)?.id ?? null;
    });
  }, [activeTipo]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setSummary(null);
    const id = currentSeq?.id;
    if (!id || id.startsWith('new')) return;
    let cancelled = false;
    fetch(`/api/follow/sequences/${id}/summary`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d && !cancelled) setSummary(d); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [currentSeq?.id]);

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
    const anchor = chainEnd;
    const center = screenToFlowPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
    const lastDay = anchor?.data.kind === 'message' && (anchor.data.offset_unit ?? 'days') === 'days' ? anchor.data.dia_offset : 0;
    let data: AutoNodeData;
    if (kind === 'message') data = { kind: 'message', label: 'Mensagem', dia_offset: lastDay + 1, horario: '09:00', mensagem: '', tipo_mensagem: 'texto', stepId: id } satisfies MessageNodeData;
    else if (kind === 'wait') data = { kind: 'wait', label: 'Aguardar', dia_offset: 1, stepId: id } satisfies WaitNodeData;
    else if (kind === 'condition') data = { kind: 'condition', label: 'Condição', condicao: 'Respondeu?', variavel: 'resposta_botao', operador: 'eq', valor: '', stepId: id } satisfies ConditionNodeData;
    else if (kind === 'switch') data = { kind: 'switch', label: 'Switch', variavel: 'resposta_botao', cases: [{ value: '', label: 'Caso 1' }], stepId: id } satisfies SwitchNodeData;
    else if (kind === 'webhook') data = { kind: 'webhook', label: 'Webhook', url: '', method: 'POST', stepId: id } satisfies WebhookNodeData;
    else if (kind === 'lead_score') data = { kind: 'lead_score', label: 'Lead Score', scoreMin: 60, scoreMax: 100, stepId: id } satisfies LeadScoreNodeData;
    else if (kind === 'ab_test') data = { kind: 'ab_test', label: 'Teste A/B', variantA: 'Variante A', variantB: 'Variante B', stepId: id } satisfies ABTestNodeData;
    else if (kind === 'scheduling') data = { kind: 'scheduling', label: 'Agendar Call', dia_offset: 0, horario: '09:00', duracao: 60, mensagemInicial: '', stepId: id } satisfies SchedulingNodeData;
    else if (kind === 'goal') data = { kind: 'goal', label: 'Meta', marcarStatus: 'Convertido', stepId: id } satisfies GoalNodeData;
    else if (kind === 'sentiment') data = { kind: 'sentiment', label: 'Sentimento', stepId: id } satisfies SentimentNodeData;
    else if (kind === 'wait_event') data = { kind: 'wait_event', label: 'Aguardar Evento', event: 'reply', pattern: '', stepId: id } satisfies WaitEventNodeData;
    else if (kind === 'sub_flow') data = { kind: 'sub_flow', label: 'Sub-fluxo', subSequenceId: '', subSequenceName: '', stepId: id } satisfies SubFlowNodeData;
    else if (kind === 'post_condition') data = { kind: 'post_condition', label: 'Pós-Condição', mensagem: '', tipo_mensagem: 'texto', stepId: id } satisfies PostConditionNodeData;
    else if (kind === 'gerar_cobranca') data = { kind: 'gerar_cobranca', label: 'Gerar Cobrança', billingType: 'PIX', value: 0, description: '', daysUntilDue: 3, sendWhatsapp: true, stepId: id } satisfies GerarCobrancaNodeData;
    else if (kind === 'aguardar_pagamento') data = { kind: 'aguardar_pagamento', label: 'Aguardar Pagamento', timeoutDays: 7, stepId: id } satisfies AguardarPagamentoNodeData;
    else data = { kind: 'end', label: 'Encerrar', stepId: id } satisfies EndNodeData;

    const typeMap: Record<PaletteKind, string> = {
      message: 'messageNode', wait: 'waitNode', wait_event: 'waitEventNode', sub_flow: 'subFlowNode',
      condition: 'conditionNode', switch: 'switchNode', end: 'endNode',
      goal: 'goalNode', sentiment: 'sentimentNode', webhook: 'webhookNode', lead_score: 'leadScoreNode', ab_test: 'abTestNode', scheduling: 'schedulingNode',
      post_condition: 'postConditionNode', gerar_cobranca: 'gerarCobrancaNode', aguardar_pagamento: 'aguardarPagamentoNode',
    };

    const position = anchor
      ? { x: anchor.position.x + (anchor.measured?.width ?? 208) + 112, y: anchor.position.y + (anchor.measured?.height ?? 168) / 2 - 84 }
      : { x: center.x - 105, y: center.y - 60 };
    const newNode: Node<AutoNodeData> = {
      id,
      type: typeMap[kind],
      position,
      data,
      selected: true,
    };
    setNodes((nds) => [...nds.map((n) => ({ ...n, selected: false })), newNode]);
    if (anchor) setEdges((eds) => [...eds, { id: `e-${anchor.id}-${id}`, source: anchor.id, target: id, ...EDGE_BASE }]);
    setSelectedNodeId(id);
  }

  function handleUpdateNode(id: string, patch: Partial<AutoNodeData>) {
    setNodes((nds) => nds.map((n) => n.id === id ? { ...n, data: { ...n.data, ...patch } as AutoNodeData } : n));
  }

  function handleDeleteNode(id: string) {
    setNodes((nds) => nds.filter((n) => n.id !== id));
    setEdges((eds) => eds.filter((e) => (e as Edge).source !== id && (e as Edge).target !== id));
  }

  function addPaymentTrigger(platform: 'mercadopago' | 'kiwify' | 'asaas') {
    const id = `trigger-${newId()}`;
    const existingTriggers = nodes.filter((n) => n.data.kind === 'trigger');
    const lastTrigger = existingTriggers[existingTriggers.length - 1];
    const pos = lastTrigger
      ? { x: lastTrigger.position.x, y: lastTrigger.position.y + 160 }
      : { x: 0, y: 310 };
    const anyTrigger = nodes.find((n) => n.data.kind === 'trigger');
    const seqName = (anyTrigger?.data as TriggerNodeData | undefined)?.label ?? currentSeq?.nome ?? 'Pagamento';
    const eventoEntrada: TriggerNodeData['eventoEntrada'] = platform === 'asaas' ? 'asaas_pago' : platform;
    setNodes((nds) => [...nds, {
      id, type: 'triggerNode', position: pos,
      data: { kind: 'trigger', label: seqName, condicao: 'Início da sequência', platform, eventoEntrada } satisfies TriggerNodeData,
    }]);
  }

  async function toggleAtivo() {
    if (!currentSeq) return;
    const nextAtivo = !currentSeq.ativo;
    // Show approval modal when activating for the first time
    if (nextAtivo && !currentSeq.ativo) {
      setApprovalModalOpen(true);
      return;
    }
    try {
      const res = await fetch(`/api/follow/sequences/${currentSeq.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ativo: nextAtivo }) });
      if (!res.ok) throw new Error('patch failed');
      setSequences((seqs) => seqs.map((s) => s.id === currentSeq.id ? { ...s, ativo: nextAtivo } : s));
    } catch (err) { console.error('[AutomationCanvas] toggle', err); }
  }

  async function confirmAtivo() {
    if (!currentSeq) return;
    setApprovalModalOpen(false);
    try {
      const res = await fetch(`/api/follow/sequences/${currentSeq.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ativo: true }) });
      if (!res.ok) throw new Error('patch failed');
      setSequences((seqs) => seqs.map((s) => s.id === currentSeq.id ? { ...s, ativo: true } : s));
    } catch (err) { console.error('[AutomationCanvas] confirm ativo', err); }
  }

  async function toggleStaging() {
    if (!currentSeq) return;
    const nextStaging = !(currentSeq.staging ?? false);
    setStagingLoading(true);
    try {
      const res = await fetch(`/api/follow/sequences/${currentSeq.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ staging: nextStaging }) });
      if (!res.ok) throw new Error('patch failed');
      setSequences((seqs) => seqs.map((s) => s.id === currentSeq.id ? { ...s, staging: nextStaging } : s));
    } catch (err) { console.error('[AutomationCanvas] toggleStaging', err); }
    finally { setStagingLoading(false); }
  }

  async function createSequence(name?: string, tipo: SequenceTipo = activeTipo) {
    const categoryLabels: Record<SequenceTipo, string> = { follow_geral: 'Follow-up', anti_noshow: 'Anti-Noshow', remarketing: 'Remarketing', trial_saas: 'Trial SaaS', pagamento: 'Pagamento' };
    const count = sequences.filter((s) => s.tipo === tipo).length + 1;
    const nome = name?.trim() || `${categoryLabels[tipo]} ${count}`;
    try {
      setLoading(true);
      const res = await fetch('/api/follow/sequences', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nome, tipo, ativo: false, steps: [] }) });
      if (!res.ok) throw new Error('post failed');
      const json = (await res.json()) as { sequence?: FollowSequence; sequences?: FollowSequence[] };
      if (json.sequence) {
        setSequences((seqs) => [...seqs, json.sequence!]);
        setActiveTipo(tipo);
        setActiveSeqId(json.sequence!.id);
      } else if (json.sequences) {
        setSequences(json.sequences);
        const newest = json.sequences.filter((s) => s.tipo === tipo).at(-1);
        if (newest) { setActiveTipo(tipo); setActiveSeqId(newest.id); }
      }
    } catch (err) { console.error('[AutomationCanvas] create', err); }
    finally { setLoading(false); }
  }

  async function deleteSequence(seqId: string) {
    if (!window.confirm('Deletar este fluxo? Esta ação não pode ser desfeita.')) return;
    try {
      const res = await fetch(`/api/follow/sequences/${seqId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('delete failed');
      setSequences((seqs) => {
        const updated = seqs.filter((s) => s.id !== seqId);
        const next = updated.find((s) => s.tipo === activeTipo) ?? updated[0];
        if (next) setActiveTipo(next.tipo);
        setActiveSeqId(next?.id ?? null);
        return updated;
      });
    } catch (err) { console.error('[AutomationCanvas] delete', err); }
  }

  async function handleSave() {
    if (!currentSeq) return;
    setSaving(true);
    setSaveError(null);
    try {
      saveVersion(currentSeq.id, nodes, edges);
      setVersions(loadVersions(currentSeq.id));

      const steps = nodesToSteps(nodes);

      // Popula condicao_estagio dinamicamente percorrendo o grafo de edges.
      // Ramo "Sim" da condição → condicao_estagio = valor da condição
      // Ramo "Não" da condição → condicao_estagio = "!" + valor (negação, dinâmica)
      {
        const sortedForMap = nodes.filter(n => n.id !== 'trigger').sort((a, b) => a.position.x - b.position.x);
        const stepByNodeId = new Map<string, any>();
        sortedForMap.forEach((n, i) => { if (steps[i]) stepByNodeId.set(n.id, steps[i]); });
        const nodeById2 = new Map(nodes.map(n => [n.id, n]));

        // Salva buttonChoices no media_config da condição: quais choices do botão predecessor são válidas.
        // O engine usa isso para só avaliar a condição quando o lead clicou um botão real.
        for (const node of nodes) {
          if (node.data.kind !== 'condition') continue;
          if ((node.data as any).variavel !== 'custom') continue;
          // Encontra o node botão que conecta a esta condição
          for (const edge of edges) {
            if (edge.target !== node.id) continue;
            const srcNode = nodeById2.get(edge.source);
            if (!srcNode || srcNode.data.kind !== 'message') continue;
            const mc = (srcNode.data as any).media_config ?? {};
            const choices: string[] = Array.isArray(mc.choices) ? mc.choices : [];
            if (!choices.length) continue;
            const condStep = stepByNodeId.get(node.id);
            if (condStep) condStep.media_config = { ...(condStep.media_config ?? {}), buttonChoices: choices };
            break;
          }
        }

        for (const node of nodes) {
          if (node.data.kind !== 'condition') continue;
          const valor = String((node.data as any).valor ?? '').trim();
          if (!valor) continue;

          for (const edge of edges) {
            if (edge.source !== node.id) continue;
            const estagio = edge.sourceHandle === 'sim' ? valor : `!${valor}`;
            // BFS: percorre downstream, para em outros nós de condição
            const queue: string[] = [edge.target];
            const seen = new Set<string>();
            while (queue.length) {
              const nid = queue.shift()!;
              if (!nid || seen.has(nid) || nid === 'trigger' || nid.startsWith('trigger-')) continue;
              seen.add(nid);
              const n = nodeById2.get(nid);
              if (!n || n.data.kind === 'condition') continue;
              const step = stepByNodeId.get(nid);
              if (step && step.condicao_estagio == null) step.condicao_estagio = estagio;
              for (const e of edges) {
                if (e.source === nid && !seen.has(e.target)) queue.push(e.target);
              }
            }
          }
        }
      }

      const triggerNode = nodes.find((n) => n.id === 'trigger');
      const noDefaultTrigger = !triggerNode; // primary trigger was deleted
      const nome = (triggerNode?.data as TriggerNodeData | undefined)?.label ?? currentSeq.nome;

      // Extra trigger nodes (pagamento only): stable negative indices for edge map
      const extraTriggerNodes = nodes.filter((n) => n.data.kind === 'trigger' && n.id !== 'trigger');
      const triggerIdToIdx: Record<string, number> = noDefaultTrigger ? {} : { trigger: -1 };
      extraTriggerNodes.forEach((n, i) => { triggerIdToIdx[n.id] = -(i + 2); });

      // Build canvas_config: positions + edges indexed by x-sorted order so they survive UUID rotation
      const nonTrigger = [...nodes.filter((n) => n.data.kind !== 'trigger')].sort((a, b) => a.position.x - b.position.x);
      const idToIdx: Record<string, number> = {};
      nonTrigger.forEach((n, i) => { idToIdx[n.id] = i; });
      // Collect custom labels and comments from all nodes (keyed by stepId)
      const customLabels: Record<string, string> = {};
      const nodeComments: Record<string, string> = {};
      nodes.forEach((n) => {
        const cl = (n.data as any).customLabel as string | undefined;
        const cm = (n.data as any).comment as string | undefined;
        const sid = (n.data as any).stepId as string | undefined;
        if (cl && sid) customLabels[sid] = cl;
        if (cm && sid) nodeComments[sid] = cm;
      });

      const triggerData = triggerNode?.data as TriggerNodeData | undefined;
      const triggerExpiry = triggerData?.expira_em_dias ?? 0;
      const eventoEntrada = triggerData?.eventoEntrada;

      const nodeIdToIdx = (nodeId: string): number | undefined => {
        if (triggerIdToIdx[nodeId] !== undefined) return triggerIdToIdx[nodeId];
        return idToIdx[nodeId];
      };

      const canvas_config: CanvasConfig = {
        triggerPos: triggerNode?.position ?? { x: 0, y: 150 },
        positions: nonTrigger.map((n) => ({ x: n.position.x, y: n.position.y })),
        edges: edges
          .map((e) => ({
            sourceIdx: nodeIdToIdx(e.source),
            targetIdx: nodeIdToIdx(e.target),
            sourceHandle: (e.sourceHandle ?? undefined) as string | undefined,
            targetHandle: (e.targetHandle ?? undefined) as string | undefined,
          }))
          .filter((e) => e.sourceIdx !== undefined && e.targetIdx !== undefined) as CanvasConfigEdge[],
        ...(currentSeq.tipo === 'remarketing' ? { remarketing: remarketingCfg } : {}),
        ...(Object.keys(customLabels).length > 0 ? { customLabels } : {}),
        ...(Object.keys(nodeComments).length > 0 ? { nodeComments } : {}),
        ...(triggerExpiry > 0 ? { expira_em_dias: triggerExpiry } : {}),
        ...(eventoEntrada ? { eventoEntrada } : {}),
        ...(noDefaultTrigger ? { noDefaultTrigger: true } : {}),
        ...(extraTriggerNodes.length > 0 ? {
          extraTriggers: extraTriggerNodes.map((n) => {
            const nd = n.data as TriggerNodeData;
            const plat = (nd.platform ?? 'mercadopago') as 'mercadopago' | 'kiwify' | 'asaas';
            return {
              id: n.id,
              platform: plat,
              position: n.position,
              ...(plat === 'asaas' && nd.eventoEntrada ? { eventoEntrada: nd.eventoEntrada } : {}),
            };
          })
        } : {}),
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
          const nt = [...nds.filter((n) => n.data.kind !== 'trigger')].sort((a, b) => a.position.x - b.position.x);
          return nds.map((n) => {
            if (n.data.kind === 'trigger') return n;
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
        type StepStats = { total: number; sent: number; failed: number; skipped: number; dlq: number };
        const { counts } = await res.json() as { counts: Record<string, StepStats | number> };
        setNodes((nds) => nds.map((n) => {
          const raw = counts[String((n.data as any).stepId)];
          if (!raw) return n;
          const stats = typeof raw === 'number' ? { total: raw, sent: raw, failed: 0, skipped: 0, dlq: 0 } : raw;
          const cur = n.data as any;
          if (stats.total === cur._leadCount && stats.sent === cur._sentCount && stats.dlq === cur._dlqCount) return n;
          return { ...n, data: { ...n.data, _leadCount: stats.total, _sentCount: stats.sent, _failedCount: stats.failed, _dlqCount: stats.dlq } as AutoNodeData };
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

  function markEdgeTraversed(edgeId: string, success = true) {
    setEdges((eds) => eds.map((e) =>
      e.id === edgeId
        ? { ...e, animated: true, style: { ...e.style, stroke: success ? '#01573C' : '#ef4444', strokeWidth: 2.5 } }
        : e
    ));
  }

  function clearAllExecEdges() {
    setEdges((eds) => eds.map((e) => {
      const { stroke: _s, strokeWidth: _sw, ...restStyle } = (e.style ?? {}) as any;
      return { ...e, animated: false, style: Object.keys(restStyle).length ? restStyle : undefined };
    }));
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

  // baselineCount: número de mensagens inbound no momento anterior ao envio: detecta nova resposta por contagem
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
    clearAllExecStates();
    clearAllExecEdges();

    // Find conversation for this phone (needed for reply polling)
    let conversaId: string | null = null;
    try {
      const r = await fetch(`/api/follow/conversa-for-phone?phone=${encodeURIComponent(phone)}`);
      const j = await r.json();
      conversaId = j.conversaId ?? null;
    } catch {}

    // Build adjacency map
    const edgeMap: Record<string, { targetId: string; sourceHandle?: string; edgeId: string }[]> = {};
    edges.forEach((e) => {
      if (!edgeMap[e.source]) edgeMap[e.source] = [];
      edgeMap[e.source].push({ targetId: e.target, sourceHandle: e.sourceHandle ?? undefined, edgeId: e.id });
    });
    const nodeMap: Record<string, Node<AutoNodeData>> = {};
    nodes.forEach((n) => { nodeMap[n.id] = n; });

    let currentId: string | null = 'trigger';
    const visited = new Set<string>();
    // Baseline capturado ANTES de cada mensagem enviada: condition node usa para detectar respostas chegadas durante o envio
    let replyBaselineCount: number | undefined = undefined;

    while (currentId && !abortTestRef.current) {
      if (visited.has(currentId)) break;
      visited.add(currentId);

      const node: Node<AutoNodeData> | undefined = nodeMap[currentId];
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
          // Captura baseline ANTES do envio: garante que respostas rápidas (botões) sejam detectadas pela condição seguinte
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
          setNodeExecState(node.id, 'success', 'Agente de agendamento ativado: SDR assume a conversa');
          break; // real executor hands off to SDR; test stops here
        } else if (d.kind === 'post_condition') {
          if (String(d.stepId ?? '').startsWith('new-')) {
            throw new Error('Salve a sequência antes de executar o teste');
          }
          const res = await fetch(`/api/follow/sequences/${currentSeq!.id}/send-test`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ stepId: d.stepId, phone }),
          });
          if (!res.ok) {
            const errJson = await res.json().catch(() => ({}));
            throw new Error((errJson as any).error ?? `HTTP ${res.status}`);
          }
          setNodeExecState(node.id, 'success');
        } else if (d.kind === 'wait_event') {
          if (!conversaId) throw new Error('Nenhuma conversa encontrada para este número.');
          const wd = d as WaitEventNodeData;
          setTestWaitingReply(true);
          const reply = await waitForLeadReply(conversaId, 120_000, replyBaselineCount);
          replyBaselineCount = undefined;
          setTestWaitingReply(false);
          if (abortTestRef.current) break;
          const matched = wd.event !== 'keyword' || !wd.pattern || reply.toLowerCase().includes(wd.pattern.toLowerCase());
          if (matched) {
            setNodeExecState(node.id, 'success');
          } else {
            setNodeExecState(node.id, 'skipped', `Resposta "${reply}" não contém "${wd.pattern}"`);
            break;
          }
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

      const outgoing: { targetId: string; sourceHandle?: string; edgeId: string }[] = edgeMap[node.id] ?? [];
      const hasHandles = outgoing.some((e: { targetId: string; sourceHandle?: string; edgeId: string }) => e.sourceHandle);
      const next = chosenHandle
        ? (hasHandles
            ? outgoing.find((e: { targetId: string; sourceHandle?: string; edgeId: string }) => e.sourceHandle === chosenHandle)
            : chosenHandle === 'nao' ? outgoing[outgoing.length - 1] : outgoing[0])
        : outgoing[0];
      if (next?.edgeId) markEdgeTraversed(next.edgeId, chosenHandle !== 'nao');
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
    clearAllExecEdges();
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

  const isDark = useIsDark();

  const msgIndexById = useMemo(() => {
    const msgs = nodes.filter((n) => n.data.kind === 'message').sort((a, b) => a.position.x - b.position.x);
    return new Map(msgs.map((n, i) => [n.id, i + 1]));
  }, [nodes]);

  // Última ponta da sequência: onde um novo passo entra e é ligado automaticamente
  const chainEnd = useMemo(() => {
    const withOut = new Set(edges.map((e) => e.source));
    const open = nodes.filter((n) => !withOut.has(n.id));
    if (open.length === 0) return null;
    const last = open.reduce((a, b) => (b.position.x > a.position.x ? b : a));
    return NO_CHAIN_KINDS.includes(last.data.kind as string) ? null : last;
  }, [nodes, edges]);

  const displayNodes = useMemo(() => {
    const base = nodes.map((n) => (n.data.kind === 'message' ? { ...n, data: { ...n.data, _msgIndex: msgIndexById.get(n.id) } as AutoNodeData } : n));
    if (!chainEnd) return base;
    const w = chainEnd.measured?.width ?? 208;
    const h = chainEnd.measured?.height ?? 168;
    const add = {
      id: ADD_NODE_ID, type: 'addNode',
      position: { x: chainEnd.position.x + w + 52, y: chainEnd.position.y + h / 2 - 16 },
      data: { kind: 'add' } as unknown as AutoNodeData,
      draggable: false, selectable: false, deletable: false, connectable: false, focusable: false,
      measured: addSize ?? undefined,
    } as Node<AutoNodeData>;
    return [...base, add];
  }, [nodes, msgIndexById, chainEnd, addSize]);

  const displayEdges = useMemo(() => chainEnd ? [...edges, {
    id: '__add_edge__', source: chainEnd.id, target: ADD_NODE_ID, type: 'straight',
    style: { stroke: 'var(--zp-edge, #3A3A3A)', strokeWidth: 2, strokeDasharray: '6 5' },
    selectable: false, deletable: false, focusable: false, reconnectable: false,
  } as Edge] : edges, [edges, chainEnd]);

  const handleNodesChange = useCallback((changes: NodeChange<Node<AutoNodeData>>[]) => {
    const rest: NodeChange<Node<AutoNodeData>>[] = [];
    for (const c of changes) {
      if ('id' in c && c.id === ADD_NODE_ID) {
        if (c.type === 'dimensions' && c.dimensions) setAddSize(c.dimensions);
        continue;
      }
      rest.push(c);
    }
    if (rest.length) onNodesChange(rest);
  }, [onNodesChange]);

  function duplicateNodeById(id: string) {
    const node = nodes.find((n) => n.id === id);
    if (!node) return;
    const newNodeId = newId();
    const duplicated: Node<AutoNodeData> = {
      ...node,
      id: newNodeId,
      position: { x: node.position.x + 40, y: node.position.y + 40 },
      data: { ...node.data, stepId: newNodeId } as AutoNodeData,
      selected: true,
    };
    setNodes((nds) => [...nds.map((n) => ({ ...n, selected: false })), duplicated]);
    setSelectedNodeId(newNodeId);
  }

  async function runStepTest(nodeId: string, phone: string) {
    const node = nodes.find((n) => n.id === nodeId);
    if (!node || !currentSeq) return;
    const d = node.data as { stepId?: string; customLabel?: string; label?: string };
    const name = d.customLabel || d.label || 'passo';
    if (String(d.stepId ?? '').startsWith('new-')) {
      setNodeExecError({ name, msg: 'Salve a sequência antes de testar este passo.' });
      return;
    }
    setNodeExecError(null);
    setNodeExecState(nodeId, 'running');
    try {
      const res = await fetch(`/api/follow/sequences/${currentSeq.id}/send-test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stepId: d.stepId, phone }),
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error((errJson as { error?: string }).error ?? `HTTP ${res.status}`);
      }
      setNodeExecState(nodeId, 'success');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Não foi possível enviar o teste';
      setNodeExecState(nodeId, 'error', msg);
      setNodeExecError({ name, msg });
    }
    setTimeout(() => setNodeExecState(nodeId, 'idle'), 4000);
  }

  const actions: CanvasActions = {
    testNode: (id) => { setStepTestId(id); setTestModalOpen(true); },
    duplicateNode: duplicateNodeById,
    deleteNode: (id) => { handleDeleteNode(id); setSelectedNodeId(null); },
    openPalette: () => { setSelectedNodeId(null); setPaletteOpen(true); },
  };

  const pill3d = 'flex h-10 items-center justify-center rounded-full bg-[#141414] text-sm font-semibold text-white shadow-[inset_0_1px_0_#FFFFFF14,0_3px_0_#000000] transition-transform active:translate-y-px disabled:opacity-60';
  const menuItem = 'flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm text-foreground transition-colors hover:bg-muted';
  const anyDropdown = seqDropdownOpen || menuOpen;
  const catLabel = SEQ_TABS.find((t) => t.tipo === (currentSeq?.tipo ?? activeTipo))?.label ?? 'Sequência';
  const summaryText = !currentSeq ? '' : summary == null ? '' : summary.sent30 === 0
    ? 'Nenhum envio nos últimos 30 dias'
    : `${summary.sent30} ${summary.sent30 === 1 ? 'envio' : 'envios'} para ${summary.leads30} ${summary.leads30 === 1 ? 'lead' : 'leads'} em 30 dias`;
  const anchorTitle = chainEnd
    ? ((chainEnd.data.customLabel as string | undefined) || (chainEnd.data.kind === 'message' && msgIndexById.get(chainEnd.id) ? `Mensagem ${msgIndexById.get(chainEnd.id)}` : (KIND_VISUAL[chainEnd.data.kind as string]?.title ?? 'passo')))
    : undefined;

  return (
    <CanvasActionsCtx.Provider value={actions}>
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-border bg-card dark:border-[#1C1C1C] dark:bg-[#101010]">
      {anyDropdown && <div className="fixed inset-0 z-20" onClick={() => { setSeqDropdownOpen(false); setMenuOpen(false); }} />}

      {/* Top bar */}
      <div className="flex flex-shrink-0 flex-wrap items-center justify-between gap-4 px-6 py-[18px]">
        <div className="flex min-w-0 items-center gap-[18px]">
          <div className="relative z-30">
            <button
              type="button"
              onClick={() => { setSeqDropdownOpen((v) => !v); setMenuOpen(false); }}
              aria-haspopup="listbox"
              aria-expanded={seqDropdownOpen}
              className="flex items-center gap-3 rounded-xl border border-border bg-muted px-4 py-2.5 text-left transition-colors hover:bg-accent dark:border-[#242424] dark:bg-[#141414] dark:hover:bg-[#181818]"
            >
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="text-xs leading-4 text-muted-foreground">{catLabel}</span>
                <span className="max-w-[280px] truncate text-base font-semibold leading-5 text-foreground">{currentSeq?.nome ?? 'Nenhuma sequência'}</span>
              </span>
              <ChevronDown className={cn('h-4 w-4 shrink-0 text-muted-foreground transition-transform', seqDropdownOpen && 'rotate-180')} />
            </button>
            {seqDropdownOpen && (
              <div className="absolute left-0 top-full mt-2 max-h-[420px] w-80 overflow-y-auto rounded-xl border border-border bg-card p-1.5 shadow-xl dark:border-[#2A2A2A] dark:bg-[#141414]">
                {SEQ_TABS.filter((t) => sequences.some((s) => s.tipo === t.tipo)).map((t) => (
                  <div key={t.tipo} className="flex flex-col gap-0.5 pb-1">
                    <p className="px-2.5 pb-1 pt-2 text-[12.5px] font-semibold text-muted-foreground">{t.label}</p>
                    {sequences.filter((s) => s.tipo === t.tipo).map((seq) => (
                      <button
                        key={seq.id}
                        type="button"
                        onClick={() => { setActiveTipo(seq.tipo); setActiveSeqId(seq.id); setSeqDropdownOpen(false); }}
                        className={cn('flex items-center justify-between gap-2 rounded-lg px-2.5 py-2.5 text-left text-sm transition-colors hover:bg-muted', seq.id === activeSeqId ? 'bg-muted font-semibold text-foreground' : 'text-foreground/90')}
                      >
                        <span className="truncate">{seq.nome}</span>
                        <span className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
                          <span className={cn('h-1.5 w-1.5 rounded-full', seq.ativo ? 'bg-[#01573C] dark:bg-[#96F63C]' : 'bg-muted-foreground/40')} />
                          {seq.ativo ? 'Ligada' : 'Desligada'}
                        </span>
                      </button>
                    ))}
                  </div>
                ))}
                <div className="mt-1 border-t border-border pt-1.5 dark:border-[#2A2A2A]">
                  <button type="button" onClick={() => { setSeqDropdownOpen(false); setNewFlowName(''); setNewFlowTipo(currentSeq?.tipo ?? activeTipo); setNewFlowModalOpen(true); }} className={cn(menuItem, 'font-semibold text-[#01573C] dark:text-[#96F63C]')}>
                    <Plus className="h-4 w-4" />Nova sequência
                  </button>
                </div>
              </div>
            )}
          </div>
          {summaryText && <p className="hidden text-sm text-muted-foreground md:block">{summaryText}</p>}
        </div>

        {currentSeq && (
          <div className="flex flex-shrink-0 items-center gap-3.5">
            <div className="flex items-center rounded-full bg-muted p-[3px] dark:bg-[#141414]" role="tablist" aria-label="Modo">
              {(['editor', 'execucoes'] as const).map((m) => (
                <button key={m} type="button" role="tab" aria-selected={mode === m} onClick={() => setMode(m)}
                  className={cn('rounded-full px-4 py-[7px] text-[13px] transition-colors', mode === m ? 'bg-[#0F3D2B] font-semibold text-white' : 'font-medium text-muted-foreground hover:text-foreground')}>
                  {m === 'editor' ? 'Editor' : 'Execuções'}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2.5">
              <span className="text-sm text-foreground">{currentSeq.ativo ? 'Ligada' : 'Desligada'}</span>
              <button
                type="button"
                role="switch"
                aria-checked={!!currentSeq.ativo}
                aria-label="Ligar ou desligar a sequência"
                onClick={toggleAtivo}
                className={cn('flex h-[26px] w-[46px] shrink-0 items-center rounded-full px-[3px] transition-colors', currentSeq.ativo ? 'justify-end bg-[#01573C]' : 'justify-start bg-muted-foreground/30 dark:bg-[#2A2A2A]')}
              >
                <span className="h-5 w-5 rounded-full bg-white shadow" />
              </button>
            </div>

            {mode === 'editor' && (
              <>
                {testRunning ? (
                  <button type="button" onClick={stopTest} className={cn(pill3d, 'gap-2 px-5 text-red-400')}><StopCircle className="h-4 w-4" />Parar</button>
                ) : (
                  <button type="button" onClick={() => { setStepTestId(null); setTestModalOpen(true); }} className={cn(pill3d, 'px-5')}>Testar</button>
                )}
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="flex h-10 items-center justify-center gap-2 rounded-full px-[22px] text-sm font-semibold text-white transition-transform active:translate-y-px disabled:opacity-60"
                  style={{ backgroundColor: '#01573C', boxShadow: '#FFFFFF26 0px 1px 0px inset, #003526 0px 3px 0px' }}
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : saveOk ? <CheckCircle2 className="h-4 w-4" /> : null}
                  {saveOk ? 'Salvo' : 'Salvar'}
                </button>
              </>
            )}

            <div className="relative z-30">
              <button type="button" onClick={() => { setMenuOpen((v) => !v); setSeqDropdownOpen(false); }} aria-label="Mais opções" aria-haspopup="menu" aria-expanded={menuOpen} className={cn(pill3d, 'w-10')}>
                <MoreHorizontal className="h-[18px] w-[18px]" />
              </button>
              {menuOpen && (
                <div role="menu" className="absolute right-0 top-full mt-2 w-72 rounded-xl border border-border bg-card p-1.5 shadow-xl dark:border-[#2A2A2A] dark:bg-[#141414]">
                  {conflictCount >= 2 && (
                    <p className="mb-1 flex items-start gap-2 rounded-lg bg-amber-500/10 px-3 py-2 text-xs leading-snug text-amber-700 dark:text-amber-400">
                      <AlertCircle className="mt-px h-3.5 w-3.5 shrink-0" />
                      {conflictCount} sequências ligadas ao mesmo tempo. O lead pode receber mensagens simultâneas.
                    </p>
                  )}
                  <button type="button" role="menuitem" className={menuItem} onClick={() => { setTemplatesOpen(true); setMenuOpen(false); }}><LayoutTemplate className="h-4 w-4 text-muted-foreground" />Modelos de fluxo</button>
                  {versions.length > 0 && (
                    <div className="my-1 border-t border-border pt-1 dark:border-[#2A2A2A]">
                      <p className="px-3 pb-1 pt-1.5 text-[12.5px] font-semibold text-muted-foreground">Versões salvas</p>
                      {[...versions].reverse().slice(0, 5).map((v, i) => (
                        <button key={v.ts} type="button" role="menuitem" className={cn(menuItem, 'py-2')} onClick={() => { restoreVersion(v); setMenuOpen(false); }}>
                          <History className="h-4 w-4 text-muted-foreground" />{formatVersionLabel(v, versions.length - 1 - i, versions.length)}
                        </button>
                      ))}
                    </div>
                  )}
                  {versions.length >= 2 && (
                    <button type="button" role="menuitem" className={menuItem} onClick={() => { setDiffOpen(true); setMenuOpen(false); }}><GitCompare className="h-4 w-4 text-muted-foreground" />Comparar versões</button>
                  )}
                  <div className="my-1 border-t border-border dark:border-[#2A2A2A]" />
                  <button type="button" role="menuitem" className={menuItem} disabled={stagingLoading} onClick={() => { toggleStaging(); setMenuOpen(false); }}>
                    {stagingLoading ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : <TestTube2 className="h-4 w-4 text-muted-foreground" />}
                    <span className="flex-1">Modo de teste (staging)</span>
                    <span className={cn('text-xs', currentSeq.staging ? 'font-semibold text-amber-600 dark:text-amber-400' : 'text-muted-foreground')}>{currentSeq.staging ? 'Ligado' : 'Desligado'}</span>
                  </button>
                  {activeTipo === 'anti_noshow' && <button type="button" role="menuitem" className={menuItem} onClick={() => { setNoshowCronTestOpen(true); setMenuOpen(false); }}><Zap className="h-4 w-4 text-amber-500" />Disparar agora</button>}
                  {activeTipo === 'remarketing' && <button type="button" role="menuitem" className={menuItem} onClick={() => { setRemarketingTestOpen(true); setMenuOpen(false); }}><Zap className="h-4 w-4 text-violet-500" />Disparar agora</button>}
                  {activeTipo === 'pagamento' && (['mercadopago', 'kiwify', 'asaas'] as const).map((p) => (
                    <button key={p} type="button" role="menuitem" className={menuItem} onClick={() => { addPaymentTrigger(p); setMenuOpen(false); }}>
                      <Plus className="h-4 w-4 text-muted-foreground" />Gatilho {p === 'mercadopago' ? 'Mercado Pago' : p === 'kiwify' ? 'Kiwify' : 'Asaas'}
                    </button>
                  ))}
                  <div className="my-1 border-t border-border dark:border-[#2A2A2A]" />
                  <button type="button" role="menuitem" className={cn(menuItem, 'text-destructive')} onClick={() => { setMenuOpen(false); deleteSequence(currentSeq.id); }}><Trash2 className="h-4 w-4" />Excluir sequência</button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Save error banner */}
      {saveError && (
        <div className="flex items-center gap-3 px-4 py-2 bg-destructive/10 border-y border-destructive/20 flex-shrink-0">
          <AlertCircle className="w-4 h-4 text-destructive shrink-0" />
          <span className="text-xs text-destructive flex-1">Erro ao salvar: {saveError}</span>
          <button onClick={() => setSaveError(null)} aria-label="Fechar aviso" className="text-destructive/60 hover:text-destructive transition-colors"><X className="w-3.5 h-3.5" /></button>
        </div>
      )}

      {/* Waiting for lead reply banner */}
      {testWaitingReply && (
        <div className="flex items-center gap-3 px-4 py-2 bg-[#01573C]/10 border-y border-[#01573C]/20 flex-shrink-0">
          <Loader2 className="w-4 h-4 text-[#01573C] dark:text-[#96F63C] animate-spin shrink-0" />
          <span className="text-xs text-[#01573C] dark:text-[#96F63C] flex-1 font-medium">Aguardando resposta do lead… (tempo máximo: 2 min)</span>
          <button onClick={stopTest} className="text-[#01573C]/70 dark:text-[#96F63C]/70 hover:opacity-100 transition-colors text-xs">Cancelar</button>
        </div>
      )}

      {/* Node exec error banner */}
      {nodeExecError && (
        <div className="flex items-center gap-3 px-4 py-2 bg-destructive/10 border-y border-destructive/20 flex-shrink-0">
          <AlertCircle className="w-4 h-4 text-destructive shrink-0" />
          <span className="text-xs text-destructive flex-1">Erro no passo <strong>{nodeExecError.name}</strong>: {nodeExecError.msg}</span>
          <button onClick={() => setNodeExecError(null)} aria-label="Fechar aviso" className="text-destructive/60 hover:text-destructive transition-colors"><X className="w-3.5 h-3.5" /></button>
        </div>
      )}

      {/* Body */}
      <div className="relative flex min-h-0 flex-1 border-t border-border dark:border-[#1C1C1C]">
        {mode === 'execucoes' ? (
          <div className="min-w-0 flex-1 overflow-y-auto">
            <ExecutionsView sequenceId={currentSeq?.id ?? null} tipo={activeTipo} nodes={nodes} />
          </div>
        ) : (
          <div className="relative min-w-0 flex-1 overflow-hidden bg-[#FAFCFA] dark:bg-[#0A0A0A]">
            {loading ? (
              <div className="flex h-full items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : !currentSeq ? (
              <div className="flex h-full flex-col items-center justify-center gap-4">
                <p className="text-sm text-muted-foreground">Você ainda não tem nenhuma sequência.</p>
                <button
                  type="button"
                  onClick={() => { setNewFlowName(''); setNewFlowTipo(activeTipo); setNewFlowModalOpen(true); }}
                  className="flex h-10 items-center justify-center gap-2 rounded-full px-[22px] text-sm font-semibold text-white"
                  style={{ backgroundColor: '#01573C', boxShadow: '#FFFFFF26 0px 1px 0px inset, #003526 0px 3px 0px' }}
                >
                  <Plus className="h-4 w-4" />Criar primeira sequência
                </button>
              </div>
            ) : (
              <>
                <ReactFlow
                  nodes={displayNodes} edges={displayEdges}
                  onNodesChange={handleNodesChange} onEdgesChange={onEdgesChange} onConnect={onConnect}
                  nodeTypes={nodeTypes} edgeTypes={edgeTypes}
                  onNodeClick={(_, node) => { if (node.id === ADD_NODE_ID) return; setPaletteOpen(false); setSelectedNodeId(node.id); }}
                  onPaneClick={() => { setSelectedNodeId(null); setPaletteOpen(false); }}
                  fitView fitViewOptions={{ padding: 0.2, maxZoom: 1 }} minZoom={0.3} maxZoom={1.5}
                  reconnectRadius={12}
                  onReconnect={onReconnect}
                  onReconnectStart={onReconnectStart}
                  onReconnectEnd={onReconnectEnd}
                  proOptions={{ hideAttribution: true }}
                  style={{ width: '100%', height: '100%' }}
                  className="!bg-transparent"
                >
                  <Background variant={BackgroundVariant.Dots} gap={24} size={1.2} color="var(--zp-dot, #2A2A2A)" />
                  <Controls
                    showInteractive={false}
                    position="bottom-left"
                    className="!bottom-5 !left-5 !m-0 !overflow-hidden !rounded-xl !border !border-border !shadow-none dark:!border-[#2A2A2A] [&>button]:!h-10 [&>button]:!w-10 [&>button]:!border-0 [&>button]:!border-b [&>button]:!border-border [&>button]:!bg-card dark:[&>button]:!border-[#2A2A2A] dark:[&>button]:!bg-[#141414] [&>button:last-child]:!border-b-0 [&>button:hover]:!bg-muted dark:[&>button:hover]:!bg-[#1C1C1C] [&>button_svg]:!fill-foreground/80 dark:[&>button_svg]:!fill-[#D0D0D0]"
                  />
                  <MiniMap
                    position="bottom-right"
                    pannable
                    zoomable
                    nodeColor={(n) => n.id === ADD_NODE_ID ? 'transparent' : (n.data as { kind?: string })?.kind === 'trigger' ? '#F5B544' : n.selected ? '#96F63C' : isDark ? '#3A3A3A' : '#C4CBC6'}
                    nodeBorderRadius={4}
                    nodeStrokeWidth={0}
                    maskColor="rgba(0,0,0,0)"
                    maskStrokeColor="#96F63C"
                    maskStrokeWidth={1}
                    className="!bottom-5 !right-5 !m-0 !h-[100px] !w-[200px] !overflow-hidden !rounded-xl !border !border-border !bg-card !shadow-none dark:!border-[#2A2A2A] dark:!bg-[#141414]"
                  />
                </ReactFlow>

                {!selectedNode && !paletteOpen && (
                  <button
                    type="button"
                    onClick={() => setPaletteOpen(true)}
                    className="absolute right-5 top-5 z-10 flex h-11 items-center gap-2 rounded-full px-5 text-sm font-semibold text-white transition-transform active:translate-y-px"
                    style={{ backgroundColor: '#01573C', boxShadow: '#FFFFFF26 0px 1px 0px inset, #003526 0px 3px 0px' }}
                  >
                    <Plus className="h-4 w-4" strokeWidth={2.4} />Adicionar passo
                  </button>
                )}

                {paletteOpen && (
                  <PalettePanel after={anchorTitle} onAdd={(kind) => { addPaletteNode(kind); }} onClose={() => setPaletteOpen(false)} />
                )}
                {selectedNode && !paletteOpen && (
                  <ConfigPanel node={selectedNode} onClose={() => setSelectedNodeId(null)}
                    onUpdate={handleUpdateNode} onDelete={handleDeleteNode}
                    nodes={nodes} edges={edges}
                    sequenceTipo={activeTipo}
                    remarketingCfg={remarketingCfg}
                    onRemarketingChange={setRemarketingCfg}
                    sequences={sequences}
                    currentSeqId={currentSeq?.id}
                    whatsappProvider={whatsappProvider}
                    nodeIndex={msgIndexById.get(selectedNode.id)}
                    onTest={TESTABLE_KINDS.includes(selectedNode.data.kind) ? () => actions.testNode(selectedNode.id) : undefined} />
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Modals */}
      {testModalOpen && (
        <TestRunModal
          onStart={(phone) => { setTestModalOpen(false); if (stepTestId) { const sid = stepTestId; setStepTestId(null); void runStepTest(sid, phone); } else { runTest(phone); } }}
          onClose={() => { setTestModalOpen(false); setStepTestId(null); }}
        />
      )}

      {noshowCronTestOpen && (
        <NoshowCronTestModal onClose={() => setNoshowCronTestOpen(false)} />
      )}

      {remarketingTestOpen && (
        <RemarketingTestModal onClose={() => setRemarketingTestOpen(false)} />
      )}

      {templatesOpen && (
        <TemplatesModal
          onUse={useTemplate}
          onClose={() => setTemplatesOpen(false)}
        />
      )}

      {diffOpen && (
        <VersionDiffModal versions={versions} onClose={() => setDiffOpen(false)} />
      )}

      {approvalModalOpen && (
        <ApprovalModal
          sequenceName={currentSeq?.nome ?? ''}
          onConfirm={confirmAtivo}
          onClose={() => setApprovalModalOpen(false)}
        />
      )}

      {/* New Flow Modal */}
      {newFlowModalOpen && (
        <ModalOverlay onClose={() => setNewFlowModalOpen(false)}>
          <div className="bg-card border border-border rounded-2xl shadow-2xl w-[360px] p-5 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">Nova sequência</p>
              <button onClick={() => setNewFlowModalOpen(false)} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-semibold text-foreground">Categoria</label>
              <div className="flex flex-wrap gap-1">
                {SEQ_TABS.map((t) => (
                  <button key={t.tipo} type="button" aria-pressed={newFlowTipo === t.tipo} onClick={() => setNewFlowTipo(t.tipo)}
                    className={cn('rounded-full px-3.5 py-1.5 text-[13px] transition-colors', newFlowTipo === t.tipo ? 'bg-[#0F3D2B] font-semibold text-white' : 'text-muted-foreground hover:bg-muted hover:text-foreground')}>
                    {t.label}
                  </button>
                ))}
              </div>
              <label className="mt-2 text-sm font-semibold text-foreground">Nome da sequência</label>
              <input
                autoFocus
                className="field-input"
                placeholder={`Ex: ${SEQ_TABS.find((t) => t.tipo === newFlowTipo)?.label} ${sequences.filter((sq) => sq.tipo === newFlowTipo).length + 1}`}
                value={newFlowName}
                onChange={(e) => setNewFlowName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') { setNewFlowModalOpen(false); createSequence(newFlowName, newFlowTipo); }
                  if (e.key === 'Escape') setNewFlowModalOpen(false);
                }}
              />
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setNewFlowModalOpen(false)}
                className="px-4 py-2 rounded-xl text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                Cancelar
              </button>
              <button
                onClick={() => { setNewFlowModalOpen(false); createSequence(newFlowName, newFlowTipo); }}
                className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition-all active:translate-y-px"
                style={{ backgroundColor: '#01573C', color: '#D8D8D8', boxShadow: '0 2px 0 0 #07261C' }}>
                <Plus className="w-3.5 h-3.5" />Criar sequência
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}

      {/* Field input styles */}
      <style>{`
        .field-input {
          width: 100%;
          background: hsl(var(--muted));
          border: 1px solid hsl(var(--border));
          border-radius: 0.75rem;
          color: hsl(var(--foreground));
          font-size: 0.875rem;
          padding: 0.6rem 0.9rem;
          outline: none;
          transition: border-color 0.15s;
          appearance: none;
          -webkit-appearance: none;
        }
        .field-input:focus { border-color: hsl(var(--primary) / 0.5); }
        .dark .field-input { background: #181818; border-color: #2A2A2A; }
        :root { --zp-edge: #C4CBC6; }
        .dark { --zp-edge: #3A3A3A; }
        :root { --zp-green: #16A34A; --zp-red: #DC2626; }
        .dark { --zp-green: #5FD98A; --zp-red: #F0736D; }
        :root { --zp-dot: #D0D6D1; }
        .dark { --zp-dot: #2A2A2A; }
        .field-input option { background: hsl(var(--card)); color: hsl(var(--foreground)); }
        select.field-input {
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23888' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E");
          background-repeat: no-repeat;
          background-position: right 0.6rem center;
          padding-right: 2rem;
          cursor: pointer;
        }
        /* Achado ao vivo (Rodrigo, reportado 3x) : cursor sumia dentro do
           canvas ao arrastar/pan. O React Flow troca pra cursor:grab e
           cursor:grabbing (ícone de mãozinha do SO) por padrão no pane --
           no Windows/Chrome esse ícone específico às vezes falha ao
           redesenhar depois de trocado rápido demais (bug conhecido de
           composição do Chromium, não é nosso código). Forçar um cursor
           padrão simples em vez do ícone de mão evita esse glitch. */
        .react-flow__pane {
          cursor: default !important;
        }
        .react-flow__pane.dragging,
        .react-flow__pane.selection {
          cursor: default !important;
        }
      `}</style>
    </div>
    </CanvasActionsCtx.Provider>
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
