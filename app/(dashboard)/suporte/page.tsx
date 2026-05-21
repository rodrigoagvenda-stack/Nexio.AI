'use client';

import { useState, useEffect, FormEvent } from 'react';
import { cn } from '@/lib/utils/cn';
import {
  Send, CheckCircle2, AlertCircle, Loader2,
  Clock, MessageSquare, ChevronRight, LifeBuoy, ArrowUpRight,
} from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────

interface SupportTicket {
  id: string;
  protocolo: string;
  assunto: string;
  status: 'aberto' | 'em_atendimento' | 'respondido' | 'fechado';
  resposta: string | null;
  respondido_em: string | null;
  created_at: string;
}

// ── Config ────────────────────────────────────────────────────────────────────

const STATUS_CONFIG = {
  aberto:         { label: 'Aberto',        dot: 'bg-amber-400' },
  em_atendimento: { label: 'Em andamento',  dot: 'bg-blue-500' },
  respondido:     { label: 'Respondido',    dot: 'bg-green-500' },
  fechado:        { label: 'Fechado',       dot: 'bg-muted-foreground/30' },
} as const;

const ASSUNTOS = [
  'Problema técnico',
  'WhatsApp / Conexão',
  'Agente IA não responde',
  'Cobrança / Pagamento',
  'Dúvida sobre funcionalidade',
  'Outro',
];

function formatDate(iso: string) {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  if (diff < 60_000) return 'agora';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}min atrás`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h atrás`;
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ── TicketItem ─────────────────────────────────────────────────────────────────

