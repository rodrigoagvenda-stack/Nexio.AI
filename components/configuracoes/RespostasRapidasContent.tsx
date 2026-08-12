'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/components/ui/use-toast';
import { Loader2, Plus, Zap, Trash2, Hash } from 'lucide-react';
import { cn } from '@/lib/utils';

interface QuickReply {
  id: string;
  shortcut: string;
  content_type: 'text' | 'media' | 'template';
  content: string;
  media_url: string | null;
  attendant_id: string | null;
  created_at: string;
}

const TYPE_LABELS = { text: 'Texto', media: 'Mídia', template: 'Template' };

export function RespostasRapidasContent() {
  const [replies, setReplies] = useState<QuickReply[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [form, setForm] = useState({
    shortcut: '/',
    content_type: 'text' as 'text' | 'media' | 'template',
    content: '',
    media_url: '',
  });

  useEffect(() => {
    fetch('/api/quick-replies')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.data) setReplies(d.data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleAdd = async () => {
    if (!form.shortcut.startsWith('/') || form.shortcut.length < 2) {
      toast({ title: 'Atalho deve começar com / e ter ao menos um caractere', variant: 'destructive' });
      return;
    }
    if (!form.content.trim()) {
      toast({ title: 'Conteúdo obrigatório', variant: 'destructive' });
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
      setReplies(prev => [...prev, d.data]);
      setForm({ shortcut: '/', content_type: 'text', content: '', media_url: '' });
      setAddOpen(false);
      toast({ title: `Atalho ${d.data.shortcut} criado!` });
    } catch (err: any) {
      toast({ title: err.message || 'Erro ao criar atalho', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, shortcut: string) => {
    setDeleting(id);
    try {
      const res = await fetch(`/api/quick-replies/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      setReplies(prev => prev.filter(r => r.id !== id));
      toast({ title: `Atalho ${shortcut} removido` });
    } catch {
      toast({ title: 'Erro ao remover', variant: 'destructive' });
    } finally {
      setDeleting(null);
    }
  };

  const company = replies.filter(r => !r.attendant_id);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Atalhos de resposta rápida. Digite <code className="bg-muted px-1 rounded text-xs">/atalho</code> no chat para inserir automaticamente.
        </p>
        <Button size="sm" onClick={() => setAddOpen(o => !o)}>
          <Plus className="h-4 w-4 mr-1.5" />
          Novo atalho
        </Button>
      </div>

      {addOpen && (
        <div className="p-5 rounded-2xl border border-primary/30 bg-primary/5 space-y-3">
          <p className="text-sm font-semibold">Novo atalho</p>
          <div className="grid gap-3">
            <div>
              <Label className="text-xs">Atalho (começa com /)</Label>
              <Input
                value={form.shortcut}
                onChange={e => {
                  let v = e.target.value;
                  if (!v.startsWith('/')) v = '/' + v;
                  setForm(f => ({ ...f, shortcut: v.toLowerCase().replace(/\s/g, '_') }));
                }}
                placeholder="/proposta"
                className="h-9 mt-1 text-sm font-mono"
              />
            </div>
            <div>
              <Label className="text-xs">Tipo</Label>
              <div className="flex gap-2 mt-1">
                {(['text', 'media', 'template'] as const).map(t => (
                  <button
                    key={t}
                    onClick={() => setForm(f => ({ ...f, content_type: t }))}
                    className={cn(
                      'flex-1 h-9 rounded-lg border text-xs font-medium transition-colors',
                      form.content_type === t
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border text-muted-foreground hover:border-foreground/30'
                    )}
                  >
                    {TYPE_LABELS[t]}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <Label className="text-xs">Conteúdo</Label>
              <textarea
                value={form.content}
                onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
                placeholder={form.content_type === 'text' ? 'Texto da mensagem...' : form.content_type === 'media' ? 'Legenda da mídia...' : 'Nome do template...'}
                rows={3}
                className="mt-1 w-full bg-muted rounded-lg border border-border text-sm px-3 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-primary/50 text-foreground"
              />
            </div>
            {form.content_type === 'media' && (
              <div>
                <Label className="text-xs">URL da mídia</Label>
                <Input
                  value={form.media_url}
                  onChange={e => setForm(f => ({ ...f, media_url: e.target.value }))}
                  placeholder="https://..."
                  className="h-9 mt-1 text-sm"
                />
              </div>
            )}
          </div>
          <div className="flex gap-2 pt-1">
            <Button variant="ghost" size="sm" onClick={() => setAddOpen(false)} className="text-muted-foreground">Cancelar</Button>
            <Button size="sm" onClick={handleAdd} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Salvar atalho'}
            </Button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-32">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : replies.length === 0 ? (
        <div className="p-8 rounded-2xl border border-dashed border-border flex flex-col items-center gap-3 text-center">
          <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center">
            <Zap className="h-6 w-6 text-muted-foreground" />
          </div>
          <div>
            <p className="font-medium text-sm">Nenhum atalho cadastrado</p>
            <p className="text-xs text-muted-foreground mt-1">Crie atalhos para acelerar o atendimento</p>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {company.length > 0 && (
            <>
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider px-1">Empresa</p>
              {company.map(r => (
                <div key={r.id} className="flex items-start gap-3 p-3 rounded-xl border border-border bg-card">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <Hash className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <code className="text-xs font-mono font-semibold text-primary">{r.shortcut}</code>
                      <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">
                        {TYPE_LABELS[r.content_type]}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{r.content}</p>
                  </div>
                  <button
                    onClick={() => handleDelete(r.id, r.shortcut)}
                    disabled={deleting === r.id}
                    className="text-muted-foreground/50 hover:text-red-400 transition-colors shrink-0"
                  >
                    {deleting === r.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  </button>
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
