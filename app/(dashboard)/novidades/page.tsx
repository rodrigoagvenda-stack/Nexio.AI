'use client';

import { useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

type ChangelogType = 'feature' | 'improvement' | 'fix' | 'announcement';

interface ChangelogEntry {
  id: string;
  title: string;
  description: string;
  type: ChangelogType;
  published_at: string | null;
  created_at: string;
}

const TYPE_CONFIG: Record<ChangelogType, { label: string; dot: string; badge: string; text: string }> = {
  feature: { label: 'Novidade', dot: 'bg-purple-500', badge: 'bg-purple-500/15 text-purple-700 dark:text-purple-300', text: 'Novidades' },
  improvement: { label: 'Melhoria', dot: 'bg-blue-500', badge: 'bg-blue-500/15 text-blue-700 dark:text-blue-300', text: 'Melhorias' },
  fix: { label: 'Correção', dot: 'bg-orange-500', badge: 'bg-orange-500/15 text-orange-700 dark:text-orange-300', text: 'Correções' },
  announcement: { label: 'Comunicado', dot: 'bg-green-500', badge: 'bg-green-500/15 text-green-700 dark:text-green-300', text: 'Comunicados' },
};

const LAST_SEEN_KEY = 'zaapply_changelog_last_seen';

const dateOf = (e: ChangelogEntry) => e.published_at ?? e.created_at;
const isNew = (e: ChangelogEntry) => Date.now() - new Date(dateOf(e)).getTime() < 7 * 86_400_000;
const dayLabel = (e: ChangelogEntry) => new Date(dateOf(e)).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '');
const monthLabel = (e: ChangelogEntry) => new Date(dateOf(e)).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }).replace(' de ', ' DE ');

function groupByMonth(entries: ChangelogEntry[]) {
  const map = new Map<string, ChangelogEntry[]>();
  for (const e of entries) {
    const key = monthLabel(e);
    map.set(key, [...(map.get(key) ?? []), e]);
  }
  return Array.from(map.entries());
}

/** O texto vem em parágrafos. Um bloco só de itens com "Nome: explicação" vira uma lista de definições. */
function Description({ text }: { text: string }) {
  const blocks = text.split(/\n{2,}/).map((b) => b.trim()).filter(Boolean);
  return (
    <div className="flex max-w-[760px] flex-col gap-3.5">
      {blocks.map((block, i) => {
        const lines = block.split('\n').map((l) => l.trim()).filter(Boolean);
        const isList = lines.length >= 2 && lines.every((l) => /^([•\-*]\s+)/.test(l));
        if (isList) {
          const rows = lines.map((l) => l.replace(/^([•\-*]\s+)/, '')).map((l) => {
            const m = l.match(/^\**([^:*]{2,60})\**\s*[:–—-]\s*(.+)$/);
            return m ? { name: m[1].trim(), text: m[2].trim() } : { name: '', text: l };
          });
          return (
            <ul key={i} className="flex flex-col rounded-xl border border-border bg-card">
              {rows.map((r, k) => (
                <li key={k} className={cn('flex flex-col gap-0.5 px-[18px] py-3.5', k > 0 && 'border-t border-border')}>
                  {r.name && <span className="text-[15px] font-semibold leading-[18px] text-foreground">{r.name}</span>}
                  <span className="text-sm leading-normal text-muted-foreground">{r.text}</span>
                </li>
              ))}
            </ul>
          );
        }
        return <p key={i} className="whitespace-pre-line text-base leading-[1.55] text-foreground/85">{block}</p>;
      })}
    </div>
  );
}

