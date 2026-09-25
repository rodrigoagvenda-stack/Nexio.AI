'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { RotateCcw, Send } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CARD } from './ui';
import { initialState, type FunnelConfig, type FunnelState } from '@/lib/sdr/funnel/types';

interface Msg { from: 'agent' | 'lead' | 'note'; text: string }

export interface TestSeed { n: number; stepId?: string; say?: string }

/** Chat de teste do roteiro em edição: nada é gravado nem enviado a ninguém. */
export function ConversaTest({ draft, agentName, dirty, seed }: { draft: FunnelConfig; agentName: string; dirty: boolean; seed: TestSeed | null }) {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [state, setState] = useState<FunnelState | null>(null);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const draftRef = useRef(draft);
  draftRef.current = draft;
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ block: 'end' }); }, [msgs, busy]);

  const call = useCallback(async (payload: { state: FunnelState | null; leadText: string; transcript: string[] }) => {
    const res = await fetch('/api/sdr/funnel/test', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ config: draftRef.current, ...payload }) });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json.success) throw new Error(json.message || 'Não foi possível testar agora.');
    return json as { messages: string[]; notes: string[]; state: FunnelState };
  }, []);

  const transcriptOf = (list: Msg[]) => list.filter((m) => m.from !== 'note').map((m) => `${m.from === 'lead' ? 'Lead' : 'Equipe'}: ${m.text}`);

  const send = useCallback(async (text: string, base: Msg[], st: FunnelState | null) => {
    const t = text.trim();
    if (!t) return;
    const withLead: Msg[] = [...base, { from: 'lead', text: t }];
    setMsgs(withLead);
    setBusy(true);
    try {
      const out = await call({ state: st, leadText: t, transcript: transcriptOf(base) });
      setState(out.state);
      setMsgs([...withLead, ...out.messages.map((m): Msg => ({ from: 'agent', text: m })), ...out.notes.map((n): Msg => ({ from: 'note', text: n }))]);
    } catch (e) {
      setMsgs([...withLead, { from: 'note', text: e instanceof Error ? e.message : 'Não foi possível testar agora.' }]);
    } finally {
      setBusy(false);
    }
  }, [call]);

  const restart = useCallback(async (opts?: { stepId?: string; say?: string }) => {
    setInput('');
    setBusy(true);
    try {
      let st: FunnelState | null = null;
      let first: Msg[] = [];
      if (opts?.stepId) {
        const step = draftRef.current.steps.find((s) => s.id === opts.stepId);
        st = { ...initialState(), askedStep: opts.stepId, turns: 1 };
        first = step ? [{ from: 'agent', text: step.question.replace(/\{nome\}/gi, '') }] : [];
      } else {
        const out = await call({ state: null, leadText: '', transcript: [] });
        st = out.state;
        first = out.messages.map((m): Msg => ({ from: 'agent', text: m }));
      }
      setState(st);
      setMsgs(first);
      setBusy(false);
      if (opts?.say) await send(opts.say, first, st);
    } catch (e) {
      setMsgs([{ from: 'note', text: e instanceof Error ? e.message : 'Não foi possível testar agora.' }]);
      setBusy(false);
    }
  }, [call, send]);

  useEffect(() => { void restart(seed ? { stepId: seed.stepId, say: seed.say } : undefined); }, [seed]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <aside className={cn(CARD, 'flex w-full shrink-0 flex-col xl:w-[380px]')}>
      <div className="flex items-start justify-between gap-3 border-b border-border px-6 py-5">
        <div className="flex flex-col gap-1">
          <h3 className="text-lg font-semibold leading-6 text-foreground">Testar agente</h3>
          <p className={cn('text-[13px]', dirty ? 'text-[#B7791F] dark:text-[#F5B544]' : 'text-muted-foreground')}>{dirty ? 'Testa a versão não publicada' : 'Testa a versão publicada'}</p>
        </div>
        <button type="button" onClick={() => void restart()} className="flex items-center gap-2 text-sm font-medium text-foreground/85 hover:text-foreground"><RotateCcw className="h-4 w-4" />Reiniciar</button>
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
