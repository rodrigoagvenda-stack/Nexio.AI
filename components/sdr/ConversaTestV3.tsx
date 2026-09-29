'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { RotateCcw, Send } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CARD } from './ui';
import type { CompanyConfig } from '@/lib/sdr/v3/config-types';

interface Msg { from: 'agent' | 'lead' | 'note'; text: string }
type MsgHist = { role: 'user' | 'assistant'; content: string };

/** Chat de teste do SDR v3 com a config atual da tela: nada é gravado nem enviado a ninguém. */
export function ConversaTestV3({ config, agentName }: { config: CompanyConfig; agentName: string }) {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [state, setState] = useState<unknown>(null);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const configRef = useRef(config);
  configRef.current = config;
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ block: 'end' }); }, [msgs, busy]);

  const historicoOf = (list: Msg[]): MsgHist[] => list.filter((m) => m.from !== 'note').map((m) => ({ role: m.from === 'lead' ? 'user' : 'assistant', content: m.text }));

  const send = useCallback(async (text: string, base: Msg[], st: unknown) => {
    const t = text.trim();
    if (!t) return;
    const withLead: Msg[] = [...base, { from: 'lead', text: t }];
    setMsgs(withLead);
    setBusy(true);
    try {
      const res = await fetch('/api/sdr/v3/test', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ config: configRef.current, state: st, leadText: t, historico: historicoOf(base) }) });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success) throw new Error(json.message || 'Não foi possível testar agora.');
      setState(json.state);
      setMsgs([...withLead, ...(json.messages as string[]).map((m): Msg => ({ from: 'agent', text: m })), ...(json.notes as string[]).map((n): Msg => ({ from: 'note', text: n }))]);
    } catch (e) {
      setMsgs([...withLead, { from: 'note', text: e instanceof Error ? e.message : 'Não foi possível testar agora.' }]);
    } finally {
      setBusy(false);
    }
  }, []);

  const restart = useCallback(() => {
    setInput('');
    setState(null);
    setMsgs([{ from: 'note', text: 'Escreva a primeira mensagem do lead pra começar.' }]);
  }, []);
  useEffect(() => { restart(); }, [restart]);

  return (
    <aside className={cn(CARD, 'flex w-full shrink-0 flex-col xl:w-[380px]')}>
      <div className="flex items-start justify-between gap-3 border-b border-border px-6 py-5">
        <div className="flex flex-col gap-1">
          <h3 className="text-lg font-semibold leading-6 text-foreground">Testar agente</h3>
          <p className="text-[13px] text-muted-foreground">Usa a configuração atual desta tela.</p>
        </div>
        <button type="button" onClick={restart} className="flex items-center gap-2 text-sm font-medium text-foreground/85 hover:text-foreground"><RotateCcw className="h-4 w-4" />Reiniciar</button>
      </div>

      <div className="flex min-h-[340px] flex-1 flex-col justify-end gap-3 overflow-y-auto px-6 py-5" aria-live="polite">
        {msgs.map((m, i) => m.from === 'note' ? (
          <p key={i} className="self-center rounded-full bg-muted px-4 py-1.5 text-center text-xs text-muted-foreground">{m.text}</p>
        ) : m.from === 'agent' ? (
          <div key={i} className="max-w-[92%] self-start rounded-xl rounded-tl-sm bg-[#E4F1E9] px-4 py-3 dark:bg-[#12301F]">
            <p className="mb-1 text-xs font-semibold text-[#01573C] dark:text-[#96F63C]">{agentName}</p>
            <p className="whitespace-pre-wrap text-[15px] leading-[150%] text-foreground">{m.text}</p>
          </div>
        ) : (
          <div key={i} className="max-w-[92%] self-end rounded-xl rounded-tr-sm bg-muted px-4 py-3 text-[15px] leading-[150%] text-foreground dark:bg-[#1E1E1E]">{m.text}</div>
        ))}
        {busy && <p className="self-start px-2 text-sm text-muted-foreground">{agentName} está digitando…</p>}
        <div ref={endRef} />
        <p className="pt-1 text-center text-[13px] text-muted-foreground">Responda como o lead para continuar</p>
      </div>

      <form
        className="flex items-center gap-3 border-t border-border px-5 py-4"
        onSubmit={(e) => { e.preventDefault(); if (busy || !input.trim()) return; const t = input; setInput(''); void send(t, msgs, state); }}
      >
        <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Escreva como o lead" aria-label="Mensagem do lead" className="h-11 min-w-0 flex-1 rounded-full border border-border bg-muted px-5 text-[15px] text-foreground outline-none placeholder:text-muted-foreground dark:border-[#2A2A2A] dark:bg-[#181818]" />
        <button type="submit" disabled={busy || !input.trim()} aria-label="Enviar" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#01573C] text-white shadow-[inset_0_1px_0_#FFFFFF26,0_3px_0_#003526] transition-transform active:translate-y-px disabled:opacity-60"><Send className="h-[18px] w-[18px]" /></button>
      </form>
    </aside>
  );
}
