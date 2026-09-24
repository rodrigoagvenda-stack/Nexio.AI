'use client';

import { useState, useEffect, useRef, useCallback, FormEvent } from 'react';
import { Check, CheckCheck, ChevronDown, Loader2, Paperclip, Plus, Send, X, ChevronLeft } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';
import { useUser } from '@/lib/hooks/useUser';
import {
  SupportTicket, TicketMessage, TICKET_CATEGORIES, TICKET_MAX_IMAGES, TICKET_MAX_MB, hoursLabel,
  getSeenTickets, markTicketSeen, hasUnreadReply, fmtTicketAge, fmtTicketDate, fmtMessageDate,
} from './tickets-shared';

const CARD = 'rounded-[14px] border border-border bg-card';
const LIME = 'text-[#01573C] dark:text-[#96F63C]';
const FIELD = 'w-full rounded-xl border border-border bg-muted px-4 py-3 text-[15px] text-foreground placeholder:text-muted-foreground/70 outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/20 transition-colors';

const STATUS = {
  aberto: { label: 'Aberto', pill: 'bg-amber-500/15 text-amber-700 dark:text-amber-400', dot: 'bg-amber-500' },
  em_atendimento: { label: 'Em andamento', pill: 'bg-blue-500/15 text-blue-700 dark:text-[#93C1FA]', dot: 'bg-blue-500' },
  respondido: { label: 'Aguardando você', pill: 'bg-green-500/15 text-green-700 dark:text-green-400', dot: 'bg-green-500' },
  fechado: { label: 'Resolvido', pill: 'bg-muted text-muted-foreground', dot: 'bg-muted-foreground/50' },
} as const;

function StatusPill({ status, large }: { status: SupportTicket['status']; large?: boolean }) {
  const c = STATUS[status];
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full font-semibold', c.pill, large ? 'px-3 py-1 text-[12.5px]' : 'px-2.5 py-[3px] text-xs')}>
      <span className={cn('h-1.5 w-1.5 rounded-full', c.dot)} />
      {c.label}
    </span>
  );
}

type View = 'list' | 'new' | 'thread' | 'sent';

interface Props {
  tickets: SupportTicket[];
  loading: boolean;
  reload: () => void;
  /** abre a documentação numa pergunta (usado na lista "Antes de enviar") */
  onOpenDoc: (question: string) => void;
  /** chamado que deve abrir já na conversa (vindo de um link) */
  initialTicketId?: string | null;
  /** abre direto no formulário de novo chamado */
  startInNew?: boolean;
}

