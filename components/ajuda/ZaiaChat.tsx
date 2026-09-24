'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Check, Copy, CreditCard, MessageCircle, PhoneOff, RotateCcw, Send, Sparkles, Volume2, VolumeX, X } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  buttons?: string[];
  askFeedback?: boolean;
  timestamp: number;
  isError?: boolean;
}

const WELCOME_BUTTONS = ['CRM e funil', 'Agente IA', 'WhatsApp', 'Planos e preços'];

const RATING_OPTIONS = [
  { label: 'Péssimo', value: 1 },
  { label: 'Ruim', value: 2 },
  { label: 'Ok', value: 3 },
  { label: 'Bom', value: 4 },
  { label: 'Ótimo', value: 5 },
];

const CHAT_STORAGE_KEY = 'zaapply_zaia_chat';
const INACTIVITY_MS = 2 * 60 * 1000;
const CLOSE_DELAY_MS = 30 * 1000;

const LIME = 'text-[#01573C] dark:text-[#96F63C]';
const CHIP = 'rounded-full border border-[#01573C]/30 bg-[#01573C]/10 px-4 py-2 text-[13.5px] font-medium transition-colors hover:bg-[#01573C]/20 disabled:opacity-40 dark:border-[#96F63C]/30 dark:bg-[#96F63C]/[0.08] dark:hover:bg-[#96F63C]/15';
const RATE = 'rounded-[9px] border border-border bg-muted px-3.5 py-[7px] text-[13px] font-medium text-foreground transition-colors hover:border-primary/50';

function playNotifSound() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.06, ctx.currentTime + 0.01);
    gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.15);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.15);
  } catch { /* sem áudio: só não toca o aviso */ }
}

function formatRelativeTime(ts: number): string {
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 60) return 'agora';
  if (diff < 3600) return `${Math.floor(diff / 60)}min`;
  return `${Math.floor(diff / 3600)}h`;
}

function ChatText({ text }: { text: string }) {
  return (
    <>
      {text.split('\n').map((line, i, arr) => {
        const parts = line.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
        return (
          <span key={i}>
            {parts.map((p, j) => {
              if (p.startsWith('**') && p.endsWith('**')) return <strong key={j} className="font-semibold">{p.slice(2, -2)}</strong>;
              if (p.startsWith('`') && p.endsWith('`')) return <code key={j} className="rounded bg-black/10 px-1 font-mono text-[12px] dark:bg-white/10">{p.slice(1, -1)}</code>;
              return <span key={j}>{p}</span>;
            })}
            {i < arr.length - 1 && <br />}
          </span>
        );
      })}
    </>
  );
}

function TypingIndicator() {
  return (
    <div className="flex justify-start">
      <div className="flex items-center gap-1 rounded-[16px_16px_16px_4px] bg-muted px-4 py-3.5">
        {[0, 1, 2].map((i) => (
          <span key={i} className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/60" style={{ animationDelay: `${i * 150}ms` }} />
        ))}
      </div>
    </div>
  );
}

