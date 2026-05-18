'use client';

import { useState, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils/cn';
import { X, Cookie, ChevronDown, ChevronUp } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CookiePreferences {
  essential: true;
  analytics: boolean;
  behavior: boolean;
  timestamp: string;
}

const STORAGE_KEY = 'cookie_consent';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function applyConsentDefaults() {
  if (typeof window === 'undefined') return;
  window.gtag?.('consent', 'default', {
    analytics_storage: 'denied',
    ad_storage: 'denied',
    functionality_storage: 'denied',
    personalization_storage: 'denied',
  });
}

function applyConsentUpdate(prefs: CookiePreferences) {
  if (typeof window === 'undefined') return;
  window.gtag?.('consent', 'update', {
    analytics_storage: prefs.analytics ? 'granted' : 'denied',
    ad_storage: 'denied',
    functionality_storage: 'granted',
    personalization_storage: prefs.behavior ? 'granted' : 'denied',
  });
}

function loadPreferences(): CookiePreferences | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as CookiePreferences;
  } catch {
    return null;
  }
}

function savePreferences(prefs: CookiePreferences) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  applyConsentUpdate(prefs);
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useCookieConsent(): CookiePreferences | null {
  const [prefs, setPrefs] = useState<CookiePreferences | null>(null);

  useEffect(() => {
    setPrefs(loadPreferences());

    function onStorage(e: StorageEvent) {
      if (e.key === STORAGE_KEY) setPrefs(loadPreferences());
    }
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  return prefs;
}

// ─── Toggle ───────────────────────────────────────────────────────────────────

function Toggle({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange?: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange?.(!checked)}
      className={cn(
        'relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        checked ? 'bg-primary' : 'bg-muted',
        disabled && 'cursor-not-allowed opacity-60'
      )}
    >
      <span
        className={cn(
          'pointer-events-none inline-block h-4 w-4 transform rounded-full bg-background shadow-lg ring-0 transition duration-200',
          checked ? 'translate-x-4' : 'translate-x-0'
        )}
      />
    </button>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function CookieBanner() {
  const [visible, setVisible] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [analytics, setAnalytics] = useState(false);
  const [behavior, setBehavior] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);

  useEffect(() => {
    applyConsentDefaults();
    const stored = loadPreferences();
    if (!stored) {
      // Slight delay so the page renders first
      const t = setTimeout(() => setVisible(true), 300);
      return () => clearTimeout(t);
    }
  }, []);

  const acceptAll = useCallback(() => {
    const prefs: CookiePreferences = {
      essential: true,
      analytics: true,
      behavior: true,
      timestamp: new Date().toISOString(),
    };
    savePreferences(prefs);
    setVisible(false);
    setShowModal(false);
  }, []);

  const rejectAll = useCallback(() => {
    const prefs: CookiePreferences = {
      essential: true,
      analytics: false,
      behavior: false,
      timestamp: new Date().toISOString(),
    };
    savePreferences(prefs);
    setVisible(false);
    setShowModal(false);
  }, []);

  const saveCustom = useCallback(() => {
    const prefs: CookiePreferences = {
      essential: true,
      analytics,
      behavior,
      timestamp: new Date().toISOString(),
    };
    savePreferences(prefs);
    setVisible(false);
    setShowModal(false);
  }, [analytics, behavior]);

  if (!visible) return null;

  return (
    <>
      {/* ── Modal de personalização ── */}
      {showModal && (
        <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowModal(false)}
          />

          {/* Panel */}
          <div className="relative z-10 w-full max-w-md rounded-2xl border border-border bg-card shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <div className="flex items-center gap-2">
                <Cookie className="h-4 w-4 text-primary" />
                <span className="font-semibold text-foreground text-sm">Preferências de cookies</span>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Categories */}
            <div className="px-6 py-4 space-y-4">
              {/* Essenciais */}
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">Essenciais</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Necessários para autenticação e funcionamento da plataforma. Não podem ser desativados.
                  </p>
                </div>
                <Toggle checked={true} disabled />
              </div>

              <hr className="border-border" />

              {/* Analytics */}
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">Analytics</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Google Analytics — coleta métricas de uso para melhorar o produto. Dados anonimizados.
                  </p>
                </div>
                <Toggle checked={analytics} onChange={setAnalytics} />
              </div>

              <hr className="border-border" />

              {/* Comportamento */}
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">Comportamento</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Hotjar — registra mapas de calor e gravações de sessão para melhorar a experiência.
                  </p>
                </div>
                <Toggle checked={behavior} onChange={setBehavior} />
              </div>

              {/* Saiba mais */}
              <button
                type="button"
                onClick={() => setDetailsOpen((v) => !v)}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                {detailsOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                Saiba mais sobre cookies de terceiros
              </button>

              {detailsOpen && (
                <div className="rounded-lg border border-border bg-muted/40 px-4 py-3 text-xs text-muted-foreground space-y-1">
                  <p><strong className="text-foreground">Google Analytics:</strong> coleta dados de navegação anonimizados. Base legal: consentimento (LGPD Art. 7º, I).</p>
                  <p><strong className="text-foreground">Hotjar:</strong> grava interações do usuário para análise de UX. Base legal: consentimento (LGPD Art. 7º, I).</p>
                  <p className="pt-1">Transferência internacional para EUA com cláusulas contratuais padrão.</p>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-2 px-6 py-4 border-t border-border">
              <button
                onClick={rejectAll}
                className="flex-1 h-9 rounded-lg border border-border bg-transparent text-sm text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors font-medium"
              >
                Rejeitar
              </button>
              <button
                onClick={saveCustom}
                className="flex-1 h-9 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
              >
                Salvar escolha
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Banner fixo no bottom ── */}
      {!showModal && (
        <div className="fixed bottom-0 left-0 right-0 z-[100] border-t border-border bg-card/90 backdrop-blur-md shadow-[0_-4px_24px_rgba(0,0,0,0.12)]">
          <div className="max-w-5xl mx-auto px-4 py-4 flex flex-col sm:flex-row items-start sm:items-center gap-4">
            {/* Text */}
            <div className="flex items-start gap-3 flex-1 min-w-0">
              <Cookie className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
              <p className="text-sm text-muted-foreground leading-relaxed">
                Usamos cookies essenciais para o funcionamento da plataforma e, com seu consentimento, cookies
                analíticos e de comportamento.{' '}
                <a
                  href="/privacidade"
                  className="text-primary underline underline-offset-4 hover:text-primary/80 transition-colors"
                >
                  Política de Privacidade
                </a>
                .
              </p>
            </div>

            {/* Buttons — equal visual weight */}
            <div className="flex items-center gap-2 flex-shrink-0 w-full sm:w-auto">
              <button
                onClick={rejectAll}
                className="flex-1 sm:flex-none h-9 px-4 rounded-lg border border-border bg-transparent text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors whitespace-nowrap"
              >
                Rejeitar
              </button>
              <button
                onClick={() => setShowModal(true)}
                className="flex-1 sm:flex-none h-9 px-4 rounded-lg border border-border bg-transparent text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors whitespace-nowrap"
              >
                Personalizar
              </button>
              <button
                onClick={acceptAll}
                className="flex-1 sm:flex-none h-9 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors whitespace-nowrap"
              >
                Aceitar tudo
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
