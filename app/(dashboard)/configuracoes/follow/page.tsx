'use client';
import dynamic from 'next/dynamic';
import { useEffect, useRef, useState } from 'react';
import { AutomationsNav } from '@/components/automacoes/AutomationsNav';

const AutomationCanvas = dynamic(
  () => import('@/components/automacao/AutomationCanvas'),
  { ssr: false, loading: () => (
    <div className="flex h-full items-center justify-center">
      <div className="flex flex-col items-center gap-3 text-muted-foreground">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#01573C]/30 border-t-[#01573C] dark:border-[#96F63C]/30 dark:border-t-[#96F63C]" />
        <p className="text-sm">Carregando sequências…</p>
      </div>
    </div>
  )}
);

const BOTTOM_GAP = 24;

export default function FollowPage() {
  const holder = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number | null>(null);

  // O canvas ocupa tudo o que sobra da tela abaixo das abas, sem deixar faixa vazia embaixo
  useEffect(() => {
    const fit = () => {
      const el = holder.current;
      if (!el) return;
      const top = el.getBoundingClientRect().top;
      setHeight(Math.max(520, Math.floor(window.innerHeight - top - BOTTOM_GAP)));
    };
    fit();
    window.addEventListener('resize', fit);
    const t = setTimeout(fit, 300);
    return () => { window.removeEventListener('resize', fit); clearTimeout(t); };
  }, []);

  return (
    <div className="mx-auto flex w-full max-w-[1900px] flex-col gap-6 pt-2">
      <AutomationsNav active="sequencias" />
      <div ref={holder} style={{ height: height ?? 620 }}>
        <AutomationCanvas />
      </div>
    </div>
  );
}
