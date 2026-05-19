'use client';
import dynamic from 'next/dynamic';
import { Suspense } from 'react';

const AutomationCanvas = dynamic(
  () => import('@/components/automacao/AutomationCanvas'),
  { ssr: false, loading: () => (
    <div className="flex items-center justify-center h-full bg-[#0e0e0e]">
      <div className="flex flex-col items-center gap-3 text-zinc-500">
        <div className="w-5 h-5 border-2 border-[#b5ff47]/30 border-t-[#b5ff47] rounded-full animate-spin" />
        <p className="text-sm">Carregando canvas…</p>
      </div>
    </div>
  )}
);

export default function FollowPage() {
  return (
    <div className="-mx-3 md:-mx-6 -mt-3 md:-mt-6 -mb-[120px] lg:-mb-6 overflow-hidden" style={{ height: 'calc(100vh - 80px)' }}>
      <AutomationCanvas />
    </div>
  );
}
