// Declaração de tipo global para Google Analytics gtag
// Necessário para uso em window.gtag?.() sem erros de TypeScript

type GtagConsentArg = 'default' | 'update';

interface GtagConsentParams {
  analytics_storage?: 'granted' | 'denied';
  ad_storage?: 'granted' | 'denied';
  functionality_storage?: 'granted' | 'denied';
  personalization_storage?: 'granted' | 'denied';
  security_storage?: 'granted' | 'denied';
  wait_for_update?: number;
}

interface Window {
  gtag?: (
    command: 'consent',
    arg: GtagConsentArg,
    params: GtagConsentParams
  ) => void;
  dataLayer?: unknown[];
}