export function TicketsPanel({ tickets, loading, reload, onOpenDoc, initialTicketId, startInNew }: Props) {
  const [view, setView] = useState<View>(startInNew ? 'new' : 'list');
  const [selected, setSelected] = useState<SupportTicket | null>(null);
  const [seen, setSeen] = useState<Record<string, string>>({});
  const [historyOpen, setHistoryOpen] = useState(false);
  const [sent, setSent] = useState<{ protocolo: string; category: string } | null>(null);

  useEffect(() => { setSeen(getSeenTickets()); }, []);

  useEffect(() => {
    if (!initialTicketId) return;
    const t = tickets.find((x) => x.id === initialTicketId);
    if (t) { setSelected(t); setView('thread'); }
  }, [initialTicketId, tickets]);

  const active = tickets.filter((t) => t.status !== 'fechado');
  const history = tickets.filter((t) => t.status === 'fechado');
  const unread = tickets.filter((t) => hasUnreadReply(t, seen)).length;

  const openTicket = (t: SupportTicket) => { setSelected(t); setView('thread'); };
  const backToList = () => { setView('list'); setSelected(null); };

  function onThreadUpdated(patch?: Partial<SupportTicket>) {
    setSeen(getSeenTickets());
    if (patch && selected) setSelected((prev) => (prev ? { ...prev, ...patch } : prev));
  }

  if (view === 'new') {
    return (
      <NewTicket
        onCancel={backToList}
        onSent={(protocolo, category) => { setSent({ protocolo, category }); setView('sent'); reload(); }}
        onOpenDoc={onOpenDoc}
      />
    );
  }

  if (view === 'sent' && sent) {
    const hours = TICKET_CATEGORIES.find((c) => c.value === sent.category)?.hours ?? 24;
    return (
      <SentState
        protocolo={sent.protocolo}
        category={sent.category}
        hours={hours}
        onSee={() => {
          const t = tickets.find((x) => x.protocolo === sent.protocolo);
          if (t) openTicket(t); else backToList();
        }}
        onAnother={() => setView('new')}
      />
    );
  }

  if (loading && tickets.length === 0) {
    return <div className="flex items-center justify-center py-24"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground/50" /></div>;
  }

  if (tickets.length === 0) return <EmptyState onNew={() => setView('new')} />;

  return (
    <div className="flex flex-col gap-6 lg:flex-row">
      {/* Lista */}
      <div className={cn(CARD, 'flex w-full shrink-0 flex-col gap-4 px-[18px] py-[22px] lg:w-[400px]', view === 'thread' && 'hidden lg:flex')}>
        <div className="flex items-center justify-between px-2">
          <div className="flex flex-col gap-[3px]">
            <h2 className="text-[19px] font-semibold leading-6 text-foreground">Seus chamados</h2>
            {unread > 0 && (
              <p className={cn('text-[13.5px] font-semibold', LIME)}>{unread} {unread === 1 ? 'resposta nova' : 'respostas novas'}</p>
            )}
          </div>
          <Button size="sm" className="h-10 px-[18px]" onClick={() => setView('new')}><Plus className="!size-[13px]" strokeWidth={3} /> Novo</Button>
        </div>

        <div className="flex flex-col gap-0.5">
          {active.length > 0 && (
            <p className="px-2.5 py-1.5 text-xs font-semibold uppercase tracking-[0.06em] text-muted-foreground">Em aberto</p>
          )}
          {active.map((t) => (
            <TicketRow key={t.id} t={t} selected={selected?.id === t.id && view === 'thread'} unread={hasUnreadReply(t, seen)} onClick={() => openTicket(t)} />
          ))}
        </div>

        {history.length > 0 && (
          <div className="flex flex-col gap-0.5">
            <button
              type="button"
              onClick={() => setHistoryOpen((o) => !o)}
              className="flex items-center justify-between rounded-lg bg-muted px-2.5 py-2 text-xs font-semibold uppercase tracking-[0.06em] text-muted-foreground"
            >
              Histórico · {history.length}
              <ChevronDown className={cn('h-3 w-3 transition-transform', historyOpen && 'rotate-180')} strokeWidth={2.6} />
            </button>
            {historyOpen && history.map((t) => (
              <TicketRow key={t.id} t={t} selected={selected?.id === t.id && view === 'thread'} unread={false} onClick={() => openTicket(t)} />
            ))}
          </div>
        )}
      </div>

      {/* Conversa */}
      {view === 'thread' && selected ? (
        <Thread
          key={selected.id}
          ticket={selected}
          onBack={backToList}
          onUpdated={onThreadUpdated}
          onResolved={() => { reload(); backToList(); }}
        />
      ) : (
        <div className={cn(CARD, 'hidden min-h-[420px] flex-1 flex-col items-center justify-center gap-1 lg:flex')}>
          <p className="text-[15px] font-medium text-foreground">Selecione um chamado</p>
          <p className="text-sm text-muted-foreground">ou abra um novo.</p>
        </div>
      )}
    </div>
  );
}

function TicketRow({ t, selected, unread, onClick }: { t: SupportTicket; selected: boolean; unread: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn('flex w-full flex-col gap-1.5 rounded-[10px] p-3.5 text-left transition-colors', selected ? 'bg-accent' : 'hover:bg-muted')}
    >
      <div className="flex items-center justify-between gap-2.5">
        <span className={cn('truncate text-[15px] leading-[18px] text-foreground', unread || selected ? 'font-semibold' : 'font-medium')}>{t.assunto}</span>
        <span className="shrink-0 text-[12.5px] text-muted-foreground">{fmtTicketAge(t.resposta && t.respondido_em ? t.respondido_em : t.created_at)}</span>
      </div>
      <p className="truncate text-[13.5px] leading-[18px] text-muted-foreground">{t.resposta || t.mensagem}</p>
      <div className="flex items-center gap-2">
        <StatusPill status={t.status} />
        {unread && <span className="h-2 w-2 shrink-0 rounded-full bg-[#01573C] dark:bg-[#96F63C]" aria-label="Resposta nova" />}
      </div>
    </button>
  );
}

// ── Nenhum chamado ─────────────────────────────────────────────────────────────

