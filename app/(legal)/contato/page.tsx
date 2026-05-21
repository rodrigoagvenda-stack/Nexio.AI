'use client';

import { useState, FormEvent } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils/cn';
import { CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';

interface FormState {
  nome: string;
  email: string;
  empresa: string;
  mensagem: string;
}

type Status = 'idle' | 'loading' | 'success' | 'error';

export default function ContatoPage() {
  const [form, setForm] = useState<FormState>({ nome: '', email: '', empresa: '', mensagem: '' });
  const [status, setStatus] = useState<Status>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setStatus('loading');
    setErrorMsg('');
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao enviar.');
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
        <h2 className="text-xl font-bold text-foreground">Mensagem enviada!</h2>
        <p className="text-muted-foreground max-w-sm text-sm">
          Recebemos seu contato e retornaremos em breve no e-mail informado.
        </p>
        <Link
          href="/"
          className="mt-4 text-sm text-primary underline underline-offset-4 hover:text-primary/80 transition-colors"
        >
          Voltar ao início
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-extrabold tracking-tight text-foreground mb-2">
          Fale com a gente
        </h1>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Tem interesse no Zaapply, dúvidas comerciais ou quer saber mais sobre os planos?
          Preencha o formulário e retornamos em breve.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label htmlFor="nome" className="text-sm font-medium text-foreground">
              Nome <span className="text-red-500">*</span>
            </label>
            <input
              id="nome" name="nome" type="text" required
              placeholder="Seu nome"
              value={form.nome} onChange={handleChange}
              className={inputClass}
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="email" className="text-sm font-medium text-foreground">
              E-mail <span className="text-red-500">*</span>
            </label>
            <input
              id="email" name="email" type="email" required
              placeholder="seu@email.com"
              value={form.email} onChange={handleChange}
              className={inputClass}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="empresa" className="text-sm font-medium text-foreground">
            Empresa <span className="text-muted-foreground font-normal">(opcional)</span>
          </label>
          <input
            id="empresa" name="empresa" type="text"
            placeholder="Nome da sua empresa"
            value={form.empresa} onChange={handleChange}
            className={inputClass}
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="mensagem" className="text-sm font-medium text-foreground">
            Mensagem <span className="text-red-500">*</span>
          </label>
          <textarea
            id="mensagem" name="mensagem" required rows={5}
            placeholder="Como podemos ajudar?"
            value={form.mensagem} onChange={handleChange}
            className={cn(inputClass, 'h-auto resize-none py-2.5')}
          />
        </div>

        {status === 'error' && (
          <div className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-500">
            <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <p>{errorMsg}</p>
          </div>
        )}

        <button
          type="submit"
          disabled={status === 'loading' || !form.nome || !form.email || !form.mensagem}
          className={cn(
            'w-full h-10 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors flex items-center justify-center gap-2',
            (status === 'loading' || !form.nome || !form.email || !form.mensagem) && 'opacity-60 cursor-not-allowed'
          )}
        >
          {status === 'loading' && <Loader2 className="h-4 w-4 animate-spin" />}
          {status === 'loading' ? 'Enviando...' : 'Enviar mensagem'}
        </button>

        <p className="text-xs text-muted-foreground text-center">
          Prefere e-mail direto?{' '}
          <a href="mailto:contato@zaapply.com.br" className="text-primary underline underline-offset-4 hover:text-primary/80 transition-colors">
            contato@zaapply.com.br
          </a>
        </p>
      </form>
    </div>
  );
}