export default function NovidadesPage() {
  const [entries, setEntries] = useState<ChangelogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [filter, setFilter] = useState<ChangelogType | 'todos'>('todos');

  useEffect(() => {
    fetch('/api/changelog')
      .then((r) => { if (!r.ok) throw new Error(); return r.json(); })
      .then((d) => setEntries(d.changelogs ?? []))
      .catch(() => setFailed(true))
      .finally(() => setLoading(false));
    try { localStorage.setItem(LAST_SEEN_KEY, new Date().toISOString()); } catch { /* sem armazenamento */ }
  }, []);

  const counts = useMemo(() => {
    const c: Record<ChangelogType, number> = { feature: 0, improvement: 0, fix: 0, announcement: 0 };
    entries.forEach((e) => { c[e.type] = (c[e.type] ?? 0) + 1; });
    return c;
  }, [entries]);

  const filtered = filter === 'todos' ? entries : entries.filter((e) => e.type === filter);
  const grouped = groupByMonth(filtered);
  const last = entries.length ? new Date(dateOf(entries[0])).toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' }) : null;

  const filterRows: { value: ChangelogType | 'todos'; label: string; n: number; dot?: string }[] = [
    { value: 'todos', label: 'Tudo', n: entries.length },
    ...(Object.keys(TYPE_CONFIG) as ChangelogType[]).map((t) => ({ value: t, label: TYPE_CONFIG[t].text, n: counts[t], dot: TYPE_CONFIG[t].dot })),
  ];

  return (
    <div className="mx-auto flex w-full max-w-[1900px] flex-col gap-6 pb-14 pt-2">
      <div className="flex flex-col gap-1.5">
        <h1 className="text-[26px] font-semibold leading-8 tracking-tight text-foreground">Novidades</h1>
        <p className="text-[15px] text-muted-foreground">Acompanhe as últimas atualizações do Zaapply.</p>
      </div>

      <div className="flex flex-col gap-8 xl:flex-row xl:items-start">
        <aside className="order-first w-full shrink-0 rounded-[14px] border border-border bg-card px-[18px] py-6 xl:order-last xl:w-[340px]">
          <div className="flex flex-col gap-1 px-2 pb-3.5">
            <h2 className="text-lg font-semibold leading-6 text-foreground">Ver por tipo</h2>
            {last && <p className="text-sm text-muted-foreground">Última novidade em {last}.</p>}
          </div>
          <div className="flex flex-col gap-0.5" role="group" aria-label="Filtrar por tipo">
            {filterRows.map((f) => {
              const on = filter === f.value;
              return (
                <button
                  key={f.value}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setFilter(f.value)}
                  className={cn('flex items-center justify-between rounded-[9px] px-3 py-2.5 text-left text-[15px] transition-colors', on ? 'bg-accent font-semibold text-foreground' : f.n === 0 ? 'text-muted-foreground' : 'text-foreground hover:bg-muted')}
                >
                  <span className="flex items-center gap-2.5">{f.dot && <span className={cn('h-1.5 w-1.5 rounded-full', f.dot)} />}{f.label}</span>
                  <span className="text-sm font-normal text-muted-foreground">{f.n}</span>
                </button>
              );
            })}
          </div>
        </aside>

        <div className="min-w-0 flex-1">
          {loading ? (
            <div className="flex items-center justify-center py-24"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : failed ? (
            <p className="py-24 text-center text-sm text-muted-foreground">Não foi possível carregar as novidades agora. Recarregue a página em instantes.</p>
          ) : filtered.length === 0 ? (
            <p className="py-24 text-center text-sm text-muted-foreground">Nenhuma entrada nessa categoria ainda.</p>
          ) : (
            <div className="flex flex-col gap-10">
              {grouped.map(([month, items]) => (
                <section key={month}>
                  <h2 className="border-b border-border pb-3 text-[13px] font-semibold tracking-[0.12em] text-muted-foreground">{month}</h2>
                  {items.map((entry, idx) => {
                    const cfg = TYPE_CONFIG[entry.type];
                    return (
                      <article key={entry.id} className={cn('grid grid-cols-[64px_16px_minmax(0,1fr)] gap-x-4 py-7 sm:grid-cols-[80px_24px_minmax(0,1fr)] sm:gap-x-5', idx < items.length - 1 && 'border-b border-border')}>
                        <time className="pt-1 text-[15px] text-muted-foreground">{dayLabel(entry)}</time>
                        <span className="flex justify-center pt-2.5"><span className={cn('h-2 w-2 rounded-full', cfg.dot)} /></span>
                        <div className="flex min-w-0 flex-col gap-3">
                          <div className="flex items-center gap-2">
                            <span className={cn('rounded-md px-2.5 py-1 text-xs font-semibold', cfg.badge)}>{cfg.label}</span>
                            {isNew(entry) && <span className="rounded-md bg-primary/15 px-2 py-1 text-xs font-bold text-primary">Novo</span>}
                          </div>
                          <h3 className="text-[22px] font-semibold leading-7 tracking-tight text-foreground">{entry.title}</h3>
                          <Description text={entry.description} />
                        </div>
                      </article>
                    );
                  })}
                </section>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
