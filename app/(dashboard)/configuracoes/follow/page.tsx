'use client';
import dynamic from 'next/dynamic';
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

export default function FollowPage() {
  return (
    <div className="mx-auto flex w-full max-w-[1900px] flex-col gap-6 pb-6 pt-2">
      <AutomationsNav active="sequencias" />
      <div className="h-[calc(100vh-330px)] min-h-[620px]">
        <AutomationCanvas />
      </div>
    </div>
  );
}
