'use client';

import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils/cn';
import {
  Ticket, Loader2, ChevronDown, ChevronUp,
  MessageSquare, Clock, Send, CheckCircle2,
  Building2, LifeBuoy,
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

// ── Constants ─────────────────────────────────────────────────────────────────

const STATUS_CONFIG = {
  aberto:         { label: 'Aberto',          color: 'bg-yellow-500/15 text-yellow-500 border-yellow-500/20' },
  em_atendimento: { label: 'Em atendimento',  color: 'bg-blue-500/15 text-blue-500 border-blue-500/20' },
  respondido:     { label: 'Respondido',       color: 'bg-green-500/15 text-green-500 border-green-500/20' },
  fechado:        { label: 'Fechado',          color: 'bg-muted text-muted-foreground border-border' },
} as const;

const STATUS_OPTIONS = ['aberto', 'em_atendimento', 'respondido', 'fechado'] as const;
const FILTER_OPTIONS = ['todos', ...STATUS_OPTIONS] as const;

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

// ── TicketRow ─────────────────────────────────────────────────────────────────

function TicketRow({ ticket, onUpdate }: { ticket: AdminTicket; onUpdate: () => void }) {
  const [open, setOpen] = useState(false);
  const [resposta, setResposta] = useState(ticket.resposta ?? '');
  const [status, setStatus] = useState(ticket.status);
  const [saving, setSaving] = useState(false);
  const cfg = STATUS_CONFIG[status];

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

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-muted/30 transition-colors"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="text-xs font-mono text-muted-foreground">{ticket.protocolo}</span>
            <span className={cn('text-[11px] font-semibold px-2 py-0.5 rounded-full border', cfg.color)}>
              {cfg.label}
            </span>
            {ticket.companies?.name && (
              <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                <Building2 className="h-3 w-3" />{ticket.companies.name}
              </span>
            )}
          </div>
          <p className="text-sm font-medium text-foreground truncate">{ticket.assunto}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {ticket.nome} · {ticket.email} · {formatDate(ticket.created_at)}
          </p>
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground flex-shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />}
      </button>

      {open && (
        <div className="border-t border-border px-4 py-4 space-y-4">
          {/* Mensagem do usuário */}
          <div className="rounded-lg bg-muted/40 border border-border p-3.5">
            <div className="flex items-center gap-2 mb-2">
              <MessageSquare className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs font-semibold text-muted-foreground">Mensagem do usuário</span>
            </div>
            <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{ticket.mensagem}</p>
          </div>

          {/* Resposta existente */}
          {ticket.resposta && (
            <div className="rounded-lg bg-green-500/8 border border-green-500/20 p-3.5">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                <span className="text-xs font-semibold text-green-500">Resposta enviada</span>
                {ticket.respondido_em && (
                  <span className="text-xs text-muted-foreground ml-auto">{formatDate(ticket.respondido_em)}</span>
                )}
              </div>
              <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{ticket.resposta}</p>
            </div>
          )}

          {/* Editor de resposta */}
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <label className="text-xs font-medium text-foreground">Status:</label>
              <select
                value={status}
                onChange={e => setStatus(e.target.value as AdminTicket['status'])}
                className="h-7 text-xs rounded-lg border border-border bg-muted/40 px-2 text-foreground focus:outline-none focus:ring-1 focus:ring-primary/30"
              >
                {STATUS_OPTIONS.map(s => (
                  <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>
                ))}
              </select>
            </div>

            <textarea
              value={resposta}
              onChange={e => setResposta(e.target.value)}
              placeholder="Escreva sua resposta para o usuário..."
              rows={4}
              className="w-full rounded-lg border border-border bg-muted/40 px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-primary/30 resize-none transition-colors"
            />

            <button
              onClick={save}
              disabled={saving}
              className="flex items-center gap-2 h-8 px-4 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              {saving ? 'Salvando...' : 'Salvar e notificar'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AdminSuportePage() {
  const [tickets, setTickets] = useState<AdminTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<typeof FILTER_OPTIONS[number]>('todos');

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

  const counts = tickets.reduce((acc, t) => {
    acc[t.status] = (acc[t.status] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
          <LifeBuoy className="h-4 w-4 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-bold">Suporte</h1>
          <p className="text-xs text-muted-foreground">{tickets.length} ticket{tickets.length !== 1 && 's'} encontrados</p>
        </div>
      </div>

      {/* Stat chips */}
      <div className="flex gap-2 flex-wrap">
        {STATUS_OPTIONS.map(s => (
          <div key={s} className={cn('flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border', STATUS_CONFIG[s].color)}>
            <span className="font-bold">{counts[s] ?? 0}</span>
            <span>{STATUS_CONFIG[s].label}</span>
          </div>
        ))}
      </div>

      {/* Filtro */}
      <div className="flex gap-1.5 flex-wrap">
        {FILTER_OPTIONS.map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              'text-xs px-3 py-1.5 rounded-lg transition-colors capitalize',
              filter === f
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
            )}
          >
            {f === 'todos' ? 'Todos' : STATUS_CONFIG[f as AdminTicket['status']].label}
          </button>
        ))}
      </div>

      {/* Lista */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : tickets.length === 0 ? (
        <div className="text-center py-20 rounded-2xl border border-dashed border-border">
          <Ticket className="h-8 w-8 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Nenhum ticket encontrado.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {tickets.map(t => <TicketRow key={t.id} ticket={t} onUpdate={load} />)}
        </div>
      )}
    </div>
  );
}
