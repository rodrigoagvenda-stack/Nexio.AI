'use client';

import { useState, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils/cn';
import {
  Loader2, Send, MessageSquare, Building2, ChevronLeft,
  LifeBuoy, User, Clock, CheckCircle2, X,
} from 'lucide-react';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';

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
  companies?: { name: string } | null;
}

// ── Config ────────────────────────────────────────────────────────────────────

const STATUS = {
  aberto:         { label: 'Aberto',       color: 'text-amber-500',  bg: 'bg-amber-500/10 border-amber-500/20',  dot: 'bg-amber-400' },
  em_atendimento: { label: 'Em andamento', color: 'text-blue-500',   bg: 'bg-blue-500/10 border-blue-500/20',    dot: 'bg-blue-500' },
  respondido:     { label: 'Respondido',   color: 'text-green-500',  bg: 'bg-green-500/10 border-green-500/20',  dot: 'bg-green-500' },
  fechado:        { label: 'Fechado',      color: 'text-muted-foreground', bg: 'bg-muted/60 border-border',     dot: 'bg-muted-foreground/30' },
} as const;

type StatusKey = keyof typeof STATUS;
const STATUS_KEYS = Object.keys(STATUS) as StatusKey[];

function fmt(iso: string) {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  if (diff < 60_000) return 'agora';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}min atrás`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h atrás`;
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// ── TicketThread ──────────────────────────────────────────────────────────────

