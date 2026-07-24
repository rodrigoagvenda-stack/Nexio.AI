'use client';

import { createContext, useContext } from 'react';

const FeaturesCtx = createContext<Record<string, boolean>>({});

export function useFeatures() {
  return useContext(FeaturesCtx);
}

export function FeaturesProvider({
  features,
  children,
}: {
  features: Record<string, boolean>;
  children: React.ReactNode;
}) {
  return <FeaturesCtx.Provider value={features}>{children}</FeaturesCtx.Provider>;
}