function EmptyState({ onNew }: { onNew: () => void }) {
  return (
    <div className="flex flex-col items-center gap-8 pb-5 pt-10">
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-[18px] border border-border bg-card">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground">
            <circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="3.5" /><path d="M5.6 5.6l3.9 3.9M14.5 14.5l3.9 3.9M18.4 5.6l-3.9 3.9M9.5 14.5l-3.9 3.9" />
          </svg>
        </div>
        <h2 className="text-2xl font-semibold tracking-tight text-foreground">Nenhum chamado ainda</h2>
        <p className="max-w-[520px] text-[15.5px] leading-[1.55] text-muted-foreground">
          Quando precisar de uma pessoa da equipe, abra um chamado. Você acompanha a resposta por aqui mesmo.
        </p>
        <Button className="mt-1 h-12 px-[30px] text-[15px]" onClick={onNew}><Plus className="!size-3.5" strokeWidth={3} /> Abrir chamado</Button>
      </div>

      <div className={cn(CARD, 'flex w-full max-w-[640px] flex-col gap-3.5 px-7 py-[26px]')}>
        <div className="flex flex-col gap-1">
          <h3 className="text-[17px] font-semibold leading-[22px] text-foreground">Em quanto tempo respondemos</h3>
          <p className="text-sm text-muted-foreground">Em horas úteis, conforme o assunto do chamado.</p>
        </div>
        <div className="flex flex-col rounded-xl border border-border bg-muted">
          {TICKET_CATEGORIES.map((c, i) => (
            <div key={c.value} className={cn('flex items-center justify-between px-[18px] py-3.5', i > 0 && 'border-t border-border')}>
              <span className="text-[15px] text-foreground">{c.value}</span>
              <span className={cn('text-[14.5px] font-semibold', c.hours === 2 ? LIME : 'text-foreground/80')}>{hoursLabel(c.hours)}</span>
            </div>
          ))}
        </div>
        <p className="text-[13.5px] leading-normal text-muted-foreground">Prefere email? Escreva para suporte@zaapply.com.br.</p>
      </div>
    </div>
  );
}

// ── Conversa do chamado ────────────────────────────────────────────────────────

