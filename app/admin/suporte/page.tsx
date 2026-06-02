'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { cn } from '@/lib/utils/cn';
import {
  Loader2, Send, Building2, ChevronLeft, LifeBuoy,
  Clock, CheckCircle2, X, User, RefreshCw, MessageSquare,
} from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────

interface AdminTicket {
  id: string;
  protocolo: string;
  nome: string;
  email: string;
  assunto: string;
  mensagem: string;
  status: 'aberto' | 'em_atendimento' | 'respondido' | 'fechado';
  resposta: string | null;
  respondido_em: string | null;
  created_at: string;
  images?: string[];
  companies?: { name: string; plan_type?: string } | null;
}

interface AdminMessage {
  id: string;
  sender_type: 'user' | 'support';
  content: string;
  created_at: string;
}

type StatusKey = keyof typeof STATUS_CFG;

// ── Config ────────────────────────────────────────────────────────────────────

const STATUS_CFG = {
  aberto:         { label: 'Aberto',        dot: 'bg-amber-400',           text: 'text-amber-500',        bg: 'bg-amber-500/10',  border: 'border-amber-500/30' },
  em_atendimento: { label: 'Em andamento',  dot: 'bg-blue-500',            text: 'text-blue-500',         bg: 'bg-blue-500/10',   border: 'border-blue-500/30' },
  respondido:     { label: 'Respondido',    dot: 'bg-green-500',           text: 'text-green-600',        bg: 'bg-green-500/10',  border: 'border-green-500/30' },
  fechado:        { label: 'Fechado',       dot: 'bg-muted-foreground/30', text: 'text-muted-foreground', bg: 'bg-muted/50',      border: 'border-border' },
} as const;

const STATUS_KEYS = Object.keys(STATUS_CFG) as StatusKey[];

const PLAN_LABELS: Record<string, string> = {
  starter: 'Start', pro: 'Growth', scale: 'Pro', trial: 'Trial', basic: 'Free',
};

function fmt(iso: string) {
  const d = new Date(iso), diff = Date.now() - d.getTime();
  if (diff < 60_000) return 'agora';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}min atrás`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h atrás`;
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function fmtFull(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function StatusBadge({ status }: { status: StatusKey }) {
  const c = STATUS_CFG[status];
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-[10px] font-semibold px-2 py-0.5 rounded-full border', c.bg, c.border, c.text)}>
      <span className={cn('w-1.5 h-1.5 rounded-full', c.dot)} />
      {c.label}
    </span>
  );
}

// ── Thread ────────────────────────────────────────────────────────────────────

