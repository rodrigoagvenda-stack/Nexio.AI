'use client';

import { useState, useEffect, useRef, useCallback, KeyboardEvent } from 'react';
import { cn } from '@/lib/utils/cn';
import {
  ArrowLeft, Trash2, Send, Bot, User, Smile, Paperclip, Mic,
  Check, CheckCheck, RotateCcw, ChevronDown, Settings2,
} from 'lucide-react';
import Link from 'next/link';
import { NICHES, type SdrVariables, type VariableKey } from '@/lib/sdr/templates';

// ─── Types ──────────────────────────────────────────────────────────────────

type MessageRole = 'lead' | 'bot';

interface Message {
  id: string;
  role: MessageRole;
  text: string;
  time: string;
  read: boolean;
}

interface SimHistory {
  role: 'user' | 'assistant';
  content: string;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function uid(): string {
  return Math.random().toString(36).slice(2);
}

function nowTime(): string {
  return new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

// ─── Typing indicator ───────────────────────────────────────────────────────

function TypingDots() {
  return (
    <div className="flex items-end gap-1 px-3.5 py-2.5 bg-white dark:bg-[#1f2c34] rounded-2xl rounded-tl-none shadow-sm w-fit">
      {[0, 1, 2].map(i => (
        <span
          key={i}
          className="w-1.5 h-1.5 rounded-full bg-slate-400 dark:bg-slate-500 animate-bounce"
          style={{ animationDelay: `${i * 0.15}s`, animationDuration: '0.9s' }}
        />
      ))}
    </div>
  );
}

// ─── Message bubble ──────────────────────────────────────────────────────────

function MessageBubble({
  message,
  side,
}: {
  message: Message;
  side: 'outgoing' | 'incoming';
}) {
  const isOut = side === 'outgoing';

  return (
    <div className={cn('flex', isOut ? 'justify-end' : 'justify-start', 'mb-1')}>
      <div
        className={cn(
          'relative max-w-[75%] px-3 py-2 shadow-sm',
          isOut
            ? 'bg-[#dcf8c6] dark:bg-[#005c4b] rounded-2xl rounded-tr-none'
            : 'bg-white dark:bg-[#1f2c34] rounded-2xl rounded-tl-none',
        )}
      >
        {/* Tail shape */}
        {isOut && (
          <div className="absolute top-0 right-[-7px] w-0 h-0
            border-t-[8px] border-t-[#dcf8c6] dark:border-t-[#005c4b]
            border-l-[8px] border-l-transparent" />
        )}
        {!isOut && (
          <div className="absolute top-0 left-[-7px] w-0 h-0
            border-t-[8px] border-t-white dark:border-t-[#1f2c34]
            border-r-[8px] border-r-transparent" />
        )}

        <p className="text-[13.5px] leading-[1.4] text-[#111] dark:text-[#e9edef] break-words whitespace-pre-wrap">
          {message.text}
        </p>

        <div className={cn('flex items-center gap-1 mt-0.5', isOut ? 'justify-end' : 'justify-end')}>
          <span className="text-[10px] text-[#667781] dark:text-[#8696a0]">{message.time}</span>
          {isOut && (
            message.read
              ? <CheckCheck className="h-3 w-3 text-[#53bdeb]" />
              : <Check className="h-3 w-3 text-[#667781] dark:text-[#8696a0]" />
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Chat panel ─────────────────────────────────────────────────────────────

function ChatPanel({
  title,
  subtitle,
  avatarChar,
  avatarColor,
  messages,
  perspective,
  isTyping,
  inputValue,
  onInputChange,
  onSend,
  onKeyDown,
  disabled,
}: {
  title: string;
  subtitle: string;
  avatarChar: string;
  avatarColor: string;
  messages: Message[];
  perspective: MessageRole; // which role is "outgoing" from this panel's POV
  isTyping?: boolean;
  inputValue?: string;
  onInputChange?: (v: string) => void;
  onSend?: () => void;
  onKeyDown?: (e: KeyboardEvent<HTMLTextAreaElement>) => void;
  disabled?: boolean;
}) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [inputValue]);

  const showInput = onInputChange !== undefined;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* WA Header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-[#075e54] flex-shrink-0">
        <div
          className={cn(
            'w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0',
            avatarColor,
          )}
        >
          {avatarChar}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[15px] font-semibold text-white leading-tight truncate">{title}</p>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#25d366] flex-shrink-0" />
            <p className="text-[12px] text-[#c8d9d3] truncate">{subtitle}</p>
          </div>
        </div>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-0.5 scrollbar-minimal chat-background">
        {messages.length === 0 && (
          <div className="flex items-center justify-center h-full">
            <div className="bg-white/80 dark:bg-[#1f2c34]/80 rounded-xl px-4 py-2 text-xs text-[#667781] dark:text-[#8696a0] shadow-sm">
              Nenhuma mensagem ainda
            </div>
          </div>
        )}
        {messages.map(msg => (
          <MessageBubble
            key={msg.id}
            message={msg}
            side={msg.role === perspective ? 'outgoing' : 'incoming'}
          />
        ))}
        {isTyping && (
          <div className="flex justify-start mb-1">
            <TypingDots />
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input bar */}
      {showInput && (
        <div className="flex items-end gap-2 px-3 py-2 bg-[#f0f2f5] dark:bg-[#1f2c34] border-t border-border flex-shrink-0">
          <button className="p-2 text-[#54656f] dark:text-[#8696a0] hover:text-[#3b4a54] transition-colors flex-shrink-0">
            <Smile className="h-5 w-5" />
          </button>
          <button className="p-2 text-[#54656f] dark:text-[#8696a0] hover:text-[#3b4a54] transition-colors flex-shrink-0">
            <Paperclip className="h-5 w-5" />
          </button>

          <div className="flex-1 bg-white dark:bg-[#2a3942] rounded-xl px-3 py-2 flex items-end min-w-0">
            <textarea
              ref={textareaRef}
              rows={1}
              value={inputValue}
              onChange={e => onInputChange?.(e.target.value)}
              onKeyDown={onKeyDown}
              disabled={disabled}
              placeholder="Digite uma mensagem"
              className={cn(
                'flex-1 bg-transparent text-[14px] text-[#3b4a54] dark:text-[#e9edef]',
                'placeholder:text-[#8696a0] resize-none outline-none leading-[1.4] max-h-[120px]',
                'scrollbar-minimal w-full',
                disabled && 'opacity-50 cursor-not-allowed',
              )}
            />
          </div>

          {inputValue && inputValue.trim() ? (
            <button
              onClick={onSend}
              disabled={disabled}
              className={cn(
                'w-10 h-10 rounded-full bg-[#00a884] flex items-center justify-center flex-shrink-0 transition-all',
                'hover:bg-[#008f73] active:scale-95',
                disabled && 'opacity-50 cursor-not-allowed',
              )}
            >
              <Send className="h-5 w-5 text-white" />
            </button>
          ) : (
            <button className="w-10 h-10 rounded-full bg-[#00a884] flex items-center justify-center flex-shrink-0 hover:bg-[#008f73] transition-colors">
              <Mic className="h-5 w-5 text-white" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Config sheet ────────────────────────────────────────────────────────────

const VAR_LABELS: Partial<Record<VariableKey, string>> = {
  nome_agente: 'Nome do agente',
  nome_empresa: 'Nome da empresa',
  descricao_produto: 'Produto / Serviço',
  tom_agente: 'Tom do agente',
  preco: 'Preço',
  periodo_teste: 'Período de teste',
  link_teste: 'Link de teste',
  url_empresa: 'URL da empresa',
  link_agendamento: 'Link de agendamento',
  horario: 'Horário de atendimento',
  endereco: 'Endereço',
  link_playlist: 'Link playlist',
};

function ConfigSheet({
  open,
  onClose,
  selectedNicheId,
  onSelectNiche,
  variables,
  onChangeVar,
}: {
  open: boolean;
  onClose: () => void;
  selectedNicheId: string;
  onSelectNiche: (id: string) => void;
  variables: SdrVariables;
  onChangeVar: (key: VariableKey, value: string) => void;
}) {
  const selectedNiche = NICHES.find(n => n.id === selectedNicheId) ?? NICHES[0];
  const allVars: VariableKey[] = [
    ...selectedNiche.requiredVars,
    ...selectedNiche.optionalVars.filter(v => !selectedNiche.requiredVars.includes(v)),
  ];

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-end bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div
        className="h-full w-96 bg-card border-l border-border shadow-2xl flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-border flex-shrink-0">
          <p className="text-base font-bold text-foreground">Configurar simulação</p>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-accent/50 transition-colors">
            <ChevronDown className="h-4 w-4 text-muted-foreground rotate-[-90deg]" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5 scrollbar-minimal">
          {/* Niche selector */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Nicho / template</p>
            <div className="grid grid-cols-1 gap-1.5 max-h-48 overflow-y-auto scrollbar-minimal">
              {NICHES.map(n => (
                <button
                  key={n.id}
                  onClick={() => onSelectNiche(n.id)}
                  className={cn(
                    'flex items-center gap-2 px-3 py-2 rounded-xl text-left text-sm transition-all border',
                    n.id === selectedNicheId
                      ? 'bg-primary/10 border-primary/30 text-primary font-semibold'
                      : 'bg-muted/40 border-transparent text-foreground hover:border-border hover:bg-accent/40',
                  )}
                >
                  <span className="text-base leading-none">{n.emoji}</span>
                  <div className="min-w-0">
                    <p className="text-xs font-medium leading-tight">{n.label}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{n.description}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Variables */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Variáveis</p>
            <div className="space-y-2">
              {allVars.map(key => {
                const isRequired = selectedNiche.requiredVars.includes(key);
                const label = VAR_LABELS[key] ?? key;
                const isLong = key === 'descricao_produto' || (key as string) === 'restricoes';
                return (
                  <div key={key} className="space-y-1">
                    <label className="text-[11px] font-medium text-muted-foreground">
                      {label}
                      {isRequired && <span className="text-destructive ml-0.5">*</span>}
                    </label>
                    {isLong ? (
                      <textarea
                        rows={3}
                        value={variables[key] ?? ''}
                        onChange={e => onChangeVar(key, e.target.value)}
                        placeholder={`${label}…`}
                        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-primary resize-none"
                      />
                    ) : (
                      <input
                        type="text"
                        value={variables[key] ?? ''}
                        onChange={e => onChangeVar(key, e.target.value)}
                        placeholder={`${label}…`}
                        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-primary"
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main page ───────────────────────────────────────────────────────────────

const MOCK_REPLY = 'Olá! Recebi sua mensagem. Como posso ajudar?';

export default function SimuladorSDRPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [configOpen, setConfigOpen] = useState(false);
  const [selectedNicheId, setSelectedNicheId] = useState(NICHES[0]?.id ?? 'saas');
  const [variables, setVariables] = useState<SdrVariables>({
    nome_agente: 'Sofia',
    nome_empresa: 'Minha Empresa',
    descricao_produto: 'Plataforma de vendas com IA',
    tom_agente: 'profissional e simpático',
  });

  // History for the API (role: user = lead, assistant = bot)
  const historyRef = useRef<SimHistory[]>([]);

  const markAllRead = useCallback(() => {
    setMessages(prev => prev.map(m => ({ ...m, read: true })));
  }, []);

  const sendMessage = useCallback(async () => {
    const text = inputText.trim();
    if (!text || isTyping) return;
    setInputText('');

    const leadMsg: Message = {
      id: uid(),
      role: 'lead',
      text,
      time: nowTime(),
      read: false,
    };
    setMessages(prev => [...prev, leadMsg]);

    // Simulate "read" after a short delay
    setTimeout(() => {
      setMessages(prev =>
        prev.map(m => m.id === leadMsg.id ? { ...m, read: true } : m),
      );
    }, 800);

    // Push to history
    historyRef.current = [...historyRef.current, { role: 'user', content: text }];

    setIsTyping(true);

    // Artificial delay before calling API (feels more human)
    await new Promise(r => setTimeout(r, 1200 + Math.random() * 600));

    try {
      const res = await fetch('/api/sdr/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nicheId: selectedNicheId,
          variables,
          history: historyRef.current.slice(0, -1), // history without current msg
          userMessage: text,
          mode: 'inbound',
        }),
      });

      let replyText = MOCK_REPLY;

      if (res.ok) {
        const data = await res.json();
        replyText = data.reply ?? data.response ?? data.message ?? MOCK_REPLY;
      } else if (res.status === 404) {
        replyText = MOCK_REPLY;
      } else {
        const errData = await res.json().catch(() => ({}));
        replyText = errData.error
          ? `[Erro] ${errData.error}`
          : MOCK_REPLY;
      }

      const botMsg: Message = {
        id: uid(),
        role: 'bot',
        text: replyText,
        time: nowTime(),
        read: false,
      };

      historyRef.current = [...historyRef.current, { role: 'assistant', content: replyText }];

      setMessages(prev => [...prev, botMsg]);
    } catch {
      const botMsg: Message = {
        id: uid(),
        role: 'bot',
        text: MOCK_REPLY,
        time: nowTime(),
        read: false,
      };
      setMessages(prev => [...prev, botMsg]);
    } finally {
      setIsTyping(false);
    }
  }, [inputText, isTyping, selectedNicheId, variables]);

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  function clearConversation() {
    setMessages([]);
    historyRef.current = [];
  }

  function handleNicheSelect(id: string) {
    setSelectedNicheId(id);
    // Preserve existing variables but don't clear — let user fill in
  }

  function handleChangeVar(key: VariableKey, value: string) {
    setVariables(prev => ({ ...prev, [key]: value }));
  }

  const selectedNiche = NICHES.find(n => n.id === selectedNicheId) ?? NICHES[0];

  return (
    <div className="flex flex-col h-full" style={{ height: 'calc(100vh - 80px)' }}>
      {/* ── Top controls ── */}
      <div className="flex items-center justify-between px-1 pb-3 flex-shrink-0">
        <div className="flex items-center gap-3">
          <Link
            href="/configuracoes/sdr"
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Voltar</span>
          </Link>
          <div className="h-4 w-px bg-border" />
          <div>
            <h1 className="text-base font-bold text-foreground flex items-center gap-2">
              <Bot className="h-4 w-4 text-primary" />
              Simulador SDR
            </h1>
            <p className="text-[11px] text-muted-foreground">
              {selectedNiche?.emoji} {selectedNiche?.label}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setConfigOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border hover:bg-accent/50 transition-colors text-sm text-muted-foreground hover:text-foreground"
          >
            <Settings2 className="h-3.5 w-3.5" />
            Configurar
          </button>
          <button
            onClick={clearConversation}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border hover:bg-destructive/10 hover:border-destructive/30 hover:text-destructive transition-colors text-sm text-muted-foreground"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Limpar
          </button>
        </div>
      </div>

      {/* ── Split panels ── */}
      <div className="flex gap-3 flex-1 min-h-0 overflow-hidden">
        {/* Left panel: You (Lead) */}
        <div className="flex-1 flex flex-col rounded-2xl overflow-hidden border border-border shadow-md">
          {/* Panel label */}
          <div className="flex items-center justify-between px-4 py-1.5 bg-[#054640] flex-shrink-0">
            <p className="text-[11px] font-semibold text-[#c8d9d3] uppercase tracking-wider flex items-center gap-1.5">
              <User className="h-3 w-3" />
              Você (Lead)
            </p>
            <p className="text-[10px] text-[#8696a0]">Perspectiva do lead</p>
          </div>
          <ChatPanel
            title="SDR Bot"
            subtitle="online"
            avatarChar="🤖"
            avatarColor="bg-[#128c7e]"
            messages={messages}
            perspective="lead"
            isTyping={false}
            inputValue={inputText}
            onInputChange={setInputText}
            onSend={sendMessage}
            onKeyDown={handleKeyDown}
            disabled={isTyping}
          />
        </div>

        {/* Divider */}
        <div className="flex flex-col items-center justify-center gap-1 flex-shrink-0">
          <div className="h-full w-px bg-border" />
        </div>

        {/* Right panel: SDR Agent */}
        <div className="flex-1 flex flex-col rounded-2xl overflow-hidden border border-border shadow-md">
          {/* Panel label */}
          <div className="flex items-center justify-between px-4 py-1.5 bg-[#054640] flex-shrink-0">
            <p className="text-[11px] font-semibold text-[#c8d9d3] uppercase tracking-wider flex items-center gap-1.5">
              <Bot className="h-3 w-3" />
              Agente SDR
            </p>
            <p className="text-[10px] text-[#8696a0]">Perspectiva do bot</p>
          </div>
          <ChatPanel
            title="Lead Simulado"
            subtitle="online"
            avatarChar="👤"
            avatarColor="bg-slate-500"
            messages={messages}
            perspective="bot"
            isTyping={isTyping}
          />
        </div>
      </div>

      {/* ── Hint bar ── */}
      <div className="flex items-center justify-center pt-2 flex-shrink-0">
        <p className="text-[10px] text-muted-foreground/50">
          Pressione <kbd className="px-1 py-0.5 rounded border border-border bg-muted text-[9px] font-mono">Enter</kbd> para enviar
          · <kbd className="px-1 py-0.5 rounded border border-border bg-muted text-[9px] font-mono">Shift+Enter</kbd> para nova linha
        </p>
      </div>

      {/* Config sheet */}
      <ConfigSheet
        open={configOpen}
        onClose={() => setConfigOpen(false)}
        selectedNicheId={selectedNicheId}
        onSelectNiche={handleNicheSelect}
        variables={variables}
        onChangeVar={handleChangeVar}
      />
    </div>
  );
}
