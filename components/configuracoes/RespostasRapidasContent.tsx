'use client';

import { useState, useEffect } from 'react';
import { Loader2, Trash2, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';
import { CARD, CardTitle, FIELD, FieldLabel } from './cfg-ui';

interface QuickReply {
  id: string;
  shortcut: string;
  content_type: 'text' | 'media' | 'template';
  content: string;
  media_url: string | null;
  attendant_id: string | null;
  created_at: string;
}

const TYPE_LABELS = { text: 'Texto', media: 'Mídia', template: 'Template' } as const;
const EMPTY_FORM = { shortcut: '/', content_type: 'text' as QuickReply['content_type'], content: '', media_url: '' };

export function RespostasRapidasContent() {
  const [replies, setReplies] = useState<QuickReply[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);

  useEffect(() => {
    fetch('/api/quick-replies')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d?.data) setReplies(d.data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function handleAdd() {
    if (!form.shortcut.startsWith('/') || form.shortcut.length < 2) {
      toast({ variant: 'destructive', title: 'Atalho inválido', description: 'Comece com a barra e escreva pelo menos uma letra.' });
      return;
    }
    if (!form.content.trim()) {
      toast({ variant: 'destructive', title: 'Escreva a mensagem', description: 'O atalho precisa de um texto para enviar.' });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/quick-replies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, media_url: form.media_url || null }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      setReplies((prev) => [...prev, d.data].sort((a, b) => a.shortcut.localeCompare(b.shortcut)));
      setForm(EMPTY_FORM);
      toast({ variant: 'success', title: `Atalho ${d.data.shortcut} criado` });
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Não foi possível criar o atalho', description: err?.message });
    } finally { setSaving(false); }
  }

  async function handleDelete(id: string, shortcut: string) {
    setDeleting(id);
    try {
      const res = await fetch(`/api/quick-replies/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      setReplies((prev) => prev.filter((r) => r.id !== id));
      toast({ title: `Atalho ${shortcut} removido` });
    } catch {
      toast({ variant: 'destructive', title: 'Não foi possível remover o atalho' });
    } finally { setDeleting(null); }
  }

  const list = replies.filter((r) => !r.attendant_id);

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <h2 className="text-2xl font-semibold leading-8 tracking-tight text-foreground">Respostas rápidas</h2>
        <p className="text-[15px] text-muted-foreground">Mensagens prontas para o time. No chat do Atendimento, digite a barra e o nome do atalho, por exemplo /proposta, e o texto entra sozinho.</p>
      </div>

      <div className="flex flex-col gap-6 xl:flex-row xl:items-start">
        <div className="min-w-0 flex-1">
          {loading ? (
            <div className="flex h-40 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : list.length === 0 ? (
            <div className="flex min-h-[420px] flex-col items-center justify-center gap-3 rounded-[14px] border border-dashed border-border px-8 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-border bg-card"><Zap className="h-6 w-6 text-muted-foreground" strokeWidth={1.8} /></div>
              <h3 className="text-lg font-semibold text-foreground">Nenhum atalho ainda</h3>
              <p className="max-w-[380px] text-[15px] leading-[1.55] text-muted-foreground">Crie atalhos para as respostas que você repete todo dia, como preço, endereço e horário. O time responde mais rápido.</p>
            </div>
          ) : (
            <ul className="flex flex-col gap-2.5">
              {list.map((r) => (
                <li key={r.id} className={cn(CARD, 'flex items-start gap-3 px-5 py-4')}>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2.5">
                      <code className="font-mono text-[15px] font-semibold text-[#01573C] dark:text-[#96F63C]">{r.shortcut}</code>
                      <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs text-muted-foreground">{TYPE_LABELS[r.content_type]}</span>
                    </div>
                    <p className="mt-1 line-clamp-2 text-sm leading-normal text-muted-foreground">{r.content}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDelete(r.id, r.shortcut)}
                    disabled={deleting === r.id}
                    aria-label={`Remover ${r.shortcut}`}
                    className="shrink-0 rounded-lg p-2 text-muted-foreground transition-colors hover:bg-red-500/10 hover:text-red-500"
                  >
                    {deleting === r.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <form
          onSubmit={(e) => { e.preventDefault(); void handleAdd(); }}
          className={cn(CARD, 'flex w-full shrink-0 flex-col gap-5 px-[30px] py-[26px] xl:w-[560px]')}
        >
          <CardTitle title="Novo atalho" />
          <div className="flex flex-col gap-2">
            <FieldLabel htmlFor="qr-shortcut">Atalho</FieldLabel>
            <input
              id="qr-shortcut"
              className={FIELD}
              placeholder="/proposta"
              value={form.shortcut}
              onChange={(e) => {
                let v = e.target.value;
                if (!v.startsWith('/')) v = `/${v}`;
                setForm((f) => ({ ...f, shortcut: v.toLowerCase().replace(/\s/g, '_') }));
              }}
            />
            <p className="text-[13px] text-muted-foreground">Começa com a barra, sem espaços.</p>
          </div>
          <div className="flex flex-col gap-2">
            <p className="text-sm font-semibold text-foreground">O que envia</p>
            <div className="flex gap-3" role="radiogroup" aria-label="O que o atalho envia">
              {(['text', 'media', 'template'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  role="radio"
                  aria-checked={form.content_type === t}
                  onClick={() => setForm((f) => ({ ...f, content_type: t }))}
                  className={cn('h-12 flex-1 rounded-xl border text-[14.5px] transition-colors', form.content_type === t ? 'border-[#1E6B47] bg-accent font-semibold text-foreground' : 'border-border bg-muted text-muted-foreground hover:text-foreground')}
                >
                  {TYPE_LABELS[t]}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <FieldLabel htmlFor="qr-content">Mensagem</FieldLabel>
            <textarea
              id="qr-content"
              rows={4}
              className={cn(FIELD, 'h-auto min-h-[120px] resize-none py-3.5 leading-normal')}
              placeholder={form.content_type === 'text' ? 'Texto da mensagem…' : form.content_type === 'media' ? 'Legenda da mídia…' : 'Nome do template…'}
              value={form.content}
              onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
            />
          </div>
          {form.content_type === 'media' && (
            <div className="flex flex-col gap-2">
              <FieldLabel htmlFor="qr-media">Endereço da mídia</FieldLabel>
              <input id="qr-media" className={FIELD} placeholder="https://…" value={form.media_url} onChange={(e) => setForm((f) => ({ ...f, media_url: e.target.value }))} />
            </div>
          )}
          <div className="flex items-center gap-3">
            <Button type="submit" className="h-[46px] px-7 text-[15px]" disabled={saving || form.shortcut.length < 2 || !form.content.trim()}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />} Salvar atalho
            </Button>
            <Button type="button" variant="secondary" className="h-[46px] px-6 text-[15px]" onClick={() => setForm(EMPTY_FORM)}>Cancelar</Button>
          </div>
        </form>
      </div>
    </div>
  );
}
