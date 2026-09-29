'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { CARD } from './ui';
import type { CompanyConfig } from '@/lib/sdr/v3/config-types';

interface Msg { from: 'agent' | 'lead' | 'note'; text: string }
type MsgHist = { role: 'user' | 'assistant'; content: string };
export interface TestSeedV3 { n: number; perguntaId?: string }

/** Chat de teste do SDR v3 com a config da tela (rascunho incluído): nada é gravado nem enviado a ninguém. */
export function ConversaTestV3({ config, agentName, dirty, seed }: { config: CompanyConfig; agentName: string; dirty: boolean; seed?: TestSeedV3 | null }) {
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

  const restart = useCallback(async (perguntaId?: string) => {
    setInput('');
    const first = [...configRef.current.qualificacao.perguntas].sort((a, b) => a.ordem - b.ordem)[0]?.id;
    const id = perguntaId ?? first;
    if (!id) { setState(null); setMsgs([]); return; }
    setBusy(true);
    try {
      const res = await fetch('/api/sdr/v3/test', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ config: configRef.current, seedPerguntaId: id }) });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success) throw new Error(json.message || 'Não foi possível testar agora.');
      setState(json.state);
      setMsgs((json.messages as string[]).map((m): Msg => ({ from: 'agent', text: m })));
    } catch (e) {
      setState(null);
      setMsgs([{ from: 'note', text: e instanceof Error ? e.message : 'Não foi possível testar agora.' }]);
    } finally {
      setBusy(false);
    }
  }, []);
  useEffect(() => { void restart(seed?.perguntaId); }, [seed]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <aside className={cn(CARD, 'flex w-full shrink-0 flex-col overflow-clip xl:w-[380px]')}>
      <div className="flex shrink-0 items-center justify-between border-b border-border px-5 py-[18px] dark:border-[#1C1C1C]">
        <div className="flex flex-col gap-[3px]">
          <span className="text-[17px] font-semibold leading-[22px] text-foreground">Testar agente</span>
          <span className={cn('text-[13px] leading-4', dirty ? 'text-[#B7791F] dark:text-[#F5B544]' : 'text-muted-foreground')}>{dirty ? 'Testa a versão não publicada' : 'Testa a versão publicada'}</span>
        </div>
        <button type="button" onClick={() => void restart()} className="flex items-center gap-1.5 text-sm font-semibold leading-[18px] text-muted-foreground hover:text-foreground">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" className="shrink-0"><path d="M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
          Reiniciar
        </button>
      </div>

      <div className="flex min-h-[260px] grow basis-0 flex-col justify-end gap-3 overflow-y-auto p-5" aria-live="polite">
        {msgs.map((m, i) => m.from === 'note' ? (
          <p key={i} className="self-center rounded-full bg-muted px-4 py-1.5 text-center text-xs text-muted-foreground">{m.text}</p>
        ) : m.from === 'agent' ? (
          <div key={i} className="flex max-w-[320px] flex-col gap-1.5 self-start rounded-[14px] bg-[#E4F1E9] px-3.5 py-3 dark:bg-[#0F3D2B]">
            <span className="text-xs font-semibold leading-4 text-[#01573C] dark:text-[#96F63C]">{agentName}</span>
            <span className="whitespace-pre-wrap text-[14px] leading-[150%] text-foreground dark:text-white">{m.text}</span>
          </div>
        ) : (
          <div key={i} className="max-w-[320px] self-end rounded-[14px] bg-muted px-3.5 py-3 text-[14px] leading-[150%] text-foreground dark:bg-[#1E1E1E]">{m.text}</div>
        ))}
        {busy && <p className="self-start px-2 text-sm text-muted-foreground">{agentName} está digitando…</p>}
        <div ref={endRef} />
        <p className="text-center text-[13px] leading-4 text-muted-foreground dark:text-[#7A7A7A]">Responda como o lead para continuar</p>
      </div>

      <form
        className="flex shrink-0 items-center gap-2.5 border-t border-border px-5 py-4 dark:border-[#1C1C1C]"
        onSubmit={(e) => { e.preventDefault(); if (busy || !input.trim()) return; const t = input; setInput(''); void send(t, msgs, state); }}
      >
        <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Escreva como o lead" aria-label="Mensagem do lead" className="h-11 min-w-0 grow basis-0 rounded-full border border-border bg-muted px-4 text-sm leading-[18px] text-foreground outline-none placeholder:text-muted-foreground dark:border-[#2A2A2A] dark:bg-[#181818] dark:placeholder:text-[#6A6A6A]" />
        <button type="submit" disabled={busy || !input.trim()} aria-label="Enviar" className="flex size-11 shrink-0 items-center justify-center rounded-full bg-[#01573C] text-white shadow-[inset_0_1px_0_#FFFFFF26,0_3px_0_#003526] transition-transform active:translate-y-px disabled:opacity-60">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="shrink-0"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4z" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
      </form>
    </aside>
  );
}
