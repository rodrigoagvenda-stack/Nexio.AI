'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/components/ui/use-toast';
import { Loader2, Plus, FileText, CheckCircle2, XCircle, Clock, Copy, Trash2, Upload, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';

type Kind = 'simple' | 'buttons' | 'carousel';
type HeaderType = 'none' | 'image' | 'video';
type ButtonType = 'quick_reply' | 'url';

interface ButtonDraft { type: ButtonType; text: string; url?: string }
interface CarouselCardDraft { header_type: 'image' | 'video'; media_url: string; body_text: string; buttons: ButtonDraft[] }

interface HSMTemplate {
  id: string;
  name: string;
  category: 'marketing' | 'utility' | 'authentication';
  language: string;
  body: string;
  status: 'pendente' | 'aprovado' | 'rejeitado';
  rejection_reason: string | null;
  meta_template_id: string | null;
  created_at: string;
  kind: Kind;
  header_type: HeaderType | null;
  header_media_url: string | null;
  buttons: ButtonDraft[] | null;
  carousel_cards: CarouselCardDraft[] | null;
}

const STATUS_CONFIG = {
  pendente:   { label: 'Pendente',  icon: Clock,        color: 'text-amber-400 bg-amber-500/10' },
  aprovado:   { label: 'Aprovado',  icon: CheckCircle2, color: 'text-emerald-400 bg-emerald-500/10' },
  rejeitado:  { label: 'Rejeitado', icon: XCircle,      color: 'text-red-400 bg-red-500/10' },
};

const CAT_LABELS = {
  marketing: 'Marketing',
  utility: 'Utilidade',
  authentication: 'Autenticação',
};

const KIND_LABELS: Record<Kind, string> = { simple: 'Simples', buttons: 'Botões', carousel: 'Carrossel' };

const EMPTY_FORM = {
  name: '',
  category: 'marketing' as HSMTemplate['category'],
  language: 'pt_BR',
  body: '',
  kind: 'simple' as Kind,
  header_type: 'none' as HeaderType,
  header_media_url: '',
  buttons: [] as ButtonDraft[],
  carousel_cards: [] as CarouselCardDraft[],
};

function UploadZone({ label, current, onUpload }: { label: string; current?: string; onUpload: (url: string) => void }) {
  const [uploading, setUploading] = useState(false);

  async function handleFile(file: File) {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/follow/upload', { method: 'POST', body: fd });
      const data = await res.json();
      if (res.ok) onUpload(data.url);
      else toast({ title: data.error || 'Erro no upload', variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  }

  function openPicker() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*,video/*';
    input.onchange = (e) => { const f = (e.target as HTMLInputElement).files?.[0]; if (f) handleFile(f); };
    input.click();
  }

  return (
    <div
      onClick={!uploading ? openPicker : undefined}
      className={cn(
        'border-2 border-dashed rounded-xl p-3 text-center transition-colors select-none',
        !uploading && 'cursor-pointer hover:border-primary/40 hover:bg-muted/30',
        uploading && 'opacity-60 pointer-events-none',
        'border-border'
      )}
    >
      {uploading ? (
        <div className="flex items-center justify-center gap-2 py-1">
          <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
          <span className="text-xs text-muted-foreground">Enviando…</span>
        </div>
      ) : current ? (
        <div className="flex items-center gap-2 justify-center py-1">
          <CheckCircle2 className="w-4 h-4 text-primary" />
          <span className="text-xs text-primary font-medium">Mídia enviada · clique pra trocar</span>
        </div>
      ) : (
        <div className="flex items-center justify-center gap-1.5 py-1">
          <Upload className="w-4 h-4 text-muted-foreground/40" />
          <span className="text-xs text-muted-foreground">{label}</span>
        </div>
      )}
    </div>
  );
}

function ButtonsBuilder({ buttons, onChange, max }: { buttons: ButtonDraft[]; onChange: (b: ButtonDraft[]) => void; max: number }) {
  function update(i: number, patch: Partial<ButtonDraft>) {
    onChange(buttons.map((b, idx) => idx === i ? { ...b, ...patch } : b));
  }
  function remove(i: number) {
    onChange(buttons.filter((_, idx) => idx !== i));
  }
  function add() {
    if (buttons.length >= max) return;
    onChange([...buttons, { type: 'quick_reply', text: '' }]);
  }

  return (
    <div className="space-y-2">
      {buttons.map((b, i) => (
        <div key={i} className="flex items-center gap-1.5">
          <select
            value={b.type}
            onChange={(e) => update(i, { type: e.target.value as ButtonType })}
            className="h-8 text-xs rounded-lg border border-border bg-muted px-1.5"
          >
            <option value="quick_reply">Resposta rápida</option>
            <option value="url">Link</option>
          </select>
          <Input value={b.text} onChange={(e) => update(i, { text: e.target.value.slice(0, 25) })} placeholder="Texto (máx 25)" className="h-8 text-xs flex-1" />
          {b.type === 'url' && (
            <Input value={b.url ?? ''} onChange={(e) => update(i, { url: e.target.value })} placeholder="https://..." className="h-8 text-xs flex-1" />
          )}
          <button onClick={() => remove(i)} className="text-muted-foreground/50 hover:text-destructive shrink-0"><X className="w-3.5 h-3.5" /></button>
        </div>
      ))}
      {buttons.length < max && (
        <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={add}>
          <Plus className="w-3.5 h-3.5" />Adicionar botão
        </Button>
      )}
    </div>
  );
}

function CarouselCardsBuilder({ cards, onChange }: { cards: CarouselCardDraft[]; onChange: (c: CarouselCardDraft[]) => void }) {
  function update(i: number, patch: Partial<CarouselCardDraft>) {
    onChange(cards.map((c, idx) => idx === i ? { ...c, ...patch } : c));
  }
  function remove(i: number) {
    onChange(cards.filter((_, idx) => idx !== i));
  }
  function add() {
    if (cards.length >= 10) return;
    onChange([...cards, { header_type: 'image', media_url: '', body_text: '', buttons: [] }]);
  }

  return (
    <div className="space-y-3">
      {cards.map((c, i) => (
        <div key={i} className="p-3 rounded-xl border border-border space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold">Card {i + 1}</p>
            <button onClick={() => remove(i)} className="text-muted-foreground/50 hover:text-destructive"><Trash2 className="w-3.5 h-3.5" /></button>
          </div>
          <div className="flex gap-1.5">
            {(['image', 'video'] as const).map((t) => (
              <button
                key={t}
                onClick={() => update(i, { header_type: t })}
                className={cn('flex-1 h-7 rounded-lg border text-[11px] font-medium', c.header_type === t ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground')}
              >
                {t === 'image' ? 'Imagem' : 'Vídeo'}
              </button>
            ))}
          </div>
          <UploadZone label={`Mídia do card ${i + 1}`} current={c.media_url} onUpload={(url) => update(i, { media_url: url })} />
          <textarea
            value={c.body_text}
            onChange={(e) => update(i, { body_text: e.target.value.slice(0, 160) })}
            placeholder="Texto do card (máx 160 caracteres)"
            rows={2}
            className="w-full text-xs rounded-lg border border-border bg-muted px-2 py-1.5 resize-none focus:outline-none focus:ring-1 focus:ring-primary/50"
          />
          <p className="text-[10px] text-muted-foreground/70 text-right">{c.body_text.length}/160</p>
          <ButtonsBuilder buttons={c.buttons} onChange={(b) => update(i, { buttons: b })} max={2} />
        </div>
      ))}
      {cards.length < 10 && (
        <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5" onClick={add}>
          <Plus className="w-3.5 h-3.5" />Adicionar card ({cards.length}/10)
        </Button>
      )}
      {cards.length > 0 && cards.length < 2 && (
        <p className="text-[11px] text-amber-500">Carrossel precisa de pelo menos 2 cards.</p>
      )}
    </div>
  );
}

export function TemplatesHSMContent() {
  const [templates, setTemplates] = useState<HSMTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const loadTemplates = () => {
    fetch('/api/hsm-templates')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.data) setTemplates(d.data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadTemplates();
  }, []);

  // Status muda sozinho quando a Meta aprova/rejeita (webhook message_template_status_update
  // grava direto em hsm_templates) : escuta via Realtime pra tela atualizar sem precisar de F5.
  useEffect(() => {
    let channel: ReturnType<ReturnType<typeof createClient>['channel']> | null = null;

    (async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: userData } = await supabase
        .from('users')
        .select('company_id')
        .eq('auth_user_id', user.id)
        .single();

      if (!userData?.company_id) return;

      channel = supabase
        .channel('hsm-templates-status')
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'hsm_templates', filter: `company_id=eq.${userData.company_id}` },
          () => loadTemplates()
        )
        .subscribe();
    })();

    return () => {
      if (channel) createClient().removeChannel(channel);
    };
  }, []);

  function validateFormBeforeSave(): string | null {
    if (!form.name.trim() || !form.body.trim()) return 'Nome e corpo são obrigatórios';
    if (form.kind === 'simple' && form.header_type !== 'none' && !form.header_media_url) return 'Envie a mídia do header';
    if (form.kind === 'buttons') {
      if (form.buttons.length === 0) return 'Adicione ao menos 1 botão';
      if (form.buttons.some((b) => !b.text.trim() || (b.type === 'url' && !b.url?.trim()))) return 'Preencha todos os botões';
    }
    if (form.kind === 'carousel') {
      if (form.carousel_cards.length < 2) return 'Carrossel precisa de pelo menos 2 cards';
      if (form.carousel_cards.some((c) => !c.media_url || !c.body_text.trim())) return 'Preencha mídia e texto de todos os cards';
    }
    return null;
  }

  const handleAdd = async () => {
    const err = validateFormBeforeSave();
    if (err) { toast({ title: err, variant: 'destructive' }); return; }
    setSaving(true);
    try {
      const res = await fetch('/api/hsm-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name, category: form.category, language: form.language, body: form.body,
          kind: form.kind,
          header_type: form.kind === 'simple' ? form.header_type : undefined,
          header_media_url: form.kind === 'simple' ? (form.header_media_url || undefined) : undefined,
          buttons: form.kind === 'buttons' ? form.buttons : undefined,
          carousel_cards: form.kind === 'carousel' ? form.carousel_cards : undefined,
        }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      setTemplates(prev => [d.data, ...prev]);
      setForm(EMPTY_FORM);
      setAddOpen(false);
      toast({ title: 'Template criado! Submeta ao Meta para aprovação.' });
    } catch (err: any) {
      toast({ title: err.message || 'Erro ao criar template', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleSubmitToMeta = async (id: string) => {
    try {
      const res = await fetch(`/api/hsm-templates/${id}/submit`, { method: 'POST' });
      if (!res.ok) throw new Error((await res.json()).error);
      toast({ title: 'Template submetido ao Meta para aprovação!' });
    } catch (err: any) {
      toast({ title: err.message || 'Erro ao submeter', variant: 'destructive' });
    }
  };

  const handleDuplicate = (t: HSMTemplate) => {
    setForm({
      name: `${t.name}_copia`, category: t.category, language: t.language, body: t.body,
      kind: t.kind ?? 'simple',
      header_type: t.header_type ?? 'none',
      header_media_url: t.header_media_url ?? '',
      buttons: t.buttons ?? [],
      carousel_cards: t.carousel_cards ?? [],
    });
    setAddOpen(true);
  };

  const handleDelete = async (id: string) => {
    setDeleting(id);
    try {
      await fetch(`/api/hsm-templates/${id}`, { method: 'DELETE' });
      setTemplates(prev => prev.filter(t => t.id !== id));
    } catch {
      toast({ title: 'Erro ao deletar', variant: 'destructive' });
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Templates HSM aprovados pelo Meta — único meio de enviar mensagem ativa fora da janela de 24h/72h, e a única forma de lista/botões/carrossel funcionarem no canal Meta.</p>
        <Button size="sm" onClick={() => setAddOpen(o => !o)}>
          <Plus className="h-4 w-4 mr-1.5" />
          Novo template
        </Button>
      </div>

      {addOpen && (
        <div className="p-5 rounded-2xl border border-primary/30 bg-primary/5 space-y-3">
          <p className="text-sm font-semibold">Novo template HSM</p>

          <div>
            <Label className="text-xs">Tipo</Label>
            <div className="flex gap-2 mt-1">
              {(['simple', 'buttons', 'carousel'] as const).map((k) => (
                <button
                  key={k}
                  onClick={() => setForm((f) => ({ ...f, kind: k }))}
                  className={cn('flex-1 h-9 rounded-lg border text-xs font-medium transition-colors', form.kind === k ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:border-foreground/30')}
                >
                  {KIND_LABELS[k]}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-3">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Nome do template</Label>
                <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value.toLowerCase().replace(/\s+/g, '_') }))} placeholder="nome_do_template" className="h-9 mt-1 text-sm font-mono" />
              </div>
              <div>
                <Label className="text-xs">Idioma</Label>
                <Input value={form.language} onChange={e => setForm(f => ({ ...f, language: e.target.value }))} placeholder="pt_BR" className="h-9 mt-1 text-sm font-mono" />
              </div>
            </div>
            <div>
              <Label className="text-xs">Categoria</Label>
              <div className="flex gap-2 mt-1">
                {(['marketing', 'utility', 'authentication'] as const).map(c => (
                  <button
                    key={c}
                    onClick={() => setForm(f => ({ ...f, category: c }))}
                    className={cn(
                      'flex-1 h-9 rounded-lg border text-xs font-medium transition-colors',
                      form.category === c ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:border-foreground/30'
                    )}
                  >
                    {CAT_LABELS[c]}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <Label className="text-xs">Corpo da mensagem (use {`{{1}}`}, {`{{2}}`} para variáveis)</Label>
              <textarea
                value={form.body}
                onChange={e => setForm(f => ({ ...f, body: e.target.value }))}
                placeholder="Olá {{1}}, temos uma novidade especial para você..."
                rows={4}
                className="mt-1 w-full bg-muted rounded-lg border border-border text-sm px-3 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-primary/50 text-foreground"
              />
            </div>

            {form.kind === 'simple' && (
              <div>
                <Label className="text-xs">Header (opcional)</Label>
                <div className="flex gap-2 mt-1 mb-2">
                  {(['none', 'image', 'video'] as const).map((h) => (
                    <button
                      key={h}
                      onClick={() => setForm((f) => ({ ...f, header_type: h }))}
                      className={cn('flex-1 h-8 rounded-lg border text-xs font-medium', form.header_type === h ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground')}
                    >
                      {h === 'none' ? 'Sem header' : h === 'image' ? 'Imagem' : 'Vídeo'}
                    </button>
                  ))}
                </div>
                {form.header_type !== 'none' && (
                  <UploadZone label="Mídia do header" current={form.header_media_url} onUpload={(url) => setForm((f) => ({ ...f, header_media_url: url }))} />
                )}
              </div>
            )}

            {form.kind === 'buttons' && (
              <div>
                <Label className="text-xs">Botões (máx 3)</Label>
                <div className="mt-1">
                  <ButtonsBuilder buttons={form.buttons} onChange={(b) => setForm((f) => ({ ...f, buttons: b }))} max={3} />
                </div>
              </div>
            )}

            {form.kind === 'carousel' && (
              <div>
                <Label className="text-xs">Cards do carrossel (2 a 10, todos com a mesma estrutura de botões)</Label>
                <div className="mt-1">
                  <CarouselCardsBuilder cards={form.carousel_cards} onChange={(c) => setForm((f) => ({ ...f, carousel_cards: c }))} />
                </div>
              </div>
            )}
          </div>
          <div className="flex gap-2 pt-1">
            <Button variant="ghost" size="sm" onClick={() => { setAddOpen(false); setForm(EMPTY_FORM); }} className="text-muted-foreground">Cancelar</Button>
            <Button size="sm" onClick={handleAdd} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Criar template'}
            </Button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-32">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : templates.length === 0 ? (
        <div className="p-8 rounded-2xl border border-dashed border-border flex flex-col items-center gap-3 text-center">
          <FileText className="h-8 w-8 text-muted-foreground" />
          <div>
            <p className="font-medium text-sm">Nenhum template criado</p>
            <p className="text-xs text-muted-foreground mt-1">Templates aprovados permitem enviar mensagens ativas fora da janela de 24h</p>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {templates.map(t => {
            const sc = STATUS_CONFIG[t.status];
            const SIcon = sc.icon;
            return (
              <div key={t.id} className="p-4 rounded-2xl border border-border bg-card space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <code className="text-sm font-mono font-semibold">{t.name}</code>
                      <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">{CAT_LABELS[t.category]}</span>
                      <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">{t.language}</span>
                      {t.kind && t.kind !== 'simple' && (
                        <span className="text-[10px] text-primary bg-primary/10 px-1.5 py-0.5 rounded-full">{KIND_LABELS[t.kind]}</span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1.5 line-clamp-3">{t.body}</p>
                    {t.rejection_reason && (
                      <p className="text-xs text-red-400 mt-1">Motivo: {t.rejection_reason}</p>
                    )}
                  </div>
                  <div className={cn('flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold shrink-0', sc.color)}>
                    <SIcon className="h-3 w-3" />
                    {sc.label}
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-1 border-t border-border/60">
                  {t.status === 'pendente' && (
                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => handleSubmitToMeta(t.id)}>
                      Submeter ao Meta
                    </Button>
                  )}
                  {t.status === 'rejeitado' && (
                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => handleDuplicate(t)}>
                      <Copy className="h-3 w-3 mr-1" />
                      Duplicar e editar
                    </Button>
                  )}
                  <button
                    onClick={() => handleDelete(t.id)}
                    disabled={deleting === t.id}
                    className="ml-auto text-muted-foreground/50 hover:text-red-400 transition-colors"
                  >
                    {deleting === t.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
