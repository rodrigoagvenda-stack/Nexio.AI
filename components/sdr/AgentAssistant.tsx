'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, Check, ChevronDown, ChevronLeft, ChevronRight, Loader2, Play, Sparkles, X } from 'lucide-react';
import { ZaapliLogo } from '@/components/brand/ZaapliLogo';
import {
  AssistantAnswers, Check as CheckItem, EMPTY_ASSISTANT, FieldDef, PRICE_OPTIONS, STEPS, StepDef, TRIAL_OPTIONS,
  FIXED_RULES, missingRequired, reviewChecks, reviewRows, sanitizeAssistant, stepChecks,
} from '@/lib/sdr/assistant';
import type { SdrVariables } from '@/lib/sdr/templates';

// Assistente de criação do agente de vendas em tela cheia (9 passos, revisão e "criando").
// Layout do Paper. As respostas viram as duas bases do SDR pelo mesmo gerador de sempre.
const SYS = 'system-ui, sans-serif';
const REVIEW = STEPS.length; // índice do passo "Revisão"

interface Props {
  open: boolean;
  onClose: () => void;
  flowId: string | null;
  variables: SdrVariables;
  /** o agente está ligado: a base nova passa a valer nas conversas em andamento */
  agentActive: boolean;
  hasExistingBase: boolean;
  /** mantém o nome do agente da página em sincronia com o passo 1 */
  onAgentName: (name: string) => void;
  /** a criação terminou no servidor (recarrega as bases e guarda o nome do agente) */
  onBuilt: () => void;
  /** a pessoa terminou: 'test' abre o simulador, 'knowledge' fica na aba Conhecimento */
  onCreated: (target: 'test' | 'knowledge') => void;
}

type Phase = 'edit' | 'building' | 'done' | 'error';
interface BuildStatus { status: 'running' | 'done' | 'error'; roteiro_done: boolean; objecoes_done: boolean; error: string | null }

/* ───────── peças ───────── */

const box = (extra?: React.CSSProperties): React.CSSProperties => ({ background: '#101010', border: '1px solid #1C1C1C', borderRadius: 20, ...extra });

function PrimaryBtn({ children, onClick, disabled, loading, icon }: { children: React.ReactNode; onClick: () => void; disabled?: boolean; loading?: boolean; icon?: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      className="flex items-center transition-transform active:translate-y-0.5"
      style={{ gap: 8, height: 52, padding: '0 30px', borderRadius: 999, background: '#01573C', boxShadow: '0 3px 0 #013825', color: '#fff', fontFamily: SYS, fontSize: 16, fontWeight: 600, lineHeight: '20px', opacity: disabled ? 0.45 : 1, cursor: disabled ? 'not-allowed' : 'pointer', border: 0 }}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : icon}
      {children}
    </button>
  );
}

function GhostBtn({ children, onClick, icon }: { children: React.ReactNode; onClick: () => void; icon?: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center transition-transform active:translate-y-0.5"
      style={{ gap: 8, height: 48, padding: '0 24px', borderRadius: 999, background: '#141414', border: '1px solid #262626', boxShadow: '0 3px 0 #050505', color: '#fff', fontFamily: SYS, fontSize: 16, fontWeight: 500, lineHeight: '20px' }}
    >
      {icon}
      {children}
    </button>
  );
}

function CheckRow({ c, onFix }: { c: CheckItem; onFix?: (fix: NonNullable<CheckItem['fix']>) => void }) {
  if (c.tone === 'ok') {
    return (
      <div className="flex items-start" style={{ gap: 12 }}>
        <Check size={18} strokeWidth={2.4} color="#96F63C" style={{ flexShrink: 0, marginTop: 2 }} />
        <div style={{ color: '#D4D4D4', fontSize: 15, lineHeight: '22px' }}>
          {c.title}
          {c.desc && <span style={{ color: '#8A8A8A' }}> {c.desc}</span>}
        </div>
      </div>
    );
  }
  return (
    <div className="flex flex-col" style={{ gap: 8 }}>
      <div className="flex items-start" style={{ gap: 12, padding: '12px 14px', borderRadius: 12, background: '#2A2410', border: '1px solid #4A3F16' }}>
        <AlertCircle size={18} strokeWidth={2.2} color="#E9C46A" style={{ flexShrink: 0, marginTop: 2 }} />
        <div className="flex flex-col" style={{ gap: 4 }}>
          <div style={{ color: '#F3E3B0', fontSize: 15, fontWeight: 600, lineHeight: '22px' }}>{c.title}</div>
          {c.desc && <div style={{ color: '#C9B77A', fontSize: 14, lineHeight: '21px' }}>{c.desc}</div>}
        </div>
      </div>
      {c.fix && onFix && (
        <button type="button" onClick={() => onFix(c.fix!)} className="inline-flex items-center self-start hover:opacity-80" style={{ gap: 6, color: '#96F63C', fontSize: 15, fontWeight: 600, lineHeight: '18px' }}>
          Adicionar essa regra <ChevronRight size={16} strokeWidth={2.2} />
        </button>
      )}
    </div>
  );
}

