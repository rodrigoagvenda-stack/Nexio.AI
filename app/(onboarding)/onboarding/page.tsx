'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import {
  Building2, User, Phone, Upload, ChevronRight, ChevronLeft,
  Check, Play, Sparkles, MessageSquare, Users, Bot, Zap,
  ArrowRight, Loader2, X, Star, CreditCard,
} from 'lucide-react';

// ─── Types ──────────────────────────────────────────────────────────────────
interface FormData {
  userName: string;
  companyName: string;
  companyPhone: string;
  segment: string;
  companySize: string;
  logoUrl: string | null;
  planType: string;
}

const SEGMENTS = [
  'Tecnologia', 'Saúde', 'Educação', 'Varejo / E-commerce',
  'Imóveis', 'Serviços', 'Financeiro', 'Alimentação', 'Outro',
];

const SIZES = [
  { label: 'Só eu', value: '1' },
  { label: '2 – 10 pessoas', value: '2-10' },
  { label: '11 – 50 pessoas', value: '11-50' },
  { label: '51 – 200 pessoas', value: '51-200' },
  { label: '200+ pessoas', value: '200+' },
];

const PLANS = [
  {
    id: 'starter',
    name: 'Starter',
    price: 'R$ 197',
    period: '/mês',
    badge: null,
    color: 'border-slate-600',
    features: [
      '1 número WhatsApp',
      'CRM até 500 leads',
      'Agente IA SDR',
      'Relatórios básicos',
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 'R$ 397',
    period: '/mês',
    badge: 'Mais popular',
    color: 'border-violet-500',
    features: [
      '3 números WhatsApp',
      'CRM ilimitado',
      'Agente IA SDR avançado',
      'Agendamento automático',
      'Relatórios completos',
      'Suporte prioritário',
    ],
  },
  {
    id: 'scale',
    name: 'Scale',
    price: 'R$ 797',
    period: '/mês',
    badge: null,
    color: 'border-slate-600',
    features: [
      'Números ilimitados',
      'CRM ilimitado + API',
      'Múltiplos agentes IA',
      'White-label',
      'Integrações avançadas',
      'Gerente de conta dedicado',
    ],
  },
];

const FIRST_STEPS = [
  {
    icon: <MessageSquare className="h-6 w-6 text-violet-400" />,
    title: 'Conectar seu WhatsApp',
    description: 'Escaneie o QR Code e comece a atender clientes em minutos.',
    videoUrl: null, // Substitua pela URL do vídeo quando disponível
    cta: 'Ver como conectar',
  },
  {
    icon: <Users className="h-6 w-6 text-blue-400" />,
    title: 'Adicionar seu primeiro lead',
    description: 'Importe contatos ou adicione manualmente no CRM Kanban.',
    videoUrl: null,
    cta: 'Ver como adicionar leads',
  },
  {
    icon: <Bot className="h-6 w-6 text-emerald-400" />,
    title: 'Ativar o agente de IA',
    description: 'Configure o SDR para responder automaticamente 24h/dia.',
    videoUrl: null,
    cta: 'Ver como configurar a IA',
  },
  {
    icon: <Zap className="h-6 w-6 text-amber-400" />,
    title: 'Enviar sua primeira mensagem',
    description: 'Use o painel de Atendimento para falar com seus leads.',
    videoUrl: null,
    cta: 'Ver como enviar mensagem',
  },
];

const TOTAL_STEPS = 5;

// ─── Step components ─────────────────────────────────────────────────────────

function StepWelcome({ data, onChange, userEmail }: { data: FormData; onChange: (f: Partial<FormData>) => void; userEmail: string }) {
  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-violet-500/20 mb-4">
          <Sparkles className="h-8 w-8 text-violet-400" />
        </div>
        <h1 className="text-3xl font-bold text-white mb-2">Bem-vindo à Nexio.AI!</h1>
        <p className="text-slate-400 text-lg">Vamos configurar sua conta em menos de 3 minutos.</p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">
            <User className="h-4 w-4 inline mr-1.5" />
            Seu nome
          </label>
          <input
            type="text"
            value={data.userName}
            onChange={e => onChange({ userName: e.target.value })}
            placeholder="Como prefere ser chamado?"
            className="w-full bg-slate-800/60 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder:text-slate-500 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500/50 transition-colors"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">
            <Building2 className="h-4 w-4 inline mr-1.5" />
            Nome da empresa <span className="text-violet-400">*</span>
          </label>
          <input
            type="text"
            value={data.companyName}
            onChange={e => onChange({ companyName: e.target.value })}
            placeholder="Ex: Acme Soluções"
            className="w-full bg-slate-800/60 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder:text-slate-500 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500/50 transition-colors"
            autoFocus
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-500 mb-2">E-mail</label>
          <input
            type="email"
            value={userEmail}
            disabled
            className="w-full bg-slate-800/30 border border-slate-700/50 rounded-xl px-4 py-3 text-slate-400 cursor-not-allowed"
          />
          <p className="text-xs text-slate-600 mt-1 ml-1">Vinculado à sua conta Google</p>
        </div>
      </div>
    </div>
  );
}

