'use client';

import { useState, useEffect, FormEvent } from 'react';
import { cn } from '@/lib/utils/cn';
import {
  Ticket, Send, Loader2, CheckCircle2, AlertCircle,
  Clock, MessageSquare, X, ChevronDown, ChevronUp,
  LifeBuoy, ExternalLink,
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

// ── Constants ─────────────────────────────────────────────────────────────────

const STATUS_CONFIG = {
  aberto:         { label: 'Aberto',          color: 'bg-yellow-500/15 text-yellow-500 border-yellow-500/20' },
  em_atendimento: { label: 'Em atendimento',  color: 'bg-blue-500/15 text-blue-500 border-blue-500/20' },
  respondido:     { label: 'Respondido',       color: 'bg-green-500/15 text-green-500 border-green-500/20' },
  fechado:        { label: 'Fechado',          color: 'bg-muted text-muted-foreground border-border' },
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
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

// ── TicketCard ─────────────────────────────────────────────────────────────────

function TicketCard({ ticket }: { ticket: SupportTicket }) {
  const [open, setOpen] = useState(false);
  const cfg = STATUS_CONFIG[ticket.status];

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden transition-all">
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
          </div>
          <p className="text-sm font-medium text-foreground truncate">{ticket.assunto}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{formatDate(ticket.created_at)}</p>
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground flex-shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />}
      </button>

      {open && (
        <div className="border-t border-border px-4 py-4 space-y-4">
          {ticket.resposta && (
            <div className="rounded-lg bg-green-500/8 border border-green-500/20 p-3.5">
              <div className="flex items-center gap-2 mb-2">
                <MessageSquare className="h-3.5 w-3.5 text-green-500" />
                <span className="text-xs font-semibold text-green-500">Resposta do suporte</span>
                {ticket.respondido_em && (
                  <span className="text-xs text-muted-foreground ml-auto">{formatDate(ticket.respondido_em)}</span>
                )}
              </div>
              <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{ticket.resposta}</p>
            </div>
          )}
          {!ticket.resposta && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Clock className="h-3.5 w-3.5" />
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
  const [filter, setFilter] = useState<'todos' | SupportTicket['status']>('todos');

  const [form, setForm] = useState({ nome: '', email: '', assunto: '', mensagem: '' });
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [protocolo, setProtocolo] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    fetch('/api/support/tickets')
      .then(r => r.json())
      .then(d => setTickets(d.tickets ?? []))
      .catch(() => {})
      .finally(() => setLoadingTickets(false));
  }, [submitStatus === 'success']);

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
    } catch (err: unknown) {
      setSubmitStatus('error');
      setErrorMsg(err instanceof Error ? err.message : 'Erro desconhecido.');
    }
  }

  const filtered = filter === 'todos' ? tickets : tickets.filter(t => t.status === filter);

  const inputCls = 'w-full h-9 rounded-lg border border-border bg-muted/40 px-3 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-primary/30 transition-colors';

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-16">

      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-1">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <LifeBuoy className="h-4 w-4 text-primary" />
          </div>
          <h1 className="text-2xl font-bold">Suporte</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Abra um ticket e nossa equipe retorna em até 24 horas úteis.
        </p>
      </div>

      <div className="grid lg:grid-cols-2 gap-8 items-start">

        {/* ── Formulário ──────────────────────────────────────────────────────── */}
        <div className="rounded-2xl border border-border bg-card overflow-hidden">
          <div className="flex items-center gap-2.5 px-5 py-4 border-b border-border">
            <Ticket className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold">Novo ticket</h2>
          </div>

          {submitStatus === 'success' ? (
            <div className="flex flex-col items-center justify-center py-14 px-6 text-center gap-3">
              <div className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center">
                <CheckCircle2 className="h-6 w-6 text-green-500" />
              </div>
              <p className="text-base font-semibold">Ticket enviado!</p>
              <p className="text-xs text-muted-foreground max-w-xs">
                Você receberá uma confirmação por e-mail com o protocolo{' '}
                <strong className="text-foreground font-mono">{protocolo}</strong>.
                Retornamos em até 24 horas úteis.
              </p>
              <button
                onClick={() => setSubmitStatus('idle')}
                className="mt-3 text-xs text-primary hover:underline"
              >
                Abrir outro ticket
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-foreground">Nome <span className="text-red-500">*</span></label>
                  <input name="nome" required value={form.nome} onChange={handleChange} placeholder="Seu nome" className={inputCls} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-foreground">E-mail <span className="text-red-500">*</span></label>
                  <input name="email" type="email" required value={form.email} onChange={handleChange} placeholder="seu@email.com" className={inputCls} />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">Assunto <span className="text-red-500">*</span></label>
                <select name="assunto" required value={form.assunto} onChange={handleChange} className={cn(inputCls, 'cursor-pointer')}>
                  <option value="" disabled>Selecione...</option>
                  {ASSUNTOS.map(a => <option key={a} value={a}>{a}</option>)}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">Descreva o problema <span className="text-red-500">*</span></label>
                <textarea
                  name="mensagem" required rows={5}
                  value={form.mensagem} onChange={handleChange}
                  placeholder="Descreva com o máximo de detalhes possível..."
                  className={cn(inputCls, 'h-auto resize-none py-2.5')}
                />
              </div>

              {submitStatus === 'error' && (
                <div className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/8 px-3 py-2 text-xs text-red-500">
                  <AlertCircle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                  <p>{errorMsg}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={submitStatus === 'loading' || !form.nome || !form.email || !form.assunto || !form.mensagem}
                className="w-full h-9 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitStatus === 'loading'
                  ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />Enviando...</>
                  : <><Send className="h-3.5 w-3.5" />Enviar ticket</>}
              </button>

              <p className="text-[11px] text-muted-foreground text-center">
                Urgente?{' '}
                <a href="mailto:suporte@zaapply.com.br" className="text-primary hover:underline inline-flex items-center gap-1">
                  suporte@zaapply.com.br <ExternalLink className="h-2.5 w-2.5" />
                </a>
              </p>
            </form>
          )}
        </div>

        {/* ── Lista de tickets ─────────────────────────────────────────────────── */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground">Seus tickets</h2>
            <div className="flex gap-1">
              {(['todos', 'aberto', 'respondido', 'fechado'] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={cn(
                    'text-xs px-2.5 py-1 rounded-lg capitalize transition-colors',
                    filter === f
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                  )}
                >
                  {f === 'todos' ? 'Todos' : STATUS_CONFIG[f as SupportTicket['status']].label}
                </button>
              ))}
            </div>
          </div>

          {loadingTickets ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 rounded-2xl border border-dashed border-border">
              <Ticket className="h-8 w-8 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">
                {tickets.length === 0 ? 'Nenhum ticket aberto ainda.' : 'Nenhum ticket com esse filtro.'}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map(t => <TicketCard key={t.id} ticket={t} />)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
