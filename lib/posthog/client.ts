'use client';

import posthog from 'posthog-js';

let initialized = false;

export function initPostHog() {
  if (initialized || typeof window === 'undefined') return;
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://us.i.posthog.com';
  if (!key) return;

  posthog.init(key, {
    api_host: host,
    capture_pageview: false,     // manual control
    capture_pageleave: true,
    persistence: 'localStorage', // sem cookies : LGPD simplificada
    autocapture: false,          // não capturar cliques cegos : só eventos explícitos
  });

  initialized = true;
}

export { posthog };