export function ZaiaChat({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [rated, setRated] = useState(false);
  const [failedMsg, setFailedMsg] = useState<string | null>(null);
  const [inactiveWarning, setInactiveWarning] = useState(false);
  const [isEnding, setIsEnding] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [newReply, setNewReply] = useState(false);

  const endRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inactiveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const openRef = useRef(open);
  openRef.current = open;

  useEffect(() => {
    try {
      const saved = localStorage.getItem(CHAT_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        setMessages(parsed.messages ?? []);
        setRated(parsed.rated ?? false);
      }
    } catch { /* histórico ilegível: começa do zero */ }
  }, []);

  useEffect(() => {
    if (messages.length > 0) {
      try { localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify({ messages: messages.slice(-30), rated })); } catch { /* sem armazenamento */ }
    }
  }, [messages, rated]);

  useEffect(() => { if (open) setNewReply(false); }, [open]);

  const isAtBottom = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return true;
    return el.scrollHeight - el.scrollTop - el.clientHeight < 60;
  }, []);

  useEffect(() => {
    if (isAtBottom()) endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading, isAtBottom]);

  const clearInactivityTimers = useCallback(() => {
    if (inactiveTimer.current) clearTimeout(inactiveTimer.current);
    if (closeTimer.current) clearTimeout(closeTimer.current);
  }, []);

  const resetInactivityTimer = useCallback(() => {
    clearInactivityTimers();
    setInactiveWarning(false);
    inactiveTimer.current = setTimeout(() => {
      setInactiveWarning(true);
      closeTimer.current = setTimeout(() => {
        setIsEnding(true);
        setInactiveWarning(false);
      }, CLOSE_DELAY_MS);
    }, INACTIVITY_MS);
  }, [clearInactivityTimers]);

  useEffect(() => {
    if (open && messages.length > 0) resetInactivityTimer();
    return clearInactivityTimers;
  }, [open, messages.length, resetInactivityTimer, clearInactivityTimers]);

  async function send(text?: string) {
    const msg = (text ?? input).trim();
    if (!msg || loading || isEnding) return;
    if (!text) setInput('');
    setFailedMsg(null);
    setInactiveWarning(false);
    const history = messages.slice(-8).map((m) => ({ role: m.role, content: m.content }));
    setMessages((prev) => [...prev, { role: 'user', content: msg, timestamp: Date.now() }]);
    setLoading(true);
    try {
      const res = await fetch('/api/help/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg, history }),
      });
      const data = await res.json();
      setMessages((prev) => [...prev, {
        role: 'assistant',
        content: data.reply || data.error || 'Não consegui responder. Tente novamente.',
        buttons: data.buttons,
        askFeedback: data.askFeedback,
        timestamp: Date.now(),
      }]);
      if (soundEnabled) playNotifSound();
      if (!openRef.current) setNewReply(true);
      resetInactivityTimer();
    } catch {
      setFailedMsg(msg);
      setMessages((prev) => [...prev, { role: 'assistant', content: 'Erro ao conectar. Tente novamente.', timestamp: Date.now(), isError: true }]);
    } finally {
      setLoading(false);
    }
  }

  function handleRate() {
    setRated(true);
    setIsEnding(false);
    clearInactivityTimers();
    setMessages((prev) => [...prev, {
      role: 'assistant',
      content: 'Obrigada pelo feedback! Fico feliz em ajudar. Se surgir mais alguma dúvida, é só chamar.',
      timestamp: Date.now(),
    }]);
  }

  function handleEndChat() {
    clearInactivityTimers();
    setInactiveWarning(false);
    setIsEnding(true);
  }

  function handleClearChat() {
    setMessages([]);
    setRated(false);
    setIsEnding(false);
    setFailedMsg(null);
    setInactiveWarning(false);
    clearInactivityTimers();
    try { localStorage.removeItem(CHAT_STORAGE_KEY); } catch { /* sem armazenamento */ }
  }

  async function copyMessage(content: string, idx: number) {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedId(idx);
      setTimeout(() => setCopiedId(null), 2000);
    } catch { /* sem permissão de área de transferência */ }
  }

  const hasMessages = messages.length > 0;
  const iconBtn = 'rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground';

  return (
    <>
      {/* Botão fechado: só o Z; com o mouse por cima abre em pílula; ponto quando há resposta nova */}
      <div className={cn('fixed bottom-24 right-6 z-50 md:bottom-6', open && 'hidden')}>
        <button
          type="button"
          onClick={() => onOpenChange(true)}
          aria-label="Perguntar para a Zaia"
          className="group relative flex h-[60px] items-center rounded-full bg-[#01573C] pl-2 pr-2 text-white transition-[padding] duration-200 [box-shadow:0_4px_0_0_#013825,0_12px_28px_rgba(0,0,0,0.35)] hover:pr-6 focus-visible:pr-6 active:translate-y-px active:[box-shadow:0_3px_0_0_#013825,0_12px_28px_rgba(0,0,0,0.35)]"
        >
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-transparent text-[26px] font-bold leading-8 text-[#96F63C] transition-colors duration-200 group-hover:bg-[#0C1F14] group-hover:text-[22px] group-focus-visible:bg-[#0C1F14]">Z</span>
          <span className="max-w-0 overflow-hidden whitespace-nowrap text-base font-semibold opacity-0 transition-all duration-200 group-hover:ml-3 group-hover:max-w-[200px] group-hover:opacity-100 group-focus-visible:ml-3 group-focus-visible:max-w-[200px] group-focus-visible:opacity-100">
            Perguntar para a Zaia
          </span>
          {newReply && <span aria-label="Resposta nova" className="absolute -right-0.5 -top-0.5 h-5 w-5 rounded-full border-[3px] border-background bg-[#96F63C]" />}
        </button>
      </div>

      {open && (
        <div
          role="dialog"
          aria-label="Chat com a Zaia"
          className="fixed bottom-24 right-4 z-50 flex h-[540px] max-h-[calc(100vh-7rem)] w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-[18px] border border-border bg-card shadow-[0_24px_60px_rgba(0,0,0,0.45)] sm:w-96 md:bottom-6 md:right-6"
        >
          <div className="flex items-center gap-3 border-b border-border px-[18px] py-3.5">
            <div className="relative shrink-0">
              <div className="flex h-[38px] w-[38px] items-center justify-center rounded-full bg-[#01573C]/10 dark:bg-[#96F63C]/15">
                <Sparkles className={cn('h-[18px] w-[18px]', LIME)} strokeWidth={2} />
              </div>
              <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-card bg-green-500" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-base font-semibold leading-5 text-foreground">Zaia</p>
              <p className="text-[12.5px] leading-4 text-green-600 dark:text-green-500">Online agora</p>
            </div>
            <div className="flex items-center gap-0.5">
              <button type="button" onClick={() => setSoundEnabled((v) => !v)} title={soundEnabled ? 'Silenciar' : 'Ativar som'} aria-label={soundEnabled ? 'Silenciar' : 'Ativar som'} className={iconBtn}>
                {soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
              </button>
              {hasMessages && !isEnding && (
                <button type="button" onClick={handleEndChat} title="Encerrar atendimento" aria-label="Encerrar atendimento" className={iconBtn}><PhoneOff className="h-4 w-4" /></button>
              )}
              {hasMessages && (
                <button type="button" onClick={handleClearChat} title="Nova conversa" aria-label="Nova conversa" className={iconBtn}><RotateCcw className="h-4 w-4" /></button>
              )}
              <button type="button" onClick={() => onOpenChange(false)} title="Fechar" aria-label="Fechar chat" className={iconBtn}><X className="h-[18px] w-[18px]" /></button>
            </div>
          </div>

          <div className="flex-1 space-y-1.5 overflow-y-auto p-[18px]" ref={scrollRef}>
            {!hasMessages && (
              <div className="space-y-3">
                <div className="flex justify-start">
                  <div className="max-w-[320px] rounded-[16px_16px_16px_4px] bg-muted px-4 py-3 text-[15px] leading-normal text-foreground">
                    Olá! Sou a <strong>Zaia</strong>, assistente do Zaapply. Sobre o que você quer saber?
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 pl-1">
                  {WELCOME_BUTTONS.map((btn) => (
                    <button key={btn} type="button" onClick={() => send(btn)} disabled={loading} className={cn(CHIP, LIME)}>{btn}</button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg, i) => (
              <div key={i} className="space-y-1.5">
                <div className={cn('flex', msg.role === 'user' ? 'justify-end' : 'justify-start')}>
                  <div className={cn(
                    'group relative px-4 py-3 text-[15px] leading-normal',
                    msg.role === 'user'
                      ? 'max-w-[260px] rounded-[16px_16px_4px_16px] bg-[#0F3D2B] text-white'
                      : msg.isError
                        ? 'max-w-[320px] rounded-[16px_16px_16px_4px] border border-red-500/20 bg-red-500/10 text-red-600 dark:text-red-400'
                        : 'max-w-[320px] rounded-[16px_16px_16px_4px] bg-muted text-foreground',
                  )}>
                    <ChatText text={msg.content} />
                    {msg.role === 'assistant' && !msg.isError && (
                      <button
                        type="button"
                        onClick={() => copyMessage(msg.content, i)}
                        aria-label="Copiar resposta"
                        className="absolute -right-2 -top-2 hidden h-6 w-6 items-center justify-center rounded-full border border-border bg-card text-muted-foreground shadow-sm hover:text-foreground group-hover:flex"
                      >
                        {copiedId === i ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
                      </button>
                    )}
                  </div>
                </div>
                <p className={cn('px-0.5 text-[11px] leading-[14px] text-muted-foreground/70', msg.role === 'user' ? 'text-right' : 'text-left')}>{formatRelativeTime(msg.timestamp)}</p>

                {msg.role === 'assistant' && msg.buttons && msg.buttons.length > 0 && !isEnding && (
                  <div className="flex flex-wrap gap-2 pl-1">
                    {msg.buttons.map((btn) => (
                      <button key={btn} type="button" onClick={() => send(btn)} disabled={loading} className={cn(CHIP, LIME)}>{btn}</button>
                    ))}
                  </div>
                )}

                {msg.isError && failedMsg && i === messages.length - 1 && (
                  <button
                    type="button"
                    onClick={() => { setMessages((prev) => prev.slice(0, -1)); send(failedMsg); setFailedMsg(null); }}
                    className={cn('ml-1 flex items-center gap-1.5 text-[13px] hover:underline', LIME)}
                  >
                    <RotateCcw className="h-3 w-3" /> Tentar novamente
                  </button>
                )}

                {msg.role === 'assistant' && msg.askFeedback && !rated && i === messages.length - 1 && (
                  <div className="space-y-2.5 px-1 pt-3.5">
                    <p className="text-[13.5px] text-muted-foreground">Como foi esse atendimento?</p>
                    <div className="flex flex-wrap gap-2">
                      {RATING_OPTIONS.map((r) => <button key={r.value} type="button" onClick={handleRate} className={RATE}>{r.label}</button>)}
                    </div>
                  </div>
                )}
              </div>
            ))}

            {inactiveWarning && (
              <div className="flex justify-start">
                <div className="max-w-[320px] rounded-[16px_16px_16px_4px] border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-[15px] text-amber-700 dark:text-amber-400">
                  Ei, você ainda tá aí? Vou encerrar em 30 segundos…
                </div>
              </div>
            )}

            {isEnding && !rated && (
              <div className="space-y-2.5">
                <div className="flex justify-start">
                  <div className="max-w-[320px] rounded-[16px_16px_16px_4px] bg-muted px-4 py-3 text-[15px] text-foreground">Tudo bem! Encerrando por aqui. Como foi esse atendimento?</div>
                </div>
                <div className="flex flex-wrap gap-2 pl-1">
                  {RATING_OPTIONS.map((r) => <button key={r.value} type="button" onClick={handleRate} className={RATE}>{r.label}</button>)}
                </div>
              </div>
            )}

            {loading && <TypingIndicator />}
            <div ref={endRef} />
          </div>

          <div className="flex items-center border-t border-border px-3 py-1.5">
            <a
              href="https://wa.me/5577988650528?text=Ol%C3%A1!%20Gostaria%20de%20saber%20mais%20sobre%20o%20Zaapply"
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-1 items-center justify-center gap-2 rounded-lg p-2 text-[13px] font-medium text-green-700 transition-colors hover:bg-green-500/10 dark:text-green-500"
            >
              <MessageCircle className="h-3.5 w-3.5" strokeWidth={2} /> Falar com especialista
            </a>
            <span className="h-5 w-px shrink-0 bg-border" />
            <a
              href="https://zaapply.com.br/planos"
              target="_blank"
              rel="noopener noreferrer"
              className={cn('flex flex-1 items-center justify-center gap-2 rounded-lg p-2 text-[13px] font-medium transition-colors hover:bg-[#01573C]/10 dark:hover:bg-[#96F63C]/10', LIME)}
            >
              <CreditCard className="h-3.5 w-3.5" strokeWidth={2} /> Ver planos
            </a>
          </div>

          <div className="flex items-center gap-2.5 border-t border-border px-3.5 py-3">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) send(); }}
              placeholder={isEnding ? 'Atendimento encerrado' : 'Digite sua dúvida…'}
              disabled={loading || isEnding}
              aria-label="Sua dúvida"
              className="h-11 flex-1 rounded-xl border border-border bg-muted px-4 text-[14.5px] text-foreground outline-none placeholder:text-muted-foreground/70 focus:border-primary/60 focus:ring-2 focus:ring-primary/20 disabled:opacity-50"
            />
            <button
              type="button"
              onClick={() => send()}
              disabled={!input.trim() || loading || isEnding}
              aria-label="Enviar"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#01573C] text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              <Send className="h-4 w-4" strokeWidth={2.2} />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
