'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ArrowRight, Loader2, Check } from 'lucide-react';

interface BriefingConfig {
  id: number;
  company_id: number;
  slug: string;
  primary_color: string;
  theme: 'dark' | 'light';
  logo_url?: string;
  title?: string;
  description?: string;
  success_message?: string;
  whatsapp_required?: boolean;
  whatsapp_label?: string;
}

interface BriefingQuestion {
  id: number;
  label: string;
  field_key: string;
  question_type: 'text' | 'textarea' | 'select' | 'multiselect' | 'radio' | 'checkbox';
  options?: string[];
  is_required: boolean;
  order_index: number;
}


export default function BriefingPublicPage() {
  const params = useParams();
  const slug = params.slug as string;

  const [config, setConfig] = useState<BriefingConfig | null>(null);
  const [questions, setQuestions] = useState<BriefingQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [currentStep, setCurrentStep] = useState(-1); // -1 = welcome
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [submitError, setSubmitError] = useState('');

  useEffect(() => {
    fetchBriefing();
  }, [slug]);

  async function fetchBriefing() {
    try {
      const res = await fetch(`/api/briefing/public/${slug}`);
      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.message || 'Briefing não encontrado');
        return;
      }

      setConfig(data.data.config);
      setQuestions(data.data.questions);

      const initial: Record<string, any> = {};
      data.data.questions.forEach((q: BriefingQuestion) => {
        initial[q.field_key] = isMulti(q.question_type) ? [] : '';
      });
      if (data.data.config.whatsapp_required !== false) {
        initial['whatsapp'] = '';
      }
      setAnswers(initial);
    } catch {
      setError('Erro ao carregar briefing');
    } finally {
      setLoading(false);
    }
  }

  function isMulti(type: string) {
    return type === 'multiselect' || type === 'checkbox';
  }

  function isChoices(type: string) {
    return ['select', 'radio', 'multiselect', 'checkbox'].includes(type);
  }

  function interpolate(text: string) {
    return text.replace(/\{\{(\w+)\}\}/g, (_, key) => answers[key] || `{{${key}}}`);
  }

  function formatPhone(raw: string) {
    const digits = raw.replace(/\D/g, '').slice(0, 11);
    if (digits.length <= 2) return digits;
    if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    if (digits.length <= 11) return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
    return digits;
  }

  const hasWhatsapp = config?.whatsapp_required !== false;
  const whatsappStep = hasWhatsapp ? questions.length : -99; // índice do step de whatsapp
  const totalSteps = questions.length + (hasWhatsapp ? 1 : 0);
  const progress = currentStep === -1 ? 0 : ((currentStep + 1) / totalSteps) * 100;
  const primaryColor = config?.primary_color || '#7c3aed';
  const isDark = (config?.theme ?? 'dark') === 'dark';
  const bgClass = isDark ? 'bg-[#0a0a0a]' : 'bg-white';
  const textClass = isDark ? 'text-white' : 'text-gray-900';
  const mutedClass = isDark ? 'text-gray-400' : 'text-gray-500';
  const borderClass = isDark ? 'border-gray-700' : 'border-gray-200';
  const hoverClass = isDark ? 'hover:bg-gray-800' : 'hover:bg-gray-50';

  const isWhatsappStep = hasWhatsapp && currentStep === whatsappStep;
  const currentQuestion = !isWhatsappStep ? (questions[currentStep] ?? null) : null;

  function canAdvance() {
    if (isWhatsappStep) {
      const digits = (answers['whatsapp'] || '').replace(/\D/g, '');
      return digits.length >= 10;
    }
    if (!currentQuestion) return false;
    if (!currentQuestion.is_required) return true;
    const val = answers[currentQuestion.field_key];
    if (isMulti(currentQuestion.question_type)) return Array.isArray(val) && val.length > 0;
    return !!val && val !== '';
  }

  function setAnswer(key: string, value: any) {
    setAnswers((prev) => ({ ...prev, [key]: value }));
  }

  function toggleMulti(key: string, opt: string) {
    setAnswers((prev) => {
      const cur: string[] = prev[key] || [];
      return {
        ...prev,
        [key]: cur.includes(opt) ? cur.filter((v) => v !== opt) : [...cur, opt],
      };
    });
  }

  function nextStep() {
    if (currentStep === -1) {
      setCurrentStep(0);
      return;
    }
    if (!canAdvance()) return;
    if (currentStep < totalSteps - 1) {
      setCurrentStep((p) => p + 1);
    } else {
      handleSubmit();
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && (isWhatsappStep || !isChoices(currentQuestion?.question_type ?? ''))) {
      nextStep();
    }
  }

  async function handleSubmit() {
    setSubmitting(true);
    try {
      // Formatar whatsapp com código do país antes de enviar
      const finalAnswers = { ...answers };
      if (finalAnswers['whatsapp']) {
        const digits = finalAnswers['whatsapp'].replace(/\D/g, '');
        finalAnswers['whatsapp'] = digits.startsWith('55') ? digits : `55${digits}`;
      }
      const res = await fetch(`/api/briefing/public/${slug}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers: finalAnswers }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);
      setSubmitted(true);
    } catch (err: any) {
      setSubmitError(err.message || 'Erro ao enviar. Tente novamente.');
    } finally {
      setSubmitting(false);
    }
  }

  // ─── Loading ─────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // ─── Error ───────────────────────────────────────────────
  if (error || !config) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center space-y-3">
          <p className="text-4xl">😕</p>
          <h2 className="text-2xl font-semibold">Briefing não encontrado</h2>
          <p className="text-muted-foreground">{error || 'Este link pode estar inativo ou incorreto.'}</p>
        </div>
      </div>
    );
  }

  const submitBtn = (
    <Button
      size="lg"
      onClick={nextStep}
      disabled={!canAdvance() || submitting}
      className="text-white"
      style={{ backgroundColor: primaryColor }}
    >
      {submitting
        ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Enviando...</>
        : <>Enviar</>}
    </Button>
  );

  const nextBtn = (
    <Button
      size="lg"
      onClick={nextStep}
      disabled={!canAdvance()}
      className="text-white"
      style={{ backgroundColor: primaryColor }}
    >
      OK <ArrowRight className="ml-2 h-5 w-5" />
    </Button>
  );

  // ─── Success ─────────────────────────────────────────────
  if (submitted) {
    const successMsg = config.success_message || 'Obrigado pelo preenchimento! Entraremos em contato em breve.';
    return (
      <div className={`min-h-screen ${bgClass} flex items-center justify-center p-4`}>
        <div className={`max-w-2xl w-full text-center space-y-6 animate-in fade-in duration-500 ${textClass}`}>
          {config.logo_url && (
            <img src={config.logo_url} alt="Logo" className="h-16 md:h-20 w-auto object-contain mx-auto" style={{ maxWidth: '240px' }} />
          )}
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center mx-auto"
            style={{ backgroundColor: `${primaryColor}22` }}
          >
            <Check className="h-8 w-8" style={{ color: primaryColor }} />
          </div>
          <h1 className="text-4xl md:text-5xl font-semibold">Enviado!</h1>
          <p className={`text-lg whitespace-pre-wrap ${mutedClass}`}>{successMsg}</p>
        </div>
      </div>
    );
  }

  // ─── Submit Error ─────────────────────────────────────────
  if (submitError) {
    return (
      <div className={`min-h-screen ${bgClass} flex items-center justify-center p-4`}>
        <div className={`max-w-2xl w-full text-center space-y-6 animate-in fade-in duration-500 ${textClass}`}>
          {config.logo_url && (
            <img src={config.logo_url} alt="Logo" className="h-16 md:h-20 w-auto object-contain mx-auto" style={{ maxWidth: '240px' }} />
          )}
          <p className="text-5xl">😕</p>
          <h1 className="text-3xl font-semibold">Algo deu errado</h1>
          <p className={`text-base ${mutedClass}`}>{submitError}</p>
          <Button
            onClick={() => setSubmitError('')}
            className="text-white"
            style={{ backgroundColor: primaryColor }}
          >
            Tentar novamente
          </Button>
        </div>
      </div>
    );
  }

  // ─── Welcome Screen ──────────────────────────────────────
  if (currentStep === -1) {
    return (
      <div className={`min-h-screen ${bgClass} flex items-center justify-center p-4`}>
        <div className={`max-w-2xl w-full text-center space-y-8 animate-in fade-in duration-500 ${textClass}`}>
          {config.logo_url ? (
            <img src={config.logo_url} alt="Logo" className="h-16 md:h-20 w-auto object-contain mx-auto" style={{ maxWidth: '240px' }} />
          ) : (
            <div className="h-1 w-16 mx-auto rounded-full" style={{ backgroundColor: primaryColor }} />
          )}
          <h1 className="text-4xl md:text-5xl font-semibold">
            {config.title || 'Preencha seu briefing'}
          </h1>
          {config.description && (
            <p className={`text-lg max-w-xl mx-auto ${mutedClass}`}>{config.description}</p>
          )}
          <Button
            size="lg"
            onClick={nextStep}
            className="text-base px-8 py-6 text-white"
            style={{ backgroundColor: primaryColor }}
          >
            Começar
            <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
        </div>
      </div>
    );
  }

  const isLast = currentStep === totalSteps - 1;
  const actionBtn = isLast ? submitBtn : nextBtn;

  // ─── WhatsApp Step ────────────────────────────────────────
  if (isWhatsappStep) {
    const phoneVal = answers['whatsapp'] || '';
    const canGo = phoneVal.replace(/\D/g, '').length >= 10;
    return (
      <div className={`min-h-screen ${bgClass} ${textClass}`} onKeyDown={handleKeyDown}>
        <div className="fixed top-5 left-6 z-50">
          {config.logo_url ? (
            <img src={config.logo_url} alt="Logo" className="h-10 md:h-12 w-auto object-contain" style={{ maxWidth: '160px' }} />
          ) : (
            <div className="h-1 w-10 rounded-full" style={{ backgroundColor: primaryColor }} />
          )}
        </div>
        <div className={`fixed top-0 left-0 right-0 h-1 z-50 ${isDark ? 'bg-gray-800' : 'bg-gray-200'}`}>
          <div className="h-full transition-all duration-300" style={{ width: `${progress}%`, backgroundColor: primaryColor }} />
        </div>
        <div className="flex items-center justify-center min-h-screen px-6 sm:px-10 md:px-8 pt-24 pb-10">
          <div className="max-w-2xl w-full animate-in fade-in duration-300">
            <div className="mb-4">
              <span className={`text-sm ${mutedClass}`}>{currentStep + 1} → {totalSteps}</span>
            </div>
            <div className="space-y-6">
              <h2 className="text-3xl md:text-4xl font-medium leading-snug">
                {config.whatsapp_label || 'Qual o seu WhatsApp?'} <span className="text-red-500 ml-1 text-2xl">*</span>
              </h2>
              <div className={`flex items-center border-b-2 ${borderClass} py-2 gap-3`}>
                <span className="flex items-center gap-1.5 text-xl shrink-0 select-none">
                  🇧🇷 <span className={`text-base font-medium ${mutedClass}`}>+55</span>
                </span>
                <input
                  type="tel"
                  value={formatPhone(phoneVal)}
                  onChange={(e) => setAnswer('whatsapp', e.target.value.replace(/\D/g, ''))}
                  placeholder="(11) 99999-9999"
                  autoFocus
                  className={`flex-1 text-xl bg-transparent outline-none placeholder:opacity-40 ${textClass}`}
                />
              </div>
              <Button
                size="lg"
                onClick={nextStep}
                disabled={!canGo || submitting}
                className="text-white"
                style={{ backgroundColor: primaryColor }}
              >
                {submitting
                  ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Enviando...</>
                  : <>Enviar</>}
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const q = currentQuestion!;

  // ─── Question Screens ────────────────────────────────────
  return (
    <div className={`min-h-screen ${bgClass} ${textClass}`} onKeyDown={handleKeyDown}>
      {/* Logo fixo */}
      <div className="fixed top-5 left-6 z-50">
        {config.logo_url ? (
          <img src={config.logo_url} alt="Logo" className="h-10 md:h-12 w-auto object-contain" style={{ maxWidth: '160px' }} />
        ) : (
          <div className="h-1 w-10 rounded-full" style={{ backgroundColor: primaryColor }} />
        )}
      </div>

      {/* Barra de progresso */}
      <div className={`fixed top-0 left-0 right-0 h-1 z-50 ${isDark ? 'bg-gray-800' : 'bg-gray-200'}`}>
        <div
          className="h-full transition-all duration-300"
          style={{ width: `${progress}%`, backgroundColor: primaryColor }}
        />
      </div>

      {/* Conteúdo */}
      <div className="flex items-center justify-center min-h-screen px-6 sm:px-10 md:px-8 pt-24 pb-10">
        <div className="max-w-2xl w-full animate-in fade-in duration-300">
          {/* Contador */}
          <div className="mb-4">
            <span className={`text-sm ${mutedClass}`}>
              {currentStep + 1} → {totalSteps}
            </span>
          </div>

          <div className="space-y-6">
            {/* Label da pergunta */}
            <h2 className="text-3xl md:text-4xl font-medium leading-snug">
              {interpolate(q.label)}
              {q.is_required && <span className="text-red-500 ml-1 text-2xl">*</span>}
            </h2>

            {/* TEXT */}
            {q.question_type === 'text' && (
              <>
                <input
                  value={answers[q.field_key] || ''}
                  onChange={(e) => setAnswer(q.field_key, e.target.value)}
                  placeholder="Digite aqui..."
                  autoFocus
                  className={`w-full text-xl bg-transparent outline-none border-b-2 py-3 px-1 placeholder:opacity-40 ${borderClass} ${textClass}`}
                />
                {actionBtn}
              </>
            )}

            {/* TEXTAREA */}
            {q.question_type === 'textarea' && (
              <>
                <textarea
                  value={answers[q.field_key] || ''}
                  onChange={(e) => setAnswer(q.field_key, e.target.value)}
                  placeholder="Digite aqui..."
                  rows={4}
                  autoFocus
                  className={`w-full text-xl bg-transparent border-b-2 outline-none py-3 px-1 resize-none placeholder:opacity-40 ${borderClass} ${textClass}`}
                />
                {actionBtn}
              </>
            )}

            {/* SELECT / RADIO — escolha única, avança automático */}
            {(q.question_type === 'select' || q.question_type === 'radio') && q.options && (
              <div className="space-y-3">
                {q.options.map((opt, idx) => {
                  const selected = answers[q.field_key] === opt;
                  return (
                    <button
                      key={opt}
                      onClick={() => { setAnswer(q.field_key, opt); setTimeout(nextStep, 300); }}
                      className={`w-full text-left p-4 rounded-lg border-2 transition-all flex items-center gap-4 ${borderClass} ${hoverClass}`}
                      style={selected ? { borderColor: primaryColor } : {}}
                    >
                      <div
                        className="flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center font-semibold transition-colors"
                        style={selected
                          ? { backgroundColor: primaryColor, color: '#fff' }
                          : { backgroundColor: isDark ? '#1f1f1f' : '#f3f4f6' }}
                      >
                        {String.fromCharCode(65 + idx)}
                      </div>
                      <span className="text-lg">{opt}</span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* MULTISELECT / CHECKBOX — múltipla escolha */}
            {(q.question_type === 'multiselect' || q.question_type === 'checkbox') && q.options && (
              <>
                <div className="space-y-3">
                  {q.options.map((opt, idx) => {
                    const selected = (answers[q.field_key] || []).includes(opt);
                    return (
                      <button
                        key={opt}
                        onClick={() => toggleMulti(q.field_key, opt)}
                        className={`w-full text-left p-4 rounded-lg border-2 transition-all flex items-center gap-4 ${borderClass}`}
                        style={selected ? { borderColor: primaryColor, backgroundColor: `${primaryColor}18` } : {}}
                      >
                        <div
                          className="flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center font-semibold transition-colors"
                          style={selected
                            ? { backgroundColor: primaryColor, color: '#fff' }
                            : { backgroundColor: isDark ? '#1f1f1f' : '#f3f4f6' }}
                        >
                          {selected ? <Check className="h-5 w-5" /> : String.fromCharCode(65 + idx)}
                        </div>
                        <span className="text-lg">{opt}</span>
                      </button>
                    );
                  })}
                </div>
                {actionBtn}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