function TicketItem({ ticket }: { ticket: SupportTicket }) {
  const [open, setOpen] = useState(false);
  const cfg = STATUS_CONFIG[ticket.status];

  return (
    <div className={cn('border-b border-border/60 last:border-0', open && 'bg-muted/20')}>
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-muted/10 transition-colors"
      >
        <div className={cn('w-2 h-2 rounded-full flex-shrink-0 mt-0.5', cfg.dot)} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground truncate">{ticket.assunto}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {cfg.label} · {formatDate(ticket.created_at)}
          </p>
        </div>
        <ChevronRight className={cn(
          'h-4 w-4 text-muted-foreground/40 flex-shrink-0 transition-transform duration-150',
          open && 'rotate-90'
        )} />
      </button>

      {open && (
        <div className="px-5 pb-5 ml-5 space-y-3">
          <p className="text-[11px] font-mono text-muted-foreground/50">{ticket.protocolo}</p>
          {ticket.resposta ? (
            <div className="rounded-xl bg-green-500/6 border border-green-500/15 p-4">
              <div className="flex items-center gap-2 mb-2.5">
                <MessageSquare className="h-3.5 w-3.5 text-green-500" />
                <span className="text-xs font-semibold text-green-500">Resposta do suporte</span>
                {ticket.respondido_em && (
                  <span className="text-[11px] text-muted-foreground ml-auto">
                    {formatDate(ticket.respondido_em)}
                  </span>
                )}
              </div>
              <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{ticket.resposta}</p>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-xs text-muted-foreground py-1">
              <Clock className="h-3.5 w-3.5 flex-shrink-0" />
              Aguardando resposta — retornamos em até 24 horas úteis.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function SuportePage() {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loadingTickets, setLoadingTickets] = useState(true);
  const [form, setForm] = useState({ nome: '', email: '', assunto: '', mensagem: '' });
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [protocolo, setProtocolo] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  function reload() {
    fetch('/api/support/tickets')
      .then(r => r.json())
      .then(d => setTickets(d.tickets ?? []))
      .catch(() => {})
      .finally(() => setLoadingTickets(false));
  }

  useEffect(() => { reload(); }, []);

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitStatus('loading');
    setErrorMsg('');
    try {
      const res = await fetch('/api/support/ticket', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao enviar.');
      setProtocolo(data.protocolo);
      setSubmitStatus('success');
      setForm({ nome: '', email: '', assunto: '', mensagem: '' });
      reload();
    } catch (err: unknown) {
      setSubmitStatus('error');
      setErrorMsg(err instanceof Error ? err.message : 'Erro desconhecido.');
    }
  }

  const field = 'w-full rounded-xl border border-border bg-muted/30 px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-all';

  return (
    <div className="max-w-4xl mx-auto pb-20">

      {/* Header */}
      <div className="mb-10">
        <h1 className="text-2xl font-bold tracking-tight">Suporte</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Abra um ticket e nossa equipe retorna em até 24 horas úteis.
        </p>
      </div>

      <div className="grid lg:grid-cols-[1fr_340px] gap-10 items-start">

        {/* ── Formulário ───────────────────────────────────────────────────── */}
        <div>
          {submitStatus === 'success' ? (
            <div className="rounded-2xl border border-border bg-card p-12 flex flex-col items-center text-center gap-4">
              <div className="w-14 h-14 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center">
                <CheckCircle2 className="h-7 w-7 text-green-500" />
              </div>
              <div>
                <p className="font-semibold text-foreground">Ticket enviado com sucesso</p>
                <p className="text-sm text-muted-foreground mt-2 max-w-xs leading-relaxed">
                  Você receberá uma confirmação por e-mail. Protocolo:{' '}
                  <span className="font-mono font-semibold text-foreground">{protocolo}</span>
                </p>
              </div>
              <button
                onClick={() => setSubmitStatus('idle')}
                className="text-sm text-primary hover:text-primary/80 transition-colors mt-1"
              >
                Abrir outro ticket →
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Nome</label>
                  <input
                    name="nome" required value={form.nome} onChange={handleChange}
                    placeholder="Seu nome completo"
                    className={field}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">E-mail</label>
                  <input
                    name="email" type="email" required value={form.email} onChange={handleChange}
                    placeholder="seu@email.com"
                    className={field}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Categoria</label>
                <select
                  name="assunto" required value={form.assunto} onChange={handleChange}
                  className={cn(field, 'cursor-pointer')}
                >
                  <option value="" disabled>Selecione uma categoria...</option>
                  {ASSUNTOS.map(a => <option key={a} value={a}>{a}</option>)}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Descrição</label>
                <textarea
                  name="mensagem" required rows={6}
                  value={form.mensagem} onChange={handleChange}
                  placeholder="Descreva o problema com o máximo de detalhes possível..."
                  className={cn(field, 'resize-none leading-relaxed')}
                />
              </div>

              {submitStatus === 'error' && (
                <div className="flex items-start gap-2.5 rounded-xl border border-red-500/20 bg-red-500/6 px-4 py-3 text-sm text-red-500">
                  <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <p>{errorMsg}</p>
                </div>
              )}

              <div className="flex items-center justify-between pt-1">
                <a
                  href="mailto:suporte@zaapply.com.br"
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
                >
                  suporte@zaapply.com.br
                  <ArrowUpRight className="h-3 w-3" />
                </a>
                <button
                  type="submit"
                  disabled={submitStatus === 'loading' || !form.nome || !form.email || !form.assunto || !form.mensagem}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-40"
                >
                  {submitStatus === 'loading'
                    ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />Enviando...</>
                    : <><Send className="h-3.5 w-3.5" />Enviar ticket</>}
                </button>
              </div>
            </form>
          )}
        </div>

        {/* ── Lista de tickets ─────────────────────────────────────────────── */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Seus tickets</h2>
            {tickets.length > 0 && (
              <span className="text-xs text-muted-foreground">{tickets.length} total</span>
            )}
          </div>

          {loadingTickets ? (
            <div className="flex items-center justify-center py-16 rounded-2xl border border-border">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground/50" />
            </div>
          ) : tickets.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border py-16 flex flex-col items-center gap-3 text-center">
              <LifeBuoy className="h-7 w-7 text-muted-foreground/20" />
              <p className="text-sm text-muted-foreground">Nenhum ticket aberto ainda.</p>
            </div>
          ) : (
            <div className="rounded-2xl border border-border bg-card overflow-hidden">
              {tickets.map(t => <TicketItem key={t.id} ticket={t} />)}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
