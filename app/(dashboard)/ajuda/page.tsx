'use client';

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowRight, ChevronRight, Search, X } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { Button } from '@/components/ui/button';
import { sections } from '@/lib/ajuda/content';
import { DocText } from '@/components/ajuda/DocText';
import { TicketsPanel } from '@/components/ajuda/TicketsPanel';
import { ZaiaChat } from '@/components/ajuda/ZaiaChat';
import { SupportTicket, getSeenTickets, hasUnreadReply } from '@/components/ajuda/tickets-shared';

type Tab = 'docs' | 'chamados';

const CARD = 'rounded-[14px] border border-border bg-card';
const LIME = 'text-[#01573C] dark:text-[#96F63C]';

const slug = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// ── Busca ─────────────────────────────────────────────────────────────────────

interface SearchHit { sectionId: string; sectionTitle: string; itemIndex: number; question: string; snippet: string }

function searchDocs(query: string): SearchHit[] {
  const q = query.toLowerCase();
  const hits: SearchHit[] = [];
  for (const section of sections) {
    section.items.forEach((item, itemIndex) => {
      if (!item.question.toLowerCase().includes(q) && !item.answer.toLowerCase().includes(q)) return;
      const clean = item.answer.replace(/\[\/?(TIP|AVISO|INFO|ADMIN)\]/g, '').replace(/#{1,3}\s/g, '').replace(/\*\*/g, '').replace(/`/g, '');
      const idx = clean.toLowerCase().indexOf(q);
      const start = Math.max(0, idx - 30);
      const snippet = (start > 0 ? '…' : '') + clean.slice(start, start + 110).trim() + (clean.length > start + 110 ? '…' : '');
      hits.push({ sectionId: section.id, sectionTitle: section.title, itemIndex, question: item.question, snippet });
    });
  }
  return hits.slice(0, 12);
}

function SearchResults({ query, onOpen }: { query: string; onOpen: (hit: SearchHit) => void }) {
  const hits = useMemo(() => searchDocs(query), [query]);
  if (hits.length === 0) {
    return (
      <div className={cn(CARD, 'flex flex-col items-center gap-1 px-6 py-14 text-center')}>
        <p className="text-base font-medium text-foreground">Nada encontrado para “{query}”</p>
        <p className="text-sm text-muted-foreground">Tente outras palavras ou pergunte para a Zaia.</p>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-2">
      <p className="mb-1 text-sm text-muted-foreground">{hits.length} {hits.length === 1 ? 'resultado' : 'resultados'} para “{query}”</p>
      {hits.map((h, i) => (
        <button
          key={i}
          type="button"
          onClick={() => onOpen(h)}
          className={cn(CARD, 'group flex items-start gap-3 px-5 py-4 text-left transition-colors hover:border-primary/40 hover:bg-accent/50')}
        >
          <div className="min-w-0 flex-1">
            <p className={cn('text-xs font-semibold uppercase tracking-[0.06em]', LIME)}>{h.sectionTitle}</p>
            <p className="mt-0.5 truncate text-[15px] font-medium text-foreground">{h.question}</p>
            <p className="mt-0.5 line-clamp-2 text-sm leading-normal text-muted-foreground">{h.snippet}</p>
          </div>
          <ArrowRight className="mt-1.5 h-4 w-4 shrink-0 text-muted-foreground/60 transition-colors group-hover:text-foreground" />
        </button>
      ))}
    </div>
  );
}

// ── Página ────────────────────────────────────────────────────────────────────

function AjudaContent() {
  const router = useRouter();
  const params = useSearchParams();
  const tab: Tab = params.get('tab') === 'chamados' ? 'chamados' : 'docs';

  const [activeId, setActiveId] = useState(() => {
    const wanted = params.get('section');
    return sections.some((s) => s.id === wanted) ? (wanted as string) : sections[0].id;
  });
  const [activeItem, setActiveItem] = useState(0);
  const [query, setQuery] = useState('');
  const [chatOpen, setChatOpen] = useState(false);
  const [startNew, setStartNew] = useState(false);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [ticketsLoading, setTicketsLoading] = useState(true);
  const [unread, setUnread] = useState(0);

  const searchRef = useRef<HTMLInputElement>(null);
  const pendingItem = useRef<number | null>(null);

  const section = sections.find((s) => s.id === activeId) ?? sections[0];
  const sectionIdx = sections.findIndex((s) => s.id === section.id);
  const searching = query.trim().length >= 2;

  const setTab = useCallback((next: Tab, extra?: Record<string, string>) => {
    const sp = new URLSearchParams();
    if (next === 'chamados') sp.set('tab', 'chamados');
    Object.entries(extra ?? {}).forEach(([k, v]) => sp.set(k, v));
    const qs = sp.toString();
    router.replace(qs ? `/ajuda?${qs}` : '/ajuda', { scroll: false });
  }, [router]);

  const loadTickets = useCallback(() => {
    fetch('/api/support/tickets')
      .then((r) => r.json())
      .then((d) => {
        const list: SupportTicket[] = d.tickets ?? [];
        setTickets(list);
        const seen = getSeenTickets();
        setUnread(list.filter((t) => hasUnreadReply(t, seen)).length);
      })
      .catch(() => { /* sem lista: a aba mostra o estado vazio */ })
      .finally(() => setTicketsLoading(false));
  }, []);

  useEffect(() => { loadTickets(); }, [loadTickets, tab]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k' && tab === 'docs') {
        e.preventDefault();
        searchRef.current?.focus();
      }
      if (e.key === 'Escape' && query) setQuery('');
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [query, tab]);

  // Vai até a pergunta pedida depois que a seção troca
  useEffect(() => {
    if (pendingItem.current == null) return;
    const idx = pendingItem.current;
    pendingItem.current = null;
    requestAnimationFrame(() => document.getElementById(`item-${idx}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }, [activeId, tab, searching]);

  // Marca no índice da direita qual pergunta está na tela
  useEffect(() => {
    if (tab !== 'docs' || searching) return;
    const els = section.items.map((_, i) => document.getElementById(`item-${i}`)).filter(Boolean) as HTMLElement[];
    if (els.length === 0) return;
    const obs = new IntersectionObserver((entries) => {
      const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
      if (visible[0]) setActiveItem(Number(visible[0].target.id.replace('item-', '')));
    }, { rootMargin: '-10% 0px -70% 0px' });
    els.forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, [section, tab, searching]);

  function goToSection(id: string, itemIndex?: number) {
    setActiveId(id);
    setActiveItem(itemIndex ?? 0);
    setQuery('');
    pendingItem.current = itemIndex ?? null;
    if (tab !== 'docs') setTab('docs');
    if (itemIndex == null) document.getElementById('main-scroll')?.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function openDocByQuestion(question: string) {
    for (const s of sections) {
      const idx = s.items.findIndex((it) => it.question === question);
      if (idx >= 0) { goToSection(s.id, idx); return; }
    }
    setTab('docs');
  }

  const openNewTicket = () => { setStartNew(true); setTab('chamados'); };

  const prev = sectionIdx > 0 ? sections[sectionIdx - 1] : null;
  const next = sectionIdx < sections.length - 1 ? sections[sectionIdx + 1] : null;

  return (
    <div className="mx-auto flex w-full max-w-[1900px] flex-col gap-[22px] pb-14 pt-2">
      <div className="flex flex-wrap items-center justify-between gap-6">
        <div className="flex flex-col gap-1.5">
          <h1 className="text-[26px] font-semibold leading-8 tracking-tight text-foreground">Ajuda</h1>
          <p className="text-[15px] text-muted-foreground">Encontre a resposta, pergunte para a Zaia ou abra um chamado.</p>
        </div>
        <Button className="h-[46px] px-[26px] text-[15px]" onClick={() => setChatOpen(true)}>Perguntar para a Zaia</Button>
      </div>

      <div role="tablist" aria-label="Ajuda" className="flex w-fit items-center rounded-full bg-muted p-1">
        {([['docs', 'Documentação'], ['chamados', 'Chamados']] as const).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => { if (id !== tab) { setStartNew(false); setTab(id); } }}
            className={cn(
              'flex items-center gap-2 rounded-full px-5 py-2 text-sm transition-colors',
              tab === id ? 'bg-[#0F3D2B] font-semibold text-white' : 'font-medium text-muted-foreground hover:text-foreground',
            )}
          >
            {label}
            {id === 'chamados' && unread > 0 && <span className="h-2 w-2 rounded-full bg-[#96F63C]" aria-label={`${unread} resposta nova`} />}
          </button>
        ))}
      </div>

      {tab === 'chamados' ? (
        <TicketsPanel
          key={startNew ? 'new' : 'list'}
          tickets={tickets}
          loading={ticketsLoading}
          reload={loadTickets}
          onOpenDoc={openDocByQuestion}
          startInNew={startNew}
          initialTicketId={params.get('ticket')}
        />
      ) : (
        <>
          <div className="flex h-[54px] shrink-0 items-center justify-between gap-3 rounded-[14px] border border-border bg-muted px-5">
            <label className="flex flex-1 items-center gap-3">
              <Search className="h-[18px] w-[18px] shrink-0 text-muted-foreground" strokeWidth={2} />
              <input
                ref={searchRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Pesquisar na documentação"
                aria-label="Pesquisar na documentação"
                className="w-full bg-transparent text-[15px] text-foreground outline-none placeholder:text-muted-foreground"
              />
            </label>
            {query ? (
              <button type="button" onClick={() => setQuery('')} aria-label="Limpar busca" className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
            ) : (
              <kbd className="hidden rounded-md border border-border bg-card px-2.5 py-1 text-xs text-muted-foreground sm:block">Ctrl K</kbd>
            )}
          </div>

          <div className="flex flex-col items-stretch gap-8 xl:flex-row xl:items-start">
            {/* Assuntos */}
            <nav aria-label="Assuntos" className={cn(CARD, 'hidden w-[300px] shrink-0 flex-col gap-0.5 px-3.5 py-[18px] xl:flex')}>
              <p className="px-2.5 pb-2.5 text-[13px] font-semibold tracking-[0.06em] text-muted-foreground">ASSUNTOS</p>
              {sections.map((s) => {
                const on = s.id === section.id && !searching;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => goToSection(s.id)}
                    aria-current={on ? 'page' : undefined}
                    className={cn('flex items-center justify-between rounded-[9px] px-3 py-[11px] text-left text-[14.5px] transition-colors', on ? 'bg-accent font-semibold text-foreground' : 'text-foreground hover:bg-muted')}
                  >
                    {s.title}
                    <span className={cn('text-[13px]', on ? 'text-foreground/70' : 'text-muted-foreground/80')}>{s.items.length}</span>
                  </button>
                );
              })}
            </nav>
            <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 xl:hidden">
              {sections.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => goToSection(s.id)}
                  className={cn('shrink-0 rounded-full border px-3.5 py-1.5 text-sm transition-colors', s.id === section.id && !searching ? 'border-transparent bg-accent font-semibold text-foreground' : 'border-border text-muted-foreground hover:text-foreground')}
                >
                  {s.title}
                </button>
              ))}
            </div>

            {/* Artigo */}
            <div className="min-w-0 flex-1 xl:px-2 xl:pt-2">
              {searching ? (
                <SearchResults query={query.trim()} onOpen={(h) => goToSection(h.sectionId, h.itemIndex)} />
              ) : (
                <article className="flex flex-col gap-[30px]">
                  <header className="flex flex-col gap-3.5">
                    <nav aria-label="Trilha" className="flex items-center gap-2 text-[13.5px]">
                      <button type="button" onClick={() => goToSection(sections[0].id)} className="text-muted-foreground hover:text-foreground">Ajuda</button>
                      <ChevronRight className="h-3 w-3 text-muted-foreground/60" strokeWidth={2.6} />
                      <span className="text-foreground/90">{section.title}</span>
                    </nav>
                    <h2 className="text-[34px] font-semibold leading-[42px] tracking-tight text-foreground">{section.title}</h2>
                    <p className="text-base leading-5 text-muted-foreground">{section.description}</p>
                  </header>

                  {section.items.map((item, i) => (
                    <section key={`${section.id}-${i}`} id={`item-${i}`} className="flex scroll-mt-24 flex-col gap-5 border-t border-border pt-[26px]">
                      <h3 className="text-[22px] font-semibold leading-7 tracking-tight text-foreground">{item.question}</h3>
                      <DocText text={item.answer} />
                    </section>
                  ))}

                  <footer className="flex items-center justify-between gap-4 border-t border-border pt-[26px]">
                    {prev ? (
                      <button type="button" onClick={() => goToSection(prev.id)} className="group flex flex-col items-start gap-[3px] text-left">
                        <span className="text-xs tracking-[0.06em] text-muted-foreground">ANTERIOR</span>
                        <span className="text-[15px] text-foreground group-hover:underline">{prev.title}</span>
                      </button>
                    ) : <span />}
                    {next ? (
                      <button type="button" onClick={() => goToSection(next.id)} className="group flex flex-col items-end gap-[3px] text-right">
                        <span className="text-xs tracking-[0.06em] text-muted-foreground">PRÓXIMO</span>
                        <span className="text-[15px] text-foreground group-hover:underline">{next.title}</span>
                      </button>
                    ) : <span />}
                  </footer>
                </article>
              )}
            </div>

            {/* Lateral direita */}
            <aside className="flex w-full shrink-0 flex-col gap-5 xl:w-[340px]">
              {!searching && (
                <nav aria-label="Nesta seção" className={cn(CARD, 'flex flex-col gap-1.5 px-[18px] py-5')}>
                  <p className="px-2 pb-2 text-[13px] font-semibold tracking-[0.06em] text-muted-foreground">NESTA SEÇÃO</p>
                  {section.items.map((item, i) => (
                    <button
                      key={`${section.id}-${slug(item.question)}-${i}`}
                      type="button"
                      onClick={() => { setActiveItem(i); document.getElementById(`item-${i}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}
                      className={cn('rounded-[9px] px-3 py-2.5 text-left text-[14.5px] leading-[18px] transition-colors', i === activeItem ? 'bg-accent font-semibold text-foreground' : 'text-foreground/85 hover:bg-muted')}
                    >
                      {item.question}
                    </button>
                  ))}
                </nav>
              )}
              <div className={cn(CARD, 'flex flex-col gap-3.5 p-[22px]')}>
                <div className="flex flex-col gap-[5px]">
                  <h3 className="text-[17px] font-semibold leading-[22px] text-foreground">Não achou a resposta?</h3>
                  <p className="text-sm leading-normal text-muted-foreground">A Zaia responde na hora. Se precisar de uma pessoa, abra um chamado.</p>
                </div>
                <Button className="h-11 text-[14.5px]" onClick={() => setChatOpen(true)}>Perguntar para a Zaia</Button>
                <Button variant="secondary" className="h-11 text-[14.5px]" onClick={openNewTicket}>Abrir chamado</Button>
                <p className="text-[13px] leading-normal text-muted-foreground">Chamados são respondidos em 2 a 24 horas úteis, conforme o assunto.</p>
              </div>
            </aside>
          </div>
        </>
      )}

      <ZaiaChat open={chatOpen} onOpenChange={setChatOpen} />
    </div>
  );
}

export default function AjudaPage() {
  return (
    <Suspense fallback={null}>
      <AjudaContent />
    </Suspense>
  );
}
