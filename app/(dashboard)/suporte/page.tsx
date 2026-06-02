'use client';

import { useState, useEffect, useRef, FormEvent, useCallback } from 'react';
import { cn } from '@/lib/utils/cn';
import {
  Send, CheckCircle2, AlertCircle, Loader2, Clock, LifeBuoy,
  Paperclip, X, ChevronLeft, ArrowUpRight, Plus, CheckCheck,
  Ticket, ImageIcon,
} from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useUser } from '@/lib/hooks/useUser';

// ── Types ──────────────────────────────────────────────────────────────────────

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

const STATUS_CFG = {
  aberto:         { label: 'Aberto',           dot: 'bg-amber-400',           color: 'text-amber-500',        bg: 'bg-amber-500/10 border-amber-500/20' },
  em_atendimento: { label: 'Em andamento',      dot: 'bg-blue-500',            color: 'text-blue-500',         bg: 'bg-blue-500/10 border-blue-500/20' },
  respondido:     { label: 'Aguardando você',   dot: 'bg-green-500',           color: 'text-green-600',        bg: 'bg-green-500/10 border-green-500/20' },
  fechado:        { label: 'Resolvido',         dot: 'bg-muted-foreground/30', color: 'text-muted-foreground', bg: 'bg-muted/60 border-border' },
} as const;

const CATEGORIES = [
  { value: 'Problema técnico',            sla: '4h úteis' },
  { value: 'WhatsApp / Conexão',          sla: '2h úteis' },
  { value: 'Agente IA não responde',      sla: '4h úteis' },
  { value: 'Cobrança / Pagamento',        sla: '24h úteis' },
  { value: 'Dúvida sobre funcionalidade', sla: '24h úteis' },
  { value: 'Outro',                       sla: '24h úteis' },
];

const MAX_IMAGES = 3;
const MAX_MB = 5;
const SEEN_KEY = 'zaapply_tickets_seen';

function getSeen(): Record<string, string> {
  try { return JSON.parse(localStorage.getItem(SEEN_KEY) ?? '{}'); } catch { return {}; }
}
function markSeen(id: string, lastAt: string) {
  const s = getSeen(); s[id] = lastAt; localStorage.setItem(SEEN_KEY, JSON.stringify(s));
}

function fmtTime(iso: string) {
  const d = new Date(iso), diff = Date.now() - d.getTime();
  if (diff < 60_000) return 'agora';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}min`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h`;
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}

function fmtFull(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function StatusBadge({ status }: { status: SupportTicket['status'] }) {
  const c = STATUS_CFG[status];
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-[10px] font-semibold px-2 py-0.5 rounded-full border', c.bg, c.color)}>
      <span className={cn('w-1.5 h-1.5 rounded-full', c.dot)} />
      {c.label}
    </span>
  );
}

// ── Pending image ──────────────────────────────────────────────────────────────

interface PendingImg { file: File; preview: string; uploading: boolean; url?: string; error?: string }

function ImgPreview({ img, onRemove }: { img: PendingImg; onRemove: () => void }) {
  return (
    <div className="relative group w-14 h-14">
      <img src={img.preview} alt="" className="w-full h-full rounded-lg object-cover border border-border" />
      {img.uploading
        ? <div className="absolute inset-0 rounded-lg bg-black/50 flex items-center justify-center"><Loader2 className="h-3 w-3 animate-spin text-white" /></div>
        : <button type="button" onClick={onRemove} className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-foreground text-background flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><X className="h-2.5 w-2.5" /></button>
      }
    </div>
  );
}

// ── Thread view ───────────────────────────────────────────────────────────────

