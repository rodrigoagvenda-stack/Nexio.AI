'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { ZaapliLogo } from '@/components/brand/ZaapliLogo';
import { TypeCycle } from '@/components/ui/type-cycle';
import {
  Building2, Phone, Upload, ChevronRight, ChevronLeft,
  Check, Play, MessageSquare, Users, Bot, Zap, ArrowRight,
  Loader2, X, Shield, AlertCircle,
} from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────
interface FormData {
  userName: string;
  companyName: string;
  companyPhone: string;
  segment: string;
  companySize: string;
  logoUrl: string | null;
}

const SEGMENTS = [
  'Tecnologia', 'Saúde', 'Educação', 'Varejo',
  'Imóveis', 'Serviços', 'Financeiro', 'Outro',
];

const SIZES = ['1', '2-10', '11-50', '51-200', '200+'];
const SIZE_LABELS: Record<string, string> = {
  '1': 'Só eu', '2-10': '2–10', '11-50': '11–50', '51-200': '51–200', '200+': '200+',
};

const GUIDE_STEPS = [
  {
    icon: <MessageSquare className="h-5 w-5 text-[#369E47]" />,
    title: 'Conectar seu WhatsApp',
    desc: 'Escaneie o QR Code no painel de Atendimento e receba mensagens em tempo real.',
    time: '2 min',
    videoId: 'dQw4w9WgXcQ',
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

const STEPS_META = ['Sua empresa', 'Primeiros passos', 'Pronto!'];
const TOTAL = STEPS_META.length;

const inputCls = `w-full border border-gray-200 rounded-xl px-4 py-3 text-gray-900 text-sm
  placeholder:text-gray-400 bg-white focus:outline-none focus:border-[#369E47]
  focus:ring-2 focus:ring-[#369E47]/15 transition-all`;

// ── Hero animado ───────────────────────────────────────────────────────────────
function HeroSlide({ onStart }: { onStart: () => void }) {
  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center px-6 relative overflow-hidden">
      {/* Blobs */}
      <div className="absolute -top-40 -left-40 w-[500px] h-[500px] rounded-full bg-[#369E47]/6 blur-3xl animate-pulse pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-[500px] h-[500px] rounded-full bg-[#369E47]/5 blur-3xl animate-pulse pointer-events-none" style={{ animationDelay: '1.2s' }} />

      <div className="relative z-10 text-center max-w-2xl mx-auto">
        {/* Logo */}
        <div className="flex justify-center mb-12 animate-in fade-in slide-in-from-top-4 duration-700">
          <ZaapliLogo iconSize={44} theme="light" animate />
        </div>

        {/* Headline estática */}
        <p
          className="text-lg font-semibold tracking-widest uppercase text-[#369E47]/70 mb-3 animate-in fade-in duration-700"
          style={{ animationDelay: '150ms', animationFillMode: 'both' }}
        >
          CRM · WhatsApp · IA
        </p>

        {/* Slogan principal com typing */}
        <h1
          className="text-5xl sm:text-6xl font-black text-gray-900 leading-[1.1] tracking-tight mb-6 animate-in fade-in slide-in-from-bottom-6 duration-700"
          style={{ animationDelay: '250ms', animationFillMode: 'both' }}
        >
          Venda enquanto{' '}
          <br />
          <TypeCycle
            texts={[
              'você dorme.',
              'a IA trabalha.',
              'os leads chegam.',
              'o bot fecha.',
              'o time descansa.',
            ]}
            typingSpeed={65}
            deletingSpeed={30}
            pauseDuration={2000}
            initialDelay={800}
            variableSpeed={{ min: 45, max: 90 }}
            cursorCharacter="_"
            className="text-[#369E47]"
            cursorClassName="text-[#369E47] font-thin"
          />
        </h1>

        <p
          className="text-lg text-gray-500 mb-10 max-w-lg mx-auto animate-in fade-in slide-in-from-bottom-4 duration-700"
          style={{ animationDelay: '450ms', animationFillMode: 'both' }}
        >
          Do primeiro contato ao fechamento — no piloto automático.
        </p>

        {/* Feature pills */}
        <div
          className="flex flex-wrap items-center justify-center gap-3 mb-12 animate-in fade-in duration-700"
          style={{ animationDelay: '600ms', animationFillMode: 'both' }}
        >
          {[
            'WhatsApp integrado',
            'CRM com Kanban',
            'SDR com IA 24h',
          ].map((item, i) => (
            <span
              key={i}
              className="flex items-center gap-1.5 text-sm text-gray-600 bg-white border border-gray-200 px-4 py-2 rounded-full shadow-sm"
            >
              <Check className="h-3.5 w-3.5 text-[#369E47] flex-shrink-0" />
              {item}
            </span>
          ))}
        </div>

        {/* CTA */}
        <button
          onClick={onStart}
          className="animate-in fade-in zoom-in-95 duration-500 group inline-flex items-center gap-3 bg-[#369E47] hover:bg-[#2d8a3e] text-white font-bold text-lg px-10 py-4 rounded-2xl shadow-lg shadow-[#369E47]/25 hover:shadow-[#369E47]/40 hover:scale-[1.02] transition-all"
          style={{ animationDelay: '700ms', animationFillMode: 'both' }}
        >
          Configurar minha conta
          <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
        </button>

        <p
          className="mt-4 text-xs text-gray-400 animate-in fade-in duration-700"
          style={{ animationDelay: '900ms', animationFillMode: 'both' }}
        >
          Leva menos de 3 minutos · Sem cartão de crédito
        </p>
      </div>
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
    if (!file.type.startsWith('image/')) {
      setUploadError('Envie apenas imagens (PNG, JPG, SVG).');
      return;
    }
    setUploading(true);
    setUploadError('');
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch('/api/onboarding/upload-logo', { method: 'POST', body: form });
      const json = await res.json();
      if (json.url) {
        onChange({ logoUrl: json.url });
      } else {
        setUploadError(json.error || 'Falha no upload. Tente novamente.');
      }
    } catch {
      setUploadError('Erro ao enviar arquivo. Verifique sua conexão.');
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Sua empresa</h2>
        <p className="text-gray-500 mt-1 text-sm">Informações básicas para começar.</p>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Nome da empresa <span className="text-[#369E47]">*</span>
          </label>
          <input
            type="text"
            value={data.companyName}
            onChange={e => onChange({ companyName: e.target.value })}
            placeholder="Ex: Acme Soluções"
            className={inputCls}
            autoFocus
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Seu nome</label>
          <input
            type="text"
            value={data.userName}
            onChange={e => onChange({ userName: e.target.value })}
            placeholder="Como te chamamos?"
            className={inputCls}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            <Phone className="h-3.5 w-3.5 inline mr-1 text-gray-400" />
            WhatsApp da empresa
          </label>
          <input
            type="tel"
            value={data.companyPhone}
            onChange={e => onChange({ companyPhone: e.target.value })}
            placeholder="+55 (11) 99999-9999"
            className={inputCls}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-400 mb-1.5">E-mail</label>
          <input
            type="email"
            value={userEmail}
            disabled
            className="w-full border border-gray-100 rounded-xl px-4 py-3 text-gray-400 text-sm bg-gray-50 cursor-not-allowed"
          />
        </div>
      </div>

      {/* Segmento */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Segmento</label>
        <div className="flex flex-wrap gap-2">
          {SEGMENTS.map(seg => (
            <button
              key={seg}
              type="button"
              onClick={() => onChange({ segment: seg })}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all border ${
                data.segment === seg
                  ? 'bg-[#369E47]/10 border-[#369E47] text-[#369E47] font-semibold'
                  : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
              }`}
            >
              {seg}
            </button>
          ))}
        </div>
      </div>

      {/* Tamanho + Logo */}
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Tamanho da equipe</label>
          <div className="flex flex-wrap gap-2">
            {SIZES.map(s => (
              <button
                key={s}
                type="button"
                onClick={() => onChange({ companySize: s })}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all border ${
                  data.companySize === s
                    ? 'bg-[#369E47]/10 border-[#369E47] text-[#369E47] font-semibold'
                    : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
                }`}
              >
                {SIZE_LABELS[s]}
              </button>
            ))}
          </div>
        </div>

        {/* Logo */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Logo{' '}
            <span className="text-gray-400 font-normal">(opcional)</span>
          </label>
          <div
            onClick={() => !uploading && fileRef.current?.click()}
            onDragOver={e => e.preventDefault()}
            onDrop={e => {
              e.preventDefault();
              const f = e.dataTransfer.files[0];
              if (f) handleFile(f);
            }}
            className={`cursor-pointer border-2 border-dashed rounded-xl p-4 flex items-center gap-3 transition-colors group ${
              uploadError
                ? 'border-red-300 hover:border-red-400'
                : 'border-gray-200 hover:border-[#369E47]'
            }`}
          >
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={e => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
                e.target.value = '';
              }}
            />
            {uploading ? (
              <div className="flex items-center gap-2 text-[#369E47] text-sm">
                <Loader2 className="h-5 w-5 animate-spin" />
                Enviando...
              </div>
            ) : data.logoUrl ? (
              <div className="flex items-center gap-2 w-full">
                <img
                  src={data.logoUrl}
                  alt="Logo"
                  className="h-10 w-auto max-w-[80px] object-contain rounded"
                />
                <span className="text-xs text-gray-500 flex-1">Logo enviado</span>
                <button
                  type="button"
                  onClick={e => {
                    e.stopPropagation();
                    onChange({ logoUrl: null });
                    setUploadError('');
                  }}
                  className="text-red-400 hover:text-red-500 flex-shrink-0"
                >
                  <X className="h-4 w-4" />
                </button>
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
          {uploadError && (
            <p className="mt-1.5 text-xs text-red-500 flex items-center gap-1">
              <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
              {uploadError}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Step 2: Primeiros passos ───────────────────────────────────────────────────
function StepPrimeiros() {
  const [current, setCurrent] = useState(0);
  const [watched, setWatched] = useState<number[]>([]);
  const [showVideo, setShowVideo] = useState(false);
  const step = GUIDE_STEPS[current];

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Primeiros passos</h2>
        <p className="text-gray-500 mt-1 text-sm">
          Veja como tirar o máximo do zaapli desde o início.
        </p>
      </div>

      {/* Progress pills */}
      <div className="flex gap-1.5">
        {GUIDE_STEPS.map((_, i) => (
          <button
            key={i}
            onClick={() => { setCurrent(i); setShowVideo(false); }}
            className={`flex-1 h-1.5 rounded-full transition-all ${
              watched.includes(i)
                ? 'bg-[#369E47]'
                : i === current
                ? 'bg-[#369E47]/50'
                : 'bg-gray-200'
            }`}
          />
        ))}
      </div>

      {/* Card */}
      <div key={current} className="animate-in fade-in slide-in-from-right-4 duration-300">
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
                <Play className="h-4 w-4" /> Assistir tutorial — {step.time}
              </button>
              <p className="text-white/30 text-xs">Conteúdo real em breve</p>
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
            onClick={() =>
              setWatched(p =>
                p.includes(current) ? p.filter(x => x !== current) : [...p, current],
              )
            }
            className={`flex-shrink-0 w-7 h-7 rounded-full border-2 flex items-center justify-center transition-all mt-1 ${
              watched.includes(current)
                ? 'bg-[#369E47] border-[#369E47]'
                : 'border-gray-300 hover:border-gray-400'
            }`}
          >
            {watched.includes(current) && <Check className="h-4 w-4 text-white" />}
          </button>
        </div>
      </div>

      {/* Nav interna */}
      <div className="flex items-center justify-between pt-2">
        <button
          type="button"
          onClick={() => { setCurrent(c => c - 1); setShowVideo(false); }}
          disabled={current === 0}
          className="text-sm text-gray-400 hover:text-gray-700 disabled:opacity-0 flex items-center gap-1 transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />Anterior
        </button>
        <button
          type="button"
          onClick={() => { setCurrent(c => c + 1); setShowVideo(false); }}
          disabled={current === GUIDE_STEPS.length - 1}
          className="text-sm text-[#369E47] hover:text-[#2d8a3e] disabled:opacity-0 flex items-center gap-1 font-medium transition-colors"
        >
          Próximo<ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

// ── Step 3: Pronto! ────────────────────────────────────────────────────────────
function StepPronto({ companyName }: { companyName: string }) {
  const features = [
    {
      icon: <MessageSquare className="h-5 w-5 text-[#369E47]" />,
      title: 'Atendimento multicanal',
      desc: 'Receba e responda mensagens de todos os números em um só lugar.',
    },
    {
      icon: <Bot className="h-5 w-5 text-[#369E47]" />,
      title: 'SDR com IA 24/7',
      desc: 'Nosso agente qualifica leads e agenda reuniões enquanto você descansa.',
    },
    {
      icon: <Users className="h-5 w-5 text-[#369E47]" />,
      title: 'CRM com Kanban',
      desc: 'Visualize o pipeline de vendas e mova negócios de fase com um clique.',
    },
    {
      icon: <Zap className="h-5 w-5 text-[#369E47]" />,
      title: 'Disparos em massa',
      desc: 'Envie campanhas segmentadas para sua base com alta taxa de entrega.',
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <div className="inline-flex items-center gap-2 bg-[#369E47]/10 text-[#369E47] text-xs font-bold px-3 py-1.5 rounded-full mb-4">
          <Check className="h-3.5 w-3.5" /> Conta criada com sucesso
        </div>
        <h2 className="text-2xl font-bold text-gray-900">
          {companyName ? `Bem-vindo, ${companyName}!` : 'Tudo pronto!'}
        </h2>
        <p className="text-gray-500 mt-1 text-sm">
          Seu workspace está configurado. Veja o que você pode fazer agora:
        </p>
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        {features.map((f, i) => (
          <div
            key={i}
            className="flex items-start gap-3 p-4 rounded-xl border border-gray-100 bg-gray-50/60"
          >
            <div className="w-9 h-9 rounded-lg bg-white border border-gray-100 flex items-center justify-center flex-shrink-0 shadow-sm">
              {f.icon}
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-800">{f.title}</p>
              <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{f.desc}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3 p-4 bg-[#369E47]/5 rounded-xl border border-[#369E47]/20">
        <Shield className="h-5 w-5 text-[#369E47] flex-shrink-0" />
        <p className="text-sm text-gray-600">
          Nossa equipe entrará em contato para ajudar na configuração e escolha do plano ideal.
        </p>
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
    userName: '',
    companyName: '',
    companyPhone: '',
    segment: '',
    companySize: '',
    logoUrl: null,
  });

  useEffect(() => {
    createClient()
      .auth.getUser()
      .then(({ data: { user } }) => {
        if (!user) return;
        setUserEmail(user.email ?? '');
        const name =
          user.user_metadata?.full_name || user.user_metadata?.name || '';
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
          planType: 'basic',
          logoUrl: data.logoUrl,
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Erro ao criar conta');
      // Step 3 mostra o resumo — aí o botão vira "Entrar no painel"
      go(3);
    } catch (e: any) {
      setError(e.message || 'Erro ao salvar. Tente novamente.');
    } finally {
      setSaving(false);
    }
  }

  if (!started) return <HeroSlide onStart={() => setStarted(true)} />;

  const slideIn =
    dir === 'fwd'
      ? 'animate-in fade-in slide-in-from-right-6 duration-300'
      : 'animate-in fade-in slide-in-from-left-6 duration-300';

  const isLastSetup = step === 2; // step 2 = Primeiros passos, botão "Criar conta"
  const isDone = step === 3;      // step 3 = success screen

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
              <div
                key={i}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all ${
                  active ? 'bg-white shadow-sm' : ''
                }`}
              >
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold transition-all ${
                    done
                      ? 'bg-[#369E47] text-white'
                      : active
                      ? 'ring-2 ring-[#369E47] text-[#369E47] bg-[#369E47]/10'
                      : 'bg-gray-100 text-gray-400'
                  }`}
                >
                  {done ? <Check className="h-3.5 w-3.5" /> : n}
                </div>
                <span
                  className={`text-sm font-medium ${
                    active ? 'text-gray-900' : 'text-gray-400'
                  }`}
                >
                  {label}
                </span>
              </div>
            );
          })}
        </div>
        <div className="mt-auto">
          <div className="h-1 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-[#369E47] rounded-full transition-all duration-500"
              style={{ width: `${((step - 1) / (TOTAL - 1)) * 100}%` }}
            />
          </div>
          <p className="text-xs text-gray-400 mt-1.5">
            {Math.round(((step - 1) / (TOTAL - 1)) * 100)}% concluído
          </p>
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
            {step === 1 && (
              <StepEmpresa data={data} onChange={onChange} userEmail={userEmail} />
            )}
            {step === 2 && <StepPrimeiros />}
            {step === 3 && <StepPronto companyName={data.companyName} />}
          </div>
        </div>

        {/* Bottom bar */}
        <div className="border-t border-gray-100 px-6 py-4 lg:px-12 xl:px-20 flex items-center justify-between">
          {/* Voltar */}
          {!isDone ? (
            <button
              type="button"
              disabled={step === 1}
              onClick={() => go(step - 1)}
              className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 disabled:opacity-0 disabled:pointer-events-none transition-colors font-medium"
            >
              <ChevronLeft className="h-4 w-4" />Voltar
            </button>
          ) : (
            <span />
          )}

          <div className="flex flex-col items-end gap-1">
            {error && (
              <p className="text-xs text-red-500 flex items-center gap-1">
                <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
                {error}
              </p>
            )}
            <div className="flex items-center gap-3">
              {/* Pular primeiros passos */}
              {step === 2 && (
                <button
                  type="button"
                  onClick={handleFinish}
                  disabled={saving}
                  className="text-sm text-gray-400 hover:text-gray-600 transition-colors"
                >
                  Pular
                </button>
              )}

              {isDone ? (
                <button
                  type="button"
                  onClick={() => router.push('/dashboard')}
                  className="flex items-center gap-2 bg-[#369E47] hover:bg-[#2d8a3e] text-white font-semibold text-sm px-6 py-2.5 rounded-xl transition-colors shadow-sm"
                >
                  <ArrowRight className="h-4 w-4" /> Entrar no painel
                </button>
              ) : isLastSetup ? (
                <button
                  type="button"
                  onClick={handleFinish}
                  disabled={saving}
                  className="flex items-center gap-2 bg-[#369E47] hover:bg-[#2d8a3e] disabled:opacity-60 text-white font-semibold text-sm px-6 py-2.5 rounded-xl transition-colors shadow-sm"
                >
                  {saving ? (
                    <><Loader2 className="h-4 w-4 animate-spin" />Criando conta...</>
                  ) : (
                    <><Check className="h-4 w-4" />Criar minha conta</>
                  )}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => go(step + 1)}
                  disabled={!canNext}
                  className="flex items-center gap-2 bg-[#369E47] hover:bg-[#2d8a3e] disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold text-sm px-6 py-2.5 rounded-xl transition-colors shadow-sm"
                >
                  Continuar <ChevronRight className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
