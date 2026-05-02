'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { ZaapliLogo } from '@/components/brand/ZaapliLogo';
import {
  Building2, User, Phone, Upload, ChevronRight, ChevronLeft,
  Check, Play, MessageSquare, Users, Bot, Zap, ArrowRight,
  Loader2, X, Star, CreditCard, Briefcase, LayoutGrid,
} from 'lucide-react';

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
    id: 'starter', name: 'Starter', price: 'R$ 197', period: '/mês', badge: null,
    features: ['1 número WhatsApp', 'CRM até 500 leads', 'Agente IA SDR', 'Relatórios básicos'],
  },
  {
    id: 'pro', name: 'Pro', price: 'R$ 397', period: '/mês', badge: 'Mais popular',
    features: ['3 números WhatsApp', 'CRM ilimitado', 'IA SDR avançada', 'Agendamento automático', 'Suporte prioritário'],
  },
  {
    id: 'scale', name: 'Scale', price: 'R$ 797', period: '/mês', badge: null,
    features: ['Números ilimitados', 'CRM + API', 'Múltiplos agentes IA', 'White-label', 'Gerente dedicado'],
  },
];

const STEPS_META = [
  { label: 'Sua empresa', icon: <Building2 className="h-4 w-4" /> },
  { label: 'Sobre você',  icon: <Briefcase className="h-4 w-4" /> },
  { label: 'Logo',        icon: <LayoutGrid className="h-4 w-4" /> },
  { label: 'Primeiros passos', icon: <Zap className="h-4 w-4" /> },
  { label: 'Plano',       icon: <Star className="h-4 w-4" /> },
];

const TOTAL = STEPS_META.length;

// ── shared styles ─────────────────────────────────────────────────────────────
const inputCls = `w-full border border-gray-200 rounded-xl px-4 py-3 text-gray-900 text-sm
  placeholder:text-gray-400 bg-white focus:outline-none focus:border-[#369E47]
  focus:ring-2 focus:ring-[#369E47]/15 transition-all`;

// ── Steps ─────────────────────────────────────────────────────────────────────

function StepEmpresa({ data, onChange }: { data: FormData; onChange: (f: Partial<FormData>) => void }) {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Como se chama sua empresa?</h2>
        <p className="text-gray-500 mt-1 text-sm">Esse nome vai aparecer no sistema e nos documentos.</p>
      </div>
      <div className="space-y-4 pt-2">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Nome da empresa <span className="text-[#369E47]">*</span></label>
          <input type="text" value={data.companyName} onChange={e => onChange({ companyName: e.target.value })}
            placeholder="Ex: Acme Soluções" className={inputCls} autoFocus />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Seu nome</label>
          <input type="text" value={data.userName} onChange={e => onChange({ userName: e.target.value })}
            placeholder="Como você prefere ser chamado?" className={inputCls} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-400 mb-1.5">E-mail</label>
          <input type="email" value={data.companyPhone} disabled
            className="w-full border border-gray-100 rounded-xl px-4 py-3 text-gray-400 text-sm bg-gray-50 cursor-not-allowed" />
          <p className="text-xs text-gray-400 mt-1">Vinculado à sua conta</p>
        </div>
      </div>
    </div>
  );
}

