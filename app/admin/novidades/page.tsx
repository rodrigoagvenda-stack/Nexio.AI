'use client';

import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils/cn';
import {
  Sparkles, Zap, Wrench, Megaphone, Plus, Pencil,
  Trash2, Loader2, Eye, EyeOff, CheckCircle2,
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
  color: string;
  bg: string;
}> = {
  feature:      { label: 'Novidade',    icon: Sparkles,  color: 'text-purple-500', bg: 'bg-purple-500/10 border-purple-500/20' },
  improvement:  { label: 'Melhoria',   icon: Zap,        color: 'text-blue-500',   bg: 'bg-blue-500/10 border-blue-500/20' },
  fix:          { label: 'Correção',   icon: Wrench,      color: 'text-orange-500', bg: 'bg-orange-500/10 border-orange-500/20' },
  announcement: { label: 'Comunicado', icon: Megaphone,  color: 'text-green-500',  bg: 'bg-green-500/10 border-green-500/20' },
};

const inputCls = 'w-full h-9 rounded-lg border border-border bg-muted/40 px-3 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-primary/30 transition-colors';

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
    <div className="rounded-xl border border-primary/30 bg-card p-5 space-y-4">
      <h3 className="text-sm font-semibold">{initial?.id ? 'Editar entrada' : 'Nova entrada'}</h3>

      <div className="space-y-1.5">
        <label className="text-xs font-medium text-foreground">Título *</label>
        <input
          value={form.title}
          onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
          placeholder="Ex: Novo agente SDR com suporte a calendário"
          className={inputCls}
        />
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-medium text-foreground">Descrição *</label>
        <textarea
          value={form.description}
          onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
          placeholder="Descreva a atualização para os usuários..."
          rows={4}
          className={cn(inputCls, 'h-auto resize-none py-2.5')}
        />
      </div>

      <div className="flex gap-3 flex-wrap">
        <div className="space-y-1.5 flex-1 min-w-[140px]">
          <label className="text-xs font-medium text-foreground">Tipo</label>
          <select
            value={form.type}
            onChange={e => setForm(p => ({ ...p, type: e.target.value as ChangelogType }))}
            className={cn(inputCls, 'cursor-pointer')}
          >
            {(Object.keys(TYPE_CONFIG) as ChangelogType[]).map(t => (
              <option key={t} value={t}>{TYPE_CONFIG[t].label}</option>
            ))}
          </select>
        </div>

        <div className="flex items-end pb-0.5">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.is_published}
              onChange={e => setForm(p => ({ ...p, is_published: e.target.checked }))}
              className="w-4 h-4 rounded accent-primary"
            />
            <span className="text-xs font-medium text-foreground">Publicar agora</span>
          </label>
        </div>
      </div>

      <div className="flex gap-2 justify-end">
        <button onClick={onCancel} className="h-8 px-4 text-xs rounded-lg border border-border text-muted-foreground hover:text-foreground transition-colors">
          Cancelar
        </button>
        <button
          onClick={save}
          disabled={saving || !form.title.trim() || !form.description.trim()}
          className="h-8 px-4 text-xs rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-1.5"
        >
          {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}
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
    await fetch(`/api/admin/changelog/${entry.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_published: !entry.is_published }),
    });
    load();
  }

  async function deleteEntry(id: string) {
    setDeleting(id);
    try {
      await fetch(`/api/admin/changelog/${id}`, { method: 'DELETE' });
      load();
    } finally {
      setDeleting(null);
    }
  }

  function onSaved() {
    setShowForm(false);
    setEditing(null);
    load();
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Sparkles className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Novidades</h1>
            <p className="text-xs text-muted-foreground">{entries.length} entrada{entries.length !== 1 && 's'}</p>
          </div>
        </div>
        {!showForm && !editing && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 h-8 px-4 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors"
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
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : entries.length === 0 ? (
        <div className="text-center py-20 rounded-2xl border border-dashed border-border">
          <Sparkles className="h-8 w-8 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Nenhuma entrada criada ainda.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {entries.map(entry => {
            const cfg = TYPE_CONFIG[entry.type];
            const Icon = cfg.icon;
            if (editing?.id === entry.id) {
              return (
                <EntryForm
                  key={entry.id}
                  initial={entry}
                  onSave={onSaved}
                  onCancel={() => setEditing(null)}
                />
              );
            }
            return (
              <div key={entry.id} className="rounded-xl border border-border bg-card p-4 flex items-start gap-4">
                <div className={cn('w-9 h-9 rounded-xl border flex items-center justify-center flex-shrink-0', cfg.bg)}>
                  <Icon className={cn('h-4 w-4', cfg.color)} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className={cn('text-[11px] font-semibold px-2 py-0.5 rounded-full border', cfg.bg, cfg.color)}>
                      {cfg.label}
                    </span>
                    {entry.is_published
                      ? <span className="text-[11px] font-semibold text-green-500">● Publicado</span>
                      : <span className="text-[11px] font-semibold text-muted-foreground">● Rascunho</span>
                    }
                    <span className="text-xs text-muted-foreground ml-auto">
                      {new Date(entry.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </span>
                  </div>
                  <p className="text-sm font-semibold text-foreground">{entry.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2 leading-relaxed">{entry.description}</p>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={() => togglePublish(entry)}
                    title={entry.is_published ? 'Despublicar' : 'Publicar'}
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                  >
                    {entry.is_published ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </button>
                  <button
                    onClick={() => setEditing(entry)}
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => deleteEntry(entry.id)}
                    disabled={deleting === entry.id}
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-colors disabled:opacity-50"
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