function TicketThread({ ticket, onUpdate, onBack }: { ticket: AdminTicket; onUpdate: () => void; onBack: () => void }) {
  const [resposta, setResposta] = useState(ticket.resposta ?? '');
  const [status, setStatus] = useState<StatusKey>(ticket.status);
  const [saving, setSaving] = useState(false);
  const [lightbox, setLightbox] = useState<string | null>(null);

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

  const cfg = STATUS[status];

  return (
    <>
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="flex-shrink-0 px-6 py-4 border-b border-border bg-card">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="lg:hidden p-1.5 rounded-lg hover:bg-muted/60 text-muted-foreground transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-sm font-semibold text-foreground truncate">{ticket.assunto}</h2>
                <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full border flex-shrink-0', cfg.bg, cfg.color)}>
                  {cfg.label}
                </span>
              </div>
              <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                <span className="font-mono text-[10px] text-muted-foreground/50">{ticket.protocolo}</span>
                <span className="text-muted-foreground/30 text-[10px]">·</span>
                <span className="text-xs text-muted-foreground">{ticket.nome}</span>
                <span className="text-muted-foreground/30 text-[10px]">·</span>
                <span className="text-xs text-muted-foreground">{ticket.email}</span>
                {ticket.companies?.name && (
                  <>
                    <span className="text-muted-foreground/30 text-[10px]">·</span>
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Building2 className="h-3 w-3" />{ticket.companies.name}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* User message */}
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-muted border border-border flex items-center justify-center flex-shrink-0 mt-0.5">
              <User className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="flex-1 min-w-0 space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-foreground">{ticket.nome}</span>
                <span className="text-[11px] text-muted-foreground">{fmt(ticket.created_at)}</span>
              </div>
              <div className="rounded-2xl rounded-tl-sm bg-muted/40 border border-border/60 px-4 py-3 max-w-prose">
                <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{ticket.mensagem}</p>
              </div>
              {ticket.images && ticket.images.length > 0 && (
                <div className="flex gap-2 flex-wrap">
                  {ticket.images.map((url, i) => (
                    <button key={i} type="button" onClick={() => setLightbox(url)}>
                      <img
                        src={url}
                        alt=""
                        className="w-20 h-20 rounded-xl object-cover border border-border hover:opacity-90 transition-opacity"
                      />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Admin response (if exists) */}
          {ticket.resposta && (
            <div className="flex gap-3 flex-row-reverse">
              <div className="w-8 h-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                <LifeBuoy className="h-4 w-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0 space-y-2 flex flex-col items-end">
                <div className="flex items-center gap-2">
                  {ticket.respondido_em && (
                    <span className="text-[11px] text-muted-foreground">{fmt(ticket.respondido_em)}</span>
                  )}
                  <span className="text-xs font-semibold text-foreground">Suporte Zaapply</span>
                </div>
                <div className="rounded-2xl rounded-tr-sm bg-primary/8 border border-primary/15 px-4 py-3 max-w-prose">
                  <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{ticket.resposta}</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Reply area */}
        <div className="flex-shrink-0 border-t border-border bg-card px-6 py-4 space-y-3">
          {/* Status selector */}
          <div className="flex items-center gap-3">
            <span className="text-xs font-medium text-muted-foreground flex-shrink-0">Status</span>
            <Select value={status} onValueChange={v => setStatus(v as StatusKey)}>
              <SelectTrigger className="h-8 w-44 rounded-lg border border-border bg-muted/30 px-3 text-xs text-foreground focus:ring-1 focus:ring-primary/30 focus:outline-none">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-xl border-border">
                {STATUS_KEYS.map(s => (
                  <SelectItem key={s} value={s}>
                    <span className="flex items-center gap-2">
                      <span className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', STATUS[s].dot)} />
                      {STATUS[s].label}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <textarea
            value={resposta}
            onChange={e => setResposta(e.target.value)}
            placeholder="Escreva sua resposta..."
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

      {/* Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setLightbox(null)}
        >
          <img src={lightbox} alt="" className="max-w-full max-h-[90vh] rounded-xl object-contain" />
          <button
            className="absolute top-4 right-4 w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
            onClick={() => setLightbox(null)}
          >
            <X className="h-5 w-5 text-white" />
          </button>
        </div>
      )}
    </>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AdminSuportePage() {
  const [tickets, setTickets] = useState<AdminTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<StatusKey | 'todos'>('todos');
  const [selected, setSelected] = useState<AdminTicket | null>(null);

  async function load() {
    setLoading(true);
    try {
      const url = filterStatus === 'todos'
        ? '/api/admin/support/tickets'
        : `/api/admin/support/tickets?status=${filterStatus}`;
      const res = await fetch(url);
      const data = await res.json();
      setTickets(data.tickets ?? []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [filterStatus]);

  function onUpdate() { load(); setSelected(null); }

  const counts = tickets.reduce((acc, t) => {
    acc[t.status] = (acc[t.status] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const abertos = (counts['aberto'] ?? 0) + (counts['em_atendimento'] ?? 0);

  return (
    <div className="flex h-[calc(100vh-80px)] -m-6 overflow-hidden">

      {/* ── Lista ──────────────────────────────────────────────────────────── */}
      <div className={cn(
        'flex flex-col border-r border-border bg-card flex-shrink-0',
        selected ? 'hidden lg:flex lg:w-72 xl:w-80' : 'flex w-full'
      )}>
        {/* Header */}
        <div className="flex-shrink-0 px-5 pt-5 pb-0">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-base font-semibold text-foreground">Suporte</h1>
              {abertos > 0 && (
                <p className="text-xs text-muted-foreground mt-0.5">{abertos} aguardando resposta</p>
              )}
            </div>
            <div className="flex items-center gap-2">
              {STATUS_KEYS.map(s => {
                const c = counts[s] ?? 0;
                if (!c) return null;
                return (
                  <div key={s} className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded-md border', STATUS[s].bg, STATUS[s].color)}>
                    {c}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Filter tabs */}
          <div className="flex gap-0 border-b border-border -mx-5 px-5">
            {(['todos', ...STATUS_KEYS] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilterStatus(f)}
                className={cn(
                  'text-[11px] px-2.5 py-2 -mb-px font-medium border-b-2 transition-colors whitespace-nowrap',
                  filterStatus === f
                    ? 'border-foreground text-foreground'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                )}
              >
                {f === 'todos' ? 'Todos' : STATUS[f].label}
              </button>
            ))}
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground/40" />
            </div>
          ) : tickets.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center px-6">
              <CheckCircle2 className="h-7 w-7 text-muted-foreground/15 mb-3" />
              <p className="text-sm text-muted-foreground">Nenhum ticket encontrado.</p>
            </div>
          ) : (
            <div className="divide-y divide-border/40">
              {tickets.map(t => {
                const cfg = STATUS[t.status];
                const isActive = selected?.id === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => setSelected(t)}
                    className={cn(
                      'w-full text-left px-5 py-3.5 transition-colors group',
                      isActive ? 'bg-primary/6 border-l-2 border-primary' : 'hover:bg-muted/30 border-l-2 border-transparent'
                    )}
                  >
                    <div className="flex items-start gap-2.5">
                      <div className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1.5', cfg.dot)} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate leading-snug">{t.assunto}</p>
                        <p className="text-xs text-muted-foreground truncate mt-0.5">{t.nome}</p>
                        {t.companies?.name && (
                          <p className="text-[11px] text-muted-foreground/60 flex items-center gap-1 mt-0.5">
                            <Building2 className="h-2.5 w-2.5" />{t.companies.name}
                          </p>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-1 flex-shrink-0">
                        <span className="text-[10px] text-muted-foreground/60">{fmt(t.created_at)}</span>
                        {t.images && t.images.length > 0 && (
                          <span className="text-[10px] text-muted-foreground/40 flex items-center gap-0.5">
                            <MessageSquare className="h-2.5 w-2.5" />{t.images.length}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Thread ─────────────────────────────────────────────────────────── */}
      {selected ? (
        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
          <TicketThread
            key={selected.id}
            ticket={selected}
            onUpdate={onUpdate}
            onBack={() => setSelected(null)}
          />
        </div>
      ) : (
        <div className="hidden lg:flex flex-1 items-center justify-center flex-col gap-3 bg-muted/10">
          <LifeBuoy className="h-8 w-8 text-muted-foreground/15" />
          <p className="text-sm text-muted-foreground/60">Selecione um ticket</p>
        </div>
      )}
    </div>
  );
}