function TextBox({ f, value, onChange, autoFocus }: { f: FieldDef; value: string; onChange: (v: string) => void; autoFocus?: boolean }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const ta = ref.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = `${Math.max(ta.scrollHeight + 2, 160)}px`;
  }, [value]);
  const short = f.minChars && value.trim().length > 0 && value.trim().length < f.minChars;
  const common: React.CSSProperties = { width: '100%', background: '#101010', border: '1px solid #262626', borderRadius: 12, color: '#fff', fontFamily: SYS, fontSize: 16, lineHeight: '24px', outline: 0 };
  return (
    <div className="flex flex-col" style={{ gap: 8 }}>
      <label style={{ color: '#fff', fontSize: 15, fontWeight: 600, lineHeight: '18px' }}>{f.label}</label>
      {f.kind === 'input' ? (
        <input
          autoFocus={autoFocus}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={f.placeholder}
          maxLength={80}
          className="zl-focus"
          style={{ ...common, height: 52, padding: '0 16px' }}
        />
      ) : (
        <textarea
          ref={ref}
          autoFocus={autoFocus}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={f.placeholder}
          className="zl-focus"
          style={{ ...common, padding: '14px 16px', minHeight: 160, resize: 'vertical', overflow: 'hidden' }}
        />
      )}
      {short && <div style={{ color: '#E9C46A', fontSize: 13, lineHeight: '16px' }}>Detalhe mais para melhores resultados.</div>}
    </div>
  );
}

/* ───────── passo Preço ───────── */

