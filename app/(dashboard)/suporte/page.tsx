'use client';

import { useState, useEffect, useRef, FormEvent, useCallback } from 'react';
import { cn } from '@/lib/utils/cn';
import {
  Send, CheckCircle2, AlertCircle, Loader2,
  Clock, LifeBuoy, Paperclip, X, ChevronLeft,
  ArrowUpRight, ImageIcon, Plus, UserCircle2,
  ChevronDown, CheckCheck, Headphones, Ticket,
} from 'lucide-react';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { useUser } from '@/lib/hooks/useUser';

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
  aberto:         { label: 'Aberto',             dot: 'bg-amber-400',           color: 'text-amber-500',       bg: 'bg-amber-500/10 border-amber-500/20' },
  em_atendimento: { label: 'Em andamento',        dot: 'bg-blue-500',            color: 'text-blue-500',        bg: 'bg-blue-500/10 border-blue-500/20' },
  respondido:     { label: 'Aguardando você',     dot: 'bg-green-500',           color: 'text-green-600',       bg: 'bg-green-500/10 border-green-500/20' },
  fechado:        { label: 'Resolvido',           dot: 'bg-muted-foreground/30', color: 'text-muted-foreground', bg: 'bg-muted/60 border-border' },
} as const;

const CATEGORIES = [
  { value: 'Problema técnico',              label: 'Problema técnico',              sla: '4h úteis' },
  { value: 'WhatsApp / Conexão',            label: 'WhatsApp / Conexão',            sla: '2h úteis' },
  { value: 'Agente IA não responde',        label: 'Agente IA não responde',        sla: '4h úteis' },
  { value: 'Cobrança / Pagamento',          label: 'Cobrança / Pagamento',          sla: '24h úteis' },
  { value: 'Dúvida sobre funcionalidade',   label: 'Dúvida sobre funcionalidade',   sla: '24h úteis' },
  { value: 'Outro',                         label: 'Outro',                         sla: '24h úteis' },
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

function formatDateFull(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
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

// ── StatusBadge ───────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: SupportTicket['status'] }) {
  const cfg = STATUS_CONFIG[status];
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full border', cfg.bg, cfg.color)}>
      <span className={cn('w-1.5 h-1.5 rounded-full', cfg.dot)} />
      {cfg.label}
    </span>
  );
}

// ── ThreadView ────────────────────────────────────────────────────────────────