function StepSobre({ data, onChange }: { data: FormData; onChange: (f: Partial<FormData>) => void }) {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Conta mais sobre a empresa</h2>
        <p className="text-gray-500 mt-1 text-sm">Vamos personalizar a experiência para o seu mercado.</p>
      </div>
      <div className="space-y-5 pt-2">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            <Phone className="h-4 w-4 inline mr-1 text-gray-400" />WhatsApp da empresa
          </label>
          <input type="tel" value={data.companyPhone} onChange={e => onChange({ companyPhone: e.target.value })}
            placeholder="+55 (11) 99999-9999" className={inputCls} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Segmento de atuação</label>
          <div className="grid grid-cols-3 gap-2">
            {SEGMENTS.map(seg => (
              <button key={seg} type="button" onClick={() => onChange({ segment: seg })}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-all border text-left ${
                  data.segment === seg
                    ? 'bg-[#369E47]/10 border-[#369E47] text-[#369E47] font-semibold'
                    : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
                }`}>
                {seg}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Tamanho da equipe</label>
          <div className="flex flex-wrap gap-2">
            {SIZES.map(s => (
              <button key={s.value} type="button" onClick={() => onChange({ companySize: s.value })}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all border ${
                  data.companySize === s.value
                    ? 'bg-[#369E47]/10 border-[#369E47] text-[#369E47] font-semibold'
                    : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
                }`}>
                {s.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function StepLogo({ data, onChange }: { data: FormData; onChange: (f: Partial<FormData>) => void }) {
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
    } catch (e) { console.error(e); }
    finally { setUploading(false); }
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Adicione a logo da empresa</h2>
        <p className="text-gray-500 mt-1 text-sm">Opcional. Aparece no sistema e nos documentos gerados.</p>
      </div>
      <div
        onClick={() => fileRef.current?.click()}
        onDragOver={e => e.preventDefault()}
        onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
        className="mt-4 cursor-pointer border-2 border-dashed border-gray-200 hover:border-[#369E47] rounded-2xl p-12 flex flex-col items-center gap-3 transition-colors group"
      >
        <input ref={fileRef} type="file" accept="image/*" className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
        {uploading ? (
          <Loader2 className="h-10 w-10 text-[#369E47] animate-spin" />
        ) : data.logoUrl ? (
          <div className="relative">
            <img src={data.logoUrl} alt="Logo" className="h-24 w-auto object-contain" />
            <button type="button" onClick={e => { e.stopPropagation(); onChange({ logoUrl: null }); }}
              className="absolute -top-2 -right-2 bg-red-500 rounded-full p-0.5 text-white hover:bg-red-600">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          <>
            <div className="w-14 h-14 rounded-xl bg-gray-100 group-hover:bg-[#369E47]/10 flex items-center justify-center transition-colors">
              <Upload className="h-6 w-6 text-gray-400 group-hover:text-[#369E47] transition-colors" />
            </div>
            <div className="text-center">
              <p className="font-medium text-gray-700">Clique ou arraste sua logo aqui</p>
              <p className="text-sm text-gray-400 mt-0.5">PNG, JPG ou SVG — até 5 MB</p>
            </div>
          </>
        )}
      </div>
      <p className="text-sm text-gray-400 text-center">Pode pular e adicionar depois em Configurações.</p>
    </div>
  );
}

const GUIDE_STEPS = [
  { icon: <MessageSquare className="h-5 w-5 text-[#369E47]" />, title: 'Conectar seu WhatsApp', desc: 'Escaneie o QR Code no painel de Atendimento.', time: '2 min' },
  { icon: <Users className="h-5 w-5 text-[#369E47]" />, title: 'Adicionar seu primeiro lead', desc: 'Importe uma lista ou cadastre manualmente no CRM.', time: '3 min' },
  { icon: <Bot className="h-5 w-5 text-[#369E47]" />, title: 'Ativar o agente de IA', desc: 'Configure o SDR para atender automaticamente 24h.', time: '5 min' },
  { icon: <Zap className="h-5 w-5 text-[#369E47]" />, title: 'Enviar sua primeira mensagem', desc: 'Use o Atendimento para falar com um lead agora.', time: '1 min' },
];

function StepPrimeiros() {
  const [done, setDone] = useState<number[]>([]);
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">O que fazer primeiro</h2>
        <p className="text-gray-500 mt-1 text-sm">Quatro passos para tirar o máximo do zaapli desde o início.</p>
      </div>
      <div className="space-y-3 pt-2">
        {GUIDE_STEPS.map((s, i) => (
          <div key={i} onClick={() => setDone(p => p.includes(i) ? p.filter(x => x !== i) : [...p, i])}
            className={`flex items-center gap-4 p-4 rounded-xl border cursor-pointer transition-all select-none ${
              done.includes(i) ? 'border-[#369E47]/30 bg-[#369E47]/5' : 'border-gray-200 bg-white hover:border-gray-300'
            }`}>
            <div className="w-10 h-10 rounded-lg bg-[#369E47]/10 flex items-center justify-center flex-shrink-0">
              {s.icon}
            </div>
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-semibold ${done.includes(i) ? 'text-gray-400 line-through' : 'text-gray-900'}`}>{s.title}</p>
              <p className="text-xs text-gray-400 mt-0.5">{s.desc}</p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{s.time}</span>
              {/* video placeholder */}
              <button type="button" onClick={e => e.stopPropagation()}
                className="w-7 h-7 rounded-full bg-gray-100 hover:bg-[#369E47]/10 flex items-center justify-center transition-colors"
                title="Vídeo em breve">
                <Play className="h-3 w-3 text-gray-400" />
              </button>
              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                done.includes(i) ? 'bg-[#369E47] border-[#369E47]' : 'border-gray-300'
              }`}>
                {done.includes(i) && <Check className="h-3 w-3 text-white" />}
              </div>
            </div>
          </div>
        ))}
      </div>
      <p className="text-xs text-gray-400 text-center">Pode pular — os guias ficam disponíveis em Ajuda.</p>
    </div>
  );
}