function PriceStep({ a, set }: { a: AssistantAnswers; set: (patch: Partial<AssistantAnswers>) => void }) {
  const needsValue = a.priceRule === 'ask' || a.priceRule === 'now';
  const inputStyle: React.CSSProperties = { width: '100%', height: 52, padding: '0 16px', background: '#101010', border: '1px solid #262626', borderRadius: 12, color: '#fff', fontFamily: SYS, fontSize: 16, outline: 0 };
  return (
    <>
      <div className="flex flex-col" style={{ gap: 12 }} role="radiogroup" aria-label="Regra de preço">
        {PRICE_OPTIONS.map((o) => {
          const on = a.priceRule === o.id;
          return (
            <button
              key={o.id}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => set({ priceRule: o.id })}
              className="flex text-left transition-colors"
              style={{ gap: 16, padding: 20, borderRadius: 16, background: on ? '#12301F' : '#101010', border: on ? '1.5px solid #01573C' : '1px solid #1C1C1C' }}
            >
              <span className="flex items-center justify-center flex-shrink-0" style={{ width: 22, height: 22, borderRadius: 11, marginTop: 2, border: `2px solid ${on ? '#96F63C' : '#333'}` }}>
                {on && <span style={{ width: 10, height: 10, borderRadius: 5, background: '#96F63C' }} />}
              </span>
              <span className="flex flex-col flex-1" style={{ gap: 6 }}>
                <span className="flex items-center flex-wrap" style={{ gap: 10 }}>
                  <span style={{ color: '#fff', fontSize: 18, fontWeight: 600, lineHeight: '22px' }}>{o.title}</span>
                  {o.recommended && <span style={{ background: '#0C1F14', color: '#96F63C', borderRadius: 999, padding: '3px 10px', fontSize: 12, fontWeight: 600, lineHeight: '16px' }}>Recomendado</span>}
                </span>
                <span style={{ color: on ? '#B8C9BE' : '#A3A3A3', fontSize: 15, lineHeight: '23px' }}>{o.desc}</span>
              </span>
            </button>
          );
        })}
      </div>

      {a.priceRule === 'ask' && (
        <div className="flex flex-col" style={{ gap: 8 }}>
          <label style={{ color: '#fff', fontSize: 15, fontWeight: 600, lineHeight: '18px' }}>Que pergunta ela faz antes?</label>
          <input value={a.priceQuestion} onChange={(e) => set({ priceQuestion: e.target.value })} placeholder="Ex: Quanto você investe hoje por mês em anúncios?" maxLength={200} className="zl-focus" style={inputStyle} />
        </div>
      )}
      {needsValue && (
        <div className="flex flex-col sm:flex-row" style={{ gap: 16 }}>
          <div className="flex flex-col flex-1" style={{ gap: 8 }}>
            <label style={{ color: '#fff', fontSize: 15, fontWeight: 600, lineHeight: '18px' }}>Valor ou faixa</label>
            <input value={a.priceValue} onChange={(e) => set({ priceValue: e.target.value })} placeholder="Ex: A partir de R$ 1.500 por mês" maxLength={200} className="zl-focus" style={inputStyle} />
          </div>
          <div className="flex flex-col flex-1" style={{ gap: 8 }}>
            <label style={{ color: '#fff', fontSize: 15, fontWeight: 600, lineHeight: '18px' }}>Tem teste ou desconto?</label>
            <div className="relative">
              <select value={a.priceTrial} onChange={(e) => set({ priceTrial: e.target.value as AssistantAnswers['priceTrial'] })} className="zl-focus" style={{ ...inputStyle, appearance: 'none', paddingRight: 40 }}>
                {TRIAL_OPTIONS.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
              </select>
              <ChevronDown size={16} color="#A3A3A3" style={{ position: 'absolute', right: 16, top: 18, pointerEvents: 'none' }} />
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/** Amostra montada só com o que a pessoa escreveu neste passo (não é a resposta real gerada pela IA). */
function PricePreview({ a, agent }: { a: AssistantAnswers; agent: string }) {
  const value = a.priceValue.trim() || 'o valor que você definir';
  const first =
    a.priceRule === 'ask' ? `Te passo sim! Antes, me conta: ${a.priceQuestion.trim() || 'a sua pergunta aparece aqui'}`
    : a.priceRule === 'now' ? `São ${value}.${a.priceTrial === 'trial' ? ' E você pode testar antes.' : ''}`
    : a.priceRule === 'never' ? 'O valor é passado por uma pessoa da equipe. Posso te levar para uma conversa rápida?'
    : 'Escolha uma regra ao lado para ver o exemplo.';
  const bubbleUser: React.CSSProperties = { alignSelf: 'flex-end', background: '#1A1A1A', borderRadius: '16px 16px 4px 16px', padding: '12px 16px', maxWidth: 280, color: '#fff', fontSize: 15, lineHeight: '22px' };
  const bubbleAgent: React.CSSProperties = { alignSelf: 'flex-start', background: '#12301F', borderRadius: '16px 16px 16px 4px', padding: '12px 16px', maxWidth: 340, display: 'flex', flexDirection: 'column', gap: 4 };
  return (
    <div style={box()}>
      <div style={{ padding: '20px 24px', borderBottom: '1px solid #1C1C1C' }}>
        <div style={{ color: '#fff', fontSize: 18, fontWeight: 600, lineHeight: '22px' }}>{`Como ${agent || 'o agente'} vai responder`}</div>
        <div style={{ color: '#A3A3A3', fontSize: 14, lineHeight: '21px', marginTop: 4 }}>Prévia com o que você escreveu neste passo. Ninguém recebe isto.</div>
      </div>
      <div className="flex flex-col" style={{ gap: 14, padding: 24 }}>
        <div style={bubbleUser}>Oi, quanto custa?</div>
        <div style={bubbleAgent}>
          <span style={{ color: '#96F63C', fontSize: 12, fontWeight: 600, lineHeight: '16px' }}>{a.agentName.trim() || 'Agente'}</span>
          <span style={{ color: '#fff', fontSize: 15, lineHeight: '22px' }}>{first}</span>
        </div>
        {a.priceRule === 'ask' && a.priceQuestion.trim() && (
          <>
            <div style={bubbleUser}>(o lead responde)</div>
            <div style={bubbleAgent}>
              <span style={{ color: '#96F63C', fontSize: 12, fontWeight: 600, lineHeight: '16px' }}>{a.agentName.trim() || 'Agente'}</span>
              <span style={{ color: '#fff', fontSize: 15, lineHeight: '22px' }}>{`Boa. ${value.charAt(0).toUpperCase()}${value.slice(1)}. Quer que eu monte uma proposta?`}</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ───────── componente principal ───────── */

export function AgentAssistant({ open, onClose, flowId, variables, agentActive, hasExistingBase, onAgentName, onBuilt, onCreated }: Props) {
  const draftKey = flowId ? `sdr_assistant_v1_${flowId}` : null;
  const [a, setA] = useState<AssistantAnswers>(EMPTY_ASSISTANT);
  const [step, setStep] = useState(0);
  const [phase, setPhase] = useState<Phase>('edit');
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [build, setBuild] = useState<BuildStatus | null>(null);
  const [starting, setStarting] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const loadedRef = useRef(false);

  // Abre com o rascunho salvo neste navegador
  useEffect(() => {
    if (!open) { loadedRef.current = false; return; }
    if (loadedRef.current) return;
    loadedRef.current = true;
    let draft = EMPTY_ASSISTANT;
    try { const raw = draftKey ? localStorage.getItem(draftKey) : null; if (raw) draft = sanitizeAssistant(JSON.parse(raw)); } catch { /* sem rascunho */ }
    if (!draft.agentName && variables.nome_agente) draft = { ...draft, agentName: variables.nome_agente };
    setA(draft);
    setStep(0); setPhase('edit'); setError(''); setBuild(null);
  }, [open, draftKey, variables.nome_agente]);

  // Trava a rolagem da página por baixo
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  // Autosave do rascunho
  useEffect(() => {
    if (!open || !draftKey || !loadedRef.current) return;
    setSaved(false);
    const t = setTimeout(() => {
      try { localStorage.setItem(draftKey, JSON.stringify(a)); setSaved(true); } catch { /* armazenamento bloqueado */ }
    }, 400);
    return () => clearTimeout(t);
  }, [a, open, draftKey]);

  const set = useCallback((patch: Partial<AssistantAnswers>) => {
    setA((prev) => ({ ...prev, ...patch }));
    if (patch.agentName !== undefined) onAgentName(patch.agentName);
  }, [onAgentName]);

  const missing = useMemo(() => missingRequired(a), [a]);
  const stepDef: StepDef | null = step < REVIEW ? STEPS[step] : null;
  const stepMissing = stepDef ? missing.filter((m) => m.step === stepDef.id) : [];
  const agentLabel = a.agentName.trim();

  function stepDone(i: number) {
    const s = STEPS[i];
    if (!missing.some((m) => m.step === s.id)) {
      // passos sem campo obrigatório só contam como feitos depois de passar por eles
      const optionalOnly = !s.fields.some((f) => f.required) && s.id !== 'preco';
      return optionalOnly ? i < step : true;
    }
    return false;
  }

  const startBuild = async () => {
    if (!flowId) { setError('Salve a configuração do SDR antes de criar o agente.'); return; }
    setStarting(true); setError('');
    try {
      const res = await fetch(`/api/sdr/flows/${flowId}/agent/build`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers: a, variables }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Erro ${res.status}`);
      setPhase('building');
      setBuild({ status: 'running', roteiro_done: false, objecoes_done: false, error: null });
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = setInterval(async () => {
        try {
          const r = await fetch(`/api/sdr/flows/${flowId}/agent/build?id=${data.buildId}`);
          if (!r.ok) return;
          const s = (await r.json()) as BuildStatus;
          setBuild(s);
          if (s.status === 'done') { if (pollRef.current) clearInterval(pollRef.current); setPhase('done'); onBuilt(); if (draftKey) { try { localStorage.removeItem(draftKey); } catch { /* ok */ } } }
          if (s.status === 'error') { if (pollRef.current) clearInterval(pollRef.current); setPhase('error'); setError(s.error || 'Não foi possível criar o agente.'); }
        } catch { /* tenta de novo no próximo ciclo */ }
      }, 2000);
    } catch (e: any) {
      setError(e.message || 'Não foi possível iniciar a criação.');
    } finally {
      setStarting(false);
    }
  };

  const exit = () => {
    if (pollRef.current) clearInterval(pollRef.current);
    onClose();
  };

  if (!open) return null;

  const checks = stepDef ? stepChecks(stepDef.id, a) : reviewChecks(a);
  const onFix = (fix: NonNullable<CheckItem['fix']>) => { if (fix === 'lockOtherService') set({ lockOtherService: true }); };
  const kicker = phase === 'edit' ? (stepDef ? `Passo ${step + 1} de ${STEPS.length}` : 'Último passo') : '';

  /* ───── criando e pronto ───── */
  if (phase !== 'edit') {
    const roteiro = !!build?.roteiro_done;
    const objecoes = !!build?.objecoes_done;
    const done = phase === 'done';
    const pct = done ? 100 : 10 + (roteiro ? 40 : 0) + (objecoes ? 40 : 0);
    const item = (label: string, state: 'done' | 'running' | 'pending') => (
      <div className="flex items-center" style={{ gap: 14 }}>
        {state === 'done' ? (
          <span className="flex items-center justify-center flex-shrink-0" style={{ width: 26, height: 26, borderRadius: 13, background: '#12301F' }}><Check size={14} strokeWidth={3} color="#96F63C" /></span>
        ) : state === 'running' ? (
          <span className="animate-spin flex-shrink-0" style={{ width: 26, height: 26, borderRadius: 13, border: '2.5px solid #1C1C1C', borderTopColor: '#96F63C' }} />
        ) : (
          <span className="flex-shrink-0" style={{ width: 26, height: 26, borderRadius: 13, border: '1.5px solid #262626' }} />
        )}
        <span style={{ color: state === 'done' ? '#A3A3A3' : state === 'running' ? '#fff' : '#737373', fontWeight: state === 'running' ? 600 : 400, fontSize: 16, lineHeight: '20px' }}>{label}</span>
      </div>
    );
    return (
      <Shell onExit={exit} saved={false} building>
        <div className="flex flex-1 flex-col lg:flex-row justify-center overflow-y-auto" style={{ gap: 48, padding: '56px 48px' }}>
          <div className="flex flex-col w-full lg:w-[640px] lg:flex-shrink-0" style={box({ gap: 28, padding: 40, borderRadius: 24, alignSelf: 'flex-start' })}>
            <div className="flex flex-col" style={{ gap: 10 }}>
              <div style={{ color: '#737373', fontSize: 12, fontWeight: 600, letterSpacing: '0.12em', lineHeight: '16px' }}>ENQUANTO CRIA</div>
              <div style={{ color: '#fff', fontSize: 32, fontWeight: 600, letterSpacing: '-0.02em', lineHeight: '40px' }}>{phase === 'error' ? 'Não deu para criar' : `Criando ${agentLabel ? `o agente ${agentLabel}` : 'o agente'}`}</div>
              <div style={{ color: '#A3A3A3', fontSize: 16, lineHeight: '24px' }}>
                {phase === 'error' ? error : 'Leva cerca de 1 minuto. Pode sair desta tela, avisamos quando terminar.'}
              </div>
            </div>
            {phase !== 'error' && (
              <>
                <div style={{ height: 6, borderRadius: 3, background: '#1C1C1C' }}><div style={{ height: 6, borderRadius: 3, background: '#96F63C', width: `${pct}%`, transition: 'width .6s ease' }} /></div>
                <div className="flex flex-col" style={{ gap: 18 }}>
                  {item('Lendo suas respostas', 'done')}
                  {item('Escrevendo o roteiro da conversa', roteiro ? 'done' : 'running')}
                  {item('Montando as respostas para objeções', objecoes ? 'done' : 'running')}
                  {item('Conferindo o resultado', done ? 'done' : roteiro && objecoes ? 'running' : 'pending')}
                </div>
              </>
            )}
            {phase === 'error' && (
              <div className="flex" style={{ gap: 12 }}>
                <PrimaryBtn onClick={() => { setPhase('edit'); setStep(REVIEW); setError(''); }}>Voltar e tentar de novo</PrimaryBtn>
              </div>
            )}
          </div>

          {phase !== 'error' && (
            <div className="flex flex-col w-full lg:w-[640px] lg:flex-shrink-0" style={box({ gap: 28, padding: 40, borderRadius: 24, alignSelf: 'flex-start', opacity: done ? 1 : 0.55, transition: 'opacity .4s' })}>
              <div className="flex flex-col" style={{ gap: 14 }}>
                <div style={{ color: '#737373', fontSize: 12, fontWeight: 600, letterSpacing: '0.12em', lineHeight: '16px' }}>QUANDO TERMINA</div>
                <span className="flex items-center justify-center" style={{ width: 56, height: 56, borderRadius: 28, background: '#12301F' }}><Check size={28} strokeWidth={2.6} color="#96F63C" /></span>
                <div style={{ color: '#fff', fontSize: 32, fontWeight: 600, letterSpacing: '-0.02em', lineHeight: '40px' }}>{agentLabel ? `O agente ${agentLabel} está pronto` : 'O agente está pronto'}</div>
                <div style={{ color: '#A3A3A3', fontSize: 16, lineHeight: '24px' }}>
                  {agentActive
                    ? 'A base nova já vale nas conversas em andamento. Teste para conferir e corrija o que quiser.'
                    : 'Ele ainda não fala com clientes. Teste primeiro, corrija o que quiser e só então publique.'}
                </div>
              </div>
              <div className="flex flex-wrap" style={{ gap: 12 }}>
                <PrimaryBtn onClick={() => { exit(); onCreated('test'); }} disabled={!done} icon={<Play size={18} strokeWidth={2} />}>Testar o agente</PrimaryBtn>
                <GhostBtn onClick={() => { exit(); onCreated('knowledge'); }}>Ver o que ele sabe</GhostBtn>
              </div>
              <div className="flex items-start" style={{ gap: 12, padding: '14px 16px', borderRadius: 12, background: '#0F1A24', border: '1px solid #1D3346' }}>
                <AlertCircle size={18} strokeWidth={2.2} color="#6AB0F3" style={{ flexShrink: 0, marginTop: 2 }} />
                <div style={{ color: '#B7D4EE', fontSize: 15, lineHeight: '22px' }}>Os avisos da revisão continuam visíveis na aba Conhecimento, para você corrigir quando quiser.</div>
              </div>
            </div>
          )}
        </div>
      </Shell>
    );
  }

  /* ───── passos e revisão ───── */
  return (
    <Shell onExit={exit} saved={saved}>
      <div className="flex flex-1 flex-col xl:flex-row overflow-y-auto" style={{ gap: 56, padding: '40px 48px' }}>
        {/* lista de passos */}
        <nav className="hidden xl:flex flex-col flex-shrink-0" style={{ width: 340, gap: 4 }} aria-label="Passos">
          <div style={{ padding: '0 16px 12px', color: '#737373', fontSize: 12, fontWeight: 600, letterSpacing: '0.12em', lineHeight: '16px' }}>{STEPS.length} PASSOS</div>
          {STEPS.map((s, i) => {
            const current = i === step;
            const done = !current && stepDone(i);
            return (
              <button key={s.id} type="button" onClick={() => setStep(i)} className="flex items-center text-left transition-colors hover:bg-white/[0.03]" style={{ gap: 14, padding: current ? '14px 16px' : '12px 16px', borderRadius: 14, background: current ? '#12301F' : 'transparent' }}>
                <span className="flex items-center justify-center flex-shrink-0" style={{ width: 26, height: 26, borderRadius: 13, background: current ? '#01573C' : done ? '#12301F' : 'transparent', border: current || done ? 0 : '1.5px solid #262626', color: current ? '#fff' : '#737373', fontSize: 13, fontWeight: current ? 700 : 600 }}>
                  {done ? <Check size={14} strokeWidth={3} color="#96F63C" /> : i + 1}
                </span>
                <span style={{ color: current ? '#fff' : done ? '#A3A3A3' : '#737373', fontSize: 16, fontWeight: current ? 600 : 400, lineHeight: '20px' }}>{s.label}</span>
              </button>
            );
          })}
          <button type="button" onClick={() => setStep(REVIEW)} className="flex items-center text-left transition-colors hover:bg-white/[0.03]" style={{ gap: 14, padding: '12px 16px', borderRadius: 14, background: step === REVIEW ? '#12301F' : 'transparent' }}>
            <span className="flex items-center justify-center flex-shrink-0" style={{ width: 26, height: 26, borderRadius: 13, background: step === REVIEW ? '#01573C' : 'transparent', border: step === REVIEW ? 0 : '1.5px solid #262626' }}>
              <Sparkles size={13} color={step === REVIEW ? '#fff' : '#737373'} />
            </span>
            <span style={{ color: step === REVIEW ? '#fff' : '#737373', fontSize: 16, fontWeight: step === REVIEW ? 600 : 400, lineHeight: '20px' }}>Revisão</span>
          </button>
          <div style={{ borderTop: '1px solid #1C1C1C', marginTop: 28, padding: 16, color: '#737373', fontSize: 14, lineHeight: '22px' }}>
            Você pode voltar em qualquer passo. Nada é enviado a clientes antes de você testar e publicar.
          </div>
        </nav>

        {/* centro */}
        <div className="flex flex-col flex-1 min-w-0" style={{ gap: 28, maxWidth: 820 }}>
          {stepDef ? (
            <>
              <div className="flex flex-col" style={{ gap: 12 }}>
                <div className="xl:hidden" style={{ color: '#737373', fontSize: 13, lineHeight: '16px' }}>{stepDef.label}</div>
                <div style={{ color: '#96F63C', fontSize: 14, fontWeight: 600, lineHeight: '18px' }}>{kicker}</div>
                <h1 style={{ margin: 0, color: '#fff', fontSize: 40, fontWeight: 600, letterSpacing: '-0.02em', lineHeight: '46px' }}>{stepDef.title(agentLabel)}</h1>
                <p style={{ margin: 0, color: '#A3A3A3', fontSize: 17, lineHeight: '26px' }}>{stepDef.subtitle}</p>
              </div>
              {stepDef.id === 'preco' ? <PriceStep a={a} set={set} /> : (
                <div className="flex flex-col" style={{ gap: 24 }}>
                  {stepDef.fields.map((f, i) => (
                    <TextBox key={`${stepDef.id}-${f.key}`} f={f} value={String(a[f.key])} onChange={(v) => set({ [f.key]: v } as Partial<AssistantAnswers>)} autoFocus={i === 0} />
                  ))}
                </div>
              )}
              {stepDef.id === 'regras' && (
                <div style={box({ padding: 24 })}>
                  <div style={{ color: '#fff', fontSize: 16, fontWeight: 600, lineHeight: '20px', marginBottom: 12 }}>Regras que o Zaapply já inclui</div>
                  <ul className="flex flex-col" style={{ gap: 10, margin: 0, padding: 0, listStyle: 'none' }}>
                    {FIXED_RULES.map((r) => (
                      <li key={r} className="flex items-start" style={{ gap: 10, color: '#D4D4D4', fontSize: 15, lineHeight: '22px' }}>
                        <Check size={16} strokeWidth={2.6} color="#96F63C" style={{ flexShrink: 0, marginTop: 3 }} /> {r}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="flex items-center justify-between" style={{ paddingTop: 8 }}>
                {step > 0 ? <GhostBtn onClick={() => setStep(step - 1)} icon={<ChevronLeft size={16} strokeWidth={2} />}>Voltar</GhostBtn> : <span />}
                <div className="flex items-center" style={{ gap: 16 }}>
                  {stepMissing.length > 0 && <span style={{ color: '#8A8A8A', fontSize: 14 }}>Falta: {stepMissing.map((m) => m.label).join(', ')}</span>}
                  <PrimaryBtn onClick={() => setStep(step + 1)} disabled={stepMissing.length > 0} icon={undefined}>
                    Continuar <ChevronRight size={16} strokeWidth={2.2} />
                  </PrimaryBtn>
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="flex flex-col" style={{ gap: 12 }}>
                <div style={{ color: '#96F63C', fontSize: 14, fontWeight: 600, lineHeight: '18px' }}>Último passo</div>
                <h1 style={{ margin: 0, color: '#fff', fontSize: 40, fontWeight: 600, letterSpacing: '-0.02em', lineHeight: '46px' }}>{`Confira e crie ${agentLabel ? `o agente ${agentLabel}` : 'o agente'}`}</h1>
                <p style={{ margin: 0, color: '#A3A3A3', fontSize: 17, lineHeight: '26px' }}>
                  {agentActive ? 'A base nova substitui a atual e passa a valer nas conversas em andamento.' : 'Você ainda testa tudo antes de ele falar com um cliente de verdade.'}
                </p>
              </div>
              <div className="flex flex-col" style={box()}>
                {reviewRows(a).map((r, i, arr) => (
                  <div key={r.step} className="flex items-center" style={{ gap: 16, padding: '18px 24px', borderBottom: i < arr.length - 1 ? '1px solid #1C1C1C' : 0 }}>
                    <span className="hidden sm:block flex-shrink-0" style={{ width: 190, color: '#737373', fontSize: 14, lineHeight: '18px' }}>{r.label}</span>
                    <span className="flex-1 min-w-0 truncate" style={{ color: '#fff', fontSize: 16, lineHeight: '20px' }}>{r.value}</span>
                    <button type="button" onClick={() => setStep(STEPS.findIndex((s) => s.id === r.step))} className="hover:opacity-80" style={{ color: '#96F63C', fontSize: 14, fontWeight: 600, lineHeight: '18px' }}>Editar</button>
                  </div>
                ))}
              </div>
              {missing.length > 0 && (
                <div className="flex items-start" style={{ gap: 12, padding: '14px 16px', borderRadius: 12, background: '#2B1414', border: '1px solid #5A2323' }}>
                  <AlertCircle size={18} color="#F87171" strokeWidth={2.2} style={{ flexShrink: 0, marginTop: 2 }} />
                  <div style={{ color: '#FCA5A5', fontSize: 15, lineHeight: '22px' }}>
                    Falta preencher: {missing.map((m, i) => (
                      <span key={`${m.step}-${m.label}`}>
                        <button type="button" onClick={() => setStep(STEPS.findIndex((s) => s.id === m.step))} className="underline underline-offset-2">{m.label}</button>{i < missing.length - 1 ? ', ' : ''}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {error && <div style={{ color: '#FCA5A5', fontSize: 15 }}>{error}</div>}
              <div className="flex items-center justify-between">
                <GhostBtn onClick={() => setStep(STEPS.length - 1)} icon={<ChevronLeft size={16} strokeWidth={2} />}>Voltar</GhostBtn>
                <PrimaryBtn onClick={startBuild} disabled={missing.length > 0} loading={starting} icon={<Sparkles size={18} color="#96F63C" strokeWidth={2} />}>
                  {agentLabel ? `Criar o agente ${agentLabel}` : 'Criar o agente'}
                </PrimaryBtn>
              </div>
            </>
          )}
        </div>

        {/* direita */}
        <aside className="flex flex-col xl:flex-shrink-0 xl:w-[460px]" style={{ gap: 20 }}>
          {stepDef?.id === 'preco' && <PricePreview a={a} agent={agentLabel} />}
          {stepDef && stepDef.id !== 'preco' && stepDef.fields.some((f) => f.example) && (
            <div style={box({ padding: '22px 24px' })}>
              <div style={{ color: '#fff', fontSize: 16, fontWeight: 600, lineHeight: '20px', marginBottom: 12 }}>Exemplo de resposta bem preenchida</div>
              <pre style={{ margin: 0, color: '#A3A3A3', fontFamily: SYS, fontSize: 14, lineHeight: '21px', whiteSpace: 'pre-wrap', maxHeight: 280, overflowY: 'auto' }}>
                {stepDef.fields.filter((f) => f.example).map((f) => (stepDef.fields.length > 1 ? `${f.label}\n${f.example}` : f.example)).join('\n\n')}
              </pre>
            </div>
          )}
          <div style={box({ padding: '22px 24px', display: 'flex', flexDirection: 'column', gap: 14 })}>
            <div style={{ color: '#fff', fontSize: stepDef ? 16 : 18, fontWeight: 600, lineHeight: stepDef ? '20px' : '22px' }}>{stepDef ? 'Conferência deste passo' : 'Antes de criar'}</div>
            {!stepDef && <div style={{ color: '#A3A3A3', fontSize: 14, lineHeight: '21px' }}>São pontos que costumam fazer um agente errar com cliente de verdade. Você pode criar mesmo com avisos.</div>}
            {(hasExistingBase || agentActive) && !stepDef && (
              <div className="flex items-start" style={{ gap: 12, padding: '12px 14px', borderRadius: 12, background: '#2A2410', border: '1px solid #4A3F16' }}>
                <AlertCircle size={18} strokeWidth={2.2} color="#E9C46A" style={{ flexShrink: 0, marginTop: 2 }} />
                <div style={{ color: '#F3E3B0', fontSize: 14, lineHeight: '21px' }}>Criar agora substitui a base atual inteira, incluindo qualquer correção feita pelo simulador desde a última criação.</div>
              </div>
            )}
            {checks.map((c, i) => <CheckRow key={`${c.title}-${i}`} c={c} onFix={onFix} />)}
          </div>
        </aside>
      </div>
      <style>{`.zl-focus:focus { border-color: #01573C !important; box-shadow: 0 0 0 .5px #01573C, 0 0 0 4px #01573C40; }`}</style>
    </Shell>
  );
}

function Shell({ children, onExit, saved, building }: { children: React.ReactNode; onExit: () => void; saved: boolean; building?: boolean }) {
  return (
    <div className="fixed inset-0 z-[60] flex flex-col" style={{ background: '#0C0C0C', fontFamily: SYS }} role="dialog" aria-modal="true" aria-label="Criar agente de vendas">
      <header className="flex items-center justify-between flex-shrink-0 px-6 lg:px-12" style={{ height: 72, borderBottom: '1px solid #1C1C1C' }}>
        <div className="flex items-center" style={{ gap: 20 }}>
          <ZaapliLogo variant="full" iconSize={28} theme="dark" />
          <span className="hidden sm:block" style={{ width: 1, height: 24, background: '#1C1C1C' }} />
          <span className="hidden sm:block" style={{ color: '#A3A3A3', fontSize: 15, lineHeight: '18px' }}>Criar agente de vendas</span>
        </div>
        <div className="flex items-center" style={{ gap: 20 }}>
          {saved && !building && (
            <span className="hidden sm:flex items-center" style={{ gap: 8, color: '#A3A3A3', fontSize: 14, lineHeight: '18px' }}>
              <Check size={16} strokeWidth={2.2} color="#96F63C" /> Rascunho salvo
            </span>
          )}
          <button type="button" onClick={onExit} className="flex items-center transition-transform active:translate-y-0.5" style={{ gap: 8, height: 40, padding: '0 18px', borderRadius: 999, background: '#141414', border: '1px solid #262626', boxShadow: '0 3px 0 #050505', color: '#fff', fontSize: 14, fontWeight: 500, lineHeight: '18px' }}>
            <X size={16} strokeWidth={2} /> Sair
          </button>
        </div>
      </header>
      {children}
    </div>
  );
}
