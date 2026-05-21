'use client';

import { useState, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils/cn';
import {
  Loader2, Send, CheckCircle2, Clock, MessageSquare,
  Building2, ChevronRight, LifeBuoy, User,
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
  companies?: { name: string } | null;
}

// ── Config ────────────────────────────────────────────────────────────────────

const STATUS_CONFIG = {
  aberto:         { label: 'Aberto',        dot: 'bg-amber-400',         badge: 'bg-amber-500/10 border-amber-500/20 text-amber-500' },
  em_atendimento: { label: 'Em andamento',  dot: 'bg-blue-500',          badge: 'bg-blue-500/10 border-blue-500/20 text-blue-500' },
  respondido:     { label: 'Respondido',    dot: 'bg-green-500',         badge: 'bg-green-500/10 border-green-500/20 text-green-500' },
  fechado:        { label: 'Fechado',       dot: 'bg-muted-foreground/30', badge: 'bg-muted/60 border-border text-muted-foreground' },
} as const;

const STATUS_OPTIONS = ['aberto', 'em_atendimento', 'respondido', 'fechado'] as const;
const FILTER_OPTIONS = ['todos', ...STATUS_OPTIONS] as const;

function formatDate(iso: string) {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  if (diff < 60_000) return 'agora';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}min atrás`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h atrás`;
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// ── TicketThread ──────────────────────────────────────────────────────────────

function TicketThread({ ticket, onUpdate }: { ticket: AdminTicket; onUpdate: () => void }) {
  const [resposta, setResposta] = useState(ticket.resposta ?? '');
  const [status, setStatus] = useState(ticket.status);
  const [saving, setSaving] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  async function save() {
    setSaving(true);
    try {
      await fetch(`/api/admin/support/tickets/${ticket.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, resposta: resposta.trim() || undefined }),
      });
      onUpdate();
    } finally {
      setSaving(false);
    }
  }

  const cfg = STATUS_CONFIG[status];

  return (
    <div className="flex flex-col h-full">
      {/* Thread header */}
      <div className="flex-shrink-0 px-6 py-5 border-b border-border">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-base font-semibold text-foreground leading-snug">{ticket.assunto}</p>
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              <span className="font-mono text-[11px] text-muted-foreground/60">{ticket.protocolo}</span>
              <span className="text-muted-foreground/30">·</span>
              <span className="text-xs text-muted-foreground">{ticket.nome}</span>
              <span className="text-muted-foreground/30">·</span>
              <span className="text-xs text-muted-foreground">{ticket.email}</span>
              {ticket.companies?.name && (
                <>
                  <span className="text-muted-foreground/30">·</span>
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Building2 className="h-3 w-3" />{ticket.companies.name}
                  </span>
                </>
              )}
            </div>
          </div>
          <span className={cn('flex-shrink-0 text-[11px] font-semibold px-2.5 py-1 rounded-full border', cfg.badge)}>
            {cfg.label}
          </span>
        </div>
      </div>

      {/* Conversation */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {/* User message */}
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-full bg-muted border border-border flex items-center justify-center flex-shrink-0">
            <User className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-xs font-semibold text-foreground">{ticket.nome}</span>
              <span className="text-[11px] text-muted-foreground">{formatDate(ticket.created_at)}</span>
            </div>
            <div className="rounded-2xl rounded-tl-sm bg-muted/50 border border-border/50 px-4 py-3">
              <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{ticket.mensagem}</p>
            </div>
          </div>
        </div>

        {/* Existing response */}
        {ticket.resposta && (
          <div className="flex items-start gap-3 flex-row-reverse">
            <div className="w-8 h-8 rounded-full bg-primary/15 border border-primary/20 flex items-center justify-center flex-shrink-0">
              <LifeBuoy className="h-4 w-4 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1.5 flex-row-reverse">
                <span className="text-xs font-semibold text-foreground">Suporte Zaapply</span>
                {ticket.respondido_em && (
                  <span className="text-[11px] text-muted-foreground">{formatDate(ticket.respondido_em)}</span>
                )}
              </div>
              <div className="rounded-2xl rounded-tr-sm bg-primary/8 border border-primary/15 px-4 py-3">
                <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{ticket.resposta}</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Reply area */}
      <div className="flex-shrink-0 border-t border-border p-5 space-y-3 bg-card">
        <div className="flex items-center gap-3">
          <label className="text-xs font-medium text-muted-foreground flex-shrink-0">Status:</label>
          <div className="flex gap-1 flex-wrap">
            {STATUS_OPTIONS.map(s => (
              <button
                key={s}
                onClick={() => setStatus(s)}
                className={cn(
                  'text-[11px] font-medium px-2.5 py-1 rounded-full border transition-colors',
                  status === s
                    ? STATUS_CONFIG[s].badge
                    : 'border-border text-muted-foreground hover:border-border/80 hover:text-foreground'
                )}
              >
                {STATUS_CONFIG[s].label}
              </button>
            ))}
          </div>
        </div>

        <textarea
          ref={textareaRef}
          value={resposta}
          onChange={e => setResposta(e.target.value)}
          placeholder="Escreva sua resposta para o usuário..."
          rows={3}
          className="w-full rounded-xl border border-border bg-muted/30 px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 resize-none transition-all leading-relaxed"
        />

        <div className="flex justify-end">
          <button
            onClick={save}
            disabled={saving}
            className="flex items-center gap-2 h-9 px-5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-40"
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            {saving ? 'Salvando...' : 'Salvar e notificar'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AdminSuportePage() {
  const [tickets, setTickets] = useState<AdminTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<typeof FILTER_OPTIONS[number]>('todos');
  const [selected, setSelected] = useState<AdminTicket | null>(null);

  async function load() {
    setLoading(true);
    try {
      const url = filter === 'todos'
        ? '/api/admin/support/tickets'
        : `/api/admin/support/tickets?status=${filter}`;
      const res = await fetch(url);
      const data = await res.json();
      setTickets(data.tickets ?? []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [filter]);

  function onUpdate() {
    load();
    setSelected(null);
  }

  const counts = tickets.reduce((acc, t) => {
    acc[t.status] = (acc[t.status] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="flex h-[calc(100vh-80px)] -m-6 overflow-hidden">

      {/* ── Sidebar / lista ────────────────────────────────────────────────── */}
      <div className={cn(
        'flex flex-col border-r border-border bg-card',
        selected ? 'hidden lg:flex lg:w-80 xl:w-96 flex-shrink-0' : 'flex-1'
      )}>
        {/* Header */}
        <div className="flex-shrink-0 px-5 pt-6 pb-4 border-b border-border space-y-4">
          <div className="flex items-center justify-between">
            <h1 className="text-lg font-bold">Suporte</h1>
            <span className="text-xs text-muted-foreground">{tickets.length} ticket{tickets.length !== 1 && 's'}</span>
          </div>

          {/* Status counters */}
          <div className="grid grid-cols-2 gap-2">
            {STATUS_OPTIONS.map(s => (
              <div key={s} className={cn('rounded-xl border px-3 py-2', STATUS_CONFIG[s].badge)}>
                <p className="text-lg font-bold tabular-nums">{counts[s] ?? 0}</p>
                <p className="text-[11px] font-medium opacity-80">{STATUS_CONFIG[s].label}</p>
              </div>
            ))}
          </div>

          {/* Filter tabs */}
          <div className="flex gap-0 border-b border-border -mb-4">
            {FILTER_OPTIONS.map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={cn(
                  'text-xs px-3 py-2 -mb-px font-medium border-b-2 transition-colors capitalize',
                  filter === f
                    ? 'border-foreground text-foreground'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                )}
              >
                {f === 'todos' ? 'Todos' : STATUS_CONFIG[f as AdminTicket['status']].label}
              </button>
            ))}
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-24">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground/40" />
            </div>
          ) : tickets.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-center px-6">
              <MessageSquare className="h-8 w-8 text-muted-foreground/20 mb-3" />
              <p className="text-sm text-muted-foreground">Nenhum ticket encontrado.</p>
            </div>
          ) : (
            <div className="divide-y divide-border/60">
              {tickets.map(t => {
                const cfg = STATUS_CONFIG[t.status];
                const isActive = selected?.id === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => setSelected(t)}
                    className={cn(
                      'w-full flex items-start gap-3 px-5 py-4 text-left transition-colors',
                      isActive ? 'bg-accent' : 'hover:bg-muted/40'
                    )}
                  >
                    <div className={cn('w-2 h-2 rounded-full flex-shrink-0 mt-1.5', cfg.dot)} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{t.assunto}</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <p className="text-xs text-muted-foreground truncate">{t.nome}</p>
                        {t.companies?.name && (
                          <>
                            <span className="text-muted-foreground/30 text-xs">·</span>
                            <p className="text-xs text-muted-foreground truncate">{t.companies.name}</p>
                          </>
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground/60 mt-1">{formatDate(t.created_at)}</p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground/30 flex-shrink-0 mt-1" />
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Thread view ─────────────────────────────────────────────────────── */}
      {selected ? (
        <div className="flex-1 flex flex-col overflow-hidden">
          <TicketThread
            key={selected.id}
            ticket={selected}
            onUpdate={onUpdate}
          />
        </div>
      ) : (
        <div className="hidden lg:flex flex-1 items-center justify-center flex-col gap-3 text-center bg-muted/20">
          <LifeBuoy className="h-10 w-10 text-muted-foreground/15" />
          <p className="text-sm text-muted-foreground">Selecione um ticket para responder</p>
        </div>
      )}

    </div>
  );
}
