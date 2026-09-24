'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';
import { Loader2, Plus, CheckCircle2, Trash2, Upload, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';
import { CARD, CardTitle, FIELD, FieldLabel } from './cfg-ui';

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
  pendente:  { label: 'Pendente',  pill: 'bg-amber-500/15 text-amber-700 dark:text-amber-400',   dot: 'bg-amber-500' },
  aprovado:  { label: 'Aprovado',  pill: 'bg-green-500/15 text-green-700 dark:text-green-400',   dot: 'bg-green-500' },
  rejeitado: { label: 'Rejeitado', pill: 'bg-red-500/15 text-red-700 dark:text-red-400',         dot: 'bg-red-500' },
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
            aria-label="Tipo do botão" className="h-9 rounded-lg border border-border bg-muted px-2 text-[13px]"
          >
            <option value="quick_reply">Resposta rápida</option>
            <option value="url">Link</option>
          </select>
          <input value={b.text} onChange={(e) => update(i, { text: e.target.value.slice(0, 25) })} placeholder="Texto (máx. 25)" aria-label="Texto do botão" className={cn(FIELD, 'h-9 flex-1 text-[13px]')} />
          {b.type === 'url' && (
            <input value={b.url ?? ''} onChange={(e) => update(i, { url: e.target.value })} placeholder="https://…" aria-label="Endereço do link" className={cn(FIELD, 'h-9 flex-1 text-[13px]')} />
          )}
          <button type="button" onClick={() => remove(i)} aria-label="Remover botão" className="shrink-0 text-muted-foreground hover:text-destructive"><X className="h-3.5 w-3.5" /></button>
        </div>
      ))}
      {buttons.length < max && (
        <Button type="button" size="sm" variant="secondary" className="h-9 gap-1 px-4 text-[13px]" onClick={add}>
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
        <div key={i} className="space-y-2 rounded-xl border border-border bg-card p-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold">Card {i + 1}</p>
            <button onClick={() => remove(i)} className="text-muted-foreground/50 hover:text-destructive"><Trash2 className="w-3.5 h-3.5" /></button>
          </div>
          <div className="flex gap-1.5">
            {(['image', 'video'] as const).map((t) => (
              <button
                key={t}
                onClick={() => update(i, { header_type: t })}
                className={cn('h-8 flex-1 rounded-lg border text-xs font-medium', c.header_type === t ? 'border-[#1E6B47] bg-accent text-foreground' : 'border-border text-muted-foreground')}
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
            aria-label="Texto do card" className="w-full resize-none rounded-lg border border-border bg-muted px-3 py-2 text-[13px] outline-none focus:border-primary/60"
          />
          <p className="text-[10px] text-muted-foreground/70 text-right">{c.body_text.length}/160</p>
          <ButtonsBuilder buttons={c.buttons} onChange={(b) => update(i, { buttons: b })} max={2} />
        </div>
      ))}
      {cards.length < 10 && (
        <Button type="button" size="sm" variant="secondary" className="h-9 gap-1.5 px-4 text-[13px]" onClick={add}>
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
  const [connected, setConnected] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const loadTemplates = () => {
    fetch('/api/hsm-templates')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d?.data) setTemplates(d.data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadTemplates();
    fetch('/api/sdr/config')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setConnected(!!(d?.config?.meta_wa_waba_id && d?.config?.meta_wa_token)))
      .catch(() => setConnected(false));
  }, []);

  // Status muda sozinho quando a Meta aprova/rejeita (o webhook grava direto em hsm_templates):
  // escuta via Realtime pra tela atualizar sem precisar de F5.
  useEffect(() => {
    let channel: ReturnType<ReturnType<typeof createClient>['channel']> | null = null;
    (async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: userData } = await supabase.from('users').select('company_id').eq('auth_user_id', user.id).single();
      if (!userData?.company_id) return;
      channel = supabase
        .channel('hsm-templates-status')
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'hsm_templates', filter: `company_id=eq.${userData.company_id}` }, () => loadTemplates())
        .subscribe();
    })();
    return () => { if (channel) createClient().removeChannel(channel); };
  }, []);

  function validateForm(): string | null {
    if (!form.name.trim() || !form.body.trim()) return 'Preencha o nome e a mensagem.';
    if (form.kind === 'simple' && form.header_type !== 'none' && !form.header_media_url) return 'Envie a mídia do cabeçalho.';
    if (form.kind === 'buttons') {
      if (form.buttons.length === 0) return 'Adicione pelo menos 1 botão.';
      if (form.buttons.some((b) => !b.text.trim() || (b.type === 'url' && !b.url?.trim()))) return 'Preencha todos os botões.';
    }
    if (form.kind === 'carousel') {
      if (form.carousel_cards.length < 2) return 'O carrossel precisa de pelo menos 2 cards.';
      if (form.carousel_cards.some((c) => !c.media_url || !c.body_text.trim())) return 'Preencha a mídia e o texto de todos os cards.';
    }
    return null;
  }

  async function handleAdd() {
    const err = validateForm();
    if (err) { toast({ variant: 'destructive', title: err }); return; }
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
      setTemplates((prev) => [d.data, ...prev]);
      setForm(EMPTY_FORM);
      toast({ variant: 'success', title: 'Template criado', description: 'Envie para a Meta analisar.' });
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Não foi possível criar o template', description: e?.message });
    } finally { setSaving(false); }
  }

  async function handleSubmitToMeta(id: string) {
    setSubmitting(id);
    try {
      const res = await fetch(`/api/hsm-templates/${id}/submit`, { method: 'POST' });
      if (!res.ok) throw new Error((await res.json()).error);
      toast({ variant: 'success', title: 'Enviado para a Meta', description: 'O status muda aqui quando ela responder.' });
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Não foi possível enviar', description: e?.message });
    } finally { setSubmitting(null); }
  }

  function handleDuplicate(t: HSMTemplate) {
    setForm({
      name: `${t.name}_copia`, category: t.category, language: t.language, body: t.body,
      kind: t.kind ?? 'simple', header_type: t.header_type ?? 'none', header_media_url: t.header_media_url ?? '',
      buttons: t.buttons ?? [], carousel_cards: t.carousel_cards ?? [],
    });
  }

  async function handleDelete(id: string) {
    setDeleting(id);
    try {
      const res = await fetch(`/api/hsm-templates/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      setTemplates((prev) => prev.filter((t) => t.id !== id));
    } catch {
      toast({ variant: 'destructive', title: 'Não foi possível excluir o template' });
    } finally { setDeleting(null); }
  }

  const choice = (on: boolean) => cn('h-12 flex-1 rounded-xl border text-[14.5px] transition-colors', on ? 'border-[#1E6B47] bg-accent font-semibold text-foreground' : 'border-border bg-muted text-muted-foreground hover:text-foreground');

  const list = loading ? (
    <div className="flex h-32 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
  ) : templates.length === 0 ? null : (
    <ul className="flex flex-col gap-3">
      {templates.map((t) => {
        const sc = STATUS_CONFIG[t.status];
        return (
          <li key={t.id} className={cn(CARD, 'flex flex-col gap-3 px-6 py-5')}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <code className="font-mono text-[17px] font-semibold text-foreground">{t.name}</code>
                <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs text-muted-foreground">{CAT_LABELS[t.category]}</span>
                <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs text-muted-foreground">{t.language}</span>
                {t.kind && t.kind !== 'simple' && <span className="rounded-full bg-green-500/15 px-2.5 py-0.5 text-xs text-green-700 dark:text-green-400">{KIND_LABELS[t.kind]}</span>}
              </div>
              <span className={cn('inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-[13px] font-semibold', sc.pill)}>
                <span className={cn('h-1.5 w-1.5 rounded-full', sc.dot)} /> {sc.label}
              </span>
            </div>
            <p className="line-clamp-3 text-[15px] leading-normal text-foreground/85">{t.body}</p>
            {t.rejection_reason && <p className="text-sm text-red-600 dark:text-red-400">Motivo da Meta: {t.rejection_reason}</p>}
            <div className="flex items-center gap-3 border-t border-border pt-3.5">
              {t.status === 'pendente' && (
                <Button className="h-10 px-5 text-sm" onClick={() => handleSubmitToMeta(t.id)} disabled={submitting === t.id || !connected}>
                  {submitting === t.id && <Loader2 className="h-4 w-4 animate-spin" />} Enviar para a Meta
                </Button>
              )}
              {t.status === 'rejeitado' && <Button variant="secondary" className="h-10 px-5 text-sm" onClick={() => handleDuplicate(t)}>Duplicar e ajustar</Button>}
              <button
                type="button"
                onClick={() => handleDelete(t.id)}
                disabled={deleting === t.id}
                className="ml-auto text-sm text-red-600 hover:underline dark:text-red-400"
              >
                {deleting === t.id ? 'Excluindo…' : 'Excluir'}
              </button>
            </div>
          </li>
        );
      })}
    </ul>
  );

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <h2 className="text-2xl font-semibold leading-8 tracking-tight text-foreground">Templates de mensagem</h2>
        <p className="text-[15px] text-muted-foreground">{connected ? 'Aprovados pela Meta. O status muda sozinho quando ela responde.' : 'Mensagens que a Meta aprova antes do uso.'}</p>
      </div>

      {connected === false && (
        <>
          <section className={cn(CARD, 'flex flex-col gap-4 px-7 py-6 sm:flex-row sm:items-center')}>
            <span className="hidden h-3 w-3 shrink-0 rounded-full bg-muted-foreground/50 sm:block" />
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <h3 className="text-[22px] font-semibold leading-7 tracking-tight text-foreground">Disponível só com a API oficial da Meta</h3>
              <p className="text-[15px] leading-normal text-muted-foreground">Seu WhatsApp hoje está conectado por QR code. Para usar templates, conecte a API oficial.</p>
            </div>
            <Button className="h-12 shrink-0 px-7 text-[15px]" asChild><Link href="/configuracoes/sdr?tab=integracoes">Conectar API oficial</Link></Button>
          </section>

          <section className={cn(CARD, 'flex flex-col gap-5 px-8 py-7')}>
            <h3 className="text-xl font-semibold text-foreground">Para que servem</h3>
            <ol className="flex flex-col rounded-xl border border-border bg-muted">
              {[
                'Falar primeiro com um lead que não escreve há mais de 24 horas. Sem template aprovado, a Meta não deixa enviar.',
                'Enviar botões, listas e carrossel pelo canal oficial. Esses formatos só funcionam com template.',
              ].map((t, i) => (
                <li key={t} className={cn('flex items-center gap-4 px-5 py-4', i > 0 && 'border-t border-border')}>
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-card text-[13px] font-semibold text-foreground">{i + 1}</span>
                  <span className="text-[15px] text-foreground">{t}</span>
                </li>
              ))}
            </ol>
            <h3 className="text-[15px] font-semibold text-foreground">Como funciona</h3>
            <div className="grid gap-3.5 md:grid-cols-3">
              {[
                { t: 'Você cria', d: 'Escreve o texto e escolhe o formato.', c: '', dot: '' },
                { t: 'Pendente', d: 'Você envia para a Meta analisar.', c: 'text-amber-700 dark:text-amber-400', dot: 'bg-amber-500' },
                { t: 'Aprovado', d: 'Pronto para usar nas sequências e nas respostas.', c: 'text-green-700 dark:text-green-400', dot: 'bg-green-500' },
              ].map((s) => (
                <div key={s.t} className="flex flex-col gap-1.5 rounded-xl border border-border bg-muted px-5 py-[18px]">
                  <p className={cn('flex items-center gap-2 text-base font-semibold text-foreground', s.c)}>{s.dot && <span className={cn('h-1.5 w-1.5 rounded-full', s.dot)} />}{s.t}</p>
                  <p className="text-sm leading-normal text-muted-foreground">{s.d}</p>
                </div>
              ))}
            </div>
            <p className="text-sm text-muted-foreground">Se a Meta recusar, o motivo aparece aqui e você pode duplicar e ajustar.</p>
          </section>
          {list}
        </>
      )}

      {connected && (
        <div className="flex flex-col gap-6 xl:flex-row xl:items-start">
          <div className="min-w-0 flex-1">
            {list ?? (!loading && (
              <div className="flex min-h-[320px] flex-col items-center justify-center gap-2 rounded-[14px] border border-dashed border-border px-8 text-center">
                <h3 className="text-lg font-semibold text-foreground">Nenhum template ainda</h3>
                <p className="max-w-[380px] text-[15px] leading-[1.55] text-muted-foreground">Crie o primeiro ao lado e envie para a Meta analisar.</p>
              </div>
            ))}
          </div>

          <form onSubmit={(e) => { e.preventDefault(); void handleAdd(); }} className={cn(CARD, 'flex w-full shrink-0 flex-col gap-5 px-[30px] py-[26px] xl:w-[540px]')}>
            <CardTitle title="Novo template" />
            <div className="flex flex-col gap-2">
              <p className="text-sm font-semibold text-foreground">Formato</p>
              <div className="flex gap-3" role="radiogroup" aria-label="Formato">
                {(['simple', 'buttons', 'carousel'] as const).map((k) => (
                  <button key={k} type="button" role="radio" aria-checked={form.kind === k} onClick={() => setForm((f) => ({ ...f, kind: k }))} className={choice(form.kind === k)}>{KIND_LABELS[k]}</button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-[1fr_120px] gap-3">
              <div className="flex flex-col gap-2">
                <FieldLabel htmlFor="tpl-name">Nome</FieldLabel>
                <input id="tpl-name" className={cn(FIELD, 'font-mono')} placeholder="nome_do_template" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value.toLowerCase().replace(/\s+/g, '_') }))} />
              </div>
              <div className="flex flex-col gap-2">
                <FieldLabel htmlFor="tpl-lang">Idioma</FieldLabel>
                <input id="tpl-lang" className={cn(FIELD, 'font-mono')} placeholder="pt_BR" value={form.language} onChange={(e) => setForm((f) => ({ ...f, language: e.target.value }))} />
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <p className="text-sm font-semibold text-foreground">Categoria</p>
              <div className="flex gap-3" role="radiogroup" aria-label="Categoria">
                {(['marketing', 'utility', 'authentication'] as const).map((c) => (
                  <button key={c} type="button" role="radio" aria-checked={form.category === c} onClick={() => setForm((f) => ({ ...f, category: c }))} className={choice(form.category === c)}>{CAT_LABELS[c]}</button>
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <FieldLabel htmlFor="tpl-body">Mensagem</FieldLabel>
              <textarea id="tpl-body" rows={4} className={cn(FIELD, 'h-auto min-h-[110px] resize-none py-3.5 leading-normal')} placeholder="Olá, temos uma novidade especial para você…" value={form.body} onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))} />
              <p className="text-[13px] leading-normal text-muted-foreground">Para trechos que mudam a cada lead, use as variáveis {'{{1}}'} e {'{{2}}'} entre chaves duplas.</p>
            </div>

            {form.kind === 'simple' && (
              <div className="flex flex-col gap-2">
                <FieldLabel optional>Cabeçalho</FieldLabel>
                <div className="flex gap-3">
                  {(['none', 'image', 'video'] as const).map((h) => (
                    <button key={h} type="button" onClick={() => setForm((f) => ({ ...f, header_type: h }))} className={cn(choice(form.header_type === h), 'h-11 text-sm')}>
                      {h === 'none' ? 'Sem cabeçalho' : h === 'image' ? 'Imagem' : 'Vídeo'}
                    </button>
                  ))}
                </div>
                {form.header_type !== 'none' && <UploadZone label="Mídia do cabeçalho" current={form.header_media_url} onUpload={(url) => setForm((f) => ({ ...f, header_media_url: url }))} />}
              </div>
            )}
            {form.kind === 'buttons' && (
              <div className="flex flex-col gap-2">
                <FieldLabel>Botões (até 3)</FieldLabel>
                <ButtonsBuilder buttons={form.buttons} onChange={(b) => setForm((f) => ({ ...f, buttons: b }))} max={3} />
              </div>
            )}
            {form.kind === 'carousel' && (
              <div className="flex flex-col gap-2">
                <FieldLabel>Cards do carrossel (2 a 10, todos com a mesma estrutura de botões)</FieldLabel>
                <CarouselCardsBuilder cards={form.carousel_cards} onChange={(c) => setForm((f) => ({ ...f, carousel_cards: c }))} />
              </div>
            )}

            <div className="flex items-center gap-3">
              <Button type="submit" className="h-[46px] px-7 text-[15px]" disabled={saving}>{saving && <Loader2 className="h-4 w-4 animate-spin" />} Criar template</Button>
              <Button type="button" variant="secondary" className="h-[46px] px-6 text-[15px]" onClick={() => setForm(EMPTY_FORM)}>Cancelar</Button>
            </div>
          </form>
        </div>
      )}

      {connected === null && <div className="flex h-32 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>}
    </div>
  );
}
