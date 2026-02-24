'use client';

import { useState, useEffect } from 'react';
import { ExternalLink } from 'lucide-react';

interface LinkMeta {
  title: string;
  description: string;
  image: string;
  siteName: string;
  domain: string;
  url: string;
}

// Branding para serviços conhecidos que bloqueiam crawlers
const BRAND_MAP: Record<string, { name: string; bg: string; icon: React.ReactNode }> = {
  'meet.google.com': {
    name: 'Google Meet',
    bg: 'bg-[#00897B]',
    icon: <GoogleMeetIcon />,
  },
  'calendar.google.com': {
    name: 'Google Agenda',
    bg: 'bg-[#1A73E8]',
    icon: <GoogleCalendarIcon />,
  },
};

function isBranded(domain: string) {
  return Object.keys(BRAND_MAP).some((k) => domain.includes(k));
}

function getBrand(domain: string) {
  const key = Object.keys(BRAND_MAP).find((k) => domain.includes(k));
  return key ? BRAND_MAP[key] : null;
}

// ─── Google Meet SVG ─────────────────────────────────────────────────────────
function GoogleMeetIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="48" height="48" rx="10" fill="white" />
      <path d="M28 18H12C10.9 18 10 18.9 10 20V32L14 28H28C29.1 28 30 27.1 30 26V20C30 18.9 29.1 18 28 18Z" fill="#00897B" />
      <path d="M38 20L32 24L38 28V20Z" fill="#00897B" />
    </svg>
  );
}

// ─── Google Calendar SVG ──────────────────────────────────────────────────────
function GoogleCalendarIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="48" height="48" rx="10" fill="white" />
      <rect x="10" y="14" width="28" height="24" rx="2" fill="#1A73E8" />
      <rect x="10" y="14" width="28" height="8" rx="2" fill="#1A73E8" />
      <rect x="10" y="18" width="28" height="4" fill="#1A73E8" />
      <path d="M10 22H38V36C38 37.1 37.1 38 36 38H12C10.9 38 10 37.1 10 36V22Z" fill="white" />
      <text x="24" y="34" textAnchor="middle" fontSize="11" fontWeight="bold" fill="#1A73E8">
        {new Date().getDate()}
      </text>
      <rect x="16" y="11" width="3" height="6" rx="1.5" fill="#1557B0" />
      <rect x="29" y="11" width="3" height="6" rx="1.5" fill="#1557B0" />
    </svg>
  );
}

// ─── Google "G" logo ──────────────────────────────────────────────────────────
function GoogleLogo({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────
export function LinkPreviewCard({ url }: { url: string }) {
  const [meta, setMeta] = useState<LinkMeta | null>(null);
  const [loading, setLoading] = useState(true);

  const domain = (() => {
    try { return new URL(url).hostname.replace('www.', ''); } catch { return url; }
  })();

  const isGoogle = domain.includes('google.com');
  const brand = getBrand(domain);

  useEffect(() => {
    if (isBranded(domain)) { setLoading(false); return; }
    fetch(`/api/link-preview?url=${encodeURIComponent(url)}`)
      .then((r) => r.json())
      .then((data) => setMeta(data))
      .catch(() => setMeta(null))
      .finally(() => setLoading(false));
  }, [url, domain]);

  // ─── Card branded (Google Meet / Agenda) ──────────────────────────────────
  if (brand) {
    return (
      <a href={url} target="_blank" rel="noopener noreferrer" className="block mt-2">
        <div className="rounded-xl border border-border overflow-hidden bg-background/60 hover:bg-background/80 transition-colors flex items-stretch">
          <div className={`${brand.bg} flex items-center justify-center px-4 shrink-0`}>
            {brand.icon}
          </div>
          <div className="flex-1 px-4 py-3 min-w-0">
            <p className="text-sm font-semibold">{brand.name}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {domain.includes('meet') ? 'Clique para entrar na videochamada' : 'Clique para ver o evento na agenda'}
            </p>
            <p className="text-[10px] text-muted-foreground mt-1 opacity-60">{domain}</p>
          </div>
          <div className="flex items-center pr-3">
            <ExternalLink className="h-4 w-4 text-muted-foreground" />
          </div>
        </div>
      </a>
    );
  }

  // ─── Loading ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <a href={url} target="_blank" rel="noopener noreferrer" className="block mt-2">
        <div className="rounded-xl border border-border bg-background/40 h-16 animate-pulse" />
      </a>
    );
  }

  // ─── OG Preview genérico ──────────────────────────────────────────────────
  if (meta) {
    return (
      <a href={url} target="_blank" rel="noopener noreferrer" className="block mt-2">
        <div className="max-w-sm rounded-xl border border-border overflow-hidden bg-background/60 hover:bg-background/80 transition-colors">
          {meta.image && (
            <img
              src={meta.image}
              alt={meta.title}
              className="w-full h-36 object-cover"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
          )}
          <div className="p-3 flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold leading-snug line-clamp-2">{meta.title}</p>
              {meta.description && (
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{meta.description}</p>
              )}
              <div className="flex items-center gap-1 mt-1.5">
                {isGoogle && <GoogleLogo size={12} />}
                <p className="text-[10px] text-muted-foreground opacity-70">{meta.domain}</p>
              </div>
            </div>
            <ExternalLink className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
          </div>
        </div>
      </a>
    );
  }

  // ─── Fallback: link simples ───────────────────────────────────────────────
  return (
    <a href={url} target="_blank" rel="noopener noreferrer"
      className="text-blue-400 hover:underline text-sm break-all">
      {url}
    </a>
  );
}
