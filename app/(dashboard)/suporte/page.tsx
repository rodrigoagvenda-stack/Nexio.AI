'use client';

import { useState, useEffect, useRef, FormEvent, useCallback } from 'react';
import { cn } from '@/lib/utils/cn';
import {
  Send, CheckCircle2, AlertCircle, Loader2,
  Clock, LifeBuoy, Paperclip, X, ChevronLeft,
  ArrowUpRight, ImageIcon, Plus,
} from 'lucide-react';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';

// ── Types ─────────────────────────────────────────────────────────────────────

interface SupportTicket {
  id: string;
  protocolo: string;
  assunto: string;
  mensagem: string;
  status: 'aberto' | 'em_atendimento' | 'respondido' | 'fechado';
  resposta: string | null;
  respondido_em: string | null;
  created_at: string;
  images?: string[];
}

interface Message {
  id: string;
  sender_type: 'user' | 'support';
  content: string;
  created_at: string;
}

type View = 'list' | 'new' | 'thread';

// ── Config ────────────────────────────────────────────────────────────────────

const STATUS_CONFIG = {
  aberto:         { label: 'Aberto',       dot: 'bg-amber-400', color: 'text-amber-500', bg: 'bg-amber-500/10 border-amber-500/20' },
  em_atendimento: { label: 'Em andamento', dot: 'bg-blue-500',  color: 'text-blue-500',  bg: 'bg-blue-500/10 border-blue-500/20' },
  respondido:     { label: 'Respondido',   dot: 'bg-green-500', color: 'text-green-500', bg: 'bg-green-500/10 border-green-500/20' },
  fechado:        { label: 'Fechado',      dot: 'bg-muted-foreground/30', color: 'text-muted-foreground', bg: 'bg-muted/60 border-border' },
} as const;

const ASSUNTOS = [
  'Problema técnico',
  'WhatsApp / Conexão',
  'Agente IA não responde',
  'Cobrança / Pagamento',
  'Dúvida sobre funcionalidade',
  'Outro',
];

const MAX_IMAGES = 3;
const MAX_SIZE_MB = 5;
const SEEN_KEY = 'zaapply_tickets_seen';

function getSeen(): Record<string, string> {
  try { return JSON.parse(localStorage.getItem(SEEN_KEY) ?? '{}'); } catch { return {}; }
}
function markSeen(ticketId: string, lastAt: string) {
  const seen = getSeen();
  seen[ticketId] = lastAt;
  localStorage.setItem(SEEN_KEY, JSON.stringify(seen));
}

function formatDate(iso: string) {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  if (diff < 60_000) return 'agora';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}min atrás`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h atrás`;
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ── PendingImage ──────────────────────────────────────────────────────────────

interface PendingImage { file: File; preview: string; uploading: boolean; url?: string; error?: string }

function ImagePreview({ img, onRemove }: { img: PendingImage; onRemove: () => void }) {
  return (
    <div className="relative group">
      <img src={img.preview} alt="" className="w-16 h-16 rounded-xl object-cover border border-border" />
      {img.uploading && (
        <div className="absolute inset-0 rounded-xl bg-black/50 flex items-center justify-center">
          <Loader2 className="h-3.5 w-3.5 animate-spin text-white" />
        </div>
      )}
      {!img.uploading && (
        <button type="button" onClick={onRemove}
          className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-foreground text-background flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
          <X className="h-2.5 w-2.5" />
        </button>
      )}
    </div>
  );
}

// ── ThreadView ────────────────────────────────────────────────────────────────

