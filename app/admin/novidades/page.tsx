'use client';

import { useState, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils/cn';
import {
  Sparkles, Zap, Wrench, Megaphone, Plus, Pencil,
  Trash2, Loader2, Eye, EyeOff, Check, X,
} from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────

type ChangelogType = 'feature' | 'improvement' | 'fix' | 'announcement';

interface ChangelogEntry {
  id: string;
  title: string;
  description: string;
  type: ChangelogType;
  is_published: boolean;
  published_at: string | null;
  created_at: string;
}

// ── Config ────────────────────────────────────────────────────────────────────

const TYPE_CONFIG: Record<ChangelogType, {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  dot: string;
  badge: string;
}> = {
  feature:      { label: 'Novidade',    icon: Sparkles, dot: 'bg-purple-500', badge: 'bg-purple-500/10 border-purple-500/20 text-purple-500' },
  improvement:  { label: 'Melhoria',   icon: Zap,       dot: 'bg-blue-500',   badge: 'bg-blue-500/10 border-blue-500/20 text-blue-500' },
  fix:          { label: 'Correção',   icon: Wrench,     dot: 'bg-orange-500', badge: 'bg-orange-500/10 border-orange-500/20 text-orange-500' },
  announcement: { label: 'Comunicado', icon: Megaphone,  dot: 'bg-green-500',  badge: 'bg-green-500/10 border-green-500/20 text-green-500' },
};

const field = 'w-full rounded-xl border border-border bg-muted/30 px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-all';

// ── EntryForm ─────────────────────────────────────────────────────────────────

function EntryForm({
  initial,
  onSave,
  onCancel,
}: {
  initial?: Partial<ChangelogEntry>;
  onSave: () => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState({
    title: initial?.title ?? '',
    description: initial?.description ?? '',
    type: (initial?.type ?? 'feature') as ChangelogType,
    is_published: initial?.is_published ?? false,
  });
  const [saving, setSaving] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => { titleRef.current?.focus(); }, []);

  async function save() {
    if (!form.title.trim() || !form.description.trim()) return;
    setSaving(true);
    try {
      const url = initial?.id ? `/api/admin/changelog/${initial.id}` : '/api/admin/changelog';
      await fetch(url, {
        method: initial?.id ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      onSave();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-2xl border border-primary/30 bg-card p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">{initial?.id ? 'Editar entrada' : 'Nova entrada'}</h3>
        <button onClick={onCancel} className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-lg hover:bg-muted/50">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground">Título</label>
        <input
          ref={titleRef}
          value={form.title}
          onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
          placeholder="Ex: Novo agente SDR com suporte a calendário"
          className={field}
        />
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground">Descrição</label>
        <textarea
          value={form.description}
          onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
          placeholder="Descreva a atualização para os usuários..."
          rows={4}
          className={cn(field, 'resize-none leading-relaxed')}
        />
      </div>

      <div className="flex gap-4 items-end">
        <div className="space-y-1.5 flex-1">
          <label className="text-xs font-medium text-muted-foreground">Tipo</label>
          <select
            value={form.type}
            onChange={e => setForm(p => ({ ...p, type: e.target.value as ChangelogType }))}
            className={cn(field, 'cursor-pointer')}
          >
            {(Object.keys(TYPE_CONFIG) as ChangelogType[]).map(t => (
              <option key={t} value={t}>{TYPE_CONFIG[t].label}</option>
            ))}
          </select>
        </div>

        <label className="flex items-center gap-2.5 cursor-pointer pb-2.5">
          <div
            onClick={() => setForm(p => ({ ...p, is_published: !p.is_published }))}
            className={cn(
              'w-9 h-5 rounded-full transition-colors relative cursor-pointer',
              form.is_published ? 'bg-primary' : 'bg-muted-foreground/20'
            )}
          >
            <span className={cn(
              'absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform',
              form.is_published && 'translate-x-4'
            )} />
          </div>
          <span className="text-sm text-foreground">Publicar</span>
        </label>
      </div>

      <div className="flex gap-2 justify-end pt-1">
        <button
          onClick={onCancel}
          className="h-9 px-4 text-sm rounded-xl border border-border text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
        >
          Cancelar
        </button>
        <button
          onClick={save}
          disabled={saving || !form.title.trim() || !form.description.trim()}
          className="h-9 px-5 text-sm rounded-xl bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors disabled:opacity-40 flex items-center gap-2"
        >
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
          {saving ? 'Salvando...' : 'Salvar'}
        </button>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AdminNovidadesPage() {
  const [entries, setEntries] = useState<ChangelogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<ChangelogEntry | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [toggling, setToggling] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/changelog');
      const data = await res.json();
      setEntries(data.changelogs ?? []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function togglePublish(entry: ChangelogEntry) {
    setToggling(entry.id);
    await fetch(`/api/admin/changelog/${entry.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_published: !entry.is_published }),
    });
    setToggling(null);
    load();
  }

  async function deleteEntry(id: string) {
    setDeleting(id);
    await fetch(`/api/admin/changelog/${id}`, { method: 'DELETE' });
    setDeleting(null);
    load();
  }

  function onSaved() {
    setShowForm(false);
    setEditing(null);
    load();
  }

  const published = entries.filter(e => e.is_published).length;
  const draft = entries.filter(e => !e.is_published).length;

  return (
    <div className="max-w-3xl mx-auto pb-20 space-y-8">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Novidades</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {published} publicadas · {draft} rascunhos
          </p>
        </div>
        {!showForm && !editing && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 h-9 px-4 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            Nova entrada
          </button>
        )}
      </div>

      {/* Form nova */}
      {showForm && (
        <EntryForm onSave={onSaved} onCancel={() => setShowForm(false)} />
      )}

      {/* Lista */}
      {loading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground/40" />
        </div>
      ) : entries.length === 0 ? (
        <div className="text-center py-24 rounded-2xl border border-dashed border-border">
          <Sparkles className="h-8 w-8 text-muted-foreground/20 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Nenhuma entrada criada ainda.</p>
        </div>
      ) : (
        <div className="rounded-2xl border border-border bg-card overflow-hidden divide-y divide-border/60">
          {entries.map(entry => {
            const cfg = TYPE_CONFIG[entry.type];

            if (editing?.id === entry.id) {
              return (
                <div key={entry.id} className="p-4">
                  <EntryForm
                    initial={entry}
                    onSave={onSaved}
                    onCancel={() => setEditing(null)}
                  />
                </div>
              );
            }

            return (
              <div key={entry.id} className="flex items-start gap-4 px-5 py-4 hover:bg-muted/20 transition-colors group">
                {/* Type dot */}
                <div className="flex-shrink-0 pt-1.5">
                  <div className={cn('w-2 h-2 rounded-full', cfg.dot)} />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className={cn('text-[11px] font-semibold px-2 py-0.5 rounded-md border', cfg.badge)}>
                      {cfg.label}
                    </span>
                    {entry.is_published
                      ? <span className="text-[11px] font-semibold text-green-500">Publicado</span>
                      : <span className="text-[11px] font-semibold text-muted-foreground/60">Rascunho</span>
                    }
                    <span className="text-xs text-muted-foreground ml-auto">
                      {new Date(entry.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </span>
                  </div>
                  <p className="text-sm font-semibold text-foreground leading-snug">{entry.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2 leading-relaxed">{entry.description}</p>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => togglePublish(entry)}
                    title={entry.is_published ? 'Despublicar' : 'Publicar'}
                    disabled={toggling === entry.id}
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors disabled:opacity-50"
                  >
                    {toggling === entry.id
                      ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      : entry.is_published ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </button>
                  <button
                    onClick={() => { setEditing(entry); setShowForm(false); }}
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => deleteEntry(entry.id)}
                    disabled={deleting === entry.id}
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-colors disabled:opacity-50"
                  >
                    {deleting === entry.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
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
