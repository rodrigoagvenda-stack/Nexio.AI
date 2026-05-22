'use client';

import { useState, useEffect, useRef, FormEvent } from 'react';
import { cn } from '@/lib/utils/cn';
import {
  Send, CheckCircle2, AlertCircle, Loader2,
  Clock, MessageSquare, LifeBuoy,
  Paperclip, X, ImageIcon, ChevronRight, ArrowUpRight,
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

type Tab = 'form' | 'tickets';

// ── Config ────────────────────────────────────────────────────────────────────

const STATUS_CONFIG = {
  aberto:         { label: 'Aberto',       dot: 'bg-amber-400' },
  em_atendimento: { label: 'Em andamento', dot: 'bg-blue-500' },
  respondido:     { label: 'Respondido',   dot: 'bg-green-500' },
  fechado:        { label: 'Fechado',      dot: 'bg-muted-foreground/30' },
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

function formatDate(iso: string) {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  if (diff < 60_000) return 'agora';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}min atrás`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h atrás`;
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ── ImagePreview ──────────────────────────────────────────────────────────────

interface PendingImage { file: File; preview: string; uploading: boolean; url?: string; error?: string }

function ImagePreview({ img, onRemove }: { img: PendingImage; onRemove: () => void }) {
  return (
    <div className="relative group">
      <img src={img.preview} alt="" className="w-20 h-20 rounded-xl object-cover border border-border" />
      {img.uploading && (
        <div className="absolute inset-0 rounded-xl bg-black/50 flex items-center justify-center">
          <Loader2 className="h-4 w-4 animate-spin text-white" />
        </div>
      )}
      {img.error && (
        <div className="absolute inset-0 rounded-xl bg-red-500/80 flex items-center justify-center">
          <AlertCircle className="h-4 w-4 text-white" />
        </div>
      )}
      {!img.uploading && (
        <button
          type="button"
          onClick={onRemove}
          className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-foreground text-background flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}

// ── TicketThread ──────────────────────────────────────────────────────────────

function TicketThread({ ticket }: { ticket: SupportTicket }) {
  const [open, setOpen] = useState(false);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const cfg = STATUS_CONFIG[ticket.status];
  const hasReply = !!ticket.resposta;

  return (
    <>
      <div className={cn('border-b border-border/60 last:border-0', open && 'bg-muted/10')}>
        <button
          onClick={() => setOpen(v => !v)}
          className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-muted/5 transition-colors"
        >
          <div className={cn('w-2 h-2 rounded-full flex-shrink-0', cfg.dot)} />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground truncate">{ticket.assunto}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{cfg.label} · {formatDate(ticket.created_at)}</p>
          </div>
          {hasReply && !open && (
            <span className="flex-shrink-0 text-[10px] font-semibold text-green-500 bg-green-500/10 rounded-full px-2 py-0.5">
              Respondido
            </span>
          )}
          {ticket.images && ticket.images.length > 0 && (
            <ImageIcon className="h-3.5 w-3.5 text-muted-foreground/40 flex-shrink-0" />
          )}
          <ChevronRight className={cn('h-4 w-4 text-muted-foreground/30 flex-shrink-0 transition-transform duration-150', open && 'rotate-90')} />
        </button>

        {open && (
          <div className="px-5 pb-5 space-y-3">
            <p className="text-[11px] font-mono text-muted-foreground/40 ml-5">{ticket.protocolo}</p>

            {/* Conversa */}
            <div className="space-y-3 ml-5">
              {/* Mensagem do usuário */}
              <div className="flex justify-end">
                <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-primary/10 border border-primary/15 px-4 py-3">
                  {ticket.images && ticket.images.length > 0 && (
                    <div className="flex gap-2 flex-wrap mb-2">
                      {ticket.images.map((url, i) => (
                        <button key={i} type="button" onClick={() => setLightbox(url)}>
                          <img src={url} alt="" className="w-16 h-16 rounded-lg object-cover border border-border hover:opacity-90 transition-opacity" />
                        </button>
                      ))}
                    </div>
                  )}
                  <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{ticket.mensagem}</p>
                  <p className="text-[11px] text-muted-foreground/50 mt-1.5 text-right">{formatDate(ticket.created_at)}</p>
                </div>
              </div>

              {/* Resposta do suporte */}
              {ticket.resposta ? (
                <div className="flex justify-start">
                  <div className="max-w-[85%] rounded-2xl rounded-bl-sm bg-muted/50 border border-border px-4 py-3">
                    <div className="flex items-center gap-1.5 mb-2">
                      <div className="w-4 h-4 rounded-full bg-primary flex items-center justify-center">
                        <span className="text-[9px] font-black text-primary-foreground leading-none">Z</span>
                      </div>
                      <span className="text-[11px] font-semibold text-muted-foreground">Suporte Zaapply</span>
                    </div>
                    <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{ticket.resposta}</p>
                    {ticket.respondido_em && (
                      <p className="text-[11px] text-muted-foreground/50 mt-1.5">{formatDate(ticket.respondido_em)}</p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-xs text-muted-foreground py-1">
                  <Clock className="h-3.5 w-3.5 flex-shrink-0" />
                  Aguardando resposta — retornamos em até 24 horas úteis.
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {lightbox && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={() => setLightbox(null)}>
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

export default function SuportePage() {
  const [activeTab, setActiveTab] = useState<Tab>('form');
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loadingTickets, setLoadingTickets] = useState(true);
  const [form, setForm] = useState({ nome: '', email: '', assunto: '', mensagem: '' });
  const [pendingImages, setPendingImages] = useState<PendingImage[]>([]);
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [protocolo, setProtocolo] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  function reload() {
    fetch('/api/support/tickets')
      .then(r => r.json())
      .then(d => setTickets(d.tickets ?? []))
      .catch(() => {})
      .finally(() => setLoadingTickets(false));
  }

  useEffect(() => { reload(); }, []);

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (!files.length) return;
    const remaining = MAX_IMAGES - pendingImages.length;
    const toAdd = files.slice(0, remaining);
    const newImages: PendingImage[] = toAdd.map(file => ({ file, preview: URL.createObjectURL(file), uploading: true }));
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

  function removeImage(preview: string) {
    setPendingImages(prev => prev.filter(p => p.preview !== preview));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (pendingImages.some(p => p.uploading)) return;
    setSubmitStatus('loading');
    setErrorMsg('');
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
      setSubmitStatus('success');
      setForm({ nome: '', email: '', assunto: '', mensagem: '' });
      setPendingImages([]);
      reload();
    } catch (err: unknown) {
      setSubmitStatus('error');
      setErrorMsg(err instanceof Error ? err.message : 'Erro desconhecido.');
    }
  }

  const field = 'w-full rounded-xl border border-border bg-muted/30 px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-all';
  const stillUploading = pendingImages.some(p => p.uploading);

  // badge = tickets com resposta (novas respostas)
  const repliedCount = tickets.filter(t => t.resposta).length;

  return (
    <div className="max-w-2xl mx-auto pb-20">

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight">Suporte</h1>
        <p className="text-sm text-muted-foreground mt-1">Nossa equipe retorna em até 24 horas úteis.</p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-muted/50 rounded-xl p-1 mb-8 w-fit">
        {(['form', 'tickets'] as Tab[]).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              'relative flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all',
              activeTab === tab
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {tab === 'form' ? 'Abrir um ticket' : 'Meus tickets'}
            {tab === 'tickets' && repliedCount > 0 && (
              <span className="w-5 h-5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center leading-none">
                {repliedCount > 9 ? '9+' : repliedCount}
              </span>
            )}
            {tab === 'tickets' && loadingTickets && (
              <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
            )}
          </button>
        ))}
      </div>

      {/* ── Aba: Abrir ticket ───────────────────────────────────────────────── */}
      {activeTab === 'form' && (
        <>
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
              <div className="flex items-center gap-3 mt-1">
                <button
                  onClick={() => setSubmitStatus('idle')}
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  Abrir outro ticket
                </button>
                <button
                  onClick={() => setActiveTab('tickets')}
                  className="text-sm text-primary hover:text-primary/80 transition-colors font-medium"
                >
                  Ver meus tickets →
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Nome</label>
                  <input name="nome" required value={form.nome} onChange={handleChange} placeholder="Seu nome completo" className={field} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">E-mail</label>
                  <input name="email" type="email" required value={form.email} onChange={handleChange} placeholder="seu@email.com" className={field} />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Categoria</label>
                <Select value={form.assunto} onValueChange={v => setForm(p => ({ ...p, assunto: v }))}>
                  <SelectTrigger className="w-full rounded-xl border border-border bg-muted/30 px-3.5 h-auto py-2.5 text-sm text-foreground focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-all">
                    <SelectValue placeholder="Selecione uma categoria..." />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-border">
                    {ASSUNTOS.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Descrição</label>
                <textarea
                  name="mensagem" required rows={5}
                  value={form.mensagem} onChange={handleChange}
                  placeholder="Descreva o problema com o máximo de detalhes possível..."
                  className={cn(field, 'resize-none leading-relaxed')}
                />
              </div>

              <div className="space-y-2">
                {pendingImages.length > 0 && (
                  <div className="flex gap-2 flex-wrap">
                    {pendingImages.map(img => (
                      <ImagePreview key={img.preview} img={img} onRemove={() => removeImage(img.preview)} />
                    ))}
                  </div>
                )}
                {pendingImages.length < MAX_IMAGES && (
                  <>
                    <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple className="hidden" onChange={handleFileChange} />
                    <button
                      type="button"
                      onClick={() => fileRef.current?.click()}
                      className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground border border-dashed border-border hover:border-border/80 rounded-xl px-3.5 py-2.5 transition-colors w-full"
                    >
                      <Paperclip className="h-3.5 w-3.5" />
                      Adicionar imagem
                      <span className="ml-auto text-muted-foreground/50">{pendingImages.length}/{MAX_IMAGES} · max {MAX_SIZE_MB}MB cada</span>
                    </button>
                  </>
                )}
              </div>

              {submitStatus === 'error' && (
                <div className="flex items-start gap-2.5 rounded-xl border border-red-500/20 bg-red-500/6 px-4 py-3 text-sm text-red-500">
                  <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <p>{errorMsg}</p>
                </div>
              )}

              <div className="flex items-center justify-between pt-1">
                <a href="mailto:suporte@zaapply.com.br" className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
                  suporte@zaapply.com.br
                  <ArrowUpRight className="h-3 w-3" />
                </a>
                <button
                  type="submit"
                  disabled={submitStatus === 'loading' || stillUploading || !form.nome || !form.email || !form.assunto || !form.mensagem}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-40"
                >
                  {submitStatus === 'loading' || stillUploading
                    ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />{stillUploading ? 'Enviando imagens...' : 'Enviando...'}</>
                    : <><Send className="h-3.5 w-3.5" />Enviar ticket</>}
                </button>
              </div>
            </form>
          )}
        </>
      )}

      {/* ── Aba: Meus tickets ───────────────────────────────────────────────── */}
      {activeTab === 'tickets' && (
        <div>
          {loadingTickets ? (
            <div className="flex items-center justify-center py-20 rounded-2xl border border-border">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground/50" />
            </div>
          ) : tickets.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border py-20 flex flex-col items-center gap-4 text-center">
              <LifeBuoy className="h-8 w-8 text-muted-foreground/20" />
              <div>
                <p className="text-sm font-medium text-muted-foreground">Nenhum ticket ainda</p>
                <p className="text-xs text-muted-foreground/60 mt-1">Abra um ticket e nossa equipe te ajuda em até 24h.</p>
              </div>
              <button
                onClick={() => setActiveTab('form')}
                className="text-sm text-primary hover:text-primary/80 transition-colors font-medium"
              >
                Abrir um ticket →
              </button>
            </div>
          ) : (
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs text-muted-foreground">{tickets.length} ticket{tickets.length !== 1 ? 's' : ''}</p>
                {repliedCount > 0 && (
                  <p className="text-xs text-green-500 font-medium">{repliedCount} com resposta</p>
                )}
              </div>
              <div className="rounded-2xl border border-border bg-card overflow-hidden">
                {tickets.map(t => <TicketThread key={t.id} ticket={t} />)}
              </div>
              <p className="text-xs text-muted-foreground text-center mt-6 flex items-center justify-center gap-1">
                <MessageSquare className="h-3 w-3" />
                Precisa de mais ajuda?{' '}
                <a href="mailto:suporte@zaapply.com.br" className="text-primary hover:underline ml-1">suporte@zaapply.com.br</a>
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
