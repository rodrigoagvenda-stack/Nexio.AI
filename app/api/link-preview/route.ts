import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/require-auth';
import { rateLimit } from '@/lib/rate-limit';

const PRIVATE_IP = /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.|::1|fc00:|fd)/i;

function isPrivateUrl(rawUrl: string): boolean {
  try {
    const { hostname } = new URL(rawUrl);
    return PRIVATE_IP.test(hostname);
  } catch {
    return true;
  }
}

export async function GET(request: NextRequest) {
  const { context, error: authError } = await requireAuth(request);
  if (authError) return authError;

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown';
  const rl = rateLimit({ key: `link-preview:${ip}`, limit: 30, windowMs: 60_000 });
  if (!rl.success) return NextResponse.json({ error: 'Muitas requisições' }, { status: 429 });

  const url = request.nextUrl.searchParams.get('url');
  if (!url) return NextResponse.json({ error: 'URL inválida' }, { status: 400 });

  if (isPrivateUrl(url)) {
    return NextResponse.json({ error: 'URL não permitida' }, { status: 400 });
  }

  const domain = (() => {
    try { return new URL(url).hostname.replace('www.', ''); } catch { return url; }
  })();

  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)' },
      signal: AbortSignal.timeout(6000),
      redirect: 'follow',
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const html = await res.text();

    const getMeta = (prop: string): string | null => {
      const patterns = [
        new RegExp(`<meta[^>]+property=["']og:${prop}["'][^>]+content=["']([^"']+)["']`, 'i'),
        new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:${prop}["']`, 'i'),
        new RegExp(`<meta[^>]+name=["']${prop}["'][^>]+content=["']([^"']+)["']`, 'i'),
        new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+name=["']${prop}["']`, 'i'),
      ];
      for (const p of patterns) {
        const m = html.match(p);
        if (m?.[1]) return m[1].trim();
      }
      return null;
    };

    const title = getMeta('title') || html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.trim() || domain;
    const description = getMeta('description') || '';
    const image = getMeta('image') || '';
    const siteName = getMeta('site_name') || '';

    return NextResponse.json({ title, description, image, siteName, domain, url });
  } catch {
    return NextResponse.json({ title: domain, description: '', image: '', siteName: '', domain, url });
  }
}
