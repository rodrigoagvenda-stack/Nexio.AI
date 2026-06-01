'use client';

import { useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { initPostHog, posthog } from '@/lib/posthog/client';

interface PostHogProviderProps {
  children: React.ReactNode;
  userId?: string;
  companyId?: number;
  planType?: string;
}

export function PostHogProvider({ children, userId, companyId, planType }: PostHogProviderProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    initPostHog();
  }, []);

  // Identificar usuário
  useEffect(() => {
    if (!userId) return;
    posthog.identify(userId, {
      company_id: companyId,
      plan_type: planType,
    });
  }, [userId, companyId, planType]);

  // Track pageviews manualmente
  useEffect(() => {
    const url = pathname + (searchParams.toString() ? `?${searchParams.toString()}` : '');
    posthog.capture('$pageview', { $current_url: url });
  }, [pathname, searchParams]);

  return <>{children}</>;
}
