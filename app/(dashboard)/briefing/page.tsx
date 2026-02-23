'use client';

import { useState, useEffect, useRef } from 'react';
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { toast } from '@/components/ui/use-toast';
import { useUser } from '@/lib/hooks/useUser';
import { generateBriefingMtPDF } from '@/lib/pdf/briefing-mt-generator';
import {
  Loader2, Copy, Check, ExternalLink, Trash2, Eye, FileText,
  Plus, GripVertical, Camera, X, Sun, Moon, Download,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

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
}

interface BriefingQuestion {
  id?: number;
  label: string;
  field_key: string;
  question_type: 'text' | 'textarea' | 'select' | 'multiselect' | 'radio' | 'checkbox';
  options?: string[];
  is_required: boolean;
  order_index: number;
}

interface BriefingResponse {
  id: number;
  answers: Record<string, any>;
  submitted_at: string;
  webhook_sent: boolean;
}

type SortableListItem =
  | { itemId: number; type: 'question'; q: BriefingQuestion; order_index: number }
  | { itemId: 'whatsapp'; type: 'whatsapp'; order_index: number };

const QUESTION_TYPES = [
  { value: 'text', label: 'Texto curto' },
  { value: 'textarea', label: 'Texto longo' },
  { value: 'select', label: 'Seleção única (dropdown)' },
  { value: 'radio', label: 'Seleção única (radio)' },
  { value: 'multiselect', label: 'Múltiplas escolhas' },
  { value: 'checkbox', label: 'Checkbox simples' },
];

function slugify(text: string) {
  return text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}
function fieldKeyify(text: string) {
  return text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}
