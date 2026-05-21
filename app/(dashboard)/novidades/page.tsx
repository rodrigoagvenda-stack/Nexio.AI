'use client';

import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils/cn';
import { Sparkles, Zap, Wrench, Megaphone, Loader2 } from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────

type ChangelogType = 'feature' | 'improvement' | 'fix' | 'announcement';

interface ChangelogEntry {
  id: string;
  title: string;
  description: string;
  type: ChangelogType;
  published_at: string;
}

// ── Config ────────────────────────────────────────────────────────────────────

const TYPE_CONFIG: Record<ChangelogType, {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  bg: string;
}> = {
  feature:      { label: 'Novidade',    icon: Sparkles,   color: 'text-purple-500',  bg: 'bg-purple-500/10 border-purple-500/20' },
  improvement:  { label: 'Melhoria',   icon: Zap,         color: 'text-blue-500',    bg: 'bg-blue-500/10 border-blue-500/20' },
  fix:          { label: 'Correção',   icon: Wrench,       color: 'text-orange-500',  bg: 'bg-orange-500/10 border-orange-500/20' },
  announcement: { label: 'Comunicado', icon: Megaphone,   color: 'text-green-500',   bg: 'bg-green-500/10 border-green-500/20' },
};

const FILTERS: Array<{ value: ChangelogType | 'todos'; label: string }> = [
  { value: 'todos', label: 'Tudo' },
  { value: 'feature', label: 'Novidades' },
  { value: 'improvement', label: 'Melhorias' },
  { value: 'fix', label: 'Correções' },
  { value: 'announcement', label: 'Comunicados' },
];

const LAST_SEEN_KEY = 'zaapply_changelog_last_seen';

function isNew(publishedAt: string): boolean {
  const diff = Date.now() - new Date(publishedAt).getTime();
  return diff < 7 * 24 * 60 * 60 * 1000;
}

function formatMonth(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
}

function groupByMonth(entries: ChangelogEntry[]): Map<string, ChangelogEntry[]> {
  const map = new Map<string, ChangelogEntry[]>();
  for (const e of entries) {
    const key = formatMonth(e.published_at);
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(e);
  }
  return map;
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function NovidadesPage() {
  const [entries, setEntries] = useState<ChangelogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<ChangelogType | 'todos'>('todos');

  useEffect(() => {
    fetch('/api/changelog')
      .then(r => r.json())
      .then(d => setEntries(d.changelogs ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));

    // Mark as seen
    localStorage.setItem(LAST_SEEN_KEY, new Date().toISOString());
  }, []);

  const filtered = filter === 'todos' ? entries : entries.filter(e => e.type === filter);
  const grouped = groupByMonth(filtered);

  return (
    <div className="max-w-2xl mx-auto space-y-8 pb-16">

      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-1">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Sparkles className="h-4 w-4 text-primary" />
          </div>
          <h1 className="text-2xl font-bold">Novidades</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Acompanhe as últimas atualizações, melhorias e correções do Zaapply.
        </p>
      </div>

      {/* Filtros */}
      <div className="flex gap-1.5 flex-wrap">
        {FILTERS.map(f => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value as ChangelogType | 'todos')}
            className={cn(
              'text-xs px-3 py-1.5 rounded-full border transition-all',
              filter === f.value
                ? 'bg-primary text-primary-foreground border-primary'
                : 'border-border text-muted-foreground hover:text-foreground hover:border-border/80'
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Feed */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground text-sm">
          Nenhuma entrada nessa categoria ainda.
        </div>
      ) : (
        <div className="space-y-10">
          {Array.from(grouped.entries()).map(([month, items]) => (
            <div key={month}>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-4 capitalize">
                {month}
              </p>
              <div className="space-y-4">
                {items.map(entry => {
                  const cfg = TYPE_CONFIG[entry.type];
                  const Icon = cfg.icon;
                  const _new = isNew(entry.published_at);
                  return (
                    <div
                      key={entry.id}
                      className="group relative rounded-2xl border border-border bg-card p-5 hover:border-border/80 transition-all"
                    >
                      <div className="flex items-start gap-4">
                        <div className={cn('w-9 h-9 rounded-xl border flex items-center justify-center flex-shrink-0', cfg.bg)}>
                          <Icon className={cn('h-4 w-4', cfg.color)} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1.5">
                            <span className={cn('text-[11px] font-semibold px-2 py-0.5 rounded-full border', cfg.bg, cfg.color)}>
                              {cfg.label}
                            </span>
                            {_new && (
                              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-primary/15 text-primary border border-primary/20">
                                Novo
                              </span>
                            )}
                            <span className="text-xs text-muted-foreground ml-auto">
                              {new Date(entry.published_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                            </span>
                          </div>
                          <h3 className="text-sm font-semibold text-foreground mb-1">{entry.title}</h3>
                          <p className="text-sm text-muted-foreground leading-relaxed">{entry.description}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
