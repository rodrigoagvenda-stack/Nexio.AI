import { NextRequest, NextResponse } from 'next/server';

const store = new Map<string, { count: number; resetAt: number }>();

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