function ThreadView({ ticket, onBack, onUpdated, onClose }: {
  ticket: SupportTicket;
  onBack: () => void;
  onUpdated: (updatedTicket?: Partial<SupportTicket>) => void;
  onClose: () => void;
}) {
  const { user } = useUser();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingMsgs, setLoadingMsgs] = useState(true);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const [closing, setClosing] = useState(false);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [localStatus, setLocalStatus] = useState(ticket.status);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch(`/api/support/ticket/${ticket.id}/messages`);
      const d = await r.json();
      const msgs: Message[] = d.messages ?? [];
      setMessages(msgs);
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

  async function handleMarkResolved() {
    if (closing || !confirm('Confirmar que o problema foi resolvido?')) return;
    setClosing(true);
    try {
      const r = await fetch(`/api/support/ticket/${ticket.id}`, { method: 'PATCH' });
      if (r.ok) {
        setLocalStatus('fechado');
        onUpdated({ status: 'fechado' });
        onClose();
      }
    } finally {
      setClosing(false);
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendReply();
    }
  }

  const userInitials = (user?.name || 'U').split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);

  return (
    <>
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="flex-shrink-0 px-5 py-4 border-b border-border bg-card">
          <div className="flex items-start gap-3">
            <button onClick={onBack} className="lg:hidden p-1.5 rounded-lg hover:bg-muted/60 text-muted-foreground transition-colors mt-0.5">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="text-sm font-semibold text-foreground leading-snug">{ticket.assunto}</h2>
                  <p className="text-[11px] font-mono text-muted-foreground/40 mt-0.5">{ticket.protocolo}</p>
                </div>
                <StatusBadge status={localStatus} />
              </div>
              <p className="text-[11px] text-muted-foreground/50 mt-2">
                Aberto em {formatDateFull(ticket.created_at)}
              </p>
            </div>
          </div>
        </div>

        {/* Agent info strip */}
        <div className="flex-shrink-0 px-5 py-3 bg-muted/20 border-b border-border/40 flex items-center gap-3">
          <div className="w-7 h-7 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0">
            <Headphones className="h-3.5 w-3.5 text-primary/60" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-semibold text-foreground/80">Suporte Zaapply</p>
            <p className="text-[10px] text-muted-foreground/50">
              {localStatus === 'aberto' ? 'Aguardando atribuição — retornamos em até 24h úteis' : 'Atendendo seu ticket'}
            </p>
          </div>
          {localStatus !== 'fechado' && (
            <button
              onClick={handleMarkResolved}
              disabled={closing}
              className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground hover:text-green-600 hover:bg-green-500/8 px-2.5 py-1.5 rounded-lg transition-colors border border-transparent hover:border-green-500/20"
            >
              {closing ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCheck className="h-3 w-3" />}
              Resolvido
            </button>
          )}
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
          {loadingMsgs ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground/40" />
            </div>
          ) : (
            <>
              {/* Legacy images attached on ticket creation */}
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
                  <div key={msg.id} className={cn('flex items-end gap-2', isUser ? 'justify-end' : 'justify-start')}>
                    {!isUser && (
                      <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center flex-shrink-0 mb-0.5">
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
                        <p className="text-[10px] font-semibold mb-1.5 opacity-50">Suporte Zaapply</p>
                      )}
                      <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                      <p className={cn('text-[10px] mt-1.5', isUser ? 'text-primary-foreground/50 text-right' : 'text-muted-foreground/40')}>
                        {formatDate(msg.created_at)}
                      </p>
                    </div>
                    {isUser && (
                      <div className="w-7 h-7 rounded-full bg-muted border border-border flex items-center justify-center flex-shrink-0 mb-0.5">
                        <span className="text-[10px] font-bold text-muted-foreground leading-none">{userInitials}</span>
                      </div>
                    )}
                  </div>
                );
              })}

              {messages.length === 0 && (
                <div className="flex flex-col items-center justify-center h-40 gap-3">
                  <div className="w-10 h-10 rounded-full bg-muted/60 flex items-center justify-center">
                    <Clock className="h-4 w-4 text-muted-foreground/30" />
                  </div>
                  <p className="text-xs text-muted-foreground/60 text-center">
                    Ticket recebido. Retornamos em até 24h úteis.
                  </p>
                </div>
              )}

              {localStatus === 'fechado' && (
                <div className="flex items-center gap-2 justify-center py-3">
                  <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                  <span className="text-xs text-muted-foreground/60">Ticket encerrado</span>
                </div>
              )}

              <div ref={bottomRef} />
            </>
          )}
        </div>

        {/* Reply input */}
        {localStatus !== 'fechado' && (
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
  const { user } = useUser();
  const [assunto, setAssunto] = useState('');
  const [mensagem, setMensagem] = useState('');
  const [pendingImages, setPendingImages] = useState<PendingImage[]>([]);
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [protocolo, setProtocolo] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const field = 'w-full rounded-xl border border-border bg-muted/30 px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-all';

  const selectedCategory = CATEGORIES.find(c => c.value === assunto);

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
        body: JSON.stringify({
          nome: user?.name || 'Usuário',
          email: user?.email || '',
          assunto,
          mensagem,
          images,
        }),
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
      <div className="flex flex-col items-center justify-center h-full text-center gap-5 px-8">
        <div className="w-16 h-16 rounded-2xl bg-green-500/10 border border-green-500/20 flex items-center justify-center">
          <CheckCircle2 className="h-8 w-8 text-green-500" />
        </div>
        <div className="space-y-1">
          <p className="font-semibold text-foreground">Ticket enviado com sucesso!</p>
          <p className="text-sm text-muted-foreground">
            Protocolo: <span className="font-mono font-semibold text-foreground">{protocolo}</span>
          </p>
          <p className="text-xs text-muted-foreground/60 mt-2">Nossa equipe retorna em até 24h úteis.</p>
        </div>
        <button onClick={onBack} className="text-sm text-primary hover:text-primary/80 transition-colors font-medium flex items-center gap-1">
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
            <p className="text-xs text-muted-foreground">Preencha os detalhes do seu problema</p>
          </div>
        </div>
      </div>

      {/* User context strip */}
      {user && (
        <div className="flex-shrink-0 px-5 py-3 bg-muted/20 border-b border-border/40 flex items-center gap-2.5">
          <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center">
            <span className="text-[10px] font-bold text-primary">
              {(user.name || 'U').charAt(0).toUpperCase()}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            Enviando como <span className="font-medium text-foreground">{user.name}</span>
            {user.email && <span className="text-muted-foreground/60"> · {user.email}</span>}
          </p>
        </div>
      )}

      {/* Form */}
      <div className="flex-1 overflow-y-auto px-5 py-5">
        <form onSubmit={handleSubmit} className="space-y-5">

          {/* Category + SLA */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">Categoria <span className="text-destructive">*</span></label>
            <Select value={assunto} onValueChange={setAssunto}>
              <SelectTrigger className="w-full rounded-xl border border-border bg-muted/30 px-3.5 h-auto py-2.5 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-all">
                <SelectValue placeholder="Selecione o tipo de problema..." />
              </SelectTrigger>
              <SelectContent className="rounded-xl border-border">
                {CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
              </SelectContent>
            </Select>
            {selectedCategory && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/5 border border-primary/10">
                <Clock className="h-3.5 w-3.5 text-primary/60 flex-shrink-0" />
                <p className="text-xs text-primary/80">
                  Tempo estimado de resposta: <span className="font-semibold">{selectedCategory.sla}</span>
                </p>
              </div>
            )}
          </div>

          {/* Description */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">Descrição <span className="text-destructive">*</span></label>
            <textarea
              required
              rows={5}
              value={mensagem}
              onChange={e => setMensagem(e.target.value)}
              placeholder="Descreva o problema com o máximo de detalhes. Quanto mais contexto, mais rápido resolvemos."
              className={cn(field, 'resize-none leading-relaxed')}
            />
          </div>

          {/* Images */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">Anexos <span className="text-muted-foreground/40">(opcional · até {MAX_IMAGES} imagens)</span></label>
            {pendingImages.length > 0 && (
              <div className="flex gap-2 flex-wrap mb-2">
                {pendingImages.map(img => (
                  <ImagePreview key={img.preview} img={img} onRemove={() => setPendingImages(prev => prev.filter(p => p.preview !== img.preview))} />
                ))}
              </div>
            )}
            {pendingImages.length < MAX_IMAGES && (
              <>
                <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple className="hidden" onChange={handleFileChange} />
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground border border-dashed border-border rounded-xl px-3.5 py-2.5 transition-colors w-full hover:bg-muted/20"
                >
                  <Paperclip className="h-3.5 w-3.5" />
                  Adicionar imagem
                  <span className="ml-auto text-muted-foreground/40">{pendingImages.length}/{MAX_IMAGES} · max {MAX_SIZE_MB}MB</span>
                </button>
              </>
            )}
          </div>

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
              disabled={status === 'loading' || pendingImages.some(p => p.uploading) || !assunto || !mensagem}
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

// ── TicketList ────────────────────────────────────────────────────────────────

function TicketList({
  tickets,
  loading,
  selected,
  view,
  seenMap,
  onSelect,
  onNew,
}: {
  tickets: SupportTicket[];
  loading: boolean;
  selected: SupportTicket | null;
  view: View;
  seenMap: Record<string, string>;
  onSelect: (t: SupportTicket) => void;
  onNew: () => void;
}) {
  const [historyOpen, setHistoryOpen] = useState(false);

  const active = tickets.filter(t => t.status !== 'fechado');
  const history = tickets.filter(t => t.status === 'fechado');

  const unreadCount = tickets.filter(t => {
    if (!t.resposta) return false;
    const seenAt = seenMap[t.id];
    if (!seenAt) return true;
    return t.respondido_em && new Date(t.respondido_em) > new Date(seenAt);
  }).length;

  function TicketItem({ t }: { t: SupportTicket }) {
    const c = STATUS_CONFIG[t.status];
    const isActive = selected?.id === t.id && view === 'thread';
    const hasUnread = !!t.resposta && (() => {
      const seenAt = seenMap[t.id];
      if (!seenAt) return true;
      return t.respondido_em && new Date(t.respondido_em) > new Date(seenAt);
    })();

    return (
      <button
        onClick={() => onSelect(t)}
        className={cn(
          'w-full text-left px-4 py-3.5 transition-colors border-l-2 group',
          isActive ? 'bg-primary/6 border-primary' : 'hover:bg-muted/30 border-transparent'
        )}
      >
        <div className="flex items-start gap-3">
          <div className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0 mt-2', c.dot)} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <p className={cn('text-sm truncate leading-snug', hasUnread ? 'font-semibold text-foreground' : 'font-medium text-foreground/80')}>
                {t.assunto}
              </p>
              {hasUnread && <span className="w-2 h-2 rounded-full bg-primary flex-shrink-0" />}
            </div>
            <div className="flex items-center gap-1.5 mt-1">
              <span className={cn('text-[10px] font-semibold', c.color)}>{c.label}</span>
              <span className="text-muted-foreground/30 text-[10px]">·</span>
              <span className="text-[10px] text-muted-foreground/50">{formatDate(t.created_at)}</span>
              {t.images && t.images.length > 0 && (
                <>
                  <span className="text-muted-foreground/30 text-[10px]">·</span>
                  <ImageIcon className="h-2.5 w-2.5 text-muted-foreground/30" />
                </>
              )}
            </div>
          </div>
        </div>
      </button>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex-shrink-0 px-5 pt-5 pb-4 border-b border-border">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-base font-semibold">Suporte</h1>
            {unreadCount > 0 ? (
              <p className="text-xs text-primary mt-0.5 font-medium">{unreadCount} nova{unreadCount !== 1 ? 's' : ''} resposta{unreadCount !== 1 ? 's' : ''}</p>
            ) : (
              <p className="text-xs text-muted-foreground/50 mt-0.5">Seus tickets de atendimento</p>
            )}
          </div>
          <button
            onClick={onNew}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            Novo ticket
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground/40" />
          </div>
        ) : tickets.length === 0 ? (
          /* Empty state */
          <div className="flex flex-col items-center justify-center py-16 text-center px-6 gap-5">
            <div className="w-14 h-14 rounded-2xl bg-muted/60 border border-border flex items-center justify-center">
              <Ticket className="h-6 w-6 text-muted-foreground/25" />
            </div>
            <div className="space-y-1.5">
              <p className="text-sm font-medium text-foreground">Nenhum ticket ainda</p>
              <p className="text-xs text-muted-foreground/60 leading-relaxed max-w-[200px]">
                Abra um chamado e nossa equipe retorna em até 24h úteis
              </p>
            </div>
            <button
              onClick={onNew}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              Abrir primeiro ticket
            </button>
          </div>
        ) : (
          <div className="divide-y divide-border/40">
            {/* Active tickets */}
            {active.length > 0 && (
              <>
                {active.length > 0 && history.length > 0 && (
                  <div className="px-4 py-2 bg-muted/20">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/50">Em aberto</p>
                  </div>
                )}
                {active.map(t => <TicketItem key={t.id} t={t} />)}
              </>
            )}

            {/* Historical tickets */}
            {history.length > 0 && (
              <>
                <button
                  onClick={() => setHistoryOpen(o => !o)}
                  className="w-full flex items-center justify-between px-4 py-2.5 bg-muted/20 hover:bg-muted/30 transition-colors"
                >
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/50">
                    Histórico · {history.length}
                  </p>
                  <ChevronDown className={cn('h-3 w-3 text-muted-foreground/40 transition-transform', historyOpen && 'rotate-180')} />
                </button>
                {historyOpen && history.map(t => <TicketItem key={t.id} t={t} />)}
              </>
            )}
          </div>
        )}
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

  function onUpdated(patch?: Partial<SupportTicket>) {
    setSeenMap(getSeen());
    if (patch && selected) {
      setSelected(prev => prev ? { ...prev, ...patch } : prev);
      setTickets(prev => prev.map(t => t.id === selected.id ? { ...t, ...patch } : t));
    }
  }

  return (
    <div className="flex h-[calc(100vh-80px)] -m-6 overflow-hidden">

      {/* ── Ticket list sidebar ───────────────────────────────────────────── */}
      <div className={cn(
        'flex flex-col border-r border-border bg-card flex-shrink-0',
        (view !== 'list') ? 'hidden lg:flex lg:w-72 xl:w-80' : 'flex w-full'
      )}>
        <TicketList
          tickets={tickets}
          loading={loading}
          selected={selected}
          view={view}
          seenMap={seenMap}
          onSelect={openTicket}
          onNew={() => setView('new')}
        />
      </div>

      {/* ── Right panel ──────────────────────────────────────────────────── */}
      {view === 'thread' && selected ? (
        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
          <ThreadView
            key={selected.id}
            ticket={selected}
            onBack={() => { setView('list'); setSelected(null); }}
            onUpdated={onUpdated}
            onClose={() => { reload(); setView('list'); setSelected(null); }}
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
        <div className="hidden lg:flex flex-1 items-center justify-center flex-col gap-4 bg-muted/10">
          <div className="w-14 h-14 rounded-2xl bg-muted/60 border border-border flex items-center justify-center">
            <LifeBuoy className="h-6 w-6 text-muted-foreground/20" />
          </div>
          <div className="text-center space-y-1">
            <p className="text-sm font-medium text-muted-foreground/60">Selecione um ticket</p>
            <p className="text-xs text-muted-foreground/40">ou abra um novo para falar com o suporte</p>
          </div>
        </div>
      )}
    </div>
  );
}
