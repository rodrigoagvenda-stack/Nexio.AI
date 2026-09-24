'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, Check, ChevronLeft, ChevronRight, Loader2, Upload } from 'lucide-react';
import { ZaapliLogo } from '@/components/brand/ZaapliLogo';
import { AUTH_FIELD_CSS, FieldBox, FieldLabel, TextInput } from '@/components/auth/auth-ui';
import { ChecklistItem, GOALS, Goal, MAX_GOALS, PLANS, PlanIntent, buildChecklist } from '@/lib/onboarding/model';

// Onboarding em 4 passos: 1 Empresa, 2 Objetivo, 3 Plano, 4 Tudo certo.
// Os passos 1 a 3 cabem na tela; ao clicar em "Continuar para o pagamento" a empresa é criada e a pessoa
// vai pagar em Configuração > Plano. Depois do pagamento o painel a traz de volta aqui, no passo 4.
const SYS = 'system-ui, sans-serif';
const TOTAL = 4;
const SEGMENTS = ['Tecnologia', 'Saúde', 'Educação', 'Varejo', 'Imóveis', 'Serviços', 'Financeiro', 'Outro'];

type Stage = 'loading' | 'form' | 'finish';

const initialsOf = (name: string) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase() || 'Z';

/* ───────── peças ───────── */

function ProgressBar({ step }: { step: number }) {
  return (
    <div style={{ height: 4, background: '#1C1C1C' }}>
      <div style={{ height: '100%', width: `${(step / TOTAL) * 100}%`, background: '#96F63C', transition: 'width .4s ease' }} />
    </div>
  );
}

function Header({ step }: { step: number }) {
  return (
    <header className="flex items-center justify-between px-6 lg:px-12" style={{ height: 72, borderBottom: '1px solid #1C1C1C' }}>
      <ZaapliLogo variant="full" iconSize={28} theme="dark" />
      <div style={{ color: '#A3A3A3', fontFamily: SYS, fontSize: 15, lineHeight: '18px' }}>Passo {step} de {TOTAL}</div>
    </header>
  );
}

function Heading({ title, sub }: { title: string; sub: string }) {
  return (
    <div className="flex flex-col" style={{ gap: 12 }}>
      <h1 style={{ margin: 0, color: '#fff', fontFamily: SYS, fontSize: 40, fontWeight: 600, letterSpacing: '-0.02em', lineHeight: '46px' }}>{title}</h1>
      <p style={{ margin: 0, color: '#A3A3A3', fontFamily: SYS, fontSize: 17, lineHeight: '26px' }}>{sub}</p>
    </div>
  );
}

function SideLabel({ children }: { children: React.ReactNode }) {
  return <div style={{ color: '#737373', fontFamily: SYS, fontSize: 12, fontWeight: 600, letterSpacing: '0.12em', lineHeight: '16px' }}>{children}</div>;
}

function SideNote({ children }: { children: React.ReactNode }) {
  return <div style={{ color: '#737373', fontFamily: SYS, fontSize: 14, lineHeight: '22px' }}>{children}</div>;
}

function PrimaryBtn({ children, onClick, disabled, loading }: { children: React.ReactNode; onClick: () => void; disabled?: boolean; loading?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      className="zl-btn"
      style={{ display: 'flex', alignItems: 'center', gap: 8, height: 52, padding: '0 30px', borderRadius: 999, background: '#01573C', boxShadow: '0 3px 0 #013825', color: '#fff', fontFamily: SYS, fontSize: 16, fontWeight: 600, lineHeight: '20px', opacity: disabled ? 0.45 : 1, cursor: disabled ? 'not-allowed' : 'pointer', border: 0 }}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
      {!loading && <ChevronRight size={16} strokeWidth={2.2} />}
    </button>
  );
}

function BackBtn({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="zl-btn"
      style={{ display: 'flex', alignItems: 'center', gap: 8, height: 48, padding: '0 24px', borderRadius: 999, background: '#141414', border: '1px solid #262626', boxShadow: '0 3px 0 #050505', color: '#fff', fontFamily: SYS, fontSize: 16, fontWeight: 500, lineHeight: '20px', cursor: 'pointer' }}
    >
      <ChevronLeft size={16} strokeWidth={2} />
      Voltar
    </button>
  );
}

