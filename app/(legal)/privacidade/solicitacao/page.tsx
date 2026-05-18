'use client';

import type { Metadata } from 'next';
import { useState, FormEvent } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils/cn';
import { CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';

// Nota: Metadata só pode ser exportada em Server Components.
// Para manter 'use client' e ter título, use o arquivo metadata separado ou
// um generateMetadata em um wrapper server. Aqui usamos title via <title> implícito do layout.

type TipoSolicitacao =
  | ''
  | 'acesso'
  | 'correcao'
  | 'exclusao'
  | 'portabilidade'
  | 'revogacao';

interface FormState {
  nome: string;
  email: string;
  tipo: TipoSolicitacao;
  mensagem: string;
}

type Status = 'idle' | 'loading' | 'success' | 'error';

export default function SolicitacaoPage() {
  const [form, setForm] = useState<FormState>({
    nome: '',
    email: '',
    tipo: '',
    mensagem: '',
  });
  const [status, setStatus] = useState<Status>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form.nome || !form.email || !form.tipo) return;

    setStatus('loading');
    setErrorMsg('');

    try {
      const res = await fetch('/api/lgpd/solicitacao', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Erro ao enviar solicitação.');
      }

      setStatus('success');
    } catch (err: unknown) {
      setStatus('error');
      setErrorMsg(err instanceof Error ? err.message : 'Erro desconhecido.');
    }
  }

  const inputClass =
    'w-full h-10 rounded-lg border border-border bg-muted/40 px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-colors';

  if (status === 'success') {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
        <CheckCircle2 className="h-12 w-12 text-green-500" />
        <h2 className="text-xl font-bold text-foreground">Solicitação enviada!</h2>
        <p className="text-muted-foreground max-w-sm text-sm">
          Recebemos sua solicitação e responderemos em até <strong>15 dias úteis</strong> pelo
          e-mail informado.
        </p>
        <Link
          href="/privacidade"
          className="mt-4 text-sm text-primary underline underline-offset-4 hover:text-primary/80 transition-colors"
        >
          Voltar para a Política de Privacidade
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <p className="text-sm text-muted-foreground mb-1">
          <Link href="/privacidade" className="hover:text-foreground transition-colors">
            Política de Privacidade
          </Link>
          {' '}→ Solicitação de direitos
        </p>
        <h1 className="text-2xl font-extrabold tracking-tight text-foreground mb-2">
          Exercer meus direitos (LGPD)
        </h1>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Nos termos da Lei Geral de Proteção de Dados (Lei nº 13.709/2018), você pode solicitar
          acesso, correção, exclusão, portabilidade ou revogação do consentimento sobre seus dados
          pessoais. Responderemos em até <strong>15 dias úteis</strong>.
        </p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Nome */}
        <div className="space-y-1.5">
          <label htmlFor="nome" className="text-sm font-medium text-foreground">
            Nome completo <span className="text-red-500">*</span>
          </label>
          <input
            id="nome"
            name="nome"
            type="text"
            required
            autoComplete="name"
            placeholder="Seu nome completo"
            value={form.nome}
            onChange={handleChange}
            className={inputClass}
          />
        </div>

        {/* Email */}
        <div className="space-y-1.5">
          <label htmlFor="email" className="text-sm font-medium text-foreground">
            E-mail <span className="text-red-500">*</span>
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder="seu@email.com.br"
            value={form.email}
            onChange={handleChange}
            className={inputClass}
          />
        </div>

        {/* Tipo */}
        <div className="space-y-1.5">
          <label htmlFor="tipo" className="text-sm font-medium text-foreground">
            Tipo de solicitação <span className="text-red-500">*</span>
          </label>
          <select
            id="tipo"
            name="tipo"
            required
            value={form.tipo}
            onChange={handleChange}
            className={cn(inputClass, 'cursor-pointer')}
          >
            <option value="" disabled>
              Selecione o tipo...
            </option>
            <option value="acesso">Acesso aos dados</option>
            <option value="correcao">Correção de dados</option>
            <option value="exclusao">Exclusão dos dados</option>
            <option value="portabilidade">Portabilidade dos dados</option>
            <option value="revogacao">Revogação de consentimento</option>
          </select>
        </div>

        {/* Mensagem */}
        <div className="space-y-1.5">
          <label htmlFor="mensagem" className="text-sm font-medium text-foreground">
            Mensagem <span className="text-muted-foreground font-normal">(opcional)</span>
          </label>
          <textarea
            id="mensagem"
            name="mensagem"
            rows={4}
            placeholder="Descreva sua solicitação com mais detalhes, se necessário..."
            value={form.mensagem}
            onChange={handleChange}
            className={cn(inputClass, 'h-auto resize-none py-2.5')}
          />
        </div>

        {/* Error */}
        {status === 'error' && (
          <div className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-500">
            <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <p>{errorMsg}</p>
          </div>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={status === 'loading' || !form.nome || !form.email || !form.tipo}
          className={cn(
            'w-full h-10 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors flex items-center justify-center gap-2',
            (status === 'loading' || !form.nome || !form.email || !form.tipo) &&
              'opacity-60 cursor-not-allowed'
          )}
        >
          {status === 'loading' && <Loader2 className="h-4 w-4 animate-spin" />}
          {status === 'loading' ? 'Enviando...' : 'Enviar solicitação'}
        </button>

        <p className="text-xs text-muted-foreground text-center">
          Dúvidas? Fale diretamente com nosso DPO:{' '}
          <a
            href="mailto:privacidade@zaapply.com.br"
            className="text-primary underline underline-offset-4 hover:text-primary/80 transition-colors"
          >
            privacidade@zaapply.com.br
          </a>
        </p>
      </form>
    </div>
  );
}
