'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { ZaapliLogo } from '@/components/brand/ZaapliLogo';
import { ZaapliIcon } from '@/components/brand/ZaapliIcon';
import {
  Building2, User, Phone, Upload, ChevronRight, ChevronLeft,
  Check, Play, MessageSquare, Users, Bot, Zap, ArrowRight,
  Loader2, X, CreditCard, ChevronDown,
} from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────
interface FormData {
  userName: string;
  companyName: string;
  companyPhone: string;
  segment: string;
  companySize: string;
  logoUrl: string | null;
  planId: string;
}

interface Plan {
  id: string;
  name: string;
  monthly_price: number;
  token_quota: number;
}

const SEGMENTS = [
  'Tecnologia', 'Saúde', 'Educação', 'Varejo',
  'Imóveis', 'Serviços', 'Financeiro', 'Outro',
];

const SIZES = ['1', '2-10', '11-50', '51-200', '200+'];
const SIZE_LABELS: Record<string, string> = {
  '1': 'Só eu', '2-10': '2–10', '11-50': '11–50', '51-200': '51–200', '200+': '200+'
};

const GUIDE_STEPS = [
  {
    icon: <MessageSquare className="h-5 w-5 text-[#369E47]" />,
    title: 'Conectar seu WhatsApp',
    desc: 'Escaneie o QR Code no painel de Atendimento e receba mensagens em tempo real.',
    time: '2 min',
    videoId: 'dQw4w9WgXcQ', // substitua pelo ID real
  },
  {
    icon: <Users className="h-5 w-5 text-[#369E47]" />,
    title: 'Adicionar seu primeiro lead',
    desc: 'Importe uma planilha ou cadastre manualmente no CRM Kanban.',
    time: '3 min',
    videoId: 'dQw4w9WgXcQ',
  },
  {
    icon: <Bot className="h-5 w-5 text-[#369E47]" />,
    title: 'Ativar o agente de IA',
    desc: 'Configure o SDR para responder automaticamente 24 horas por dia.',
    time: '5 min',
    videoId: 'dQw4w9WgXcQ',
  },
  {
    icon: <Zap className="h-5 w-5 text-[#369E47]" />,
    title: 'Enviar sua primeira mensagem',
    desc: 'Use o Atendimento para falar com um lead agora mesmo.',
    time: '1 min',
    videoId: 'dQw4w9WgXcQ',
  },
];

const STEPS_META = [
  'Sua empresa',
  'Primeiros passos',
  'Plano',
];
const TOTAL = STEPS_META.length;

const inputCls = `w-full border border-gray-200 rounded-xl px-4 py-3 text-gray-900 text-sm
  placeholder:text-gray-400 bg-white focus:outline-none focus:border-[#369E47]
  focus:ring-2 focus:ring-[#369E47]/15 transition-all`;