function Thread({ ticket, onBack, onUpdated, onResolved }: {
  ticket: SupportTicket;
  onBack: () => void;
  onUpdated: (patch?: Partial<SupportTicket>) => void;
  onResolved: () => void;
}) {
  const { user } = useUser();
  const [messages, setMessages] = useState<TicketMessage[]>([]);
  const [loadingMsgs, setLoadingMsgs] = useState(true);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const [closing, setClosing] = useState(false);
  const [status, setStatus] = useState(ticket.status);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const initials = (user?.name || 'U').split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);

  const load = useCallback(async () => {
    try {
      const r = await fetch(`/api/support/ticket/${ticket.id}/messages`);
      const d = await r.json();
      const msgs: TicketMessage[] = d.messages ?? [];
      setMessages(msgs);
      if (msgs.length > 0) { markTicketSeen(ticket.id, msgs[msgs.length - 1].created_at); onUpdated(); }
    } catch { /* mantém o que já estava na tela */ } finally { setLoadingMsgs(false); }
  }, [ticket.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  async function sendReply() {
    const content = reply.trim();
    if (!content || sending) return;
    setSending(true);
    try {
      const r = await fetch(`/api/support/ticket/${ticket.id}/messages`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content }),
      });
      if (!r.ok) throw new Error();
      setReply('');
      await load();
    } catch {
      toast({ variant: 'destructive', title: 'Não foi possível enviar', description: 'Sua mensagem não foi enviada. Tente de novo.' });
    } finally { setSending(false); }
  }

  async function markResolved() {
    if (closing) return;
    setClosing(true);
    try {
      const r = await fetch(`/api/support/ticket/${ticket.id}`, { method: 'PATCH' });
      if (!r.ok) throw new Error();
      setStatus('fechado');
      onUpdated({ status: 'fechado' });
      toast({ variant: 'success', title: 'Chamado resolvido' });
      onResolved();
    } catch {
      toast({ variant: 'destructive', title: 'Não foi possível encerrar', description: 'Tente de novo em instantes.' });
    } finally { setClosing(false); }
  }

  return (
    <>
      <div className={cn(CARD, 'flex min-h-[560px] min-w-0 flex-1 flex-col overflow-hidden lg:max-h-[calc(100vh-260px)]')}>
        <div className="flex flex-col gap-1 border-b border-border px-[26px] py-5">
          <div className="flex items-center justify-between gap-3.5">
            <div className="flex min-w-0 items-center gap-2">
              <button type="button" onClick={onBack} className="-ml-2 rounded-lg p-1.5 text-muted-foreground hover:bg-muted lg:hidden" aria-label="Voltar"><ChevronLeft className="h-4 w-4" /></button>
              <h2 className="truncate text-[19px] font-semibold leading-6 text-foreground">{ticket.assunto}</h2>
            </div>
            <StatusPill status={status} large />
          </div>
          <p className="text-[13px] text-muted-foreground">Protocolo {ticket.protocolo} · {fmtTicketDate(ticket.created_at)}</p>
        </div>

        <div className="flex items-center gap-3 border-b border-border bg-muted px-[26px] py-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#01573C] text-xs font-extrabold text-white">Z</div>
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="text-sm font-semibold text-foreground">Suporte Zaapply</span>
            <span className="text-[12.5px] text-muted-foreground">{status === 'aberto' ? 'Aguardando atribuição' : status === 'fechado' ? 'Chamado encerrado' : 'Atendendo seu chamado'}</span>
          </div>
          {status !== 'fechado' && (
            <button
              type="button"
              onClick={markResolved}
              disabled={closing}
              className="flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-[13.5px] font-semibold text-green-700 transition-colors hover:bg-accent disabled:opacity-60 dark:text-green-400"
            >
              {closing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCheck className="h-3.5 w-3.5" strokeWidth={2.4} />}
              Marcar como resolvido
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="flex min-h-full flex-col justify-end gap-4 px-[26px] py-6">
            {loadingMsgs ? (
              <div className="flex justify-center py-8"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground/50" /></div>
            ) : messages.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">Chamado recebido. Respondemos dentro do prazo da categoria.</p>
            ) : (
              <>
                {ticket.images && ticket.images.length > 0 && messages[0]?.sender_type === 'user' && (
                  <div className="flex flex-wrap justify-end gap-2">
                    {ticket.images.map((url, i) => (
                      <button key={i} type="button" onClick={() => setLightbox(url)}>
                        <img src={url} alt="Anexo do chamado" className="h-16 w-16 rounded-xl border border-border object-cover hover:opacity-90" />
                      </button>
                    ))}
                  </div>
                )}
                {messages.map((m) => {
                  const mine = m.sender_type === 'user';
                  return (
                    <div key={m.id} className={cn('flex items-end gap-2.5', mine ? 'justify-end' : 'justify-start')}>
                      {!mine && <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#01573C] text-xs font-extrabold text-white">Z</div>}
                      <div className={cn(
                        'flex max-w-[560px] flex-col gap-1 px-[18px] py-3',
                        mine ? 'rounded-[16px_16px_4px_16px] bg-[#0F3D2B] text-white' : 'rounded-[16px_16px_16px_4px] border border-border bg-muted text-foreground',
                      )}>
                        {!mine && <span className="text-xs font-semibold text-muted-foreground">Suporte Zaapply</span>}
                        <p className="whitespace-pre-wrap text-[15px] leading-[1.55]">{m.content}</p>
                        <span className={cn('text-[11.5px]', mine ? 'text-right text-[#8FB8A0]' : 'text-muted-foreground')}>{fmtMessageDate(m.created_at)}</span>
                      </div>
                      {mine && <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border bg-muted text-[11px] font-bold text-muted-foreground">{initials}</div>}
                    </div>
                  );
                })}
                {status === 'fechado' && (
                  <p className="flex items-center justify-center gap-2 py-1 text-xs text-muted-foreground"><Check className="h-3.5 w-3.5 text-green-500" /> Chamado encerrado</p>
                )}
              </>
            )}
            <div ref={bottomRef} />
          </div>
        </div>

        {status !== 'fechado' && (
          <div className="flex items-end gap-2.5 border-t border-border bg-card px-5 py-3.5">
            <textarea
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendReply(); } }}
              placeholder="Escreva uma mensagem…"
              rows={1}
              className={cn(FIELD, 'max-h-32 min-h-[46px] flex-1 resize-none py-[13px] leading-[18px]')}
              onInput={(e) => { const t = e.currentTarget; t.style.height = 'auto'; t.style.height = `${Math.min(t.scrollHeight, 128)}px`; }}
            />
            <button
              type="button"
              onClick={sendReply}
              disabled={!reply.trim() || sending}
              aria-label="Enviar mensagem"
              className="flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-xl bg-[#01573C] text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" strokeWidth={2.2} />}
            </button>
          </div>
        )}
      </div>

      {lightbox && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4" onClick={() => setLightbox(null)}>
          <img src={lightbox} alt="Anexo ampliado" className="max-h-[90vh] max-w-full rounded-xl object-contain" />
          <button type="button" aria-label="Fechar" className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-white/10 hover:bg-white/20" onClick={() => setLightbox(null)}>
            <X className="h-5 w-5 text-white" />
          </button>
        </div>
      )}
    </>
  );
}

