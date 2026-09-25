'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { AutomationsNav } from '@/components/automacoes/AutomationsNav';
import { SubNav } from '@/components/sdr/ui';
import { SdrResumo, type SdrGo } from '@/components/sdr/SdrResumo';
import { SdrConversa } from '@/components/sdr/SdrConversa';
import { ConfirmHost } from '@/components/sdr/ConfirmHost';
import { SdrConhecimento } from '@/components/sdr/SdrConhecimento';
import { SdrConexoes, normalizeSub, type ConSub } from '@/components/sdr/SdrConexoes';
import { useUser } from '@/lib/hooks/useUser';
import { useSdrConfig } from '@/components/sdr/useSdrConfig';

type Tab = 'resumo' | 'conversa' | 'conhecimento' | 'conexoes';
const TABS = [['resumo', 'Resumo'], ['conversa', 'Conversa'], ['conhecimento', 'Conhecimento'], ['conexoes', 'Conexões']] as const;

// Endereços antigos (?tab=integracoes etc.) continuam levando ao lugar certo
const ALIAS: Record<string, { tab: Tab; sub?: string }> = {
  geral: { tab: 'resumo' },
  identidade: { tab: 'conversa' },
  integracoes: { tab: 'conexoes' },
  horarios: { tab: 'conexoes', sub: 'horario' },
  cardapio: { tab: 'conhecimento' },
};

function readUrl(): { tab: Tab; sub: string | null } {
  const q = new URLSearchParams(window.location.search);
  const raw = q.get('tab') ?? 'resumo';
  const alias = ALIAS[raw];
  const tab = (alias?.tab ?? raw) as Tab;
  const sub = q.get('sub') ?? (q.get('google_ads') ? 'googleads' : null) ?? alias?.sub ?? null;
  return { tab: TABS.some(([id]) => id === tab) ? tab : 'resumo', sub };
}

export default function SdrPage() {
  const { cfg, loading, save, reload } = useSdrConfig();
  const { company } = useUser();
  const [tab, setTab] = useState<Tab>('resumo');
  const [sub, setSub] = useState<string | null>(null);
  const [funnelOn, setFunnelOn] = useState(false);

  useEffect(() => {
    const u = readUrl();
    setTab(u.tab);
    setSub(u.sub);
    fetch('/api/sdr/funnel').then((r) => (r.ok ? r.json() : null)).then((j) => setFunnelOn(!!j?.data?.active)).catch(() => {});
  }, []);

  const go = useCallback((next: Tab, nextSub?: string) => {
    setTab(next);
    setSub(nextSub ?? null);
    const q = new URLSearchParams({ tab: next });
    if (nextSub) q.set('sub', nextSub);
    window.history.replaceState(null, '', `/configuracoes/sdr?${q.toString()}`);
  }, []);
  const goFromResumo: SdrGo = (t, s) => go(t, s);

  if (loading) {
    return <div className="flex h-64 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="mx-auto flex w-full max-w-[1900px] flex-col gap-6 pb-14 pt-2">
      <ConfirmHost />
      <AutomationsNav active="sdr" />
      <SubNav items={TABS} active={tab} onChange={(t) => go(t)} label="SDR" />

      {tab === 'resumo' && (
        <SdrResumo cfg={cfg} funnelOn={funnelOn} onGo={goFromResumo} onToggleAgent={async (v) => { await save({ agente_ativo: v }); }} />
      )}

      {tab === 'conversa' && (
        <SdrConversa persona={cfg.persona} funnelActive={funnelOn} onFunnelActive={setFunnelOn} onSavePersona={(p) => save({ prompt: JSON.stringify(p) })} />
      )}

      {tab === 'conexoes' && (
        <SdrConexoes cfg={cfg} sub={normalizeSub(sub)} onSub={(s: ConSub) => go('conexoes', s)} save={save} reload={reload} companyId={company?.id ?? null} />
      )}

      {tab === 'conhecimento' && (
        <SdrConhecimento persona={cfg.persona} flowId={cfg.flow_id} agentActive={cfg.agente_ativo} onReload={reload} />
      )}
    </div>
  );
}
