import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get('url');
  if (!url) return NextResponse.json({ error: 'URL inválida' }, { status: 400 });

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
