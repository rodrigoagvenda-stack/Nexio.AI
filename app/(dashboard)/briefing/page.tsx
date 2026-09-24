'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { DndContext, closestCenter, PointerSensor, KeyboardSensor, useSensor, useSensors } from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove, sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ArrowRight, Camera, Check, ChevronDown, GripVertical, Loader2, Lock, Moon, Plus, Sun, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { toast } from '@/components/ui/use-toast';
import { useUser } from '@/lib/hooks/useUser';
import { generateBriefingMtPDF } from '@/lib/pdf/briefing-mt-generator';
import { cn } from '@/lib/utils';
import { CARD, CardTitle, FIELD, FieldLabel, LIME } from '@/components/configuracoes/cfg-ui';

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface BriefingConfig {
  id?: number;
  slug: string;
  is_active: boolean;
  primary_color: string;
  theme: 'dark' | 'light';
  logo_url?: string;
  title?: string;
  description?: string;
  success_message?: string;
  whatsapp_label?: string;
  whatsapp_order_index?: number;
  webhook_url?: string;
}

type QType = 'text' | 'textarea' | 'select' | 'multiselect' | 'radio' | 'checkbox' | 'currency' | 'url' | 'email';

interface BriefingQuestion {
  id?: number;
  label: string;
  field_key: string;
  question_type: QType;
  options?: string[] | null;
  is_required: boolean;
  order_index: number;
}

interface BriefingResponse {
  id: number;
  answers: Record<string, any>;
  submitted_at: string;
  webhook_sent: boolean;
}

type ListItem =
  | { itemId: number; type: 'question'; q: BriefingQuestion; order_index: number }
  | { itemId: 'whatsapp'; type: 'whatsapp'; order_index: number };

const QUESTION_TYPES: { value: QType; label: string; short: string }[] = [
  { value: 'text', label: 'Texto curto', short: 'Texto curto' },
  { value: 'textarea', label: 'Texto longo', short: 'Texto longo' },
  { value: 'email', label: 'E-mail', short: 'E-mail' },
  { value: 'currency', label: 'Valor em R$', short: 'Valor em R$' },
  { value: 'url', label: 'Link', short: 'Link' },
  { value: 'select', label: 'Escolher uma opção da lista', short: 'Escolha uma' },
  { value: 'radio', label: 'Escolher uma opção (todas à vista)', short: 'Escolha uma' },
  { value: 'multiselect', label: 'Escolher várias opções', short: 'Escolha várias' },
  { value: 'checkbox', label: 'Marcar ou não marcar', short: 'Marcar' },
];
const HAS_OPTIONS: QType[] = ['select', 'multiselect', 'radio', 'checkbox'];
const typeShort = (t: QType) => QUESTION_TYPES.find((x) => x.value === t)?.short ?? t;

const clean = (t: string, sep: string) => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, sep).replace(new RegExp(`^${sep}|${sep}$`, 'g'), '');
const slugify = (t: string) => clean(t, '-');
const fieldKeyify = (t: string) => clean(t, '_');

const fmtDateTime = (iso: string) => {
  const d = new Date(iso);
  return `${d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
};
const fmtDateAt = (iso: string) => {
  const d = new Date(iso);
  return `${d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} às ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
};

// A lista mostrava "o primeiro campo do objeto", que às vezes era o telefone. O nome verdadeiro é o campo
// cuja chave contém "nome"/"name" (mesma regra do backend em app/api/briefing/public/[slug]/route.ts).
function nomeDeExibicao(answers: Record<string, any>): string | null {
  for (const [key, v] of Object.entries(answers)) {
    if (key === 'whatsapp') continue;
    if (typeof v === 'string' && v.trim() && /nome|name/i.test(key)) return v.trim();
  }
  return null;
}

const show = (v: unknown) => (Array.isArray(v) ? v.join(', ') : v != null && String(v).trim() !== '' ? String(v) : '');

function buildList(questions: BriefingQuestion[], whatsappIndex: number): ListItem[] {
  const items: ListItem[] = [
    ...questions.map((q) => ({ itemId: q.id!, type: 'question' as const, q, order_index: q.order_index })),
    { itemId: 'whatsapp' as const, type: 'whatsapp' as const, order_index: whatsappIndex },
  ];
  return items.sort((a, b) => a.order_index - b.order_index);
}

const pillTab = (on: boolean) => cn('flex items-center gap-2 rounded-full px-5 py-2 text-sm transition-colors', on ? 'bg-[#0F3D2B] font-semibold text-white' : 'font-medium text-muted-foreground hover:text-foreground');

// ─── Linha arrastável ─────────────────────────────────────────────────────────

function Row({ id, n, label, tag, required, locked, selected, onSelect }: {
  id: number | 'whatsapp'; n: number; label: string; tag: string; required: boolean; locked?: boolean; selected: boolean; onSelect: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.6 : 1 }}
      className={cn('flex items-center gap-3 rounded-[10px] px-3 py-3 transition-colors', selected ? 'bg-accent' : locked ? 'bg-muted' : 'hover:bg-muted')}
    >
      <button type="button" {...attributes} {...listeners} aria-label="Arrastar para mudar a ordem" className="shrink-0 cursor-grab touch-none text-muted-foreground active:cursor-grabbing">
        {locked ? <Lock className="h-3.5 w-3.5" /> : <GripVertical className="h-4 w-4" />}
      </button>
      <span className="w-6 shrink-0 text-sm tabular-nums text-muted-foreground">{n}</span>
      <button type="button" onClick={onSelect} className="flex min-w-0 flex-1 items-center gap-3 text-left">
        <span className={cn('min-w-0 flex-1 truncate text-[15px] text-foreground', selected && 'font-semibold')}>{label}</span>
        <span className={cn('shrink-0 rounded-full px-3 py-1 text-[13px]', selected ? 'bg-card text-foreground' : 'text-muted-foreground')}>{tag}</span>
        <span className={cn('h-2 w-2 shrink-0 rounded-full', required ? 'bg-[#01573C] dark:bg-[#96F63C]' : 'border border-muted-foreground/60')} aria-label={required ? 'Obrigatória' : 'Opcional'} />
      </button>
    </div>
  );
}

// ─── Prévia do formulário público ─────────────────────────────────────────────