function formatDate(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function buildCombinedList(questions: BriefingQuestion[], whatsappOrderIndex: number): SortableListItem[] {
  const items: SortableListItem[] = [
    ...questions.map(q => ({ itemId: q.id!, type: 'question' as const, q, order_index: q.order_index })),
    { itemId: 'whatsapp' as const, type: 'whatsapp' as const, order_index: whatsappOrderIndex },
  ];
  return items.sort((a, b) => a.order_index - b.order_index);
}

// ─── SortableQuestionItem ─────────────────────────────────────────────────────

function SortableQuestionItem({
  q,
  editingQuestion,
  setEditingQuestion,
  editOptionsInput,
  setEditOptionsInput,
  handleSaveEdit,
  handleDeleteQuestion,
}: {
  q: BriefingQuestion;
  editingQuestion: BriefingQuestion | null;
  setEditingQuestion: (q: BriefingQuestion | null) => void;
  editOptionsInput: string;
  setEditOptionsInput: (s: string) => void;
  handleSaveEdit: () => void;
  handleDeleteQuestion: (id: number) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: q.id! });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };
  const isEditing = editingQuestion !== null && editingQuestion.id === q.id;

  return (
    <div ref={setNodeRef} style={style} className="border rounded-lg p-3">
      {isEditing ? (
        <div className="space-y-3">
          <div className="grid md:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Pergunta</Label>
              <Input value={editingQuestion.label} onChange={(e) => setEditingQuestion({ ...editingQuestion, label: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Chave (field_key)</Label>
              <Input value={editingQuestion.field_key} onChange={(e) => setEditingQuestion({ ...editingQuestion, field_key: fieldKeyify(e.target.value) })} />
            </div>
          </div>
          <div className="grid md:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Tipo</Label>
              <Select value={editingQuestion.question_type} onValueChange={(v: any) => setEditingQuestion({ ...editingQuestion, question_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{QUESTION_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2 mt-5">
              <Switch checked={editingQuestion.is_required} onCheckedChange={(v) => setEditingQuestion({ ...editingQuestion, is_required: v })} />
              <Label className="text-xs">Obrigatório</Label>
            </div>
          </div>
          {['select', 'multiselect', 'radio', 'checkbox'].includes(editingQuestion.question_type) && (
            <div className="space-y-1">
              <Label className="text-xs">Opções (uma por linha)</Label>
              <textarea
                className="w-full border rounded p-2 text-sm min-h-[80px] bg-background resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                value={editOptionsInput || (editingQuestion.options || []).join('\n')}
                onChange={(e) => setEditOptionsInput(e.target.value)}
                placeholder={'Opção 1\nOpção 2\nOpção 3'}
              />
            </div>
          )}
          <div className="flex gap-2">
            <Button size="sm" onClick={handleSaveEdit}>Salvar</Button>
            <Button size="sm" variant="outline" onClick={() => { setEditingQuestion(null); setEditOptionsInput(''); }}>Cancelar</Button>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-3">
          <button
            {...attributes}
            {...listeners}
            className="text-muted-foreground cursor-grab active:cursor-grabbing shrink-0 touch-none p-0.5"
            title="Arrastar para reordenar"
          >
            <GripVertical className="h-4 w-4" />
          </button>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm truncate">{q.label}</p>
            <div className="flex gap-2 mt-1 flex-wrap">
              <Badge variant="outline" className="text-xs">{QUESTION_TYPES.find(t => t.value === q.question_type)?.label}</Badge>
              {q.is_required && <Badge className="text-xs">Obrigatório</Badge>}
            </div>
          </div>
          <div className="flex gap-1 shrink-0">
            <Button size="sm" variant="ghost" onClick={() => { setEditingQuestion(q); setEditOptionsInput(''); }}>Editar</Button>
            <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => q.id && handleDeleteQuestion(q.id)}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── SortableWhatsappItem ─────────────────────────────────────────────────────

function SortableWhatsappItem({
  config,
  editingWhatsappLabel,
  setEditingWhatsappLabel,
  whatsappLabelInput,
  setWhatsappLabelInput,
  handleSaveWhatsappLabel,
  saving,
}: {
  config: BriefingConfig;
  editingWhatsappLabel: boolean;
  setEditingWhatsappLabel: (v: boolean) => void;
  whatsappLabelInput: string;
  setWhatsappLabelInput: (v: string) => void;
  handleSaveWhatsappLabel: () => void;
  saving: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: 'whatsapp' });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };

  return (
    <div ref={setNodeRef} style={style} className="border rounded-lg p-3 bg-muted/30">
      {editingWhatsappLabel ? (
        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs">Texto da pergunta de WhatsApp</Label>
            <Input
              value={whatsappLabelInput}
              onChange={(e) => setWhatsappLabelInput(e.target.value)}
              placeholder="Qual o seu WhatsApp?"
              autoFocus
            />
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={handleSaveWhatsappLabel} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salvar
            </Button>
            <Button size="sm" variant="outline" onClick={() => setEditingWhatsappLabel(false)}>Cancelar</Button>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-3">
          <button
            {...attributes}
            {...listeners}
            className="text-muted-foreground cursor-grab active:cursor-grabbing shrink-0 touch-none p-0.5"
            title="Arrastar para reordenar"
          >
            <GripVertical className="h-4 w-4" />
          </button>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm">🇧🇷 {config.whatsapp_label || 'Qual o seu WhatsApp?'}</p>
            <div className="flex gap-2 mt-1 flex-wrap">
              <Badge variant="outline" className="text-xs">Telefone</Badge>
              <Badge className="text-xs">Obrigatório</Badge>
              <Badge variant="secondary" className="text-xs">Campo fixo</Badge>
            </div>
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setWhatsappLabelInput(config.whatsapp_label || '');
              setEditingWhatsappLabel(true);
            }}
          >
            Editar
          </Button>
        </div>
      )}
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function BriefingPage() {
  const { company } = useUser();
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [config, setConfig] = useState<BriefingConfig>({ slug: '', is_active: false, primary_color: '#7c3aed', theme: 'dark' });
  const [questions, setQuestions] = useState<BriefingQuestion[]>([]);
  const [responses, setResponses] = useState<BriefingResponse[]>([]);
  const [loadingResponses, setLoadingResponses] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [copied, setCopied] = useState(false);
  const [selectedResponse, setSelectedResponse] = useState<BriefingResponse | null>(null);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  // Questions state
  const [showAddQuestion, setShowAddQuestion] = useState(false);
  const [newQuestion, setNewQuestion] = useState<Partial<BriefingQuestion>>({ label: '', field_key: '', question_type: 'text', is_required: false });
  const [optionsInput, setOptionsInput] = useState('');
  const [editingQuestion, setEditingQuestion] = useState<BriefingQuestion | null>(null);
  const [editOptionsInput, setEditOptionsInput] = useState('');
  const [editingWhatsappLabel, setEditingWhatsappLabel] = useState(false);
  const [whatsappLabelInput, setWhatsappLabelInput] = useState('');

  const logoInputRef = useRef<HTMLInputElement>(null);
  const sensors = useSensors(useSensor(PointerSensor));

  const briefingUrl = typeof window !== 'undefined' ? `${window.location.origin}/briefing/${config.slug}` : `/briefing/${config.slug}`;

  useEffect(() => {
    fetchConfig();
    fetchQuestions();
    fetchResponses();
  }, []);

  async function fetchConfig() {
    try {
      const res = await fetch('/api/user/briefing/config');
      const data = await res.json();
      if (data.data) setConfig(data.data);
    } finally {
      setLoadingConfig(false);
    }
  }

  async function fetchQuestions() {
    const res = await fetch('/api/user/briefing/questions');
    const data = await res.json();
    if (data.success) setQuestions(data.data);
  }

  async function fetchResponses() {
    try {
      const res = await fetch('/api/user/briefing/responses');
      const data = await res.json();
      if (data.success) setResponses(data.data);
    } finally {
      setLoadingResponses(false);
    }
  }

  async function handleSaveConfig() {
    setSaving(true);
    try {
      const res = await fetch('/api/user/briefing/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);
      setConfig(data.data);
      toast({ title: 'Configuração salva!' });
    } catch (err: any) {
      toast({ title: err.message || 'Erro ao salvar', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveWhatsappLabel() {
    const updatedConfig = { ...config, whatsapp_label: whatsappLabelInput.trim() || undefined };
    setConfig(updatedConfig);
    setEditingWhatsappLabel(false);
    setSaving(true);
    try {
      const res = await fetch('/api/user/briefing/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedConfig),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);
      setConfig(data.data);
      toast({ title: 'Pergunta de WhatsApp atualizada!' });
    } catch (err: any) {
      toast({ title: err.message || 'Erro ao salvar', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const currentCombined = buildCombinedList(questions, config.whatsapp_order_index ?? questions.length);

    const oldIndex = currentCombined.findIndex(item => item.itemId === active.id);
    const newIndex = currentCombined.findIndex(item => item.itemId === over.id);

    const reordered = arrayMove(currentCombined, oldIndex, newIndex).map((item, idx) => ({ ...item, order_index: idx }));

    const updatedQuestions = reordered
      .filter((item): item is SortableListItem & { type: 'question' } => item.type === 'question')
      .map(item => ({ ...item.q, order_index: item.order_index }));

    const whatsappItem = reordered.find(item => item.type === 'whatsapp');
    const newWhatsappIndex = whatsappItem?.order_index ?? questions.length;

    setQuestions(updatedQuestions);
    setConfig(prev => ({ ...prev, whatsapp_order_index: newWhatsappIndex }));

    try {
      await Promise.all([
        ...updatedQuestions.map(q =>
          fetch(`/api/user/briefing/questions/${q.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(q),
          })
        ),
        fetch('/api/user/briefing/config', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...config, whatsapp_order_index: newWhatsappIndex }),
        }),
      ]);
    } catch (err: any) {
      toast({ title: 'Erro ao reordenar', description: err.message, variant: 'destructive' });
      fetchQuestions();
      fetchConfig();
    }
  }

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingLogo(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch('/api/admin/briefing/upload-logo', { method: 'POST', body: form });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);
      setConfig(prev => ({ ...prev, logo_url: data.url }));
      toast({ title: 'Logo enviado!' });
    } catch (err: any) {
      toast({ title: err.message || 'Erro no upload', variant: 'destructive' });
    } finally {
      setUploadingLogo(false);
      if (logoInputRef.current) logoInputRef.current.value = '';
    }
  }

  async function handleDeleteResponse(id: number) {
    setDeletingId(id);
    try {
      const res = await fetch(`/api/user/briefing/responses/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);
      setResponses(prev => prev.filter(r => r.id !== id));
      toast({ title: 'Resposta removida' });
    } catch (err: any) {
      toast({ title: 'Erro ao remover', description: err.message, variant: 'destructive' });
    } finally {
      setDeletingId(null);
    }
  }

  async function handleAddQuestion() {
    if (!newQuestion.label) return toast({ title: 'Informe a pergunta', variant: 'destructive' });
    if (!newQuestion.field_key) return toast({ title: 'Informe a chave do campo', variant: 'destructive' });
    const needsOptions = ['select', 'multiselect', 'radio', 'checkbox'].includes(newQuestion.question_type || '');
    const parsedOptions = optionsInput ? optionsInput.split('\n').map(o => o.trim()).filter(Boolean) : [];
    if (needsOptions && parsedOptions.length === 0) return toast({ title: 'Adicione pelo menos uma opção', variant: 'destructive' });

    try {
      const res = await fetch('/api/user/briefing/questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...newQuestion, options: needsOptions ? parsedOptions : null, order_index: questions.length + 1 }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);
      setQuestions(prev => [...prev, data.data]);
      setNewQuestion({ label: '', field_key: '', question_type: 'text', is_required: false });
      setOptionsInput('');
      setShowAddQuestion(false);
      toast({ title: 'Pergunta adicionada!' });
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    }
  }

  async function handleSaveEdit() {
    if (!editingQuestion?.id) return;
    const needsOptions = ['select', 'multiselect', 'radio', 'checkbox'].includes(editingQuestion.question_type);
    const parsedOptions = editOptionsInput ? editOptionsInput.split('\n').map(o => o.trim()).filter(Boolean) : editingQuestion.options || [];
    try {
      const res = await fetch(`/api/user/briefing/questions/${editingQuestion.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...editingQuestion, options: needsOptions ? parsedOptions : null }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);
      setQuestions(prev => prev.map(q => q.id === editingQuestion.id ? data.data : q));
      setEditingQuestion(null);
      toast({ title: 'Pergunta atualizada!' });
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    }
  }

  async function handleDeleteQuestion(id: number) {
    try {
      const res = await fetch(`/api/user/briefing/questions/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);
      setQuestions(prev => prev.filter(q => q.id !== id));
      toast({ title: 'Pergunta removida' });
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    }
  }

  function copyUrl() {
    navigator.clipboard.writeText(briefingUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleDownloadPDF(response: BriefingResponse) {
    setDownloadingPdf(true);
    try {
      const blob = await generateBriefingMtPDF({
        companyName: company?.name || 'Empresa',
        title: config.title || 'Briefing',
        primaryColor: config.primary_color || '#7c3aed',
        logoUrl: config.logo_url,
        questions,
        answers: response.answers,
        submittedAt: response.submitted_at,
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `briefing-${response.id}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      toast({ title: 'Erro ao gerar PDF', description: err.message, variant: 'destructive' });
    } finally {
      setDownloadingPdf(false);
    }
  }

  if (loadingConfig) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const needsOptions = ['select', 'multiselect', 'radio', 'checkbox'].includes(newQuestion.question_type || '');
  const combinedList = buildCombinedList(questions, config.whatsapp_order_index ?? questions.length);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Briefing</h1>
          <p className="text-muted-foreground mt-1">Gerencie seu formulário e visualize as respostas recebidas</p>
        </div>
        {config.slug && (
          <div className="flex items-center gap-2 px-3 py-2 bg-muted rounded-lg border max-w-sm w-full md:w-auto">
            <span className="text-sm text-muted-foreground truncate flex-1">{briefingUrl}</span>
            <button onClick={copyUrl} className="shrink-0 text-muted-foreground hover:text-foreground transition-colors">
              {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
            </button>
            <a href={briefingUrl} target="_blank" rel="noopener noreferrer" className="shrink-0 text-muted-foreground hover:text-foreground transition-colors">
              <ExternalLink className="h-4 w-4" />
            </a>
          </div>
        )}
      </div>

      <Tabs defaultValue="respostas">
        <TabsList>
          <TabsTrigger value="respostas">
            Respostas
            {responses.length > 0 && (
              <Badge variant="secondary" className="ml-2 text-xs">{responses.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="formulario">Formulário</TabsTrigger>
          <TabsTrigger value="configuracoes">Configurações</TabsTrigger>
        </TabsList>

        {/* ─── ABA: RESPOSTAS ─────────────────────────────────────────────── */}
        <TabsContent value="respostas" className="mt-6">
          {loadingResponses ? (
            <div className="flex items-center justify-center h-40">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : responses.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                <FileText className="h-10 w-10 text-muted-foreground mb-4" />
                <h3 className="font-semibold text-lg">Nenhuma resposta ainda</h3>
                <p className="text-muted-foreground text-sm mt-1">Compartilhe o link do briefing para começar a receber respostas.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {responses.map((r) => (
                <Card key={r.id} className="overflow-hidden">
                  <div className="flex items-center justify-between p-4">
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <FileText className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium text-sm">
                          {Object.values(r.answers)[0] as string || `Resposta #${r.id}`}
                        </p>
                        <p className="text-xs text-muted-foreground">{formatDate(r.submitted_at)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button size="sm" variant="outline" onClick={() => setSelectedResponse(r)} className="gap-1.5">
                        <Eye className="h-3.5 w-3.5" />Ver
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => handleDownloadPDF(r)} disabled={downloadingPdf} className="gap-1.5">
                        {downloadingPdf ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}PDF
                      </Button>
                      <button onClick={() => handleDeleteResponse(r.id)} disabled={deletingId === r.id} className="text-muted-foreground hover:text-destructive transition-colors p-1.5 rounded">
                        {deletingId === r.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ─── ABA: FORMULÁRIO ────────────────────────────────────────────── */}
        <TabsContent value="formulario" className="mt-6 space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Perguntas</CardTitle>
                  <CardDescription>{questions.length} pergunta{questions.length !== 1 ? 's' : ''} + WhatsApp</CardDescription>
                </div>
                <Button size="sm" onClick={() => setShowAddQuestion(!showAddQuestion)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Adicionar
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {questions.length === 0 && !showAddQuestion && (
                <p className="text-center text-muted-foreground py-4 text-sm">Nenhuma pergunta ainda. Clique em Adicionar para começar.</p>
              )}

              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext
                  items={combinedList.map(item => item.itemId)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="space-y-2">
                    {combinedList.map(item =>
                      item.type === 'whatsapp' ? (
                        <SortableWhatsappItem
                          key="whatsapp"
                          config={config}
                          editingWhatsappLabel={editingWhatsappLabel}
                          setEditingWhatsappLabel={setEditingWhatsappLabel}
                          whatsappLabelInput={whatsappLabelInput}
                          setWhatsappLabelInput={setWhatsappLabelInput}
                          handleSaveWhatsappLabel={handleSaveWhatsappLabel}
                          saving={saving}
                        />
                      ) : (
                        <SortableQuestionItem
                          key={item.q.id}
                          q={item.q}
                          editingQuestion={editingQuestion}
                          setEditingQuestion={setEditingQuestion}
                          editOptionsInput={editOptionsInput}
                          setEditOptionsInput={setEditOptionsInput}
                          handleSaveEdit={handleSaveEdit}
                          handleDeleteQuestion={handleDeleteQuestion}
                        />
                      )
                    )}
                  </div>
                </SortableContext>
              </DndContext>

              {/* Mensagem final */}
              <div className="border rounded-lg p-4 space-y-2 mt-2">
                <Label className="text-sm font-medium">Mensagem final</Label>
                <p className="text-xs text-muted-foreground">Exibida após o envio do formulário</p>
                <textarea
                  className="w-full border rounded-md p-3 text-sm min-h-[80px] bg-background resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                  value={config.success_message ?? ''}
                  onChange={(e) => setConfig({ ...config, success_message: e.target.value })}
                  placeholder="Obrigado pelo preenchimento! Entraremos em contato em breve."
                />
                <Button size="sm" onClick={handleSaveConfig} disabled={saving}>
                  {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Salvando...</> : 'Salvar mensagem'}
                </Button>
              </div>

              {/* Form nova pergunta */}
              {showAddQuestion && (
                <div className="border rounded-lg p-4 bg-muted/30 space-y-3 mt-2">
                  <p className="font-medium text-sm">Nova pergunta</p>
                  <div className="grid md:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Pergunta *</Label>
                      <Input value={newQuestion.label || ''} onChange={(e) => setNewQuestion({ ...newQuestion, label: e.target.value, field_key: fieldKeyify(e.target.value) })} placeholder="Ex: Nome da empresa" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Chave *</Label>
                      <Input value={newQuestion.field_key || ''} onChange={(e) => setNewQuestion({ ...newQuestion, field_key: fieldKeyify(e.target.value) })} placeholder="nome_empresa" />
                    </div>
                  </div>
                  <div className="grid md:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Tipo *</Label>
                      <Select value={newQuestion.question_type} onValueChange={(v: any) => setNewQuestion({ ...newQuestion, question_type: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{QUESTION_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-center gap-2 mt-5">
                      <Switch checked={newQuestion.is_required || false} onCheckedChange={(v) => setNewQuestion({ ...newQuestion, is_required: v })} />
                      <Label className="text-xs">Obrigatório</Label>
                    </div>
                  </div>
                  {needsOptions && (
                    <div className="space-y-1">
                      <Label className="text-xs">Opções (uma por linha) *</Label>
                      <textarea className="w-full border rounded p-2 text-sm min-h-[80px] bg-background resize-none" value={optionsInput} onChange={(e) => setOptionsInput(e.target.value)} placeholder={'Opção 1\nOpção 2\nOpção 3'} />
                    </div>
                  )}
                  <div className="flex gap-2">
                    <Button size="sm" onClick={handleAddQuestion}>Adicionar</Button>
                    <Button size="sm" variant="outline" onClick={() => setShowAddQuestion(false)}>Cancelar</Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── ABA: CONFIGURAÇÕES ─────────────────────────────────────────── */}
        <TabsContent value="configuracoes" className="mt-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Configurações do Briefing</CardTitle>
                  <CardDescription>Branding e aparência do seu formulário público</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">{config.is_active ? 'Ativo' : 'Inativo'}</span>
                  <Switch checked={config.is_active} onCheckedChange={(v) => setConfig({ ...config, is_active: v })} />
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Slug (URL)</Label>
                  <Input value={config.slug} onChange={(e) => setConfig({ ...config, slug: slugify(e.target.value) })} placeholder="nome-da-empresa" />
                  <p className="text-xs text-muted-foreground">/briefing/<strong>{config.slug || 'slug'}</strong></p>
                </div>
                <div className="space-y-2">
                  <Label>Cor principal</Label>
                  <div className="flex gap-2">
                    <input type="color" value={config.primary_color || '#7c3aed'} onChange={(e) => setConfig({ ...config, primary_color: e.target.value })} className="h-10 w-16 rounded border cursor-pointer" />
                    <Input value={config.primary_color || '#7c3aed'} onChange={(e) => setConfig({ ...config, primary_color: e.target.value })} placeholder="#7c3aed" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Título do formulário</Label>
                  <Input value={config.title || ''} onChange={(e) => setConfig({ ...config, title: e.target.value })} placeholder="Preencha seu briefing" />
                </div>
                <div className="space-y-2">
                  <Label>Descrição</Label>
                  <Input value={config.description || ''} onChange={(e) => setConfig({ ...config, description: e.target.value })} placeholder="Subtítulo do formulário" />
                </div>

                {/* Logo */}
                <div className="space-y-2">
                  <Label>Logo</Label>
                  <div className="flex items-center gap-3">
                    {config.logo_url ? (
                      <div className="relative w-16 h-16 rounded-lg border overflow-hidden bg-muted flex items-center justify-center shrink-0">
                        <img src={config.logo_url} alt="Logo" className="object-contain w-full h-full" />
                        <button type="button" onClick={() => setConfig({ ...config, logo_url: '' })} className="absolute top-0.5 right-0.5 bg-destructive text-destructive-foreground rounded-full p-0.5">
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ) : (
                      <div className="w-16 h-16 rounded-lg border border-dashed bg-muted flex items-center justify-center shrink-0">
                        <Camera className="h-6 w-6 text-muted-foreground" />
                      </div>
                    )}
                    <div className="flex flex-col gap-1">
                      <Button type="button" variant="outline" size="sm" onClick={() => logoInputRef.current?.click()} disabled={uploadingLogo}>
                        {uploadingLogo ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Enviando...</> : <><Camera className="mr-2 h-4 w-4" />{config.logo_url ? 'Trocar' : 'Fazer upload'}</>}
                      </Button>
                      <p className="text-xs text-muted-foreground">JPG, PNG, WebP — máx. 5MB</p>
                    </div>
                    <input ref={logoInputRef} type="file" className="hidden" accept="image/jpeg,image/jpg,image/png,image/webp" onChange={handleLogoUpload} />
                  </div>
                </div>

                {/* Tema */}
                <div className="space-y-2">
                  <Label>Tema</Label>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setConfig({ ...config, theme: 'dark' })} className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-lg border-2 transition-all ${config.theme === 'dark' ? 'border-primary bg-primary/10' : 'border-border'}`}>
                      <Moon className="h-4 w-4" /><span className="text-sm font-medium">Dark</span>
                    </button>
                    <button type="button" onClick={() => setConfig({ ...config, theme: 'light' })} className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-lg border-2 transition-all ${config.theme === 'light' ? 'border-primary bg-primary/10' : 'border-border'}`}>
                      <Sun className="h-4 w-4" /><span className="text-sm font-medium">Light</span>
                    </button>
                  </div>
                </div>
              </div>

              <Button onClick={handleSaveConfig} disabled={saving} className="w-full mt-2">
                {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Salvando...</> : 'Salvar configurações'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ─── MODAL: VISUALIZAR RESPOSTA ─────────────────────────────────── */}
      <Dialog open={!!selectedResponse} onOpenChange={(open) => { if (!open) setSelectedResponse(null); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-0">
          {selectedResponse && (
            <>
              <div className="h-1.5 w-full rounded-t-lg" style={{ backgroundColor: config.primary_color || '#7c3aed' }} />
              <div className="px-6 pt-5 pb-4 border-b">
                <div className="flex items-start gap-4">
                  {config.logo_url ? (
                    <img src={config.logo_url} alt="Logo" className="h-12 w-12 object-contain rounded-lg shrink-0" />
                  ) : (
                    <div className="h-12 w-12 rounded-lg shrink-0 flex items-center justify-center" style={{ backgroundColor: `${config.primary_color}20` }}>
                      <FileText className="h-6 w-6" style={{ color: config.primary_color || '#7c3aed' }} />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <DialogTitle className="text-xl font-bold leading-tight">{config.title || 'Briefing'}</DialogTitle>
                    <p className="text-sm text-muted-foreground mt-0.5">{company?.name}</p>
                    <p className="text-xs text-muted-foreground mt-1">{formatDate(selectedResponse.submitted_at)}</p>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => handleDownloadPDF(selectedResponse)} disabled={downloadingPdf} className="gap-1.5 shrink-0">
                    {downloadingPdf ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}PDF
                  </Button>
                </div>
              </div>
              <div className="px-6 py-5 space-y-5">
                {questions.length > 0 ? (
                  questions.map((q) => {
                    const val = selectedResponse.answers[q.field_key];
                    const display = Array.isArray(val) ? val.join(', ') : val != null && String(val).trim() !== '' ? String(val) : null;
                    return (
                      <div key={q.field_key} className="space-y-1.5">
                        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{q.label}</p>
                        <p className="text-sm leading-relaxed">{display ?? <span className="text-muted-foreground italic">Não informado</span>}</p>
                        <div className="border-b border-border/50" />
                      </div>
                    );
                  })
                ) : (
                  Object.entries(selectedResponse.answers).map(([key, value]) => (
                    <div key={key} className="space-y-1.5">
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{key.replace(/_/g, ' ')}</p>
                      <p className="text-sm leading-relaxed">{Array.isArray(value) ? value.join(', ') : String(value || '—')}</p>
                      <div className="border-b border-border/50" />
                    </div>
                  ))
                )}
              </div>
              <div className="px-6 py-3 border-t bg-muted/30 flex items-center justify-between">
                <p className="text-xs text-muted-foreground">nexio<span style={{ color: config.primary_color || '#7c3aed' }}>.</span>ai</p>
                <p className="text-xs text-muted-foreground">Gerado em {new Date().toLocaleDateString('pt-BR')}</p>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
