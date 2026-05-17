'use client';

import dynamic from 'next/dynamic';

const FlowMapEditor = dynamic(() => import('@/components/flow/FlowMapEditor'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full">
      <div className="flex flex-col items-center gap-3 text-muted-foreground">
        <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
        <p className="text-sm">Carregando editor de fluxo…</p>
      </div>
    </div>
  ),
});

export default function MapaPage() {
  return (
    <div className="h-[calc(100vh-120px)] -m-3 md:-m-6 overflow-hidden">
      <FlowMapEditor />
    </div>
  );
}