function Preview({ config, sample, total }: { config: BriefingConfig; sample: BriefingQuestion | null; total: number }) {
  const dark = config.theme === 'dark';
  const color = config.primary_color || '#15803d';
  const box = dark ? 'bg-[#141414] text-white border-white/10' : 'bg-white text-neutral-900 border-neutral-200';
  const soft = dark ? 'text-white/60' : 'text-neutral-500';
  const logo = config.logo_url
    ? <img src={config.logo_url} alt="" className="h-14 w-14 rounded-xl object-contain" />
    : <span className={cn('flex h-14 w-14 items-center justify-center rounded-xl text-xs', dark ? 'bg-white/10 text-white/50' : 'bg-neutral-100 text-neutral-400')}>logo</span>;
  const opts = sample && HAS_OPTIONS.includes(sample.question_type) ? (sample.options ?? []).slice(0, 4) : ['Opção A', 'Opção B'];
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <p className="text-xs font-semibold text-muted-foreground">1. Boas-vindas</p>
        <div className={cn('flex flex-col items-center gap-4 rounded-2xl border px-8 py-7 text-center', box)}>
          {logo}
          <p className="text-2xl font-semibold leading-8">{config.title || 'Título do formulário'}</p>
          {config.description && <p className={cn('max-w-[520px] text-[13px] leading-normal', soft)}>{config.description}</p>}
          <span className="inline-flex items-center gap-2 rounded-lg px-6 py-3 text-sm font-semibold text-white" style={{ backgroundColor: color }}>Começar <ArrowRight className="h-4 w-4" /></span>
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <p className="text-xs font-semibold text-muted-foreground">2. Cada pergunta{sample ? ` (exemplo: ${sample.label.length > 34 ? `${sample.label.slice(0, 34)}…` : sample.label})` : ''}</p>
        <div className={cn('overflow-hidden rounded-2xl border', box)}>
          <div className="h-1" style={{ background: `linear-gradient(90deg, ${color} 55%, transparent 55%)` }} />
          <div className="flex flex-col gap-4 p-7">
            <p className={cn('text-xs', soft)}>{sample ? `1 → ${total}` : `1 → ${total || 1}`}</p>
            <p className="text-lg font-semibold leading-6">{sample?.label ?? 'Sua pergunta aparece aqui'}{sample?.is_required ? ' *' : ''}</p>
            <div className="flex flex-col gap-2.5">
              {opts.map((o, i) => (
                <div key={i} className={cn('flex items-center gap-3 rounded-lg border px-3.5 py-3 text-sm', dark ? 'border-white/15' : 'border-neutral-200', i === 1 && 'border-2')} style={i === 1 ? { borderColor: color } : undefined}>
                  <span className={cn('flex h-6 w-6 items-center justify-center rounded text-xs', i === 1 ? 'text-white' : dark ? 'bg-white/10' : 'bg-neutral-100')} style={i === 1 ? { backgroundColor: color } : undefined}>{String.fromCharCode(65 + i)}</span>
                  {o}
                </div>
              ))}
            </div>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">Ao escolher uma opção, o formulário avança sozinho. Perguntas de texto têm o botão “OK”.</p>
      </div>
      <div className="flex flex-col gap-2">
        <p className="text-xs font-semibold text-muted-foreground">3. Depois de enviar</p>
        <div className={cn('flex flex-col items-center gap-3 rounded-2xl border px-8 py-9 text-center', box)}>
          <span className="flex h-12 w-12 items-center justify-center rounded-full" style={{ backgroundColor: `${color}26` }}><Check className="h-5 w-5" style={{ color }} /></span>
          <p className="text-2xl font-semibold">Enviado!</p>
          <p className={cn('max-w-[420px] text-[13px] leading-normal', soft)}>{config.success_message || 'Obrigado pelo preenchimento! Entraremos em contato em breve.'}</p>
        </div>
      </div>
    </div>
  );
}

// ─── Página ───────────────────────────────────────────────────────────────────