function StepPlano({ data, onChange }: { data: FormData; onChange: (f: Partial<FormData>) => void }) {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Escolha seu plano</h2>
        <p className="text-gray-500 mt-1 text-sm">14 dias grátis em qualquer plano. Sem cartão agora.</p>
      </div>
      <div className="grid gap-3 pt-2">
        {PLANS.map(plan => (
          <button key={plan.id} type="button" onClick={() => onChange({ planType: plan.id })}
            className={`relative text-left rounded-xl border-2 p-4 transition-all ${
              data.planType === plan.id
                ? 'border-[#369E47] bg-[#369E47]/5'
                : 'border-gray-200 bg-white hover:border-gray-300'
            }`}>
            {plan.badge && (
              <span className="absolute top-4 right-4 bg-[#369E47] text-white text-xs font-semibold px-2.5 py-0.5 rounded-full">
                {plan.badge}
              </span>
            )}
            <div className="flex items-center gap-4">
              <div>
                <p className="font-bold text-gray-900">{plan.name}</p>
                <div className="flex items-baseline gap-0.5 mt-0.5">
                  <span className="text-xl font-black text-gray-900">{plan.price}</span>
                  <span className="text-gray-400 text-xs">{plan.period}</span>
                </div>
              </div>
              <div className="h-10 w-px bg-gray-100 mx-2" />
              <ul className="flex flex-wrap gap-x-4 gap-y-1">
                {plan.features.map((f, i) => (
                  <li key={i} className="flex items-center gap-1 text-xs text-gray-500">
                    <Check className="h-3 w-3 text-[#369E47] flex-shrink-0" />{f}
                  </li>
                ))}
              </ul>
            </div>
            {data.planType === plan.id && (
              <div className="absolute top-4 left-4 w-4 h-4 rounded-full bg-[#369E47] flex items-center justify-center">
                <Check className="h-2.5 w-2.5 text-white" />
              </div>
            )}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl border border-gray-100">
        <CreditCard className="h-5 w-5 text-gray-400 flex-shrink-0" />
        <p className="text-sm text-gray-500">
          Dados de pagamento só são pedidos <strong className="text-gray-700">após o trial de 14 dias</strong>. Cancele quando quiser.
        </p>
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [direction, setDirection] = useState<'fwd' | 'bwd'>('fwd');
  const [animKey, setAnimKey] = useState(0);
  const [saving, setSaving] = useState(false);
  const [userEmail, setUserEmail] = useState('');
  const [data, setData] = useState<FormData>({
    userName: '', companyName: '', companyPhone: '',
    segment: '', companySize: '', logoUrl: null, planType: 'pro',
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
    setDirection(next > step ? 'fwd' : 'bwd');
    setStep(next);
    setAnimKey(k => k + 1);
  };

  const canNext = step === 1 ? data.companyName.trim().length > 0 : true;
  const optional = [2, 3, 4].includes(step);

  async function handleFinish() {
    setSaving(true);
    try {
      const res = await fetch('/api/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyName: data.companyName, companyPhone: data.companyPhone,
          segment: data.segment, companySize: data.companySize,
          userName: data.userName, planType: data.planType, logoUrl: data.logoUrl,
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      router.push('/dashboard');
    } catch { alert('Erro ao salvar. Tente novamente.'); }
    finally { setSaving(false); }
  }

  const slideIn = direction === 'fwd'
    ? 'animate-in slide-in-from-right-6 fade-in duration-300'
    : 'animate-in slide-in-from-left-6 fade-in duration-300';

  return (
    <div className="min-h-screen bg-white flex">

      {/* ── Sidebar esquerda ─────────────────────────────────────────── */}
      <aside className="hidden lg:flex flex-col w-72 xl:w-80 border-r border-gray-100 bg-gray-50/60 px-8 py-10 flex-shrink-0">
        <ZaapliLogo iconSize={32} theme="light" />

        <div className="mt-12 space-y-1">
          {STEPS_META.map((s, i) => {
            const n = i + 1;
            const done = step > n;
            const active = step === n;
            return (
              <div key={i} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all ${active ? 'bg-white shadow-sm' : ''}`}>
                <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 transition-all text-sm font-bold ${
                  done ? 'bg-[#369E47] text-white' :
                  active ? 'bg-[#369E47]/10 text-[#369E47] ring-2 ring-[#369E47]/20' :
                  'bg-gray-100 text-gray-400'
                }`}>
                  {done ? <Check className="h-3.5 w-3.5" /> : n}
                </div>
                <span className={`text-sm font-medium transition-colors ${
                  active ? 'text-gray-900' : done ? 'text-gray-500' : 'text-gray-400'
                }`}>{s.label}</span>
              </div>
            );
          })}
        </div>

        <div className="mt-auto pt-8">
          <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
            <div className="h-full bg-[#369E47] rounded-full transition-all duration-500"
              style={{ width: `${((step - 1) / (TOTAL - 1)) * 100}%` }} />
          </div>
          <p className="text-xs text-gray-400 mt-2">{Math.round(((step - 1) / (TOTAL - 1)) * 100)}% concluído</p>
        </div>
      </aside>

      {/* ── Conteúdo principal ──────────────────────────────────────── */}
      <div className="flex-1 flex flex-col">

        {/* Top bar mobile */}
        <div className="flex lg:hidden items-center justify-between px-6 py-4 border-b border-gray-100">
          <ZaapliLogo iconSize={28} theme="light" />
          <span className="text-xs text-gray-400">{step} / {TOTAL}</span>
        </div>

        {/* Step content */}
        <div className="flex-1 flex items-center justify-center px-6 py-10 lg:px-16 xl:px-24">
          <div key={animKey} className={`w-full max-w-xl ${slideIn}`}>
            {step === 1 && <StepEmpresa data={data} onChange={onChange} />}
            {step === 2 && <StepSobre data={data} onChange={onChange} />}
            {step === 3 && <StepLogo data={data} onChange={onChange} />}
            {step === 4 && <StepPrimeiros />}
            {step === 5 && <StepPlano data={data} onChange={onChange} />}
          </div>
        </div>

        {/* Bottom nav */}
        <div className="border-t border-gray-100 px-6 py-4 lg:px-16 xl:px-24 flex items-center justify-between bg-white">
          <button type="button" disabled={step === 1} onClick={() => go(step - 1)}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 disabled:opacity-0 disabled:pointer-events-none transition-colors font-medium">
            <ChevronLeft className="h-4 w-4" />Voltar
          </button>

          <div className="flex items-center gap-3">
            {optional && (
              <button type="button" onClick={() => go(step + 1)}
                className="text-sm text-gray-400 hover:text-gray-600 transition-colors">
                Pular esta etapa
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
  );
}