function ThreadView({ ticket, onBack, onUpdated, onClose }: {
  ticket: SupportTicket;
  onBack: () => void;
  onUpdated: (patch?: Partial<SupportTicket>) => void;
  onClose: () => void;
}) {
  const { user } = useUser();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingMsgs, setLoadingMsgs] = useState(true);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const [closing, setClosing] = useState(false);
  const [localStatus, setLocalStatus] = useState(ticket.status);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const userInitials = (user?.name || 'U').split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);

  const load = useCallback(async () => {
    try {
      const r = await fetch(`/api/support/ticket/${ticket.id}/messages`);
      const d = await r.json();
      const msgs: Message[] = d.messages ?? [];
      setMessages(msgs);
      if (msgs.length > 0) { markSeen(ticket.id, msgs[msgs.length - 1].created_at); onUpdated(); }
    } catch {} finally { setLoadingMsgs(false); }
  }, [ticket.id]);

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
      if (r.ok) { setReply(''); await load(); }
    } finally { setSending(false); }
  }

  async function handleMarkResolved() {
    if (closing) return;
    setClosing(true);
    try {
      const r = await fetch(`/api/support/ticket/${ticket.id}`, { method: 'PATCH' });
      if (r.ok) { setLocalStatus('fechado'); onUpdated({ status: 'fechado' }); onClose(); }
    } finally { setClosing(false); }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendReply(); }
  }

  return (
    <>
      <div className="flex flex-col h-full bg-background">
        {/* Header */}
        <div className="flex-shrink-0 px-4 py-3.5 border-b border-border bg-card">
          <div className="flex items-center gap-3">
            <button onClick={onBack} className="lg:hidden p-1.5 rounded-lg hover:bg-muted/60 text-muted-foreground transition-colors">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-foreground truncate">{ticket.assunto}</p>
                <StatusBadge status={localStatus} />
              </div>
              <p className="text-[10px] font-mono text-muted-foreground/40 mt-0.5">{ticket.protocolo} · {fmtFull(ticket.created_at)}</p>
            </div>
          </div>
        </div>

        {/* Agent strip */}
        <div className="flex-shrink-0 flex items-center gap-3 px-4 py-2.5 bg-muted/20 border-b border-border/40">
          <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
            <span className="text-[10px] font-black text-primary-foreground">Z</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-foreground/80">Suporte Zaapply</p>
            <p className="text-[10px] text-muted-foreground/50">
              {localStatus === 'aberto' ? 'Aguardando atribuição' : 'Atendendo seu ticket'}
            </p>
          </div>
          {localStatus !== 'fechado' && (
            <button onClick={handleMarkResolved} disabled={closing}
              className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground hover:text-green-500 transition-colors px-2 py-1 rounded-lg hover:bg-green-500/8">
              {closing ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCheck className="h-3 w-3" />}
              Resolvido
            </button>
          )}
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
                <p className="text-xs text-muted-foreground/50">Ticket recebido. Retornamos em até 24h úteis.</p>
              </div>
            ) : (
              <>
                {ticket.images && ticket.images.length > 0 && messages[0]?.sender_type === 'user' && (
                  <div className="flex justify-end gap-2 flex-wrap">
                    {ticket.images.map((url, i) => (
                      <button key={i} onClick={() => setLightbox(url)}>
                        <img src={url} alt="" className="w-16 h-16 rounded-xl object-cover border border-border hover:opacity-90 transition-opacity" />
                      </button>
                    ))}
                  </div>
                )}
                {messages.map(msg => {
                  const isUser = msg.sender_type === 'user';
                  return (
                    <div key={msg.id} className={cn('flex items-end gap-2', isUser ? 'justify-end' : 'justify-start')}>
                      {!isUser && (
                        <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                          <span className="text-[10px] font-black text-primary-foreground">Z</span>
                        </div>
                      )}
                      <div className={cn(
                        'max-w-[78%] rounded-2xl px-4 py-2.5',
                        isUser ? 'rounded-br-sm bg-primary text-primary-foreground' : 'rounded-bl-sm bg-muted/70 border border-border/60'
                      )}>
                        {!isUser && <p className="text-[10px] font-semibold mb-1 opacity-50">Suporte Zaapply</p>}
                        <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                        <p className={cn('text-[10px] mt-1', isUser ? 'text-primary-foreground/50 text-right' : 'text-muted-foreground/40')}>
                          {fmtTime(msg.created_at)}
                        </p>
                      </div>
                      {isUser && (
                        <div className="w-7 h-7 rounded-full bg-muted border border-border flex items-center justify-center flex-shrink-0">
                          <span className="text-[10px] font-bold text-muted-foreground">{userInitials}</span>
                        </div>
                      )}
                    </div>
                  );
                })}
                {localStatus === 'fechado' && (
                  <div className="flex items-center justify-center gap-2 py-2">
                    <CheckCircle2 className="h-3.5 w-3.5 text-green-500/60" />
                    <span className="text-xs text-muted-foreground/50">Ticket encerrado</span>
                  </div>
                )}
              </>
            )}
            <div ref={bottomRef} />
          </div>
        </div>

        {/* Input */}
        {localStatus !== 'fechado' && (
          <div className="flex-shrink-0 border-t border-border bg-card px-3 py-2.5">
            <div className="flex items-end gap-2">
              <textarea ref={textareaRef} value={reply} onChange={e => setReply(e.target.value)} onKeyDown={onKeyDown}
                placeholder="Escreva uma mensagem..."
                rows={1}
                className="flex-1 rounded-xl border border-border bg-muted/30 px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 resize-none transition-all leading-relaxed min-h-[42px] max-h-32"
                style={{ height: 'auto' }}
                onInput={e => { const t = e.currentTarget; t.style.height = 'auto'; t.style.height = Math.min(t.scrollHeight, 128) + 'px'; }}
              />
              <button onClick={sendReply} disabled={!reply.trim() || sending}
                className="w-10 h-10 rounded-xl bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/90 transition-colors disabled:opacity-40 flex-shrink-0">
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

// ── New ticket form ───────────────────────────────────────────────────────────

function NewTicketForm({ onBack, onCreated }: { onBack: () => void; onCreated: () => void }) {
  const { user } = useUser();
  const [assunto, setAssunto] = useState('');
  const [mensagem, setMensagem] = useState('');
  const [pendingImgs, setPendingImgs] = useState<PendingImg[]>([]);
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [protocolo, setProtocolo] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const fieldCls = 'w-full rounded-xl border border-border bg-muted/30 px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-all';
  const selectedCat = CATEGORIES.find(c => c.value === assunto);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []); e.target.value = '';
    if (!files.length) return;
    const newImgs: PendingImg[] = files.slice(0, MAX_IMAGES - pendingImgs.length).map(file => ({ file, preview: URL.createObjectURL(file), uploading: true }));
    setPendingImgs(p => [...p, ...newImgs]);
    for (const img of newImgs) {
      try {
        if (img.file.size > MAX_MB * 1024 * 1024) throw new Error(`Máximo ${MAX_MB}MB`);
        const fd = new FormData(); fd.append('file', img.file);
        const res = await fetch('/api/support/ticket/upload', { method: 'POST', body: fd });
        const data = await res.json();
        if (!res.ok || !data.url) throw new Error(data.error || 'Erro no upload');
        setPendingImgs(p => { const c = [...p]; const i = p.findIndex(x => x.preview === img.preview); if (i !== -1) c[i] = { ...c[i], uploading: false, url: data.url }; return c; });
      } catch (err) {
        setPendingImgs(p => { const c = [...p]; const i = p.findIndex(x => x.preview === img.preview); if (i !== -1) c[i] = { ...c[i], uploading: false, error: (err as Error).message }; return c; });
      }
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (pendingImgs.some(p => p.uploading)) return;
    setStatus('loading');
    try {
      const images = pendingImgs.filter(p => p.url).map(p => p.url!);
      const res = await fetch('/api/support/ticket', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome: user?.name || 'Usuário', email: user?.email || '', assunto, mensagem, images }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao enviar.');
      setProtocolo(data.protocolo); setStatus('success'); onCreated();
    } catch (err: unknown) {
      setStatus('error'); setErrorMsg(err instanceof Error ? err.message : 'Erro desconhecido.');
    }
  }

  if (status === 'success') {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-5 text-center px-8">
        <div className="w-14 h-14 rounded-2xl bg-green-500/10 border border-green-500/20 flex items-center justify-center">
          <CheckCircle2 className="h-7 w-7 text-green-500" />
        </div>
        <div>
          <p className="font-semibold">Ticket enviado!</p>
          <p className="text-sm text-muted-foreground mt-1">Protocolo: <span className="font-mono font-semibold text-foreground">{protocolo}</span></p>
          <p className="text-xs text-muted-foreground/60 mt-1">Retornamos em até 24h úteis.</p>
        </div>
        <button onClick={onBack} className="text-sm text-primary hover:text-primary/80 font-medium transition-colors">Ver meus tickets →</button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-shrink-0 flex items-center gap-3 px-4 py-3.5 border-b border-border bg-card">
        <button onClick={onBack} className="lg:hidden p-1.5 rounded-lg hover:bg-muted/60 text-muted-foreground transition-colors">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <div>
          <p className="text-sm font-semibold">Novo ticket</p>
          <p className="text-xs text-muted-foreground">Preencha os detalhes do problema</p>
        </div>
      </div>

      {user && (
        <div className="flex-shrink-0 flex items-center gap-2.5 px-4 py-2.5 bg-muted/20 border-b border-border/40">
          <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center">
            <span className="text-[10px] font-bold text-primary">{(user.name || 'U').charAt(0).toUpperCase()}</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Enviando como <span className="font-medium text-foreground">{user.name}</span>
            {user.email && <span className="text-muted-foreground/60"> · {user.email}</span>}
          </p>
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-4 py-5">
        <form onSubmit={handleSubmit} className="space-y-4 max-w-lg">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Categoria <span className="text-destructive">*</span></label>
            <Select value={assunto} onValueChange={setAssunto}>
              <SelectTrigger className="w-full rounded-xl border border-border bg-muted/30 h-auto py-2.5 px-3.5 text-sm focus:ring-2 focus:ring-primary/20">
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent className="rounded-xl border-border">
                {CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.value}</SelectItem>)}
              </SelectContent>
            </Select>
            {selectedCat && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/5 border border-primary/10">
                <Clock className="h-3.5 w-3.5 text-primary/60 flex-shrink-0" />
                <p className="text-xs text-primary/80">Retorno estimado: <span className="font-semibold">{selectedCat.sla}</span></p>
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Descrição <span className="text-destructive">*</span></label>
            <textarea required rows={5} value={mensagem} onChange={e => setMensagem(e.target.value)}
              placeholder="Descreva o problema com o máximo de detalhes..."
              className={cn(fieldCls, 'resize-none leading-relaxed')} />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Anexos <span className="text-muted-foreground/40">(opcional · até {MAX_IMAGES} imagens)</span></label>
            {pendingImgs.length > 0 && (
              <div className="flex gap-2 flex-wrap">
                {pendingImgs.map(img => <ImgPreview key={img.preview} img={img} onRemove={() => setPendingImgs(p => p.filter(x => x.preview !== img.preview))} />)}
              </div>
            )}
            {pendingImgs.length < MAX_IMAGES && (
              <>
                <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={handleFile} />
                <button type="button" onClick={() => fileRef.current?.click()}
                  className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground border border-dashed border-border rounded-xl px-3.5 py-2.5 transition-colors w-full hover:bg-muted/20">
                  <Paperclip className="h-3.5 w-3.5" />
                  Adicionar imagem
                  <span className="ml-auto text-muted-foreground/40">{pendingImgs.length}/{MAX_IMAGES} · max {MAX_MB}MB</span>
                </button>
              </>
            )}
          </div>

          {status === 'error' && (
            <div className="flex items-start gap-2.5 rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" /><p>{errorMsg}</p>
            </div>
          )}

          <div className="flex items-center justify-between pt-1">
            <a href="mailto:suporte@zaapply.com.br" className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors">
              suporte@zaapply.com.br <ArrowUpRight className="h-3 w-3" />
            </a>
            <button type="submit" disabled={status === 'loading' || pendingImgs.some(p => p.uploading) || !assunto || !mensagem}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-40">
              {status === 'loading' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              Enviar ticket
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function SuportePage() {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<SupportTicket | null>(null);
  const [view, setView] = useState<View>('list');
  const [seenMap, setSeenMap] = useState<Record<string, string>>({});
  const [historyOpen, setHistoryOpen] = useState(false);

  function reload() {
    fetch('/api/support/tickets').then(r => r.json()).then(d => setTickets(d.tickets ?? [])).catch(() => {}).finally(() => setLoading(false));
  }

  useEffect(() => { reload(); setSeenMap(getSeen()); }, []);

  function openTicket(t: SupportTicket) { setSelected(t); setView('thread'); }

  function onUpdated(patch?: Partial<SupportTicket>) {
    setSeenMap(getSeen());
    if (patch && selected) {
      setSelected(prev => prev ? { ...prev, ...patch } : prev);
      setTickets(prev => prev.map(t => t.id === selected.id ? { ...t, ...patch } : t));
    }
  }

  const active = tickets.filter(t => t.status !== 'fechado');
  const history = tickets.filter(t => t.status === 'fechado');

  const unread = tickets.filter(t => {
    if (!t.resposta) return false;
    const seen = seenMap[t.id];
    return !seen || (!!t.respondido_em && new Date(t.respondido_em) > new Date(seen));
  }).length;

  function TicketItem({ t }: { t: SupportTicket }) {
    const cfg = STATUS_CFG[t.status];
    const isActive = selected?.id === t.id && view === 'thread';
    const hasUnread = !!t.resposta && (() => {
      const seen = seenMap[t.id];
      return !seen || (!!t.respondido_em && new Date(t.respondido_em) > new Date(seen));
    })();

    return (
      <button onClick={() => openTicket(t)}
        className={cn('w-full text-left px-4 py-3.5 transition-colors border-l-2',
          isActive ? 'bg-primary/6 border-primary' : 'hover:bg-muted/30 border-transparent')}>
        <div className="flex items-start gap-3">
          <div className={cn('w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 text-[11px] font-bold',
            hasUnread ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground border border-border')}>
            {t.assunto.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2 mb-0.5">
              <p className={cn('text-sm truncate', hasUnread ? 'font-semibold text-foreground' : 'font-medium text-foreground/80')}>
                {t.assunto}
              </p>
              <span className="text-[10px] text-muted-foreground/50 flex-shrink-0">{fmtTime(t.created_at)}</span>
            </div>
            <p className="text-xs text-muted-foreground truncate mb-1.5">{t.mensagem}</p>
            <div className="flex items-center gap-2">
              <StatusBadge status={t.status} />
              {hasUnread && <span className="w-2 h-2 rounded-full bg-primary flex-shrink-0" />}
              {t.images && t.images.length > 0 && <ImageIcon className="h-3 w-3 text-muted-foreground/30" />}
            </div>
          </div>
        </div>
      </button>
    );
  }

  return (
    <div className="flex h-[calc(100vh-80px)] -m-6 overflow-hidden">

      {/* ── List ────────────────────────────────────────────────────────────── */}
      <div className={cn('flex flex-col border-r border-border bg-card flex-shrink-0',
        view !== 'list' ? 'hidden lg:flex lg:w-72 xl:w-80' : 'flex w-full')}>

        <div className="flex-shrink-0 flex items-center justify-between px-4 pt-4 pb-3 border-b border-border">
          <div>
            <h1 className="text-base font-semibold">Suporte</h1>
            <p className="text-xs text-muted-foreground/60 mt-0.5">
              {unread > 0 ? <span className="text-primary font-medium">{unread} nova{unread !== 1 ? 's' : ''} resposta{unread !== 1 ? 's' : ''}</span> : 'Seus tickets de atendimento'}
            </p>
          </div>
          <button onClick={() => setView('new')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors">
            <Plus className="h-3.5 w-3.5" /> Novo ticket
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-20"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground/30" /></div>
          ) : tickets.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-4 px-6 text-center">
              <div className="w-12 h-12 rounded-2xl bg-muted/60 border border-border flex items-center justify-center">
                <Ticket className="h-5 w-5 text-muted-foreground/25" />
              </div>
              <div>
                <p className="text-sm font-medium">Nenhum ticket ainda</p>
                <p className="text-xs text-muted-foreground/60 mt-1">Nossa equipe retorna em até 24h úteis</p>
              </div>
              <button onClick={() => setView('new')} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors">
                <Plus className="h-3.5 w-3.5" /> Abrir primeiro ticket
              </button>
            </div>
          ) : (
            <div className="divide-y divide-border/40">
              {active.length > 0 && history.length > 0 && (
                <div className="px-4 py-1.5 bg-muted/20">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/50">Em aberto</p>
                </div>
              )}
              {active.map(t => <TicketItem key={t.id} t={t} />)}

              {history.length > 0 && (
                <>
                  <button onClick={() => setHistoryOpen(o => !o)}
                    className="w-full flex items-center justify-between px-4 py-2 bg-muted/20 hover:bg-muted/30 transition-colors">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/50">Histórico · {history.length}</p>
                    <span className="text-muted-foreground/40 text-xs">{historyOpen ? '▲' : '▼'}</span>
                  </button>
                  {historyOpen && history.map(t => <TicketItem key={t.id} t={t} />)}
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Right panel ─────────────────────────────────────────────────────── */}
      {view === 'thread' && selected ? (
        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
          <ThreadView key={selected.id} ticket={selected}
            onBack={() => { setView('list'); setSelected(null); }}
            onUpdated={onUpdated}
            onClose={() => { reload(); setView('list'); setSelected(null); }} />
        </div>
      ) : view === 'new' ? (
        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
          <NewTicketForm onBack={() => setView('list')} onCreated={reload} />
        </div>
      ) : (
        <div className="hidden lg:flex flex-1 items-center justify-center flex-col gap-3 bg-muted/10">
          <div className="w-12 h-12 rounded-2xl bg-muted/60 border border-border flex items-center justify-center">
            <LifeBuoy className="h-5 w-5 text-muted-foreground/20" />
          </div>
          <div className="text-center">
            <p className="text-sm text-muted-foreground/60">Selecione um ticket</p>
            <p className="text-xs text-muted-foreground/40">ou abra um novo</p>
          </div>
        </div>
      )}
    </div>
  );
}
