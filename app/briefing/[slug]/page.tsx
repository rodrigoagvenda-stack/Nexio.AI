'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, CheckCircle2 } from 'lucide-react';

interface BriefingConfig {
  id: number;
  company_id: number;
  slug: string;
  primary_color: string;
  logo_url?: string;
  title?: string;
  description?: string;
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
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

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

      // Inicializar respostas
      const initialAnswers: Record<string, any> = {};
      data.data.questions.forEach((q: BriefingQuestion) => {
        initialAnswers[q.field_key] = q.question_type === 'multiselect' ? [] : '';
      });
      setAnswers(initialAnswers);
    } catch (err) {
      setError('Erro ao carregar briefing');
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    // Validar campos obrigatórios
    for (const q of questions) {
      if (q.is_required) {
        const val = answers[q.field_key];
        const empty = !val || (Array.isArray(val) && val.length === 0) || val === '';
        if (empty) {
          alert(`O campo "${q.label}" é obrigatório.`);
          return;
        }
      }
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/briefing/public/${slug}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers }),
      });

      const data = await res.json();
      if (!data.success) throw new Error(data.message);

      setSubmitted(true);
    } catch (err: any) {
      alert(err.message || 'Erro ao enviar. Tente novamente.');
    } finally {
      setSubmitting(false);
    }
  }

  function setAnswer(fieldKey: string, value: any) {
    setAnswers((prev) => ({ ...prev, [fieldKey]: value }));
  }

  function toggleMultiselect(fieldKey: string, option: string) {
    setAnswers((prev) => {
      const current: string[] = prev[fieldKey] || [];
      return {
        ...prev,
        [fieldKey]: current.includes(option)
          ? current.filter((v) => v !== option)
          : [...current, option],
      };
    });
  }

  const primaryColor = config?.primary_color || '#7c3aed';

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (error || !config) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <p className="text-2xl font-bold text-gray-800">😕 Briefing não encontrado</p>
          <p className="text-gray-500 mt-2">{error || 'Este link pode estar inativo ou incorreto.'}</p>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center max-w-md px-6">
          <CheckCircle2 className="h-16 w-16 mx-auto mb-4" style={{ color: primaryColor }} />
          <h2 className="text-2xl font-bold text-gray-800">Enviado com sucesso!</h2>
          <p className="text-gray-500 mt-2">Obrigado pelo preenchimento. Entraremos em contato em breve.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-10">
          {config.logo_url && (
            <img
              src={config.logo_url}
              alt="Logo"
              className="h-16 object-contain mx-auto mb-6"
            />
          )}
          <h1 className="text-3xl font-bold text-gray-900">
            {config.title || 'Preencha seu briefing'}
          </h1>
          {config.description && (
            <p className="text-gray-500 mt-2 text-lg">{config.description}</p>
          )}
          {/* Linha colorida */}
          <div className="h-1 w-24 mx-auto mt-4 rounded-full" style={{ backgroundColor: primaryColor }} />
        </div>

        {/* Formulário */}
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 space-y-6">
          {questions.map((q) => (
            <div key={q.id} className="space-y-2">
              <Label className="text-sm font-medium text-gray-700">
                {q.label}
                {q.is_required && <span className="text-red-500 ml-1">*</span>}
              </Label>

              {q.question_type === 'text' && (
                <Input
                  value={answers[q.field_key] || ''}
                  onChange={(e) => setAnswer(q.field_key, e.target.value)}
                  required={q.is_required}
                  className="border-gray-200 focus:border-gray-400"
                  style={{ '--ring-color': primaryColor } as any}
                />
              )}

              {q.question_type === 'textarea' && (
                <Textarea
                  value={answers[q.field_key] || ''}
                  onChange={(e) => setAnswer(q.field_key, e.target.value)}
                  required={q.is_required}
                  rows={4}
                  className="border-gray-200"
                />
              )}

              {q.question_type === 'select' && q.options && (
                <Select
                  value={answers[q.field_key] || ''}
                  onValueChange={(val) => setAnswer(q.field_key, val)}
                >
                  <SelectTrigger className="border-gray-200">
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    {q.options.map((opt) => (
                      <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              {q.question_type === 'radio' && q.options && (
                <RadioGroup
                  value={answers[q.field_key] || ''}
                  onValueChange={(val) => setAnswer(q.field_key, val)}
                  className="space-y-2"
                >
                  {q.options.map((opt) => (
                    <div key={opt} className="flex items-center gap-2">
                      <RadioGroupItem
                        value={opt}
                        id={`${q.field_key}_${opt}`}
                        style={{ accentColor: primaryColor }}
                      />
                      <Label htmlFor={`${q.field_key}_${opt}`} className="font-normal cursor-pointer">
                        {opt}
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              )}

              {(q.question_type === 'multiselect' || q.question_type === 'checkbox') && q.options && (
                <div className="space-y-2">
                  {q.options.map((opt) => {
                    const checked = (answers[q.field_key] || []).includes(opt);
                    return (
                      <div key={opt} className="flex items-center gap-2">
                        <Checkbox
                          id={`${q.field_key}_${opt}`}
                          checked={checked}
                          onCheckedChange={() => toggleMultiselect(q.field_key, opt)}
                          style={{ accentColor: primaryColor }}
                        />
                        <Label htmlFor={`${q.field_key}_${opt}`} className="font-normal cursor-pointer">
                          {opt}
                        </Label>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))}

          <div className="pt-4">
            <Button
              type="submit"
              disabled={submitting}
              className="w-full h-12 text-base font-semibold text-white"
              style={{ backgroundColor: primaryColor }}
            >
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Enviando...
                </>
              ) : (
                'Enviar Briefing'
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