// ── Hero animado ───────────────────────────────────────────────────────────────
function HeroSlide({ onStart }: { onStart: () => void }) {
  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center px-6 relative overflow-hidden">
      {/* Blobs animados */}
      <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-[#369E47]/8 blur-3xl animate-pulse" />
      <div className="absolute -bottom-32 -right-32 w-96 h-96 rounded-full bg-[#369E47]/6 blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
      <div className="absolute top-1/2 left-1/4 w-64 h-64 rounded-full bg-[#369E47]/4 blur-2xl animate-pulse" style={{ animationDelay: '0.5s' }} />

      <div className="relative z-10 text-center max-w-2xl mx-auto">
        {/* Logo com entrada */}
        <div className="flex justify-center mb-10 animate-in fade-in slide-in-from-top-4 duration-700">
          <ZaapliLogo iconSize={48} theme="light" animate />
        </div>

        {/* Slogan principal */}
        <h1
          className="text-5xl sm:text-6xl font-black text-gray-900 leading-tight tracking-tight mb-4 animate-in fade-in slide-in-from-bottom-6 duration-700"
          style={{ animationDelay: '200ms', animationFillMode: 'both' }}
        >
          Seu SDR nunca{' '}
          <span className="text-[#369E47] relative inline-block">
            dorme.
            <svg className="absolute -bottom-1 left-0 w-full" viewBox="0 0 200 8" fill="none">
              <path d="M2 6 Q50 2 100 6 Q150 10 198 4" stroke="#369E47" strokeWidth="2.5" strokeLinecap="round" fill="none" opacity="0.4"/>
            </svg>
          </span>
        </h1>

        <p
          className="text-xl text-gray-500 mb-10 animate-in fade-in slide-in-from-bottom-4 duration-700"
          style={{ animationDelay: '400ms', animationFillMode: 'both' }}
        >
          Do lead ao fechamento, no automático.
        </p>

        {/* Bullets rápidos */}
        <div
          className="flex flex-wrap items-center justify-center gap-4 mb-12 animate-in fade-in duration-700"
          style={{ animationDelay: '600ms', animationFillMode: 'both' }}
        >
          {['WhatsApp integrado', 'CRM com Kanban', 'IA que vende por você'].map((item, i) => (
            <span key={i} className="flex items-center gap-1.5 text-sm text-gray-600 bg-gray-50 border border-gray-100 px-4 py-2 rounded-full">
              <Check className="h-3.5 w-3.5 text-[#369E47]" />{item}
            </span>
          ))}
        </div>

        {/* CTA */}
        <button
          onClick={onStart}
          className="animate-in fade-in zoom-in-95 duration-500 group inline-flex items-center gap-3 bg-[#369E47] hover:bg-[#2d8a3e] text-white font-bold text-lg px-10 py-4 rounded-2xl shadow-lg shadow-[#369E47]/25 hover:shadow-[#369E47]/40 transition-all"
          style={{ animationDelay: '700ms', animationFillMode: 'both' }}
        >
          Configurar minha conta
          <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
        </button>

        <p className="mt-4 text-xs text-gray-400 animate-in fade-in duration-700" style={{ animationDelay: '900ms', animationFillMode: 'both' }}>
          Leva menos de 3 minutos
        </p>
      </div>
    </div>
  );
}