// ── Novo chamado ───────────────────────────────────────────────────────────────

interface PendingImg { file: File; preview: string; uploading: boolean; url?: string; error?: string }

const QUICK_DOCS = ['WhatsApp não conecta ou desconecta', 'Agente IA não responde', 'Mensagens não aparecem no chat'];

function NewTicket({ onCancel, onSent, onOpenDoc }: {
  onCancel: () => void;
  onSent: (protocolo: string, category: string) => void;
  onOpenDoc: (question: string) => void;
}) {
  const { user } = useUser();
  const [assunto, setAssunto] = useState('');
  const [mensagem, setMensagem] = useState('');
  const [imgs, setImgs] = useState<PendingImg[]>([]);
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (!files.length) return;
    const added: PendingImg[] = files.slice(0, TICKET_MAX_IMAGES - imgs.length).map((file) => ({ file, preview: URL.createObjectURL(file), uploading: true }));
    setImgs((p) => [...p, ...added]);
    for (const img of added) {
      const patch = (v: Partial<PendingImg>) => setImgs((p) => p.map((x) => (x.preview === img.preview ? { ...x, ...v } : x)));
      try {
        if (img.file.size > TICKET_MAX_MB * 1024 * 1024) throw new Error(`Máximo de ${TICKET_MAX_MB} MB por imagem`);
        const fd = new FormData();
        fd.append('file', img.file);
        const res = await fetch('/api/support/ticket/upload', { method: 'POST', body: fd });
        const data = await res.json();
        if (!res.ok || !data.url) throw new Error(data.error || 'Erro no envio da imagem');
        patch({ uploading: false, url: data.url });
      } catch (err) {
        patch({ uploading: false, error: (err as Error).message });
      }
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (imgs.some((i) => i.uploading)) return;
    setStatus('loading');
    try {
      const res = await fetch('/api/support/ticket', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome: user?.name || 'Usuário', email: user?.email || '', assunto, mensagem,
          images: imgs.filter((i) => i.url).map((i) => i.url),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.protocolo) throw new Error(data.error || 'Não foi possível enviar o chamado.');
      onSent(data.protocolo, assunto);
    } catch (err) {
      setStatus('error');
      setErrorMsg(err instanceof Error ? err.message : 'Erro desconhecido.');
    }
  }

  const canSend = !!assunto && mensagem.trim().length >= 10 && !imgs.some((i) => i.uploading) && status !== 'loading';

  return (
    <div className="flex flex-col items-start gap-6 lg:flex-row">
      <form onSubmit={submit} className={cn(CARD, 'flex w-full min-w-0 max-w-[820px] flex-1 flex-col gap-6 px-6 py-8 sm:px-9')}>
        <div className="flex flex-col gap-[5px]">
          <h2 className="text-[22px] font-semibold leading-7 tracking-tight text-foreground">Novo chamado</h2>
          {user && (
            <p className="flex flex-wrap items-center gap-x-2 text-sm text-muted-foreground">
              Enviando como <span className="text-foreground">{user.name}</span>
              {user.email && <span>· {user.email}</span>}
            </p>
          )}
        </div>

        <fieldset className="flex flex-col gap-2.5">
          <legend className="mb-2.5 text-sm font-semibold text-foreground">Sobre o que é? *</legend>
          <div className="flex flex-col gap-2" role="radiogroup" aria-label="Sobre o que é o chamado">
            {TICKET_CATEGORIES.map((c) => {
              const on = assunto === c.value;
              return (
                <button
                  key={c.value}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => setAssunto(c.value)}
                  className={cn(
                    'flex items-center gap-3.5 rounded-xl border px-4 py-[13px] text-left transition-colors',
                    on ? 'border-[#1E6B47] bg-accent' : 'border-border bg-muted hover:border-foreground/25',
                  )}
                >
                  <span className={cn('flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border-2', on ? 'border-[#01573C] dark:border-[#96F63C]' : 'border-muted-foreground/50')}>
                    {on && <span className="h-2 w-2 rounded-full bg-[#01573C] dark:bg-[#96F63C]" />}
                  </span>
                  <span className={cn('flex-1 text-[15px] text-foreground', on && 'font-semibold')}>{c.value}</span>
                  {on ? (
                    <span className={cn('rounded-full bg-[#01573C]/10 px-3 py-1 text-[13px] font-semibold dark:bg-[#96F63C]/15', LIME)}>Resposta em {hoursLabel(c.hours)}</span>
                  ) : (
                    <span className="text-[13px] text-muted-foreground">{hoursLabel(c.hours)}</span>
                  )}
                </button>
              );
            })}
          </div>
        </fieldset>

        <div className="flex flex-col gap-2">
          <label htmlFor="ticket-msg" className="text-sm font-semibold text-foreground">O que aconteceu? *</label>
          <textarea
            id="ticket-msg"
            required
            rows={5}
            value={mensagem}
            onChange={(e) => setMensagem(e.target.value)}
            placeholder="Descreva o problema com o máximo de detalhes…"
            className={cn(FIELD, 'min-h-[130px] resize-y leading-normal')}
          />
          {mensagem.length > 0 && mensagem.trim().length < 10 && <p className="text-[13px] text-muted-foreground">Escreva pelo menos 10 caracteres para a equipe entender.</p>}
        </div>

        <div className="flex flex-col gap-2">
          <p className="flex items-baseline gap-2 text-sm font-semibold text-foreground">Anexos <span className="text-[13px] font-normal text-muted-foreground">opcional, até {TICKET_MAX_IMAGES} imagens</span></p>
          {imgs.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {imgs.map((img) => (
                <div key={img.preview} className="group relative h-14 w-14">
                  <img src={img.preview} alt="" className={cn('h-full w-full rounded-lg border border-border object-cover', img.error && 'opacity-40')} />
                  {img.uploading && <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-black/50"><Loader2 className="h-3 w-3 animate-spin text-white" /></div>}
                  {!img.uploading && (
                    <button type="button" aria-label="Remover imagem" onClick={() => setImgs((p) => p.filter((x) => x.preview !== img.preview))}
                      className="absolute -right-1.5 -top-1.5 flex h-[18px] w-[18px] items-center justify-center rounded-full bg-foreground text-background"><X className="h-2.5 w-2.5" /></button>
                  )}
                  {img.error && <span className="absolute inset-x-0 -bottom-5 whitespace-nowrap text-[11px] text-destructive">{img.error}</span>}
                </div>
              ))}
            </div>
          )}
          {imgs.length < TICKET_MAX_IMAGES && (
            <>
              <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={handleFiles} />
              <button type="button" onClick={() => fileRef.current?.click()}
                className="mt-1 flex items-center justify-between rounded-xl border border-dashed border-muted-foreground/40 px-4 py-3.5 text-left transition-colors hover:bg-muted">
                <span className="flex items-center gap-2.5 text-sm text-muted-foreground"><Paperclip className="h-4 w-4" strokeWidth={2} /> Adicionar imagem</span>
                <span className="text-[13px] text-muted-foreground/80">{imgs.length} de {TICKET_MAX_IMAGES}, até {TICKET_MAX_MB} MB cada</span>
              </button>
            </>
          )}
        </div>

        {status === 'error' && (
          <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">{errorMsg}</p>
        )}

        <div className="flex flex-wrap items-center justify-between gap-4 pt-1.5">
          <p className="text-[13.5px] text-muted-foreground">Ou escreva para <a href="mailto:suporte@zaapply.com.br" className="underline-offset-2 hover:underline">suporte@zaapply.com.br</a></p>
          <div className="flex items-center gap-3">
            <Button type="button" variant="secondary" className="h-[46px] px-6 text-[15px]" onClick={onCancel}>Cancelar</Button>
            <Button type="submit" className="h-[46px] px-[30px] text-[15px]" disabled={!canSend}>
              {status === 'loading' && <Loader2 className="h-4 w-4 animate-spin" />} Enviar chamado
            </Button>
          </div>
        </div>
      </form>

      <aside className={cn(CARD, 'flex w-full shrink-0 flex-col gap-3.5 px-[26px] py-6 lg:w-[380px]')}>
        <h3 className="text-[17px] font-semibold leading-[22px] text-foreground">Antes de enviar</h3>
        <p className="text-sm leading-[1.55] text-muted-foreground">Muitas dúvidas se resolvem na hora. Veja se algum destes ajuda:</p>
        <div className="flex flex-col rounded-xl border border-border bg-muted">
          {QUICK_DOCS.map((q, i) => (
            <button key={q} type="button" onClick={() => onOpenDoc(q)} className={cn('px-4 py-[13px] text-left text-[14.5px] text-foreground transition-colors hover:bg-accent', i > 0 && 'border-t border-border', i === 0 && 'rounded-t-xl', i === QUICK_DOCS.length - 1 && 'rounded-b-xl')}>{q}</button>
          ))}
        </div>
        <p className="text-[13px] leading-normal text-muted-foreground">São os primeiros itens da documentação em Problemas comuns.</p>
      </aside>
    </div>
  );
}

