'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Loader2 } from 'lucide-react';
import { AutomationsNav } from '@/components/automacoes/AutomationsNav';
import { SubNav, CARD, PILL3D } from '@/components/sdr/ui';
import { SdrResumo, type SdrGo } from '@/components/sdr/SdrResumo';
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
  return { tab: TABS.some(([id]) => id === tab) ? tab : 'resumo', sub: q.get('sub') ?? alias?.sub ?? null };
}

export default function SdrPage() {
  const { cfg, loading, save } = useSdrConfig();
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
      <AutomationsNav active="sdr" />
      <SubNav items={TABS} active={tab} onChange={(t) => go(t)} label="SDR" />

      {tab === 'resumo' && (
        <SdrResumo cfg={cfg} funnelOn={funnelOn} onGo={goFromResumo} onToggleAgent={async (v) => { await save({ agente_ativo: v }); }} />
      )}

      {tab !== 'resumo' && (
        <div className={`${CARD} flex flex-col items-start gap-4 px-8 py-8`}>
          <p className="text-[15px] text-muted-foreground">Esta parte ainda está no painel anterior do SDR{sub ? ` (${sub})` : ''}.</p>
          <Link href={`/configuracoes/sdr/legacy?tab=${tab === 'conexoes' ? 'integracoes' : tab === 'conversa' ? 'identidade' : tab}`} className={PILL3D}>Abrir painel anterior</Link>
        </div>
      )}
    </div>
  );
}
