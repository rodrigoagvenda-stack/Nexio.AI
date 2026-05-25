'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { ZaapliLogo } from '@/components/brand/ZaapliLogo';
import { TypeCycle } from '@/components/ui/type-cycle';
import {
  Phone, Upload, ChevronRight, ChevronLeft,
  Check, Play, MessageSquare, Users, Bot, Zap, ArrowRight,
  Loader2, X, Shield, AlertCircle, TrendingUp, Rocket, Sparkles, CreditCard,
} from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────
interface FormData {
  userName: string;
  companyName: string;
  companyPhone: string;
  segment: string;
  companySize: string;
  logoUrl: string | null;
  selectedPlan: string;
}

const PLANS = [
  {
    id: 'starter',
    name: 'Starter',
    price: 397,
    desc: 'Para quem quer vender mais sem contratar mais',
    icon: TrendingUp,
    color: 'green',
    features: ['1 número WhatsApp conectado', 'Agente SDR com IA — 24/7', 'Follow-up automático', 'Base de conhecimento RAG', 'CRM Kanban completo', 'Até 3 atendentes', '5M tokens IA/mês'],
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 597,
    desc: 'Para times que não podem perder nenhuma oportunidade',
    icon: Rocket,
    color: 'blue',
    popular: true,
    features: ['Tudo do Starter', 'Agendamento Google Calendar', 'Relatórios de desempenho', 'Até 10 atendentes', '15M tokens IA/mês'],
  },
  {
    id: 'scale',
    name: 'Scale',
    price: 997,
    desc: 'Para operações que vendem em escala',
    icon: Sparkles,
    color: 'purple',
    features: ['Tudo do Pro', 'Até 10 números WhatsApp', 'Atendentes ilimitados', 'Suporte prioritário', '50M tokens IA/mês'],
  },
];

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
    title: 'Ativar o Nexio',
    desc: 'Configure o SDR de IA para responder e qualificar leads automaticamente 24h.',
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

const STEPS_META = ['Sua empresa', 'Primeiros passos', 'Plano', 'Pronto!'];
const TOTAL = STEPS_META.length;

const inputCls = `w-full border border-gray-200 rounded-xl px-4 py-3 text-gray-900 text-sm
  placeholder:text-gray-400 bg-white focus:outline-none focus:border-[#369E47]
  focus:ring-2 focus:ring-[#369E47]/15 transition-all`;