function TicketThread({ ticket, onUpdate, onBack }: {
  ticket: AdminTicket;
  onUpdate: () => void;
  onBack: () => void;
}) {
  const [resposta, setResposta] = useState('');
  const [status, setStatus] = useState<StatusKey>(ticket.status);
  const [saving, setSaving] = useState(false);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [messages, setMessages] = useState<AdminMessage[]>([]);
  const [loadingMsgs, setLoadingMsgs] = useState(true);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const loadMsgs = useCallback(async () => {
    try {
      const r = await fetch(`/api/admin/support/tickets/${ticket.id}/messages`);
      const d = await r.json();
      const msgs: AdminMessage[] = d.messages ?? [];
      if (msgs.length === 0) {
        const legacy: AdminMessage[] = [];
        if (ticket.mensagem) legacy.push({ id: 'lu', sender_type: 'user', content: ticket.mensagem, created_at: ticket.created_at });
        if (ticket.resposta) legacy.push({ id: 'ls', sender_type: 'support', content: ticket.resposta, created_at: ticket.respondido_em ?? ticket.created_at });
        setMessages(legacy);
      } else {
        setMessages(msgs);
      }
    } catch {} finally { setLoadingMsgs(false); }
  }, [ticket.id]);

  useEffect(() => { loadMsgs(); }, [loadMsgs]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  async function save() {
    if (saving) return;
    setSaving(true);
    try {
      await fetch(`/api/admin/support/tickets/${ticket.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, resposta: resposta.trim() || undefined }),
      });
      setResposta('');
      await loadMsgs();
      onUpdate();
    } finally { setSaving(false); }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey && e.metaKey) { e.preventDefault(); save(); }
  }

  const planLabel = ticket.companies?.plan_type ? (PLAN_LABELS[ticket.companies.plan_type] ?? ticket.companies.plan_type) : null;

  return (
    <>
      <div className="flex flex-col h-full bg-background">

        {/* Header */}
        <div className="flex-shrink-0 px-4 py-3.5 border-b border-border bg-card">
          <div className="flex items-start gap-3">
            <button onClick={onBack} className="lg:hidden p-1.5 rounded-lg hover:bg-muted/60 text-muted-foreground mt-0.5">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-3 mb-1">
                <p className="text-sm font-semibold text-foreground truncate">{ticket.assunto}</p>
                <StatusBadge status={status} />
              </div>
              <p className="text-[10px] font-mono text-muted-foreground/40">{ticket.protocolo} · {fmtFull(ticket.created_at)}</p>
            </div>
          </div>
        </div>

        {/* Customer info strip */}
        <div className="flex-shrink-0 flex items-center gap-3 px-4 py-2.5 bg-muted/20 border-b border-border/40">
          <div className="w-8 h-8 rounded-full bg-muted border border-border flex items-center justify-center flex-shrink-0">
            <span className="text-[11px] font-bold text-muted-foreground">{ticket.nome.charAt(0).toUpperCase()}</span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-xs font-semibold text-foreground">{ticket.nome}</p>
              <span className="text-muted-foreground/30 text-[10px]">·</span>
              <p className="text-xs text-muted-foreground">{ticket.email}</p>
              {ticket.companies?.name && (
                <>
                  <span className="text-muted-foreground/30 text-[10px]">·</span>
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Building2 className="h-3 w-3" />{ticket.companies.name}
                  </span>
                </>
              )}
              {planLabel && (
                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-primary/10 text-primary border border-primary/20">
                  {planLabel}
                </span>
              )}
            </div>
          </div>
          <button onClick={loadMsgs} className="p-1.5 rounded-lg hover:bg-muted/60 text-muted-foreground transition-colors flex-shrink-0">
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto">
          <div className="flex flex-col min-h-full justify-end px-4 py-4 gap-3">
            {loadingMsgs ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground/30" />
              </div>
            ) : messages.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-8">
                <Clock className="h-5 w-5 text-muted-foreground/20" />
                <p className="text-xs text-muted-foreground/50">Sem mensagens ainda.</p>
              </div>
            ) : (
              <>
                {ticket.images && ticket.images.length > 0 && (
                  <div className="flex gap-2 flex-wrap">
                    {ticket.images.map((url, i) => (
                      <button key={i} onClick={() => setLightbox(url)}>
                        <img src={url} alt="" className="w-16 h-16 rounded-xl object-cover border border-border hover:opacity-90 transition-opacity" />
                      </button>
                    ))}
                  </div>
                )}
                {messages.map(msg => {
                  const isSupport = msg.sender_type === 'support';
                  return (
                    <div key={msg.id} className={cn('flex items-end gap-2', isSupport ? 'justify-end' : 'justify-start')}>
                      {!isSupport && (
                        <div className="w-7 h-7 rounded-full bg-muted border border-border flex items-center justify-center flex-shrink-0">
                          <User className="h-3.5 w-3.5 text-muted-foreground" />
                        </div>
                      )}
                      <div className={cn(
                        'max-w-[78%] rounded-2xl px-4 py-2.5',
                        isSupport ? 'rounded-br-sm bg-primary text-primary-foreground' : 'rounded-bl-sm bg-muted/70 border border-border/60'
                      )}>
                        <p className={cn('text-[10px] font-semibold mb-1 opacity-60')}>
                          {isSupport ? 'Suporte Zaapply' : ticket.nome}
                        </p>
                        <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                        <p className={cn('text-[10px] mt-1', isSupport ? 'text-primary-foreground/50 text-right' : 'text-muted-foreground/40')}>
                          {fmt(msg.created_at)}
                        </p>
                      </div>
                      {isSupport && (
                        <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                          <span className="text-[10px] font-black text-primary-foreground">Z</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </>
            )}
            <div ref={bottomRef} />
          </div>
        </div>

        {/* Reply area */}
        <div className="flex-shrink-0 border-t border-border bg-card px-4 py-3 space-y-2.5">
          {/* Status pills */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] font-medium text-muted-foreground mr-1">Status:</span>
            {STATUS_KEYS.map(s => {
              const c = STATUS_CFG[s];
              const isSelected = status === s;
              return (
                <button key={s} onClick={() => setStatus(s)}
                  className={cn(
                    'inline-flex items-center gap-1 text-[11px] font-medium px-2.5 py-1 rounded-lg border transition-all',
                    isSelected
                      ? cn(c.bg, c.border, c.text, 'ring-1 ring-offset-1 ring-current')
                      : 'border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground bg-transparent'
                  )}>
                  <span className={cn('w-1.5 h-1.5 rounded-full', c.dot)} />
                  {c.label}
                </button>
              );
            })}
          </div>

          {/* Textarea + send */}
          <div className="flex items-end gap-2">
            <textarea
              ref={textareaRef}
              value={resposta}
              onChange={e => setResposta(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Escreva sua resposta... (Cmd+Enter para enviar)"
              rows={2}
              className="flex-1 rounded-xl border border-border bg-muted/30 px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 resize-none transition-all leading-relaxed"
            />
            <button onClick={save} disabled={saving || !resposta.trim()}
              className="flex items-center gap-2 h-10 px-4 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-40 flex-shrink-0">
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              {saving ? 'Enviando...' : 'Enviar'}
            </button>
          </div>
        </div>
      </div>

      {lightbox && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={() => setLightbox(null)}>
          <img src={lightbox} alt="" className="max-w-full max-h-[90vh] rounded-xl object-contain" />
          <button className="absolute top-4 right-4 w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center" onClick={() => setLightbox(null)}>
            <X className="h-5 w-5 text-white" />
          </button>
        </div>
      )}
    </>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function AdminSuportePage() {
  const [tickets, setTickets] = useState<AdminTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<StatusKey | 'todos'>('todos');
  const [selected, setSelected] = useState<AdminTicket | null>(null);

  async function load() {
    setLoading(true);
    try {
      const url = filter === 'todos' ? '/api/admin/support/tickets' : `/api/admin/support/tickets?status=${filter}`;
      const res = await fetch(url);
      const data = await res.json();
      setTickets(data.tickets ?? []);
    } finally { setLoading(false); }
  }

  useEffect(() => { load(); }, [filter]);

  function onUpdate() { load(); setSelected(null); }

  const counts = tickets.reduce((acc, t) => { acc[t.status] = (acc[t.status] ?? 0) + 1; return acc; }, {} as Record<string, number>);
  const pending = (counts['aberto'] ?? 0) + (counts['em_atendimento'] ?? 0);

  return (
    <div className="flex h-[calc(100vh-80px)] -m-6 overflow-hidden">

      {/* ── List ────────────────────────────────────────────────────────────── */}
      <div className={cn('flex flex-col border-r border-border bg-card flex-shrink-0',
        selected ? 'hidden lg:flex lg:w-80 xl:w-96' : 'flex w-full')}>

        {/* Header */}
        <div className="flex-shrink-0 px-4 pt-4 pb-0">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h1 className="text-base font-semibold">Suporte</h1>
              <p className="text-xs text-muted-foreground/60 mt-0.5">
                {pending > 0
                  ? <span className="text-amber-500 font-medium">{pending} aguardando resposta</span>
                  : 'Nenhum ticket pendente'}
              </p>
            </div>
            <div className="flex items-center gap-1.5">
              {STATUS_KEYS.map(s => {
                const c = counts[s] ?? 0;
                if (!c) return null;
                return (
                  <span key={s} className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded-md border', STATUS_CFG[s].bg, STATUS_CFG[s].border, STATUS_CFG[s].text)}>
                    {c}
                  </span>
                );
              })}
            </div>
          </div>

          {/* Tabs */}
          <div className="flex -mx-4 px-4 border-b border-border overflow-x-auto">
            {(['todos', ...STATUS_KEYS] as const).map(f => (
              <button key={f} onClick={() => setFilter(f)}
                className={cn(
                  'text-[11px] px-3 py-2 -mb-px font-medium border-b-2 transition-colors whitespace-nowrap flex-shrink-0',
                  filter === f ? 'border-foreground text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'
                )}>
                {f === 'todos' ? 'Todos' : STATUS_CFG[f].label}
                {f !== 'todos' && counts[f] ? <span className="ml-1.5 text-[10px] opacity-60">({counts[f]})</span> : null}
              </button>
            ))}
          </div>
        </div>

        {/* Ticket list */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-20"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground/30" /></div>
          ) : tickets.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <CheckCircle2 className="h-7 w-7 text-muted-foreground/15" />
              <p className="text-sm text-muted-foreground">Nenhum ticket encontrado.</p>
            </div>
          ) : (
            <div className="divide-y divide-border/40">
              {tickets.map(t => {
                const cfg = STATUS_CFG[t.status];
                const isActive = selected?.id === t.id;
                return (
                  <button key={t.id} onClick={() => setSelected(t)}
                    className={cn('w-full text-left px-4 py-3.5 transition-colors border-l-2',
                      isActive ? 'bg-primary/6 border-primary' : 'hover:bg-muted/30 border-transparent')}>
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-full bg-muted border border-border flex items-center justify-center flex-shrink-0 text-[11px] font-bold text-muted-foreground mt-0.5">
                        {t.nome.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-0.5">
                          <p className="text-sm font-semibold text-foreground truncate">{t.assunto}</p>
                          <span className="text-[10px] text-muted-foreground/50 flex-shrink-0">{fmt(t.created_at)}</span>
                        </div>
                        <p className="text-xs text-muted-foreground mb-1.5 truncate">{t.nome} {t.companies?.name && `· ${t.companies.name}`}</p>
                        <div className="flex items-center gap-2">
                          <StatusBadge status={t.status} />
                          {t.companies?.plan_type && (
                            <span className="text-[10px] font-medium text-muted-foreground/60">
                              {PLAN_LABELS[t.companies.plan_type] ?? t.companies.plan_type}
                            </span>
                          )}
                          {t.images && t.images.length > 0 && (
                            <span className="text-[10px] text-muted-foreground/40 flex items-center gap-0.5">
                              <MessageSquare className="h-2.5 w-2.5" />{t.images.length}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Thread ──────────────────────────────────────────────────────────── */}
      {selected ? (
        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
          <TicketThread key={selected.id} ticket={selected} onUpdate={onUpdate} onBack={() => setSelected(null)} />
        </div>
      ) : (
        <div className="hidden lg:flex flex-1 items-center justify-center flex-col gap-3 bg-muted/10">
          <div className="w-12 h-12 rounded-2xl bg-muted/60 border border-border flex items-center justify-center">
            <LifeBuoy className="h-5 w-5 text-muted-foreground/20" />
          </div>
          <div className="text-center">
            <p className="text-sm text-muted-foreground/60">Selecione um ticket</p>
            <p className="text-xs text-muted-foreground/40">para responder</p>
          </div>
        </div>
      )}
    </div>
  );
}
