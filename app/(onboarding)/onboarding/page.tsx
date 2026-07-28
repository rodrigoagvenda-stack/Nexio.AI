'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { ZaapliLogo } from '@/components/brand/ZaapliLogo';
import { Check, ChevronLeft, Loader2, Upload, AlertCircle, TrendingUp, Rocket, Sparkles, Gift } from 'lucide-react';
import { cn } from '@/lib/utils';

// ── Types ──────────────────────────────────────────────────────────────────────

interface FormData {
  userName: string;
  companyName: string;
  segment: string;
  selectedPlan: string;
  logoUrl: string | null;
}

// ── Constants ──────────────────────────────────────────────────────────────────

const SEGMENTS = [
  'Tecnologia', 'Saúde', 'Educação', 'Varejo',
  'Imóveis', 'Serviços', 'Financeiro', 'Outro',
];

const PLANS = [
  {
    id: 'trial',
    name: 'Testar grátis por 7 dias',
    price: 0,
    desc: 'Acesso completo por 7 dias, sem cartão de crédito',
    icon: Gift,
    features: ['Agente SDR com IA', 'Atendimento via chat', 'CRM Kanban', 'Canvas → Follow-up'],
  },
  {
    id: 'starter',
    name: 'Zaapply Start',
    price: 397,
    desc: 'SDR + atendimento + follow-up automático',
    icon: TrendingUp,
    features: ['Agente SDR com IA', 'Atendimento via chat', 'CRM Kanban', 'Canvas → Follow-up', '5M tokens/mês'],
  },
  {
    id: 'pro',
    name: 'Zaapply Growth',
    price: 697,
    desc: 'Anti-Noshow, Remarketing e Google Calendar',
    icon: Rocket,
    popular: true,
    features: ['Tudo do Start', 'Anti-Noshow e Remarketing', 'Google Calendar', '15M tokens/mês'],
  },
  {
    id: 'scale',
    name: 'Zaapply Pro',
    price: 997,
    desc: 'Escala total com 50M tokens/mês',
    icon: Sparkles,
    features: ['Tudo do Growth', '50M tokens/mês'],
  },
];

const TOTAL_STEPS = 3;

// ── Progress bar ───────────────────────────────────────────────────────────────

function ProgressBar({ step }: { step: number }) {
  return (
    <div className="w-full h-0.5 bg-border">
      <div
        className="h-full bg-primary transition-all duration-500 ease-out"
        style={{ width: `${((step + 1) / TOTAL_STEPS) * 100}%` }}
      />
    </div>
  );
}

// ── Step 1: Empresa ────────────────────────────────────────────────────────────