// ── Hero animado ───────────────────────────────────────────────────────────────
function HeroSlide({ onStart }: { onStart: () => void }) {
  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center px-5 sm:px-8 relative overflow-hidden">
      {/* Blobs */}
      <div className="absolute -top-32 -left-32 w-72 sm:w-[500px] h-72 sm:h-[500px] rounded-full bg-[#369E47]/6 blur-3xl animate-pulse pointer-events-none" />
      <div className="absolute -bottom-32 -right-32 w-72 sm:w-[500px] h-72 sm:h-[500px] rounded-full bg-[#369E47]/5 blur-3xl animate-pulse pointer-events-none" style={{ animationDelay: '1.2s' }} />

      <div className="relative z-10 text-center max-w-2xl mx-auto w-full">
        {/* Logo */}
        <div className="flex justify-center mb-8 sm:mb-12 animate-in fade-in slide-in-from-top-4 duration-700">
          <ZaapliLogo iconSize={40} theme="light" animate />
        </div>

        {/* Eyebrow */}
        <p
          className="text-xs sm:text-sm font-semibold tracking-widest uppercase text-[#369E47]/70 mb-3 animate-in fade-in duration-700"
          style={{ animationDelay: '150ms', animationFillMode: 'both' }}
        >
          CRM · WhatsApp · IA
        </p>

        {/* Headline com typing */}
        <h1
          className="text-4xl sm:text-5xl md:text-6xl font-black text-gray-900 leading-[1.1] tracking-tight mb-5 animate-in fade-in slide-in-from-bottom-6 duration-700"
          style={{ animationDelay: '250ms', animationFillMode: 'both' }}
        >
          Venda enquanto{' '}
          <br className="hidden sm:block" />
          <TypeCycle
            texts={[
              'você dorme.',
              'a IA trabalha.',
              'os leads chegam.',
              'o Zaapply fecha.',
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
          className="text-base sm:text-lg text-gray-500 mb-8 sm:mb-10 max-w-md mx-auto animate-in fade-in slide-in-from-bottom-4 duration-700"
          style={{ animationDelay: '450ms', animationFillMode: 'both' }}
        >
          Do primeiro contato ao fechamento — no piloto automático.
        </p>

        {/* Feature pills */}
        <div
          className="flex flex-wrap items-center justify-center gap-2 sm:gap-3 mb-8 sm:mb-12 animate-in fade-in duration-700"
          style={{ animationDelay: '600ms', animationFillMode: 'both' }}
        >
          {['WhatsApp integrado', 'CRM com Kanban', 'Nexio 24h'].map((item, i) => (
            <span
              key={i}
              className="flex items-center gap-1.5 text-xs sm:text-sm text-gray-600 bg-white border border-gray-200 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full shadow-sm"
            >
              <Check className="h-3 sm:h-3.5 w-3 sm:w-3.5 text-[#369E47] flex-shrink-0" />
              {item}
            </span>
          ))}
        </div>

        {/* CTA */}
        <button
          onClick={onStart}
          className="animate-in fade-in zoom-in-95 duration-500 group w-full sm:w-auto inline-flex items-center justify-center gap-3 bg-[#369E47] hover:bg-[#2d8a3e] text-white font-bold text-base sm:text-lg px-8 sm:px-10 py-4 rounded-2xl shadow-lg shadow-[#369E47]/25 hover:shadow-[#369E47]/40 active:scale-95 transition-all"
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
      setUploadError('Erro ao enviar. Verifique sua conexão.');
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl sm:text-2xl font-bold text-gray-900">Sua empresa</h2>
        <p className="text-gray-500 mt-1 text-sm">Informações básicas para começar.</p>
      </div>

      {/* Nome + Seu nome */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
      </div>

      {/* WhatsApp + E-mail */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
        <div className="flex flex-wrap gap-1.5 sm:gap-2">
          {SEGMENTS.map(seg => (
            <button
              key={seg}
              type="button"
              onClick={() => onChange({ segment: seg })}
              className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-all border ${
                data.segment === seg
                  ? 'bg-[#369E47]/10 border-[#369E47] text-[#369E47] font-semibold'
                  : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300 active:bg-gray-50'
              }`}
            >
              {seg}
            </button>
          ))}
        </div>
      </div>

      {/* Tamanho + Logo */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Tamanho da equipe</label>
          <div className="flex flex-wrap gap-1.5 sm:gap-2">
            {SIZES.map(s => (
              <button
                key={s}
                type="button"
                onClick={() => onChange({ companySize: s })}
                className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-all border ${
                  data.companySize === s
                    ? 'bg-[#369E47]/10 border-[#369E47] text-[#369E47] font-semibold'
                    : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300 active:bg-gray-50'
                }`}
              >
                {SIZE_LABELS[s]}
              </button>
            ))}
          </div>
        </div>

        {/* Logo upload */}
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
            className={`cursor-pointer border-2 border-dashed rounded-xl p-4 flex items-center gap-3 transition-colors group min-h-[64px] ${
              uploadError
                ? 'border-red-300 hover:border-red-400 bg-red-50/40'
                : data.logoUrl
                ? 'border-[#369E47]/40 bg-[#369E47]/5'
                : 'border-gray-200 hover:border-[#369E47] active:bg-gray-50'
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
                <Loader2 className="h-5 w-5 animate-spin flex-shrink-0" />
                Enviando...
              </div>
            ) : data.logoUrl ? (
              <div className="flex items-center gap-2 w-full min-w-0">
                <img
                  src={data.logoUrl}
                  alt="Logo"
                  className="h-10 w-auto max-w-[80px] object-contain rounded flex-shrink-0"
                />
                <span className="text-xs text-gray-500 flex-1 truncate">Logo enviado ✓</span>
                <button
                  type="button"
                  onClick={e => {
                    e.stopPropagation();
                    onChange({ logoUrl: null });
                    setUploadError('');
                  }}
                  className="text-red-400 hover:text-red-500 flex-shrink-0 p-1"
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
            <p className="mt-1.5 text-xs text-red-500 flex items-start gap-1">
              <AlertCircle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
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
    <div className="space-y-4 sm:space-y-5">
      <div>
        <h2 className="text-xl sm:text-2xl font-bold text-gray-900">Primeiros passos</h2>
        <p className="text-gray-500 mt-1 text-sm">
          Veja como tirar o máximo do zaapply desde o início.
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
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 sm:gap-4 px-4">
              <div className="w-12 sm:w-16 h-12 sm:h-16 rounded-full bg-[#369E47]/20 border-2 border-[#369E47]/40 flex items-center justify-center">
                {step.icon}
              </div>
              <button
                onClick={() => setShowVideo(true)}
                className="flex items-center gap-2 bg-white/10 hover:bg-white/20 active:bg-white/30 text-white text-sm font-medium px-4 sm:px-5 py-2.5 rounded-xl transition-colors border border-white/20"
              >
                <Play className="h-4 w-4 flex-shrink-0" /> Assistir tutorial — {step.time}
              </button>
              <p className="text-white/30 text-xs text-center">Conteúdo real em breve</p>
            </div>
          )}
        </div>

        <div className="flex items-start gap-3 sm:gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="text-xs font-semibold text-[#369E47] bg-[#369E47]/10 px-2 py-0.5 rounded-full whitespace-nowrap">
                {current + 1} de {GUIDE_STEPS.length}
              </span>
              <span className="text-xs text-gray-400">{step.time}</span>
            </div>
            <h3 className="font-bold text-gray-900 text-base sm:text-lg">{step.title}</h3>
            <p className="text-gray-500 text-sm mt-1 leading-relaxed">{step.desc}</p>
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
      <div className="flex items-center justify-between pt-1">
        <button
          type="button"
          onClick={() => { setCurrent(c => c - 1); setShowVideo(false); }}
          disabled={current === 0}
          className="text-sm text-gray-400 hover:text-gray-700 disabled:opacity-0 disabled:pointer-events-none flex items-center gap-1 transition-colors py-2"
        >
          <ChevronLeft className="h-4 w-4" />Anterior
        </button>
        <button
          type="button"
          onClick={() => { setCurrent(c => c + 1); setShowVideo(false); }}
          disabled={current === GUIDE_STEPS.length - 1}
          className="text-sm text-[#369E47] hover:text-[#2d8a3e] disabled:opacity-0 disabled:pointer-events-none flex items-center gap-1 font-medium transition-colors py-2"
        >
          Próximo<ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

// ── Step 3: Plano ─────────────────────────────────────────────────────────────
function StepPlanos({
  selected,
  onSelect,
}: {
  selected: string;
  onSelect: (plan: string) => void;
}) {
  const colorMap: Record<string, { ring: string; bg: string; text: string; badge: string }> = {
    green:  { ring: 'ring-[#369E47] border-[#369E47]', bg: 'bg-[#369E47]/10', text: 'text-[#369E47]', badge: 'bg-[#369E47] text-white' },
    blue:   { ring: 'ring-blue-500 border-blue-500',   bg: 'bg-blue-50',       text: 'text-blue-600',   badge: 'bg-blue-600 text-white' },
    purple: { ring: 'ring-purple-500 border-purple-500', bg: 'bg-purple-50',   text: 'text-purple-600', badge: 'bg-purple-600 text-white' },
  };

  const isTrialSelected = selected === 'trial';

  return (
    <div className="space-y-4 sm:space-y-5">
      <div>
        <h2 className="text-xl sm:text-2xl font-bold text-gray-900">Escolha seu plano</h2>
        <p className="text-gray-500 mt-1 text-sm">
          Você pode alterar ou cancelar a qualquer momento.
        </p>
      </div>

      {/* Trial banner */}
      <button
        type="button"
        onClick={() => onSelect('trial')}
        className={`w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl border-2 transition-all text-left ${
          isTrialSelected
            ? 'border-[#369E47] ring-2 ring-[#369E47] bg-[#369E47]/5'
            : 'border-dashed border-gray-300 hover:border-[#369E47]/60 hover:bg-gray-50'
        }`}
      >
        <div className="w-9 h-9 rounded-xl bg-[#369E47]/10 flex items-center justify-center flex-shrink-0">
          <Zap className="h-4 w-4 text-[#369E47]" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-bold text-gray-900 text-sm">Testar grátis por 7 dias</p>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#369E47] text-white">SEM CARTÃO</span>
          </div>
          <p className="text-xs text-gray-500 mt-0.5">CRM completo · Veja como funciona antes de assinar</p>
        </div>
        {isTrialSelected && (
          <span className="w-5 h-5 rounded-full bg-[#369E47] flex items-center justify-center flex-shrink-0">
            <Check className="h-3 w-3 text-white" />
          </span>
        )}
      </button>

      <div className="relative flex items-center gap-3">
        <div className="flex-1 border-t border-gray-100" />
        <p className="text-xs text-gray-400 flex-shrink-0">ou assine agora</p>
        <div className="flex-1 border-t border-gray-100" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {PLANS.map((plan) => {
          const Icon = plan.icon;
          const c = colorMap[plan.color];
          const isSelected = selected === plan.id;
          return (
            <button
              key={plan.id}
              type="button"
              onClick={() => onSelect(plan.id)}
              className={`relative text-left rounded-2xl border-2 p-4 transition-all ${
                isSelected
                  ? `${c.ring} ring-2 shadow-sm`
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              {plan.popular && (
                <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-blue-600 text-white whitespace-nowrap">
                  Mais popular
                </span>
              )}
              {isSelected && (
                <span className="absolute top-3 right-3 w-5 h-5 rounded-full bg-[#369E47] flex items-center justify-center">
                  <Check className="h-3 w-3 text-white" />
                </span>
              )}
              <div className={`w-8 h-8 rounded-lg ${c.bg} flex items-center justify-center mb-3`}>
                <Icon className={`h-4 w-4 ${c.text}`} />
              </div>
              <p className="font-bold text-gray-900 text-sm">{plan.name}</p>
              <p className="text-xs text-gray-500 mb-2">{plan.desc}</p>
              <p className="font-black text-gray-900">
                R$ {plan.price}
                <span className="text-xs font-normal text-gray-400">/mês</span>
              </p>
              <ul className="mt-3 space-y-1">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-center gap-1.5 text-xs text-gray-600">
                    <Check className="h-3 w-3 text-[#369E47] flex-shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Step 4: Pronto! ────────────────────────────────────────────────────────────
function StepPronto({ companyName }: { companyName: string }) {
  const features = [
    {
      icon: <MessageSquare className="h-4 sm:h-5 w-4 sm:w-5 text-[#369E47]" />,
      title: 'Atendimento multicanal',
      desc: 'Receba e responda mensagens de todos os números em um só lugar.',
    },
    {
      icon: <Bot className="h-4 sm:h-5 w-4 sm:w-5 text-[#369E47]" />,
      title: 'Agente SDR com IA',
      desc: 'Responde, qualifica e atende seus leads automaticamente 24h por dia.',
    },
    {
      icon: <Users className="h-4 sm:h-5 w-4 sm:w-5 text-[#369E47]" />,
      title: 'CRM com Kanban',
      desc: 'Visualize o pipeline e mova negócios de fase com um clique.',
    },
    {
      icon: <Zap className="h-4 sm:h-5 w-4 sm:w-5 text-[#369E47]" />,
      title: 'Automações de atendimento',
      desc: 'Crie fluxos automáticos para qualificar e distribuir leads para o time.',
    },
  ];

  return (
    <div className="space-y-5 sm:space-y-6">
      <div>
        <div className="inline-flex items-center gap-2 bg-[#369E47]/10 text-[#369E47] text-xs font-bold px-3 py-1.5 rounded-full mb-3 sm:mb-4">
          <Check className="h-3.5 w-3.5" /> Conta criada com sucesso
        </div>
        <h2 className="text-xl sm:text-2xl font-bold text-gray-900">
          {companyName ? `Bem-vindo, ${companyName}!` : 'Tudo pronto!'}
        </h2>
        <p className="text-[#369E47] font-semibold text-sm mt-0.5">Venda enquanto dorme.</p>
        <p className="text-gray-500 mt-1 text-sm">
          Seu workspace está configurado. Veja o que você pode fazer agora:
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
        {features.map((f, i) => (
          <div
            key={i}
            className="flex items-start gap-3 p-3 sm:p-4 rounded-xl border border-gray-100 bg-gray-50/60"
          >
            <div className="w-8 sm:w-9 h-8 sm:h-9 rounded-lg bg-white border border-gray-100 flex items-center justify-center flex-shrink-0 shadow-sm">
              {f.icon}
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-800">{f.title}</p>
              <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{f.desc}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-start gap-3 p-3 sm:p-4 bg-[#369E47]/5 rounded-xl border border-[#369E47]/20">
        <Shield className="h-5 w-5 text-[#369E47] flex-shrink-0 mt-0.5" />
        <p className="text-sm text-gray-600 leading-relaxed">
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
    selectedPlan: 'trial',
  });

  // CPF/CNPJ modal para planos pagos
  const [cpfCnpjInput, setCpfCnpjInput] = useState('');
  const [showCpfModal, setShowCpfModal] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);

  useEffect(() => {
    createClient()
      .auth.getUser()
      .then(({ data: { user } }) => {
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
    // Scroll to top on mobile
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const canNext = step === 1 ? data.companyName.trim().length > 0 : true;
  const isLastSetup = step === 3; // step 3 = planos
  const isDone = step === 4;

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
          planType: data.selectedPlan,
          logoUrl: data.logoUrl,
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Erro ao criar conta');

      // Se plano pago, abre modal CPF/CNPJ para checkout
      const isPaid = data.selectedPlan !== 'basic' && data.selectedPlan !== 'trial';
      if (isPaid) {
        setSaving(false);
        setShowCpfModal(true);
        return;
      }
      go(4);
    } catch (e: any) {
      setError(e.message || 'Erro ao salvar. Tente novamente.');
    } finally {
      setSaving(false);
    }
  }

  async function handleCheckout() {
    const doc = cpfCnpjInput.replace(/\D/g, '');
    if (doc.length !== 11 && doc.length !== 14) {
      setError('CPF (11 dígitos) ou CNPJ (14 dígitos) inválido.');
      return;
    }
    setCheckoutLoading(true);
    setError('');
    try {
      const res = await fetch('/api/asaas/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: data.selectedPlan, cpfCnpj: doc }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      if (d.url) {
        window.location.href = d.url;
      } else {
        setShowCpfModal(false);
        go(4);
      }
    } catch (e: any) {
      setError(e.message || 'Erro no checkout.');
    } finally {
      setCheckoutLoading(false);
    }
  }

  if (!started) return <HeroSlide onStart={() => setStarted(true)} />;

  const slideIn =
    dir === 'fwd'
      ? 'animate-in fade-in slide-in-from-right-6 duration-300'
      : 'animate-in fade-in slide-in-from-left-6 duration-300';

  return (
    <div className="min-h-screen bg-white flex flex-col lg:flex-row">
      {/* Sidebar — desktop only */}
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
                <span className={`text-sm font-medium ${active ? 'text-gray-900' : 'text-gray-400'}`}>
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

      {/* Conteúdo principal */}
      <div className="flex-1 flex flex-col min-h-screen lg:min-h-0">

        {/* Mobile header */}
        <div className="flex lg:hidden items-center justify-between px-4 py-3 border-b border-gray-100 sticky top-0 bg-white z-10">
          <ZaapliLogo iconSize={24} theme="light" />
          {/* Mobile steps mini */}
          <div className="flex items-center gap-1.5">
            {STEPS_META.map((_, i) => {
              const n = i + 1;
              const done = step > n;
              const active = step === n;
              return (
                <div
                  key={i}
                  className={`w-2 h-2 rounded-full transition-all ${
                    done ? 'bg-[#369E47]' : active ? 'bg-[#369E47]/60 w-4' : 'bg-gray-200'
                  }`}
                />
              );
            })}
          </div>
          <span className="text-xs text-gray-400 font-medium">{step}/{TOTAL}</span>
        </div>

        {/* Step content */}
        <div className="flex-1 overflow-y-auto">
          <div className="min-h-full flex items-start sm:items-center justify-center px-4 sm:px-6 py-6 sm:py-10 lg:px-12 xl:px-20">
            <div key={animKey} className={`w-full max-w-xl ${step === 3 ? 'max-w-2xl' : 'max-w-xl'} ${slideIn}`}>
              {step === 1 && (
                <StepEmpresa data={data} onChange={onChange} userEmail={userEmail} />
              )}
              {step === 2 && <StepPrimeiros />}
              {step === 3 && (
                <StepPlanos
                  selected={data.selectedPlan}
                  onSelect={(plan) => onChange({ selectedPlan: plan })}
                />
              )}
              {step === 4 && <StepPronto companyName={data.companyName} />}
            </div>
          </div>
        </div>

        {/* Modal CPF/CNPJ para checkout */}
        {showCpfModal && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4 animate-in fade-in zoom-in-95 duration-200">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#369E47]/10 flex items-center justify-center flex-shrink-0">
                  <CreditCard className="h-5 w-5 text-[#369E47]" />
                </div>
                <div>
                  <p className="font-bold text-gray-900 text-sm">Dados de cobrança</p>
                  <p className="text-xs text-gray-500">Necessário para emissão da fatura</p>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">CPF ou CNPJ</label>
                <input
                  type="text"
                  value={cpfCnpjInput}
                  onChange={e => { setCpfCnpjInput(e.target.value); setError(''); }}
                  placeholder="000.000.000-00 ou 00.000.000/0001-00"
                  className={inputCls}
                  autoFocus
                  onKeyDown={e => e.key === 'Enter' && handleCheckout()}
                />
                {error && (
                  <p className="mt-1.5 text-xs text-red-500 flex items-center gap-1">
                    <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />{error}
                  </p>
                )}
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => { setShowCpfModal(false); setError(''); }}
                  className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleCheckout}
                  disabled={checkoutLoading}
                  className="flex-1 py-2.5 rounded-xl bg-[#369E47] hover:bg-[#2d8a3e] disabled:opacity-60 text-white text-sm font-semibold flex items-center justify-center gap-2 transition-colors"
                >
                  {checkoutLoading
                    ? <><Loader2 className="h-4 w-4 animate-spin" />Aguarde…</>
                    : <><ArrowRight className="h-4 w-4" />Ir para pagamento</>}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Bottom bar — fixo no mobile */}
        <div className="sticky bottom-0 bg-white border-t border-gray-100 px-4 sm:px-6 py-3 sm:py-4 lg:px-12 xl:px-20 flex items-center justify-between gap-2 z-10">
          {/* Voltar */}
          {!isDone ? (
            <button
              type="button"
              disabled={step === 1}
              onClick={() => go(step - 1)}
              className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900 disabled:opacity-0 disabled:pointer-events-none transition-colors font-medium py-2 px-1 flex-shrink-0"
            >
              <ChevronLeft className="h-4 w-4" />
              <span className="hidden sm:inline">Voltar</span>
            </button>
          ) : (
            <span />
          )}

          <div className="flex flex-col items-end gap-1 min-w-0">
            {error && (
              <p className="text-xs text-red-500 flex items-center gap-1 text-right">
                <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
                <span className="line-clamp-2">{error}</span>
              </p>
            )}
            <div className="flex items-center gap-2 sm:gap-3">
              {/* Pular primeiros passos */}
              {step === 2 && (
                <button
                  type="button"
                  onClick={() => go(3)}
                  className="text-xs sm:text-sm text-gray-400 hover:text-gray-600 transition-colors whitespace-nowrap"
                >
                  Pular
                </button>
              )}

              {isDone ? (
                <button
                  type="button"
                  onClick={() => router.push('/dashboard')}
                  className="flex items-center gap-2 bg-[#369E47] hover:bg-[#2d8a3e] active:bg-[#267535] text-white font-semibold text-sm px-5 sm:px-6 py-2.5 rounded-xl transition-colors shadow-sm whitespace-nowrap"
                >
                  <ArrowRight className="h-4 w-4" /> Entrar no painel
                </button>
              ) : isLastSetup ? (
                <button
                  type="button"
                  onClick={handleFinish}
                  disabled={saving}
                  className="flex items-center gap-2 bg-[#369E47] hover:bg-[#2d8a3e] active:bg-[#267535] disabled:opacity-60 text-white font-semibold text-sm px-5 sm:px-6 py-2.5 rounded-xl transition-colors shadow-sm whitespace-nowrap"
                >
                  {saving ? (
                    <><Loader2 className="h-4 w-4 animate-spin" /><span className="hidden sm:inline">Criando...</span><span className="sm:hidden">...</span></>
                  ) : data.selectedPlan === 'trial' ? (
                    <><Zap className="h-4 w-4" />Iniciar teste grátis</>
                  ) : data.selectedPlan === 'basic' ? (
                    <><Check className="h-4 w-4" />Criar conta grátis</>
                  ) : (
                    <><CreditCard className="h-4 w-4" />Criar conta e assinar</>
                  )}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => go(step + 1)}
                  disabled={!canNext}
                  className="flex items-center gap-1.5 bg-[#369E47] hover:bg-[#2d8a3e] active:bg-[#267535] disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold text-sm px-5 sm:px-6 py-2.5 rounded-xl transition-colors shadow-sm whitespace-nowrap"
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