// ── Step 1: Empresa (compacto) ─────────────────────────────────────────────────
function StepEmpresa({ data, onChange, userEmail }: { data: FormData; onChange: (f: Partial<FormData>) => void; userEmail: string }) {
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    if (!file.type.startsWith('image/')) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch('/api/onboarding/upload-logo', { method: 'POST', body: form });
      const json = await res.json();
      if (json.url) onChange({ logoUrl: json.url });
    } catch (e) { console.error(e); }
    finally { setUploading(false); }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Sua empresa</h2>
        <p className="text-gray-500 mt-1 text-sm">Informações básicas para começar.</p>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Nome da empresa <span className="text-[#369E47]">*</span></label>
          <input type="text" value={data.companyName} onChange={e => onChange({ companyName: e.target.value })}
            placeholder="Ex: Acme Soluções" className={inputCls} autoFocus />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Seu nome</label>
          <input type="text" value={data.userName} onChange={e => onChange({ userName: e.target.value })}
            placeholder="Como te chamamos?" className={inputCls} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            <Phone className="h-3.5 w-3.5 inline mr-1 text-gray-400" />WhatsApp da empresa
          </label>
          <input type="tel" value={data.companyPhone} onChange={e => onChange({ companyPhone: e.target.value })}
            placeholder="+55 (11) 99999-9999" className={inputCls} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-400 mb-1.5">E-mail</label>
          <input type="email" value={userEmail} disabled
            className="w-full border border-gray-100 rounded-xl px-4 py-3 text-gray-400 text-sm bg-gray-50 cursor-not-allowed" />
        </div>
      </div>

      {/* Segmento */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Segmento</label>
        <div className="flex flex-wrap gap-2">
          {SEGMENTS.map(seg => (
            <button key={seg} type="button" onClick={() => onChange({ segment: seg })}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all border ${
                data.segment === seg
                  ? 'bg-[#369E47]/10 border-[#369E47] text-[#369E47] font-semibold'
                  : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
              }`}>
              {seg}
            </button>
          ))}
        </div>
      </div>

      {/* Tamanho + Logo lado a lado */}
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Tamanho da equipe</label>
          <div className="flex flex-wrap gap-2">
            {SIZES.map(s => (
              <button key={s} type="button" onClick={() => onChange({ companySize: s })}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all border ${
                  data.companySize === s
                    ? 'bg-[#369E47]/10 border-[#369E47] text-[#369E47] font-semibold'
                    : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
                }`}>
                {SIZE_LABELS[s]}
              </button>
            ))}
          </div>
        </div>

        {/* Logo compacto */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Logo <span className="text-gray-400 font-normal">(opcional)</span></label>
          <div onClick={() => fileRef.current?.click()} onDragOver={e => e.preventDefault()}
            onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
            className="cursor-pointer border-2 border-dashed border-gray-200 hover:border-[#369E47] rounded-xl p-4 flex items-center gap-3 transition-colors group">
            <input ref={fileRef} type="file" accept="image/*" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
            {uploading ? (
              <Loader2 className="h-6 w-6 text-[#369E47] animate-spin" />
            ) : data.logoUrl ? (
              <div className="relative flex items-center gap-2">
                <img src={data.logoUrl} alt="Logo" className="h-10 w-auto object-contain rounded" />
                <button type="button" onClick={e => { e.stopPropagation(); onChange({ logoUrl: null }); }}
                  className="text-red-400 hover:text-red-500"><X className="h-4 w-4" /></button>
              </div>
            ) : (
              <>
                <div className="w-9 h-9 rounded-lg bg-gray-100 group-hover:bg-[#369E47]/10 flex items-center justify-center flex-shrink-0 transition-colors">
                  <Upload className="h-4 w-4 text-gray-400 group-hover:text-[#369E47] transition-colors" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-700">Clique ou arraste</p>
                  <p className="text-xs text-gray-400">PNG, JPG, SVG</p>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Step 2: Primeiros passos (um de cada vez) ──────────────────────────────────
function StepPrimeiros() {
  const [current, setCurrent] = useState(0);
  const [watched, setWatched] = useState<number[]>([]);
  const [showVideo, setShowVideo] = useState(false);
  const step = GUIDE_STEPS[current];

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Primeiros passos</h2>
        <p className="text-gray-500 mt-1 text-sm">Veja como tirar o máximo do zaapli desde o início.</p>
      </div>

      {/* Progress pills */}
      <div className="flex gap-1.5">
        {GUIDE_STEPS.map((_, i) => (
          <button key={i} onClick={() => { setCurrent(i); setShowVideo(false); }}
            className={`flex-1 h-1.5 rounded-full transition-all ${
              watched.includes(i) ? 'bg-[#369E47]' :
              i === current ? 'bg-[#369E47]/50' : 'bg-gray-200'
            }`} />
        ))}
      </div>

      {/* Card principal */}
      <div key={current} className="animate-in fade-in slide-in-from-right-4 duration-300">
        {/* Área de vídeo */}
        <div className="relative bg-gray-900 rounded-2xl overflow-hidden aspect-video mb-4">
          {showVideo ? (
            <iframe
              className="w-full h-full"
              src={`https://www.youtube.com/embed/${step.videoId}?autoplay=1`}
              allow="autoplay; fullscreen"
              allowFullScreen
            />
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
              <div className="w-16 h-16 rounded-full bg-[#369E47]/20 border-2 border-[#369E47]/40 flex items-center justify-center">
                {step.icon}
              </div>
              <button
                onClick={() => setShowVideo(true)}
                className="flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white text-sm font-medium px-5 py-2.5 rounded-xl transition-colors border border-white/20"
              >
                <Play className="h-4 w-4" />
                Assistir tutorial — {step.time}
              </button>
              <p className="text-white/40 text-xs">Vídeo ilustrativo — conteúdo real em breve</p>
            </div>
          )}
        </div>

        <div className="flex items-start gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-semibold text-[#369E47] bg-[#369E47]/10 px-2 py-0.5 rounded-full">
                {current + 1} de {GUIDE_STEPS.length}
              </span>
              <span className="text-xs text-gray-400">{step.time}</span>
            </div>
            <h3 className="font-bold text-gray-900 text-lg">{step.title}</h3>
            <p className="text-gray-500 text-sm mt-1">{step.desc}</p>
          </div>
          <button
            type="button"
            onClick={() => setWatched(p => p.includes(current) ? p.filter(x => x !== current) : [...p, current])}
            className={`flex-shrink-0 w-7 h-7 rounded-full border-2 flex items-center justify-center transition-all mt-1 ${
              watched.includes(current) ? 'bg-[#369E47] border-[#369E47]' : 'border-gray-300 hover:border-gray-400'
            }`}
          >
            {watched.includes(current) && <Check className="h-4 w-4 text-white" />}
          </button>
        </div>
      </div>

      {/* Nav entre cards */}
      <div className="flex items-center justify-between pt-2">
        <button type="button" onClick={() => { setCurrent(c => c - 1); setShowVideo(false); }} disabled={current === 0}
          className="text-sm text-gray-400 hover:text-gray-700 disabled:opacity-0 flex items-center gap-1 transition-colors">
          <ChevronLeft className="h-4 w-4" />Anterior
        </button>
        <button type="button" onClick={() => { setCurrent(c => c + 1); setShowVideo(false); }} disabled={current === GUIDE_STEPS.length - 1}
          className="text-sm text-[#369E47] hover:text-[#2d8a3e] disabled:opacity-0 flex items-center gap-1 font-medium transition-colors">
          Próximo<ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

// ── Step 3: Plano (busca do banco) ─────────────────────────────────────────────
function StepPlano({ data, onChange }: { data: FormData; onChange: (f: Partial<FormData>) => void }) {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    createClient()
      .from('plans')
      .select('id, name, monthly_price, token_quota')
      .order('monthly_price', { ascending: true })
      .then(({ data }) => {
        if (data) setPlans(data.filter(p => p.monthly_price > 0));
        setLoading(false);
      });
  }, []);

  const fmt = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const fmtTokens = (n: number) => n >= 1_000_000 ? `${n / 1_000_000}M` : `${n / 1_000}K`;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Escolha seu plano</h2>
        <p className="text-gray-500 mt-1 text-sm">Selecione o plano ideal para o seu momento.</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 text-[#369E47] animate-spin" />
        </div>
      ) : (
        <div className="space-y-3">
          {plans.map(plan => (
            <button key={plan.id} type="button" onClick={() => onChange({ planId: plan.id })}
              className={`w-full text-left rounded-xl border-2 px-5 py-4 transition-all ${
                data.planId === plan.id
                  ? 'border-[#369E47] bg-[#369E47]/5'
                  : 'border-gray-200 bg-white hover:border-gray-300'
              }`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                    data.planId === plan.id ? 'bg-[#369E47] border-[#369E47]' : 'border-gray-300'
                  }`}>
                    {data.planId === plan.id && <Check className="h-3 w-3 text-white" />}
                  </div>
                  <div>
                    <p className="font-bold text-gray-900">{plan.name}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{fmtTokens(plan.token_quota)} tokens/mês</p>
                  </div>
                </div>
                <p className="font-black text-xl text-gray-900">
                  {fmt(plan.monthly_price)}<span className="text-xs font-normal text-gray-400">/mês</span>
                </p>
              </div>
            </button>
          ))}
        </div>
      )}

      <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl border border-gray-100">
        <CreditCard className="h-5 w-5 text-gray-400 flex-shrink-0" />
        <p className="text-sm text-gray-500">Nosso time entrará em contato para finalizar a assinatura.</p>
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function OnboardingPage() {
  const router = useRouter();
  const [started, setStarted] = useState(false);
  const [step, setStep] = useState(1);
  const [dir, setDir] = useState<'fwd' | 'bwd'>('fwd');
  const [animKey, setAnimKey] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [data, setData] = useState<FormData>({
    userName: '', companyName: '', companyPhone: '',
    segment: '', companySize: '', logoUrl: null, planId: '',
  });

  useEffect(() => {
    createClient().auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      setUserEmail(user.email ?? '');
      const name = user.user_metadata?.full_name || user.user_metadata?.name || '';
      if (name) setData(p => ({ ...p, userName: name }));
    });
  }, []);

  const onChange = (fields: Partial<FormData>) => setData(p => ({ ...p, ...fields }));

  const go = (next: number) => {
    setDir(next > step ? 'fwd' : 'bwd');
    setStep(next);
    setAnimKey(k => k + 1);
    setError('');
  };

  const canNext = step === 1 ? data.companyName.trim().length > 0 : true;
  const optional = step === 2;

  async function handleFinish() {
    setSaving(true);
    setError('');
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
          planType: data.planId || 'basic',
          logoUrl: data.logoUrl,
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Erro ao criar conta');
      router.push('/dashboard');
    } catch (e: any) {
      setError(e.message || 'Erro ao salvar. Tente novamente.');
    } finally {
      setSaving(false);
    }
  }

  if (!started) return <HeroSlide onStart={() => setStarted(true)} />;

  const slideIn = dir === 'fwd'
    ? 'animate-in fade-in slide-in-from-right-6 duration-300'
    : 'animate-in fade-in slide-in-from-left-6 duration-300';

  return (
    <div className="min-h-screen bg-white flex">
      {/* Sidebar */}
      <aside className="hidden lg:flex flex-col w-64 border-r border-gray-100 bg-gray-50/50 px-7 py-8 flex-shrink-0">
        <ZaapliLogo iconSize={30} theme="light" />
        <div className="mt-10 space-y-1">
          {STEPS_META.map((label, i) => {
            const n = i + 1;
            const done = step > n;
            const active = step === n;
            return (
              <div key={i} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all ${active ? 'bg-white shadow-sm' : ''}`}>
                <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold transition-all ${
                  done ? 'bg-[#369E47] text-white' :
                  active ? 'ring-2 ring-[#369E47] text-[#369E47] bg-[#369E47]/10' :
                  'bg-gray-100 text-gray-400'
                }`}>
                  {done ? <Check className="h-3.5 w-3.5" /> : n}
                </div>
                <span className={`text-sm font-medium ${active ? 'text-gray-900' : done ? 'text-gray-400' : 'text-gray-400'}`}>{label}</span>
              </div>
            );
          })}
        </div>
        <div className="mt-auto">
          <div className="h-1 bg-gray-200 rounded-full overflow-hidden">
            <div className="h-full bg-[#369E47] rounded-full transition-all duration-500"
              style={{ width: `${((step - 1) / (TOTAL - 1)) * 100}%` }} />
          </div>
          <p className="text-xs text-gray-400 mt-1.5">{Math.round(((step - 1) / (TOTAL - 1)) * 100)}% concluído</p>
        </div>
      </aside>

      {/* Conteúdo */}
      <div className="flex-1 flex flex-col min-h-screen">
        {/* Mobile header */}
        <div className="flex lg:hidden items-center justify-between px-5 py-4 border-b border-gray-100">
          <ZaapliLogo iconSize={26} theme="light" />
          <span className="text-xs text-gray-400 font-medium">{step}/{TOTAL}</span>
        </div>

        <div className="flex-1 flex items-center justify-center px-6 py-10 lg:px-12 xl:px-20">
          <div key={animKey} className={`w-full max-w-xl ${slideIn}`}>
            {step === 1 && <StepEmpresa data={data} onChange={onChange} userEmail={userEmail} />}
            {step === 2 && <StepPrimeiros />}
            {step === 3 && <StepPlano data={data} onChange={onChange} />}
          </div>
        </div>

        {/* Bottom bar */}
        <div className="border-t border-gray-100 px-6 py-4 lg:px-12 xl:px-20 flex items-center justify-between">
          <button type="button" disabled={step === 1} onClick={() => go(step - 1)}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 disabled:opacity-0 disabled:pointer-events-none transition-colors font-medium">
            <ChevronLeft className="h-4 w-4" />Voltar
          </button>

          <div className="flex flex-col items-end gap-1">
            {error && <p className="text-xs text-red-500">{error}</p>}
            <div className="flex items-center gap-3">
              {optional && (
                <button type="button" onClick={() => go(step + 1)}
                  className="text-sm text-gray-400 hover:text-gray-600 transition-colors">
                  Pular
                </button>
              )}
              {step < TOTAL ? (
                <button type="button" onClick={() => go(step + 1)} disabled={!canNext}
                  className="flex items-center gap-2 bg-[#369E47] hover:bg-[#2d8a3e] disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold text-sm px-6 py-2.5 rounded-xl transition-colors shadow-sm">
                  Continuar <ChevronRight className="h-4 w-4" />
                </button>
              ) : (
                <button type="button" onClick={handleFinish} disabled={saving}
                  className="flex items-center gap-2 bg-[#369E47] hover:bg-[#2d8a3e] disabled:opacity-60 text-white font-semibold text-sm px-6 py-2.5 rounded-xl transition-colors shadow-sm">
                  {saving
                    ? <><Loader2 className="h-4 w-4 animate-spin" />Criando conta...</>
                    : <><ArrowRight className="h-4 w-4" />Começar a usar</>}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
