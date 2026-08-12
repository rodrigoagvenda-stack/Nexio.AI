'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/components/ui/use-toast';
import { Loader2, Plus, FileText, CheckCircle2, XCircle, Clock, Copy, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';

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

export function TemplatesHSMContent() {
  const [templates, setTemplates] = useState<HSMTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: '',
    category: 'marketing' as HSMTemplate['category'],
    language: 'pt_BR',
    body: '',
  });

  useEffect(() => {
    fetch('/api/hsm-templates')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.data) setTemplates(d.data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleAdd = async () => {
    if (!form.name.trim() || !form.body.trim()) {
      toast({ title: 'Nome e corpo são obrigatórios', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/hsm-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      setTemplates(prev => [d.data, ...prev]);
      setForm({ name: '', category: 'marketing', language: 'pt_BR', body: '' });
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
    setForm({ name: `${t.name} (cópia)`, category: t.category, language: t.language, body: t.body });
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
        <p className="text-sm text-muted-foreground">Templates HSM aprovados pelo Meta — único meio de enviar mensagem ativa fora da janela de 24h/72h.</p>
        <Button size="sm" onClick={() => setAddOpen(o => !o)}>
          <Plus className="h-4 w-4 mr-1.5" />
          Novo template
        </Button>
      </div>

      {addOpen && (
        <div className="p-5 rounded-2xl border border-primary/30 bg-primary/5 space-y-3">
          <p className="text-sm font-semibold">Novo template HSM</p>
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
          </div>
          <div className="flex gap-2 pt-1">
            <Button variant="ghost" size="sm" onClick={() => setAddOpen(false)} className="text-muted-foreground">Cancelar</Button>
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
