import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Zaapply',
    short_name: 'Zaapply',
    description: 'CRM Inteligente com IA',
    start_url: '/dashboard',
    display: 'standalone',
    background_color: '#0A0A0A',
    theme_color: '#01573C',
    orientation: 'portrait',
    icons: [
      {
        src: '/favicon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'any',
      },
      {
        src: '/icons/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/icons/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
    screenshots: [
      {
        src: '/favicon.svg',
        sizes: '375x667',
        type: 'image/svg+xml',
        // @ts-ignore — form_factor é válido mas não está no type ainda
        form_factor: 'narrow',
        label: 'Zaapply CRM',
      },
    ],
    categories: ['business', 'productivity'],
    lang: 'pt-BR',
    dir: 'ltr',
    // @ts-ignore — permissions válido no spec W3C mas não no type Next.js ainda
    permissions: ['microphone'],
  }
}
