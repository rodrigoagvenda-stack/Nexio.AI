'use client';

import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Plus, Trash2, GripVertical, Copy, Check, ExternalLink, Camera, X, Sun, Moon } from 'lucide-react';
import { toast } from 'sonner';

interface BriefingConfig {
  id?: number;
  company_id: number;
  slug: string;
  is_active: boolean;
  primary_color: string;
  theme: 'dark' | 'light';
  logo_url?: string;
  title?: string;
  description?: string;
  webhook_url?: string;
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

const QUESTION_TYPES = [
  { value: 'text', label: 'Texto curto' },
  { value: 'textarea', label: 'Texto longo' },
  { value: 'select', label: 'Seleção única (dropdown)' },
  { value: 'radio', label: 'Seleção única (radio)' },
  { value: 'multiselect', label: 'Múltiplas escolhas (checkbox)' },
  { value: 'checkbox', label: 'Checkbox simples' },
];

function slugify(text: string) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function fieldKeyify(text: string) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}

interface Props {
  companyId: number;
  companyName: string;
}

export function BriefingCompanyConfig({ companyId, companyName }: Props) {
  const [config, setConfig] = useState<BriefingConfig>({
    company_id: companyId,
    slug: slugify(companyName),
    is_active: false,
    primary_color: '#7c3aed',
    theme: 'dark',
    title: `Briefing ${companyName}`,
  });
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [questions, setQuestions] = useState<BriefingQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [newQuestion, setNewQuestion] = useState<Partial<BriefingQuestion>>({
    label: '',
    field_key: '',
    question_type: 'text',
    options: [],
    is_required: false,
  });
  const [optionsInput, setOptionsInput] = useState('');
  const [showAddQuestion, setShowAddQuestion] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<BriefingQuestion | null>(null);
  const [editOptionsInput, setEditOptionsInput] = useState('');

  const briefingUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/briefing/${config.slug}`
    : `/briefing/${config.slug}`;

  useEffect(() => {
    fetchConfig();
    fetchQuestions();
  }, [companyId]);

  async function fetchConfig() {
    try {
      const res = await fetch(`/api/admin/briefing/${companyId}/config`);
      const data = await res.json();
      if (data.data) setConfig(data.data);
    } catch (err) {
      console.error('Error fetching briefing config:', err);
    } finally {
      setLoading(false);
    }
  }

  async function fetchQuestions() {
    try {
      const res = await fetch(`/api/admin/briefing/${companyId}/questions`);
      const data = await res.json();
      if (data.success) setQuestions(data.data);
    } catch (err) {
      console.error('Error fetching briefing questions:', err);
    }
  }

  async function handleSaveConfig() {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/briefing/${companyId}/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);
      setConfig(data.data);
      toast.success('Configuração de briefing salva!');
    } catch (err: any) {
      toast.error(err.message || 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  }

  async function handleAddQuestion() {
    if (!newQuestion.label) return toast.error('Informe o nome da pergunta');
    if (!newQuestion.field_key) return toast.error('Informe a chave do campo');

    const needsOptions = ['select', 'multiselect', 'radio', 'checkbox'].includes(newQuestion.question_type || '');
    const parsedOptions = optionsInput ? optionsInput.split('\n').map(o => o.trim()).filter(Boolean) : [];
    if (needsOptions && parsedOptions.length === 0) return toast.error('Adicione pelo menos uma opção');

    try {
      const res = await fetch(`/api/admin/briefing/${companyId}/questions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newQuestion,
          options: needsOptions ? parsedOptions : null,
          order_index: questions.length,
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);
      setQuestions(prev => [...prev, data.data]);
      setNewQuestion({ label: '', field_key: '', question_type: 'text', options: [], is_required: false });
      setOptionsInput('');
      setShowAddQuestion(false);
      toast.success('Pergunta adicionada!');
    } catch (err: any) {
      toast.error(err.message || 'Erro ao adicionar pergunta');
    }
  }

  async function handleDeleteQuestion(id: number) {
    try {
      const res = await fetch(`/api/admin/briefing/${companyId}/questions/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);
      setQuestions(prev => prev.filter(q => q.id !== id));
      toast.success('Pergunta removida!');
    } catch (err: any) {
      toast.error(err.message || 'Erro ao remover');
    }
  }

  async function handleSaveEdit() {
    if (!editingQuestion?.id) return;
    const needsOptions = ['select', 'multiselect', 'radio', 'checkbox'].includes(editingQuestion.question_type);
    const parsedOptions = editOptionsInput ? editOptionsInput.split('\n').map(o => o.trim()).filter(Boolean) : editingQuestion.options || [];

    try {
      const res = await fetch(`/api/admin/briefing/${companyId}/questions/${editingQuestion.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...editingQuestion, options: needsOptions ? parsedOptions : null }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);
      setQuestions(prev => prev.map(q => q.id === editingQuestion.id ? data.data : q));
      setEditingQuestion(null);
      toast.success('Pergunta atualizada!');
    } catch (err: any) {
      toast.error(err.message || 'Erro ao atualizar');
    }
  }

  function copyUrl() {
    navigator.clipboard.writeText(briefingUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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
      setConfig((prev) => ({ ...prev, logo_url: data.url }));
      toast.success('Logo carregado!');
    } catch (err: any) {
      toast.error(err.message || 'Erro ao fazer upload');
    } finally {
      setUploadingLogo(false);
      if (logoInputRef.current) logoInputRef.current.value = '';
    }
  }

  if (loading) {
    return <div className="flex items-center gap-2 py-4 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Carregando configuração de briefing...</div>;
  }

  const needsOptions = ['select', 'multiselect', 'radio', 'checkbox'].includes(newQuestion.question_type || '');

  return (
    <div className="space-y-6">
      {/* Config principal */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Briefing</CardTitle>
              <CardDescription>Configure o formulário público desta empresa</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">{config.is_active ? 'Ativo' : 'Inativo'}</span>
              <Switch
                checked={config.is_active}
                onCheckedChange={(v) => setConfig({ ...config, is_active: v })}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* URL do briefing */}
          {config.slug && (
            <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
              <span className="text-sm text-muted-foreground flex-1 truncate">{briefingUrl}</span>
              <Button variant="ghost" size="sm" onClick={copyUrl} className="shrink-0">
                {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
              </Button>
              <Button variant="ghost" size="sm" asChild className="shrink-0">
                <a href={briefingUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4" />
                </a>
              </Button>
            </div>
          )}

          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Slug (URL)</Label>
              <Input
                value={config.slug}
                onChange={(e) => setConfig({ ...config, slug: slugify(e.target.value) })}
                placeholder="nome-da-empresa"
              />
              <p className="text-xs text-muted-foreground">/briefing/<strong>{config.slug || 'slug'}</strong></p>
            </div>
            <div className="space-y-2">
              <Label>Cor principal</Label>
              <div className="flex gap-2">
                <input
                  type="color"
                  value={config.primary_color || '#7c3aed'}
                  onChange={(e) => setConfig({ ...config, primary_color: e.target.value })}
                  className="h-10 w-16 rounded border cursor-pointer"
                />
                <Input
                  value={config.primary_color || '#7c3aed'}
                  onChange={(e) => setConfig({ ...config, primary_color: e.target.value })}
                  placeholder="#7c3aed"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Título do formulário</Label>
              <Input
                value={config.title || ''}
                onChange={(e) => setConfig({ ...config, title: e.target.value })}
                placeholder="Preencha seu briefing"
              />
            </div>
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Input
                value={config.description || ''}
                onChange={(e) => setConfig({ ...config, description: e.target.value })}
                placeholder="Subtítulo do formulário"
              />
            </div>
            {/* Logo upload */}
            <div className="space-y-2">
              <Label>Logo do formulário</Label>
              <div className="flex items-center gap-3">
                {config.logo_url ? (
                  <div className="relative w-16 h-16 rounded-lg border overflow-hidden bg-muted flex items-center justify-center shrink-0">
                    <img src={config.logo_url} alt="Logo" className="object-contain w-full h-full" />
                    <button
                      type="button"
                      onClick={() => setConfig({ ...config, logo_url: '' })}
                      className="absolute top-0.5 right-0.5 bg-destructive text-destructive-foreground rounded-full p-0.5"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ) : (
                  <div className="w-16 h-16 rounded-lg border border-dashed bg-muted flex items-center justify-center shrink-0">
                    <Camera className="h-6 w-6 text-muted-foreground" />
                  </div>
                )}
                <div className="flex flex-col gap-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => logoInputRef.current?.click()}
                    disabled={uploadingLogo}
                  >
                    {uploadingLogo ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Enviando...</> : <><Camera className="mr-2 h-4 w-4" />{config.logo_url ? 'Trocar logo' : 'Fazer upload'}</>}
                  </Button>
                  <p className="text-xs text-muted-foreground">JPG, PNG, WebP — máx. 5MB</p>
                </div>
                <input
                  ref={logoInputRef}
                  type="file"
                  className="hidden"
                  accept="image/jpeg,image/jpg,image/png,image/webp"
                  onChange={handleLogoUpload}
                />
              </div>
            </div>

            {/* Tema dark/light */}
            <div className="space-y-2">
              <Label>Tema do formulário</Label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setConfig({ ...config, theme: 'dark' })}
                  className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-lg border-2 transition-all ${config.theme === 'dark' ? 'border-primary bg-primary/10' : 'border-border'}`}
                >
                  <Moon className="h-4 w-4" />
                  <span className="text-sm font-medium">Dark</span>
                </button>
                <button
                  type="button"
                  onClick={() => setConfig({ ...config, theme: 'light' })}
                  className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-lg border-2 transition-all ${config.theme === 'light' ? 'border-primary bg-primary/10' : 'border-border'}`}
                >
                  <Sun className="h-4 w-4" />
                  <span className="text-sm font-medium">Light</span>
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Webhook (ao receber resposta)</Label>
              <Input
                value={config.webhook_url || ''}
                onChange={(e) => setConfig({ ...config, webhook_url: e.target.value })}
                placeholder="https://n8n.empresa.com/webhook/briefing"
              />
            </div>
          </div>

          <Button onClick={handleSaveConfig} disabled={saving} className="w-full mt-2">
            {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Salvando...</> : 'Salvar configuração'}
          </Button>
        </CardContent>
      </Card>

      {/* Perguntas */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Perguntas do Briefing</CardTitle>
              <CardDescription>{questions.length} pergunta{questions.length !== 1 ? 's' : ''} configurada{questions.length !== 1 ? 's' : ''}</CardDescription>
            </div>
            <Button size="sm" onClick={() => setShowAddQuestion(!showAddQuestion)}>
              <Plus className="mr-2 h-4 w-4" />
              Adicionar
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Lista de perguntas */}
          {questions.length === 0 ? (
            <p className="text-center text-muted-foreground py-6">Nenhuma pergunta configurada</p>
          ) : (
            <div className="space-y-2">
              {questions.map((q) => (
                <div key={q.id} className="border rounded-lg p-3">
                  {editingQuestion !== null && editingQuestion.id === q.id ? (
                    <div className="space-y-3">
                      <div className="grid md:grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label className="text-xs">Pergunta</Label>
                          <Input
                            value={editingQuestion.label}
                            onChange={(e) => setEditingQuestion({ ...editingQuestion, label: e.target.value })}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Chave (field_key)</Label>
                          <Input
                            value={editingQuestion.field_key}
                            onChange={(e) => setEditingQuestion({ ...editingQuestion, field_key: fieldKeyify(e.target.value) })}
                          />
                        </div>
                      </div>
                      <div className="grid md:grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label className="text-xs">Tipo</Label>
                          <Select
                            value={editingQuestion.question_type}
                            onValueChange={(v: any) => setEditingQuestion({ ...editingQuestion, question_type: v })}
                          >
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {QUESTION_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="flex items-center gap-2 mt-5">
                          <Switch
                            checked={editingQuestion.is_required}
                            onCheckedChange={(v) => setEditingQuestion({ ...editingQuestion, is_required: v })}
                          />
                          <Label className="text-xs">Obrigatório</Label>
                        </div>
                      </div>
                      {['select', 'multiselect', 'radio', 'checkbox'].includes(editingQuestion.question_type) && (
                        <div className="space-y-1">
                          <Label className="text-xs">Opções (uma por linha)</Label>
                          <textarea
                            className="w-full border rounded p-2 text-sm min-h-[80px]"
                            value={editOptionsInput || (editingQuestion.options || []).join('\n')}
                            onChange={(e) => setEditOptionsInput(e.target.value)}
                            placeholder="Opção 1&#10;Opção 2&#10;Opção 3"
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
                      <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{q.label}</p>
                        <div className="flex gap-2 mt-1">
                          <Badge variant="outline" className="text-xs">{QUESTION_TYPES.find(t => t.value === q.question_type)?.label}</Badge>
                          {q.is_required && <Badge className="text-xs">Obrigatório</Badge>}
                        </div>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <Button size="sm" variant="ghost" onClick={() => { setEditingQuestion(q); setEditOptionsInput(''); }}>Editar</Button>
                        <Button size="sm" variant="ghost" className="text-destructive" onClick={() => q.id && handleDeleteQuestion(q.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Formulário de nova pergunta */}
          {showAddQuestion && (
            <div className="border rounded-lg p-4 bg-muted/30 space-y-3 mt-4">
              <p className="font-medium text-sm">Nova pergunta</p>
              <div className="grid md:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Pergunta *</Label>
                  <Input
                    value={newQuestion.label || ''}
                    onChange={(e) => setNewQuestion({
                      ...newQuestion,
                      label: e.target.value,
                      field_key: fieldKeyify(e.target.value),
                    })}
                    placeholder="Ex: Nome da empresa"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Chave (field_key) *</Label>
                  <Input
                    value={newQuestion.field_key || ''}
                    onChange={(e) => setNewQuestion({ ...newQuestion, field_key: fieldKeyify(e.target.value) })}
                    placeholder="nome_empresa"
                  />
                </div>
              </div>
              <div className="grid md:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Tipo *</Label>
                  <Select
                    value={newQuestion.question_type}
                    onValueChange={(v: any) => setNewQuestion({ ...newQuestion, question_type: v })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {QUESTION_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2 mt-5">
                  <Switch
                    checked={newQuestion.is_required || false}
                    onCheckedChange={(v) => setNewQuestion({ ...newQuestion, is_required: v })}
                  />
                  <Label className="text-xs">Obrigatório</Label>
                </div>
              </div>
              {needsOptions && (
                <div className="space-y-1">
                  <Label className="text-xs">Opções (uma por linha) *</Label>
                  <textarea
                    className="w-full border rounded p-2 text-sm min-h-[80px]"
                    value={optionsInput}
                    onChange={(e) => setOptionsInput(e.target.value)}
                    placeholder="Opção 1&#10;Opção 2&#10;Opção 3"
                  />
                </div>
              )}
              <div className="flex gap-2">
                <Button size="sm" onClick={handleAddQuestion}>Adicionar pergunta</Button>
                <Button size="sm" variant="outline" onClick={() => setShowAddQuestion(false)}>Cancelar</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