function StepAbout({ data, onChange }: { data: FormData; onChange: (f: Partial<FormData>) => void }) {
  return (
    <div className="space-y-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-white mb-1">Sobre sua empresa</h2>
        <p className="text-slate-400">Ajuda a personalizar sua experiência.</p>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-300 mb-2">
          <Phone className="h-4 w-4 inline mr-1.5" />
          Telefone / WhatsApp da empresa
        </label>
        <input
          type="tel"
          value={data.companyPhone}
          onChange={e => onChange({ companyPhone: e.target.value })}
          placeholder="+55 (11) 99999-9999"
          className="w-full bg-slate-800/60 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder:text-slate-500 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500/50 transition-colors"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-300 mb-3">Segmento de atuação</label>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {SEGMENTS.map(seg => (
            <button
              key={seg}
              type="button"
              onClick={() => onChange({ segment: seg })}
              className={`px-3 py-2.5 rounded-xl text-sm font-medium transition-all text-left border ${
                data.segment === seg
                  ? 'bg-violet-500/20 border-violet-500 text-violet-300'
                  : 'bg-slate-800/60 border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-300'
              }`}
            >
              {seg}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-300 mb-3">Tamanho da equipe</label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {SIZES.map(s => (
            <button
              key={s.value}
              type="button"
              onClick={() => onChange({ companySize: s.value })}
              className={`px-4 py-3 rounded-xl text-sm font-medium transition-all border ${
                data.companySize === s.value
                  ? 'bg-violet-500/20 border-violet-500 text-violet-300'
                  : 'bg-slate-800/60 border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-300'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function StepLogo({
  data,
  onChange,
}: {
  data: FormData;
  onChange: (f: Partial<FormData>) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    if (!file.type.startsWith('image/')) return;
    setUploading(true);
    try {
      const supabase = createClient();
      const ext = file.name.split('.').pop();
      const path = `logos/${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from('company-assets').upload(path, file, { upsert: true });
      if (error) throw error;
      const { data: { publicUrl } } = supabase.storage.from('company-assets').getPublicUrl(path);
      onChange({ logoUrl: publicUrl });
    } catch (e) {
      console.error('Logo upload error:', e);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-white mb-1">Logo da empresa</h2>
        <p className="text-slate-400">Opcional — aparece no sistema e nos documentos.</p>
      </div>

      <div
        className="relative group cursor-pointer border-2 border-dashed border-slate-700 hover:border-violet-500 rounded-2xl p-10 flex flex-col items-center gap-4 transition-colors"
        onClick={() => fileRef.current?.click()}
        onDragOver={e => { e.preventDefault(); }}
        onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
      >
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
        />

        {uploading ? (
          <Loader2 className="h-10 w-10 text-violet-400 animate-spin" />
        ) : data.logoUrl ? (
          <div className="relative">
            <img src={data.logoUrl} alt="Logo" className="h-24 w-auto object-contain rounded-xl" />
            <button
              type="button"
              onClick={e => { e.stopPropagation(); onChange({ logoUrl: null }); }}
              className="absolute -top-2 -right-2 bg-red-500 rounded-full p-0.5 text-white hover:bg-red-600"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          <>
            <div className="w-16 h-16 rounded-2xl bg-slate-800 flex items-center justify-center">
              <Upload className="h-7 w-7 text-slate-500" />
            </div>
            <div className="text-center">
              <p className="text-slate-300 font-medium">Clique ou arraste sua logo aqui</p>
              <p className="text-slate-500 text-sm mt-1">PNG, JPG, SVG — até 5 MB</p>
            </div>
          </>
        )}
      </div>

      <p className="text-center text-slate-500 text-sm">
        Pode pular esta etapa e adicionar depois nas configurações.
      </p>
    </div>
  );
}

function StepFirstSteps() {
  const [watched, setWatched] = useState<number[]>([]);

  return (
    <div className="space-y-5">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-white mb-1">Seus primeiros passos</h2>
        <p className="text-slate-400">Assista aos guias rápidos e comece a usar o sistema.</p>
      </div>

      <div className="grid gap-3">
        {FIRST_STEPS.map((step, i) => (
          <div
            key={i}
            className={`relative bg-slate-800/60 border rounded-xl p-4 flex items-start gap-4 transition-all ${
              watched.includes(i) ? 'border-emerald-600/50 bg-emerald-950/20' : 'border-slate-700'
            }`}
          >
            <div className="flex-shrink-0 w-11 h-11 rounded-xl bg-slate-700/60 flex items-center justify-center">
              {step.icon}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-white text-sm">{step.title}</p>
              <p className="text-slate-400 text-xs mt-0.5 leading-relaxed">{step.description}</p>
              <button
                type="button"
                onClick={() => setWatched(prev => prev.includes(i) ? prev : [...prev, i])}
                className="mt-2 inline-flex items-center gap-1.5 text-xs text-violet-400 hover:text-violet-300 transition-colors"
              >
                {step.videoUrl ? (
                  <><Play className="h-3.5 w-3.5" /> Assistir vídeo</>
                ) : (
                  <><Play className="h-3.5 w-3.5 opacity-40" /> <span className="opacity-60">Vídeo em breve</span></>
                )}
              </button>
            </div>
            <button
              type="button"
              onClick={() => setWatched(prev => prev.includes(i) ? prev.filter(x => x !== i) : [...prev, i])}
              className={`flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                watched.includes(i)
                  ? 'bg-emerald-500 border-emerald-500'
                  : 'border-slate-600 hover:border-slate-400'
              }`}
            >
              {watched.includes(i) && <Check className="h-3.5 w-3.5 text-white" />}
            </button>
          </div>
        ))}
      </div>
      <p className="text-slate-500 text-xs text-center">
        Pode continuar sem assistir — acesse a qualquer momento em Ajuda.
      </p>
    </div>
  );
}

function StepPlan({ data, onChange }: { data: FormData; onChange: (f: Partial<FormData>) => void }) {
  return (
    <div className="space-y-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-white mb-1">Escolha seu plano</h2>
        <p className="text-slate-400">Comece grátis por 14 dias. Cancele quando quiser.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {PLANS.map(plan => (
          <button
            key={plan.id}
            type="button"
            onClick={() => onChange({ planType: plan.id })}
            className={`relative text-left rounded-2xl border-2 p-5 transition-all ${
              data.planType === plan.id
                ? 'border-violet-500 bg-violet-500/10'
                : `${plan.color} bg-slate-800/40 hover:bg-slate-800/70`
            }`}
          >
            {plan.badge && (
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-violet-500 text-white text-xs font-semibold px-3 py-0.5 rounded-full flex items-center gap-1">
                <Star className="h-3 w-3" />
                {plan.badge}
              </span>
            )}
            <p className="font-bold text-white text-lg">{plan.name}</p>
            <div className="flex items-baseline gap-1 mt-1 mb-4">
              <span className="text-2xl font-black text-white">{plan.price}</span>
              <span className="text-slate-400 text-sm">{plan.period}</span>
            </div>
            <ul className="space-y-2">
              {plan.features.map((f, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-slate-300">
                  <Check className="h-4 w-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                  {f}
                </li>
              ))}
            </ul>
            {data.planType === plan.id && (
              <div className="absolute top-3 right-3 w-5 h-5 rounded-full bg-violet-500 flex items-center justify-center">
                <Check className="h-3 w-3 text-white" />
              </div>
            )}
          </button>
        ))}
      </div>

      <div className="bg-slate-800/40 border border-slate-700 rounded-xl p-4 flex items-start gap-3">
        <CreditCard className="h-5 w-5 text-slate-400 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-slate-300 text-sm font-medium">14 dias grátis, sem cartão agora</p>
          <p className="text-slate-500 text-xs mt-0.5">
            Você só insere os dados de pagamento ao final do trial. Pode cancelar a qualquer momento.
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────
export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [data, setData] = useState<FormData>({
    userName: '',
    companyName: '',
    companyPhone: '',
    segment: '',
    companySize: '',
    logoUrl: null,
    planType: 'pro',
  });

  const supabase = createClient();

  // Pre-fill user name from Supabase session
  supabase.auth.getUser().then(({ data: { user } }) => {
    if (user && !data.userName) {
      const name = user.user_metadata?.full_name || user.user_metadata?.name || '';
      if (name) setData(prev => ({ ...prev, userName: name }));
    }
  });

  const [userEmail, setUserEmail] = useState('');
  supabase.auth.getUser().then(({ data: { user } }) => {
    if (user?.email && !userEmail) setUserEmail(user.email);
  });

  function onChange(fields: Partial<FormData>) {
    setData(prev => ({ ...prev, ...fields }));
  }

  function canAdvance() {
    if (step === 1) return data.companyName.trim().length > 0;
    return true;
  }

  async function handleFinish() {
    setSaving(true);
    try {
      const res = await fetch('/api/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyName: data.companyName,
          companyPhone: data.companyPhone,
          segment: data.segment,
          companySize: data.companySize,
          userName: data.userName,
          planType: data.planType,
          logoUrl: data.logoUrl,
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      router.push('/dashboard');
    } catch (e: any) {
      console.error(e);
      alert('Erro ao salvar. Tente novamente.');
    } finally {
      setSaving(false);
    }
  }

  const progress = ((step - 1) / (TOTAL_STEPS - 1)) * 100;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12">
      {/* Logo */}
      <div className="mb-8 flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-violet-500 flex items-center justify-center">
          <Sparkles className="h-4 w-4 text-white" />
        </div>
        <span className="text-white font-bold text-xl tracking-tight">Nexio.AI</span>
      </div>

      {/* Progress bar */}
      <div className="w-full max-w-2xl mb-8">
        <div className="flex items-center justify-between mb-2">
          <span className="text-slate-500 text-xs">Etapa {step} de {TOTAL_STEPS}</span>
          <span className="text-slate-500 text-xs">{Math.round(progress)}% concluído</span>
        </div>
        <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-violet-500 to-violet-400 rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
        {/* Step dots */}
        <div className="flex items-center justify-between mt-3">
          {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
            <div
              key={i}
              className={`w-2 h-2 rounded-full transition-all ${
                i + 1 < step ? 'bg-violet-500' :
                i + 1 === step ? 'bg-violet-400 ring-4 ring-violet-500/20' :
                'bg-slate-700'
              }`}
            />
          ))}
        </div>
      </div>

      {/* Card */}
      <div className="w-full max-w-2xl bg-slate-900/80 border border-slate-800 rounded-2xl p-8 shadow-2xl backdrop-blur-sm">
        {step === 1 && <StepWelcome data={data} onChange={onChange} userEmail={userEmail} />}
        {step === 2 && <StepAbout data={data} onChange={onChange} />}
        {step === 3 && <StepLogo data={data} onChange={onChange} />}
        {step === 4 && <StepFirstSteps />}
        {step === 5 && <StepPlan data={data} onChange={onChange} />}

        {/* Navigation */}
        <div className="flex items-center justify-between mt-8 pt-6 border-t border-slate-800">
          <button
            type="button"
            onClick={() => setStep(s => s - 1)}
            disabled={step === 1}
            className="flex items-center gap-2 text-slate-400 hover:text-slate-200 disabled:opacity-0 disabled:pointer-events-none transition-colors text-sm"
          >
            <ChevronLeft className="h-4 w-4" />
            Voltar
          </button>

          <div className="flex items-center gap-3">
            {/* Skip (only on optional steps) */}
            {(step === 2 || step === 3 || step === 4) && (
              <button
                type="button"
                onClick={() => setStep(s => s + 1)}
                className="text-slate-500 hover:text-slate-300 text-sm transition-colors"
              >
                Pular
              </button>
            )}

            {step < TOTAL_STEPS ? (
              <button
                type="button"
                onClick={() => setStep(s => s + 1)}
                disabled={!canAdvance()}
                className="flex items-center gap-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold px-6 py-2.5 rounded-xl transition-colors"
              >
                Continuar
                <ChevronRight className="h-4 w-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleFinish}
                disabled={saving}
                className="flex items-center gap-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-60 text-white font-semibold px-6 py-2.5 rounded-xl transition-colors"
              >
                {saving ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Criando conta...</>
                ) : (
                  <><ArrowRight className="h-4 w-4" /> Começar a usar</>
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      <p className="mt-6 text-slate-600 text-xs">
        Ao continuar você concorda com nossos{' '}
        <a href="#" className="text-slate-400 underline underline-offset-2 hover:text-slate-300">Termos de Uso</a>
        {' '}e{' '}
        <a href="#" className="text-slate-400 underline underline-offset-2 hover:text-slate-300">Política de Privacidade</a>.
      </p>
    </div>
  );
}
