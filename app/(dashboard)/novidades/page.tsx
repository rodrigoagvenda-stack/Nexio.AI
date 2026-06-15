'use client';

import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils/cn';
import { Loader2 } from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────

type ChangelogType = 'feature' | 'improvement' | 'fix' | 'announcement';

interface ChangelogEntry {
  id: string;
  title: string;
  description: string;
  type: ChangelogType;
  published_at: string | null;
  created_at: string;
}

// ── Config ────────────────────────────────────────────────────────────────────

const TYPE_CONFIG: Record<ChangelogType, { label: string; dot: string; badge: string }> = {
  feature:      { label: 'Novidade',    dot: 'bg-purple-500', badge: 'bg-purple-500/10 border-purple-500/20 text-purple-500' },
  improvement:  { label: 'Melhoria',   dot: 'bg-blue-500',   badge: 'bg-blue-500/10 border-blue-500/20 text-blue-500' },
  fix:          { label: 'Correção',   dot: 'bg-orange-500', badge: 'bg-orange-500/10 border-orange-500/20 text-orange-500' },
  announcement: { label: 'Comunicado', dot: 'bg-green-500',  badge: 'bg-green-500/10 border-green-500/20 text-green-500' },
};

const FILTERS: Array<{ value: ChangelogType | 'todos'; label: string }> = [
  { value: 'todos',        label: 'Tudo' },
  { value: 'feature',      label: 'Novidades' },
  { value: 'improvement',  label: 'Melhorias' },
  { value: 'fix',          label: 'Correções' },
  { value: 'announcement', label: 'Comunicados' },
];

const LAST_SEEN_KEY = 'zaapply_changelog_last_seen';

function entryDate(e: ChangelogEntry): string {
  return e.published_at ?? e.created_at;
}

function isNew(e: ChangelogEntry): boolean {
  return Date.now() - new Date(entryDate(e)).getTime() < 7 * 24 * 60 * 60 * 1000;
}

function formatDay(e: ChangelogEntry) {
  return new Date(entryDate(e)).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}

function formatMonth(e: ChangelogEntry) {
  return new Date(entryDate(e)).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
}

function groupByMonth(entries: ChangelogEntry[]): Map<string, ChangelogEntry[]> {
  const map = new Map<string, ChangelogEntry[]>();
  for (const e of entries) {
    const key = formatMonth(e);
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
    localStorage.setItem(LAST_SEEN_KEY, new Date().toISOString());
  }, []);

  const filtered = filter === 'todos' ? entries : entries.filter(e => e.type === filter);
  const grouped = groupByMonth(filtered);

  return (
    <div className="max-w-2xl mx-auto pb-20">

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight">Novidades</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Acompanhe as últimas atualizações do Zaapply.
        </p>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-0 flex-wrap mb-8 border-b border-border">
        {FILTERS.map(f => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={cn(
              'text-sm px-4 py-2.5 -mb-px font-medium border-b-2 transition-colors',
              filter === f.value
                ? 'border-foreground text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Feed */}
      {loading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground/40" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-24">
          <p className="text-sm text-muted-foreground">Nenhuma entrada nessa categoria ainda.</p>
        </div>
      ) : (
        <div className="space-y-12">
          {Array.from(grouped.entries()).map(([month, items]) => (
            <div key={month}>
              <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-6 capitalize">
                {month}
              </h2>

              <div className="space-y-0">
                {items.map((entry, idx) => {
                  const cfg = TYPE_CONFIG[entry.type];
                  const _new = isNew(entry);

                  return (
                    <div
                      key={entry.id}
                      className={cn(
                        'flex gap-5 py-6',
                        idx < items.length - 1 && 'border-b border-border/50'
                      )}
                    >
                      {/* Dot */}
                      <div className="flex-shrink-0 pt-1">
                        <div className={cn('w-2 h-2 rounded-full', cfg.dot)} />
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-2.5">
                          <span className={cn('text-[11px] font-semibold px-2 py-0.5 rounded-md border', cfg.badge)}>
                            {cfg.label}
                          </span>
                          {_new && (
                            <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-primary/10 border border-primary/20 text-primary">
                              Novo
                            </span>
                          )}
                          <span className="text-xs text-muted-foreground ml-auto">
                            {formatDay(entry)}
                          </span>
                        </div>
                        <h3 className="text-sm font-semibold text-foreground mb-1.5 leading-snug">
                          {entry.title}
                        </h3>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                          {entry.description}
                        </p>
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