function GoalIcon({ id, color }: { id: Goal; color: string }) {
  const p = { fill: 'none', stroke: color, strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
      {id === 'ai_replies' && <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" {...p} />}
      {id === 'crm' && <><rect x="3" y="3" width="7" height="18" rx="1" {...p} /><rect x="14" y="3" width="7" height="10" rx="1" {...p} /></>}
      {id === 'followup' && <path d="M3 12a9 9 0 0 1 15-6.7L21 8M21 3v5h-5M21 12a9 9 0 0 1-15 6.7L3 16M3 21v-5h5" {...p} />}
      {id === 'calendar' && <><rect x="3" y="4" width="18" height="18" rx="2" {...p} /><path d="M16 2v4M8 2v4M3 10h18" {...p} /></>}
    </svg>
  );
}

function StepBadge({ n, done }: { n: number; done?: boolean }) {
  return (
    <div style={{ width: 32, height: 32, borderRadius: 16, background: '#12301F', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: '#96F63C', fontFamily: SYS, fontSize: 14, fontWeight: 700 }}>
      {done ? <Check size={16} strokeWidth={3} /> : n}
    </div>
  );
}

/* ───────── página ───────── */

export default function OnboardingPage() {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>('loading');
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const [companyName, setCompanyName] = useState('');
  const [userName, setUserName] = useState('');
  const [segment, setSegment] = useState('');
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [plan, setPlan] = useState<PlanIntent | null>(null);

  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [finalName, setFinalName] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  // Descobre em que ponto a pessoa está: começando, esperando pagar, no passo final, ou já terminou
  useEffect(() => {
    let alive = true;
    fetch('/api/onboarding/state')
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((s) => {
        if (!alive) return;
        setEmail(s.email ?? '');
        if (s.stage === 'payment') {
          window.location.replace(`/configuracoes?tab=plano&expired=payment&pagar=${s.plan ?? 'pro'}`);
        } else if (s.stage === 'done') {
          window.location.replace('/dashboard');
        } else if (s.stage === 'finish') {
          setFinalName(s.companyName ?? '');
          setItems((s.items ?? []) as ChecklistItem[]);
          setStep(4);
          setStage('finish');
        } else {
          setUserName(s.name ?? '');
          setStage('form');
        }
      })
      .catch(() => {
        if (!alive) return;
        // sem sessão: volta para o login
        window.location.replace('/login');
      });
    return () => { alive = false; };
  }, []);

  async function uploadLogo(file: File) {
    if (!file.type.startsWith('image/')) { setError('Envie apenas imagens.'); return; }
    setUploading(true); setError('');
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch('/api/onboarding/upload-logo', { method: 'POST', body: form });
      const json = await res.json();
      if (json.url) setLogoUrl(json.url);
      else setError(json.error || 'Não foi possível enviar a imagem.');
    } catch {
      setError('Erro de conexão ao enviar a imagem.');
    } finally {
      setUploading(false);
    }
  }

  function toggleGoal(id: Goal) {
    setGoals((g) => (g.includes(id) ? g.filter((x) => x !== id) : g.length >= MAX_GOALS ? [...g.slice(1), id] : [...g, id]));
  }

  async function createAndPay() {
    if (!plan) return;
    setBusy(true); setError('');
    try {
      const res = await fetch('/api/onboarding/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyName, userName, segment, logoUrl, goals, selectedPlan: plan }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Não foi possível criar a conta.');
      // tela cheia: o painel decide o que mostrar depois do pagamento
      window.location.assign(data.next ?? '/dashboard');
    } catch (e: any) {
      setError(e.message || 'Não foi possível criar a conta. Tente novamente.');
      setBusy(false);
    }
  }

  async function finish(target: string) {
    setBusy(true); setError('');
    try {
      const res = await fetch('/api/onboarding/finish', { method: 'POST' });
      if (!res.ok) throw new Error();
      router.replace(target);
    } catch {
      setError('Não foi possível concluir. Tente de novo.');
      setBusy(false);
    }
  }

  if (stage === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin" style={{ color: '#666' }} />
      </div>
    );
  }

  const canNext = step === 1 ? companyName.trim().length >= 2 : step === 2 ? goals.length >= 1 : step === 3 ? !!plan : true;
  const previewItems = buildChecklist(goals, { whatsappConnected: false, hasAgent: false, calendarConnected: false, hasLeads: false, hasFollowUp: false }).filter((i) => i.id !== 'account');
  const finalItems = items.filter((i) => i.id !== 'account');
  const firstPending = finalItems.findIndex((i) => !i.done);

  return (
    <div className="min-h-screen flex flex-col" style={{ fontFamily: SYS }}>
      <style>{AUTH_FIELD_CSS}</style>
      <div>
        <ProgressBar step={step} />
        <Header step={step} />
      </div>

      <main className="flex flex-1 justify-center px-6 lg:px-24 py-10 lg:py-16 gap-12 xl:gap-24">
        {/* ───── Passo 1: Empresa ───── */}
        {step === 1 && (
          <>
            <div className="flex flex-col w-full lg:w-[640px] lg:flex-shrink-0" style={{ gap: 32 }}>
              <Heading title="Vamos preparar o Zaapply para a sua empresa" sub="Leva menos de um minuto. Dá para mudar tudo depois em Configuração." />
              <div className="flex flex-col" style={{ gap: 22 }}>
                <div className="flex flex-col sm:flex-row" style={{ gap: 16 }}>
                  <div className="flex flex-col flex-1" style={{ gap: 8 }}>
                    <FieldLabel htmlFor="company">Nome da empresa</FieldLabel>
                    <FieldBox><TextInput id="company" autoFocus autoComplete="organization" value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="Ex: Clínica Horizonte" maxLength={120} /></FieldBox>
                  </div>
                  <div className="flex flex-col flex-1" style={{ gap: 8 }}>
                    <FieldLabel htmlFor="me">Seu nome</FieldLabel>
                    <FieldBox><TextInput id="me" autoComplete="name" value={userName} onChange={(e) => setUserName(e.target.value)} placeholder="Como te chamamos?" maxLength={120} /></FieldBox>
                  </div>
                </div>

                <div className="flex flex-col" style={{ gap: 10 }}>
                  <FieldLabel>Segmento</FieldLabel>
                  <div className="flex flex-wrap" style={{ gap: 10 }} role="radiogroup" aria-label="Segmento">
                    {SEGMENTS.map((s) => {
                      const on = segment === s;
                      return (
                        <button
                          key={s}
                          type="button"
                          role="radio"
                          aria-checked={on}
                          onClick={() => setSegment(on ? '' : s)}
                          style={{ padding: '10px 18px', borderRadius: 999, fontSize: 15, lineHeight: '18px', fontWeight: on ? 600 : 400, color: on ? '#fff' : '#A3A3A3', background: on ? '#12301F' : 'transparent', border: `1px solid ${on ? '#01573C' : '#2A2A2A'}`, transition: 'all .15s' }}
                        >
                          {s}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="flex flex-col" style={{ gap: 8 }}>
                  <div className="flex items-center" style={{ gap: 8 }}>
                    <span style={{ color: '#D0D0D0', fontSize: 15, fontWeight: 500, lineHeight: '18px' }}>Logo</span>
                    <span style={{ color: '#737373', fontSize: 13, lineHeight: '16px' }}>opcional</span>
                  </div>
                  <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void uploadLogo(f); }} />
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    className="flex items-center text-left hover:bg-white/[0.03] transition-colors"
                    style={{ gap: 14, padding: '14px 18px', borderRadius: 14, border: '1.5px dashed #2F2F2F' }}
                  >
                    <span className="flex items-center justify-center flex-shrink-0" style={{ width: 40, height: 40, borderRadius: 10, background: '#141414', overflow: 'hidden' }}>
                      {logoUrl ? <img src={logoUrl} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} /> : uploading ? <Loader2 className="h-4 w-4 animate-spin" style={{ color: '#A3A3A3' }} /> : <Upload size={18} color="#A3A3A3" strokeWidth={2} />}
                    </span>
                    <span style={{ color: '#A3A3A3', fontSize: 15, lineHeight: '18px' }}>{logoUrl ? 'Trocar imagem da logo' : 'Enviar imagem da logo'}</span>
                  </button>
                </div>
              </div>
              <div className="flex justify-end" style={{ paddingTop: 8 }}>
                <PrimaryBtn onClick={() => setStep(2)} disabled={!canNext}>Continuar</PrimaryBtn>
              </div>
            </div>

            <aside className="hidden lg:flex flex-col flex-shrink-0" style={{ width: 460, gap: 16, paddingTop: 6 }}>
              <SideLabel>ASSIM VAI APARECER PARA VOCÊ</SideLabel>
              <div className="flex items-center" style={{ gap: 14, padding: '18px 22px', borderRadius: 16, background: 'linear-gradient(90deg, #07261C 0%, #01573C 100%)' }}>
                <div className="flex items-center justify-center flex-shrink-0 overflow-hidden" style={{ width: 48, height: 48, borderRadius: 24, background: '#12301F', border: '2px solid #96F63C', color: '#fff', fontSize: 16, fontWeight: 700 }}>
                  {logoUrl ? <img src={logoUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : initialsOf(companyName)}
                </div>
                <div className="flex flex-col min-w-0" style={{ gap: 2 }}>
                  <div className="truncate" style={{ color: '#fff', fontSize: 17, fontWeight: 600, lineHeight: '22px' }}>{companyName.trim() || 'Nome da empresa'}</div>
                  <div className="truncate" style={{ color: '#B8D4C6', fontSize: 14, lineHeight: '18px' }}>{email}</div>
                </div>
              </div>
              <SideNote>Esse é o cabeçalho que você vê no alto de todas as telas do Zaapply.</SideNote>
            </aside>
          </>
        )}

        {/* ───── Passo 2: Objetivo ───── */}
        {step === 2 && (
          <>
            <div className="flex flex-col w-full lg:w-[760px] lg:flex-shrink-0" style={{ gap: 32 }}>
              <Heading title="O que você quer resolver primeiro?" sub="Escolha até 2. Isso define por onde começamos com você." />
              <div className="grid grid-cols-1 sm:grid-cols-2" style={{ gap: 16 }} role="group" aria-label="Objetivos">
                {GOALS.map((g) => {
                  const on = goals.includes(g.id);
                  return (
                    <button
                      key={g.id}
                      type="button"
                      aria-pressed={on}
                      onClick={() => toggleGoal(g.id)}
                      className="flex flex-col text-left transition-colors"
                      style={{ gap: 14, padding: 24, borderRadius: 18, background: on ? '#12301F' : '#101010', border: on ? '1.5px solid #01573C' : '1px solid #1C1C1C' }}
                    >
                      <div className="flex items-center justify-between">
                        <span className="flex items-center justify-center" style={{ width: 44, height: 44, borderRadius: 22, background: on ? '#0C1F14' : '#1A1A1A' }}>
                          <GoalIcon id={g.id} color={on ? '#96F63C' : '#A3A3A3'} />
                        </span>
                        {on ? (
                          <span className="flex items-center justify-center" style={{ width: 24, height: 24, borderRadius: 12, background: '#96F63C' }}><Check size={14} strokeWidth={3.2} color="#07261C" /></span>
                        ) : (
                          <span style={{ width: 24, height: 24, borderRadius: 12, border: '1.5px solid #333' }} />
                        )}
                      </div>
                      <div style={{ color: '#fff', fontSize: 19, fontWeight: 600, lineHeight: '26px' }}>{g.title}</div>
                      <div style={{ color: on ? '#B8C9BE' : '#A3A3A3', fontSize: 15, lineHeight: '22px' }}>{g.desc}</div>
                    </button>
                  );
                })}
              </div>
              <div className="flex items-center justify-between">
                <BackBtn onClick={() => setStep(1)} />
                <PrimaryBtn onClick={() => setStep(3)} disabled={!canNext}>Continuar</PrimaryBtn>
              </div>
            </div>

            <aside className="hidden lg:flex flex-col flex-shrink-0" style={{ width: 420, gap: 16, paddingTop: 6 }}>
              <SideLabel>SEUS PRIMEIROS PASSOS</SideLabel>
              <div className="flex flex-col" style={{ gap: 14, padding: 22, borderRadius: 18, background: '#101010', border: '1px solid #1C1C1C', minHeight: 80 }}>
                {previewItems.length === 0 ? (
                  <div style={{ color: '#737373', fontSize: 15, lineHeight: '22px' }}>Marque um objetivo ao lado para ver a lista.</div>
                ) : previewItems.map((it, i) => (
                  <div key={it.id} className="flex items-center" style={{ gap: 14 }}>
                    <span className="flex items-center justify-center flex-shrink-0" style={{ width: 26, height: 26, borderRadius: 13, background: '#12301F', color: '#96F63C', fontSize: 13, fontWeight: 700 }}>{i + 1}</span>
                    <span style={{ color: '#fff', fontSize: 16, lineHeight: '20px' }}>{it.title}</span>
                  </div>
                ))}
              </div>
              <SideNote>A lista muda conforme o que você marcar. Não bloqueia nada: dá para fazer em qualquer ordem.</SideNote>
            </aside>
          </>
        )}

        {/* ───── Passo 3: Plano ───── */}
        {step === 3 && (
          <div className="flex flex-col w-full lg:w-[1000px] lg:flex-shrink-0" style={{ gap: 28 }}>
            <Heading title="Escolha como começar" sub="Você pode trocar de plano depois, em Configuração." />
            <div className="flex flex-col md:flex-row" style={{ gap: 20 }} role="radiogroup" aria-label="Plano">
              {PLANS.map((p) => {
                const on = plan === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => setPlan(p.id)}
                    className="flex flex-col flex-1 text-left transition-colors"
                    style={{ gap: 20, padding: 28, borderRadius: 20, background: on ? '#12301F' : '#101010', border: on ? '1.5px solid #01573C' : '1px solid #1C1C1C' }}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center" style={{ gap: 10 }}>
                        <span style={{ color: '#A3A3A3', fontSize: 13, fontWeight: 600, letterSpacing: '0.1em', lineHeight: '16px' }}>{p.name}</span>
                        {p.popular && <span style={{ background: '#12301F', color: '#96F63C', borderRadius: 999, padding: '3px 9px', fontSize: 11, fontWeight: 700, lineHeight: '14px' }}>Mais popular</span>}
                      </div>
                      {on ? (
                        <span className="flex items-center justify-center" style={{ width: 22, height: 22, borderRadius: 11, background: '#96F63C' }}><Check size={13} strokeWidth={3.2} color="#07261C" /></span>
                      ) : (
                        <span style={{ width: 22, height: 22, borderRadius: 11, border: '2px solid #333' }} />
                      )}
                    </div>
                    <div className="flex items-baseline" style={{ gap: 6 }}>
                      <span style={{ color: '#A3A3A3', fontSize: 16, lineHeight: '20px' }}>R$</span>
                      <span style={{ color: '#fff', fontSize: 48, fontWeight: 700, letterSpacing: '-0.02em', lineHeight: '58px' }}>{p.price}</span>
                      <span style={{ color: '#A3A3A3', fontSize: 16, lineHeight: '20px' }}>/mês</span>
                    </div>
                    <div className="flex flex-col" style={{ gap: 12 }}>
                      {p.features.map((f) => (
                        <div key={f} className="flex items-center" style={{ gap: 10 }}>
                          <Check size={16} strokeWidth={2.6} color="#96F63C" style={{ flexShrink: 0 }} />
                          <span style={{ color: '#E5E5E5', fontSize: 15, lineHeight: '18px' }}>{f}</span>
                        </div>
                      ))}
                    </div>
                  </button>
                );
              })}
            </div>
            <div className="flex items-center justify-between" style={{ paddingTop: 4 }}>
              <BackBtn onClick={() => setStep(2)} />
              <PrimaryBtn onClick={createAndPay} disabled={!canNext} loading={busy}>Continuar para o pagamento</PrimaryBtn>
            </div>
          </div>
        )}

        {/* ───── Passo 4: Tudo certo ───── */}
        {step === 4 && (
          <div className="flex flex-col w-full lg:w-[760px] lg:flex-shrink-0" style={{ gap: 32 }}>
            <div className="flex flex-col" style={{ gap: 14 }}>
              <span className="inline-flex items-center self-start" style={{ gap: 8, padding: '6px 14px', borderRadius: 999, background: '#12301F', color: '#96F63C', fontSize: 14, fontWeight: 600, lineHeight: '18px' }}>
                <Check size={14} strokeWidth={3} /> Conta criada
              </span>
              <h1 style={{ margin: 0, color: '#fff', fontSize: 40, fontWeight: 600, letterSpacing: '-0.02em', lineHeight: '46px' }}>
                {finalName ? `Tudo certo, ${finalName}` : 'Tudo certo'}
              </h1>
              <p style={{ margin: 0, color: '#A3A3A3', fontSize: 17, lineHeight: '26px' }}>
                {finalItems.length === 0
                  ? 'Sua conta está pronta. Explore o painel no seu ritmo.'
                  : `${finalItems.length === 1 ? 'Um passo' : `${finalItems.length === 2 ? 'Dois' : 'Três'} passos`} para começar a atender. Faça na ordem que quiser: a lista fica no seu painel até terminar.`}
              </p>
            </div>

            {finalItems.length > 0 && (
              <div className="flex flex-col" style={{ borderRadius: 20, background: '#101010', border: '1px solid #1C1C1C' }}>
                {finalItems.map((it, i) => {
                  const primary = i === firstPending;
                  return (
                    <div key={it.id} className="flex items-center" style={{ gap: 18, padding: '22px 28px', borderBottom: i < finalItems.length - 1 ? '1px solid #1C1C1C' : 0 }}>
                      <StepBadge n={i + 1} done={it.done} />
                      <div className="flex flex-1 min-w-0 flex-col" style={{ gap: 3 }}>
                        <div style={{ color: '#fff', fontSize: 18, fontWeight: 600, lineHeight: '22px' }}>{it.title}</div>
                        <div style={{ color: '#A3A3A3', fontSize: 15, lineHeight: '18px' }}>{it.hint}</div>
                      </div>
                      {!it.done && (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void finish(it.href)}
                          className="zl-btn flex-shrink-0"
                          style={primary
                            ? { height: 42, padding: '0 22px', borderRadius: 999, background: '#01573C', boxShadow: '0 3px 0 #013825', color: '#fff', fontSize: 15, fontWeight: 600, lineHeight: '18px' }
                            : { height: 42, padding: '0 22px', borderRadius: 999, background: '#141414', border: '1px solid #262626', boxShadow: '0 3px 0 #050505', color: '#fff', fontSize: 15, fontWeight: 500, lineHeight: '18px' }}
                        >
                          Começar
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            <div className="flex items-center justify-between">
              <button type="button" disabled={busy} onClick={() => void finish('/dashboard')} className="zl-link" style={{ color: '#96F63C', fontSize: 15, fontWeight: 600, lineHeight: '18px' }}>
                Fazer isso depois
              </button>
              <PrimaryBtn onClick={() => void finish('/dashboard')} loading={busy}>Ir para o painel</PrimaryBtn>
            </div>
          </div>
        )}
      </main>

      {error && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 flex items-center" role="alert" style={{ gap: 10, padding: '12px 18px', borderRadius: 12, background: '#2B1414', border: '1px solid #5A2323', color: '#FCA5A5', fontSize: 15 }}>
          <AlertCircle size={18} color="#F87171" /> {error}
        </div>
      )}
    </div>
  );
}