function ThreadView({ ticket, onBack, onUpdated }: {
  ticket: SupportTicket;
  onBack: () => void;
  onUpdated: () => void;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingMsgs, setLoadingMsgs] = useState(true);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch(`/api/support/ticket/${ticket.id}/messages`);
      const d = await r.json();
      const msgs: Message[] = d.messages ?? [];
      setMessages(msgs);
      // mark as seen
      if (msgs.length > 0) {
        markSeen(ticket.id, msgs[msgs.length - 1].created_at);
        onUpdated();
      }
    } catch { /* noop */ } finally {
      setLoadingMsgs(false);
    }
  }, [ticket.id]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  async function sendReply() {
    const content = reply.trim();
    if (!content || sending) return;
    setSending(true);
    try {
      const r = await fetch(`/api/support/ticket/${ticket.id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      });
      if (r.ok) {
        setReply('');
        await load();
      }
    } finally {
      setSending(false);
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendReply();
    }
  }

  const cfg = STATUS_CONFIG[ticket.status];

  return (
    <>
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="flex-shrink-0 px-5 py-4 border-b border-border bg-card">
          <div className="flex items-center gap-3">
            <button onClick={onBack} className="lg:hidden p-1.5 rounded-lg hover:bg-muted/60 text-muted-foreground transition-colors">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-sm font-semibold text-foreground truncate">{ticket.assunto}</h2>
                <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full border flex-shrink-0', cfg.bg, cfg.color)}>
                  {cfg.label}
                </span>
              </div>
              <p className="text-[11px] font-mono text-muted-foreground/50 mt-0.5">{ticket.protocolo}</p>
            </div>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
          {loadingMsgs ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground/40" />
            </div>
          ) : (
            <>
              {/* Legacy images from first ticket submission */}
              {ticket.images && ticket.images.length > 0 && messages.length > 0 && messages[0].sender_type === 'user' && (
                <div className="flex justify-end">
                  <div className="flex gap-2 flex-wrap max-w-[80%]">
                    {ticket.images.map((url, i) => (
                      <button key={i} type="button" onClick={() => setLightbox(url)}>
                        <img src={url} alt="" className="w-20 h-20 rounded-xl object-cover border border-border hover:opacity-90 transition-opacity" />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {messages.map((msg) => {
                const isUser = msg.sender_type === 'user';
                return (
                  <div key={msg.id} className={cn('flex', isUser ? 'justify-end' : 'justify-start')}>
                    {!isUser && (
                      <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center flex-shrink-0 mr-2 mt-auto mb-0.5">
                        <span className="text-[11px] font-black text-primary-foreground leading-none">Z</span>
                      </div>
                    )}
                    <div className={cn(
                      'max-w-[78%] rounded-2xl px-4 py-3',
                      isUser
                        ? 'rounded-br-sm bg-primary text-primary-foreground'
                        : 'rounded-bl-sm bg-muted/60 border border-border/60 text-foreground'
                    )}>
                      {!isUser && (
                        <p className="text-[10px] font-semibold mb-1.5 opacity-60">Suporte Zaapply</p>
                      )}
                      <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                      <p className={cn('text-[10px] mt-1.5', isUser ? 'text-primary-foreground/60 text-right' : 'text-muted-foreground/50')}>
                        {formatDate(msg.created_at)}
                      </p>
                    </div>
                  </div>
                );
              })}

              {messages.length === 0 && (
                <div className="flex flex-col items-center justify-center h-32 gap-2">
                  <Clock className="h-6 w-6 text-muted-foreground/20" />
                  <p className="text-xs text-muted-foreground">Aguardando resposta — retornamos em até 24h úteis.</p>
                </div>
              )}

              <div ref={bottomRef} />
            </>
          )}
        </div>

        {/* Reply input */}
        {ticket.status !== 'fechado' && (
          <div className="flex-shrink-0 border-t border-border bg-card px-4 py-3">
            <div className="flex items-end gap-2">
              <textarea
                ref={textareaRef}
                value={reply}
                onChange={e => setReply(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder="Escreva uma mensagem... (Enter para enviar)"
                rows={1}
                className="flex-1 rounded-xl border border-border bg-muted/30 px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 resize-none transition-all leading-relaxed min-h-[42px] max-h-32"
                style={{ height: 'auto' }}
                onInput={e => {
                  const t = e.currentTarget;
                  t.style.height = 'auto';
                  t.style.height = Math.min(t.scrollHeight, 128) + 'px';
                }}
              />
              <button
                onClick={sendReply}
                disabled={!reply.trim() || sending}
                className="w-10 h-10 rounded-xl bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/90 transition-colors disabled:opacity-40 flex-shrink-0"
              >
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </button>
            </div>
          </div>
        )}
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

// ── NewTicketForm ─────────────────────────────────────────────────────────────

function NewTicketForm({ onBack, onCreated }: { onBack: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({ nome: '', email: '', assunto: '', mensagem: '' });
  const [pendingImages, setPendingImages] = useState<PendingImage[]>([]);
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [protocolo, setProtocolo] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const field = 'w-full rounded-xl border border-border bg-muted/30 px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-all';

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (!files.length) return;
    const remaining = MAX_IMAGES - pendingImages.length;
    const newImages: PendingImage[] = files.slice(0, remaining).map(file => ({ file, preview: URL.createObjectURL(file), uploading: true }));
    setPendingImages(prev => [...prev, ...newImages]);
    for (const img of newImages) {
      try {
        if (img.file.size > MAX_SIZE_MB * 1024 * 1024) throw new Error(`Máximo ${MAX_SIZE_MB}MB`);
        const fd = new FormData();
        fd.append('file', img.file);
        const res = await fetch('/api/support/ticket/upload', { method: 'POST', body: fd });
        const data = await res.json();
        if (!res.ok || !data.url) throw new Error(data.error || 'Erro no upload');
        setPendingImages(prev => {
          const copy = [...prev];
          const i = prev.findIndex(p => p.preview === img.preview);
          if (i !== -1) copy[i] = { ...copy[i], uploading: false, url: data.url };
          return copy;
        });
      } catch (err) {
        setPendingImages(prev => {
          const copy = [...prev];
          const i = prev.findIndex(p => p.preview === img.preview);
          if (i !== -1) copy[i] = { ...copy[i], uploading: false, error: (err as Error).message };
          return copy;
        });
      }
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (pendingImages.some(p => p.uploading)) return;
    setStatus('loading');
    try {
      const images = pendingImages.filter(p => p.url).map(p => p.url!);
      const res = await fetch('/api/support/ticket', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, images }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao enviar.');
      setProtocolo(data.protocolo);
      setStatus('success');
      onCreated();
    } catch (err: unknown) {
      setStatus('error');
      setErrorMsg(err instanceof Error ? err.message : 'Erro desconhecido.');
    }
  }

  if (status === 'success') {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center gap-4 px-8">
        <div className="w-14 h-14 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center">
          <CheckCircle2 className="h-7 w-7 text-green-500" />
        </div>
        <div>
          <p className="font-semibold">Ticket enviado!</p>
          <p className="text-sm text-muted-foreground mt-1">Protocolo: <span className="font-mono font-semibold text-foreground">{protocolo}</span></p>
        </div>
        <button onClick={onBack} className="text-sm text-primary hover:text-primary/80 transition-colors font-medium">
          Ver meus tickets →
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex-shrink-0 px-5 py-4 border-b border-border bg-card">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="lg:hidden p-1.5 rounded-lg hover:bg-muted/60 text-muted-foreground transition-colors">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div>
            <h2 className="text-sm font-semibold">Novo ticket</h2>
            <p className="text-xs text-muted-foreground">Retornamos em até 24 horas úteis</p>
          </div>
        </div>
      </div>

      {/* Form */}
      <div className="flex-1 overflow-y-auto px-5 py-5">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Nome</label>
              <input name="nome" required value={form.nome} onChange={e => setForm(p => ({ ...p, nome: e.target.value }))} placeholder="Seu nome" className={field} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">E-mail</label>
              <input name="email" type="email" required value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} placeholder="seu@email.com" className={field} />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Categoria</label>
            <Select value={form.assunto} onValueChange={v => setForm(p => ({ ...p, assunto: v }))}>
              <SelectTrigger className="w-full rounded-xl border border-border bg-muted/30 px-3.5 h-auto py-2.5 text-sm text-foreground focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-all">
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent className="rounded-xl border-border">
                {ASSUNTOS.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Descrição</label>
            <textarea name="mensagem" required rows={5} value={form.mensagem} onChange={e => setForm(p => ({ ...p, mensagem: e.target.value }))} placeholder="Descreva o problema com o máximo de detalhes..." className={cn(field, 'resize-none leading-relaxed')} />
          </div>

          {/* Images */}
          {pendingImages.length > 0 && (
            <div className="flex gap-2 flex-wrap">
              {pendingImages.map(img => (
                <ImagePreview key={img.preview} img={img} onRemove={() => setPendingImages(prev => prev.filter(p => p.preview !== img.preview))} />
              ))}
            </div>
          )}
          {pendingImages.length < MAX_IMAGES && (
            <>
              <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple className="hidden" onChange={handleFileChange} />
              <button type="button" onClick={() => fileRef.current?.click()} className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground border border-dashed border-border rounded-xl px-3.5 py-2.5 transition-colors w-full">
                <Paperclip className="h-3.5 w-3.5" />
                Adicionar imagem
                <span className="ml-auto text-muted-foreground/50">{pendingImages.length}/{MAX_IMAGES} · max {MAX_SIZE_MB}MB</span>
              </button>
            </>
          )}

          {status === 'error' && (
            <div className="flex items-start gap-2.5 rounded-xl border border-red-500/20 bg-red-500/6 px-4 py-3 text-sm text-red-500">
              <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <p>{errorMsg}</p>
            </div>
          )}

          <div className="flex items-center justify-between pt-1">
            <a href="mailto:suporte@zaapply.com.br" className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
              suporte@zaapply.com.br <ArrowUpRight className="h-3 w-3" />
            </a>
            <button
              type="submit"
              disabled={status === 'loading' || pendingImages.some(p => p.uploading) || !form.nome || !form.email || !form.assunto || !form.mensagem}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-40"
            >
              {status === 'loading' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              Enviar ticket
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function SuportePage() {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<SupportTicket | null>(null);
  const [view, setView] = useState<View>('list');
  const [seenMap, setSeenMap] = useState<Record<string, string>>({});

  function reload() {
    fetch('/api/support/tickets')
      .then(r => r.json())
      .then(d => setTickets(d.tickets ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    reload();
    setSeenMap(getSeen());
  }, []);

  function openTicket(ticket: SupportTicket) {
    setSelected(ticket);
    setView('thread');
  }

  function onUpdated() {
    setSeenMap(getSeen());
  }

  // badge = tickets com resposta que ainda não foram vistos
  const unreadCount = tickets.filter(t => {
    if (!t.resposta) return false;
    const seenAt = seenMap[t.id];
    if (!seenAt) return true;
    return t.respondido_em && new Date(t.respondido_em) > new Date(seenAt);
  }).length;

  const cfg = (t: SupportTicket) => STATUS_CONFIG[t.status];

  return (
    <div className="flex h-[calc(100vh-80px)] -m-6 overflow-hidden">

      {/* ── Lista de tickets ─────────────────────────────────────────────── */}
      <div className={cn(
        'flex flex-col border-r border-border bg-card flex-shrink-0',
        (view !== 'list') ? 'hidden lg:flex lg:w-72 xl:w-80' : 'flex w-full'
      )}>
        {/* Header da lista */}
        <div className="flex-shrink-0 px-5 pt-5 pb-4 border-b border-border">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-base font-semibold">Suporte</h1>
              {unreadCount > 0 && (
                <p className="text-xs text-primary mt-0.5 font-medium">{unreadCount} nova{unreadCount !== 1 ? 's' : ''} resposta{unreadCount !== 1 ? 's' : ''}</p>
              )}
            </div>
            <button
              onClick={() => setView('new')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              Novo
            </button>
          </div>
        </div>

        {/* Lista */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground/40" />
            </div>
          ) : tickets.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center px-6 gap-4">
              <LifeBuoy className="h-7 w-7 text-muted-foreground/15" />
              <div>
                <p className="text-sm text-muted-foreground">Nenhum ticket ainda</p>
                <p className="text-xs text-muted-foreground/60 mt-1">Abra um e nossa equipe te ajuda em até 24h</p>
              </div>
              <button onClick={() => setView('new')} className="text-sm text-primary hover:text-primary/80 font-medium transition-colors">
                Abrir um ticket →
              </button>
            </div>
          ) : (
            <div className="divide-y divide-border/40">
              {tickets.map(t => {
                const c = cfg(t);
                const isActive = selected?.id === t.id && view === 'thread';
                const hasUnread = !!t.resposta && (() => {
                  const seenAt = seenMap[t.id];
                  if (!seenAt) return true;
                  return t.respondido_em && new Date(t.respondido_em) > new Date(seenAt);
                })();

                return (
                  <button
                    key={t.id}
                    onClick={() => openTicket(t)}
                    className={cn(
                      'w-full text-left px-5 py-4 transition-colors border-l-2',
                      isActive ? 'bg-primary/6 border-primary' : 'hover:bg-muted/30 border-transparent'
                    )}
                  >
                    <div className="flex items-start gap-2.5">
                      <div className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1.5', c.dot)} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate leading-snug">{t.assunto}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{c.label} · {formatDate(t.created_at)}</p>
                      </div>
                      <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                        {hasUnread && (
                          <span className="w-2 h-2 rounded-full bg-primary flex-shrink-0" />
                        )}
                        {t.images && t.images.length > 0 && (
                          <ImageIcon className="h-3 w-3 text-muted-foreground/30" />
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

      {/* ── Painel direito ───────────────────────────────────────────────── */}
      {view === 'thread' && selected ? (
        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
          <ThreadView
            key={selected.id}
            ticket={selected}
            onBack={() => { setView('list'); setSelected(null); }}
            onUpdated={onUpdated}
          />
        </div>
      ) : view === 'new' ? (
        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
          <NewTicketForm
            onBack={() => setView('list')}
            onCreated={reload}
          />
        </div>
      ) : (
        <div className="hidden lg:flex flex-1 items-center justify-center flex-col gap-3 bg-muted/10">
          <LifeBuoy className="h-8 w-8 text-muted-foreground/15" />
          <p className="text-sm text-muted-foreground/60">Selecione um ticket ou abra um novo</p>
        </div>
      )}
    </div>
  );
}