function StepEmpresa({
  data,
  onChange,
  userEmail,
}: {
  data: FormData;
  onChange: (f: Partial<FormData>) => void;
  userEmail: string;
}) {
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    if (!file.type.startsWith('image/')) { setUploadError('Envie apenas imagens.'); return; }
    setUploading(true); setUploadError('');
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch('/api/onboarding/upload-logo', { method: 'POST', body: form });
      const json = await res.json();
      if (json.url) onChange({ logoUrl: json.url });
      else setUploadError(json.error || 'Erro no upload.');
    } catch { setUploadError('Erro de conexão.'); }
    finally { setUploading(false); }
  }

  const field = 'w-full border border-border rounded-xl px-4 py-3 text-foreground text-sm placeholder:text-muted-foreground bg-background focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 transition-all';

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground">
          Conte um pouco sobre <span className="text-primary">sua empresa.</span>
        </h1>
        <p className="text-muted-foreground text-sm mt-2">Essas informações personalizam sua experiência.</p>
      </div>

      <div className="space-y-5">
        {/* Nome + Seu nome */}
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Nome da empresa <span className="text-primary">*</span></label>
            <input type="text" value={data.companyName} onChange={e => onChange({ companyName: e.target.value })}
              placeholder="Ex: Acme Soluções" className={field} autoFocus />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Seu nome</label>
            <input type="text" value={data.userName} onChange={e => onChange({ userName: e.target.value })}
              placeholder="Como te chamamos?" className={field} />
          </div>
        </div>

        {/* E-mail (readonly) */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">E-mail</label>
          <input type="email" value={userEmail} disabled
            className="w-full border border-border rounded-xl px-4 py-3 text-muted-foreground text-sm bg-muted cursor-not-allowed" />
        </div>

        {/* Segmento */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-muted-foreground">Segmento</label>
          <div className="flex flex-wrap gap-2">
            {SEGMENTS.map(seg => (
              <button key={seg} type="button" onClick={() => onChange({ segment: seg })}
                className={cn(
                  'px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all border',
                  data.segment === seg
                    ? 'bg-primary/10 border-primary text-primary'
                    : 'border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground bg-background'
                )}>
                {seg}
              </button>
            ))}
          </div>
        </div>

        {/* Logo */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Logo <span className="text-muted-foreground/50">(opcional)</span></label>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
          <button type="button" onClick={() => fileRef.current?.click()}
            className="w-full flex items-center gap-3 border border-dashed border-border rounded-xl px-4 py-3 hover:border-primary/50 hover:bg-primary/5 transition-colors">
            {data.logoUrl
              ? <img src={data.logoUrl} alt="Logo" className="w-8 h-8 rounded-lg object-contain" />
              : <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center">
                  {uploading ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : <Upload className="h-4 w-4 text-muted-foreground" />}
                </div>
            }
            <span className="text-sm text-muted-foreground">{data.logoUrl ? 'Trocar logo' : 'Enviar logo'}</span>
          </button>
          {uploadError && <p className="text-xs text-destructive flex items-center gap-1"><AlertCircle className="h-3.5 w-3.5" />{uploadError}</p>}
        </div>
      </div>
    </div>
  );
}

// ── Step 2: Plano ──────────────────────────────────────────────────────────────

function StepPlano({ selected, onSelect }: { selected: string; onSelect: (id: string) => void }) {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground">
          Qual plano <span className="text-primary">faz sentido</span> para você?
        </h1>
        <p className="text-muted-foreground text-sm mt-2">Você pode alterar ou cancelar a qualquer momento.</p>
      </div>

      <div className="space-y-3">
        {PLANS.map((plan) => {
          const Icon = plan.icon;
          const isSelected = selected === plan.id;
          return (
            <button key={plan.id} type="button" onClick={() => onSelect(plan.id)}
              className={cn(
                'w-full flex items-center gap-4 px-5 py-4 rounded-xl border-2 text-left transition-all',
                isSelected ? 'border-primary bg-primary/5' : 'border-border hover:border-foreground/30 bg-background'
              )}>
              <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center shrink-0', isSelected ? 'bg-primary/15' : 'bg-muted')}>
                <Icon className={cn('h-5 w-5', isSelected ? 'text-primary' : 'text-muted-foreground')} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold text-foreground text-sm">{plan.name}</p>
                  {plan.popular && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary text-primary-foreground">Mais popular</span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">{plan.desc}</p>
              </div>
              <div className="text-right shrink-0">
                {plan.price === 0
                  ? <p className="font-bold text-primary">Grátis</p>
                  : <p className="font-bold text-foreground">R$ {plan.price}<span className="text-xs font-normal text-muted-foreground">/mês</span></p>
                }
              </div>
              <div className={cn('w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all', isSelected ? 'border-primary bg-primary' : 'border-border')}>
                {isSelected && <Check className="h-3 w-3 text-primary-foreground" />}
              </div>
            </button>
          );
        })}
      </div>

      <p className="text-xs text-muted-foreground text-center">
        Métricas, briefing e suporte com a mesma qualidade em todos os planos.
      </p>
    </div>
  );
}

// ── Step 3: Pronto ─────────────────────────────────────────────────────────────

function StepPronto({ companyName }: { companyName: string }) {
  return (
    <div className="space-y-8">
      <div>
        <div className="inline-flex items-center gap-2 text-xs font-semibold text-primary bg-primary/10 px-3 py-1.5 rounded-full mb-4">
          <Check className="h-3.5 w-3.5" /> Conta criada
        </div>
        <h1 className="text-2xl font-bold text-foreground">
          {companyName ? `Bem-vindo, ${companyName.split(' ')[0]}!` : 'Tudo pronto!'}
        </h1>
        <p className="text-muted-foreground text-sm mt-2 leading-relaxed">
          Seu workspace está configurado. O próximo passo é ativar seu número oficial do WhatsApp.
        </p>
      </div>

      <div className="space-y-3">
        {[
          { step: '1', label: 'Ativar seu número oficial', desc: 'Conecte via API oficial Meta em Configurações → Integrações' },
          { step: '2', label: 'Configurar o Agente SDR', desc: 'Adicione sua base de conhecimento e tom de voz' },
          { step: '3', label: 'Adicionar seus leads', desc: 'Importe uma planilha ou cadastre manualmente no CRM' },
        ].map(item => (
          <div key={item.step} className="flex items-start gap-4 p-4 rounded-xl border border-border bg-card">
            <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
              <span className="text-xs font-bold text-primary">{item.step}</span>
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">{item.label}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{item.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [form, setForm] = useState<FormData>({
    userName: '', companyName: '', segment: '', selectedPlan: 'pro', logoUrl: null,
  });

  const onChange = (f: Partial<FormData>) => setForm(p => ({ ...p, ...f }));

  // Fetch user email on mount
  useState(() => {
    createClient().auth.getUser().then(({ data }: { data: any }) => {
      if (data.user?.email) setUserEmail(data.user.email);
    });
  });

  const canContinue = () => {
    if (step === 0) return form.companyName.trim().length >= 2;
    return true;
  };

  async function handleFinish() {
    setSaving(true); setError('');
    try {
      const res = await fetch('/api/onboarding/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyName: form.companyName,
          userName: form.userName,
          selectedPlan: form.selectedPlan,
          logoUrl: form.logoUrl,
          userEmail,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao salvar.');
      router.replace('/dashboard');
    } catch (e: any) {
      setError(e.message || 'Erro ao salvar. Tente novamente.');
      setSaving(false);
    }
  }

  const isLast = step === TOTAL_STEPS - 1;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Progress */}
      <ProgressBar step={step} />

      {/* Header */}
      <header className="px-6 py-5 flex items-center justify-between border-b border-border">
        <ZaapliLogo iconSize={28} />
        <p className="text-xs text-muted-foreground">{step + 1} de {TOTAL_STEPS}</p>
      </header>

      {/* Content */}
      <main className="flex-1 flex items-start justify-center px-5 py-12">
        <div className="w-full max-w-lg">
          {step === 0 && <StepEmpresa data={form} onChange={onChange} userEmail={userEmail} />}
          {step === 1 && <StepPlano selected={form.selectedPlan} onSelect={id => onChange({ selectedPlan: id })} />}
          {step === 2 && <StepPronto companyName={form.companyName} />}

          {error && (
            <div className="mt-4 flex items-center gap-2 text-sm text-destructive bg-destructive/5 border border-destructive/20 rounded-xl px-4 py-3">
              <AlertCircle className="h-4 w-4 shrink-0" />{error}
            </div>
          )}
        </div>
      </main>

      {/* Footer nav */}
      <footer className="px-6 py-5 border-t border-border flex items-center justify-between">
        {step > 0 ? (
          <button onClick={() => setStep(s => s - 1)}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ChevronLeft className="h-4 w-4" /> Voltar
          </button>
        ) : <div />}

        <button
          onClick={isLast ? handleFinish : () => setStep(s => s + 1)}
          disabled={!canContinue() || saving}
          className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-40"
        >
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          {isLast ? 'Entrar no Zaapply' : 'Continuar'}
        </button>
      </footer>
    </div>
  );
}
