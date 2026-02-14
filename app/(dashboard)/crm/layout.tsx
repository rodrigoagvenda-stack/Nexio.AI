import { Suspense } from 'react';
import Loading from './loading';

// 🔥 FORÇA RENDERIZAÇÃO DINÂMICA E PRÉ-CARREGAMENTO
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function CRMLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense fallback={<Loading />}>
      {children}
    </Suspense>
  );
}
