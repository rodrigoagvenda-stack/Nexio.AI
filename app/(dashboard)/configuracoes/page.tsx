'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CARD } from '@/components/configuracoes/cfg-ui';
import { PerfilSeguranca } from '@/components/configuracoes/PerfilSeguranca';
import { PlanoUso } from '@/components/configuracoes/PlanoUso';
import { IntegracoesContent } from '@/components/configuracoes/IntegracoesContent';
import { EquipeContent } from '@/components/configuracoes/EquipeContent';
import { RespostasRapidasContent } from '@/components/configuracoes/RespostasRapidasContent';
import { TemplatesHSMContent } from '@/components/configuracoes/TemplatesHSMContent';

const TABS = [
  { id: 'perfil', label: 'Perfil e segurança' },
  { id: 'plano', label: 'Plano e uso' },
  { id: 'respostas', label: 'Respostas rápidas' },
  { id: 'templates', label: 'Templates de mensagem' },
  // Ainda moram aqui: Integrações (Google Calendar e pagamentos) e Equipe (atendentes do chat).
  { id: 'integracoes', label: 'Integrações' },
  { id: 'equipe', label: 'Equipe' },
] as const;
type Tab = (typeof TABS)[number]['id'];

const ALIASES: Record<string, Tab> = { seguranca: 'perfil', automacao: 'perfil' };

function resolveTab(params: URLSearchParams): Tab {
  if (params.get('checkout') || params.get('expired') || params.get('pagar')) return 'plano';
  const t = params.get('tab') ?? '';
  if (ALIASES[t]) return ALIASES[t];
  return (TABS.some((x) => x.id === t) ? t : 'perfil') as Tab;
}

function ConfiguracoesContent() {
  const router = useRouter();
  const params = useSearchParams();
  const [tab, setTabState] = useState<Tab>(() => resolveTab(params));
  const [counts, setCounts] = useState<{ respostas?: number; templates?: number }>({});

  useEffect(() => {
    fetch('/api/quick-replies').then((r) => (r.ok ? r.json() : null)).then((d) => { if (d?.data) setCounts((c) => ({ ...c, respostas: d.data.length })); }).catch(() => {});
    fetch('/api/hsm-templates').then((r) => (r.ok ? r.json() : null)).then((d) => { if (d?.data) setCounts((c) => ({ ...c, templates: d.data.length })); }).catch(() => {});
  }, [tab]);

  function setTab(next: Tab) {
    setTabState(next);
    router.replace(next === 'perfil' ? '/configuracoes' : `/configuracoes?tab=${next}`, { scroll: false });
  }

  const countOf = (id: Tab) => (id === 'respostas' ? counts.respostas : id === 'templates' ? counts.templates : undefined);

  return (
    <div className="mx-auto flex w-full max-w-[1900px] flex-col gap-6 pb-14 pt-2">
      <div className="flex flex-col gap-1.5">
        <h1 className="text-[26px] font-semibold leading-8 tracking-tight text-foreground">Configuração</h1>
        <p className="text-[15px] text-muted-foreground">Sua conta, seu plano e suas preferências.</p>
      </div>

      <div className="flex flex-col items-stretch gap-7 lg:flex-row lg:items-start">
        <nav aria-label="Seções da configuração" className={cn(CARD, 'flex w-full shrink-0 flex-row gap-0.5 overflow-x-auto px-3.5 py-4 lg:w-[300px] lg:flex-col')}>
          {TABS.map((t) => {
            const on = tab === t.id;
            const n = countOf(t.id);
            return (
              <button
                key={t.id}
                type="button"
                aria-current={on ? 'page' : undefined}
                onClick={() => setTab(t.id)}
                className={cn('flex shrink-0 items-center justify-between gap-3 rounded-[9px] p-3 text-left text-[14.5px] transition-colors', on ? 'bg-accent font-semibold text-foreground' : 'text-foreground hover:bg-muted')}
              >
                {t.label}
                {n != null && <span className="text-[13px] font-normal text-muted-foreground">{n}</span>}
              </button>
            );
          })}
        </nav>

        <div className="flex min-w-0 flex-1 flex-col">
          {tab === 'perfil' && <PerfilSeguranca />}
          {tab === 'plano' && <PlanoUso />}
          {tab === 'respostas' && <RespostasRapidasContent />}
          {tab === 'templates' && <TemplatesHSMContent />}
          {tab === 'integracoes' && <IntegracoesContent />}
          {tab === 'equipe' && <EquipeContent />}
        </div>
      </div>
    </div>
  );
}

export default function ConfiguracoesPage() {
  return (
    <Suspense fallback={<div className="flex h-64 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>}>
      <ConfiguracoesContent />
    </Suspense>
  );
}