// ── Chamado enviado ────────────────────────────────────────────────────────────

function SentState({ protocolo, category, hours, onSee, onAnother }: {
  protocolo: string; category: string; hours: number; onSee: () => void; onAnother: () => void;
}) {
  async function copy() {
    try {
      await navigator.clipboard.writeText(protocolo);
      toast({ variant: 'success', title: 'Protocolo copiado' });
    } catch {
      toast({ variant: 'warning', title: 'Não foi possível copiar', description: `Anote o protocolo: ${protocolo}` });
    }
  }
  const steps = [
    'Você recebe uma confirmação por e-mail com o protocolo.',
    'Nosso time responde dentro do prazo da categoria escolhida.',
    'A resposta aparece na conversa do chamado, em Ajuda, e você pode continuar por lá.',
  ];
  return (
    <div className="flex flex-col items-start gap-6 lg:flex-row">
      <div className="flex w-full max-w-[820px] flex-1 flex-col items-center gap-7 rounded-3xl border border-border bg-card px-6 py-14 sm:px-12">
        <div className="flex h-[72px] w-[72px] items-center justify-center rounded-full bg-accent">
          <Check className="h-9 w-9 text-[#01573C] dark:text-[#96F63C]" strokeWidth={2.6} />
        </div>
        <div className="flex flex-col items-center gap-2.5 text-center">
          <h2 className="text-[32px] font-semibold leading-10 tracking-tight text-foreground">Chamado enviado</h2>
          <p className="max-w-[560px] text-[17px] leading-[26px] text-muted-foreground">
            Recebemos sua mensagem sobre {category}. O prazo desta categoria é de até {hoursLabel(hours)}.
          </p>
        </div>
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-border bg-muted px-8 py-[18px]">
          <span className="text-xs font-semibold tracking-[0.12em] text-muted-foreground">PROTOCOLO</span>
          <span className="font-mono text-[26px] font-bold leading-8 tracking-[0.04em] text-foreground">{protocolo}</span>
          <button type="button" onClick={copy} className={cn('text-sm font-semibold hover:underline', LIME)}>Copiar protocolo</button>
        </div>
        <div className="flex flex-wrap justify-center gap-3">
          <Button className="h-[52px] px-7 text-base" onClick={onSee}>Ver meu chamado</Button>
          <Button variant="secondary" className="h-[52px] px-6 text-base font-medium" onClick={onAnother}>Abrir outro chamado</Button>
        </div>
      </div>

      <aside className="flex w-full shrink-0 flex-col gap-4 rounded-3xl border border-border bg-card p-8 lg:w-[380px]">
        <h3 className="text-lg font-semibold leading-[22px] text-foreground">O que acontece agora</h3>
        {steps.map((s, i) => (
          <div key={s} className="flex items-start gap-3.5">
            <span className={cn('flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full bg-accent text-[13px] font-bold', LIME)}>{i + 1}</span>
            <p className="text-[15px] leading-[22px] text-foreground/85">{s}</p>
          </div>
        ))}
      </aside>
    </div>
  );
}
