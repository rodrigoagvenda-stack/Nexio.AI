import { NextRequest, NextResponse } from 'next/server';

const store = new Map<string, { count: number; resetAt: number }>();

// Limpa entradas expiradas a cada 5 minutos para evitar crescimento ilimitado do Map
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (now > entry.resetAt) store.delete(key);
  }
}, 5 * 60 * 1000).unref();

export function rateLimit(options: { limit: number; windowMs: number }) {
  return function check(request: NextRequest): NextResponse | null {
    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
      request.headers.get('x-real-ip') ||
      'unknown';

    const key = `${ip}:${request.nextUrl.pathname}`;
    const now = Date.now();
    const entry = store.get(key);

    if (!entry || now > entry.resetAt) {
      store.set(key, { count: 1, resetAt: now + options.windowMs });
      return null;
    }

    entry.count++;

    if (entry.count > options.limit) {
      return NextResponse.json(
        { success: false, message: 'Muitas requisições. Tente novamente em breve.' },
        { status: 429 }
      );
    }

    return null;
  };
}