export default function BriefingPage() {
  const { company } = useUser();
  const [tab, setTab] = useState<'respostas' | 'formulario' | 'config'>('respostas');
  const [loading, setLoading] = useState(true);
  const [config, setConfig] = useState<BriefingConfig>({ slug: '', is_active: false, primary_color: '#01573C', theme: 'dark' });
  const [savedConfig, setSavedConfig] = useState<BriefingConfig | null>(null);
  const [questions, setQuestions] = useState<BriefingQuestion[]>([]);
  const [responses, setResponses] = useState<BriefingResponse[]>([]);
  const [loadingResponses, setLoadingResponses] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [copied, setCopied] = useState(false);
  const logoRef = useRef<HTMLInputElement>(null);

  // Respostas
  const [selectedResponseId, setSelectedResponseId] = useState<number | null>(null);
  const [respPage, setRespPage] = useState(1);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [confirmDeleteResponse, setConfirmDeleteResponse] = useState<BriefingResponse | null>(null);
  const [deletingResponse, setDeletingResponse] = useState(false);
  const PER_PAGE = 6;

  // Formulário
  const [selectedKey, setSelectedKey] = useState<number | 'whatsapp' | 'new' | null>(null);
  const [draft, setDraft] = useState<BriefingQuestion>({ label: '', field_key: '', question_type: 'text', is_required: false, order_index: 0, options: [] });
  const [waLabel, setWaLabel] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [confirmDeleteQuestion, setConfirmDeleteQuestion] = useState<BriefingQuestion | null>(null);
  const [successMessage, setSuccessMessage] = useState('');

  const sensors = useSensors(useSensor(PointerSensor), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));

  const host = typeof window !== 'undefined' ? window.location.host : 'app.zaapply.com.br';
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const briefingUrl = `${origin}/briefing/${config.slug}`;
  const shortUrl = `${host}/briefing/${config.slug}`;

  useEffect(() => {
    (async () => {
      try {
        const [c, q] = await Promise.all([fetch('/api/user/briefing/config').then((r) => r.json()), fetch('/api/user/briefing/questions').then((r) => r.json())]);
        if (c.data) { setConfig(c.data); setSavedConfig(c.data); setSuccessMessage(c.data.success_message ?? ''); }
        if (q.success) setQuestions(q.data);
      } catch { toast({ variant: 'destructive', title: 'Não foi possível carregar o briefing' }); }
      finally { setLoading(false); }
    })();
    fetch('/api/user/briefing/responses').then((r) => r.json()).then((d) => { if (d.success) setResponses(d.data); }).catch(() => {}).finally(() => setLoadingResponses(false));
  }, []);

  // Seleciona a primeira resposta quando a lista chega
  useEffect(() => { if (responses.length && selectedResponseId == null) setSelectedResponseId(responses[0].id); }, [responses, selectedResponseId]);

  async function saveConfig(next: BriefingConfig, okMsg = 'Configurações salvas') {
    setSaving(true);
    try {
      const res = await fetch('/api/user/briefing/config', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(next) });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);
      setConfig(data.data);
      setSavedConfig(data.data);
      toast({ variant: 'success', title: okMsg });
      return true;
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Não foi possível salvar', description: err?.message });
      return false;
    } finally { setSaving(false); }
  }

  async function uploadLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingLogo(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch('/api/user/briefing/upload-logo', { method: 'POST', body: form });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);
      setConfig((prev) => ({ ...prev, logo_url: data.url }));
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Não foi possível enviar o logo', description: err?.message });
    } finally { setUploadingLogo(false); if (logoRef.current) logoRef.current.value = ''; }
  }

  async function copyUrl() {
    try { await navigator.clipboard.writeText(briefingUrl); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* sem permissão */ }
  }

  // ── Respostas ──
  const selectedResponse = responses.find((r) => r.id === selectedResponseId) ?? null;
  const sorted = useMemo(() => [...responses].sort((a, b) => +new Date(b.submitted_at) - +new Date(a.submitted_at)), [responses]);
  const pageRows = sorted.slice((respPage - 1) * PER_PAGE, respPage * PER_PAGE);
  const last7 = sorted.filter((r) => Date.now() - +new Date(r.submitted_at) < 7 * 86_400_000);
  const sentCount = responses.filter((r) => r.webhook_sent).length;

  async function downloadPdf(r: BriefingResponse) {
    setDownloadingPdf(true);
    try {
      const blob = await generateBriefingMtPDF({
        companyName: company?.name || 'Empresa', title: config.title || 'Briefing', leadName: nomeDeExibicao(r.answers),
        primaryColor: config.primary_color || '#15803d', logoUrl: config.logo_url, questions: questions as any, answers: r.answers, submittedAt: r.submitted_at,
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `briefing-${r.id}.pdf`; a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Não foi possível gerar o PDF', description: err?.message });
    } finally { setDownloadingPdf(false); }
  }

  async function deleteResponse() {
    if (!confirmDeleteResponse) return;
    setDeletingResponse(true);
    try {
      const res = await fetch(`/api/user/briefing/responses/${confirmDeleteResponse.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);
      setResponses((prev) => prev.filter((r) => r.id !== confirmDeleteResponse.id));
      if (selectedResponseId === confirmDeleteResponse.id) setSelectedResponseId(null);
      toast({ title: 'Resposta excluída' });
      setConfirmDeleteResponse(null);
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Não foi possível excluir', description: err?.message });
    } finally { setDeletingResponse(false); }
  }

  // ── Formulário ──
  const list = buildList(questions, config.whatsapp_order_index ?? questions.length);

  function pick(item: ListItem) {
    setShowAdvanced(false);
    if (item.type === 'whatsapp') { setSelectedKey('whatsapp'); setWaLabel(config.whatsapp_label || ''); return; }
    setSelectedKey(item.q.id!);
    setDraft({ ...item.q, options: item.q.options ?? [] });
  }
  function startNew() {
    setShowAdvanced(false);
    setSelectedKey('new');
    setDraft({ label: '', field_key: '', question_type: 'text', is_required: false, order_index: questions.length + 1, options: [] });
  }

  async function saveQuestion() {
    const needs = HAS_OPTIONS.includes(draft.question_type);
    const options = (draft.options ?? []).map((o) => o.trim()).filter(Boolean);
    if (!draft.label.trim()) { toast({ variant: 'destructive', title: 'Escreva a pergunta' }); return; }
    if (!draft.field_key.trim()) { toast({ variant: 'destructive', title: 'A pergunta precisa de um identificador', description: 'Abra Avançado e preencha.' }); return; }
    if (needs && options.length === 0) { toast({ variant: 'destructive', title: 'Adicione pelo menos uma opção' }); return; }
    const isNew = selectedKey === 'new';
    setSaving(true);
    try {
      const res = await fetch(isNew ? '/api/user/briefing/questions' : `/api/user/briefing/questions/${draft.id}`, {
        method: isNew ? 'POST' : 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...draft, options: needs ? options : null }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);
      setQuestions((prev) => (isNew ? [...prev, data.data] : prev.map((q) => (q.id === data.data.id ? data.data : q))));
      setSelectedKey(data.data.id);
      setDraft({ ...data.data, options: data.data.options ?? [] });
      toast({ variant: 'success', title: isNew ? 'Pergunta adicionada' : 'Pergunta salva' });
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Não foi possível salvar a pergunta', description: err?.message });
    } finally { setSaving(false); }
  }

  async function deleteQuestion() {
    if (!confirmDeleteQuestion?.id) return;
    try {
      const res = await fetch(`/api/user/briefing/questions/${confirmDeleteQuestion.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);
      setQuestions((prev) => prev.filter((q) => q.id !== confirmDeleteQuestion.id));
      setSelectedKey(null);
      setConfirmDeleteQuestion(null);
      toast({ title: 'Pergunta excluída' });
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Não foi possível excluir', description: err?.message });
    }
  }

  async function saveWhatsappLabel() {
    const next = { ...config, whatsapp_label: waLabel.trim() || undefined };
    if (await saveConfig(next, 'Pergunta de WhatsApp salva')) setSelectedKey(null);
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const current = buildList(questions, config.whatsapp_order_index ?? questions.length);
    const from = current.findIndex((i) => i.itemId === active.id);
    const to = current.findIndex((i) => i.itemId === over.id);
    const reordered = arrayMove(current, from, to).map((item, idx) => ({ ...item, order_index: idx }));
    const updated = reordered.filter((i): i is Extract<ListItem, { type: 'question' }> => i.type === 'question').map((i) => ({ ...i.q, order_index: i.order_index }));
    const waIndex = reordered.find((i) => i.type === 'whatsapp')?.order_index ?? questions.length;
    setQuestions(updated);
    setConfig((prev) => ({ ...prev, whatsapp_order_index: waIndex }));
    try {
      const results = await Promise.all([
        ...updated.map((q) => fetch(`/api/user/briefing/questions/${q.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(q) })),
        fetch('/api/user/briefing/config', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...config, whatsapp_order_index: waIndex }) }),
      ]);
      if (results.some((r) => !r.ok)) throw new Error('Alguma pergunta não foi salva');
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Não foi possível salvar a nova ordem', description: err?.message });
      fetch('/api/user/briefing/questions').then((r) => r.json()).then((d) => { if (d.success) setQuestions(d.data); });
    }
  }

  const configDirty = savedConfig ? JSON.stringify({ ...config, success_message: savedConfig.success_message }) !== JSON.stringify(savedConfig) : false;
  const sample = questions.find((q) => HAS_OPTIONS.includes(q.question_type)) ?? questions[0] ?? null;

  if (loading) return <div className="flex h-64 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  const linkPill = config.slug && (
    <div className="flex items-center gap-3 rounded-full border border-border bg-card py-1.5 pl-5 pr-1.5">
      <span className={cn('flex items-center gap-2 text-sm', config.is_active ? 'text-foreground' : 'text-muted-foreground')}>
        <span className={cn('h-1.5 w-1.5 rounded-full', config.is_active ? 'bg-[#01573C] dark:bg-[#96F63C]' : 'bg-muted-foreground/60')} />
        {config.is_active ? 'Ativo' : 'Desligado'}
      </span>
      <span className="hidden max-w-[300px] truncate text-[15px] text-foreground sm:block">{shortUrl}</span>
      <Button size="sm" className="h-9 px-4 text-sm" onClick={copyUrl}>{copied ? 'Copiado' : 'Copiar link'}</Button>
      <a href={briefingUrl} target="_blank" rel="noopener noreferrer" className="px-4 text-sm font-semibold text-foreground hover:underline">Abrir</a>
    </div>
  );

  return (
    <div className="mx-auto flex w-full max-w-[1900px] flex-col gap-6 pb-14 pt-2">
      <div className="flex flex-wrap items-center justify-between gap-6">
        <div className="flex flex-col gap-1.5">
          <h1 className="text-[26px] font-semibold leading-8 tracking-tight text-foreground">Briefing</h1>
          <p className="text-[15px] text-muted-foreground">O formulário que o lead preenche antes da reunião.{config.title ? ` Este é o “${config.title}”.` : ''}</p>
        </div>
        {linkPill}
      </div>

      <div role="tablist" aria-label="Briefing" className="flex w-fit items-center rounded-full bg-muted p-1">
        <button type="button" role="tab" aria-selected={tab === 'respostas'} onClick={() => setTab('respostas')} className={pillTab(tab === 'respostas')}>
          Respostas {responses.length > 0 && <span className={cn('rounded-full px-2 py-px text-xs', tab === 'respostas' ? 'bg-white/15' : 'bg-card')}>{responses.length}</span>}
        </button>
        <button type="button" role="tab" aria-selected={tab === 'formulario'} onClick={() => setTab('formulario')} className={pillTab(tab === 'formulario')}>Formulário</button>
        <button type="button" role="tab" aria-selected={tab === 'config'} onClick={() => setTab('config')} className={pillTab(tab === 'config')}>Configurações</button>
      </div>

      {/* ── Respostas ── */}
      {tab === 'respostas' && (
        loadingResponses ? <div className="flex h-40 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        : responses.length === 0 ? (
          <div className={cn(CARD, 'flex flex-col items-center gap-2 px-8 py-20 text-center')}>
            <h2 className="text-xl font-semibold text-foreground">Nenhuma resposta ainda</h2>
            <p className="max-w-[420px] text-[15px] text-muted-foreground">Compartilhe o link do briefing para começar a receber respostas.</p>
            {config.slug && <Button className="mt-2 h-11 px-6" onClick={copyUrl}>Copiar link</Button>}
          </div>
        ) : (
          <>
            <div className="grid gap-5 md:grid-cols-3">
              <div className={cn(CARD, 'flex flex-col gap-2 px-6 py-5')}>
                <p className="text-[15px] text-foreground/85">Respostas recebidas</p>
                <p className="text-[34px] font-semibold leading-[42px] tracking-tight text-foreground">{responses.length}</p>
                <p className="text-sm text-muted-foreground">desde {new Date(sorted[sorted.length - 1].submitted_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}</p>
              </div>
              <div className={cn(CARD, 'flex flex-col gap-2 px-6 py-5')}>
                <p className="text-[15px] text-foreground/85">Nos últimos 7 dias</p>
                <p className="text-[34px] font-semibold leading-[42px] tracking-tight text-foreground">{last7.length}</p>
                <p className="text-sm text-muted-foreground">a última foi em {fmtDateAt(sorted[0].submitted_at)}</p>
              </div>
              <div className={cn(CARD, 'flex flex-col gap-2 px-6 py-5')}>
                <p className="text-[15px] text-foreground/85">Enviadas para sua automação</p>
                <p className="flex items-baseline gap-2"><span className={cn('text-[34px] font-semibold leading-[42px] tracking-tight', LIME)}>{sentCount}</span><span className="text-[15px] text-muted-foreground">de {responses.length}</span></p>
                <p className="text-sm text-muted-foreground">{config.webhook_url ? 'pelo webhook configurado' : 'nenhum endereço configurado'}</p>
              </div>
            </div>

            <div className="flex flex-col gap-6 xl:flex-row xl:items-start">
              <section className={cn(CARD, 'flex w-full shrink-0 flex-col gap-3 px-[22px] py-6 xl:w-[520px]')}>
                <div className="flex items-baseline justify-between px-2">
                  <h2 className="text-xl font-semibold text-foreground">Respostas</h2>
                  <span className="text-sm text-muted-foreground">Mais recentes primeiro</span>
                </div>
                <ul className="flex flex-col">
                  {pageRows.map((r) => {
                    const on = r.id === selectedResponseId;
                    const name = nomeDeExibicao(r.answers) || show(r.answers['whatsapp']) || `Resposta ${r.id}`;
                    const summary = Object.entries(r.answers).filter(([k, v]) => k !== 'whatsapp' && show(v) && !/nome|name/i.test(k)).slice(0, 3).map(([, v]) => show(v)).join(' · ');
                    return (
                      <li key={r.id}>
                        <button type="button" onClick={() => setSelectedResponseId(r.id)} className={cn('flex w-full flex-col gap-1 rounded-[10px] px-3.5 py-3.5 text-left transition-colors', on ? 'bg-accent' : 'hover:bg-muted')}>
                          <span className="flex items-center justify-between gap-3"><span className="truncate text-base font-semibold text-foreground">{name}</span><span className="shrink-0 text-sm text-muted-foreground">{fmtDateTime(r.submitted_at)}</span></span>
                          {summary && <span className="truncate text-sm text-muted-foreground">{summary}</span>}
                        </button>
                      </li>
                    );
                  })}
                </ul>
                <div className="flex items-center justify-between px-2 pt-1">
                  <span className="text-sm text-muted-foreground">{(respPage - 1) * PER_PAGE + 1} a {Math.min(respPage * PER_PAGE, sorted.length)} de {sorted.length}</span>
                  <div className="flex gap-2">
                    <Button variant="secondary" className="h-9 px-4 text-sm" onClick={() => setRespPage((p) => p - 1)} disabled={respPage === 1}>Anterior</Button>
                    <Button variant="secondary" className="h-9 px-4 text-sm" onClick={() => setRespPage((p) => p + 1)} disabled={respPage * PER_PAGE >= sorted.length}>Próxima</Button>
                  </div>
                </div>
              </section>

              <section className={cn(CARD, 'min-w-0 flex-1 px-9 py-8')}>
                {!selectedResponse ? (
                  <p className="py-20 text-center text-muted-foreground">Selecione uma resposta para ver os detalhes.</p>
                ) : (() => {
                  const r = selectedResponse;
                  const wa = show(r.answers['whatsapp']);
                  const waDigits = wa.replace(/\D/g, '');
                  const emailQ = questions.find((q) => q.question_type === 'email');
                  const email = emailQ ? show(r.answers[emailQ.field_key]) : '';
                  const chips = questions.filter((q) => ['select', 'radio', 'currency', 'multiselect'].includes(q.question_type) && show(r.answers[q.field_key])).slice(0, 4);
                  const chipKeys = new Set(chips.map((q) => q.field_key));
                  const rest = questions.filter((q) => q.field_key !== 'whatsapp' && !chipKeys.has(q.field_key) && !/nome|name/i.test(q.field_key));
                  const restUnknown = questions.length === 0 ? Object.entries(r.answers).filter(([k]) => k !== 'whatsapp') : [];
                  return (
                    <div className="flex flex-col gap-6">
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div className="flex min-w-0 flex-col gap-1.5">
                          <h2 className="text-[28px] font-semibold leading-9 tracking-tight text-foreground">{nomeDeExibicao(r.answers) || wa || `Resposta ${r.id}`}</h2>
                          <p className="text-[15px] text-muted-foreground">Respondeu em {fmtDateAt(r.submitted_at)}</p>
                          {(email || wa) && <p className="text-sm text-muted-foreground">{[email, wa].filter(Boolean).join(' · ')}</p>}
                        </div>
                        <div className="flex gap-3">
                          {waDigits && <Button className="h-11 px-6" asChild><a href={`https://wa.me/${waDigits}`} target="_blank" rel="noopener noreferrer">Chamar no WhatsApp</a></Button>}
                          <Button variant="secondary" className="h-11 px-6" onClick={() => downloadPdf(r)} disabled={downloadingPdf}>{downloadingPdf && <Loader2 className="h-4 w-4 animate-spin" />} Baixar PDF</Button>
                        </div>
                      </div>

                      {chips.length > 0 && (
                        <div className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
                          {chips.map((q) => (
                            <div key={q.field_key} className="flex flex-col gap-1 rounded-xl border border-border bg-muted px-[18px] py-3.5">
                              <span className="text-[13px] text-muted-foreground">{q.label.length > 34 ? `${q.label.slice(0, 34)}…` : q.label}</span>
                              <span className="text-[17px] font-semibold leading-6 text-foreground">{show(r.answers[q.field_key])}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      <dl className="grid gap-x-10 gap-y-5 md:grid-cols-2">
                        {rest.map((q) => (
                          <div key={q.field_key} className="flex flex-col gap-1.5">
                            <dt className="text-xs font-medium uppercase tracking-[0.06em] text-muted-foreground">{q.label}</dt>
                            <dd className={cn('text-base leading-normal', show(r.answers[q.field_key]) ? 'text-foreground' : 'italic text-muted-foreground')}>{show(r.answers[q.field_key]) || 'Não informado'}</dd>
                          </div>
                        ))}
                        {restUnknown.map(([k, v]) => (
                          <div key={k} className="flex flex-col gap-1.5">
                            <dt className="text-xs font-medium uppercase tracking-[0.06em] text-muted-foreground">{k.replace(/_/g, ' ')}</dt>
                            <dd className="text-base text-foreground">{show(v) || 'Não informado'}</dd>
                          </div>
                        ))}
                      </dl>

                      <div className="flex items-center justify-between border-t border-border pt-5">
                        <p className="text-sm text-muted-foreground">{r.webhook_sent ? 'Enviada para a sua automação.' : config.webhook_url ? 'Ainda não foi enviada para a sua automação.' : ''}</p>
                        <button type="button" onClick={() => setConfirmDeleteResponse(r)} className="text-sm text-red-600 hover:underline dark:text-red-400">Excluir resposta</button>
                      </div>
                    </div>
                  );
                })()}
              </section>
            </div>
          </>
        )
      )}

      {/* ── Formulário ── */}
      {tab === 'formulario' && (
        <div className="flex flex-col gap-6 xl:flex-row xl:items-start">
          <section className={cn(CARD, 'min-w-0 flex-1 px-7 py-7')}>
            <div className="flex items-start justify-between gap-4">
              <div className="flex flex-col gap-1">
                <h2 className="text-xl font-semibold text-foreground">Perguntas</h2>
                <p className="text-sm text-muted-foreground">{questions.length} {questions.length === 1 ? 'pergunta' : 'perguntas'} e o WhatsApp. Arraste para mudar a ordem.</p>
              </div>
              <Button className="h-11 px-5 text-sm" onClick={startNew}><Plus className="!size-4" strokeWidth={2.4} /> Adicionar pergunta</Button>
            </div>
            <div className="mb-2 mt-4 flex justify-end gap-4 text-[13px] text-muted-foreground">
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[#01573C] dark:bg-[#96F63C]" /> Obrigatória</span>
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full border border-muted-foreground/60" /> Opcional</span>
            </div>
            {questions.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">Nenhuma pergunta ainda. Clique em Adicionar pergunta para começar.</p>}
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={list.map((i) => i.itemId)} strategy={verticalListSortingStrategy}>
                <div className="flex flex-col">
                  {list.map((item, idx) => item.type === 'whatsapp' ? (
                    <Row key="whatsapp" id="whatsapp" n={idx + 1} label={config.whatsapp_label || 'Qual o seu WhatsApp?'} tag="Telefone, campo fixo" required locked selected={selectedKey === 'whatsapp'} onSelect={() => pick(item)} />
                  ) : (
                    <Row key={item.q.id} id={item.q.id!} n={idx + 1} label={item.q.label} tag={typeShort(item.q.question_type)} required={item.q.is_required} selected={selectedKey === item.q.id} onSelect={() => pick(item)} />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          </section>

          <div className="flex w-full shrink-0 flex-col gap-6 xl:w-[640px]">
            {selectedKey === 'whatsapp' ? (
              <section className={cn(CARD, 'flex flex-col gap-5 px-8 py-7')}>
                <CardTitle title="Pergunta do WhatsApp" hint="Este campo é fixo: o número é o que liga a resposta ao lead. Você só muda o texto." />
                <div className="flex flex-col gap-2">
                  <FieldLabel htmlFor="wa-label">Texto da pergunta</FieldLabel>
                  <input id="wa-label" className={FIELD} value={waLabel} onChange={(e) => setWaLabel(e.target.value)} placeholder="Qual o seu WhatsApp?" />
                </div>
                <div className="flex gap-3">
                  <Button className="h-[46px] px-7" onClick={saveWhatsappLabel} disabled={saving}>{saving && <Loader2 className="h-4 w-4 animate-spin" />} Salvar pergunta</Button>
                  <Button variant="secondary" className="h-[46px] px-6" onClick={() => setSelectedKey(null)}>Cancelar</Button>
                </div>
              </section>
            ) : selectedKey != null ? (
              <section className={cn(CARD, 'flex flex-col gap-5 px-8 py-7')}>
                <CardTitle title={selectedKey === 'new' ? 'Nova pergunta' : `Pergunta ${list.findIndex((i) => i.itemId === selectedKey) + 1}`} hint={selectedKey === 'new' ? undefined : 'Ao mudar o texto, as respostas antigas passam a mostrar o texto novo.'} />
                <div className="flex flex-col gap-2">
                  <FieldLabel htmlFor="q-label">Texto da pergunta</FieldLabel>
                  <textarea
                    id="q-label"
                    rows={2}
                    className={cn(FIELD, 'h-auto resize-none py-3 leading-normal')}
                    value={draft.label}
                    onChange={(e) => setDraft((d) => ({ ...d, label: e.target.value, field_key: selectedKey === 'new' ? fieldKeyify(e.target.value) : d.field_key }))}
                    placeholder="Ex.: Qual o nome da sua empresa?"
                  />
                </div>
                <div className="flex items-end gap-4">
                  <div className="flex min-w-0 flex-1 flex-col gap-2">
                    <FieldLabel>Tipo de resposta</FieldLabel>
                    <Select value={draft.question_type} onValueChange={(v) => setDraft((d) => ({ ...d, question_type: v as QType, options: HAS_OPTIONS.includes(v as QType) ? (d.options?.length ? d.options : ['']) : [] }))}>
                      <SelectTrigger className="h-[50px] rounded-xl border-border bg-muted px-4 text-[15px]"><SelectValue /></SelectTrigger>
                      <SelectContent>{QUESTION_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <label className="flex h-[50px] items-center gap-3 text-[15px] text-foreground">
                    Obrigatória <Switch checked={draft.is_required} onCheckedChange={(v) => setDraft((d) => ({ ...d, is_required: v }))} />
                  </label>
                </div>

                {HAS_OPTIONS.includes(draft.question_type) && (
                  <div className="flex flex-col gap-2">
                    <FieldLabel>Opções que o lead pode escolher</FieldLabel>
                    <div className="flex flex-col rounded-xl border border-border bg-muted">
                      {(draft.options ?? []).map((o, i) => (
                        <div key={i} className={cn('flex items-center gap-2 px-4', i > 0 && 'border-t border-border')}>
                          <input
                            value={o}
                            onChange={(e) => setDraft((d) => ({ ...d, options: (d.options ?? []).map((x, k) => (k === i ? e.target.value : x)) }))}
                            placeholder={`Opção ${i + 1}`}
                            aria-label={`Opção ${i + 1}`}
                            className="h-12 flex-1 bg-transparent text-[15px] text-foreground outline-none placeholder:text-muted-foreground"
                          />
                          <button type="button" aria-label="Remover opção" onClick={() => setDraft((d) => ({ ...d, options: (d.options ?? []).filter((_, k) => k !== i) }))} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
                        </div>
                      ))}
                      <button type="button" onClick={() => setDraft((d) => ({ ...d, options: [...(d.options ?? []), ''] }))} className={cn('flex h-12 items-center gap-2 px-4 text-[15px] font-medium', LIME, (draft.options ?? []).length > 0 && 'border-t border-border')}><Plus className="h-4 w-4" /> Adicionar opção</button>
                    </div>
                  </div>
                )}

                <div className="rounded-xl border border-border bg-muted">
                  <button type="button" onClick={() => setShowAdvanced((s) => !s)} aria-expanded={showAdvanced} className="flex w-full items-center justify-between px-[18px] py-3.5 text-left">
                    <span className="flex flex-col gap-0.5"><span className="text-[15px] font-semibold text-foreground">Avançado</span><span className="text-[13px] text-muted-foreground">Identificador interno da pergunta. Mudar separa as respostas antigas.</span></span>
                    <ChevronDown className={cn('h-4 w-4 shrink-0 text-muted-foreground transition-transform', showAdvanced && 'rotate-180')} />
                  </button>
                  {showAdvanced && (
                    <div className="border-t border-border px-[18px] py-3.5">
                      <FieldLabel htmlFor="q-key">Identificador</FieldLabel>
                      <input id="q-key" className={cn(FIELD, 'mt-2 font-mono')} value={draft.field_key} onChange={(e) => setDraft((d) => ({ ...d, field_key: fieldKeyify(e.target.value) }))} placeholder="nome_da_empresa" />
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  <Button className="h-[46px] px-7" onClick={saveQuestion} disabled={saving}>{saving && <Loader2 className="h-4 w-4 animate-spin" />} Salvar pergunta</Button>
                  <Button variant="secondary" className="h-[46px] px-6" onClick={() => setSelectedKey(null)}>Cancelar</Button>
                  {selectedKey !== 'new' && <button type="button" onClick={() => setConfirmDeleteQuestion(draft)} className="ml-auto text-sm text-red-600 hover:underline dark:text-red-400">Excluir pergunta</button>}
                </div>
              </section>
            ) : (
              <section className={cn(CARD, 'flex flex-col items-center gap-1.5 px-8 py-16 text-center')}>
                <p className="text-base font-medium text-foreground">Selecione uma pergunta</p>
                <p className="text-sm text-muted-foreground">para editar o texto, o tipo e as opções.</p>
              </section>
            )}

            <section className={cn(CARD, 'flex flex-col gap-4 px-8 py-7')}>
              <CardTitle title="Mensagem final" hint="O lead vê este texto logo depois de enviar o formulário." />
              <textarea aria-label="Mensagem final" rows={3} className={cn(FIELD, 'h-auto resize-none py-3.5 leading-normal')} value={successMessage} onChange={(e) => setSuccessMessage(e.target.value)} placeholder="Obrigado pelo preenchimento! Entraremos em contato em breve." />
              <Button variant="secondary" className="h-11 self-start px-6" disabled={saving || successMessage === (savedConfig?.success_message ?? '')} onClick={() => saveConfig({ ...(savedConfig ?? config), success_message: successMessage }, 'Mensagem salva').then(() => setConfig((c) => ({ ...c, success_message: successMessage })))}>Salvar mensagem</Button>
            </section>
          </div>
        </div>
      )}

      {/* ── Configurações ── */}
      {tab === 'config' && (
        <div className="flex flex-col gap-6 xl:flex-row xl:items-start">
          <div className="flex min-w-0 flex-1 flex-col gap-6">
            <section className={cn(CARD, 'flex flex-col gap-4 px-8 py-7')}>
              <div className="flex items-start justify-between gap-4">
                <CardTitle title="Formulário no ar" hint="Desligado, o link deixa de abrir e não recebe mais respostas." />
                <Switch checked={config.is_active} onCheckedChange={(v) => setConfig((c) => ({ ...c, is_active: v }))} aria-label="Formulário no ar" />
              </div>
              <div className="flex flex-col gap-2">
                <FieldLabel htmlFor="bf-slug">Endereço do formulário</FieldLabel>
                <div className="flex h-[50px] overflow-hidden rounded-xl border border-border bg-muted focus-within:border-primary/60">
                  <span className="hidden items-center border-r border-border px-4 text-[15px] text-muted-foreground sm:flex">{host}/briefing/</span>
                  <input id="bf-slug" className="min-w-0 flex-1 bg-transparent px-4 text-[15px] text-foreground outline-none" value={config.slug} onChange={(e) => setConfig((c) => ({ ...c, slug: slugify(e.target.value) }))} placeholder="nome-da-empresa" />
                </div>
                <p className="text-[13px] text-muted-foreground">Se mudar o endereço, o link que você já enviou para os leads para de funcionar.</p>
              </div>
            </section>

            <section className={cn(CARD, 'flex flex-col gap-5 px-8 py-7')}>
              <CardTitle title="Aparência" hint="Como o formulário aparece para o lead." />
              <div className="flex flex-col gap-2"><FieldLabel htmlFor="bf-title">Título</FieldLabel><input id="bf-title" className={FIELD} value={config.title || ''} onChange={(e) => setConfig((c) => ({ ...c, title: e.target.value }))} placeholder="Preencha seu briefing" /></div>
              <div className="flex flex-col gap-2"><FieldLabel htmlFor="bf-desc">Texto de apresentação</FieldLabel><textarea id="bf-desc" rows={3} className={cn(FIELD, 'h-auto resize-none py-3.5 leading-normal')} value={config.description || ''} onChange={(e) => setConfig((c) => ({ ...c, description: e.target.value }))} placeholder="Subtítulo do formulário" /></div>
              <div className="grid gap-5 md:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <FieldLabel>Logo</FieldLabel>
                  <div className="flex items-center gap-3.5">
                    <span className="relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border bg-muted text-xs text-muted-foreground">
                      {config.logo_url ? <img src={config.logo_url} alt="Logo" className="h-full w-full object-contain" /> : 'logo'}
                    </span>
                    <div className="flex flex-col gap-1.5">
                      <input ref={logoRef} type="file" className="hidden" accept="image/jpeg,image/png,image/webp" onChange={uploadLogo} />
                      <div className="flex gap-2">
                        <Button variant="secondary" className="h-10 px-5 text-sm" onClick={() => logoRef.current?.click()} disabled={uploadingLogo}>{uploadingLogo ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />} {config.logo_url ? 'Trocar logo' : 'Enviar logo'}</Button>
                        {config.logo_url && <button type="button" onClick={() => setConfig((c) => ({ ...c, logo_url: '' }))} className="text-sm text-muted-foreground hover:text-foreground">Remover</button>}
                      </div>
                      <p className="text-[13px] text-muted-foreground">JPG, PNG ou WebP, até 5 MB</p>
                    </div>
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <FieldLabel htmlFor="bf-color">Cor principal</FieldLabel>
                  <div className="flex items-center gap-3">
                    <input type="color" aria-label="Escolher cor" value={config.primary_color || '#01573C'} onChange={(e) => setConfig((c) => ({ ...c, primary_color: e.target.value }))} className="h-[50px] w-[50px] cursor-pointer rounded-xl border border-border bg-transparent p-1" />
                    <input id="bf-color" className={cn(FIELD, 'w-40 font-mono')} value={config.primary_color || ''} onChange={(e) => setConfig((c) => ({ ...c, primary_color: e.target.value }))} placeholder="#01573C" />
                  </div>
                </div>
              </div>
              <div className="flex flex-col gap-2.5">
                <p className="text-sm font-semibold text-foreground">Tema</p>
                <div className="flex gap-3" role="radiogroup" aria-label="Tema do formulário">
                  {([['dark', 'Escuro', Moon], ['light', 'Claro', Sun]] as const).map(([id, label, Icon]) => (
                    <button key={id} type="button" role="radio" aria-checked={config.theme === id} onClick={() => setConfig((c) => ({ ...c, theme: id }))}
                      className={cn('flex h-[50px] flex-1 items-center justify-center gap-2 rounded-xl border text-[15px] transition-colors', config.theme === id ? 'border-[#1E6B47] bg-accent font-semibold text-foreground' : 'border-border bg-muted text-muted-foreground hover:text-foreground')}>
                      <Icon className="h-4 w-4" /> {label}
                    </button>
                  ))}
                </div>
              </div>
            </section>

            <section className={cn(CARD, 'flex flex-col gap-4 px-8 py-7')}>
              <div className="flex items-start justify-between gap-4">
                <CardTitle title="Avisar outra ferramenta" hint="Depois de cada resposta, o Zaapply manda os dados para este endereço. Serve para ligar o briefing ao n8n, Zapier ou Make." />
                {responses.length > 0 && config.webhook_url && <span className="shrink-0 rounded-full bg-green-500/15 px-3.5 py-1 text-[13px] font-semibold text-green-700 dark:text-green-400">{sentCount} de {responses.length} enviados</span>}
              </div>
              <div className="flex flex-col gap-2"><FieldLabel htmlFor="bf-hook">Endereço que recebe as respostas</FieldLabel><input id="bf-hook" className={FIELD} value={config.webhook_url || ''} onChange={(e) => setConfig((c) => ({ ...c, webhook_url: e.target.value }))} placeholder="https://sua-automacao.com/webhook/…" /></div>
            </section>

            <section className={cn(CARD, 'flex flex-col gap-4 px-8 py-7')}>
              <CardTitle title="O que acontece quando o lead envia" hint="Isso já funciona assim hoje, sem precisar configurar." />
              <ol className="flex flex-col rounded-xl border border-border bg-muted">
                {[
                  'O lead entra no CRM como Interessado, com o briefing marcado como preenchido. Quem já estava mais adiante no funil não volta para trás.',
                  'O agente SDR continua a conversa no WhatsApp, comenta o que ele respondeu e conduz para o próximo passo.',
                  'A resposta fica salva em Respostas e o endereço acima é avisado.',
                ].map((t, i) => (
                  <li key={i} className={cn('flex items-center gap-4 px-5 py-4', i > 0 && 'border-t border-border')}>
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-card text-[13px] font-semibold text-foreground">{i + 1}</span>
                    <span className="text-[15px] leading-normal text-foreground">{t}</span>
                  </li>
                ))}
              </ol>
            </section>

            <div className="flex gap-3">
              <Button className="h-[50px] px-8 text-base" onClick={() => saveConfig(config)} disabled={saving}>{saving && <Loader2 className="h-4 w-4 animate-spin" />} Salvar configurações</Button>
              <Button variant="secondary" className="h-[50px] px-7 text-base" disabled={!configDirty} onClick={() => savedConfig && setConfig(savedConfig)}>Descartar</Button>
            </div>
          </div>

          <aside className={cn(CARD, 'w-full shrink-0 px-7 py-7 xl:w-[620px]')}>
            <div className="mb-1 flex items-baseline justify-between"><h2 className="text-xl font-semibold text-foreground">Prévia</h2><span className="text-sm text-muted-foreground">Como o lead vê</span></div>
            <p className="mb-5 text-sm text-muted-foreground">O formulário mostra uma pergunta por tela, com a cor, o tema e o logo daqui.</p>
            <Preview config={config} sample={sample} total={questions.length + 1} />
          </aside>
        </div>
      )}

      <AlertDialog open={!!confirmDeleteResponse} onOpenChange={(o) => { if (!o) setConfirmDeleteResponse(null); }}>
        <AlertDialogContent className="max-w-[460px] rounded-[20px] border-border bg-card p-8">
          <AlertDialogTitle className="text-2xl font-semibold tracking-tight">Excluir esta resposta?</AlertDialogTitle>
          <AlertDialogDescription className="text-[15px] leading-normal text-muted-foreground">A resposta de {confirmDeleteResponse ? (nomeDeExibicao(confirmDeleteResponse.answers) || `número ${confirmDeleteResponse.id}`) : ''} some da lista e não dá para recuperar.</AlertDialogDescription>
          <div className="mt-4 flex justify-end gap-3">
            <Button variant="secondary" className="h-[46px] px-6" onClick={() => setConfirmDeleteResponse(null)} disabled={deletingResponse}>Cancelar</Button>
            <Button variant="destructive" className="h-[46px] px-7" onClick={deleteResponse} disabled={deletingResponse}>{deletingResponse && <Loader2 className="h-4 w-4 animate-spin" />} Excluir resposta</Button>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!confirmDeleteQuestion} onOpenChange={(o) => { if (!o) setConfirmDeleteQuestion(null); }}>
        <AlertDialogContent className="max-w-[460px] rounded-[20px] border-border bg-card p-8">
          <AlertDialogTitle className="text-2xl font-semibold tracking-tight">Excluir esta pergunta?</AlertDialogTitle>
          <AlertDialogDescription className="text-[15px] leading-normal text-muted-foreground">“{confirmDeleteQuestion?.label}” sai do formulário. As respostas antigas continuam salvas, mas essa pergunta deixa de aparecer nelas.</AlertDialogDescription>
          <div className="mt-4 flex justify-end gap-3">
            <Button variant="secondary" className="h-[46px] px-6" onClick={() => setConfirmDeleteQuestion(null)}>Cancelar</Button>
            <Button variant="destructive" className="h-[46px] px-7" onClick={deleteQuestion}>Excluir pergunta</Button>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
